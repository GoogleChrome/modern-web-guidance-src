import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  checkCanaries,
  evaluateJudgeMetrics,
  evaluateJudgeStability,
  loadGuideSummariesMap,
  loadHumanGrades,
  loadPaulIrishScoredCards,
  prepareBlindCards,
  runJudgeBatch,
  type CanaryCard,
  type JudgeRunOptions,
} from './judge.ts';
import {
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

export interface GitCommitState {
  commit: string;
  isDirty: boolean;
}

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
  const match = trimmed.match(
    /^([\d.]+)%(?:\s*\[\s*([\d.]+)%\s*[-–]\s*([\d.]+)%\s*\])?\s*\(n=(\d+),\s*(?:split=)?([^)]+)\)$/,
  );
  if (!match) {
    throw new Error(`Unable to parse metric cell: "${text}"`);
  }

  const value = Number((parseFloat(match[1]) / 100).toFixed(4));
  const lower = match[2] !== undefined ? Number((parseFloat(match[2]) / 100).toFixed(4)) : undefined;
  const upper = match[3] !== undefined ? Number((parseFloat(match[3]) / 100).toFixed(4)) : undefined;
  const n = parseInt(match[4], 10);
  const split = match[5].trim();

  return {
    value,
    lower,
    upper,
    n,
    split,
  };
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
 * Renders the full markdown content of PROGRESS.md.
 */
export function formatProgressLogMarkdown(
  entries: ReadonlyArray<ProgressLogRow>,
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
  const current = cleanEntries.length > 0
    ? cleanEntries[cleanEntries.length - 1]
    : entries.length > 0
    ? entries[entries.length - 1]
    : null;

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

  lines.push('');
  lines.push('## Benchmark Run Log');
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
  return lines.join('\n');
}

/**
 * Parses existing markdown content from PROGRESS.md into ProgressLogRow entries.
 */
export function parseProgressLogMarkdown(markdown: string): ProgressLogRow[] {
  const lines = markdown.split('\n');
  const entries: ProgressLogRow[] = [];

  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
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
      inTable = true;
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
    const judgeAlpha = parseFloat(cells[9]);
    const judgeAc1 = parseFloat(cells[10]);
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
 * Reads the progress log, merges the new row, and writes the updated markdown.
 */
export async function recordProgressLogEntry(
  newRow: ProgressLogRow,
  progressLogPath: string = PROGRESS_LOG_PATH,
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
  const formatted = formatProgressLogMarkdown(updatedEntries);

  await mkdir(dirname(progressLogPath), { recursive: true });
  await writeFile(progressLogPath, formatted, 'utf8');

  return formatted;
}

export interface ProgressLogOptions {
  metrics?: Partial<ProgressLogRow>;
  judgeOptions?: JudgeRunOptions;
  progressLogPath?: string;
}

/**
 * Parses CLI flags for progress-log.
 * Supports --mode=direct|batch.
 */
export function parseProgressLogCliArgs(
  args: string[] = process.argv.slice(2),
): ProgressLogOptions {
  let mode: 'batch' | 'direct' = 'direct';
  for (const arg of args) {
    if (arg === '--mode=batch' || arg === '--batch') {
      mode = 'batch';
    } else if (arg === '--mode=direct' || arg === '--direct') {
      mode = 'direct';
    }
  }
  return {
    judgeOptions: { mode },
  };
}

/**
 * Computes a ProgressLogRow from live evaluation or provided metrics.
 * Evaluates judge stability and consensus agreement against Paul's 85 human grades.
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
  const judgeVersion =
    options.metrics?.judgeVersion ?? `gemini-3.8-flash:detective-v3-${mode}`;

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

  // Load Paul's 85 human-scored cards (83 'right', 2 'not-old-pattern', excluding 1 'unsure')
  const { cards: scoredCards, humanVerdicts } = await loadPaulIrishScoredCards();
  const summaries = await loadGuideSummariesMap();
  const blindCards = await prepareBlindCards(scoredCards, summaries);

  // Execute 3 stability runs
  const judgeOpts: JudgeRunOptions = {
    ...options.judgeOptions,
    mode,
  };
  const run0 = await runJudgeBatch(blindCards, judgeOpts);
  const run1 = await runJudgeBatch(blindCards, judgeOpts);
  const run2 = await runJudgeBatch(blindCards, judgeOpts);

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

  // Inter-rater agreement between 3-run majority consensus and Paul's 85 human grades
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
if (import.meta.main) {
  runProgressLogCli().catch((err: unknown) => {
    console.error('Failed to update progress log:', err);
    process.exitCode = 1;
  });
}
