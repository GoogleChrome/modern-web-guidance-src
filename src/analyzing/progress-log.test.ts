import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  GRADES_PATH,
  PROGRESS_LOG_PATH,
  REPOS_CONFIG_PATH,
  WORKTREE_ROOT,
} from './paths.ts';
import {
  appendJudgeCalibrationToProgressLog,
  buildTable2CalibrationRowsSync,
  buildTable3FunnelRowsSync,
  computeFileHash,
  formatMetricCell,
  formatProgressLogMarkdown,
  getGitCommitState,
  HISTORICAL_DETECTION_FUNNEL_ROWS,
  HISTORICAL_FIX_SMOKE_TEST_ROWS,
  HISTORICAL_GATE0_TRIAGE_ROWS,
  HISTORICAL_JUDGE_CALIBRATION_ROWS,
  loadProgressHistorySync,
  parseFixSmokeTestMarkdown,
  parseGate0TriageMarkdown,
  parseJudgeCalibrationMarkdown,
  parseMetricCell,
  parsePipelineScoreboardMarkdown,
  parseProgressLogMarkdown,
  PROGRESS_HISTORY_PATH,
  type JudgeCalibrationRow,
  type ProgressLogRow,
  recordProgressLogEntry,
  updateProgressLogEntries,
} from './progress-log.ts';
import { QUALIFIED_JUDGE_METADATA } from './qualification.ts';

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

  it('formats and parses unmeasured GitMirror recall as N/A (O53)', () => {
    const metric = {
      value: 0,
      n: 0,
      split: 'unmeasured (gitmirror)',
    };
    const formatted = formatMetricCell(metric);
    assert.strictEqual(formatted, 'N/A (no local labels)');

    const parsed = parseMetricCell(formatted);
    assert.strictEqual(parsed.value, 0);
    assert.strictEqual(parsed.n, 0);
    assert.strictEqual(parsed.split, 'unmeasured (gitmirror)');
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
    assert.strictEqual(scoreboard.judgeCalibration.length, HISTORICAL_JUDGE_CALIBRATION_ROWS.length);
    assert.strictEqual(scoreboard.detectionFunnel.length, 1);
    assert.strictEqual(scoreboard.fixSmokeTest.length, 3);
  });

  it('verifies historical backfill rows and data integrity', () => {
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS.length, 4);
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS[0].runId, 'gate0-v1-full-guide');
    assert.strictEqual(HISTORICAL_GATE0_TRIAGE_ROWS[0].detectable, 49);

    assert.strictEqual(HISTORICAL_JUDGE_CALIBRATION_ROWS.length, 9);
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
    assert.strictEqual(judgeRows.length, HISTORICAL_JUDGE_CALIBRATION_ROWS.length);
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

  it('loads and validates all historical tables via type guards without unsafe casts (O52)', () => {
    const history = loadProgressHistorySync();
    assert.ok(history.gate0Triage.length >= 2);
    assert.ok(history.judgeCalibration.length >= 6);
    assert.ok(history.detectionFunnel.length >= 8);
    assert.ok(history.fixSmokeTest.length >= 3);

    for (const g of history.gate0Triage) {
      assert.ok(g.runId.length > 0);
      assert.ok(typeof g.detectable === 'number');
    }
    for (const j of history.judgeCalibration) {
      assert.ok(j.commit.length >= 7);
      assert.ok(typeof j.judgeAlpha === 'number');
      assert.ok(typeof j.judgeAc1 === 'number');
    }
    for (const f of history.fixSmokeTest) {
      assert.ok(f.commit.length >= 7);
      assert.ok(typeof f.sampleSize === 'number');
    }
  });

  it('verifies that each sourceArtifact citation has a valid format (file or git:<commit>:file) (O52)', async () => {
    const raw = await readFile(PROGRESS_HISTORY_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    assert.ok(typeof parsed === 'object' && parsed !== null);
    const rec = Object(parsed);
    const gate0Triage = Array.isArray(rec.gate0Triage) ? rec.gate0Triage : [];
    const judgeCalibration = Array.isArray(rec.judgeCalibration) ? rec.judgeCalibration : [];
    const detectionFunnel = Array.isArray(rec.detectionFunnel) ? rec.detectionFunnel : [];
    const fixSmokeTest = Array.isArray(rec.fixSmokeTest) ? rec.fixSmokeTest : [];

    const allRows = [
      ...gate0Triage,
      ...judgeCalibration,
      ...detectionFunnel,
      ...fixSmokeTest,
    ];

    for (const r of allRows) {
      assert.ok(typeof r === 'object' && r !== null && 'sourceArtifact' in r);
      const source = String(r.sourceArtifact);
      assert.ok(source.length > 0, 'every row must have a sourceArtifact citation');
      const isGitCitation = source.startsWith('git:');
      const isInternalPath = source.startsWith('analyzer-internal/');
      assert.ok(
        isGitCitation || isInternalPath,
        `Citation "${source}" must start with git:<commit>: or analyzer-internal/`,
      );
    }
  });

  it('rebuilds Table 3 purely from progress-history.json and live scorecards without stale markdown (O36, O52, O53, O61)', () => {
    const rows = buildTable3FunnelRowsSync();
    assert.ok(rows.length >= 11, 'Expected 8 historical rows + >= 3 live scorecard rows');

    // Historical rows must use corrected numbers from progress-history.json (not stale markdown)
    const a5aRow = rows.find((r) => r.commit === 'a5a253f');
    assert.ok(a5aRow);
    assert.strictEqual(a5aRow.coverage.value, 0.063, 'a5a253f coverage must be 6.3% (1/16), not 25.0%');

    const d4Row = rows.find((r) => r.commit === '1dd4409');
    assert.ok(d4Row);
    assert.strictEqual(d4Row.coverage.value, 0.033, '1dd4409 coverage must be 3.3% (1/30), not 60.0%');

    // Live scorecards for f3c2091
    const gitmirrorRow = rows.find((r) => r.commit === 'f3c2091' && r.splitHash === '74b80dcdbd61');
    assert.ok(gitmirrorRow, 'f3c2091 GitMirror row must exist');
    assert.strictEqual(formatMetricCell(gitmirrorRow.recall), 'N/A (no local labels)', 'GitMirror recall must format as N/A (no local labels)');
    assert.ok(gitmirrorRow.notes?.includes('[judge not admitted: in-sample on 116 dev cards; α < 0.667]'));
    assert.ok(gitmirrorRow.notes?.includes('[GATE MISSED: 0/7 cleared >=0.90 LB vs 4-5/7 expected; 3/7 reached n>=35]'));
    assert.ok(gitmirrorRow.notes?.includes('Phase 1 -> Phase 2: 258 -> 201 (Phase-1 prec=76.0%)'));
    assert.ok(gitmirrorRow.notes?.includes('(n=112)'));

    const local93Row = rows.find((r) => r.commit === '8f6e2bb' && r.splitHash === '845acda987f8');
    assert.ok(local93Row, '8f6e2bb Local93 row must exist');
    assert.ok(local93Row.notes?.includes('[judge not admitted: in-sample on 114 dev cards; α < 0.667]'));
    assert.ok(local93Row.notes?.includes('Phase 1 -> Phase 2: 459 -> 354 (Phase-1 prec=61.0%)'));
    assert.ok(local93Row.notes?.includes('(n=110)'));

    // Live scorecard for untuned final GitMirror
    const gitmirrorFinalRow = rows.find((r) => r.splitHash === 'd26557cf4124');
    assert.ok(gitmirrorFinalRow, 'GitMirror final row must exist');
    assert.strictEqual(formatMetricCell(gitmirrorFinalRow.recall), 'N/A (no local labels)');
    assert.strictEqual(formatMetricCell(gitmirrorFinalRow.coverage), '2.9% (n=35, final)');
    assert.ok(gitmirrorFinalRow.notes?.includes('[GATE MISSED: 1/35 cleared >=0.90 LB on untuned final split'));
    assert.ok(gitmirrorFinalRow.notes?.includes('[judge not admitted: in-sample on 114 dev cards; α < 0.667]'));
    assert.ok(gitmirrorFinalRow.notes?.includes('(n=110)'));
  });

  it('verifies that each entry in progress-history.json matches the numbers in its cited artifact (O66)', async () => {
    const raw = await readFile(PROGRESS_HISTORY_PATH, 'utf8');
    const history = JSON.parse(raw);

    // 1. Gate 0 triage rows
    for (const row of history.gate0Triage) {
      if (row.sourceArtifact.startsWith('analyzer-internal/')) {
        const fullPath = resolve(WORKTREE_ROOT, row.sourceArtifact);
        const art = JSON.parse(await readFile(fullPath, 'utf8'));
        assert.strictEqual(row.detectable, art.summary.detectable);
        assert.strictEqual(row.uiRecipe, art.summary['ui-recipe-multi-part']);
        assert.strictEqual(row.skip, art.summary['skip-no-old-way']);
      }
    }

    // 2. Judge calibration rows
    for (const row of history.judgeCalibration) {
      if (row.sourceArtifact.startsWith('analyzer-internal/') && row.sourceArtifact.endsWith('.json')) {
        const fullPath = resolve(WORKTREE_ROOT, row.sourceArtifact);
        const art = JSON.parse(await readFile(fullPath, 'utf8'));
        const commitMatches = !art.gitCommit || art.gitCommit === row.commit;
        if (art.judgeVersion === row.judgeVersion && commitMatches) {
          const alpha = art.krippendorffAlphaScored ?? art.metrics?.krippendorffAlphaScored112;
          const ac1 = art.gwetAc1Scored ?? art.metrics?.gwetAc1Scored112;
          if (alpha !== undefined) {
            assert.ok(Math.abs(row.judgeAlpha - alpha) < 0.005);
          }
          if (ac1 !== undefined) {
            assert.ok(Math.abs(row.judgeAc1 - ac1) < 0.005);
          }
          const candidateSizes: number[] = [];
          if (typeof art.totalCardsEvaluated === 'number') candidateSizes.push(art.totalCardsEvaluated);
          if (typeof art.scoredCardsCount === 'number') candidateSizes.push(art.scoredCardsCount);
          if (art.humanBreakdown && typeof art.humanBreakdown.total === 'number') {
            candidateSizes.push(art.humanBreakdown.total - (typeof art.humanBreakdown.unsure === 'number' ? art.humanBreakdown.unsure : 0));
          }
          if (candidateSizes.length > 0) {
            assert.ok(
              candidateSizes.includes(row.sampleSize),
              `Row sampleSize ${row.sampleSize} must match one of ${candidateSizes.join(', ')} in ${row.sourceArtifact}`,
            );
          }
        }
      }
    }

    // 3. Detection funnel rows
    for (const row of history.detectionFunnel) {
      if (row.sourceArtifact.startsWith('analyzer-internal/') && row.sourceArtifact.endsWith('.json')) {
        const fullPath = resolve(WORKTREE_ROOT, row.sourceArtifact);
        const art = JSON.parse(await readFile(fullPath, 'utf8'));
        if (art.summary?.overallPrecision) {
          assert.strictEqual(row.precision.n, art.summary.overallPrecision.n);
          assert.strictEqual(row.recall.n, art.summary.overallRecall.n);
          assert.ok(Math.abs(row.judgeAlpha - art.summary.judgeAlpha) < 0.001);
          assert.ok(Math.abs(row.judgeAc1 - art.summary.judgeAc1) < 0.001);
          assert.strictEqual(row.canaryTnr, art.summary.canaryTnr);
        }
      }
    }
  });

  describe('Table 2 calibration and Table 1 summary updates (O6-O9, D-042-D-045)', () => {
    it('drift-check: verifies that QUALIFIED_JUDGE_METADATA.judgeVersion appears in PROGRESS.md (D-045)', async () => {
      const progressContent = await readFile(PROGRESS_LOG_PATH, 'utf8');
      assert.ok(
        progressContent.includes(QUALIFIED_JUDGE_METADATA.judgeVersion),
        `PROGRESS.md must include QUALIFIED_JUDGE_METADATA.judgeVersion (${QUALIFIED_JUDGE_METADATA.judgeVersion})`,
      );
    });

    it('buildTable2CalibrationRowsSync includes 7-verdict judge row for b23a00ed9 marked not admitted per D-046', () => {
      const rows = buildTable2CalibrationRowsSync();
      const o9Row = rows.find((row) => row.commit === 'b23a00ed9');
      assert.ok(o9Row, 'b23a00ed9 row must be present in Table 2');
      assert.strictEqual(o9Row.judgeVersion, 'gemini-3.8-flash:detective-v6-spec22-dab7de7f');
      assert.strictEqual(o9Row.sampleSize, 35);
      assert.strictEqual(o9Row.stabilityRate, 0.971);
      assert.strictEqual(o9Row.judgeAlpha, 0.727);
      assert.strictEqual(o9Row.judgeAc1, 0.932);
      assert.strictEqual(o9Row.canaryTnr, 1.0);
      assert.ok(
        o9Row.notes?.includes(
          '[not admitted per D-046: in-sample dev set tuned against its 18 disagreements; 0 human negatives on Cohort B; D-039 pre-registered test not passed]',
        ),
      );
    });

    it('renders Table 1 full 172-guide post-origin/main catalog screening summary', () => {
      const markdown = formatProgressLogMarkdown(HISTORICAL_DETECTION_FUNNEL_ROWS);
      assert.ok(markdown.includes('### Legacy Pattern Spec & Catalog Screening Summary'));
      assert.ok(markdown.includes('172 published feature guides audited (130 in `legacy-pattern-specs.json` + 42 Gate 0 non-detectable) -> 46 statically detectable'));
      assert.ok(markdown.includes('13 `clean-1-to-1` + 33 `needs-care`'));
      assert.ok(markdown.includes('126 `do-not-write-a-rule`'));
      assert.ok(markdown.includes('35 active guides (49 rules, including 10 single-purpose `package.json` + whole-file `vendored-library` rules) wired in `ALL_RULES`'));
    });

    it('annotates Current Verified Benchmark when 5653484 is current benchmark (D-042 / D-046 / D-047 / R50)', () => {
      const funnelRows = buildTable3FunnelRowsSync();
      const markdown = formatProgressLogMarkdown(funnelRows);
      assert.ok(markdown.includes('## Current Verified Benchmark: No verified benchmark under D-046 (0 human-qualified rules; Judge de-admitted)'));
      assert.ok(markdown.includes('> **Notice (2026-10-22 / D-046 / D-047 / R50):**'));
      assert.ok(markdown.includes('Pre-remediation `Batch 4` (`5653484`) rule qualifications were suspended in `D-042` (`O6`)'));
      assert.ok(markdown.includes('TERMINAL_QUALIFIED_GUIDE_IDS = []'));
      assert.ok(markdown.includes('human blind spot-checks'));
      assert.ok(markdown.includes('5 guides achieved 35/35 judge votes'));
      assert.ok(markdown.includes('Historical Background Context (Pre-D-042 / Pre-D-046; de-admitted Judge)'));
      assert.ok(markdown.includes('Cohort A: 61/64 = 95.3% judge votes across 22 guides'));
      assert.ok(markdown.includes('Completed `R46` candidate deck rebuild'));
      assert.ok(markdown.includes('Provenance (R50):'));
    });

    it('appends and updates judge calibration row via appendJudgeCalibrationToProgressLog', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'judge-calib-test-'));
      const testLogPath = join(tempDir, 'PROGRESS.md');
      try {
        const initialEntry: ProgressLogRow = {
          commit: '1234567',
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
          notes: 'initial',
        };
        await recordProgressLogEntry(initialEntry, testLogPath);

        const testCalibRow: JudgeCalibrationRow = {
          commit: 'calib123',
          date: '2026-10-21',
          judgeVersion: 'gemini-3.8-flash:detective-v6-spec22-dab7de7f',
          sampleSize: 35,
          stabilityRate: 0.971,
          judgeAlpha: 0.727,
          judgeAc1: 0.932,
          canaryTnr: 1.0,
          notes: 'test calibration',
        };

        await appendJudgeCalibrationToProgressLog(testCalibRow, testLogPath);
        const content = await readFile(testLogPath, 'utf8');
        assert.ok(content.includes('`calib123`'));
        assert.ok(content.includes('gemini-3.8-flash:detective-v6-spec22-dab7de7f'));

        const scoreboard = parsePipelineScoreboardMarkdown(content);
        const foundRow = scoreboard.judgeCalibration.find((entry) => entry.commit === 'calib123');
        assert.ok(foundRow, 'Appended judge calibration row must be parsed back from scoreboard');
        assert.strictEqual(foundRow.judgeVersion, 'gemini-3.8-flash:detective-v6-spec22-dab7de7f');
        assert.strictEqual(foundRow.judgeAlpha, 0.727);
        assert.strictEqual(foundRow.judgeAc1, 0.932);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
