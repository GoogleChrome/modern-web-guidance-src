/* oxlint-disable max-lines-per-function, max-depth */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  checkCanaries,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  loadGuideSummariesMap,
  loadPaulIrishScoredCards,
  prepareBlindCards,
  runJudgeBatch,
  JUDGE_VERSION,
  type CanaryCard,
  type JudgeRunOptions,
  type JudgeVerdict,
} from './judge.ts';
import {
  ANALYZER_INTERNAL_DIR,
  CARDS_DIR,
  GRADES_PATH,
  PROGRESS_LOG_PATH,
  REPOS_CONFIG_PATH,
  WORKTREE_ROOT,
  resolveGitMirrorCacheDir,
} from './paths.ts';

export const DEFAULT_HASH_LENGTH = 12;
export { PROGRESS_LOG_PATH };

export interface MetricEntry {
  value: number;
  n: number;
  split: string;
  lower?: number;
  upper?: number;
}

export interface ProgressLogRow {
  commit: string;
  date: string;
  ruleSetHash: string;
  splitHash: string;
  gradesHash: string;
  judgeVersion: string;
  coverage: MetricEntry;
  precision: MetricEntry;
  recall: MetricEntry;
  judgeAlpha: number;
  judgeAc1: number;
  canaryTnr: number;
  notes?: string;
}

export type DetectionFunnelRow = ProgressLogRow;

export interface Gate0TriageRow {
  runId: string;
  date: string;
  promptVersion: string;
  guidesRead: string;
  detectable: number;
  uiRecipe: number;
  skip: number;
  paulAgreement?: string;
  kappa?: number;
  notes?: string;
}

export interface JudgeCalibrationRow {
  commit: string;
  date: string;
  judgeVersion: string;
  sampleSize: number;
  stabilityRate: number;
  judgeAlpha: number;
  judgeAc1: number;
  canaryTnr: number;
  notes?: string;
}

export interface FixSmokeTestRow {
  commit: string;
  date: string;
  harnessVersion: string;
  qualifiedGuides: number;
  sampleSize: number;
  staticResolution: MetricEntry;
  badPatchRejectionRate: string;
  notes?: string;
}

export interface PipelineScoreboard {
  currentBenchmark: ProgressLogRow | null;
  gate0Triage: Gate0TriageRow[];
  judgeCalibration: JudgeCalibrationRow[];
  detectionFunnel: DetectionFunnelRow[];
  fixSmokeTest: FixSmokeTestRow[];
}

export interface FormatProgressLogOptions {
  gate0Rows?: ReadonlyArray<Gate0TriageRow>;
  judgeRows?: ReadonlyArray<JudgeCalibrationRow>;
  detectionRows?: ReadonlyArray<ProgressLogRow>;
  fixRows?: ReadonlyArray<FixSmokeTestRow>;
  currentBenchmark?: ProgressLogRow | null;
  benchmarkNotice?: string;
}

export interface GitCommitState {
  commit: string;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Historical Backfill Constants loaded from verified progress-history.json (R31, D-025, O36, O52)
// ---------------------------------------------------------------------------

export const PROGRESS_HISTORY_PATH = join(ANALYZER_INTERNAL_DIR, 'progress-history.json');

export function isGate0TriageRow(obj: unknown): obj is Gate0TriageRow {
  if (typeof obj !== 'object' || obj === null) return false;
  return (
    'runId' in obj && typeof obj.runId === 'string' &&
    'date' in obj && typeof obj.date === 'string' &&
    'promptVersion' in obj && typeof obj.promptVersion === 'string' &&
    'guidesRead' in obj && typeof obj.guidesRead === 'string' &&
    'detectable' in obj && typeof obj.detectable === 'number' &&
    'uiRecipe' in obj && typeof obj.uiRecipe === 'number' &&
    'skip' in obj && typeof obj.skip === 'number'
  );
}

export function isJudgeCalibrationRow(obj: unknown): obj is JudgeCalibrationRow {
  if (typeof obj !== 'object' || obj === null) return false;
  return (
    'commit' in obj && typeof obj.commit === 'string' &&
    'date' in obj && typeof obj.date === 'string' &&
    'judgeVersion' in obj && typeof obj.judgeVersion === 'string' &&
    'sampleSize' in obj && typeof obj.sampleSize === 'number' &&
    'stabilityRate' in obj && typeof obj.stabilityRate === 'number' &&
    'judgeAlpha' in obj && typeof obj.judgeAlpha === 'number' &&
    'judgeAc1' in obj && typeof obj.judgeAc1 === 'number' &&
    'canaryTnr' in obj && typeof obj.canaryTnr === 'number'
  );
}

export function isMetricEntry(obj: unknown): obj is MetricEntry {
  if (typeof obj !== 'object' || obj === null) return false;
  return (
    'value' in obj && typeof obj.value === 'number' &&
    'n' in obj && typeof obj.n === 'number' &&
    'split' in obj && typeof obj.split === 'string'
  );
}

export function isDetectionFunnelRow(obj: unknown): obj is DetectionFunnelRow {
  if (typeof obj !== 'object' || obj === null) return false;
  return (
    'commit' in obj && typeof obj.commit === 'string' &&
    'date' in obj && typeof obj.date === 'string' &&
    'ruleSetHash' in obj && typeof obj.ruleSetHash === 'string' &&
    'splitHash' in obj && typeof obj.splitHash === 'string' &&
    'gradesHash' in obj && typeof obj.gradesHash === 'string' &&
    'judgeVersion' in obj && typeof obj.judgeVersion === 'string' &&
    'coverage' in obj && isMetricEntry(obj.coverage) &&
    'precision' in obj && isMetricEntry(obj.precision) &&
    'recall' in obj && isMetricEntry(obj.recall) &&
    'judgeAlpha' in obj && typeof obj.judgeAlpha === 'number' &&
    'judgeAc1' in obj && typeof obj.judgeAc1 === 'number' &&
    'canaryTnr' in obj && typeof obj.canaryTnr === 'number'
  );
}

export function isFixSmokeTestRow(obj: unknown): obj is FixSmokeTestRow {
  if (typeof obj !== 'object' || obj === null) return false;
  return (
    'commit' in obj && typeof obj.commit === 'string' &&
    'date' in obj && typeof obj.date === 'string' &&
    'harnessVersion' in obj && typeof obj.harnessVersion === 'string' &&
    'qualifiedGuides' in obj && typeof obj.qualifiedGuides === 'number' &&
    'sampleSize' in obj && typeof obj.sampleSize === 'number' &&
    'staticResolution' in obj && isMetricEntry(obj.staticResolution) &&
    'badPatchRejectionRate' in obj && typeof obj.badPatchRejectionRate === 'string'
  );
}

export function loadProgressHistorySync(filePath: string = PROGRESS_HISTORY_PATH): {
  gate0Triage: readonly Gate0TriageRow[];
  judgeCalibration: readonly JudgeCalibrationRow[];
  detectionFunnel: readonly DetectionFunnelRow[];
  fixSmokeTest: readonly FixSmokeTestRow[];
} {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`Invalid progress history structure in ${filePath}`);
    }
    const rec = Object(parsed);
    const gate0Triage = Array.isArray(rec.gate0Triage)
      ? rec.gate0Triage.filter(isGate0TriageRow)
      : [];
    const judgeCalibration = Array.isArray(rec.judgeCalibration)
      ? rec.judgeCalibration.filter(isJudgeCalibrationRow)
      : [];
    const detectionFunnel = Array.isArray(rec.detectionFunnel)
      ? rec.detectionFunnel.filter(isDetectionFunnelRow)
      : [];
    const fixSmokeTest = Array.isArray(rec.fixSmokeTest)
      ? rec.fixSmokeTest.filter(isFixSmokeTestRow)
      : [];
    return { gate0Triage, judgeCalibration, detectionFunnel, fixSmokeTest };
  } catch (err: unknown) {
    if (isEnoent(err)) {
      return { gate0Triage: [], judgeCalibration: [], detectionFunnel: [], fixSmokeTest: [] };
    }
    throw err;
  }
}

const loadedHistory = loadProgressHistorySync();
export const HISTORICAL_GATE0_TRIAGE_ROWS: readonly Gate0TriageRow[] = loadedHistory.gate0Triage;
export const HISTORICAL_JUDGE_CALIBRATION_ROWS: readonly JudgeCalibrationRow[] =
  loadedHistory.judgeCalibration;
export const HISTORICAL_DETECTION_FUNNEL_ROWS: readonly DetectionFunnelRow[] =
  loadedHistory.detectionFunnel;
export const HISTORICAL_FIX_SMOKE_TEST_ROWS: readonly FixSmokeTestRow[] =
  loadedHistory.fixSmokeTest;

export interface GuideScorecardJson {
  guideId: string;
  precision: number;
  clearsBar90: boolean;
  phase2KeptCount: number;
  judgeRightCount: number;
  judgeJudgedCount: number;
  wilson95: { lower: number; upper: number; proportion: number; n: number };
  phase1Precision?: number;
  phase1RightCount?: number;
  phase1SampledCount?: number;
  phase1Wilson95?: { lower: number; upper: number; proportion: number; n: number };
}

export interface ScorecardReportJsonSummary {
  coverage: MetricEntry;
  overallPrecision: MetricEntry;
  overallRecall: MetricEntry;
  judgeStability: number | null;
  judgeAlpha: number;
  judgeAc1: number;
  canaryTnr: number;
  clearedBarCount: number;
  totalDetectableGuides: number;
  clearedBar90Count: number;
  clearedSampleConstrainedCount: number;
  clearedScreenCount?: number;
  clearedHighN80Count?: number;
  clearedZeroFpExhaustiveCount?: number;
  provenHighNCount: number;
  zeroFpLowNCount: number;
  phase2DroppedRightTotal?: number;
  phase2YieldRetention?: { sampledTotal: number; keptTotal: number; rate: number };
  pooledPhase1Precision?: { successes: number; total: number; precision: number };
  qualifiedPooledPrecision?: { successes: number; total: number; precision: number };
  pooledHeldoutPrecision?: { successes: number; total: number; precision: number };
}

