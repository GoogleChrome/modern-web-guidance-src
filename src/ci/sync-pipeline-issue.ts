/**
 * Synchronizes the canonical Content & Eval Pipeline tracker issue (#1815).
 *
 * Usage:
 *   node src/ci/sync-pipeline-issue.ts           # dry-run (prints markdown preview)
 *   node src/ci/sync-pipeline-issue.ts --write   # updates issue #1815 on GitHub
 */

import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { parseBooleanEnv } from '../core/env.ts';
import { extractFeatureIds, stripTmpPrefix } from '../core/feature-parser.ts';
import {
  EXPECTATIONS_FILE,
  GRADER_FILE,
  GUIDE_FILE,
  ProjectStatus,
  TARGETS_DIR,
  TASK_FILE,
  getGuideStatus,
  scanAllGuides,
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';

export const ORG = 'GoogleChrome';
export const REPO = 'modern-web-guidance-src';
export const REPO_URL = `https://github.com/${ORG}/${REPO}`;
export const PIPELINE_ISSUE_NUMBER = Number(process.env.PIPELINE_ISSUE_NUMBER || 1815);
export const EXPECTATIONS_CHANGED_LABEL = 'expectations-changed';

export const BURNDOWN_START_DATE = '2026-10-04T00:00:00Z';
export const BURNDOWN_INITIAL_REMAINING = 66;
export const BURNDOWN_TARGET_EVAL_COMPLETE = 200;
export const BURNDOWN_WEEKS = 5;

export function computeIdealLine(
  initial: number = BURNDOWN_INITIAL_REMAINING,
  weeks: number = BURNDOWN_WEEKS
): number[] {
  return Array.from({ length: weeks + 1 }, (_, i) => Math.round(initial - (initial / weeks) * i));
}

export const IDEAL_LINE = computeIdealLine();

const BURNDOWN_MARKER_REGEX = /<!--\s*burndown-checkpoints:\s*(\[[\d,\s]+\])\s*-->/;
const MERMAID_BAR_REGEX = /^\s*bar\s+\[([\d,\s]+)\]/m;

export interface PrSummary {
  number: number;
  title: string;
  body: string;
  isDraft: boolean;
  headRefName: string;
  author: string;
  reviewers: string[];
  labels: string[];
  files: string[];
}

export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  assignees: string[];
  labels: string[];
}

export interface EvalPrMetrics {
  dailyGrindPassRate: number | null;
  devtoolsTimesPassRate: number | null;
  isHealthy: boolean;
}

export interface BurndownData {
  remaining: number;
  initial: number;
  weekIdx: number;
  xAxisLabels: string[];
  barValues: number[];
  idealLine: number[];
  idealPerWeek: number;
  requiredLine: number[];
  requiredPerWeek: number;
}

export interface GitFileHistory {
  expSha: string;
  expTs: number;
  expDate: string;
  expPr: number | null;
  evalSha: string;
  evalTs: number;
  evalDate: string;
  isSubstantiveDiff?: boolean;
}

export interface StaleEvalItem {
  slug: string;
  expDate: string;
  expPr: number | null;
  evalDate: string;
  issueNumber: number | null;
}

export interface LegacyEvalItem {
  slug: string;
  missingTarget: 'daily-grind' | 'devtools-times';
}

export interface NeedsGuidancePrItem {
  slug: string;
  hasDirOnMain: boolean;
  prNumber: number;
  isDraft: boolean;
  issueNumber: number | null;
  author: string;
  reviewers: string[];
}

export interface NeedsGuidanceIssueItem {
  slug: string;
  issueNumber: number | null;
  isDraftGuide: boolean;
  assignees: string[];
}

export interface OpenEvalPrItem {
  slug: string;
  prNumber: number;
  isDraft: boolean;
  metrics: EvalPrMetrics;
  author: string;
  reviewers: string[];
}

export interface PipelineReportData {
  completeCount: number;
  evalCompleteCount: number;
  burndown: BurndownData;
  needsGuidancePrs: NeedsGuidancePrItem[];
  needsGuidanceIssues: NeedsGuidanceIssueItem[];
  openEvalPrs: OpenEvalPrItem[];
  readyForEvalSlugs: string[];
  staleEvals: StaleEvalItem[];
  legacyEvals: LegacyEvalItem[];
  dualTargetCompleteCount: number;
}

// --- Pure Parsing & Calculation Helpers ---

/**
 * True when the diff on `expectations.md` contains substantive changes beyond
 * adding/modifying `Basic presence:` lines or blank lines.
 *
 * Rationale: `Basic presence:` lines are baseline smoke-test assertions added
 * across existing rubrics for grader-coverage accounting and do not alter the
 * feature-specific grading logic or require regenerating `grader.ts` / `targets/`.
 */
