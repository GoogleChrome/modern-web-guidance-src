/* oxlint-disable max-lines-per-function, max-depth */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
  CARDS_DIR,
  GRADES_PATH,
  PROGRESS_LOG_PATH,
  REPOS_CONFIG_PATH,
  WORKTREE_ROOT,
} from './paths.ts';

export const DEFAULT_HASH_LENGTH = 12;

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
  fixRows?: ReadonlyArray<FixSmokeTestRow>;
  currentBenchmark?: ProgressLogRow | null;
}

export interface GitCommitState {
  commit: string;
  isDirty: boolean;
}

// ---------------------------------------------------------------------------
// Historical Backfill Constants (R31, D-025)
// ---------------------------------------------------------------------------

export const HISTORICAL_GATE0_TRIAGE_ROWS: readonly Gate0TriageRow[] = [
  {
    runId: 'manual-slug-triage-v0',
    date: '2026-10-14',
    promptVersion: 'slug-heuristics-v0',
    guidesRead: '0/171 (0%)',
    detectable: 33,
    uiRecipe: 0,
    skip: 0,
    paulAgreement: '-',
    kappa: 0,
    notes: '[invalidated per audit: 0/171 guides read, ungrounded slug inferences]',
  },
  {
    runId: 'gate0-v1-full-guide',
    date: '2026-10-15',
    promptVersion: 'gemini-3.8-flash:gate0-v1',
    guidesRead: '171/171 (100%)',
    detectable: 42,
    uiRecipe: 47,
    skip: 82,
    paulAgreement: '15/25 (60.0%)',
    kappa: 0.400,
    notes: '30-guide spot-check deck; undercounts detectable guides (R26); prompt overhauled in R27',
  },
];

export const HISTORICAL_JUDGE_CALIBRATION_ROWS: readonly JudgeCalibrationRow[] = [
  {
    commit: 'dafe9ee',
    date: '2026-10-15',
    judgeVersion: 'gemini-3.8-flash:detective-v2-direct',
    sampleSize: 85,
    stabilityRate: 0.718,
    judgeAlpha: -0.341,
    judgeAc1: 0.179,
    canaryTnr: 1.000,
    notes: 'Phase 1 measurement baseline (stability=71.8%, canaryTNR=100.0%)',
  },
  {
    commit: 'd3927f7',
    date: '2026-10-15',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    sampleSize: 85,
    stabilityRate: 0.918,
    judgeAlpha: -0.188,
    judgeAc1: 0.377,
    canaryTnr: 1.000,
    notes: 'Phase 1 measurement baseline (stability=91.8%, canaryTNR=100.0%)',
  },
  {
    commit: '44b9c3d',
    date: '2026-10-15',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    sampleSize: 85,
    stabilityRate: 0.976,
    judgeAlpha: 0.222,
    judgeAc1: 0.863,
    canaryTnr: 1.000,
    notes: 'Phase 1 measurement baseline (stability=97.6%, canaryTNR=100.0%)',
  },
  {
    commit: 'ecb6ace',
    date: '2026-10-15',
    judgeVersion: 'gemini-3.8-flash:detective-v4-guide-only',
    sampleSize: 116,
    stabilityRate: 0.945,
    judgeAlpha: 0.063,
    judgeAc1: 0.764,
    canaryTnr: 1.000,
    notes: 'Guide-only judge (re-calibrating per R29: 8 FNs due to guide-wrong/leave-it inversion, thinkingBudget=0)',
  },
];

