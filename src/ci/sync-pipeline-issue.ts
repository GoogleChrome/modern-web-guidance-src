/**
 * Synchronizes the canonical Content & Eval Pipeline tracker issue (#1815).
 *
 * Usage:
 *   node src/ci/sync-pipeline-issue.ts           # dry-run (prints markdown preview)
 *   node src/ci/sync-pipeline-issue.ts --write   # updates issue #1815 on GitHub
 */

import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { parseBooleanEnv } from '../core/env.ts';
import { stripTmpPrefix } from '../core/feature-parser.ts';
import {
  DEMO_FILE,
  EXPECTATIONS_FILE,
  FALSY_DRAFT,
  getGuideStatus,
  getTaskMap,
  GRADER_FILE,
  GUIDE_FILE,
  isDisciplineGuide,
  isDraftStub,
  ProjectStatus,
  scanAllGuides,
  TARGETS_DIR,
  type GuideInventory,
  type TaskInfo,
} from '../core/guide-validation.ts';
import { DEV_PR_BRANCH_PREFIX, DEV_PR_TITLE_PREFIX } from '../authoring/pr.ts';
import { rootDir } from '../core/paths.ts';
import { buildFeatureToIssueMap, buildUseCaseMaps } from './sync-use-cases.ts';

export const ORG = 'GoogleChrome';
export const REPO = 'modern-web-guidance-src';
export const REPO_URL = `https://github.com/${ORG}/${REPO}`;
export const PIPELINE_ISSUE_NUMBER = Number(process.env.PIPELINE_ISSUE_NUMBER || 1815);
export const EXPECTATIONS_CHANGED_LABEL = 'expectations-changed';

export const PIPELINE_BASELINE_DATE = '2026-07-22';
export const PIPELINE_SCALE_MAX = 200;
const RULER_MID_TICK = 150;

export interface PrSummary {
  number: number;
  title: string;
  body: string;
  isDraft: boolean;
  reviewDecision?: string | null;
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
  reviewDecision?: string | null;
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
  reviewDecision?: string | null;
  author: string;
  reviewers: string[];
}

export interface CommitAnalysis {
  complete: number;
  needsEvals: number;
}

export type PrClassification = 'eval' | 'guide' | 'other';

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

export interface PipelineReportData {
  completeCount: number;
  contentLandedCount: number;
  gen2CompleteCount: number;
  progressBar: TwoRowProgressBar;
  weeklyChart: string;
  sankey: string;
  needsUseCasesIssues: Array<IssueSummary & { category: string | null }>;
  needsGuidancePrs: NeedsGuidancePrItem[];
  needsGuidanceIssues: NeedsGuidanceIssueItem[];
  openEvalPrs: OpenEvalPrItem[];
  readyForEvalSlugs: string[];
  readySinceBySlug: Map<string, string>;
  staleEvals: StaleEvalItem[];
  legacyEvals: LegacyEvalItem[];
  dualTargetCompleteCount: number;
}

export function formatReviewDecision(decision: string | null | undefined, isDraft: boolean): string {
  if (isDraft) return 'draft';
  if (decision === 'CHANGES_REQUESTED') return 'changes requested';
  if (decision === 'APPROVED') return 'approved';
  return 'awaiting review';
}

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

export function getLaDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
}

export function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

export function collectGitGuideHistory(cwd: string = rootDir): Map<string, GitFileHistory> {
  const history = new Map<string, GitFileHistory>();
  const output = child_process.execFileSync(
    'git',
    ['log', '-M', '--diff-filter=AM', '--name-only', '--format=COMMIT|%H|%ct|%cs|%s', '--', 'guides/'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

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
      } catch {
        entry.isSubstantiveDiff = true;
      }
    }
  }

  return history;
}

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

