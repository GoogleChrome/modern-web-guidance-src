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

import { parseBooleanEnv } from '../core/env.ts';
import {
  classifyGuide,
  detectEvals,
  EXPECTATIONS_FILE,
  getPendingGuideStage,
  GUIDE_FILE,
  isEvalFile,
  parseGuideMetadata,
  ProjectStatus,
  scanAllGuides,
  type DraftState,
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import { buildUseCaseMaps } from './sync-use-cases.ts';

export const ORG = 'GoogleChrome';
export const REPO = 'modern-web-guidance-src';
export const REPO_URL = `https://github.com/${ORG}/${REPO}`;
export const PIPELINE_ISSUE_NUMBER = Number(process.env.PIPELINE_ISSUE_NUMBER || 1815);
const NEW_USE_CASE_LABEL = 'new-use-case';
const NEW_FEATURE_LABEL = 'new-feature';

const PIPELINE_BASELINE_DATE = '2026-07-22';
export const PIPELINE_SCALE_MAX = 200;
const RULER_MID_TICK = 150;
const CHART_Y_MIN = 100;
const DAY_MS = 86_400_000;
const BULK_EVAL_SWEEP_MIN_SLUGS = 5;

function parseGuidePath(filePath: string): { slug: string; guideName: string; relPath: string } | null {
  const match = /^guides\/([^/]+\/([^/]+))\/(.+)$/.exec(filePath);
  return match ? { slug: match[1], guideName: match[2], relPath: match[3] } : null;
}

export interface PrSummary {
  number: number;
  title: string;
  body: string;
  isDraft: boolean;
  reviewDecision?: string | null;
  headRefName: string;
  headRefOid?: string;
  author: string;
  reviewers: string[];
  labels: string[];
  files: string[];
  /** Raw `guide.md` contents keyed by `category/name` slug for touched guides in `Needs guidance`. */
  guideContents?: Record<string, string>;
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
}

export interface NeedsGuidancePrItem {
  slug: string;
  hasDirOnMain: boolean;
  prNumber: number;
  isDraft: boolean;
  reviewDecision?: string | null;
  issueNumber: number | null;
  author: string;
  reviewers: string[];
}

export interface NeedsGuidanceIssueItem {
  slug: string;
  issueNumber: number | null;
  draft?: DraftState;
  draftReason?: string;
  assignees: string[];
}

export interface OpenEvalPrItem {
  slug: string;
  prNumber: number;
  metrics: EvalPrMetrics;
  reviewDecision?: string | null;
  reviewers: string[];
}

export interface CommitAnalysis {
  complete: number;
  needsEvals: number;
}

export interface WeeklyProgressPoint {
  date: string;
  label: string;
  complete: number;
  contentLanded: number;
}

export interface TwoRowProgressBar {
  header: string;
  guidesRow: string;
  evalsRow: string;
  rulerLine: string;
  text: string;
}

export interface ReadyForEvalItem {
  slug: string;
  readySince: string;
}

export interface PipelineReportData {
  baseline: number;
  completeCount: number;
  contentLandedCount: number;
  gen2CompleteCount: number;
  dualTargetCompleteCount: number;
  weeklyProgressPoints: WeeklyProgressPoint[];
  needsUseCasesIssues: Array<IssueSummary & { category: string | null }>;
  needsGuidancePrs: NeedsGuidancePrItem[];
  needsGuidanceIssues: NeedsGuidanceIssueItem[];
  openEvalPrs: OpenEvalPrItem[];
  readyForEvals: ReadyForEvalItem[];
  staleEvals: StaleEvalItem[];
}

export type ReviewState = 'draft' | 'changes requested' | 'approved' | 'awaiting review';

export function formatReviewDecision(decision: string | null | undefined, isDraft: boolean): ReviewState {
  if (isDraft) return 'draft';
  if (decision === 'CHANGES_REQUESTED') return 'changes requested';
  if (decision === 'APPROVED') return 'approved';
  return 'awaiting review';
}

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

function getLaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
}

export function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