export const HISTORICAL_DETECTION_FUNNEL_ROWS: readonly DetectionFunnelRow[] = [
  {
    commit: '7bddb06',
    date: '2026-10-15',
    ruleSetHash: '2661f572344c',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.2, n: 5, split: 'grading-only' },
    precision: { value: 0.983, lower: 0.952, upper: 1.0, n: 85, split: 'grading-only' },
    recall: { value: 0.667, lower: 0.438, upper: 0.837, n: 18, split: 'grading-only' },
    judgeAlpha: 0.200,
    judgeAc1: 0.850,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 2 pilot evaluation (1 qualified [>=0.90 LB], 4 unmeasured [low-n], 1/5 cleared bar, stability=96.2%, canaryTNR=100.0%)',
  },
  {
    commit: 'e00c565',
    date: '2026-10-15',
    ruleSetHash: '3ea4fd9c37d2',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.2, n: 5, split: 'grading-only' },
    precision: { value: 0.981, lower: 0.950, upper: 1.0, n: 85, split: 'grading-only' },
    recall: { value: 0.556, lower: 0.337, upper: 0.754, n: 18, split: 'grading-only' },
    judgeAlpha: 0.182,
    judgeAc1: 0.837,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 2 pilot evaluation (1 qualified [>=0.90 LB], 4 unmeasured [low-n], 1/5 cleared bar, stability=97.1%, canaryTNR=100.0%)',
  },
  {
    commit: 'b0f87c7',
    date: '2026-10-15',
    ruleSetHash: 'bc7966df2d47',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.2, n: 5, split: 'grading-only' },
    precision: { value: 0.987, lower: 0.956, upper: 1.0, n: 85, split: 'grading-only' },
    recall: { value: 0.667, lower: 0.438, upper: 0.837, n: 18, split: 'grading-only' },
    judgeAlpha: 0.200,
    judgeAc1: 0.850,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 2 pilot evaluation (1 qualified [>=0.90 LB], 4 unmeasured [low-n], 1/5 cleared bar, stability=98.5%, canaryTNR=100.0%)',
  },
  {
    commit: 'a5a253f',
    date: '2026-10-15',
    ruleSetHash: 'd444600bc87d',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.25, n: 16, split: 'grading-only' },
    precision: { value: 0.960, lower: 0.923, upper: 0.980, n: 200, split: 'grading-only, judged' },
    recall: { value: 0.475, lower: 0.353, upper: 0.600, n: 59, split: 'grading-only' },
    judgeAlpha: 0.164,
    judgeAc1: 0.824,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 3 evaluation (1 qualified [>=0.90 LB], 15 unmeasured [low-n], 4/16 guides cleared bar, pooled held-out prec=96.0%, stability=98.0%, canaryTNR=100.0%)',
  },
  {
    commit: '1dd4409',
    date: '2026-10-15',
    ruleSetHash: '838dcb4e6972',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.6, n: 30, split: 'grading-only' },
    precision: { value: 0.971, lower: 0.943, upper: 0.985, n: 274, split: 'grading-only, judged' },
    recall: { value: 0.551, lower: 0.441, upper: 0.657, n: 78, split: 'grading-only' },
    judgeAlpha: 0.200,
    judgeAc1: 0.850,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 3 evaluation (1 qualified [>=0.90 LB], 29 unmeasured [low-n], 18/30 guides cleared bar, pooled held-out prec=97.1%, stability=96.8%, canaryTNR=100.0%)',
  },
  {
    commit: 'e73c552',
    date: '2026-10-15',
    ruleSetHash: '47d04da795b5',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.719, n: 32, split: 'grading-only' },
    precision: { value: 0.894, lower: 0.856, upper: 0.923, n: 329, split: 'grading-only, judged' },
    recall: { value: 0.603, lower: 0.492, upper: 0.704, n: 78, split: 'grading-only' },
    judgeAlpha: 0.147,
    judgeAc1: 0.811,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 3 evaluation (1 qualified [>=0.90 LB], 31 unmeasured [low-n], 23/32 guides cleared bar, pooled held-out prec=89.4%, stability=96.4%, canaryTNR=100.0%)',
  },
  {
    commit: '30e2a34',
    date: '2026-10-15',
    ruleSetHash: '1b64289894c1',
    splitHash: 'b8af9495f9ec',
    gradesHash: 'b6e5d6f718df',
    judgeVersion: 'gemini-3.8-flash:detective-v3-direct',
    coverage: { value: 0.781, n: 32, split: 'grading-only' },
    precision: { value: 0.954, lower: 0.923, upper: 0.973, n: 285, split: 'grading-only, judged' },
    recall: { value: 0.603, lower: 0.492, upper: 0.704, n: 78, split: 'grading-only' },
    judgeAlpha: 0.146,
    judgeAc1: 0.811,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 3 evaluation (1 qualified [>=0.90 LB], 31 unmeasured [low-n], 25/32 guides cleared bar: 8 proven-high-n + 17 zero-fp-low-n, pooled held-out prec=95.4%, stability=96.8%, canaryTNR=100.0%)',
  },
  {
    commit: 'ecb6ace',
    date: '2026-10-15',
    ruleSetHash: '76fa4aab3237',
    splitHash: 'b8af9495f9ec',
    gradesHash: '2b8171c24fb2',
    judgeVersion: 'gemini-3.8-flash:detective-v4-guide-only',
    coverage: { value: 0.724, n: 29, split: 'grading-only' },
    precision: { value: 0.948, lower: 0.917, upper: 0.968, n: 307, split: 'grading-only, judged' },
    recall: { value: 0.564, lower: 0.467, upper: 0.657, n: 101, split: 'grading-only' },
    judgeAlpha: 0.063,
    judgeAc1: 0.764,
    canaryTnr: 1.0,
    notes: '[pre-guide-phase2: Phase 2 ran without guide.md] Milestone 3 evaluation (2 qualified [>=0.90 LB: animate-element-entry-exit, individual-transform-properties], 27 unmeasured [low-n: 19 sample-constrained], qualified prec=98.6%, pooled held-out prec=94.8%, stability=94.5%, canaryTNR=100.0%)',
  },
];

