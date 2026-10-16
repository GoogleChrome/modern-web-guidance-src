import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  GRADES_PATH,
  REPOS_CONFIG_PATH,
} from './paths.ts';
import {
  computeFileHash,
  formatMetricCell,
  formatProgressLogMarkdown,
  getGitCommitState,
  HISTORICAL_DETECTION_FUNNEL_ROWS,
  HISTORICAL_FIX_SMOKE_TEST_ROWS,
  HISTORICAL_GATE0_TRIAGE_ROWS,
  HISTORICAL_JUDGE_CALIBRATION_ROWS,
  parseFixSmokeTestMarkdown,
  parseGate0TriageMarkdown,
  parseJudgeCalibrationMarkdown,
  parseMetricCell,
  parsePipelineScoreboardMarkdown,
  parseProgressLogMarkdown,
  type ProgressLogRow,
  recordProgressLogEntry,
  updateProgressLogEntries,
} from './progress-log.ts';

describe('progress-log metric formatting and parsing', () => {
  it('formats and parses metric with confidence interval', () => {
    const metric = {
      value: 0.923,
      lower: 0.881,
      upper: 0.954,
      n: 60,
      split: 'grading-only',
    };
    const formatted = formatMetricCell(metric);
    assert.strictEqual(formatted, '92.3% [88.1% - 95.4%] (n=60, grading-only)');

    const parsed = parseMetricCell(formatted);
    assert.strictEqual(parsed.value, 0.923);
    assert.strictEqual(parsed.lower, 0.881);
    assert.strictEqual(parsed.upper, 0.954);
    assert.strictEqual(parsed.n, 60);
    assert.strictEqual(parsed.split, 'grading-only');
  });

  it('formats and parses metric without confidence interval', () => {
    const metric = {
      value: 0.125,
      n: 200,
      split: 'grading-only',
    };
    const formatted = formatMetricCell(metric);
    assert.strictEqual(formatted, '12.5% (n=200, grading-only)');

    const parsed = parseMetricCell(formatted);
    assert.strictEqual(parsed.value, 0.125);
    assert.strictEqual(parsed.lower, undefined);
    assert.strictEqual(parsed.upper, undefined);
    assert.strictEqual(parsed.n, 200);
    assert.strictEqual(parsed.split, 'grading-only');
  });
});

describe('updateProgressLogEntries', () => {
  const baseEntry: ProgressLogRow = {
    commit: 'abc1234*',
    date: '2026-10-15',
    ruleSetHash: 'hash-rules-1',
    splitHash: 'hash-split-1',
    gradesHash: 'hash-grades-1',
    judgeVersion: 'v1',
    coverage: { value: 0.1, n: 100, split: 'grading-only' },
    precision: { value: 0.9, lower: 0.85, upper: 0.95, n: 50, split: 'grading-only' },
    recall: { value: 0.8, lower: 0.7, upper: 0.9, n: 40, split: 'grading-only' },
    judgeAlpha: 0.72,
    judgeAc1: 0.94,
    canaryTnr: 1.0,
    notes: 'provisional test run',
  };

  it('appends entry when commit is new', () => {
    const updated = updateProgressLogEntries([], baseEntry);
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].commit, 'abc1234*');
  });

  it('replaces provisional abc1234* when re-run on clean abc1234', () => {
    const initialList = [
      { ...baseEntry, commit: 'old1111' },
      { ...baseEntry, commit: 'abc1234*' },
    ];

    const cleanEntry: ProgressLogRow = {
      ...baseEntry,
      commit: 'abc1234',
      notes: 'clean run',
    };

    const updated = updateProgressLogEntries(initialList, cleanEntry);
    assert.strictEqual(updated.length, 2);
    assert.strictEqual(updated[0].commit, 'old1111');
    assert.strictEqual(updated[1].commit, 'abc1234');
    assert.strictEqual(updated[1].notes, 'clean run');
  });

  it('updates provisional entry when re-run on dirty commit', () => {
    const initialList = [{ ...baseEntry, commit: 'abc1234*' }];
    const updatedProvisional: ProgressLogRow = {
      ...baseEntry,
      commit: 'abc1234*',
      judgeAlpha: 0.85,
    };

    const updated = updateProgressLogEntries(initialList, updatedProvisional);
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].commit, 'abc1234*');
    assert.strictEqual(updated[0].judgeAlpha, 0.85);
  });
});