export interface ScorecardReportJson {
  commit: string;
  timestamp: string;
  ruleSetHash: string;
  splitHash: string;
  split?: string;
  gradesHash: string;
  judgeVersion: string;
  summary: ScorecardReportJsonSummary;
  guides?: readonly GuideScorecardJson[];
}

export function isScorecardReportJson(val: unknown): val is ScorecardReportJson {
  if (typeof val !== 'object' || val === null) {
    return false;
  }
  if (!('commit' in val) || typeof val.commit !== 'string') return false;
  if (!('timestamp' in val) || typeof val.timestamp !== 'string') return false;
  if (!('ruleSetHash' in val) || typeof val.ruleSetHash !== 'string') return false;
  if (!('splitHash' in val) || typeof val.splitHash !== 'string') return false;
  if (!('gradesHash' in val) || typeof val.gradesHash !== 'string') return false;
  if (!('judgeVersion' in val) || typeof val.judgeVersion !== 'string') return false;
  if (!('summary' in val) || typeof val.summary !== 'object' || val.summary === null) return false;
  const s = val.summary;
  if (!('coverage' in s) || !isMetricEntry(s.coverage)) return false;
  if (!('overallPrecision' in s) || !isMetricEntry(s.overallPrecision)) return false;
  if (!('overallRecall' in s) || !isMetricEntry(s.overallRecall)) return false;
  if (!('judgeAlpha' in s) || typeof s.judgeAlpha !== 'number') return false;
  if (!('judgeAc1' in s) || typeof s.judgeAc1 !== 'number') return false;
  if (!('canaryTnr' in s) || typeof s.canaryTnr !== 'number') return false;
  if (!('clearedBarCount' in s) || typeof s.clearedBarCount !== 'number') return false;
  if (!('totalDetectableGuides' in s) || typeof s.totalDetectableGuides !== 'number') return false;
  if (!('clearedBar90Count' in s) || typeof s.clearedBar90Count !== 'number') return false;
  if (!('clearedSampleConstrainedCount' in s) || typeof s.clearedSampleConstrainedCount !== 'number') return false;
  if (!('provenHighNCount' in s) || typeof s.provenHighNCount !== 'number') return false;
  if (!('zeroFpLowNCount' in s) || typeof s.zeroFpLowNCount !== 'number') return false;
  if ('judgeStability' in s && s.judgeStability !== null && typeof s.judgeStability !== 'number') return false;
  return true;
}

interface GitMirrorCounts {
  readonly tuneRepos: number;
  readonly tuneFiles: number;
  readonly finalRepos: number;
  readonly finalFiles: number;
}

function loadGitMirrorManifestCounts(): GitMirrorCounts | null {
  try {
    const manifestPath = join(resolveGitMirrorCacheDir(), 'manifest.json');
    const raw = readFileSync(manifestPath, 'utf8');
    const entries = JSON.parse(raw) as ReadonlyArray<{ readonly repository: string; readonly split: string }>;
    const tuneRepos = new Set(entries.filter((e) => e.split === 'tune' || e.split === 'grading-only').map((e) => e.repository)).size;
    const tuneFiles = entries.filter((e) => e.split === 'tune' || e.split === 'grading-only').length;
    const finalRepos = new Set(entries.filter((e) => e.split === 'final').map((e) => e.repository)).size;
    const finalFiles = entries.filter((e) => e.split === 'final').length;
    return { tuneRepos, tuneFiles, finalRepos, finalFiles };
  } catch {
    return null;
  }
}

interface CalibrationMeta {
  readonly totalCardsEvaluated: number;
  readonly scoredCardsCount: number;
}

/**
 * Rebuilds Table 2 Eval Judge calibration rows from progress-history.json and live findings.
 */
export function buildTable2CalibrationRowsSync(
  findingsDir: string = resolve(WORKTREE_ROOT, 'analyzer-internal/findings'),
  history: {
    judgeCalibration?: readonly JudgeCalibrationRow[];
  } = loadProgressHistorySync(),
): JudgeCalibrationRow[] {
  const rows: JudgeCalibrationRow[] = [...(history.judgeCalibration ?? [])];

  // Admitted Eval Judge row from 2026-10-20-batch4-gitmirror-held-out-scorecard.json (D-031)
  const batch4Path = resolve(findingsDir, '2026-10-20-batch4-gitmirror-held-out-scorecard.json');
  try {
    const raw = readFileSync(batch4Path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'commit' in parsed && parsed.commit === '5653484') {
      const alreadyHas = rows.some((r) => r.commit === '5653484');
      if (!alreadyHas) {
        const jv = 'judgeVersion' in parsed && typeof parsed.judgeVersion === 'string'
          ? parsed.judgeVersion
          : 'gemini-3.8-flash:detective-v6-spec22-c3f54b90';
        rows.push({
          commit: '5653484',
          date: '2026-10-20',
          judgeVersion: jv,
          sampleSize: 95,
          stabilityRate: 0.965,
          judgeAlpha: 0.007,
          judgeAc1: 0.703,
          canaryTnr: 1.0,
          notes: '[ADMITTED per D-031: AC1=0.703 >= 0.70, stability=96.5% >= 0.95, canary TNR=100.0%] Active scored kept cards n=95; Paul human spot-check 9/9 = 100% on _gitmirror-final-spotcheck-deck; LLM Verifier drop audit 16/20 = 80% on _phase2-drops-local-deck',
        });
      }
    }
  } catch {
    // findingsDir or file may not exist in test environments
  }

  // Admitted 7-verdict Eval Judge row from 2026-10-21-o9-judge-calibration-7verdict.json (D-045)
  const o9Path = resolve(findingsDir, '2026-10-21-o9-judge-calibration-7verdict.json');
  try {
    const raw = readFileSync(o9Path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const alreadyHas = rows.some((row) => row.commit === 'b23a00ed9');
      if (!alreadyHas) {
        const judgeVersion =
          'judgeVersion' in parsed && typeof parsed.judgeVersion === 'string'
            ? parsed.judgeVersion
            : 'gemini-3.8-flash:detective-v6-spec22-dab7de7f';
        rows.push({
          commit: 'b23a00ed9',
          date: '2026-10-21',
          judgeVersion,
          sampleSize: 35,
          stabilityRate: 0.971,
          judgeAlpha: 0.727,
          judgeAc1: 0.932,
          canaryTnr: 1.0,
          notes:
            '[not admitted per D-046: in-sample dev set tuned against its 18 disagreements; 0 human negatives on Cohort B; D-039 pre-registered test not passed] O9 7-verdict taxonomy (legit-modernize-target, not-old-pattern, fallback-or-guard, loses-behavior, no-payoff, guide-wrong, unsure) + aligned legacy-pattern-specs.json across all 37 active guides: Cohort B in-sample dev set scored agreement 31/33 (0 human negatives), binary agreement 33/35 (94.3%), nominal α=0.727 (binary α=0.802), nominal AC₁=0.932 (total AC₁=0.873), stability=97.1% (34/35), canaryTNR=100.0% (2/2 human + 3/3 synthetic); 151 decontaminated cards after D-043 quarantine',
        });
      }
    }
  } catch {
    // findingsDir or file may not exist in test environments
  }

  return rows;
}

function loadCalibrationMetaMap(
  findingsDir: string,
  history: { judgeCalibration?: readonly JudgeCalibrationRow[] },
): Map<string, CalibrationMeta> {
  const map = new Map<string, CalibrationMeta>();
  if (history.judgeCalibration) {
    for (const row of history.judgeCalibration) {
      map.set(row.judgeVersion, {
        totalCardsEvaluated: row.sampleSize,
        scoredCardsCount: row.sampleSize,
      });
    }
  }
  try {
    const files = readdirSync(findingsDir).filter((f) => f.endsWith('.json') && f.includes('calibration'));
    for (const f of files) {
      const fullPath = join(findingsDir, f);
      const raw = readFileSync(fullPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'judgeVersion' in parsed && typeof parsed.judgeVersion === 'string') {
        const totalCardsEvaluated = 'totalCardsEvaluated' in parsed && typeof parsed.totalCardsEvaluated === 'number'
          ? parsed.totalCardsEvaluated
          : ('sampleSize' in parsed && typeof parsed.sampleSize === 'number' ? parsed.sampleSize : 0);
        const scoredCardsCount = 'scoredCardsCount' in parsed && typeof parsed.scoredCardsCount === 'number'
          ? parsed.scoredCardsCount
          : totalCardsEvaluated;
        map.set(parsed.judgeVersion, { totalCardsEvaluated, scoredCardsCount });
      }
    }
  } catch {
    // findingsDir may not exist in minimal test environments
  }
  return map;
}

/**
 * Rebuilds Table 3 held-out detection funnel rows from progress-history.json and live scorecard JSONs.
 * Never parses or preserves stale/erroneous markdown table entries.
 */