function collectGitGuideHistory(): Map<string, GitFileHistory> {
  const cwd = rootDir;
  const history = new Map<string, GitFileHistory>();
  const fallbackEval = new Map<string, { evalSha: string; evalTs: number; evalDate: string }>();
  const output = child_process.execFileSync(
    'git',
    ['log', '--find-renames', '-m', '--first-parent', '--diff-filter=AM', '--name-only', '--format=COMMIT|%H|%ct|%cs|%s', '--', 'guides/'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

  for (const block of output.split('\nCOMMIT|')) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    const header = lines[0].startsWith('COMMIT|') ? lines[0].slice('COMMIT|'.length) : lines[0];
    const parts = header.split('|');
    const currentSha = parts[0] || '';
    const currentTs = Number(parts[1]) || 0;
    const currentDate = parts[2] || '';
    const subject = parts.slice(3).join('|');
    const prMatches = [...subject.matchAll(/#(\d+)/g)];
    const currentPr = prMatches.length > 0 ? Number(prMatches[prMatches.length - 1][1]) : null;

    const expSlugs = new Set<string>();
    const evalSlugs = new Set<string>();

    for (const rawLine of lines.slice(1)) {
      const parsed = parseGuidePath(rawLine.trim());
      if (!parsed) continue;
      if (parsed.relPath === EXPECTATIONS_FILE) expSlugs.add(parsed.slug);
      if (isEvalFile(parsed.relPath)) evalSlugs.add(parsed.slug);
    }

    // Repo-wide grader formatting/lint sweeps touch many evals with zero expectations updates;
    // ignore them unless a guide has no other eval commit in history.
    const isBulkEvalSweep = evalSlugs.size >= BULK_EVAL_SWEEP_MIN_SLUGS && expSlugs.size === 0;

    for (const slug of new Set([...expSlugs, ...evalSlugs])) {
      let entry = history.get(slug);
      if (!entry) {
        entry = { expSha: '', expTs: 0, expDate: '', expPr: null, evalSha: '', evalTs: 0, evalDate: '' };
        history.set(slug, entry);
      }

      if (expSlugs.has(slug) && entry.expTs === 0) {
        entry.expSha = currentSha;
        entry.expTs = currentTs;
        entry.expDate = currentDate;
        entry.expPr = currentPr;
      }
      if (evalSlugs.has(slug)) {
        if (!isBulkEvalSweep && entry.evalTs === 0) {
          entry.evalSha = currentSha;
          entry.evalTs = currentTs;
          entry.evalDate = currentDate;
        } else if (isBulkEvalSweep && !fallbackEval.has(slug)) {
          fallbackEval.set(slug, { evalSha: currentSha, evalTs: currentTs, evalDate: currentDate });
        }
      }
    }
  }

  for (const [slug, fb] of fallbackEval) {
    const entry = history.get(slug);
    if (entry && entry.evalTs === 0) {
      entry.evalSha = fb.evalSha;
      entry.evalTs = fb.evalTs;
      entry.evalDate = fb.evalDate;
    }
  }

  for (const [slug, entry] of history.entries()) {
    if (entry.expTs <= entry.evalTs || !entry.evalSha || !entry.expSha) continue;
    try {
      child_process.execFileSync(
        'git',
        [
          'diff',
          '--quiet',
          '--unified=0',
          '--find-renames',
          '--ignore-blank-lines',
          '--ignore-matching-lines=Basic presence:',
          entry.evalSha,
          entry.expSha,
          '--',
          `guides/${slug}/${EXPECTATIONS_FILE}`,
        ],
        { cwd, encoding: 'utf8', stdio: 'ignore' }
      );
      entry.isSubstantiveDiff = false;
    } catch (error) {
      // `git diff --quiet` exits 1 when the files differ; any other status is a real failure.
      if (!(error instanceof Error && 'status' in error && error.status === 1)) throw error;
      entry.isSubstantiveDiff = true;
    }
  }

  return history;
}

export function findStaleEvals(
  guides: GuideInventory[],
  gitHistory: Map<string, GitFileHistory>,
): StaleEvalItem[] {
  const items: StaleEvalItem[] = [];
  for (const g of guides) {
    if (classifyGuide(g) !== 'complete') continue;

    const slug = `${g.category}/${g.name}`;
    const hist = gitHistory.get(slug);
    if (
      hist &&
      hist.expTs > 0 &&
      hist.evalTs > 0 &&
      hist.expTs > hist.evalTs &&
      (hist.isSubstantiveDiff ?? true)
    ) {
      items.push({
        slug,
        expDate: formatShortDate(hist.expDate),
        expPr: hist.expPr ?? null,
        evalDate: formatShortDate(hist.evalDate),
      });
    }
  }

  return items.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function countGen2Evals(guides: GuideInventory[]): {
  gen2CompleteCount: number;
  dualTargetCompleteCount: number;
} {
  const gen2 = guides.filter(g => classifyGuide(g) === 'complete' && (g.targets?.length ?? 0) >= 1);
  return {
    gen2CompleteCount: gen2.length,
    dualTargetCompleteCount: gen2.filter(g => (g.targets?.length ?? 0) >= 2).length,
  };
}

const EMPTY_BLOB_SHA = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';

/** Counts guides with evals landed / needing evals at a commit. */
function analyzeCommit(commitSha: string): CommitAnalysis {
  const cwd = rootDir;
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
    const parsed = parseGuidePath(parts[3]);
    if (!parsed || parsed.slug.startsWith('test-results/')) continue;

    let files = guideFiles.get(parsed.slug);
    if (!files) {
      files = new Map();
      guideFiles.set(parsed.slug, files);
    }
    files.set(parsed.relPath, blobSha);
  }

  const guideBlobsToFetch: { slug: string; blobSha: string }[] = [];
  for (const [slug, files] of guideFiles) {
    const guideBlobSha = files.get(GUIDE_FILE);
    if (guideBlobSha && guideBlobSha !== EMPTY_BLOB_SHA) {
      guideBlobsToFetch.push({ slug, blobSha: guideBlobSha });
    }
  }

  const guideContentMap = new Map<string, string>();

  if (guideBlobsToFetch.length > 0) {
    const inputBuf = Buffer.from(guideBlobsToFetch.map(b => b.blobSha).join('\n') + '\n');
    const catBuf = child_process.execFileSync('git', ['cat-file', '--batch'], {
      cwd,
      input: inputBuf,
      maxBuffer: 50 * 1024 * 1024,
    });

    let pos = 0;
    for (let i = 0; i < guideBlobsToFetch.length; i++) {
      const headerEnd = catBuf.indexOf(0x0a, pos);
      if (headerEnd === -1) break;
      const header = catBuf.toString('utf8', pos, headerEnd);
      const parts = header.split(' ');
      const size = parseInt(parts[2], 10);
      const contentStart = headerEnd + 1;
      const contentBuf = catBuf.subarray(contentStart, contentStart + size);
      pos = contentStart + size + 1;

      const slug = guideBlobsToFetch[i].slug;
      guideContentMap.set(slug, contentBuf.toString('utf8'));
    }
  }

  let complete = 0;
  let needsEvals = 0;

  for (const [slug, files] of guideFiles) {
    const guideContent = guideContentMap.get(slug) ?? '';
    const expBlobSha = files.get(EXPECTATIONS_FILE);
    const hasExpectations = files.has(EXPECTATIONS_FILE) && expBlobSha !== EMPTY_BLOB_SHA;
    const meta = parseGuideMetadata(guideContent, undefined, true);
    const evals = detectEvals(files.keys());
    const status = classifyGuide({ ...meta, ...evals, hasExpectations });

    if (status === 'complete') {
      complete++;
    } else if (status === 'needs-calibration' || status === 'needs-test') {
      needsEvals++;
    }
  }

  return { complete, needsEvals };
}

/**
 * For each guide, the date it entered its current uninterrupted "content landed" streak on
 * HEAD: non-draft guide.md with content plus expectations.md. Walks the commits touching those
 * two files newest-first and stops at the first commit where the guide wasn't landed.
 */
function findReadySince(slugs: string[]): Map<string, string> {
  const cwd = rootDir;
  const result = new Map<string, string>();
  for (const slug of slugs) {
    const guidePath = `guides/${slug}/${GUIDE_FILE}`;
    const expPath = `guides/${slug}/${EXPECTATIONS_FILE}`;
    const log = child_process
      .execFileSync('git', ['log', '--format=%H %cs', 'HEAD', '--', guidePath, expPath], { cwd, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    let since: string | undefined;
    for (const line of log) {
      const [sha, date] = line.split(' ');
      const treeLines = child_process
        .execFileSync('git', ['ls-tree', sha, '--', guidePath, expPath], { cwd, encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);
      const blobsByPath = new Map(
        treeLines.map(l => {
          const parts = l.split(/\s+/);
          return [parts[3], parts[2]];
        })
      );
      if (!blobsByPath.has(guidePath) || !blobsByPath.has(expPath)) break;
      const guideContent = child_process.execFileSync('git', ['show', `${sha}:${guidePath}`], { cwd, encoding: 'utf8' });
      const meta = parseGuideMetadata(guideContent, undefined, true);
      const status = classifyGuide({
        ...meta,
        hasExpectations: blobsByPath.get(expPath) !== EMPTY_BLOB_SHA,
      });
      if (status === 'stub' || status === 'incomplete' || status === 'needs-expectations') break;
      since = date;
    }
    if (!since) throw new Error(`findReadySince: ${slug} is not landed at HEAD`);
    result.set(slug, since);
  }
  return result;
}

export function renderTwoRowProgressBar(params: {
  complete: number;
  openEvalGuides: number;
  contentLanded: number;
  openGuideGuides: number;
  baseline: number;
  staleEvalsCount: number;
}): TwoRowProgressBar {
  const scaleMax = PIPELINE_SCALE_MAX;
  const baseline = params.baseline;
  const barWidth = Math.max(1, scaleMax - baseline);

  const labelWidth = 10;
  const header = 'Guides on main since Jul 22 · 1 column = 1 guide';
  const legend = '█ landed on main   ░ open PR   · not yet';

  const renderRow = (label: string, landed: number, inReview: number, extraFlag = ''): string => {
    const landedCols = Math.max(0, Math.min(barWidth, landed - baseline));
    const inReviewCols = Math.max(0, Math.min(barWidth - landedCols, inReview));
    const remainingCols = Math.max(0, barWidth - landedCols - inReviewCols);
    const bar = '█'.repeat(landedCols) + '░'.repeat(inReviewCols) + '·'.repeat(remainingCols);
    return `${label.padEnd(labelWidth)}${bar}  ${landed}${extraFlag} +${inReview} PRs`;
  };

  const guidesRow = renderRow('Guides', params.contentLanded, params.openGuideGuides);
  const staleFlag = params.staleEvalsCount > 0 ? ` (${params.staleEvalsCount} stale)` : '';
  const evalsRow = renderRow('Evals', params.complete, params.openEvalGuides, staleFlag);

  // Column for guide count v: the first bar column is guide `baseline + 1`.
  const colFor = (v: number) => labelWidth + Math.max(0, v - baseline - 1);
  const ticks = [baseline, RULER_MID_TICK, scaleMax].filter(v => v >= baseline && v <= scaleMax);
  const width = colFor(scaleMax) + 1;
  const ticksArr = Array<string>(width).fill(' ');
  const numsArr = Array<string>(width + 2).fill(' ');
  for (const v of ticks) {
    const col = colFor(v);
    ticksArr[col] = '┬';
    const label = String(v);
    // Left-align the first label under its tick, right-align the last, center the rest.
    const start =
      v === baseline ? col : v === scaleMax ? col - label.length + 1 : col - Math.floor(label.length / 2);
    numsArr.splice(start, label.length, ...label.split(''));
  }
  const rulerLine = `${ticksArr.join('').trimEnd()}\n${numsArr.join('').trimEnd()}`;

  return {
    header,
    guidesRow,
    evalsRow,
    rulerLine,
    text: `${header}\n${guidesRow}\n${evalsRow}\n${rulerLine}\n${legend}`,
  };
}

export function fetchWeeklyProgressHistory(): WeeklyProgressPoint[] {
  const end = new Date();
  const endLaDate = getLaDateString(end);

  const dates: string[] = [endLaDate];
  let cur = new Date(end.getTime());

  while (true) {
    cur = new Date(cur.getTime() - 7 * DAY_MS);
    const dStr = getLaDateString(cur);
    if (dStr <= PIPELINE_BASELINE_DATE) {
      break;
    }
    dates.push(dStr);
  }
  if (!dates.includes(PIPELINE_BASELINE_DATE)) {
    dates.push(PIPELINE_BASELINE_DATE);
  }
  dates.reverse();

  const points: WeeklyProgressPoint[] = [];
  for (const d of dates) {
    const ts = `${d}T23:59:59Z`;
    const sha = child_process
      .execFileSync('git', ['rev-list', '--max-count=1', `--before=${ts}`, 'origin/main'], { cwd: rootDir, encoding: 'utf8' })
      .trim();
    const analysis = analyzeCommit(sha);
    points.push({
      date: d,
      label: formatShortDate(d),
      complete: analysis.complete,
      contentLanded: analysis.complete + analysis.needsEvals,
    });
  }
  return points;
}

export function renderProgressChart(points: WeeklyProgressPoint[]): string {
  const xLabels = points.map(p => `"${p.label}"`).join(', ');
  const contentBars = points.map(p => p.contentLanded).join(', ');
  const completeBars = points.map(p => p.complete).join(', ');

  return [
    '```mermaid',
    '---',
    'config:',
    '  xyChart:',
    '    height: 200',
    '  themeVariables:',
    '    xyChart:',
    '      plotColorPalette: "#FBBC04, #4285F4"',
    '---',
    'xychart-beta',
    `    x-axis [${xLabels}]`,
    `    y-axis "Guides" ${CHART_Y_MIN} --> ${PIPELINE_SCALE_MAX}`,
    `    bar "Guides landed" [${contentBars}]`,
    `    bar "Evals landed" [${completeBars}]`,
    '```',
  ].join('\n');
}

const FUNNEL_COLS = 60;

/**
 * Text funnel: every tracked use case, then how many have a guide landed, then evals landed.
 * Rows share one scale; ░ is open PRs at that stage, matching the progress bar legend.
 */
export function renderFunnel(params: {
  useCases: number;
  guidesLanded: number;
  guidePrs: number;
  evalsLanded: number;
  evalPrs: number;
}): string {
  const { useCases, guidesLanded, guidePrs, evalsLanded, evalPrs } = params;
  const cols = (n: number) => Math.round((n / useCases) * FUNNEL_COLS);
  const row = (label: string, landed: number, open: number) => {
    const landedCols = cols(landed);
    const openCols = Math.min(FUNNEL_COLS - landedCols, cols(open));
    const bar = '█'.repeat(landedCols) + '░'.repeat(openCols) + '·'.repeat(FUNNEL_COLS - landedCols - openCols);
    const openPart = open > 0 ? ` +${open} PRs` : '';
    return `${label.padEnd(16)}${bar}  ${landed}${openPart}`;
  };
  return [
    '```',
    row('Use cases', useCases, 0),
    row('Guides landed', guidesLanded, guidePrs),
    row('Evals landed', evalsLanded, evalPrs),
    '```',
  ].join('\n');
}

export function sanitizeIssueTitle(title: string): string {
  return title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@([a-zA-Z0-9_-]+)/g, '`@$1`');
}

const GEN_BAR_COLS = 70;

function codeList(names: string[]): string {
  return names.map(n => `\`${n}\``).join(', ');
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

function renderShareBar(label: string, count: number, total: number): string {
  const cols = total > 0 ? Math.round((count / total) * GEN_BAR_COLS) : 0;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `${label.padEnd(24)}${'█'.repeat(cols)}${'·'.repeat(GEN_BAR_COLS - cols)}  ${count} / ${total} (${pct}%)`;
}

const REVIEW_GROUPS = ['approved', 'changes requested', 'awaiting review'] as const;

export function renderPipelineIssueBody(data: PipelineReportData): string {
  const totalNeedsGuidance = data.needsGuidancePrs.length + data.needsGuidanceIssues.length;
  const totalNeedsEvals = data.openEvalPrs.length + data.readyForEvals.length;
  const blockedGuides = data.needsGuidanceIssues.filter(i => i.draft === 'blocked');
  const wipGuides = data.needsGuidanceIssues.filter(i => i.draft === 'wip');
  const notStarted = data.needsGuidanceIssues.filter(i => i.draft !== 'blocked' && i.draft !== 'wip');
  const progressBar = renderTwoRowProgressBar({
    complete: data.completeCount,
    openEvalGuides: data.openEvalPrs.length,
    contentLanded: data.contentLandedCount,
    openGuideGuides: data.needsGuidancePrs.length,
    baseline: data.baseline,
    staleEvalsCount: data.staleEvals.length,
  });
  const funnel = renderFunnel({
    useCases: data.contentLandedCount + totalNeedsGuidance,
    guidesLanded: data.contentLandedCount,
    guidePrs: data.needsGuidancePrs.length,
    evalsLanded: data.completeCount,
    evalPrs: data.openEvalPrs.length,
  });
  const today = getLaDateString(new Date());
  const issuesQuery = (label: string) => `${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3A${label}`;

  const lines: string[] = [
    '# Content & Eval Pipeline',
    '',
    '```',
    progressBar.text,
    '```',
    '',
    '**Guides** = `guide.md` + `expectations.md` landed on `main` (not draft) · **Evals** = a landed guide that also has a grader',
    '',
    [
      `[${data.completeCount} evals landed](${REPO_URL}/tree/main/guides)`,
      `[${data.openEvalPrs.length} eval PRs](#stage-3-needs-evals-${totalNeedsEvals})`,
      `[${data.readyForEvals.length} ready for evals](#ready-for-evals-${data.readyForEvals.length})`,
      `[${data.needsGuidancePrs.length} guide PRs](#guide-prs-${data.needsGuidancePrs.length})`,
      `[${notStarted.length} use cases not started](#not-started-${notStarted.length})`,
      `[${data.needsUseCasesIssues.length} features awaiting use cases](#stage-1-needs-use-cases-${data.needsUseCasesIssues.length})`,
    ].join(' · '),
    '',
    '### Progress since Jul 22',
    '',
    renderProgressChart(data.weeklyProgressPoints),
    '',
    '---',
    '',
    `## Stage 1: ${ProjectStatus.NeedsUseCases} (${data.needsUseCasesIssues.length})`,
    '',
    `Open [\`new-feature\`](${issuesQuery(NEW_FEATURE_LABEL)}) issues. These count features, not guides, so they aren't in the totals above.`,
    '',
    '<details>',
    `<summary>Show ${data.needsUseCasesIssues.length} features, by category</summary>`,
    '',
  ];

  const featureRows = data.needsUseCasesIssues.toSorted(
    (a, b) => (a.category ?? '\uffff').localeCompare(b.category ?? '\uffff') || b.number - a.number
  );
  for (const item of featureRows) {
    const categoryPart = item.category ? `**${item.category}** · ` : '';
    const assigneePart = item.assignees.length > 0 ? ` · ${codeList(item.assignees)}` : '';
    lines.push(
      `- ${categoryPart}[#${item.number}](${REPO_URL}/issues/${item.number}) · ${sanitizeIssueTitle(item.title)}${assigneePart}`
    );
  }

  lines.push(
    '',
    '</details>',
    '',
    '---',
    '',
    `## Stage 2: ${ProjectStatus.NeedsGuidance} (${totalNeedsGuidance})`,
    '',
    `#### Guide PRs (${data.needsGuidancePrs.length})`,
    ''
  );
  for (const item of data.needsGuidancePrs) {
    const guideHref = item.hasDirOnMain ? `${REPO_URL}/tree/main/guides/${item.slug}` : `${REPO_URL}/pull/${item.prNumber}`;
    const reviewState = formatReviewDecision(item.reviewDecision, item.isDraft);
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    const reviewerPart = item.reviewers.length > 0 ? ` → ${codeList(item.reviewers)}` : '';
    lines.push(
      `- [**${item.slug}**](${guideHref}) · [PR #${item.prNumber}](${REPO_URL}/pull/${item.prNumber}) (${reviewState})${issuePart} · \`${item.author}\`${reviewerPart}`
    );
  }

  const stage2Lists: Array<[string, NeedsGuidanceIssueItem[], string]> = [
    ['Blocked', blockedGuides, 'Written but held back; the reason is from `draft-reason`.'],
    ['In progress', wipGuides, 'Marked `draft: wip`.'],
    ['Not started', notStarted, `Open [\`new-use-case\`](${issuesQuery(NEW_USE_CASE_LABEL)}) issues with no guide PR yet.`],
  ];
  for (const [title, items, blurb] of stage2Lists) {
    if (items.length === 0 && title !== 'Not started') continue;
    lines.push('', `#### ${title} (${items.length})`, '', blurb, '');
    for (const item of items) {
      const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
      const reasonPart = item.draftReason ? ` · ${sanitizeIssueTitle(item.draftReason)}` : '';
      const assigneePart = item.assignees.length > 0 ? ` · ${codeList(item.assignees)}` : '';
      lines.push(`- [**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug})${issuePart}${reasonPart}${assigneePart}`);
    }
  }

  lines.push('', '---', '', '### Funnel', '', funnel, '', '---', '', `## Stage 3: ${ProjectStatus.NeedsEvals} (${totalNeedsEvals})`);

  for (const group of REVIEW_GROUPS) {
    const items = data.openEvalPrs.filter(item => formatReviewDecision(item.reviewDecision, false) === group);
    if (items.length === 0) continue;
    lines.push('', `#### Eval PRs: ${group} (${items.length})`, '');
    for (const item of items) {
      const rates = [
        item.metrics.dailyGrindPassRate !== null ? `dg **${item.metrics.dailyGrindPassRate}%**` : null,
        item.metrics.devtoolsTimesPassRate !== null ? `dt **${item.metrics.devtoolsTimesPassRate}%**` : null,
      ].filter(r => r !== null);
      const passPart = rates.length > 0 ? `Pass@1 ${rates.join(' · ')} · ` : '';
      const healthyPart = item.metrics.isHealthy ? ' · `HEALTHY`' : '';
      const reviewerPart = item.reviewers.length > 0 ? ` · reviewers ${codeList(item.reviewers)}` : '';
      lines.push(
        `- ${passPart}[**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug}) · [PR #${item.prNumber}](${REPO_URL}/pull/${item.prNumber})${healthyPart}${reviewerPart}`
      );
    }
  }

  lines.push('', `#### Ready for evals (${data.readyForEvals.length})`, '', 'Guides with no eval PR yet, oldest first. Next step: `gd dev-gap`.', '');
  for (const { slug, readySince } of data.readyForEvals) {
    lines.push(
      `- [**${slug}**](${REPO_URL}/tree/main/guides/${slug}) · ready since ${formatShortDate(readySince)} (${daysBetween(readySince, today)} days)`
    );
  }

  if (data.staleEvals.length > 0) {
    lines.push('', `#### Stale evals (${data.staleEvals.length})`, '', 'Counted as evals landed, but `expectations.md` changed after the grader did.', '');
  }
  for (const item of data.staleEvals) {
    const prPart = item.expPr ? ` ([PR #${item.expPr}](${REPO_URL}/pull/${item.expPr}))` : '';
    lines.push(
      `- [**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug}) · \`expectations.md\` updated ${item.expDate}${prPart}, \`grader.ts\` unchanged since ${item.evalDate}`
    );
  }

  const auditAsset = (name: string) => `${REPO_URL}/releases/download/audit-data/${name}`;
  lines.push(
    '',
    `Quality audits (point-in-time snapshots, not tracked above): [expectations coverage, Sep 24](${auditAsset('audit-2026-09-24-expectations-coverage.json')}) · [eval defects behind #1998, Oct 12](${auditAsset('audit-2026-10-12-eval-defects-pr1998.json')})`,
    '',
    '---',
    '',
    '## Eval format: Gen 1 → Gen 2',
    '',
    '```',
    renderShareBar('Evals in Gen 2 format', data.gen2CompleteCount, data.completeCount),
    renderShareBar('Gen 2 on both targets', data.dualTargetCompleteCount, data.completeCount),
    '```',
    '',
    `**Gen 1**: root \`grader.ts\` + \`tasks/\` · **Gen 2**: \`targets/<base_app>/\` with its own \`task.md\` + \`grader.ts\` (targets: \`daily-grind\`, \`devtools-times\`). See [\`docs/CONTEXT.md\`](${REPO_URL}/blob/main/docs/CONTEXT.md).`,
    '',
    `> Migration is paused while \`gd dev-gap\` writes Gen 2 evals for the ${totalNeedsEvals} guides in Stage 3.`
  );

  return lines.join('\n');
}

const PR_FETCH_LIMIT = 300;

function fetchOpenPrs(guides: GuideInventory[]): PrSummary[] {
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
      String(PR_FETCH_LIMIT),
      '--json',
      'number,title,body,isDraft,reviewDecision,headRefName,headRefOid,author,reviewRequests,latestReviews,labels,files',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const parsed = JSON.parse(raw) as Array<{
    number: number;
    title: string;
    body?: string;
    isDraft?: boolean;
    reviewDecision?: string | null;
    headRefName?: string;
    headRefOid?: string;
    author?: { login?: string };
    reviewRequests?: Array<{ login?: string; name?: string }>;
    latestReviews?: Array<{ author?: { login?: string } }>;
    labels?: Array<{ name?: string }>;
    files?: Array<{ path?: string }>;
  }>;

  if (parsed.length >= PR_FETCH_LIMIT) {
    throw new Error(
      `fetchOpenPrs hit limit of ${PR_FETCH_LIMIT} open PRs; results may be truncated. Increase limit.`
    );
  }

  const prs: PrSummary[] = parsed.map(p => ({
    number: p.number,
    title: p.title,
    body: p.body ?? '',
    isDraft: Boolean(p.isDraft),
    reviewDecision: p.reviewDecision ?? null,
    headRefName: p.headRefName ?? '',
    headRefOid: p.headRefOid,
    author: p.author?.login ?? 'unknown',
    reviewers: [
      ...new Set([
        ...(p.reviewRequests ?? []).map(r => r.login ?? r.name ?? ''),
        ...(p.latestReviews ?? []).map(r => r.author?.login ?? ''),
      ]),
    ].filter(Boolean),
    labels: (p.labels ?? []).map(l => l.name ?? '').filter(Boolean),
    files: (p.files ?? []).map(f => f.path ?? '').filter(Boolean),
    guideContents: {},
  }));

  const bySlug = new Map(guides.map(g => [`${g.category}/${g.name}`, g]));
  const blobQueries: Array<{ pr: PrSummary; slug: string; expr: string }> = [];
  for (const pr of prs) {
    if (!pr.headRefOid) continue;
    for (const filePath of pr.files) {
      const parsed = parseGuidePath(filePath);
      if (!parsed || parsed.relPath !== GUIDE_FILE) continue;
      const inv = bySlug.get(parsed.slug);
      const status = inv ? classifyGuide(inv) : 'stub';
      if (status === 'stub' || status === 'incomplete' || status === 'needs-expectations') {
        blobQueries.push({ pr, slug: parsed.slug, expr: `${pr.headRefOid}:guides/${parsed.slug}/${GUIDE_FILE}` });
      }
    }
  }

  if (blobQueries.length > 0) {
    const fields = blobQueries
      .map((q, i) => `b${i}: object(expression: ${JSON.stringify(q.expr)}) { ... on Blob { text } }`)
      .join('\n');
    const gql = `{ repository(owner: ${JSON.stringify(ORG)}, name: ${JSON.stringify(REPO)}) { ${fields} } }`;
    const gqlRaw = child_process.execFileSync('gh', ['api', 'graphql', '--field', `query=${gql}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const repoData = (JSON.parse(gqlRaw) as { data?: { repository?: Record<string, { text?: string } | null> } }).data
      ?.repository;
    for (let i = 0; i < blobQueries.length; i++) {
      const { pr, slug } = blobQueries[i];
      if (!pr.guideContents) pr.guideContents = {};
      pr.guideContents[slug] = repoData?.[`b${i}`]?.text ?? '';
    }
  }

  return prs;
}

function fetchOpenIssuesByLabel(label: string, minExpected = 1): IssueSummary[] {
  const query = `
    query($owner: String!, $repo: String!, $label: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, after: $cursor, states: [OPEN], labels: [$label], orderBy: { field: CREATED_AT, direction: ASC }) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            body
            assignees(first: 10) {
              nodes {
                login
              }
            }
            labels(first: 30) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  const issues: IssueSummary[] = [];
  let cursor: string | null = null;
  let expectedTotal: number | null = null;

  do {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      '-f',
      `owner=${ORG}`,
      '-f',
      `repo=${REPO}`,
      '-f',
      `label=${label}`,
    ];
    if (cursor) {
      args.push('-f', `cursor=${cursor}`);
    }
    const raw = child_process.execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw) as {
      data?: {
        repository?: {
          issues?: {
            totalCount?: number;
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            nodes?: Array<{
              number: number;
              title?: string;
              body?: string;
              assignees?: { nodes?: Array<{ login?: string } | null> };
              labels?: { nodes?: Array<{ name?: string } | null> };
            } | null>;
          };
        };
      };
    };

    const conn = parsed.data?.repository?.issues;
    if (!conn || !Array.isArray(conn.nodes)) {
      throw new Error(`Invalid GraphQL response in fetchOpenIssuesByLabel(${label}).`);
    }
    if (expectedTotal === null && typeof conn.totalCount === 'number') {
      expectedTotal = conn.totalCount;
    }

    for (const node of conn.nodes) {
      if (!node) continue;
      issues.push({
        number: node.number,
        title: node.title ?? '',
        body: node.body ?? '',
        assignees: (node.assignees?.nodes ?? []).map(a => a?.login ?? '').filter(Boolean),
        labels: (node.labels?.nodes ?? []).map(l => l?.name ?? '').filter(Boolean),
      });
    }

    const { hasNextPage, endCursor } = conn.pageInfo ?? {};
    cursor = hasNextPage ? (endCursor ?? null) : null;
  } while (cursor);

  if (expectedTotal !== null && issues.length !== expectedTotal) {
    throw new Error(
      `fetchOpenIssuesByLabel(${label}) count mismatch: expected ${expectedTotal} issues, received ${issues.length}.`
    );
  }
  if (issues.length < minExpected) {
    throw new Error(
      `fetchOpenIssuesByLabel(${label}) returned only ${issues.length} open issues (expected at least ${minExpected}); refusing to overwrite tracker issue.`
    );
  }

  return issues;
}

function fetchIssueBody(issueNumber: number): string {
  return child_process.execFileSync(
    'gh',
    ['issue', 'view', String(issueNumber), '--repo', `${ORG}/${REPO}`, '--json', 'body', '--jq', '.body'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
}

function loadInfraOwnersFromCodeowners(): { catchAllOwners: Set<string>; evalOwners: Set<string> } {
  const catchAllOwners = new Set<string>();
  const evalOwners = new Set<string>();
  const content = fs.readFileSync(path.join(rootDir, 'CODEOWNERS'), 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    const handles = owners.filter(o => o.startsWith('@')).map(o => o.slice(1));
    if (pattern === '*') {
      for (const h of handles) catchAllOwners.add(h);
    } else if (
      pattern.includes('grader.ts') ||
      pattern.includes('targets/') ||
      pattern.includes('tasks/') ||
      pattern.includes('src/grading/')
    ) {
      for (const h of handles) evalOwners.add(h);
    }
  }
  return { catchAllOwners, evalOwners };
}

const { catchAllOwners: CATCHALL_INFRA_OWNERS, evalOwners: EVAL_CODEOWNERS } = loadInfraOwnersFromCodeowners();

export function filterCatchAllReviewers(reviewers: string[], stage: 'guidance' | 'evals'): string[] {
  if (reviewers.length <= 1) return reviewers;
  if (stage === 'guidance') {
    const nonInfra = reviewers.filter(r => !CATCHALL_INFRA_OWNERS.has(r) && !EVAL_CODEOWNERS.has(r));
    if (nonInfra.length > 0) return nonInfra;
    const nonCatchAll = reviewers.filter(r => !CATCHALL_INFRA_OWNERS.has(r));
    return nonCatchAll.length > 0 ? nonCatchAll : reviewers;
  }
  const nonCatchAllOnly = reviewers.filter(r => !(CATCHALL_INFRA_OWNERS.has(r) && !EVAL_CODEOWNERS.has(r)));
  return nonCatchAllOnly.length > 0 ? nonCatchAllOnly : reviewers;
}

export function buildPipelineReportData(params: {
  guides: GuideInventory[];
  openPrs: PrSummary[];
  openUseCaseIssues: IssueSummary[];
  openFeatureIssues: IssueSummary[];
  gitHistory: Map<string, GitFileHistory>;
  weeklyProgressPoints?: WeeklyProgressPoint[];
  readySinceBySlug?: Map<string, string>;
}): PipelineReportData {
  const validGuides = params.guides.filter(g => g.category !== 'test-results' && (g.hasGuide || g.isStub));
  const guideBySlug = new Map(validGuides.map(g => [`${g.category}/${g.name}`, g]));
  const existingGuideNames = new Set(validGuides.map(g => g.name));

  const completeCount = validGuides.filter(g => classifyGuide(g) === 'complete').length;
  const needsEvalsGuides = validGuides.filter(g => {
    const s = classifyGuide(g);
    return s === 'needs-calibration' || s === 'needs-test';
  });
  const contentLandedCount = completeCount + needsEvalsGuides.length;

  const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(params.openUseCaseIssues);
  const useCaseIssueNumbers = new Set(params.openUseCaseIssues.map(i => i.number));
  const findUseCaseIssue = (slug: string, guideName: string) =>
    subdirToIssueMap.get(`guides/${slug}`) ?? nameToIssueMap.get(guideName) ?? null;

  const openEvalPrsBySlug = new Map<string, OpenEvalPrItem>();
  const needsGuidancePrsBySlug = new Map<string, NeedsGuidancePrItem>();

  for (const pr of params.openPrs) {
    const touchedFilesBySlug = new Map<string, string[]>();
    for (const file of pr.files) {
      const parsed = parseGuidePath(file);
      if (!parsed) continue;
      const list = touchedFilesBySlug.get(parsed.slug) ?? [];
      list.push(parsed.relPath);
      touchedFilesBySlug.set(parsed.slug, list);
    }

    for (const [slug, touchedRelFiles] of touchedFilesBySlug) {
      const inv = guideBySlug.get(slug);
      const guideName = slug.split('/')[1];
      if (!inv && existingGuideNames.has(guideName)) continue;

      const guideContent = pr.guideContents?.[slug];
      const guideMetaAfter = guideContent !== undefined ? parseGuideMetadata(guideContent, undefined, true) : undefined;
      const stage = getPendingGuideStage(inv, touchedRelFiles, guideMetaAfter);

      if (stage === ProjectStatus.NeedsEvals && !openEvalPrsBySlug.has(slug)) {
        openEvalPrsBySlug.set(slug, {
          slug,
          prNumber: pr.number,
          metrics: parseEvalReportFromPrBody(pr.body),
          reviewDecision: pr.reviewDecision,
          reviewers: filterCatchAllReviewers(pr.reviewers, 'evals'),
        });
      } else if (stage === ProjectStatus.NeedsGuidance && !needsGuidancePrsBySlug.has(slug)) {
        const matchedIssue = findUseCaseIssue(slug, guideName);
        const titleIssueNum = Number(/^\[#(\d+)\]/.exec(pr.title)?.[1]) || null;
        needsGuidancePrsBySlug.set(slug, {
          slug,
          hasDirOnMain: Boolean(inv),
          prNumber: pr.number,
          isDraft: pr.isDraft,
          reviewDecision: pr.reviewDecision,
          issueNumber:
            matchedIssue?.number ?? (titleIssueNum && useCaseIssueNumbers.has(titleIssueNum) ? titleIssueNum : null),
          author: pr.author,
          reviewers: filterCatchAllReviewers(pr.reviewers, 'guidance'),
        });
      }
    }
  }
  const openEvalPrs = Array.from(openEvalPrsBySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  const needsGuidancePrs = Array.from(needsGuidancePrsBySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));

  const readyForEvalSlugs = needsEvalsGuides
    .filter(g => !openEvalPrsBySlug.has(`${g.category}/${g.name}`))
    .map(g => `${g.category}/${g.name}`);

  const needsEvalsTotal = contentLandedCount - completeCount;
  if (openEvalPrs.length + readyForEvalSlugs.length !== needsEvalsTotal) {
    throw new Error(
      `Invariant violation in Needs Evals: openEvalPrs (${openEvalPrs.length}) + readyForEvalSlugs (${readyForEvalSlugs.length}) !== contentLandedCount - completeCount (${needsEvalsTotal})`
    );
  }

  const needsGuidanceIssues = validGuides
    .filter(g => {
      const s = classifyGuide(g);
      return (
        (s === 'stub' || s === 'incomplete' || s === 'needs-expectations') &&
        !needsGuidancePrsBySlug.has(`${g.category}/${g.name}`)
      );
    })
    .map(g => {
      const slug = `${g.category}/${g.name}`;
      const matchedIssue = findUseCaseIssue(slug, g.name);
      return {
        slug,
        issueNumber: matchedIssue?.number ?? null,
        draft: g.draft,
        draftReason: g.draftReason,
        assignees: matchedIssue?.assignees ?? [],
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const staleEvals = findStaleEvals(validGuides, params.gitHistory);
  const { gen2CompleteCount, dualTargetCompleteCount } = countGen2Evals(validGuides);

  const historical = params.weeklyProgressPoints ?? fetchWeeklyProgressHistory();
  if (historical.length === 0) throw new Error('Cannot determine baseline: no weekly progress points');
  const today = getLaDateString(new Date());
  // Today's point comes from the in-memory inventory so the chart always matches the counts.
  const weeklyProgressPoints = [
    ...historical.filter(p => p.date !== today),
    { date: today, label: formatShortDate(today), complete: completeCount, contentLanded: contentLandedCount },
  ];

  const readySinceBySlug = params.readySinceBySlug ?? findReadySince(readyForEvalSlugs);
  const readyForEvals = readyForEvalSlugs
    .map(slug => {
      const readySince = readySinceBySlug.get(slug);
      if (!readySince) throw new Error(`Missing ready-since date for ${slug}`);
      return { slug, readySince };
    })
    .sort((a, b) => a.readySince.localeCompare(b.readySince) || a.slug.localeCompare(b.slug));

  const guideCategories = new Set(validGuides.map(g => g.category));

  return {
    baseline: historical[0].complete,
    completeCount,
    contentLandedCount,
    gen2CompleteCount,
    dualTargetCompleteCount,
    weeklyProgressPoints,
    needsUseCasesIssues: params.openFeatureIssues.map(issue => ({
      ...issue,
      category: issue.labels.find(l => guideCategories.has(l)) ?? null,
    })),
    needsGuidancePrs,
    needsGuidanceIssues,
    openEvalPrs,
    readyForEvals,
    staleEvals,
  };
}

export function runSyncPipelineIssue(): void {
  const hasWriteFlag = process.argv.includes('--write') || process.argv.includes('--live');
  const isDryRunEnv = parseBooleanEnv(process.env.DRY_RUN, true);
  const isDryRun = hasWriteFlag ? false : isDryRunEnv;

  const guides = scanAllGuides();
  const openPrs = fetchOpenPrs(guides);
  const openUseCaseIssues = fetchOpenIssuesByLabel(NEW_USE_CASE_LABEL);
  const openFeatureIssues = fetchOpenIssuesByLabel(NEW_FEATURE_LABEL);
  const gitHistory = collectGitGuideHistory();

  const reportData = buildPipelineReportData({
    guides,
    openPrs,
    openUseCaseIssues,
    openFeatureIssues,
    gitHistory,
  });

  const nextBody = renderPipelineIssueBody(reportData);

  if (isDryRun) {
    console.log(`🏃 Dry run mode enabled for issue #${PIPELINE_ISSUE_NUMBER}. Pass --write or DRY_RUN=false to update GitHub.\n`);
    console.log(nextBody);
    return;
  }

  const existingIssueBody = fetchIssueBody(PIPELINE_ISSUE_NUMBER);
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