describe('formatProgressLogMarkdown and parseProgressLogMarkdown', () => {
  it('round-trips entries accurately across the 4-table pipeline scoreboard', () => {
    const entries: ProgressLogRow[] = [
      {
        commit: 'abc1234',
        date: '2026-10-15',
        ruleSetHash: 'rules1111222',
        splitHash: 'split2222333',
        gradesHash: 'grades333444',
        judgeVersion: 'v1-latin',
        coverage: { value: 0.125, n: 200, split: 'grading-only' },
        precision: { value: 0.923, lower: 0.881, upper: 0.954, n: 60, split: 'grading-only' },
        recall: { value: 0.81, lower: 0.724, upper: 0.878, n: 45, split: 'grading-only' },
        judgeAlpha: 0.72,
        judgeAc1: 0.94,
        canaryTnr: 1.0,
        notes: 'baseline run',
      },
    ];

    const markdown = formatProgressLogMarkdown(entries);
    assert.ok(markdown.includes('# Analyzer Progress Log'));
    assert.ok(markdown.includes('## Current Verified Benchmark'));
    assert.ok(markdown.includes('`abc1234`'));
    assert.ok(markdown.includes('## Table 1: Gate 0 Catalog Triage & Agreement'));
    assert.ok(markdown.includes('## Table 2: Judge & Phase 2 Calibration Health'));
    assert.ok(markdown.includes('## Table 3: Held-Out Detection Funnel & Qualified Rules'));
    assert.ok(markdown.includes('## Table 4: Minimal M4 Static Fix Smoke Test'));

    const parsed = parseProgressLogMarkdown(markdown);
    assert.strictEqual(parsed.length, 1);
    const p = parsed[0];
    assert.strictEqual(p.commit, 'abc1234');
    assert.strictEqual(p.date, '2026-10-15');
    assert.strictEqual(p.ruleSetHash, 'rules1111222');
    assert.strictEqual(p.splitHash, 'split2222333');
    assert.strictEqual(p.gradesHash, 'grades333444');
    assert.strictEqual(p.judgeVersion, 'v1-latin');
    assert.strictEqual(p.coverage.value, 0.125);
    assert.strictEqual(p.precision.value, 0.923);
    assert.strictEqual(p.precision.lower, 0.881);
    assert.strictEqual(p.precision.upper, 0.954);
    assert.strictEqual(p.recall.value, 0.81);
    assert.strictEqual(p.judgeAlpha, 0.72);
    assert.strictEqual(p.judgeAc1, 0.94);
    assert.strictEqual(p.canaryTnr, 1.0);
    assert.strictEqual(p.notes, 'baseline run');

    const scoreboard = parsePipelineScoreboardMarkdown(markdown);
    assert.ok(scoreboard.currentBenchmark);
    assert.strictEqual(scoreboard.currentBenchmark.commit, 'abc1234');
    assert.strictEqual(scoreboard.gate0Triage.length, HISTORICAL_GATE0_TRIAGE_ROWS.length);
    assert.strictEqual(scoreboard.judgeCalibration.length, 4);
    assert.strictEqual(scoreboard.detectionFunnel.length, 1);
    assert.strictEqual(scoreboard.fixSmokeTest.length, 3);
  });

  it('verifies historical backfill rows and data integrity', () => {
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS.length, 1);
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS[0].runId, 'gate0-v1-full-guide');
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS[0].detectable, 49);

    assert.strictEqual(HISTORICAL_JUDGE_CALIBRATION_ROWS.length, 4);
    assert.strictEqual(HISTORICAL_JUDGE_CALIBRATION_ROWS[0].judgeVersion, 'gemini-3.8-flash:detective-v2-direct');
    assert.strictEqual(HISTORICAL_JUDGE_CALIBRATION_ROWS[3].judgeVersion, 'gemini-3.8-flash:detective-v4-guide-only');
    // Mislabeled 153dbc5* duplicate row MUST be excluded (R31)
    assert.ok(HISTORICAL_JUDGE_CALIBRATION_ROWS.every((r) => !r.commit.includes('153dbc5')));

    assert.strictEqual(HISTORICAL_DETECTION_FUNNEL_ROWS.length, 8);
    for (const row of HISTORICAL_DETECTION_FUNNEL_ROWS) {
      assert.ok(
        row.notes?.includes('[pre-guide-phase2: Phase 2 ran without guide.md]'),
        `Row ${row.commit} notes must be tagged [pre-guide-phase2: Phase 2 ran without guide.md]`,
      );
    }
    assert.ok(HISTORICAL_DETECTION_FUNNEL_ROWS.every((r) => !r.commit.includes('153dbc5')));

    assert.strictEqual(HISTORICAL_FIX_SMOKE_TEST_ROWS.length, 3);
    assert.strictEqual(HISTORICAL_FIX_SMOKE_TEST_ROWS[0].harnessVersion, 'fix-harness-m4');
    assert.strictEqual(HISTORICAL_FIX_SMOKE_TEST_ROWS[1].harnessVersion, 'fix-harness-m4-r2');
    assert.strictEqual(HISTORICAL_FIX_SMOKE_TEST_ROWS[2].harnessVersion, 'fix-harness-m4-r3');
  });

  it('parses individual tables independently', () => {
    const markdown = formatProgressLogMarkdown(HISTORICAL_DETECTION_FUNNEL_ROWS);
    const gate0Rows = parseGate0TriageMarkdown(markdown);
    assert.strictEqual(gate0Rows.length, HISTORICAL_GATE0_TRIAGE_ROWS.length);
    assert.strictEqual(gate0Rows[0].runId, 'gate0-v1-full-guide');

    const judgeRows = parseJudgeCalibrationMarkdown(markdown);
    assert.strictEqual(judgeRows.length, 4);
    assert.strictEqual(judgeRows[0].commit, 'dafe9ee');

    const funnelRows = parseProgressLogMarkdown(markdown);
    assert.strictEqual(funnelRows.length, 8);

    const fixRows = parseFixSmokeTestMarkdown(markdown);
    assert.strictEqual(fixRows.length, 3);
    assert.strictEqual(fixRows[0].commit, 'e23f54256');
  });
});