export function findLegacyFormatGuides(
  guides: GuideInventory[],
  taskMap: Map<string, TaskInfo> = getTaskMap()
): {
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

    if (g.hasGrader) {
      const task = taskMap.get(`${g.name}/task`);
      const baseApp = task?.baseApp === 'devtools-times' ? 'devtools-times' : 'daily-grind';
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
  try {
    const { data = {}, content: body = '' } = matter(content);
    const draftVal =
      typeof data.draft === 'string' && FALSY_DRAFT.has(data.draft.trim().toLowerCase())
        ? false
        : Boolean(data.draft);
    const isDraft = Boolean(draftVal) || isDraftStub(data.draft);
    const hasContent = body.trim().length > 0;
    return { isDraft, hasContent };
  } catch {
    return { isDraft: false, hasContent: content.trim().length > 0 };
  }
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
    const guideBlobSha = files.get(GUIDE_FILE);
    if (guideBlobSha && guideBlobSha !== EMPTY_BLOB_SHA) {
      guideBlobsToFetch.push({ slug, blobSha: guideBlobSha });
    }
  }

  const isDraftMap = new Map<string, boolean>();
  const hasContentMap = new Map<string, boolean>();

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
      const content = contentBuf.toString('utf8');
      const { isDraft, hasContent } = parseFrontmatterDraft(content);
      isDraftMap.set(slug, isDraft);
      hasContentMap.set(slug, hasContent);
    }
  }

  let complete = 0;
  let needsEvals = 0;

  for (const [slug, files] of guideFiles) {
    const [category, name] = slug.split('/');
    if (options.excludeDisciplineHubs && isDisciplineGuide(name, category)) {
      continue;
    }

    const hasGuideFile = files.has(GUIDE_FILE);
    const isDraft = isDraftMap.get(slug) ?? false;
    const hasGuideContent = hasContentMap.get(slug) ?? false;
    const hasGuide = hasGuideFile && hasGuideContent && !isDraft;

    const hasExpectationsFile = files.has(EXPECTATIONS_FILE);
    const expBlobSha = files.get(EXPECTATIONS_FILE);
    const hasExpectations = hasExpectationsFile && expBlobSha !== EMPTY_BLOB_SHA;

    const hasGrader =
      files.has(GRADER_FILE) ||
      Array.from(files.keys()).some(k => k.startsWith(`${TARGETS_DIR}/`) && k.endsWith(`/${GRADER_FILE}`));

    if (hasGuide && hasGrader) {
      complete++;
    } else if (hasGuide && hasExpectations && !hasGrader) {
      needsEvals++;
    }
  }

  return { complete, needsEvals };
}

const commitAnalysisCache = new Map<string, CommitAnalysis>();

/**
 * For each guide, the date it entered its current uninterrupted "content landed" streak on
 * HEAD: non-draft guide.md with content plus expectations.md. Walks the commits touching those
 * two files newest-first and stops at the first commit where the guide wasn't landed.
 */
export function findReadySince(slugs: string[], cwd: string = rootDir): Map<string, string> {
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
      const present = child_process
        .execFileSync('git', ['ls-tree', '--name-only', sha, '--', guidePath, expPath], { cwd, encoding: 'utf8' })
        .trim()
        .split('\n');
      if (!present.includes(guidePath) || !present.includes(expPath)) break;
      const guideContent = child_process.execFileSync('git', ['show', `${sha}:${guidePath}`], { cwd, encoding: 'utf8' });
      const { isDraft, hasContent } = parseFrontmatterDraft(guideContent);
      if (isDraft || !hasContent) break;
      since = date;
    }
    if (!since) throw new Error(`findReadySince: ${slug} is not landed at HEAD`);
    result.set(slug, since);
  }
  return result;
}

export function getCachedCommitAnalysis(
  commitSha: string,
  options: { excludeDisciplineHubs?: boolean; cwd?: string } = {}
): CommitAnalysis {
  const cwd = options.cwd ?? rootDir;
  const cacheKey = `${cwd}:${commitSha}:${Boolean(options.excludeDisciplineHubs)}`;
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
  const touchesGuideMd = files.some(f => f === GUIDE_FILE || f.endsWith(`/${GUIDE_FILE}`));
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
      if (!rel.startsWith(`${TARGETS_DIR}/`) && rel !== GRADER_FILE && !rel.startsWith('tasks/')) {
        onlyEvalFiles = false;
      }
    } else {
      onlyEvalFiles = false;
    }
  }

  const isEval =
    headRef.startsWith(DEV_PR_BRANCH_PREFIX) ||
    title.toLowerCase().startsWith(DEV_PR_TITLE_PREFIX) ||
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
  if (headRef.startsWith(DEV_PR_BRANCH_PREFIX)) {
    const name = headRef.slice(DEV_PR_BRANCH_PREFIX.length);
    if (isDisciplineGuide(name)) {
      return true;
    }
  }
  return false;
}