export function hasSubstantiveExpectationsDiff(diffText: string): boolean {
  const lines = diffText.split('\n');
  for (const line of lines) {
    if ((line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))) {
      const content = line.slice(1).trim();
      if (!content || content.startsWith('Basic presence:') || /^([-*]|\d+[.)])\s+Basic presence:/.test(content)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Extracts per-target guided Pass@1 and overall HEALTHY status from a `gd pr` evaluation report body.
 */
export function parseEvalReportFromPrBody(body: string): EvalPrMetrics {
  let dailyGrindPassRate: number | null = null;
  let devtoolsTimesPassRate: number | null = null;
  const targetStatuses: string[] = [];

  const targetSectionRegex = /##\s+Target:\s+`([^`]+)`(?:\s+\(Status:\s+`([^`]+)`\))?([\s\S]*?)(?=##\s+Target:|$)/g;
  for (const match of body.matchAll(targetSectionRegex)) {
    const targetName = match[1];
    const status = match[2];
    const sectionBody = match[3] || '';
    if (status) {
      targetStatuses.push(status);
    }
    const guidedMatch = /\|\s*\*\*Guided\*\*\s*\|\s*(\d+)%/i.exec(sectionBody);
    if (guidedMatch) {
      const rate = Number(guidedMatch[1]);
      if (targetName === 'daily-grind') dailyGrindPassRate = rate;
      if (targetName === 'devtools-times') devtoolsTimesPassRate = rate;
    }
  }

  const isHealthy =
    targetStatuses.length > 0 &&
    targetStatuses.every(s => s === 'HEALTHY') &&
    (dailyGrindPassRate === null || dailyGrindPassRate === 100) &&
    (devtoolsTimesPassRate === null || devtoolsTimesPassRate === 100);

  return {
    dailyGrindPassRate,
    devtoolsTimesPassRate,
    isHealthy,
  };
}

/**
 * Parses prior weekly burndown checkpoints from the existing issue #1815 body.
 */
export function parseBurndownCheckpoints(issueBody: string): number[] {
  const markerMatch = BURNDOWN_MARKER_REGEX.exec(issueBody);
  if (markerMatch) {
    try {
      const parsed = JSON.parse(markerMatch[1]) as unknown;
      if (Array.isArray(parsed) && parsed.length === BURNDOWN_WEEKS + 1 && parsed.every(n => typeof n === 'number')) {
        return [...parsed];
      }
    } catch {
      // Fall through to Mermaid bar fallback
    }
  }

  const barMatch = MERMAID_BAR_REGEX.exec(issueBody);
  if (barMatch) {
    const nums = barMatch[1].split(',').map(s => Number(s.trim()));
    if (nums.length === BURNDOWN_WEEKS + 1 && nums.every(n => !Number.isNaN(n))) {
      return nums;
    }
  }

  return [BURNDOWN_INITIAL_REMAINING, ...Array.from({ length: BURNDOWN_WEEKS }, () => 0)];
}

/**
 * Computes the burndown series for the 5-week batch (`W0..W5`).
 */
export function computeBurndown(
  evalCompleteCount: number,
  existingCheckpoints: number[],
  nowMs: number = Date.now()
): BurndownData {
  const remaining = Math.max(0, BURNDOWN_TARGET_EVAL_COMPLETE - evalCompleteCount);
  const startMs = Date.parse(BURNDOWN_START_DATE);
  const elapsedWeeks = (nowMs - startMs) / (7 * 86_400_000);
  const weekIdx = Math.min(BURNDOWN_WEEKS, Math.max(1, Math.ceil(elapsedWeeks)));

  const barValues = Array.from({ length: BURNDOWN_WEEKS + 1 }, (_, i) => {
    if (i === 0) return BURNDOWN_INITIAL_REMAINING;
    if (i < weekIdx) return existingCheckpoints[i] > 0 ? existingCheckpoints[i] : remaining;
    if (i === weekIdx) return remaining;
    return 0;
  });

  const requiredLine = Array.from({ length: BURNDOWN_WEEKS + 1 }, (_, i) => {
    if (i <= weekIdx) return barValues[i];
    const weeksLeft = BURNDOWN_WEEKS - weekIdx;
    return Math.round((remaining * (BURNDOWN_WEEKS - i)) / weeksLeft);
  });

  const xAxisLabels = Array.from({ length: BURNDOWN_WEEKS + 1 }, (_, i) =>
    i === weekIdx ? `W${i} (Now)` : `W${i}`
  );

  const idealPerWeek = Number((BURNDOWN_INITIAL_REMAINING / BURNDOWN_WEEKS).toFixed(1));
  const weeksLeft = Math.max(1, BURNDOWN_WEEKS - weekIdx);
  const requiredPerWeek = Number((remaining / weeksLeft).toFixed(1));

  return {
    remaining,
    initial: BURNDOWN_INITIAL_REMAINING,
    weekIdx,
    xAxisLabels,
    barValues,
    idealLine: computeIdealLine(),
    idealPerWeek,
    requiredLine,
    requiredPerWeek,
  };
}

/**
 * Formats an ISO date (`YYYY-MM-DD`) as `Mon D` (e.g., `Oct 4`).
 */
export function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  return `${months[monthIdx] ?? match[2]} ${day}`;
}

/**
 * Collects last-commit timestamps for `expectations.md` vs eval files (`grader.ts`, `tasks/`, `targets/`)
 * across all guides in a single `git log` invocation, ignoring pure rename commits (`--diff-filter=AM`)
 * and checking `hasSubstantiveExpectationsDiff` when `expTs > evalTs`.
 */
export function collectGitGuideHistory(cwd: string = rootDir): Map<string, GitFileHistory> {
  const history = new Map<string, GitFileHistory>();
  let output = '';
  try {
    output = child_process.execFileSync(
      'git',
      ['log', '--no-renames', '--diff-filter=AM', '--name-only', '--format=COMMIT|%H|%ct|%cs|%s', '--', 'guides/'],
      { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
  } catch {
    return history;
  }

  let currentSha = '';
  let currentTs = 0;
  let currentDate = '';
  let currentPr: number | null = null;

  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('COMMIT|')) {
      const parts = line.split('|');
      currentSha = parts[1] || '';
      currentTs = Number(parts[2]) || 0;
      currentDate = parts[3] || '';
      const subject = parts.slice(4).join('|');
      const prMatches = [...subject.matchAll(/#(\d+)/g)];
      currentPr = prMatches.length > 0 ? Number(prMatches[prMatches.length - 1][1]) : null;
      continue;
    }

    const match = /^guides\/([^/]+\/[^/]+)\/(.+)$/.exec(line);
    if (!match) continue;
    const slug = match[1];
    const relFile = match[2];

    const isExp = relFile === EXPECTATIONS_FILE;
    const isEval =
      relFile === GRADER_FILE ||
      relFile.startsWith('tasks/') ||
      relFile.startsWith(`${TARGETS_DIR}/`);

    if (!isExp && !isEval) continue;

    let entry = history.get(slug);
    if (!entry) {
      entry = { expSha: '', expTs: 0, expDate: '', expPr: null, evalSha: '', evalTs: 0, evalDate: '' };
      history.set(slug, entry);
    }

    if (isExp && entry.expTs === 0) {
      entry.expSha = currentSha;
      entry.expTs = currentTs;
      entry.expDate = currentDate;
      entry.expPr = currentPr;
    }
    if (isEval && entry.evalTs === 0) {
      entry.evalSha = currentSha;
      entry.evalTs = currentTs;
      entry.evalDate = currentDate;
    }
  }

  for (const [slug, entry] of history.entries()) {
    if (entry.expTs > entry.evalTs && entry.evalSha && entry.expSha) {
      try {
        const diff = child_process.execFileSync(
          'git',
          ['diff', '-U0', entry.evalSha, entry.expSha, '--', `guides/${slug}/${EXPECTATIONS_FILE}`],
          { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        entry.isSubstantiveDiff = hasSubstantiveExpectationsDiff(diff);
      } catch {
        entry.isSubstantiveDiff = true;
      }
    }
  }

  return history;
}

/**
 * Finds complete guides whose `expectations.md` was substantively updated after their eval files,
 * unioned with any open `expectations-changed` issues.
 */
export function findStaleEvals(
  guides: GuideInventory[],
  gitHistory: Map<string, GitFileHistory>,
  expectationsChangedIssues: IssueSummary[]
): StaleEvalItem[] {
  const issueByGuideName = new Map<string, number>();
  for (const issue of expectationsChangedIssues) {
    const m = /^Expectations changed for the (.+) guide$/i.exec(issue.title.trim());
    if (m) {
      issueByGuideName.set(m[1], issue.number);
    }
  }

  const items: StaleEvalItem[] = [];
  for (const g of guides) {
    if (getGuideStatus(g) !== null) continue;
    if (!g.hasExpectations || g.expectationsEmpty || !g.hasGrader) continue;

    const slug = `${g.category}/${g.name}`;
    const hist = gitHistory.get(slug);
    const openIssueNumber = issueByGuideName.get(g.name) ?? null;
    const isGitStale = Boolean(
      hist &&
        hist.expTs > 0 &&
        hist.evalTs > 0 &&
        hist.expTs > hist.evalTs &&
        (hist.isSubstantiveDiff ?? true)
    );

    if (isGitStale || openIssueNumber !== null) {
      items.push({
        slug,
        expDate: hist?.expDate ? formatShortDate(hist.expDate) : 'recently',
        expPr: hist?.expPr ?? null,
        evalDate: hist?.evalDate ? formatShortDate(hist.evalDate) : 'earlier',
        issueNumber: openIssueNumber,
      });
    }
  }

  return items.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Finds guides still using legacy root `grader.ts` instead of `targets/{daily-grind,devtools-times}/`.
 */
export function findLegacyFormatGuides(guides: GuideInventory[]): {
  legacyEvals: LegacyEvalItem[];
  dualTargetCompleteCount: number;
} {
  const legacyEvals: LegacyEvalItem[] = [];
  let dualTargetCompleteCount = 0;

  for (const g of guides) {
    const hasDualTargets = Boolean(g.targets && g.targets.length >= 2 && g.hasGrader);
    if (hasDualTargets) {
      dualTargetCompleteCount++;
      continue;
    }

    const rootGraderPath = path.join(g.dir, GRADER_FILE);
    if (fs.existsSync(rootGraderPath)) {
      const taskMdPath = path.join(g.dir, 'tasks', TASK_FILE);
      let baseApp = 'daily-grind';
      if (fs.existsSync(taskMdPath)) {
        try {
          const parsed = matter(fs.readFileSync(taskMdPath, 'utf8'));
          if (parsed.data?.base_app === 'devtools-times') {
            baseApp = 'devtools-times';
          }
        } catch {
          // Default to daily-grind
        }
      }
      legacyEvals.push({
        slug: `${g.category}/${g.name}`,
        missingTarget: baseApp === 'devtools-times' ? 'daily-grind' : 'devtools-times',
      });
    }
  }

  legacyEvals.sort((a, b) => a.slug.localeCompare(b.slug));
  return { legacyEvals, dualTargetCompleteCount };
}

/**
 * Renders the full Markdown body for the Canonical Content & Eval Pipeline issue (#1815).
 */
export function renderPipelineIssueBody(data: PipelineReportData): string {
  const totalNeedsGuidance = data.needsGuidancePrs.length + data.needsGuidanceIssues.length;
  const totalNeedsEvals = new Set([
    ...data.openEvalPrs.map(p => p.slug),
    ...data.readyForEvalSlugs,
  ]).size;

  const lines: string[] = [
    '# Content & Eval Pipeline',
    '',
    `**${totalNeedsGuidance}** ${ProjectStatus.NeedsGuidance} (\`${data.needsGuidancePrs.length}\` open PRs · \`${data.needsGuidanceIssues.length}\` open issues) · **${totalNeedsEvals}** ${ProjectStatus.NeedsEvals} (\`${data.openEvalPrs.length}\` open PRs · \`${data.readyForEvalSlugs.length}\` ready) · **${data.completeCount}** Complete`,
    '',
    `### Current Batch Burndown (\`${data.burndown.remaining} / ${data.burndown.initial}\` remaining)`,
    '',
    '```mermaid',
    "%%{init: {'themeVariables': {'xyChart': {'plotColorPalette': '#238636, #8b949e, #58a6ff'}}}}%%",
    'xychart-beta',
    `    x-axis [${data.burndown.xAxisLabels.map(l => `"${l}"`).join(', ')}]`,
    '    y-axis "Remaining" 0 --> 70',
    `    bar [${data.burndown.barValues.join(', ')}]`,
    `    line [${data.burndown.idealLine.join(', ')}]`,
    `    line [${data.burndown.requiredLine.join(', ')}]`,
    '```',
    `<sub>🟩 <b>Bars</b>: Actual remaining at each checkpoint (\`${data.burndown.initial}\` → \`${data.burndown.remaining}\`) · ⬜ <b>Gray line</b>: Ideal linear pace (\`-${data.burndown.idealPerWeek}/wk\`) · 🟦 <b>Blue line</b>: Required pace from \`W${data.burndown.weekIdx}\` (\`-${data.burndown.requiredPerWeek}/wk\`)</sub>`,
    `<!-- burndown-checkpoints: ${JSON.stringify(data.burndown.barValues)} -->`,
    '',
    '---',
    '',
    `## Stage 2: ${ProjectStatus.NeedsGuidance} (${totalNeedsGuidance})`,
    '',
    `#### In review — Open PRs (${data.needsGuidancePrs.length})`,
  ];

  for (const item of data.needsGuidancePrs) {
    const guideHref = item.hasDirOnMain
      ? `${REPO_URL}/tree/main/guides/${item.slug}`
      : `${REPO_URL}/pull/${item.prNumber}`;
    const prPart = `[PR #${item.prNumber}](${REPO_URL}/pull/${item.prNumber})${item.isDraft ? ' (Draft)' : ''}`;
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    const reviewerPart =
      item.reviewers.length > 0
        ? ` → ${item.reviewers.map(r => `\`${r}\``).join(', ')}`
        : '';
    lines.push(
      `- [ ] [**${item.slug}**](${guideHref}) · ${prPart}${issuePart} · \`${item.author}\`${reviewerPart}`
    );
  }

  lines.push('', `#### Open \`new-use-case\` issues (${data.needsGuidanceIssues.length})`);
  for (const item of data.needsGuidanceIssues) {
    const guideHref = `${REPO_URL}/tree/main/guides/${item.slug}`;
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    const draftPart = item.isDraftGuide ? ' (`draft: true`)' : '';
    const assigneePart =
      item.assignees.length > 0
        ? ` · ${item.assignees.map(a => `\`${a}\``).join(', ')}`
        : '';
    lines.push(`- [ ] [**${item.slug}**](${guideHref})${issuePart}${draftPart}${assigneePart}`);
  }

  lines.push(
    '',
    '---',
    '',
    `## Stage 3: ${ProjectStatus.NeedsEvals} (${totalNeedsEvals})`,
    '',
    `#### Open eval PRs (${data.openEvalPrs.length})`
  );

  for (const item of data.openEvalPrs) {
    const guideHref = `${REPO_URL}/tree/main/guides/${item.slug}`;
    const prPart = `[PR #${item.prNumber}](${REPO_URL}/pull/${item.prNumber})`;
    const healthyPart = item.metrics.isHealthy ? ' · `HEALTHY`' : '';
    const rateParts: string[] = [];
    if (item.metrics.dailyGrindPassRate !== null) {
      rateParts.push(`dg ${item.metrics.dailyGrindPassRate}%`);
    }
    if (item.metrics.devtoolsTimesPassRate !== null) {
      rateParts.push(`dt ${item.metrics.devtoolsTimesPassRate}%`);
    }
    const passPart = rateParts.length > 0 ? ` · Pass@1: ${rateParts.join(', ')}` : '';
    const reviewerPart =
      item.reviewers.length > 0
        ? ` → ${item.reviewers.map(r => `\`${r}\``).join(', ')}`
        : '';
    lines.push(
      `- [ ] [**${item.slug}**](${guideHref}) · ${prPart}${healthyPart}${passPart} · \`${item.author}\`${reviewerPart}`
    );
  }

  lines.push('', `#### Ready for \`gd dev\` (${data.readyForEvalSlugs.length})`);
  for (const slug of data.readyForEvalSlugs) {
    lines.push(`- [ ] [**${slug}**](${REPO_URL}/tree/main/guides/${slug})`);
  }

  lines.push('', `#### Stale evals (${data.staleEvals.length})`);
  for (const item of data.staleEvals) {
    const guideHref = `${REPO_URL}/tree/main/guides/${item.slug}`;
    const prPart = item.expPr ? ` ([PR #${item.expPr}](${REPO_URL}/pull/${item.expPr}))` : '';
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    lines.push(
      `- [ ] [**${item.slug}**](${guideHref}) · \`expectations.md\` updated ${item.expDate}${prPart}, \`grader.ts\` unchanged since ${item.evalDate}${issuePart}`
    );
  }

  lines.push(
    '',
    '---',
    '',
    `### Legacy eval format (${data.legacyEvals.length})`,
    '',
    '<details>',
    `<summary>Show ${data.legacyEvals.length} guides using root <code>grader.ts</code> instead of <code>targets/{daily-grind,devtools-times}/</code> (${data.dualTargetCompleteCount} dual-target complete)</summary>`,
    ''
  );

  for (const item of data.legacyEvals) {
    lines.push(
      `- [ ] [**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug}) · missing \`${item.missingTarget}\``
    );
  }

  lines.push('', '</details>', '');
  return lines.join('\n');
}

