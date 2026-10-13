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
  isDisciplineGuide,
  scanAllGuides,
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import { buildUseCaseMaps } from './sync-use-cases.ts';

export const ORG = 'GoogleChrome';
export const REPO = 'modern-web-guidance-src';
export const REPO_URL = `https://github.com/${ORG}/${REPO}`;
export const PIPELINE_ISSUE_NUMBER = Number(process.env.PIPELINE_ISSUE_NUMBER || 1815);
export const EXPECTATIONS_CHANGED_LABEL = 'expectations-changed';

export const BURNDOWN_START_DATE = '2026-10-04T00:00:00Z';
export const BURNDOWN_INITIAL_REMAINING = 66;
export const BURNDOWN_TARGET_EVAL_COMPLETE = 200;
export const BURNDOWN_WEEKS = 5;

export const PIPELINE_GOAL = 200;
export const BAR_WIDTH = 50;
export const GUIDES_PER_COL = 4;
export const SPARKLINE_TICKS = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

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
  metrics: EvalPrMetrics;
  author: string;
  reviewers: string[];
}

export interface CommitAnalysis {
  complete: number;
  needsEvals: number;
  needsGuidance: number;
  total: number;
  completeSlugs?: Set<string>;
  needsEvalsSlugs?: Set<string>;
  needsGuidanceSlugs?: Set<string>;
}

export type PrClassification = 'eval' | 'guide' | 'other';

export interface DailyTrendRow {
  label: string;
  values: number[];
}

export interface DailyTrendHistory {
  dates: string[];
  complete: number[];
  evalPrsInReview: number[];
  readyForEvals: number[];
  guidePrsInReview: number[];
  issuesOpen: number[];
}