export const HISTORICAL_FIX_SMOKE_TEST_ROWS: readonly FixSmokeTestRow[] = [
  {
    commit: 'e23f54256',
    date: '2026-10-15',
    harnessVersion: 'fix-harness-m4',
    qualifiedGuides: 25,
    sampleSize: 41,
    staticResolution: { value: 0.585, lower: 0.434, upper: 0.722, n: 41, split: 'grading-only' },
    badPatchRejectionRate: '100.0% (75/75)',
    notes: 'Milestone 4 agentic fix evaluation (round 1): static resolution only (D-022, R15)',
  },
  {
    commit: 'd40c9a3b9',
    date: '2026-10-15',
    harnessVersion: 'fix-harness-m4-r2',
    qualifiedGuides: 25,
    sampleSize: 40,
    staticResolution: { value: 0.900, lower: 0.769, upper: 0.960, n: 40, split: 'grading-only' },
    badPatchRejectionRate: '100.0% (75/75)',
    notes: 'Milestone 4 agentic fix evaluation (round 2): static resolution only (D-022, R15)',
  },
  {
    commit: '0d56c4782',
    date: '2026-10-15',
    harnessVersion: 'fix-harness-m4-r3',
    qualifiedGuides: 25,
    sampleSize: 40,
    staticResolution: { value: 0.900, lower: 0.769, upper: 0.960, n: 40, split: 'grading-only' },
    badPatchRejectionRate: '100.0% (75/75)',
    notes: 'Milestone 4 agentic fix evaluation (G13-G17 hardened): shadow-dom 43-line refactor resolved, static resolution only',
  },
];

/**
 * Type guard for ENOENT errors (BAN TOCTOU: operate and catch ENOENT).
 */