export function renderTwoRowProgressBar(params: {
  complete: number;
  openEvalGuides: number;
  contentLanded: number;
  openGuideGuides: number;
  baseline: number;
  notStartedIssues?: number;
  staleEvalsCount?: number;
  scaleMax?: number;
}): TwoRowProgressBar {
  const scaleMax = params.scaleMax ?? PIPELINE_SCALE_MAX;
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
  const staleFlag = params.staleEvalsCount && params.staleEvalsCount > 0 ? ` (${params.staleEvalsCount} stale)` : '';
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

export function fetchWeeklyProgressHistory(params: {
  cwd?: string;
  endDate?: Date;
} = {}): WeeklyProgressPoint[] {
  const cwd = params.cwd ?? rootDir;
  const end = params.endDate ?? new Date();
  const endLaDate = getLaDateString(end);

  const dates: string[] = [endLaDate];
  let cur = new Date(end.getTime());

  while (true) {
    cur = new Date(cur.getTime() - 7 * 86_400_000);
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
      .execFileSync('git', ['rev-list', '-1', `--before=${ts}`, 'origin/main'], {
        cwd,
        encoding: 'utf8',
      })
      .trim();
    const analysis = getCachedCommitAnalysis(sha, { cwd, excludeDisciplineHubs: true });
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
    `    y-axis "Guides" 100 --> ${PIPELINE_SCALE_MAX}`,
    `    bar "Guides landed" [${contentBars}]`,
    `    bar "Evals landed" [${completeBars}]`,
    '```',
  ].join('\n');
}

export function renderSankeyDiagram(params: {
  complete: number;
  evalPrsInReview: number;
  readyForEvals: number;
  guidePrsInReview: number;
  notStarted: number;
}): string {
  const { complete, evalPrsInReview, readyForEvals, guidePrsInReview, notStarted } = params;
  const needsEvals = evalPrsInReview + readyForEvals;
  const needsGuidance = guidePrsInReview + notStarted;

  // Mermaid's sankey stylesheet sets `.link { mix-blend-mode: multiply }`, which renders links
  // black on GitHub's dark theme; `!important` is required to beat it.
  const lines = [
    '```mermaid',
    '---',
    'config:',
    '  themeCSS: ".link { mix-blend-mode: normal !important; stroke-opacity: 0.6 !important; }"',
    '  sankey:',
    '    linkColor: target',
    '    nodeAlignment: left',
    '    labelStyle: outlined',
    '    nodeColors:',
    '      "All guides": "#9AA0A6"',
    '      "Evals landed": "#4285F4"',
    '      "Needs evals": "#FBBC04"',
    '      "Needs guidance": "#E37400"',
    '      "Eval PR open": "#E37400"',
    '      "Ready for evals": "#FBBC04"',
    '      "Guide PR open": "#E37400"',
    '      "Not started": "#5F6368"',
    '---',
    'sankey-beta',
    '',
    `All guides, Evals landed, ${complete}`,
    `All guides, Needs evals, ${needsEvals}`,
    `All guides, Needs guidance, ${needsGuidance}`,
    `Needs evals, Eval PR open, ${evalPrsInReview}`,
    `Needs evals, Ready for evals, ${readyForEvals}`,
    `Needs guidance, Guide PR open, ${guidePrsInReview}`,
    `Needs guidance, Not started, ${notStarted}`,
    '```',
  ];

  return lines.join('\n');
}

export function sanitizeIssueTitle(title: string): string {
  return title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@([a-zA-Z0-9_-]+)/g, '`@$1`');
}