// --- GitHub Fetching & Assembly ---

function fetchOpenPrs(): PrSummary[] {
  const raw = child_process.execFileSync(
    'gh',
    [
      'pr',
      'list',
      '--repo',
      `${ORG}/${REPO}`,
      '--state',
      'open',
      '--limit',
      '150',
      '--json',
      'number,title,body,isDraft,headRefName,author,reviewRequests,labels,files',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const parsed = JSON.parse(raw) as Array<{
    number: number;
    title: string;
    body?: string;
    isDraft?: boolean;
    headRefName?: string;
    author?: { login?: string };
    reviewRequests?: Array<{ login?: string; name?: string }>;
    labels?: Array<{ name?: string }>;
    files?: Array<{ path?: string }>;
  }>;

  return parsed.map(p => ({
    number: p.number,
    title: p.title,
    body: p.body ?? '',
    isDraft: Boolean(p.isDraft),
    headRefName: p.headRefName ?? '',
    author: p.author?.login ?? 'unknown',
    reviewers: (p.reviewRequests ?? []).map(r => r.login ?? r.name ?? '').filter(Boolean),
    labels: (p.labels ?? []).map(l => l.name ?? '').filter(Boolean),
    files: (p.files ?? []).map(f => f.path ?? '').filter(Boolean),
  }));
}

function fetchOpenIssuesByLabel(label: string): IssueSummary[] {
  const raw = child_process.execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--repo',
      `${ORG}/${REPO}`,
      '--label',
      label,
      '--state',
      'open',
      '--limit',
      '300',
      '--json',
      'number,title,body,assignees,labels',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const parsed = JSON.parse(raw) as Array<{
    number: number;
    title: string;
    body?: string;
    assignees?: Array<{ login?: string }>;
    labels?: Array<{ name?: string }>;
  }>;

  return parsed.map(i => ({
    number: i.number,
    title: i.title,
    body: i.body ?? '',
    assignees: (i.assignees ?? []).map(a => a.login ?? '').filter(Boolean),
    labels: (i.labels ?? []).map(l => l.name ?? '').filter(Boolean),
  }));
}

function fetchIssueBody(issueNumber: number): string {
  try {
    return child_process.execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--repo', `${ORG}/${REPO}`, '--json', 'body', '--jq', '.body'],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
  } catch {
    return '';
  }
}

export interface UseCaseIssueIndex {
  nameToIssueMap: Map<string, IssueSummary>;
  subdirToIssueMap: Map<string, IssueSummary>;
  featureIdToIssueMap: Map<string, IssueSummary>;
}

/**
 * Pre-indexes open `new-use-case` and `new-feature` issues once for O(1) guide lookups.
 */
export function buildUseCaseIssueIndex(
  useCaseIssues: IssueSummary[],
  featureIssues: IssueSummary[]
): UseCaseIssueIndex {
  const nameToIssueMap = new Map<string, IssueSummary>();
  const subdirToIssueMap = new Map<string, IssueSummary>();
  const featureIdToIssueMap = new Map<string, IssueSummary>();

  for (const issue of useCaseIssues) {
    const titleMatch = /Create guide(?: and evals)? for the (.+) use case/i.exec(issue.title);
    if (titleMatch) {
      nameToIssueMap.set(titleMatch[1].trim(), issue);
    }
    const bodyMatch = /Use case subdir: \[([^\]]+)\]/.exec(issue.body);
    if (bodyMatch) {
      subdirToIssueMap.set(bodyMatch[1].trim(), issue);
    }
    const templateCategoryMatch = /###\s+Category\s*\r?\n+([^\r\n#]+)/i.exec(issue.body);
    const templateSlugMatch = /###\s+Use case slug\s*\r?\n+([^\r\n#]+)/i.exec(issue.body);
    if (templateCategoryMatch && templateSlugMatch) {
      const category = templateCategoryMatch[1].trim().toLowerCase();
      const tSlug = templateSlugMatch[1].trim().toLowerCase();
      if (category && tSlug) {
        if (!nameToIssueMap.has(tSlug)) nameToIssueMap.set(tSlug, issue);
        if (!subdirToIssueMap.has(`guides/${category}/${tSlug}`)) {
          subdirToIssueMap.set(`guides/${category}/${tSlug}`, issue);
        }
      }
    }
  }

  for (const featIssue of featureIssues) {
    for (const fid of extractFeatureIds(featIssue.body)) {
      const cleanFid = stripTmpPrefix(fid);
      if (!featureIdToIssueMap.has(cleanFid)) {
        featureIdToIssueMap.set(cleanFid, featIssue);
      }
    }
  }

  return { nameToIssueMap, subdirToIssueMap, featureIdToIssueMap };
}

/**
 * Matches open `new-use-case` issues (including template-filed issues) to guide slugs (`category/name` or `name`).
 */
export function matchUseCaseIssue(
  slug: string,
  guideName: string,
  useCaseIssuesOrIndex: IssueSummary[] | UseCaseIssueIndex,
  featureIssues: IssueSummary[] = [],
  featureIds: string[] = []
): IssueSummary | null {
  const index = Array.isArray(useCaseIssuesOrIndex)
    ? buildUseCaseIssueIndex(useCaseIssuesOrIndex, featureIssues)
    : useCaseIssuesOrIndex;

  const bySubdir = index.subdirToIssueMap.get(`guides/${slug}`);
  if (bySubdir) return bySubdir;
  const byName = index.nameToIssueMap.get(guideName);
  if (byName) return byName;

  for (const fid of featureIds) {
    const featIssue = index.featureIdToIssueMap.get(stripTmpPrefix(fid));
    if (featIssue) return featIssue;
  }
  return null;
}

const CATCHALL_INFRA_OWNERS = new Set(['paulirish', 'micahjo7']);
const EVAL_INFRA_OWNERS = new Set(['paulirish', 'micahjo7', 'TravenReese']);

/**
 * Strips catch-all CODEOWNERS (`paulirish`, `micahjo7`) when more specific ATL or eval reviewers are present.
 */
export function filterCatchAllReviewers(reviewers: string[], stage: 'guidance' | 'evals'): string[] {
  if (reviewers.length <= 1) return reviewers;
  if (stage === 'guidance') {
    const nonEvalInfra = reviewers.filter(r => !EVAL_INFRA_OWNERS.has(r));
    if (nonEvalInfra.length > 0) return nonEvalInfra;
    const nonCatchAll = reviewers.filter(r => !CATCHALL_INFRA_OWNERS.has(r));
    return nonCatchAll.length > 0 ? nonCatchAll : reviewers;
  }
  const nonPaul = reviewers.filter(r => r !== 'paulirish');
  return nonPaul.length > 0 ? nonPaul : reviewers;
}

function isEvalPr(pr: PrSummary): boolean {
  return (
    pr.title.startsWith('grader updates:') ||
    (pr.labels.includes('gd-dev-eval') && !pr.labels.includes('gd-dev-content'))
  );
}

function resolveEvalPrs(
  openPrs: PrSummary[],
  guideBySlug: Map<string, GuideInventory>
): { openEvalPrs: OpenEvalPrItem[]; evalPrSlugs: Set<string> } {
  const openEvalPrs: OpenEvalPrItem[] = [];
  const evalPrSlugs = new Set<string>();

  for (const pr of openPrs) {
    if (!isEvalPr(pr)) continue;
    const touchedSlugs = new Set<string>();
    for (const file of pr.files) {
      const m = /^guides\/([^/]+\/[^/]+)\//.exec(file);
      if (m) touchedSlugs.add(m[1]);
    }
    for (const slug of touchedSlugs) {
      const inv = guideBySlug.get(slug);
      if (!inv || (getGuideStatus(inv) !== ProjectStatus.NeedsEvals && !inv.isDisciplineGuide)) {
        continue;
      }
      evalPrSlugs.add(slug);
      openEvalPrs.push({
        slug,
        prNumber: pr.number,
        isDraft: pr.isDraft,
        metrics: parseEvalReportFromPrBody(pr.body),
        author: pr.author,
        reviewers: filterCatchAllReviewers(pr.reviewers, 'evals'),
      });
    }
  }
  openEvalPrs.sort((a, b) => a.slug.localeCompare(b.slug));
  return { openEvalPrs, evalPrSlugs };
}

function resolveNeedsGuidancePrs(
  openPrs: PrSummary[],
  guideBySlug: Map<string, GuideInventory>,
  guideByName: Map<string, GuideInventory>,
  issueIndex: UseCaseIssueIndex
): { needsGuidancePrs: NeedsGuidancePrItem[]; slugsWithContentPr: Set<string> } {
  const needsGuidancePrs: NeedsGuidancePrItem[] = [];
  const slugsWithContentPr = new Set<string>();

  for (const pr of openPrs) {
    if (isEvalPr(pr)) continue;
    const touchedContentGuides = new Map<string, string[]>();
    for (const file of pr.files) {
      const m = /^guides\/([^/]+\/[^/]+)\/(guide\.md|expectations\.md|demo\.html)$/.exec(file);
      if (m) {
        const list = touchedContentGuides.get(m[1]) ?? [];
        list.push(m[2]);
        touchedContentGuides.set(m[1], list);
      }
    }

    for (const [slug, touchedFiles] of touchedContentGuides.entries()) {
      const inv = guideBySlug.get(slug);
      const guideName = slug.split('/')[1];
      const isNewFullGuidePr =
        !inv &&
        !guideByName.has(guideName) &&
        touchedFiles.includes(GUIDE_FILE) &&
        (touchedFiles.includes(EXPECTATIONS_FILE) || touchedFiles.includes('demo.html'));
      if (inv && getGuideStatus(inv) !== ProjectStatus.NeedsGuidance) continue;
      if (!inv && !isNewFullGuidePr) continue;

      slugsWithContentPr.add(slug);
      const matchedIssue = matchUseCaseIssue(slug, guideName, issueIndex, [], inv?.featureIds ?? []);
      const issueFromTitle = /^\[#(\d+)\]/.exec(pr.title);
      const issueNumber = matchedIssue?.number ?? (issueFromTitle ? Number(issueFromTitle[1]) : null);

      needsGuidancePrs.push({
        slug,
        hasDirOnMain: Boolean(inv),
        prNumber: pr.number,
        isDraft: pr.isDraft,
        issueNumber,
        author: pr.author,
        reviewers: filterCatchAllReviewers(pr.reviewers, 'guidance'),
      });
    }
  }
  needsGuidancePrs.sort((a, b) => a.slug.localeCompare(b.slug));
  return { needsGuidancePrs, slugsWithContentPr };
}

function resolveNeedsGuidanceIssues(
  validGuides: GuideInventory[],
  slugsWithContentPr: Set<string>,
  issueIndex: UseCaseIssueIndex
): NeedsGuidanceIssueItem[] {
  const needsGuidanceIssues: NeedsGuidanceIssueItem[] = [];
  for (const g of validGuides) {
    if (getGuideStatus(g) !== ProjectStatus.NeedsGuidance) continue;
    const slug = `${g.category}/${g.name}`;
    if (slugsWithContentPr.has(slug)) continue;

    const matchedIssue = matchUseCaseIssue(slug, g.name, issueIndex, [], g.featureIds);
    needsGuidanceIssues.push({
      slug,
      issueNumber: matchedIssue?.number ?? null,
      isDraftGuide: !g.isStub && Boolean(g.draft),
      assignees: matchedIssue?.assignees ?? [],
    });
  }
  return needsGuidanceIssues.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Assembles the full `PipelineReportData` from disk inventory, git history, and GitHub PRs/issues.
 */
export function buildPipelineReportData(params: {
  guides: GuideInventory[];
  openPrs: PrSummary[];
  openUseCaseIssues: IssueSummary[];
  openFeatureIssues: IssueSummary[];
  openExpectationsChangedIssues: IssueSummary[];
  gitHistory: Map<string, GitFileHistory>;
  existingIssueBody: string;
  nowMs?: number;
}): PipelineReportData {
  const validGuides = params.guides.filter(g => g.category !== 'test-results' && (g.hasGuide || g.isStub));
  const guideBySlug = new Map<string, GuideInventory>();
  const guideByName = new Map<string, GuideInventory>();
  for (const g of validGuides) {
    guideBySlug.set(`${g.category}/${g.name}`, g);
    guideByName.set(g.name, g);
  }

  const completeGuides = validGuides.filter(g => getGuideStatus(g) === null);
  const evalCompleteCount = completeGuides.filter(g => g.hasGrader).length;
  const existingCheckpoints = parseBurndownCheckpoints(params.existingIssueBody);
  const burndown = computeBurndown(evalCompleteCount, existingCheckpoints, params.nowMs);

  const issueIndex = buildUseCaseIssueIndex(params.openUseCaseIssues, params.openFeatureIssues);
  const { openEvalPrs, evalPrSlugs } = resolveEvalPrs(params.openPrs, guideBySlug);
  const readyForEvalSlugs = validGuides
    .filter(g => getGuideStatus(g) === ProjectStatus.NeedsEvals && !evalPrSlugs.has(`${g.category}/${g.name}`))
    .map(g => `${g.category}/${g.name}`)
    .sort((a, b) => a.localeCompare(b));

  const { needsGuidancePrs, slugsWithContentPr } = resolveNeedsGuidancePrs(
    params.openPrs,
    guideBySlug,
    guideByName,
    issueIndex
  );
  const needsGuidanceIssues = resolveNeedsGuidanceIssues(validGuides, slugsWithContentPr, issueIndex);
  const staleEvals = findStaleEvals(validGuides, params.gitHistory, params.openExpectationsChangedIssues);
  const { legacyEvals, dualTargetCompleteCount } = findLegacyFormatGuides(validGuides);

  return {
    completeCount: completeGuides.length,
    evalCompleteCount,
    burndown,
    needsGuidancePrs,
    needsGuidanceIssues,
    openEvalPrs,
    readyForEvalSlugs,
    staleEvals,
    legacyEvals,
    dualTargetCompleteCount,
  };
}

export function runSyncPipelineIssue(): void {
  const hasWriteFlag = process.argv.includes('--write') || process.argv.includes('--live');
  const isDryRunEnv = parseBooleanEnv(process.env.DRY_RUN, true);
  const isDryRun = hasWriteFlag ? false : isDryRunEnv;

  const guides = scanAllGuides();
  const openPrs = fetchOpenPrs();
  const openUseCaseIssues = fetchOpenIssuesByLabel('new-use-case');
  const openFeatureIssues = fetchOpenIssuesByLabel('new-feature');
  const openExpectationsChangedIssues = fetchOpenIssuesByLabel(EXPECTATIONS_CHANGED_LABEL);
  const gitHistory = collectGitGuideHistory(rootDir);
  const existingIssueBody = fetchIssueBody(PIPELINE_ISSUE_NUMBER);

  const reportData = buildPipelineReportData({
    guides,
    openPrs,
    openUseCaseIssues,
    openFeatureIssues,
    openExpectationsChangedIssues,
    gitHistory,
    existingIssueBody,
  });

  const nextBody = renderPipelineIssueBody(reportData);

  if (isDryRun) {
    console.log(`🏃 Dry run mode enabled for issue #${PIPELINE_ISSUE_NUMBER}. Pass --write or DRY_RUN=false to update GitHub.\n`);
    console.log(nextBody);
    return;
  }

  if (existingIssueBody.trim() === nextBody.trim()) {
    console.log(`✅ Issue #${PIPELINE_ISSUE_NUMBER} is already up to date.`);
    return;
  }

  child_process.execFileSync(
    'gh',
    ['issue', 'edit', String(PIPELINE_ISSUE_NUMBER), '--repo', `${ORG}/${REPO}`, '--body-file', '-'],
    { input: nextBody, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }
  );
  console.log(`✅ Updated pipeline tracker issue #${PIPELINE_ISSUE_NUMBER}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSyncPipelineIssue();
}