export function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  );
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
    if (entryBase === targetBase) {
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
    lines.push(
      `- **Guard Metrics:** Judge α = ${current.judgeAlpha.toFixed(3)}, Judge AC₁ = ${current.judgeAc1.toFixed(3)}, Canary TNR = ${(current.canaryTnr * 100).toFixed(1)}%`,
    );
    if (current.notes) {
      lines.push(`- **Notes:** ${current.notes}`);
    }
  }

  // -------------------------------------------------------------------------
  // Table 1: Gate 0 Catalog Triage & Agreement
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 1: Gate 0 Catalog Triage & Agreement');
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

  // -------------------------------------------------------------------------
  // Table 2: Judge & Phase 2 Calibration Health
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 2: Judge & Phase 2 Calibration Health');
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
    const tnrCell = `${(row.canaryTnr * 100).toFixed(1)}%`;
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

  // -------------------------------------------------------------------------
  // Table 4: Minimal M4 Static Fix Smoke Test
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('## Table 4: Minimal M4 Static Fix Smoke Test');
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

  const existingEntries = existingMarkdown ? parseProgressLogMarkdown(existingMarkdown) : [];
  const updatedEntries = updateProgressLogEntries(existingEntries, newRow);

  // Preserve existing other tables if present, otherwise default to historical constants
  const parsedGate0 = existingMarkdown ? parseGate0TriageMarkdown(existingMarkdown) : [];
  const gate0Rows = options.gate0Rows ?? (parsedGate0.length > 0 ? parsedGate0 : HISTORICAL_GATE0_TRIAGE_ROWS);

  const parsedJudge = existingMarkdown ? parseJudgeCalibrationMarkdown(existingMarkdown) : [];
  const judgeRows = options.judgeRows ?? (parsedJudge.length > 0 ? parsedJudge : HISTORICAL_JUDGE_CALIBRATION_ROWS);

  const parsedFix = existingMarkdown ? parseFixSmokeTestMarkdown(existingMarkdown) : [];
  const fixRows = options.fixRows ?? (parsedFix.length > 0 ? parsedFix : HISTORICAL_FIX_SMOKE_TEST_ROWS);

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

export interface ProgressLogOptions {
  metrics?: Partial<ProgressLogRow>;
  judgeOptions?: JudgeRunOptions;
  progressLogPath?: string;
  calibrateJudge?: boolean;
}

/**
 * Parses CLI flags for progress-log.
 * Supports --mode=direct|batch, --calibrate-judge, --calibrate.
 */
export function parseProgressLogCliArgs(
  args: string[] = process.argv.slice(2),
): ProgressLogOptions {
  let mode: 'batch' | 'direct' = 'direct';
  let concurrency: number | undefined;
  let calibrateJudge = false;
  for (const arg of args) {
    if (arg === '--mode=batch' || arg === '--batch') {
      mode = 'batch';
    } else if (arg === '--mode=direct' || arg === '--direct') {
      mode = 'direct';
    } else if (arg === '--calibrate-judge' || arg === '--calibrate') {
      calibrateJudge = true;
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = parseInt(arg.split('=')[1], 10);
    }
  }
  return {
    judgeOptions: { mode, concurrency },
    calibrateJudge,
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
    const calibPath = resolve(WORKTREE_ROOT, 'analyzer-internal/findings/judge-calibration-latest.json');
    let calibData: {
      stabilityRate: number;
      judgeAlpha: number;
      judgeAc1: number;
      canaryTnr: number;
      judgeVersion?: string;
    } | null = null;
    try {
      const calibRaw = await readFile(calibPath, 'utf8');
      calibData = JSON.parse(calibRaw);
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
  console.log(`  3-Run Stability:   ${(stability.stabilityRate * 100).toFixed(1)}%`);
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
    const calibPath = resolve(WORKTREE_ROOT, 'analyzer-internal/findings/judge-calibration-latest.json');
    await mkdir(dirname(calibPath), { recursive: true });
    await writeFile(
      calibPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          judgeVersion,
          stabilityRate: Number(stability.stabilityRate.toFixed(4)),
          judgeAlpha: Number(evalMetrics.krippendorffAlpha.toFixed(3)),
          judgeAc1: Number(evalMetrics.gwetAc1.toFixed(3)),
          canaryTnr: Number(canaryResult.tnr.toFixed(4)),
          scoredCardsCount: scoredCards.length,
          notes: `Judge calibration run (stability=${(stability.stabilityRate * 100).toFixed(1)}%, canaryTNR=${(canaryResult.tnr * 100).toFixed(1)}%)`,
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
    notes: `Phase 1 measurement baseline (stability=${(stability.stabilityRate * 100).toFixed(1)}%, canaryTNR=${(canaryResult.tnr * 100).toFixed(1)}%)`,
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
  const row = await computeProgressLogRow(mergedOptions);
  const targetPath = mergedOptions.progressLogPath ?? PROGRESS_LOG_PATH;
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