const DAY_MS = 86_400_000;
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
  const totalNeedsEvals = data.openEvalPrs.length + data.readyForEvalSlugs.length;
  const today = getLaDateString(new Date());
  const issuesQuery = (label: string) => `${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3A${label}`;

  const lines: string[] = [
    '# Content & Eval Pipeline',
    '',
    '<!-- Discipline orientation guides do not currently require a grader and are excluded from all counts below. This policy may change. -->',
    '',
    '```',
    data.progressBar.text,
    '```',
    '',
    '**Guides** = `guide.md` + `expectations.md` landed on `main` (not draft) · **Evals** = a landed guide that also has a grader',
    '',
    [
      `[${data.completeCount} evals landed](${REPO_URL}/tree/main/guides)`,
      `[${data.openEvalPrs.length} eval PRs](#stage-3-needs-evals-${totalNeedsEvals})`,
      `[${data.readyForEvalSlugs.length} ready for evals](#ready-for-evals-${data.readyForEvalSlugs.length})`,
      `[${data.needsGuidancePrs.length} guide PRs](#guide-prs-${data.needsGuidancePrs.length})`,
      `[${data.needsGuidanceIssues.length} use cases not started](#not-started-${data.needsGuidanceIssues.length})`,
      `[${data.needsUseCasesIssues.length} features awaiting use cases](#stage-1-needs-use-cases-${data.needsUseCasesIssues.length})`,
    ].join(' · '),
    '',
    '### Progress since Jul 22',
    '',
    data.weeklyChart,
    '',
    '### Where guides are now',
    '',
    data.sankey,
    '',
    '---',
    '',
    `## Stage 1: ${ProjectStatus.NeedsUseCases} (${data.needsUseCasesIssues.length})`,
    '',
    `Open [\`new-feature\`](${issuesQuery('new-feature')}) issues. These count features, not guides, so they aren't in the totals above.`,
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

  lines.push(
    '',
    `#### Not started (${data.needsGuidanceIssues.length})`,
    '',
    `Open [\`new-use-case\`](${issuesQuery('new-use-case')}) issues with no guide PR yet.`,
    ''
  );
  for (const item of data.needsGuidanceIssues) {
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    const draftPart = item.isDraftGuide ? ' (`draft: true` stub)' : '';
    const assigneePart = item.assignees.length > 0 ? ` · ${codeList(item.assignees)}` : '';
    lines.push(`- [**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug})${issuePart}${draftPart}${assigneePart}`);
  }

  lines.push('', '---', '', `## Stage 3: ${ProjectStatus.NeedsEvals} (${totalNeedsEvals})`);

  for (const group of REVIEW_GROUPS) {
    const items = data.openEvalPrs.filter(item => formatReviewDecision(item.reviewDecision, false) === group);
    if (items.length === 0) continue;
    lines.push('', `#### Eval PRs: ${group} (${items.length})`, '');
    for (const item of items) {
      const rates = [
        item.metrics.dailyGrindPassRate !== null ? `dg ${item.metrics.dailyGrindPassRate}%` : null,
        item.metrics.devtoolsTimesPassRate !== null ? `dt ${item.metrics.devtoolsTimesPassRate}%` : null,
      ].filter(r => r !== null);
      const passPart = rates.length > 0 ? `**Pass@1 ${rates.join(' · ')}** · ` : '';
      const healthyPart = item.metrics.isHealthy ? ' · `HEALTHY`' : '';
      const reviewerPart = item.reviewers.length > 0 ? ` → ${codeList(item.reviewers)}` : '';
      lines.push(
        `- ${passPart}[**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug}) · [PR #${item.prNumber}](${REPO_URL}/pull/${item.prNumber})${healthyPart} · \`${item.author}\`${reviewerPart}`
      );
    }
  }

  const readyRows = data.readyForEvalSlugs
    .map(slug => {
      const since = data.readySinceBySlug.get(slug);
      if (!since) throw new Error(`Missing ready-since date for ${slug}`);
      return { slug, since };
    })
    .sort((a, b) => a.since.localeCompare(b.since));
  lines.push('', `#### Ready for evals (${readyRows.length})`, '', 'Guides with no eval PR yet, oldest first. Next step: `gd dev-gap`.', '');
  for (const { slug, since } of readyRows) {
    lines.push(
      `- [**${slug}**](${REPO_URL}/tree/main/guides/${slug}) · ready since ${formatShortDate(since)} (${daysBetween(since, today)} days)`
    );
  }

  if (data.staleEvals.length > 0) {
    lines.push('', `#### Stale evals (${data.staleEvals.length})`, '', 'Counted as evals landed, but `expectations.md` changed after the grader did.', '');
  }
  for (const item of data.staleEvals) {
    const prPart = item.expPr ? ` ([PR #${item.expPr}](${REPO_URL}/pull/${item.expPr}))` : '';
    const issuePart = item.issueNumber ? ` · [#${item.issueNumber}](${REPO_URL}/issues/${item.issueNumber})` : '';
    lines.push(
      `- [**${item.slug}**](${REPO_URL}/tree/main/guides/${item.slug}) · \`expectations.md\` updated ${item.expDate}${prPart}, \`grader.ts\` unchanged since ${item.evalDate}${issuePart}`
    );
  }

  lines.push(
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

export const PR_FETCH_LIMIT = 300;
export const ISSUE_FETCH_LIMIT = 500;

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
      String(PR_FETCH_LIMIT),
      '--json',
      'number,title,body,isDraft,reviewDecision,headRefName,author,reviewRequests,latestReviews,labels,files',
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

  return parsed.map(p => ({
    number: p.number,
    title: p.title,
    body: p.body ?? '',
    isDraft: Boolean(p.isDraft),
    reviewDecision: p.reviewDecision ?? null,
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
      String(ISSUE_FETCH_LIMIT),
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

  if (parsed.length >= ISSUE_FETCH_LIMIT) {
    throw new Error(
      `fetchOpenIssuesByLabel(${label}) hit limit of ${ISSUE_FETCH_LIMIT} issues; results may be truncated. Increase limit.`
    );
  }

  return parsed.map(i => ({
    number: i.number,
    title: i.title,
    body: i.body ?? '',
    assignees: (i.assignees ?? []).map(a => a.login ?? '').filter(Boolean),
    labels: (i.labels ?? []).map(l => l.name ?? '').filter(Boolean),
  }));
}

function fetchIssueBody(issueNumber: number): string {
  return child_process.execFileSync(
    'gh',
    ['issue', 'view', String(issueNumber), '--repo', `${ORG}/${REPO}`, '--json', 'body', '--jq', '.body'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
}

export interface UseCaseIssueIndex {
  nameToIssueMap: Map<string, IssueSummary>;
  subdirToIssueMap: Map<string, IssueSummary>;
  featureIdToIssueMap: Map<string, { number: number; body?: string }>;
}

export function buildUseCaseIssueIndex(
  useCaseIssues: IssueSummary[],
  featureIssues: IssueSummary[]
): UseCaseIssueIndex {
  const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(useCaseIssues);
  const featureIdToIssueMap = buildFeatureToIssueMap(featureIssues);
  return { nameToIssueMap, subdirToIssueMap, featureIdToIssueMap };
}

export function matchUseCaseIssue(
  slug: string,
  guideName: string,
  index: UseCaseIssueIndex,
  featureIds: string[] = []
): { number: number; assignees?: string[] } | null {
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
    if (touchedSlugs.size === 0 && pr.headRefName.startsWith(DEV_PR_BRANCH_PREFIX)) {
      const guideName = pr.headRefName.slice(DEV_PR_BRANCH_PREFIX.length);
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
      if (getGuideStatus(inv) !== ProjectStatus.NeedsEvals) {
        continue;
      }
      if (evalPrSlugs.has(slug)) {
        continue;
      }
      evalPrSlugs.add(slug);
      openEvalPrs.push({
        slug,
        prNumber: pr.number,
        metrics: parseEvalReportFromPrBody(pr.body),
        reviewDecision: pr.reviewDecision,
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
        (touchedFiles.includes(EXPECTATIONS_FILE) || touchedFiles.includes(DEMO_FILE));
      if (inv && getGuideStatus(inv) !== ProjectStatus.NeedsGuidance) continue;
      if (!inv && !isNewFullGuidePr) continue;

      slugsWithContentPr.add(slug);
      const matchedIssue = matchUseCaseIssue(slug, guideName, issueIndex, inv?.featureIds ?? []);
      const issueFromTitle = /^\[#(\d+)\]/.exec(pr.title);
      const issueNumber = matchedIssue?.number ?? (issueFromTitle ? Number(issueFromTitle[1]) : null);

      needsGuidancePrs.push({
        slug,
        hasDirOnMain: Boolean(inv),
        prNumber: pr.number,
        isDraft: pr.isDraft,
        reviewDecision: pr.reviewDecision,
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

    const matchedIssue = matchUseCaseIssue(slug, g.name, issueIndex, g.featureIds);
    needsGuidanceIssues.push({
      slug,
      issueNumber: matchedIssue?.number ?? null,
      isDraftGuide: !g.isStub && Boolean(g.draft),
      assignees: (matchedIssue as IssueSummary)?.assignees ?? [],
    });
  }
  return needsGuidanceIssues.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildPipelineReportData(params: {
  guides: GuideInventory[];
  openPrs: PrSummary[];
  openUseCaseIssues: IssueSummary[];
  openFeatureIssues: IssueSummary[];
  openExpectationsChangedIssues: IssueSummary[];
  gitHistory: Map<string, GitFileHistory>;
  weeklyProgressPoints?: WeeklyProgressPoint[];
  baselineComplete?: number;
  readySinceBySlug?: Map<string, string>;
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

  // Current-state numbers derived purely from in-memory GuideInventory (featureGuides + getGuideStatus)
  const completeGuides = featureGuides.filter(g => getGuideStatus(g) === null);
  const completeCount = completeGuides.filter(g => g.hasGrader).length;
  const needsEvalsGuides = featureGuides.filter(g => getGuideStatus(g) === ProjectStatus.NeedsEvals);
  const contentLandedCount = completeCount + needsEvalsGuides.length;

  const issueIndex = buildUseCaseIssueIndex(params.openUseCaseIssues, params.openFeatureIssues);
  const { openEvalPrs, evalPrSlugs } = resolveEvalPrs(params.openPrs, guideBySlug);

  const readyForEvalSlugs = needsEvalsGuides
    .filter(g => !evalPrSlugs.has(`${g.category}/${g.name}`))
    .map(g => `${g.category}/${g.name}`)
    .sort((a, b) => a.localeCompare(b));

  const needsEvalsTotal = contentLandedCount - completeCount;
  if (openEvalPrs.length + readyForEvalSlugs.length !== needsEvalsTotal) {
    throw new Error(
      `Invariant violation in Needs Evals: openEvalPrs (${openEvalPrs.length}) + readyForEvalSlugs (${readyForEvalSlugs.length}) !== contentLandedCount - completeCount (${needsEvalsTotal})`
    );
  }

  const { needsGuidancePrs, slugsWithContentPr } = resolveNeedsGuidancePrs(
    params.openPrs,
    guideBySlug,
    guideByName,
    issueIndex
  );
  const needsGuidanceIssues = resolveNeedsGuidanceIssues(validGuides, slugsWithContentPr, issueIndex);
  const staleEvals = findStaleEvals(featureGuides, params.gitHistory, params.openExpectationsChangedIssues);
  const { legacyEvals, gen2CompleteCount, dualTargetCompleteCount } = findLegacyFormatGuides(validGuides);

  // Weekly progress history: historical points from git, today's point matches current-state numbers
  const todayLa = getLaDateString(new Date());
  const todayLabel = formatShortDate(todayLa);
  const baseWeekly = params.weeklyProgressPoints ?? fetchWeeklyProgressHistory();
  const firstHistoricalPoint = baseWeekly[0];
  const baseline = params.baselineComplete ?? firstHistoricalPoint?.complete;
  if (baseline === undefined) {
    throw new Error('Cannot determine baseline: weeklyProgressPoints is empty and baselineComplete was not provided');
  }

  const weeklyProgressPoints = [...baseWeekly];
  const todayPoint: WeeklyProgressPoint = {
    date: todayLa,
    label: todayLabel,
    complete: completeCount,
    contentLanded: contentLandedCount,
  };
  if (weeklyProgressPoints.length === 0 || weeklyProgressPoints[weeklyProgressPoints.length - 1].date !== todayLa) {
    weeklyProgressPoints.push(todayPoint);
  } else {
    weeklyProgressPoints[weeklyProgressPoints.length - 1] = todayPoint;
  }

  const progressBar = renderTwoRowProgressBar({
    complete: completeCount,
    openEvalGuides: openEvalPrs.length,
    contentLanded: contentLandedCount,
    openGuideGuides: needsGuidancePrs.length,
    notStartedIssues: needsGuidanceIssues.length,
    staleEvalsCount: staleEvals.length,
    baseline,
    scaleMax: PIPELINE_SCALE_MAX,
  });

  const weeklyChart = renderProgressChart(weeklyProgressPoints);

  const sankey = renderSankeyDiagram({
    complete: completeCount,
    evalPrsInReview: openEvalPrs.length,
    readyForEvals: readyForEvalSlugs.length,
    guidePrsInReview: needsGuidancePrs.length,
    notStarted: needsGuidanceIssues.length,
  });

  const guideCategories = new Set(validGuides.map(g => g.category));

  return {
    completeCount,
    contentLandedCount,
    gen2CompleteCount,
    progressBar,
    weeklyChart,
    sankey,
    needsUseCasesIssues: params.openFeatureIssues.map(issue => ({
      ...issue,
      category: issue.labels.find(l => guideCategories.has(l)) ?? null,
    })),
    needsGuidancePrs,
    needsGuidanceIssues,
    openEvalPrs,
    readyForEvalSlugs,
    readySinceBySlug: params.readySinceBySlug ?? findReadySince(readyForEvalSlugs),
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