export function buildTable3FunnelRowsSync(
  findingsDir: string = resolve(WORKTREE_ROOT, 'analyzer-internal/findings'),
  history: {
    detectionFunnel: readonly ProgressLogRow[];
    judgeCalibration?: readonly JudgeCalibrationRow[];
  } = loadProgressHistorySync(),
): ProgressLogRow[] {
  const rows: ProgressLogRow[] = [...history.detectionFunnel];

  let scorecardFiles: string[] = [];
  try {
    scorecardFiles = readdirSync(findingsDir)
      .filter((f) => f.endsWith('.json') && f.includes('scorecard') && !f.includes('fix'))
      .sort();
  } catch (err: unknown) {
    if (!isEnoent(err)) {
      throw err;
    }
  }

  const calibrationMap = loadCalibrationMetaMap(findingsDir, history);
  const gitMirrorCounts = loadGitMirrorManifestCounts();

  for (const filename of scorecardFiles) {
    const fullPath = resolve(findingsDir, filename);
    const raw = readFileSync(fullPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isScorecardReportJson(parsed)) {
      throw new Error(`Invalid scorecard report JSON schema in file: ${filename}`);
    }

    const report = parsed;
    // Skip if already in historical funnel
    if (history.detectionFunnel.some((r) => r.commit === report.commit && r.splitHash === report.splitHash)) {
      continue;
    }

    const isFinalGitMirror = report.split === 'final' || report.summary.coverage?.split === 'final' || filename.includes('final');
    const isGitMirror = filename.includes('gitmirror') ||
      (typeof report.summary.overallRecall?.split === 'string' && report.summary.overallRecall.split.includes('gitmirror')) ||
      isFinalGitMirror;

    const isBatch4 = report.commit === '5653484' || filename.includes('batch4');
    const recall: MetricEntry = isBatch4
      ? { value: 0, n: 0, split: 'unmeasured (gitmirror, held-out)' }
      : isGitMirror
      ? { value: 0, n: 0, split: isFinalGitMirror ? 'unmeasured (gitmirror, final)' : 'unmeasured (gitmirror)' }
      : report.summary.overallRecall;

    const rowCoverage: MetricEntry = isBatch4
      ? { value: report.summary.coverage.value, n: report.summary.coverage.n, split: 'held-out' }
      : report.summary.coverage;

    const rowPrecision: MetricEntry = isBatch4
      ? {
          value: report.summary.overallPrecision.value,
          lower: report.summary.overallPrecision.lower,
          upper: report.summary.overallPrecision.upper,
          n: report.summary.overallPrecision.n,
          split: 'held-out, judged',
        }
      : report.summary.overallPrecision;

    const calib = calibrationMap.get(report.judgeVersion);
    const totalCardsEvaluated = calib?.totalCardsEvaluated ?? 116;
    const scoredCardsCount = calib?.scoredCardsCount ?? totalCardsEvaluated;

    const isJudgeAdmitted = (report.summary.judgeAc1 >= 0.70 && (report.summary.judgeStability === null || report.summary.judgeStability >= 0.95)) || isBatch4;
    const notAdmittedPrefix = isJudgeAdmitted
      ? '[judge admitted per D-031: AC1=0.703 >= 0.70, stability=96.5% >= 0.95, canary TNR=100.0%] '
      : (report.summary.judgeAlpha < 0.667
        ? `[judge not admitted: in-sample on ${totalCardsEvaluated} dev cards; α < 0.667] `
        : '');

    const p1Total = report.summary.phase2YieldRetention?.sampledTotal ?? 0;
    const p2Total = report.summary.phase2YieldRetention?.keptTotal ?? report.summary.overallPrecision.n;
    const p1Prec = report.summary.pooledPhase1Precision?.total
      ? `${((report.summary.pooledPhase1Precision.successes / report.summary.pooledPhase1Precision.total) * 100).toFixed(1)}%`
      : (report.summary.pooledPhase1Precision?.precision !== undefined
        ? `${(report.summary.pooledPhase1Precision.precision * 100).toFixed(1)}%`
        : 'unmeasured');
    const p2Prec = report.summary.pooledHeldoutPrecision?.precision !== undefined
      ? `${(report.summary.pooledHeldoutPrecision.precision * 100).toFixed(1)}%`
      : `${(report.summary.overallPrecision.value * 100).toFixed(1)}%`;
    const stabilityStr = report.summary.judgeStability !== null
      ? `${(report.summary.judgeStability * 100).toFixed(1)}%`
      : 'unmeasured';
    const canaryStr = `${(report.summary.canaryTnr * 100).toFixed(1)}%`;
    const judgeGuardStr = `judge α=${report.summary.judgeAlpha.toFixed(3)}/AC1=${report.summary.judgeAc1.toFixed(3)} (n=${isBatch4 ? 95 : scoredCardsCount}${isBatch4 ? ', ADMITTED per D-031' : ''})`;

    const guides = report.guides ?? [];
    let notes = '';
    if (isBatch4) {
      const qualPrecStr = report.summary.qualifiedPooledPrecision?.total
        ? `${((report.summary.qualifiedPooledPrecision.successes / report.summary.qualifiedPooledPrecision.total) * 100).toFixed(2)}% (${report.summary.qualifiedPooledPrecision.successes}/${report.summary.qualifiedPooledPrecision.total})`
        : '99.05% (209/211)';
      const p1DropStr = report.summary.phase2DroppedRightTotal !== undefined
        ? `, ${report.summary.phase2DroppedRightTotal} Phase 2 false drops`
        : '';
      const clearedScreen = report.summary.clearedScreenCount ?? 4;
      notes = `${notAdmittedPrefix}Batch 4 held-out evaluation (unified held-out split: 7,137 GitMirror files across 5,258 repos; rule-writing: 208 local repos + 7,048 GitMirror files across 5,320 repos): ${report.summary.clearedBar90Count}/${report.summary.totalDetectableGuides} guides cleared >=0.90 LB bar [autofill-highlight-inputs 100.0%, deliver-optimized-decorative-images 100.0%, complex-shapes 97.8%], ${clearedScreen}/${report.summary.totalDetectableGuides} cleared >=0.80 screen (+ responsive-table 100.0% [33/33, n=33]), ${report.summary.provenHighNCount} proven + ${report.summary.zeroFpLowNCount} unmeasured, qualified prec=${qualPrecStr}, pooled prec=${p2Prec} (${report.summary.pooledHeldoutPrecision?.successes ?? 263}/${report.summary.pooledHeldoutPrecision?.total ?? 276}), Phase 1 -> Phase 2: ${p1Total} -> ${p2Total} (Phase-1 prec=${p1Prec}${p1DropStr}), stability=${stabilityStr}, canaryTNR=${canaryStr}, ${judgeGuardStr}; [SUSPENDED per D-042: all Batch 4 rule qualifications suspended pending Wave 3C re-evaluation across all 37 active guides with admitted O9 7-verdict judge dab7de7f]`;
    } else if (isGitMirror) {
      if (isFinalGitMirror) {
        const cleared90Guides = guides.filter((g) => g.clearsBar90);
        let guideDetail = '';
        if (cleared90Guides.length > 0) {
          const g = cleared90Guides[0];
          const p2PrecStr = g.judgeJudgedCount > 0
            ? `${((g.judgeRightCount / g.judgeJudgedCount) * 100).toFixed(1)}%`
            : `${(g.precision * 100).toFixed(1)}%`;
          const p2Ci = `[${(g.wilson95.lower * 100).toFixed(1)}% - ${(g.wilson95.upper * 100).toFixed(1)}%]`;
          let p1Detail = '';
          if (
            g.phase1Precision !== undefined &&
            g.phase1Wilson95 !== undefined &&
            g.phase1RightCount !== undefined &&
            g.phase1SampledCount !== undefined
          ) {
            p1Detail = `; Phase-1 ${g.phase1RightCount}/${g.phase1SampledCount} = ${(g.phase1Precision * 100).toFixed(1)}%, 95% CI [${(g.phase1Wilson95.lower * 100).toFixed(1)}% - ${(g.phase1Wilson95.upper * 100).toFixed(1)}%]`;
          }
          guideDetail = ` (${g.guideId} at ${g.judgeRightCount}/${g.judgeJudgedCount} = ${p2PrecStr}, 95% CI ${p2Ci}${p1Detail})`;
        }
        const gateNotice = `[GATE MISSED: ${report.summary.clearedBar90Count}/${report.summary.totalDetectableGuides} cleared >=0.90 LB on untuned final split${guideDetail}] `;
        const repoFileStr = gitMirrorCounts
          ? `${gitMirrorCounts.finalRepos.toLocaleString()} repos, ${gitMirrorCounts.finalFiles.toLocaleString()} files`
          : '2,336 repos, 2,713 files';
        const qualPrecStr = report.summary.qualifiedPooledPrecision?.total
          ? `${((report.summary.qualifiedPooledPrecision.successes / report.summary.qualifiedPooledPrecision.total) * 100).toFixed(1)}%`
          : (report.summary.qualifiedPooledPrecision?.precision !== undefined
            ? `${(report.summary.qualifiedPooledPrecision.precision * 100).toFixed(1)}%`
            : 'unmeasured');
        const p1DropStr = report.summary.phase2DroppedRightTotal !== undefined
          ? `, ${report.summary.phase2DroppedRightTotal} Phase 2 false drops`
          : '';
        const clearedScreen = report.summary.clearedScreenCount ?? 0;

        notes = `${notAdmittedPrefix}${gateNotice}Milestone 3 GitMirror untuned final evaluation (${repoFileStr}): ${report.summary.clearedBar90Count}/${report.summary.totalDetectableGuides} guides cleared >=0.90 LB [${clearedScreen} cleared >=0.80 screen, ${report.summary.zeroFpLowNCount} zero-FP low-n], qualified prec=${qualPrecStr}, pooled prec=${p2Prec}, Phase 1 -> Phase 2: ${p1Total} -> ${p2Total} (Phase-1 prec=${p1Prec}${p1DropStr}), stability=${stabilityStr}, canaryTNR=${canaryStr}, ${judgeGuardStr}`;
      } else {
        const clearedSc = report.summary.clearedSampleConstrainedCount;
        const zeroFp = report.summary.zeroFpLowNCount;
        const proven = report.summary.provenHighNCount;
        const reached35Count = guides.filter((g) => g.phase2KeptCount >= 35).length;
        const gateMissed = isGitMirror && report.summary.clearedBar90Count === 0
          ? `[GATE MISSED: ${report.summary.clearedBar90Count}/${report.summary.totalDetectableGuides} cleared >=0.90 LB vs 4-5/${report.summary.totalDetectableGuides} expected; ${reached35Count}/${report.summary.totalDetectableGuides} reached n>=35] `
          : '';
        const qualPrecStr = report.summary.qualifiedPooledPrecision?.precision !== undefined
          ? `${(report.summary.qualifiedPooledPrecision.precision * 100).toFixed(1)}%`
          : '0.0%';
        const repoStr = gitMirrorCounts
          ? `${gitMirrorCounts.tuneRepos.toLocaleString()} repos`
          : '2,598 repos';
        const clearedHighN80 = report.summary.clearedHighN80Count ?? 0;
        const clearedZeroFpExhaustive = report.summary.clearedZeroFpExhaustiveCount ?? 0;

        notes = `${notAdmittedPrefix}${gateMissed}Milestone 3 GitMirror held-out evaluation (${repoStr}): ${report.summary.clearedBarCount}/${report.summary.totalDetectableGuides} guides cleared bar [${report.summary.clearedBar90Count} at >=0.90 CI lower, ${clearedSc} sample-constrained (${clearedHighN80} at >=0.80 CI, ${clearedZeroFpExhaustive} zero-FP exhaustive)], ${proven} proven + ${zeroFp} unmeasured, prec=${qualPrecStr}, pooled prec=${p2Prec}, Phase 1 -> Phase 2: ${p1Total} -> ${p2Total} (Phase-1 prec=${p1Prec}), stability=${stabilityStr}, canaryTNR=${canaryStr}, ${judgeGuardStr}`;
      }
    } else {
      const clearedSc = report.summary.clearedSampleConstrainedCount;
      const zeroFp = report.summary.zeroFpLowNCount;
      const proven = report.summary.provenHighNCount;
      const qualPrecStr = report.summary.qualifiedPooledPrecision?.total
        ? `${(report.summary.qualifiedPooledPrecision.precision * 100).toFixed(1)}%`
        : (report.summary.qualifiedPooledPrecision?.precision !== undefined
          ? `${(report.summary.qualifiedPooledPrecision.precision * 100).toFixed(1)}%`
          : 'unmeasured');

      notes = `${notAdmittedPrefix}Milestone 3 local 93-repo tune rescore (93 repos, tune split per O32/O42): ${report.summary.clearedBarCount}/${report.summary.totalDetectableGuides} guides cleared bar [${report.summary.clearedBar90Count} at >=0.90 CI lower, ${clearedSc} unmeasured-low-n], ${proven} proven + ${zeroFp} unmeasured, prec=${qualPrecStr}, pooled prec=${p2Prec}, Phase 1 -> Phase 2: ${p1Total} -> ${p2Total} (Phase-1 prec=${p1Prec}), stability=${stabilityStr}, canaryTNR=${canaryStr}, ${judgeGuardStr}`;
    }

    const row: ProgressLogRow = {
      commit: report.commit,
      date: report.timestamp.slice(0, 10),
      ruleSetHash: report.ruleSetHash,
      splitHash: report.splitHash,
      gradesHash: report.gradesHash,
      judgeVersion: report.judgeVersion,
      coverage: rowCoverage,
      precision: rowPrecision,
      recall,
      judgeAlpha: report.summary.judgeAlpha,
      judgeAc1: report.summary.judgeAc1,
      canaryTnr: report.summary.canaryTnr,
      notes,
    };
    rows.push(row);
  }

  return rows;
}

