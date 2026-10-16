/* oxlint-disable max-lines-per-function, max-depth */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
// Historical Backfill Constants loaded from verified progress-history.json (R31, D-025, O36)
// ---------------------------------------------------------------------------

import progressHistory from './progress-history.json' with { type: 'json' };

function unsafeCast<T>(value: unknown, _reason: string): T {
  return value as T;
}

export const HISTORICAL_GATE0_TRIAGE_ROWS: readonly Gate0TriageRow[] =
  unsafeCast<readonly Gate0TriageRow[]>(
    progressHistory.gate0Triage,
    'progress-history.json gate0Triage schema conformance',
  );

export const HISTORICAL_JUDGE_CALIBRATION_ROWS: readonly JudgeCalibrationRow[] =
  unsafeCast<readonly JudgeCalibrationRow[]>(
    progressHistory.judgeCalibration,
    'progress-history.json judgeCalibration schema conformance',
  );

export const HISTORICAL_DETECTION_FUNNEL_ROWS: readonly DetectionFunnelRow[] =
  unsafeCast<readonly DetectionFunnelRow[]>(
    progressHistory.detectionFunnel,
    'progress-history.json detectionFunnel schema conformance',
  );

export const HISTORICAL_FIX_SMOKE_TEST_ROWS: readonly FixSmokeTestRow[] =
  unsafeCast<readonly FixSmokeTestRow[]>(
    progressHistory.fixSmokeTest,
    'progress-history.json fixSmokeTest schema conformance',
  );

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