export interface PipelineReportData {
  completeCount: number;
  evalCompleteCount: number;
  gen2CompleteCount: number;
  burndown: BurndownData;
  progressBar?: {
    header: string;
    bar: string;
    text: string;
  };
  trendTable?: string;
  trendHistory?: DailyTrendHistory;
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
      ['log', '-M', '--diff-filter=AM', '--name-only', '--format=COMMIT|%H|%ct|%cs|%s', '--', 'guides/'],
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
 * Finds guides still using Gen 1 legacy root `grader.ts` instead of Gen 2 `targets/`,
 * and counts Gen 2 (`targets/`) and dual-target complete guides.
 */
export function findLegacyFormatGuides(guides: GuideInventory[]): {
  legacyEvals: LegacyEvalItem[];
  gen2CompleteCount: number;
  dualTargetCompleteCount: number;
} {
  const legacyEvals: LegacyEvalItem[] = [];
  let gen2CompleteCount = 0;
  let dualTargetCompleteCount = 0;

  for (const g of guides) {
    if (isDisciplineGuide(g.name, g.category) || g.isDisciplineGuide) {
      continue;
    }
    const hasGen2Targets = Boolean(g.targets && g.targets.length >= 1 && g.hasGrader);
    if (hasGen2Targets) {
      gen2CompleteCount++;
      if ((g.targets?.length ?? 0) >= 2) {
        dualTargetCompleteCount++;
      }
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
  return { legacyEvals, gen2CompleteCount, dualTargetCompleteCount };
}

const EMPTY_BLOB_SHA = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';

export function parseFrontmatterDraft(content: string): { isDraft: boolean; hasContent: boolean } {
  if (!content.startsWith('---')) {
    return { isDraft: false, hasContent: content.trim().length > 0 };
  }
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { isDraft: false, hasContent: content.trim().length > 0 };
  }
  const frontmatter = content.substring(3, endIdx);
  const body = content.substring(endIdx + 4);
  const draftMatch = frontmatter.match(/^\s*draft\s*:\s*(.+)$/m);
  let isDraft = false;
  if (draftMatch) {
    const val = draftMatch[1].trim().toLowerCase().replace(/['"]/g, '');
    isDraft = !['false', '0', 'no', 'off'].includes(val);
  }
  return { isDraft, hasContent: body.trim().length > 0 };
}

export function analyzeCommit(
  commitSha: string,
  options: { excludeDisciplineHubs?: boolean; cwd?: string } = {}
): CommitAnalysis {
  const cwd = options.cwd ?? rootDir;
  const lsOutput = child_process.execFileSync('git', ['ls-tree', '-r', commitSha, 'guides/'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  const guideFiles = new Map<string, Map<string, string>>();

  for (const line of lsOutput.trim().split('\n')) {
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const blobSha = parts[2];
    const fullPath = parts[3];
    if (!fullPath.startsWith('guides/')) continue;
    const rel = fullPath.slice('guides/'.length);
    const subparts = rel.split('/');
    if (subparts.length < 2) continue;
    const category = subparts[0];
    const name = subparts[1];
    if (category === 'test-results') continue;
    const slug = `${category}/${name}`;
    const subpath = subparts.slice(2).join('/');

    if (!guideFiles.has(slug)) {
      guideFiles.set(slug, new Map());
    }
    guideFiles.get(slug)!.set(subpath, blobSha);
  }

  const guideBlobsToFetch: { slug: string; blobSha: string }[] = [];
  for (const [slug, files] of guideFiles) {
    const guideBlobSha = files.get('guide.md');
    if (guideBlobSha && guideBlobSha !== EMPTY_BLOB_SHA) {
      guideBlobsToFetch.push({ slug, blobSha: guideBlobSha });
    }
  }

  const isDraftMap = new Map<string, boolean>();
  const hasContentMap = new Map<string, boolean>();

  if (guideBlobsToFetch.length > 0) {
    const input = guideBlobsToFetch.map(b => b.blobSha).join('\n') + '\n';
    const catOutput = child_process.execFileSync('git', ['cat-file', '--batch'], {
      cwd,
      input,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    let pos = 0;
    for (let i = 0; i < guideBlobsToFetch.length; i++) {
      const headerEnd = catOutput.indexOf('\n', pos);
      if (headerEnd === -1) break;
      const header = catOutput.substring(pos, headerEnd);
      const parts = header.split(' ');
      const size = parseInt(parts[2], 10);
      const contentStart = headerEnd + 1;
      const content = catOutput.substring(contentStart, contentStart + size);
      pos = contentStart + size + 1;

      const slug = guideBlobsToFetch[i].slug;
      const { isDraft, hasContent } = parseFrontmatterDraft(content);
      isDraftMap.set(slug, isDraft);
      hasContentMap.set(slug, hasContent);
    }
  }

  let complete = 0;
  let needsEvals = 0;
  let needsGuidance = 0;
  const completeSlugs = new Set<string>();
  const needsEvalsSlugs = new Set<string>();
  const needsGuidanceSlugs = new Set<string>();

  for (const [slug, files] of guideFiles) {
    const [category, name] = slug.split('/');
    const isDiscipline = isDisciplineGuide(name, category);
    if (options.excludeDisciplineHubs && isDiscipline) {
      continue;
    }

    const hasGuideFile = files.has('guide.md');
    const isDraft = isDraftMap.get(slug) ?? false;
    const hasGuideContent = hasContentMap.get(slug) ?? false;
    const hasGuide = hasGuideFile && hasGuideContent && !isDraft;

    const hasExpectationsFile = files.has('expectations.md');
    const expBlobSha = files.get('expectations.md');
    const hasExpectations = hasExpectationsFile && expBlobSha !== EMPTY_BLOB_SHA;

    let hasGrader = false;
    if (files.has('grader.ts')) {
      hasGrader = true;
    } else {
      for (const [subpath] of files) {
        if (subpath.startsWith('targets/') && subpath.endsWith('/grader.ts')) {
          hasGrader = true;
          break;
        }
      }
    }

    if (hasGuide && hasGrader) {
      complete++;
      completeSlugs.add(slug);
    } else if (hasGuide && hasExpectations && !hasGrader) {
      needsEvals++;
      needsEvalsSlugs.add(slug);
    } else {
      needsGuidance++;
      needsGuidanceSlugs.add(slug);
    }
  }

  return {
    complete,
    needsEvals,
    needsGuidance,
    total: complete + needsEvals + needsGuidance,
    completeSlugs,
    needsEvalsSlugs,
    needsGuidanceSlugs,
  };
}

const commitAnalysisCache = new Map<string, CommitAnalysis>();

export function getCachedCommitAnalysis(
  commitSha: string,
  options: { excludeDisciplineHubs?: boolean; cwd?: string } = {}
): CommitAnalysis {
  const cacheKey = `${commitSha}:${Boolean(options.excludeDisciplineHubs)}`;
  const cached = commitAnalysisCache.get(cacheKey);
  if (cached) return cached;
  const analysis = analyzeCommit(commitSha, options);
  commitAnalysisCache.set(cacheKey, analysis);
  return analysis;
}

export function classifyPr(pr: {
  headRefName?: string;
  title?: string;
  labels?: string[];
  files?: string[];
}): PrClassification {
  const files = pr.files ?? [];
  const touchesGuideMd = files.some(f => /(?:^|\/)guide\.md$/.test(f));
  if (touchesGuideMd) {
    return 'guide';
  }

  const headRef = pr.headRefName ?? '';
  const title = pr.title ?? '';
  const labels = pr.labels ?? [];

  let touchedGuides = 0;
  let onlyEvalFiles = files.length > 0;
  for (const f of files) {
    const m = /^guides\/([^/]+)\/([^/]+)\/(.+)$/.exec(f);
    if (m) {
      touchedGuides++;
      const rel = m[3];
      if (!rel.startsWith('targets/') && rel !== 'grader.ts' && !rel.startsWith('tasks/')) {
        onlyEvalFiles = false;
      }
    } else {
      onlyEvalFiles = false;
    }
  }

  const isEval =
    headRef.startsWith('gd-dev/') ||
    title.toLowerCase().startsWith('grader updates:') ||
    labels.includes('gd-dev-eval') ||
    (onlyEvalFiles && touchedGuides > 0);

  if (isEval) return 'eval';
  if (touchedGuides > 0 || labels.includes('content') || headRef.startsWith('guides/')) {
    return 'guide';
  }
  return 'other';
}

export function isDisciplinePr(pr: {
  headRefName?: string;
  title?: string;
  files?: string[];
}): boolean {
  const files = pr.files ?? [];
  for (const f of files) {
    const m = /^guides\/([^/]+)\/([^/]+)\//.exec(f);
    if (m && isDisciplineGuide(m[2], m[1])) {
      return true;
    }
  }
  const headRef = pr.headRefName ?? '';
  if (headRef.startsWith('gd-dev/')) {
    const name = headRef.slice('gd-dev/'.length);
    if (isDisciplineGuide(name)) {
      return true;
    }
  }
  return false;
}

export function renderProgressBar(params: {
  complete: number;
  inReview: number;
  goal?: number;
  barWidth?: number;
}): { header: string; bar: string; text: string } {
  const goal = params.goal ?? PIPELINE_GOAL;
  const barWidth = params.barWidth ?? BAR_WIDTH;
  const { complete, inReview } = params;

  const toGo = Math.max(0, goal - complete - inReview);
  const header = `${complete} landed · ${inReview} in review · ${toGo} to go → ${goal}`;

  if (barWidth <= 0) {
    return { header, bar: '', text: header };
  }

  const scale = goal / barWidth;

  let completeCols = Math.min(barWidth, Math.round(complete / scale));
  let inReviewCols = Math.min(barWidth - completeCols, Math.round(inReview / scale));
  let remainingCols = barWidth - completeCols - inReviewCols;

  if (remainingCols < 0) {
    remainingCols = 0;
    inReviewCols = Math.max(0, barWidth - completeCols);
  }

  if (toGo > 0 && remainingCols === 0 && barWidth > 0) {
    remainingCols = 1;
    if (inReviewCols > 0) {
      inReviewCols -= 1;
    } else if (completeCols > 0) {
      completeCols -= 1;
    }
  }

  const bar = '█'.repeat(completeCols) + '░'.repeat(inReviewCols) + '·'.repeat(remainingCols);
  return {
    header,
    bar,
    text: `${header}\n${bar}`,
  };
}

export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return SPARKLINE_TICKS[3].repeat(values.length);
  }
  return values
    .map(v => {
      const fraction = (v - min) / (max - min);
      const idx = Math.min(
        SPARKLINE_TICKS.length - 1,
        Math.max(0, Math.round(fraction * (SPARKLINE_TICKS.length - 1)))
      );
      return SPARKLINE_TICKS[idx];
    })
    .join('');
}

export function renderTrendTable(rows: DailyTrendRow[]): string {
  const colLabelWidth = 24;
  const colTrendWidth = 25;
  const colNowWidth = 5;
  const colDeltaWidth = 8;

  const header =
    'Stage'.padEnd(colLabelWidth) +
    '21-day trend'.padEnd(colTrendWidth) +
    'Now'.padStart(colNowWidth) +
    'Δ 7d'.padStart(colDeltaWidth);

  const lines = [header];

  for (const row of rows) {
    const spark = sparkline(row.values);
    const nowVal = row.values.length > 0 ? row.values[row.values.length - 1] : 0;
    const d7Val = row.values.length >= 8 ? nowVal - row.values[row.values.length - 8] : 0;
    const d7Str = d7Val > 0 ? `+${d7Val}` : `${d7Val}`;

    const line =
      row.label.padEnd(colLabelWidth) +
      spark.padEnd(colTrendWidth) +
      String(nowVal).padStart(colNowWidth) +
      d7Str.padStart(colDeltaWidth);
    lines.push(line);
  }

  return lines.join('\n');
}

export function fetchDailyTrendHistory(params: {
  cwd?: string;
  nowMs?: number;
  days?: number;
} = {}): DailyTrendHistory {
  const cwd = params.cwd ?? rootDir;
  const nowMs = params.nowMs ?? Date.now();
  const days = params.days ?? 21;

  const targetDates: string[] = [];
  const targetTimestamps: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 86_400_000).toISOString().slice(0, 10);
    targetDates.push(d);
    targetTimestamps.push(i === 0 ? new Date(nowMs).toISOString() : `${d}T23:59:59Z`);
  }

  const commitSnapshots: CommitAnalysis[] = [];
  for (const ts of targetTimestamps) {
    try {
      const sha = child_process
        .execFileSync('git', ['rev-list', '-1', `--before=${ts}`, 'origin/main'], {
          cwd,
          encoding: 'utf8',
        })
        .trim();
      const analysis = getCachedCommitAnalysis(sha, { cwd, excludeDisciplineHubs: true });
      commitSnapshots.push(analysis);
    } catch {
      commitSnapshots.push({ complete: 0, needsEvals: 0, needsGuidance: 0, total: 0 });
    }
  }

  let allPrs: PrSummary[] = [];
  try {
    const prRaw = child_process.execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        `${ORG}/${REPO}`,
        '--state',
        'all',
        '--limit',
        '500',
        '--json',
        'number,title,createdAt,closedAt,mergedAt,headRefName,labels,files',
      ],
      { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    const parsedPrs = JSON.parse(prRaw) as Array<{
      number: number;
      title: string;
      createdAt: string;
      closedAt?: string | null;
      mergedAt?: string | null;
      headRefName?: string;
      labels?: Array<{ name?: string }>;
      files?: Array<{ path?: string }>;
    }>;
    allPrs = parsedPrs.map(p => ({
      number: p.number,
      title: p.title,
      body: '',
      isDraft: false,
      headRefName: p.headRefName ?? '',
      author: '',
      reviewers: [],
      labels: (p.labels ?? []).map(l => l.name ?? '').filter(Boolean),
      files: (p.files ?? []).map(f => f.path ?? '').filter(Boolean),
      createdAt: p.createdAt,
      closedAt: p.closedAt ?? p.mergedAt ?? null,
    } as any));
  } catch (e) {
    console.error('Failed to fetch PR history from gh:', e);
  }

  const completeSeries: number[] = [];
  const evalPrsSeries: number[] = [];
  const readyForEvalsSeries: number[] = [];
  const guidePrsSeries: number[] = [];
  const issuesOpenSeries: number[] = [];

  for (let i = 0; i < targetTimestamps.length; i++) {
    const t = new Date(targetTimestamps[i]).getTime();
    const snap = commitSnapshots[i];

    completeSeries.push(snap.complete);

    let evalPrsCount = 0;
    let guidePrsCount = 0;
    const openEvalSlugsOnDay = new Set<string>();
    const openGuideSlugsOnDay = new Set<string>();

    for (const pr of allPrs as any[]) {
      const cTime = new Date(pr.createdAt).getTime();
      const clTime = pr.closedAt ? new Date(pr.closedAt).getTime() : Infinity;
      if (cTime <= t && clTime > t) {
        if (isDisciplinePr(pr)) continue;
        const kind = classifyPr(pr);
        if (kind === 'eval') {
          let touchesIncomplete = false;
          for (const f of pr.files ?? []) {
            const m = /^guides\/([^/]+)\/([^/]+)\//.exec(f);
            if (m) {
              const s = `${m[1]}/${m[2]}`;
              if (!isDisciplineGuide(m[2], m[1]) && (!snap.completeSlugs || !snap.completeSlugs.has(s))) {
                touchesIncomplete = true;
                openEvalSlugsOnDay.add(s);
              }
            }
          }
          if (touchesIncomplete) {
            evalPrsCount++;
          }
        } else if (kind === 'guide') {
          let touchesIncompleteGuide = false;
          for (const f of pr.files ?? []) {
            const m = /^guides\/([^/]+)\/([^/]+)\/(guide\.md|expectations\.md|demo\.html)$/.exec(f);
            if (m) {
              const s = `${m[1]}/${m[2]}`;
              if (!isDisciplineGuide(m[2], m[1]) && (!snap.completeSlugs || !snap.completeSlugs.has(s))) {
                touchesIncompleteGuide = true;
                openGuideSlugsOnDay.add(s);
              }
            }
          }
          if (touchesIncompleteGuide) {
            guidePrsCount++;
          }
        }
      }
    }

    evalPrsSeries.push(evalPrsCount);
    guidePrsSeries.push(guidePrsCount);

    if (snap.needsEvalsSlugs && snap.needsEvalsSlugs.size > 0) {
      const ready = Array.from(snap.needsEvalsSlugs).filter(s => !openEvalSlugsOnDay.has(s)).length;
      readyForEvalsSeries.push(ready);
    } else {
      readyForEvalsSeries.push(Math.max(0, snap.needsEvals - evalPrsCount));
    }

    if (snap.needsGuidanceSlugs && snap.needsGuidanceSlugs.size > 0) {
      const issuesWithNoPr = Array.from(snap.needsGuidanceSlugs).filter(s => !openGuideSlugsOnDay.has(s)).length;
      issuesOpenSeries.push(issuesWithNoPr);
    } else {
      issuesOpenSeries.push(Math.max(0, snap.needsGuidance - guidePrsCount));
    }
  }

  return {
    dates: targetDates,
    complete: completeSeries,
    evalPrsInReview: evalPrsSeries,
    readyForEvals: readyForEvalsSeries,
    guidePrsInReview: guidePrsSeries,
    issuesOpen: issuesOpenSeries,
  };
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
  const finishedFeatureGuides = data.evalCompleteCount + totalNeedsEvals;
  const evalCoveragePct =
    finishedFeatureGuides > 0 ? Math.round((data.evalCompleteCount / finishedFeatureGuides) * 100) : 100;

  const progressBar = data.progressBar ?? renderProgressBar({
    complete: data.completeCount,
    inReview: data.openEvalPrs.length,
    goal: PIPELINE_GOAL,
    barWidth: BAR_WIDTH,
  });

  const trendTable = data.trendTable ?? '';

  const lines: string[] = [
    '# Content & Eval Pipeline',
    '',
    '<!-- Discipline orientation guides do not currently require a grader and are excluded from the 200 goal, the progress bar, and trend counts. This policy may change. -->',
    '',
    '```',
    progressBar.header,
    progressBar.bar,
    '```',
    '',
    `[${data.completeCount} landed complete](${REPO_URL}/tree/main/guides) · [${data.openEvalPrs.length} eval PRs in review](#open-eval-prs-${data.openEvalPrs.length}) · [${data.readyForEvalSlugs.length} ready for evals](#ready-for-gd-dev-${data.readyForEvalSlugs.length}) · [${data.needsGuidancePrs.length} guide PRs in review](#in-review--open-prs-${data.needsGuidancePrs.length}) · [${data.needsGuidanceIssues.length} use-case issues open](${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Anew-use-case)`,
    '',
    '```',
    trendTable,
    '```',
    '',
    `### Current Batch Burndown (\`${data.burndown.remaining} / ${data.burndown.initial}\` remaining)`,
    '',
    '```mermaid',
    "%%{init: {'themeVariables': {'xyChart': {'plotColorPalette': '#238636, #8b949e, #58a6ff'}}, 'xyChart': {'height': 200}}}%%",
    'xychart-beta',
    `    x-axis [${data.burndown.xAxisLabels.map(l => `"${l}"`).join(', ')}]`,
    '    y-axis "Remaining" 0 --> 70',
    `    bar [${data.burndown.barValues.join(', ')}]`,
    `    line [${data.burndown.idealLine.join(', ')}]`,
    `    line [${data.burndown.requiredLine.join(', ')}]`,
    '```',
    `<sub>🟩 <b>Bars</b>: Actual remaining at each checkpoint (\`${data.burndown.initial}\` → \`${data.burndown.remaining}\`) · ⬜ <b>Gray line</b>: Ideal linear pace (\`-${data.burndown.idealPerWeek}/wk\`) · 🟦 <b>Blue line</b>: Required pace from \`W${data.burndown.weekIdx}\` (\`-${data.burndown.requiredPerWeek}/wk\`)</sub>`,
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
    `### Gen 1 → Gen 2 Eval Migration (\`${data.gen2CompleteCount}\` Gen 2 · \`${data.legacyEvals.length}\` Gen 1)`,
    '',
    `**Eval Coverage (${finishedFeatureGuides} finished guides):** **${data.evalCompleteCount} / ${finishedFeatureGuides} (${evalCoveragePct}%)** covered — **${data.gen2CompleteCount} Gen 2** (\`targets/\`) · **${data.legacyEvals.length} Gen 1** (legacy root \`grader.ts\`) · **${totalNeedsEvals} Missing evals**`,
    '',
    `> **Note:** Paused while \`gd dev-gap\` prioritizes covering the **${totalNeedsEvals} finished guides missing evals** above with Gen 2 (\`targets/\`) evals.`,
    '',
    '<details>',
    `<summary>Show ${data.legacyEvals.length} guides on Gen 1 evals (root <code>grader.ts</code> + <code>tasks/task.md</code> · ${data.gen2CompleteCount} on Gen 2 <code>targets/</code>, ${data.dualTargetCompleteCount} dual-target)</summary>`,
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
      'number,title,body,isDraft,headRefName,author,reviewRequests,latestReviews,labels,files',
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
    latestReviews?: Array<{ author?: { login?: string } }>;
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
    reviewers: [
      ...new Set([
        ...(p.reviewRequests ?? []).map(r => r.login ?? r.name ?? ''),
        ...(p.latestReviews ?? []).map(r => r.author?.login ?? ''),
      ]),
    ].filter(Boolean),
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
  const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(useCaseIssues) as {
    nameToIssueMap: Map<string, IssueSummary>;
    subdirToIssueMap: Map<string, IssueSummary>;
  };
  const featureIdToIssueMap = new Map<string, IssueSummary>();

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

function resolveEvalPrs(
  openPrs: PrSummary[],
  guideBySlug: Map<string, GuideInventory>
): { openEvalPrs: OpenEvalPrItem[]; evalPrSlugs: Set<string> } {
  const openEvalPrs: OpenEvalPrItem[] = [];
  const evalPrSlugs = new Set<string>();

  for (const pr of openPrs) {
    if (isDisciplinePr(pr)) continue;
    if (classifyPr(pr) !== 'eval') continue;
    const touchedSlugs = new Set<string>();
    for (const file of pr.files) {
      const m = /^guides\/([^/]+\/[^/]+)\//.exec(file);
      if (m) touchedSlugs.add(m[1]);
    }
    if (touchedSlugs.size === 0 && pr.headRefName.startsWith('gd-dev/')) {
      const guideName = pr.headRefName.slice('gd-dev/'.length);
      for (const [slug, g] of guideBySlug) {
        if (g.name === guideName) {
          touchedSlugs.add(slug);
        }
      }
    }
    for (const slug of touchedSlugs) {
      const inv = guideBySlug.get(slug);
      if (!inv || isDisciplineGuide(inv.name, inv.category) || inv.isDisciplineGuide) {
        continue;
      }
      if (getGuideStatus(inv) === null) {
        // Already complete on main
        continue;
      }
      evalPrSlugs.add(slug);
      openEvalPrs.push({
        slug,
        prNumber: pr.number,
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
    if (isDisciplinePr(pr)) continue;
    if (classifyPr(pr) === 'eval') continue;
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
      if (inv && (isDisciplineGuide(inv.name, inv.category) || inv.isDisciplineGuide)) {
        continue;
      }
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
    if (isDisciplineGuide(g.name, g.category) || g.isDisciplineGuide) continue;
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
  trendHistory?: DailyTrendHistory;
  nowMs?: number;
}): PipelineReportData {
  const validGuides = params.guides.filter(g => g.category !== 'test-results' && (g.hasGuide || g.isStub));
  const featureGuides = validGuides.filter(
    g => !isDisciplineGuide(g.name, g.category) && !g.isDisciplineGuide
  );
  const guideBySlug = new Map<string, GuideInventory>();
  const guideByName = new Map<string, GuideInventory>();
  for (const g of validGuides) {
    guideBySlug.set(`${g.category}/${g.name}`, g);
    guideByName.set(g.name, g);
  }

  const completeGuides = featureGuides.filter(g => getGuideStatus(g) === null);
  const evalCompleteCount = completeGuides.filter(g => g.hasGrader).length;
  const effectiveCompleteCount =
    params.trendHistory && params.trendHistory.complete.length > 0
      ? params.trendHistory.complete[params.trendHistory.complete.length - 1]
      : completeGuides.length;
  const effectiveEvalComplete =
    params.trendHistory && params.trendHistory.complete.length > 0
      ? params.trendHistory.complete[params.trendHistory.complete.length - 1]
      : evalCompleteCount;

  const issueIndex = buildUseCaseIssueIndex(params.openUseCaseIssues, params.openFeatureIssues);
  const { openEvalPrs, evalPrSlugs } = resolveEvalPrs(params.openPrs, guideBySlug);
  const readyForEvalSlugs = featureGuides
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
  const { legacyEvals, gen2CompleteCount, dualTargetCompleteCount } = findLegacyFormatGuides(validGuides);

  const trendHistory = params.trendHistory ?? {
    dates: Array.from({ length: 21 }, () => ''),
    complete: Array(21).fill(effectiveEvalComplete),
    evalPrsInReview: Array(21).fill(openEvalPrs.length),
    readyForEvals: Array(21).fill(readyForEvalSlugs.length),
    guidePrsInReview: Array(21).fill(needsGuidancePrs.length),
    issuesOpen: Array(21).fill(needsGuidanceIssues.length),
  };

  // Ensure the final ("today") point of every trend series matches the section lists identically
  trendHistory.complete[trendHistory.complete.length - 1] = effectiveCompleteCount;
  trendHistory.evalPrsInReview[trendHistory.evalPrsInReview.length - 1] = openEvalPrs.length;
  trendHistory.readyForEvals[trendHistory.readyForEvals.length - 1] = readyForEvalSlugs.length;
  trendHistory.guidePrsInReview[trendHistory.guidePrsInReview.length - 1] = needsGuidancePrs.length;
  trendHistory.issuesOpen[trendHistory.issuesOpen.length - 1] = needsGuidanceIssues.length;

  const trendRows: DailyTrendRow[] = [
    { label: 'Complete (landed)', values: trendHistory.complete },
    { label: 'Eval PRs in review', values: trendHistory.evalPrsInReview },
    { label: 'Ready for evals', values: trendHistory.readyForEvals },
    { label: 'Guide PRs in review', values: trendHistory.guidePrsInReview },
    { label: 'Use-case issues open', values: trendHistory.issuesOpen },
  ];
  const trendTable = renderTrendTable(trendRows);

  const currentComplete = trendHistory.complete.length > 0
    ? trendHistory.complete[trendHistory.complete.length - 1]
    : effectiveEvalComplete;
  const currentInReview = trendHistory.evalPrsInReview.length > 0
    ? trendHistory.evalPrsInReview[trendHistory.evalPrsInReview.length - 1]
    : openEvalPrs.length;

  const progressBar = renderProgressBar({
    complete: currentComplete,
    inReview: currentInReview,
    goal: PIPELINE_GOAL,
    barWidth: BAR_WIDTH,
  });

  const existingCheckpoints = parseBurndownCheckpoints(params.existingIssueBody);
  const w1Val = existingCheckpoints[1] > 0 ? existingCheckpoints[1] : 62;
  const checkpoints = [BURNDOWN_INITIAL_REMAINING, w1Val];
  const burndown = computeBurndown(effectiveEvalComplete, checkpoints, params.nowMs);

  return {
    completeCount: effectiveCompleteCount,
    evalCompleteCount: effectiveEvalComplete,
    gen2CompleteCount,
    burndown,
    progressBar,
    trendTable,
    trendHistory,
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
  const trendHistory = fetchDailyTrendHistory({ cwd: rootDir, nowMs: Date.now() });

  const reportData = buildPipelineReportData({
    guides,
    openPrs,
    openUseCaseIssues,
    openFeatureIssues,
    openExpectationsChangedIssues,
    gitHistory,
    existingIssueBody,
    trendHistory,
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