describe('file operations and hashes', () => {
  it('computes 12-char SHA-256 for real repo files', async () => {
    const splitHash = await computeFileHash(REPOS_CONFIG_PATH);
    assert.strictEqual(splitHash.length, 12);
    assert.match(splitHash, /^[0-9a-f]{12}$/);

    const gradesHash = await computeFileHash(GRADES_PATH);
    assert.strictEqual(gradesHash.length, 12);
    assert.match(gradesHash, /^[0-9a-f]{12}$/);
  });

  it('determines git commit state', () => {
    const state = getGitCommitState();
    assert.ok(state.commit.length >= 7);
    assert.strictEqual(typeof state.isDirty, 'boolean');
  });

  it('records progress log entries to file with atomic replacement', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'progress-log-test-'));
    const testLogPath = join(tempDir, 'PROGRESS.md');

    try {
      const provisional: ProgressLogRow = {
        commit: '1234567*',
        date: '2026-10-15',
        ruleSetHash: 'hash1',
        splitHash: 'hash2',
        gradesHash: 'hash3',
        judgeVersion: 'v1',
        coverage: { value: 0.1, n: 10, split: 'grading-only' },
        precision: { value: 0.9, lower: 0.8, upper: 0.95, n: 10, split: 'grading-only' },
        recall: { value: 0.8, n: 10, split: 'grading-only' },
        judgeAlpha: 0.7,
        judgeAc1: 0.9,
        canaryTnr: 1.0,
        notes: 'provisional',
      };

      await recordProgressLogEntry(provisional, testLogPath);
      let content = await readFile(testLogPath, 'utf8');
      assert.ok(content.includes('`1234567*`'));

      const clean: ProgressLogRow = {
        ...provisional,
        commit: '1234567',
        notes: 'clean committed',
      };

      await recordProgressLogEntry(clean, testLogPath);
      content = await readFile(testLogPath, 'utf8');
      // Must contain clean commit and must NOT contain duplicate or old provisional
      assert.ok(content.includes('`1234567`'));
      assert.ok(!content.includes('`1234567*`'));
      assert.ok(content.includes('clean committed'));

      const parsed = parseProgressLogMarkdown(content);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].commit, '1234567');
      assert.strictEqual(parsed[0].notes, 'clean committed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