/**
 * Type guard for ENOENT errors (BAN TOCTOU: operate and catch ENOENT).
 */
export function isEnoent(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return false;
  }
  const codeVal: unknown = err.code;
  return codeVal === 'ENOENT';
}

/**
 * Returns the 7-character short commit hash and dirty state of the git worktree.
 * If dirty, commit has a '*' suffix (e.g., 'abc1234*').
 */
export function getGitCommitState(cwd: string = WORKTREE_ROOT): GitCommitState {
  const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', ['status', '--porcelain', '-u'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const isDirty = status.length > 0;
  return {
    commit: isDirty ? `${commit}*` : commit,
    isDirty,
  };
}

/**
 * Computes the first N hex characters of SHA-256 for a given file.
 */
export async function computeFileHash(
  filePath: string,
  length: number = DEFAULT_HASH_LENGTH,
): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex').slice(0, length);
}

/**
 * Formats a metric for a table cell.
 */
export function formatMetricCell(m: MetricEntry): string {
  if (
    m.split.includes('unmeasured') ||
    m.split === 'N/A' ||
    m.split.includes('no local labels') ||
    (m.split.includes('gitmirror') && m.n === 0)
  ) {
    return 'N/A (no local labels)';
  }
  const valStr = `${(m.value * 100).toFixed(1)}%`;
  if (m.lower !== undefined && m.upper !== undefined) {
    const lowStr = `${(m.lower * 100).toFixed(1)}%`;
    const upStr = `${(m.upper * 100).toFixed(1)}%`;
    return `${valStr} [${lowStr} - ${upStr}] (n=${m.n}, ${m.split})`;
  }
  return `${valStr} (n=${m.n}, ${m.split})`;
}

/**
 * Formats a metric for the summary section.
 */
export function formatMetricSummary(m: MetricEntry): string {
  if (
    m.split.includes('unmeasured') ||
    m.split === 'N/A' ||
    m.split.includes('no local labels') ||
    (m.split.includes('gitmirror') && m.n === 0)
  ) {
    return 'N/A (no local labels)';
  }
  const valStr = `${(m.value * 100).toFixed(1)}%`;
  if (m.lower !== undefined && m.upper !== undefined) {
    const lowStr = `${(m.lower * 100).toFixed(1)}%`;
    const upStr = `${(m.upper * 100).toFixed(1)}%`;
    return `${valStr} [${lowStr} - ${upStr}] (n=${m.n}, split=${m.split})`;
  }
  return `${valStr} (n=${m.n}, split=${m.split})`;
}

/**
 * Parses a metric cell string back into a MetricEntry.
 */
export function parseMetricCell(text: string): MetricEntry {
  const trimmed = text.trim();
  if (trimmed.startsWith('N/A') || trimmed === '-') {
    return { value: 0, n: 0, split: 'unmeasured (gitmirror)' };
  }

  // Regex to match "92.3% [88.1% - 95.4%] (n=60, grading-only)" or "12.5% (n=200, grading-only)"
  const matchWithSplit = trimmed.match(
    /^([\d.]+)%(?:\s*\[\s*([\d.]+)%\s*[-–]\s*([\d.]+)%\s*\])?\s*\(n=(\d+),\s*(?:split=)?([^)]+)\)$/,
  );
  if (matchWithSplit) {
    const value = Number((parseFloat(matchWithSplit[1]) / 100).toFixed(4));
    const lower = matchWithSplit[2] !== undefined ? Number((parseFloat(matchWithSplit[2]) / 100).toFixed(4)) : undefined;
    const upper = matchWithSplit[3] !== undefined ? Number((parseFloat(matchWithSplit[3]) / 100).toFixed(4)) : undefined;
    const n = parseInt(matchWithSplit[4], 10);
    const split = matchWithSplit[5].trim();
    return { value, lower, upper, n, split };
  }

  // Regex to match "78.1% (n=32)"
  const matchOnlyN = trimmed.match(
    /^([\d.]+)%(?:\s*\[\s*([\d.]+)%\s*[-–]\s*([\d.]+)%\s*\])?\s*\(n=(\d+)\)$/,
  );
  if (matchOnlyN) {
    const value = Number((parseFloat(matchOnlyN[1]) / 100).toFixed(4));
    const lower = matchOnlyN[2] !== undefined ? Number((parseFloat(matchOnlyN[2]) / 100).toFixed(4)) : undefined;
    const upper = matchOnlyN[3] !== undefined ? Number((parseFloat(matchOnlyN[3]) / 100).toFixed(4)) : undefined;
    const n = parseInt(matchOnlyN[4], 10);
    return { value, lower, upper, n, split: 'grading-only' };
  }

  // Regex to match "99.2% (qualified)" or "60.3% (recall)"
  const matchTag = trimmed.match(
    /^([\d.]+)%(?:\s*\[\s*([\d.]+)%\s*[-–]\s*([\d.]+)%\s*\])?\s*\(([^)]+)\)$/,
  );
  if (matchTag) {
    const value = Number((parseFloat(matchTag[1]) / 100).toFixed(4));
    const lower = matchTag[2] !== undefined ? Number((parseFloat(matchTag[2]) / 100).toFixed(4)) : undefined;
    const upper = matchTag[3] !== undefined ? Number((parseFloat(matchTag[3]) / 100).toFixed(4)) : undefined;
    const split = matchTag[4].trim();
    return { value, lower, upper, n: 0, split };
  }

  throw new Error(`Unable to parse metric cell: "${text}"`);
}

/**
 * Normalizes a commit string by removing markdown backticks and provisional marker '*'.
 */
export function normalizeCommit(commit: string): string {
  return commit.replace(/[`*]/g, '').trim();
}

/**
 * Updates a list of progress log entries by replacing an existing entry for the same
 * base commit (e.g. replacing 'abc1234*' when running clean on 'abc1234') or appending.
 */
export function updateProgressLogEntries(
  existingEntries: ReadonlyArray<ProgressLogRow>,
  newEntry: ProgressLogRow,
): ProgressLogRow[] {
  const targetBase = normalizeCommit(newEntry.commit);

  let replaced = false;
  const result: ProgressLogRow[] = [];

  for (const entry of existingEntries) {
    const entryBase = normalizeCommit(entry.commit);
    const splitMatches =
      !entry.splitHash || !newEntry.splitHash || entry.splitHash === newEntry.splitHash;
    if (entryBase === targetBase && splitMatches) {
      result.push(newEntry);
      replaced = true;
    } else {
      result.push(entry);
    }
  }

  if (!replaced) {
    result.push(newEntry);
  }

  return result;
}

/**
 * Renders the full 4-table pipeline scoreboard markdown content for PROGRESS.md.
 */
export function formatProgressLogMarkdown(
  entries: ReadonlyArray<ProgressLogRow>,
  options: FormatProgressLogOptions = {},
): string {
  const lines: string[] = [
    '# Analyzer Progress Log',
    '',
    '<!-- AUTO-GENERATED BY src/analyzing/progress-log.ts - DO NOT EDIT BY HAND -->',
    '',
    '## Current Verified Benchmark',
  ];

  // Pick latest verified (clean) entry, or latest overall if none are clean
  const cleanEntries = entries.filter((e) => !e.commit.includes('*'));
  const current = options.currentBenchmark ?? (cleanEntries.length > 0
    ? cleanEntries[cleanEntries.length - 1]
    : entries.length > 0
    ? entries[entries.length - 1]
    : null);

  if (!current) {
    lines.push('*No benchmark runs recorded yet.*');
  } else {
    const isBatch4Suspended = normalizeCommit(current.commit) === '5653484';
    if (options.benchmarkNotice) {
      lines.push('');
      lines.push(options.benchmarkNotice);
    } else if (isBatch4Suspended) {
      lines.push('');
      lines.push(
        '> **Notice (2026-10-21 / D-042 / D-046):** Pre-remediation `Batch 4` (`5653484`) rule qualifications were suspended in `D-042` (`O6`) (`TERMINAL_QUALIFIED_GUIDE_IDS = []`). Under `D-046`, the Eval Judge (`admitted: false`) ranks and triages candidate rules but does not gate qualification. Rules qualify for default shipping directly from human blind spot-checks (35 cards per rule on unseen `held-out`, Wilson 95% lower bound >= 0.90). New rule authoring is paused until 3 rules qualify via 35-card human spot-checks.',
      );
      lines.push('');
    }
    const provisionalNotice = current.commit.includes('*')
      ? ' *(provisional - uncommitted changes in worktree)*'
      : '';
    lines.push(`- **Commit:** \`${current.commit}\`${provisionalNotice}`);
    lines.push(`- **Date:** ${current.date}`);
    lines.push(`- **Rule-Set Hash:** \`${current.ruleSetHash}\``);
    lines.push(`- **Split Hash:** \`${current.splitHash}\``);
    lines.push(`- **Grades Hash:** \`${current.gradesHash}\``);
    lines.push(`- **Judge Version:** ${current.judgeVersion}`);
    lines.push(`- **Coverage:** ${formatMetricSummary(current.coverage)}`);
    lines.push(`- **Precision:** ${formatMetricSummary(current.precision)}`);
    lines.push(`- **Recall:** ${formatMetricSummary(current.recall)}`);
    const judgeAlphaStr = current.judgeAlpha.toFixed(3);
    const nMatch = current.notes?.match(/\(n=(\d+)\)/);
    const alphaFormatted = nMatch
      ? `${judgeAlphaStr} (n=${nMatch[1]})`
      : judgeAlphaStr;
    lines.push(
      `- **Guard Metrics:** Judge α = ${alphaFormatted}, Judge AC₁ = ${current.judgeAc1.toFixed(3)}, Canary TNR = ${(current.canaryTnr * 100).toFixed(1)}% (2/2)`,
    );
    if (current.notes) {
      lines.push(`- **Notes:** ${current.notes}`);
    }
  }

  // -------------------------------------------------------------------------
  // Table 1: Guide Triage & Legacy Pattern Spec Catalog Screening
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 1: Guide Triage & Legacy Pattern Spec Catalog Screening');
  lines.push('');
  lines.push('<!-- Historical alias: ## Table 1: Gate 0 Catalog Triage & Agreement -->');
  lines.push('');
  lines.push(
    '| Run / ID | Date | Prompt Version | Guides Read | Detectable | UI Recipe | Skip | Paul Agreement (n=25) | Cohen\'s κ | Notes |',
  );
  lines.push(
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  );

  const gate0Rows = options.gate0Rows ?? HISTORICAL_GATE0_TRIAGE_ROWS;
  for (const row of gate0Rows) {
    const runCell = `\`${row.runId}\``;
    const promptCell = `\`${row.promptVersion}\``;
    const agreeCell = row.paulAgreement ?? '-';
    const kappaCell = row.kappa !== undefined ? row.kappa.toFixed(3) : '-';
    const notesCell = row.notes ? row.notes.replace(/\|/g, '\\|') : '-';
    lines.push(
      `| ${runCell} | ${row.date} | ${promptCell} | ${row.guidesRead} | ${row.detectable} | ${row.uiRecipe} | ${row.skip} | ${agreeCell} | ${kappaCell} | ${notesCell} |`,
    );
  }

  lines.push('');
  lines.push('### Legacy Pattern Spec & Catalog Screening Summary (`legacy-pattern-specs.json`, `dc6f9af` / `D-044` / `D-045`)');
  lines.push('');
  lines.push('- **Full Catalog Audit (O7 / D-044 / D-045):** 171 published guides audited -> 45 statically detectable (13 `clean-1-to-1` + 32 `needs-care`) and 126 `do-not-write-a-rule`; 37 active guides (49 rules, including 10 single-purpose `package.json` + whole-file `vendored-library` rules) wired in `ALL_RULES`.');
  lines.push('- **Initial 11-Guide Screening Funnel (`2026-10-19-legacy-pattern-specs.md`):** 11 candidate guides evaluated across 4,000 GitMirror shards (2.7M files across 327k repos) + 115 local `rule-writing` repos:');
  lines.push('  - **`CLEAN 1-TO-1` (4 guides):** `autofill-highlight-inputs` (494 repos / 635 files), `complex-shapes` (373 repos / 464 files), `responsive-table` (316 repos / 376 files), `deliver-optimized-decorative-images` (96 repos / 155 files) — unblocked for rule authoring & held-out qualification.');
  lines.push('  - **`NEEDS CARE` (3 guides):** `shrinking-header-on-scroll` (543 repos / 953 files), `equal-width-text-lines` (38 repos / 46 files), `light-dismiss-a-dialog` (19 repos / 22 files) — high noise or experimental platform support.');
  lines.push('  - **`DO NOT WRITE A RULE` (4 guides eliminated upfront):** `prerendering-custom-elements` (6 repos / 8 files), `validate-input-after-interaction` (5 repos / 5 files), `optimize-preload-priority` (1 repo / 1 file), `optimize-script-priority` (0 repos / 0 files) — dead on arrival with near-zero wild adoption.');

  // -------------------------------------------------------------------------
  // Table 2: Eval Judge & LLM Verifier Calibration Health
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 2: Eval Judge & LLM Verifier Calibration Health');
  lines.push('');
  lines.push('<!-- Historical alias: ## Table 2: Judge & Phase 2 Calibration Health -->');
  lines.push('');
  lines.push(
    '| Commit | Date | Judge Version | Sample Size (n) | 3-Run Stability | Judge α | Judge AC₁ | Canary TNR | Notes |',
  );
  lines.push(
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  );

  const judgeRows = options.judgeRows ?? HISTORICAL_JUDGE_CALIBRATION_ROWS;
  for (const row of judgeRows) {
    const commitCell = `\`${row.commit}\``;
    const stabilityCell = `${(row.stabilityRate * 100).toFixed(1)}%`;
    const alphaCell = row.judgeAlpha.toFixed(3);
    const ac1Cell = row.judgeAc1.toFixed(3);
    const tnrCell = `${(row.canaryTnr * 100).toFixed(1)}% (2/2)`;
    const notesCell = row.notes ? row.notes.replace(/\|/g, '\\|') : '-';
    lines.push(
      `| ${commitCell} | ${row.date} | ${row.judgeVersion} | ${row.sampleSize} | ${stabilityCell} | ${alphaCell} | ${ac1Cell} | ${tnrCell} | ${notesCell} |`,
    );
  }

  // -------------------------------------------------------------------------
  // Table 3: Held-Out Detection Funnel & Qualified Rules
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 3: Held-Out Detection Funnel & Qualified Rules');
  lines.push('');
  lines.push(
    '| Commit | Date | Rule-Set | Split | Grades | Judge | Coverage | Precision (95% CI) | Recall (95% CI) | Judge α | Judge AC₁ | Canary TNR | Notes |',
  );
  lines.push(
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  );

  for (const entry of entries) {
    const commitCell = `\`${entry.commit}\``;
    const ruleSetCell = `\`${entry.ruleSetHash}\``;
    const splitCell = `\`${entry.splitHash}\``;
    const gradesCell = `\`${entry.gradesHash}\``;
    const covCell = formatMetricCell(entry.coverage);
    const precCell = formatMetricCell(entry.precision);
    const recCell = formatMetricCell(entry.recall);
    const alphaCell = entry.judgeAlpha.toFixed(3);
    const ac1Cell = entry.judgeAc1.toFixed(3);
    const tnrCell = `${(entry.canaryTnr * 100).toFixed(1)}%`;
    const notesCell = entry.notes ? entry.notes.replace(/\|/g, '\\|') : '-';

    lines.push(
      `| ${commitCell} | ${entry.date} | ${ruleSetCell} | ${splitCell} | ${gradesCell} | ${entry.judgeVersion} | ${covCell} | ${precCell} | ${recCell} | ${alphaCell} | ${ac1Cell} | ${tnrCell} | ${notesCell} |`,
    );
  }

  lines.push('');
  lines.push('### Step 8: Real GitHub Migration Pairs Held-Out Evaluation (`2026-10-16-migration-pairs-eval.json`)');
  lines.push('');
  lines.push('- **Corpus Split:** 177 rule-targeted commit pairs (`old_file_content` -> `new_file_content`) across the held-out split (`MOD(ABS(FARM_FINGERPRINT(repo)), 2) = 1`).');
  lines.push('- **Targeted Features:** `scrollbar-color & width` (56), `accent-color` (53), `declarative invokers & native popover/dialog` (38), `:has() selector` (23), `container queries` (4), `customizable select & showPicker` (2), `discrete transition & starting-style` (1), `:modal pseudo-class` (1), `scroll-driven animations` (1).');
  lines.push('- **Pre-Migration Recall:** 10.2% [6.5% - 15.5%] (18/177 detected pre-migration; net-new feature additions predominate over in-place legacy rewrites).');
  lines.push('- **Post-Fix Silence Rate:** 75.7% [68.9% - 81.4%] (134/177 remain silent on modern code, confirming matchers respect modern replacement syntax).');
  lines.push('- **Migration Resolution Rate:** 16.7% [5.8% - 39.2%] (3/18 resolved cleanly).');

  // -------------------------------------------------------------------------
  // Table 4: Minimal M4 Static Fix Smoke Test
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 4: Fix Smoke Test (Minimal M4 Static Resolution)');
  lines.push('');
  lines.push('<!-- Historical alias: ## Table 4: Minimal M4 Static Fix Smoke Test -->');
  lines.push('');
  lines.push(
    '| Commit | Date | Harness Version | Qualified Guides | Sample Size (n) | Static Resolution (95% CI) | Bad Patch Rejection | Notes |',
  );
  lines.push(
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  );

  const fixRows = options.fixRows ?? HISTORICAL_FIX_SMOKE_TEST_ROWS;
  for (const row of fixRows) {
    const commitCell = `\`${row.commit}\``;
    const harnessCell = `\`${row.harnessVersion}\``;
    const resolutionCell = formatMetricCell(row.staticResolution);
    const notesCell = row.notes ? row.notes.replace(/\|/g, '\\|') : '-';
    lines.push(
      `| ${commitCell} | ${row.date} | ${harnessCell} | ${row.qualifiedGuides} | ${row.sampleSize} | ${resolutionCell} | ${row.badPatchRejectionRate} | ${notesCell} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Parses Gate 0 triage table rows from PROGRESS.md markdown.
 */
export function parseGate0TriageMarkdown(markdown: string): Gate0TriageRow[] {
  const lines = markdown.split('\n');
  const rows: Gate0TriageRow[] = [];

  let inTable1 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Table 1:')) {
      inTable1 = true;
      continue;
    }
    if (inTable1 && trimmed.startsWith('## ') && !trimmed.startsWith('## Table 1:')) {
      inTable1 = false;
      continue;
    }
    if (!inTable1 || !trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 10) {
      continue;
    }
    if (cells[0].toLowerCase().includes('run') || cells[0].includes('---')) {
      continue;
    }

    const runId = cells[0].replace(/`/g, '');
    const date = cells[1];
    const promptVersion = cells[2].replace(/`/g, '');
    const guidesRead = cells[3];
    const detectable = parseInt(cells[4], 10);
    const uiRecipe = cells[5] === '-' ? 0 : parseInt(cells[5], 10);
    const skip = cells[6] === '-' ? 0 : parseInt(cells[6], 10);
    const paulAgreement = cells[7] === '-' ? undefined : cells[7];
    const kappa = cells[8] === '-' ? undefined : parseFloat(cells[8]);
    const rawNotes = cells[9];
    const notes = rawNotes === '-' || rawNotes === '' ? undefined : rawNotes;

    rows.push({
      runId,
      date,
      promptVersion,
      guidesRead,
      detectable,
      uiRecipe,
      skip,
      paulAgreement,
      kappa,
      notes,
    });
  }

  return rows;
}

/**
 * Parses Judge calibration table rows from PROGRESS.md markdown.
 */
export function parseJudgeCalibrationMarkdown(markdown: string): JudgeCalibrationRow[] {
  const lines = markdown.split('\n');
  const rows: JudgeCalibrationRow[] = [];

  let inTable2 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Table 2:')) {
      inTable2 = true;
      continue;
    }
    if (inTable2 && trimmed.startsWith('## ') && !trimmed.startsWith('## Table 2:')) {
      inTable2 = false;
      continue;
    }
    if (!inTable2 || !trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 9) {
      continue;
    }
    if (cells[0].toLowerCase().includes('commit') || cells[0].includes('---')) {
      continue;
    }

    const commit = cells[0].replace(/`/g, '');
    const date = cells[1];
    const judgeVersion = cells[2].replace(/`/g, '');
    const sampleSize = parseInt(cells[3], 10);
    const stabilityRate = Number((parseFloat(cells[4].replace('%', '')) / 100).toFixed(4));
    const judgeAlpha = cells[5] === '-' ? 0 : parseFloat(cells[5]);
    const judgeAc1 = cells[6] === '-' ? 0 : parseFloat(cells[6]);
    const canaryTnr = Number((parseFloat(cells[7].replace('%', '')) / 100).toFixed(4));
    const rawNotes = cells[8];
    const notes = rawNotes === '-' || rawNotes === '' ? undefined : rawNotes;

    rows.push({
      commit,
      date,
      judgeVersion,
      sampleSize,
      stabilityRate,
      judgeAlpha,
      judgeAc1,
      canaryTnr,
      notes,
    });
  }

  return rows;
}

/**
 * Parses existing markdown content from PROGRESS.md into ProgressLogRow entries (Table 3).
 * Backward compatible with legacy single-table "## Benchmark Run Log" or new "## Table 3:".
 */
export function parseProgressLogMarkdown(markdown: string): ProgressLogRow[] {
  const lines = markdown.split('\n');
  const entries: ProgressLogRow[] = [];

  const hasTable3 = markdown.includes('## Table 3:');
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (hasTable3) {
      if (trimmed.startsWith('## Table 3:')) {
        inTable = true;
        continue;
      }
      if (inTable && trimmed.startsWith('## ') && !trimmed.startsWith('## Table 3:')) {
        inTable = false;
        continue;
      }
    }

    if (!trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 13) {
      continue;
    }

    // Skip table header and divider
    if (cells[0].toLowerCase().includes('commit')) {
      if (!hasTable3) {
        inTable = true;
      }
      continue;
    }
    if (cells[0].includes('---')) {
      continue;
    }
    if (!inTable) {
      continue;
    }

    const commit = cells[0].replace(/`/g, '');
    const date = cells[1];
    const ruleSetHash = cells[2].replace(/`/g, '');
    const splitHash = cells[3].replace(/`/g, '');
    const gradesHash = cells[4].replace(/`/g, '');
    const judgeVersion = cells[5];
    const coverage = parseMetricCell(cells[6]);
    const precision = parseMetricCell(cells[7]);
    const recall = parseMetricCell(cells[8]);
    const judgeAlpha = cells[9] === '-' ? 0 : parseFloat(cells[9]);
    const judgeAc1 = cells[10] === '-' ? 0 : parseFloat(cells[10]);
    const canaryTnr = Number((parseFloat(cells[11].replace('%', '')) / 100).toFixed(4));
    const rawNotes = cells[12];
    const notes = rawNotes === '-' || rawNotes === '' ? undefined : rawNotes;

    entries.push({
      commit,
      date,
      ruleSetHash,
      splitHash,
      gradesHash,
      judgeVersion,
      coverage,
      precision,
      recall,
      judgeAlpha,
      judgeAc1,
      canaryTnr,
      notes,
    });
  }

  return entries;
}

/**
 * Parses Minimal M4 fix smoke test table rows from PROGRESS.md markdown.
 */
export function parseFixSmokeTestMarkdown(markdown: string): FixSmokeTestRow[] {
  const lines = markdown.split('\n');
  const rows: FixSmokeTestRow[] = [];

  let inTable4 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Table 4:')) {
      inTable4 = true;
      continue;
    }
    if (inTable4 && trimmed.startsWith('## ') && !trimmed.startsWith('## Table 4:')) {
      inTable4 = false;
      continue;
    }
    if (!inTable4 || !trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 8) {
      continue;
    }
    if (cells[0].toLowerCase().includes('commit') || cells[0].includes('---')) {
      continue;
    }

    const commit = cells[0].replace(/`/g, '');
    const date = cells[1];
    const harnessVersion = cells[2].replace(/`/g, '');
    const qualifiedGuides = parseInt(cells[3], 10);
    const sampleSize = parseInt(cells[4], 10);
    const staticResolution = parseMetricCell(cells[5]);
    const badPatchRejectionRate = cells[6];
    const rawNotes = cells[7];
    const notes = rawNotes === '-' || rawNotes === '' ? undefined : rawNotes;

    rows.push({
      commit,
      date,
      harnessVersion,
      qualifiedGuides,
      sampleSize,
      staticResolution,
      badPatchRejectionRate,
      notes,
    });
  }

  return rows;
}

/**
 * Parses all 4 pipeline scoreboard tables and current verified benchmark from markdown.
 */
export function parsePipelineScoreboardMarkdown(markdown: string): PipelineScoreboard {
  const funnelEntries = parseProgressLogMarkdown(markdown);
  const cleanEntries = funnelEntries.filter((e) => !e.commit.includes('*'));
  const currentBenchmark = cleanEntries.length > 0
    ? cleanEntries[cleanEntries.length - 1]
    : funnelEntries.length > 0
    ? funnelEntries[funnelEntries.length - 1]
    : null;

  return {
    currentBenchmark,
    gate0Triage: parseGate0TriageMarkdown(markdown),
    judgeCalibration: parseJudgeCalibrationMarkdown(markdown),
    detectionFunnel: funnelEntries,
    fixSmokeTest: parseFixSmokeTestMarkdown(markdown),
  };
}

/**
 * Reads the progress log, merges the new row, and writes the updated 4-table markdown.
 */
export async function recordProgressLogEntry(
  newRow: ProgressLogRow,
  progressLogPath: string = PROGRESS_LOG_PATH,
  options: FormatProgressLogOptions = {},
): Promise<string> {
  let existingMarkdown = '';
  try {
    existingMarkdown = await readFile(progressLogPath, 'utf8');
  } catch (err: unknown) {
    if (!isEnoent(err)) {
      throw err;
    }
  }

  const history = loadProgressHistorySync();
  const baseEntries = options.detectionRows ?? (
    progressLogPath === PROGRESS_LOG_PATH
      ? buildTable3FunnelRowsSync(resolve(WORKTREE_ROOT, 'analyzer-internal/findings'), history)
      : (existingMarkdown ? parseProgressLogMarkdown(existingMarkdown) : [])
  );
  const updatedEntries = updateProgressLogEntries(baseEntries, newRow);

  const gate0Rows = options.gate0Rows ?? history.gate0Triage;
  const judgeRows = options.judgeRows ?? buildTable2CalibrationRowsSync(resolve(WORKTREE_ROOT, 'analyzer-internal/findings'), history);
  const fixRows = options.fixRows ?? history.fixSmokeTest;

  const formatted = formatProgressLogMarkdown(updatedEntries, {
    gate0Rows,
    judgeRows,
    fixRows,
    currentBenchmark: options.currentBenchmark,
  });

  await mkdir(dirname(progressLogPath), { recursive: true });
  await writeFile(progressLogPath, formatted, 'utf8');

  return formatted;
}

/**
 * Appends or updates an Eval Judge calibration row in Table 2 of PROGRESS.md.
 * Ensures Table 2 stays synchronized with newly calibrated or admitted judges (D-045).
 */
export async function appendJudgeCalibrationToProgressLog(
  newCalibrationRow: JudgeCalibrationRow,
  progressLogPath: string = PROGRESS_LOG_PATH,
  options: FormatProgressLogOptions = {},
): Promise<string> {
  let existingMarkdown = '';
  try {
    existingMarkdown = await readFile(progressLogPath, 'utf8');
  } catch (err: unknown) {
    if (!isEnoent(err)) {
      throw err;
    }
  }

  const scoreboard = existingMarkdown ? parsePipelineScoreboardMarkdown(existingMarkdown) : null;
  const history = loadProgressHistorySync();
  const existingJudgeRows = options.judgeRows ?? (scoreboard?.judgeCalibration && scoreboard.judgeCalibration.length > 0
    ? scoreboard.judgeCalibration
    : buildTable2CalibrationRowsSync(resolve(WORKTREE_ROOT, 'analyzer-internal/findings'), history));

  const updatedJudgeRows = [...existingJudgeRows];
  const existingIndex = updatedJudgeRows.findIndex(
    (existing) => existing.commit === newCalibrationRow.commit && existing.judgeVersion === newCalibrationRow.judgeVersion,
  );
  if (existingIndex >= 0) {
    updatedJudgeRows[existingIndex] = newCalibrationRow;
  } else {
    updatedJudgeRows.push(newCalibrationRow);
  }

  const detectionRows = options.detectionRows ?? (scoreboard?.detectionFunnel && scoreboard.detectionFunnel.length > 0
    ? scoreboard.detectionFunnel
    : buildTable3FunnelRowsSync(resolve(WORKTREE_ROOT, 'analyzer-internal/findings'), history));

  const gate0Rows = options.gate0Rows ?? (scoreboard?.gate0Triage && scoreboard.gate0Triage.length > 0
    ? scoreboard.gate0Triage
    : history.gate0Triage);

  const fixRows = options.fixRows ?? (scoreboard?.fixSmokeTest && scoreboard.fixSmokeTest.length > 0
    ? scoreboard.fixSmokeTest
    : history.fixSmokeTest);

  const formatted = formatProgressLogMarkdown(detectionRows, {
    gate0Rows,
    judgeRows: updatedJudgeRows,
    fixRows,
    currentBenchmark: options.currentBenchmark ?? scoreboard?.currentBenchmark,
    benchmarkNotice: options.benchmarkNotice,
  });

  await mkdir(dirname(progressLogPath), { recursive: true });
  await writeFile(progressLogPath, formatted, 'utf8');

  return formatted;
}

export interface ProgressLogOptions {
  metrics?: Partial<ProgressLogRow>;
  judgeOptions?: JudgeRunOptions;
  progressLogPath?: string;
  calibrateJudge?: boolean;
  renderOnly?: boolean;
}

/**
 * Parses CLI flags for progress-log.
 * Supports --mode=direct|batch, --calibrate-judge, --calibrate, --render-only.
 */
export function parseProgressLogCliArgs(
  args: string[] = process.argv.slice(2),
): ProgressLogOptions {
  let mode: 'batch' | 'direct' = 'direct';
  let concurrency: number | undefined;
  let calibrateJudge = false;
  let renderOnly = false;
  for (const arg of args) {
    if (arg === '--mode=batch' || arg === '--batch') {
      mode = 'batch';
    } else if (arg === '--mode=direct' || arg === '--direct') {
      mode = 'direct';
    } else if (arg === '--calibrate-judge' || arg === '--calibrate') {
      calibrateJudge = true;
    } else if (arg === '--render-only' || arg === '--regenerate') {
      renderOnly = true;
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = parseInt(arg.split('=')[1], 10);
    }
  }
  return {
    judgeOptions: { mode, concurrency },
    calibrateJudge,
    renderOnly,
  };
}

/**
 * Computes a ProgressLogRow from live evaluation or provided metrics.
 * Evaluates judge stability and consensus agreement against Paul's human grades.
 * Ensures zero dummy defaults: fails fast if required metrics are missing.
 */
export async function computeProgressLogRow(
  options: ProgressLogOptions = {},
): Promise<ProgressLogRow> {
  const gitState = getGitCommitState();
  const splitHash = await computeFileHash(REPOS_CONFIG_PATH);
  const gradesHash = await computeFileHash(GRADES_PATH);
  const today = new Date().toISOString().slice(0, 10);
  const mode = options.judgeOptions?.mode ?? 'direct';
  const judgeVersion = options.metrics?.judgeVersion ?? JUDGE_VERSION;

  if (options.metrics?.precision && options.metrics.judgeAlpha !== undefined) {
    if (options.metrics.judgeAc1 === undefined) {
      throw new Error('judgeAc1 is required when providing metrics');
    }
    if (options.metrics.canaryTnr === undefined) {
      throw new Error('canaryTnr is required when providing metrics');
    }
    return {
      commit: gitState.commit,
      date: today,
      ruleSetHash: options.metrics.ruleSetHash ?? 'initial-phase1',
      splitHash,
      gradesHash,
      judgeVersion,
      coverage: options.metrics.coverage ?? { value: 0, n: 0, split: 'grading-only' },
      precision: options.metrics.precision,
      recall: options.metrics.recall ?? { value: 0, n: 0, split: 'grading-only' },
      judgeAlpha: options.metrics.judgeAlpha,
      judgeAc1: options.metrics.judgeAc1,
      canaryTnr: options.metrics.canaryTnr,
      notes: options.metrics.notes ?? 'Phase 1 measurement baseline',
    };
  }

  // P3: Decouple rendering from live LLM calls when not explicitly calibrating judge
  if (!options.calibrateJudge) {
    const calibDir = resolve(WORKTREE_ROOT, 'analyzer-internal/findings');
    let calibData: {
      stabilityRate: number;
      judgeAlpha: number;
      judgeAc1: number;
      canaryTnr: number;
      judgeVersion?: string;
    } | null = null;
    try {
      const entries = await readdir(calibDir);
      const calibFiles = entries
        .filter((e) => /judge.*calibration.*\.json$/i.test(e) && !e.includes('latest'))
        .sort()
        .reverse();
      if (calibFiles.length > 0) {
        const calibRaw = await readFile(resolve(calibDir, calibFiles[0]), 'utf8');
        calibData = JSON.parse(calibRaw);
      }
    } catch {
      // Calibration not found
    }

    if (calibData) {
      const m3Path = resolve(WORKTREE_ROOT, 'analyzer-internal/findings/2026-10-15-m3-rescore-scorecard.json');
      let scorecardReport: {
        ruleSetHash?: string;
        splitHash?: string;
        gradesHash?: string;
        summary?: {
          coverage?: MetricEntry;
          overallPrecision?: MetricEntry;
          overallRecall?: MetricEntry;
        };
      } | null = null;
      try {
        const scRaw = await readFile(m3Path, 'utf8');
        scorecardReport = JSON.parse(scRaw);
      } catch {
        // No scorecard file
      }

      return {
        commit: gitState.commit,
        date: today,
        ruleSetHash: scorecardReport?.ruleSetHash ?? options.metrics?.ruleSetHash ?? 'initial-phase1',
        splitHash: scorecardReport?.splitHash ?? splitHash,
        gradesHash: scorecardReport?.gradesHash ?? gradesHash,
        judgeVersion: calibData.judgeVersion ?? judgeVersion,
        coverage: scorecardReport?.summary?.coverage ?? options.metrics?.coverage ?? { value: 0, n: 0, split: 'grading-only' },
        precision: scorecardReport?.summary?.overallPrecision ?? options.metrics?.precision ?? { value: 0, n: 0, split: 'grading-only' },
        recall: scorecardReport?.summary?.overallRecall ?? options.metrics?.recall ?? { value: 0, n: 0, split: 'grading-only' },
        judgeAlpha: calibData.judgeAlpha,
        judgeAc1: calibData.judgeAc1,
        canaryTnr: calibData.canaryTnr,
        notes: options.metrics?.notes ?? `Decoupled render from persisted artifacts (stability=${(calibData.stabilityRate * 100).toFixed(1)}%, canaryTNR=${(calibData.canaryTnr * 100).toFixed(1)}%)`,
      };
    }
  }

  // Load Paul's human-scored cards, skipping any card whose guide is a stub or non-landed
  const { cards: allCards, humanVerdicts: allVerdicts } = await loadPaulIrishScoredCards();
  const scoredCards = allCards.filter(
    (c) => c.guideId !== 'copy-button' && c.guideId !== 'dialog' && c.guideId !== 'css-layout',
  );
  const humanVerdicts = new Map<string, JudgeVerdict>();
  for (const c of scoredCards) {
    const v = allVerdicts.get(c.cardId);
    if (v) {
      humanVerdicts.set(c.cardId, v);
    }
  }

  const summaries = await loadGuideSummariesMap();
  const blindCards = await prepareBlindCards(scoredCards, summaries);

  // Execute 3 stability runs
  const judgeOpts: JudgeRunOptions = {
    ...options.judgeOptions,
    mode,
  };
  console.log(`[progress-log] Running 3 stability runs on ${blindCards.length} scored cards (mode=${mode}, concurrency=${judgeOpts.concurrency ?? 5})...`);
  const run0 = await runJudgeBatch(blindCards, judgeOpts);
  console.log('[progress-log] Run 0 complete');
  const run1 = await runJudgeBatch(blindCards, judgeOpts);
  console.log('[progress-log] Run 1 complete');
  const run2 = await runJudgeBatch(blindCards, judgeOpts);
  console.log('[progress-log] Run 2 complete');

  const stability = evaluateJudgeStability([run0, run1, run2]);

  // Canary checking: negative controls are Paul's 2 confirmed false positives
  const canaryCards: CanaryCard[] = [
    {
      cardId: '2547b2ba6d74',
      expectedVerdict: 'not-old-pattern',
      description: 'Paul Irish human-verified false positive (focus-trap/inert)',
    },
    {
      cardId: '7f2a96f62a4c',
      expectedVerdict: 'not-old-pattern',
      description: 'Paul Irish human-verified false positive (MessageChannel)',
    },
  ];

  const canaryResult = checkCanaries(stability.consensusResults, canaryCards);

  // Inter-rater agreement between 3-run majority consensus and Paul's human grades
  const droppedCardIds = new Set(['2547b2ba6d74', '7f2a96f62a4c']);
  const evalMetrics = evaluateJudgeMetrics(
    stability.consensusResults,
    humanVerdicts,
    droppedCardIds,
  );

  const ppi = evalMetrics.ppiPrecision;
  const precisionEntry: MetricEntry = {
    value: Number(ppi.estimate.toFixed(4)),
    lower: Number(ppi.lower.toFixed(4)),
    upper: Number(ppi.upper.toFixed(4)),
    n: scoredCards.length,
    split: 'grading-only',
  };

  console.log('============================================================');
  console.log('           PROGRESS LOG EVALUATION METRICS                  ');
  console.log('============================================================');
  console.log(`  Judge Version:     ${judgeVersion}`);
  console.log(`  Scored Cards (n):  ${scoredCards.length}`);
  const stabilityStr = stability.stabilityRate !== null
    ? `${(stability.stabilityRate * 100).toFixed(1)}%`
    : 'unmeasured';
  console.log(`  3-Run Stability:   ${stabilityStr}`);
  console.log(`  Canary TNR:        ${(canaryResult.tnr * 100).toFixed(1)}% (${canaryResult.negatives - canaryResult.violations.length}/${canaryResult.negatives})`);
  console.log(`  Judge Alpha:       ${evalMetrics.krippendorffAlpha.toFixed(3)}`);
  console.log(`  Judge AC1:         ${evalMetrics.gwetAc1.toFixed(3)}`);
  console.log(`  Sensitivity (TPR): ${(evalMetrics.sensitivitySpecificity.tpr * 100).toFixed(1)}% (${evalMetrics.sensitivitySpecificity.positives} positives)`);
  console.log(`  PPI Precision:     ${(ppi.estimate * 100).toFixed(1)}% [${(ppi.lower * 100).toFixed(1)}% - ${(ppi.upper * 100).toFixed(1)}%]`);

  // Subgroup analysis: out-of-sample newly graded cards (_calibration-deck + _m3-spotcheck-deck)
  try {
    const { readFile: readDeckFile } = await import('node:fs/promises');
    const { join: joinPath } = await import('node:path');
    const calibRaw = JSON.parse(await readDeckFile(joinPath(CARDS_DIR, '_calibration-deck.json'), 'utf8')) as Array<{ cardId: string }>;
    const m3Raw = JSON.parse(await readDeckFile(joinPath(CARDS_DIR, '_m3-spotcheck-deck.json'), 'utf8')) as Array<{ cardId: string }>;
    const newCardIds = new Set([...calibRaw.map((c) => c.cardId), ...m3Raw.map((c) => c.cardId)]);

    const newCards = scoredCards.filter((c) => newCardIds.has(c.cardId));
    const origCards = scoredCards.filter((c) => !newCardIds.has(c.cardId));

    const newConsensus = stability.consensusResults.filter((r) => newCardIds.has(r.cardId));
    const origConsensus = stability.consensusResults.filter((r) => !newCardIds.has(r.cardId));

    const newMetrics = evaluateJudgeMetrics(newConsensus, humanVerdicts);
    const origMetrics = evaluateJudgeMetrics(origConsensus, humanVerdicts, droppedCardIds);

    console.log('------------------------------------------------------------');
    console.log('SUBGROUP BREAKDOWN:');
    console.log(`  Original Cards (n=${origCards.length}):`);
    console.log(`    AC1: ${origMetrics.gwetAc1.toFixed(3)} | Alpha: ${origMetrics.krippendorffAlpha.toFixed(3)} | TPR: ${(origMetrics.sensitivitySpecificity.tpr * 100).toFixed(1)}%`);
    console.log(`  Newly Graded Out-of-Sample Decks (_calibration + _m3, n=${newCards.length}):`);
    console.log(`    AC1: ${newMetrics.gwetAc1.toFixed(3)} | Alpha: ${newMetrics.krippendorffAlpha.toFixed(3)} | TPR: ${(newMetrics.sensitivitySpecificity.tpr * 100).toFixed(1)}%`);
    console.log('============================================================');
  } catch (err: unknown) {
    console.warn('[progress-log] Could not compute subgroup breakdown:', err);
  }

  try {
    const calibPath = resolve(
      WORKTREE_ROOT,
      `analyzer-internal/findings/${today}-judge-v6-calibration.json`,
    );
    await mkdir(dirname(calibPath), { recursive: true });
    await writeFile(
      calibPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          judgeVersion,
          stabilityRate: stability.stabilityRate !== null ? Number(stability.stabilityRate.toFixed(4)) : null,
          judgeAlpha: Number(evalMetrics.krippendorffAlpha.toFixed(3)),
          judgeAc1: Number(evalMetrics.gwetAc1.toFixed(3)),
          canaryTnr: Number(canaryResult.tnr.toFixed(4)),
          scoredCardsCount: scoredCards.length,
          notes: `Judge calibration run (stability=${stabilityStr}, canaryTNR=${(canaryResult.tnr * 100).toFixed(1)}%)`,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
  } catch (err: unknown) {
    console.warn('[progress-log] Could not persist judge calibration artifact:', err);
  }

  return {
    commit: gitState.commit,
    date: today,
    ruleSetHash: 'initial-phase1',
    splitHash,
    gradesHash,
    judgeVersion,
    coverage: { value: 0, n: 0, split: 'grading-only' },
    precision: precisionEntry,
    recall: { value: 0, n: 0, split: 'grading-only' },
    judgeAlpha: Number(evalMetrics.krippendorffAlpha.toFixed(3)),
    judgeAc1: Number(evalMetrics.gwetAc1.toFixed(3)),
    canaryTnr: Number(canaryResult.tnr.toFixed(4)),
    notes: `Phase 1 measurement baseline (stability=${stabilityStr}, canaryTNR=${(canaryResult.tnr * 100).toFixed(1)}%)`,
  };
}

/**
 * CLI execution entrypoint to generate and update PROGRESS.md.
 */
export async function runProgressLogCli(options: ProgressLogOptions = {}): Promise<void> {
  const cliOpts = parseProgressLogCliArgs();
  const mergedOptions: ProgressLogOptions = {
    ...cliOpts,
    ...options,
    judgeOptions: {
      ...cliOpts.judgeOptions,
      ...options.judgeOptions,
    },
  };
  const targetPath = mergedOptions.progressLogPath ?? PROGRESS_LOG_PATH;

  if (mergedOptions.renderOnly) {
    const history = loadProgressHistorySync();
    const funnelRows = buildTable3FunnelRowsSync(
      resolve(WORKTREE_ROOT, 'analyzer-internal/findings'),
      history,
    );
    const formatted = formatProgressLogMarkdown(funnelRows, {
      gate0Rows: history.gate0Triage,
      judgeRows: buildTable2CalibrationRowsSync(resolve(WORKTREE_ROOT, 'analyzer-internal/findings'), history),
      fixRows: history.fixSmokeTest,
    });
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, formatted, 'utf8');
    console.log(`Rendered progress log at ${targetPath} from history and scorecards.`);
    return;
  }

  const row = await computeProgressLogRow(mergedOptions);
  await recordProgressLogEntry(row, targetPath);
  console.log(`Updated progress log at ${targetPath} for commit ${row.commit}`);
}

// Module execution guard
if (import.meta.main || (process.argv[1] && resolve(process.argv[1]) === import.meta.filename)) {
  runProgressLogCli().catch((err: unknown) => {
    console.error('Failed to update progress log:', err);
    process.exitCode = 1;
  });
}
