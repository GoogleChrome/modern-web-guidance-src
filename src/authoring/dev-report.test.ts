import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  computeDevReportFlag,
  computeTargetSummary,
  buildInitialDevReport,
  findTestedToSkippedExpectations,
  type TargetEvalSummary,
} from './dev-report.ts';
import { extractManifestEntries } from '../core/grader-coverage.ts';
import { getGuideResultsDir } from '../core/paths.ts';
import { findSharedFailingTests } from '../grading/run-grader.ts';
import { Agents } from '../harness/config.ts';

test('computeDevReportFlag enforces strict priority ordering', () => {
  // 0. Calibration failure takes top priority
  const calibResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasCalibrationFailure: true,
    calibrationFailureMessage: 'All golden solutions failed assertion hasCard',
    hasEarlyFailure: true,
    earlyFailureMessage: 'Ignored early failure',
    toolsUsed: [],
    guidesConsumed: [],
    guidedPassRate: 0,
  });
  assert.strictEqual(calibResult.flag, 'CALIBRATION_FAILED');
  assert.ok(calibResult.flagDetails.includes('All golden solutions failed assertion hasCard'));

  // 1. Infrastructure error takes next priority
  const infraResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: true,
    earlyFailureMessage: 'Process exited with code 1',
    toolsUsed: [],
    guidesConsumed: [],
    guidedPassRate: 0,
  });
  assert.strictEqual(infraResult.flag, 'INFRASTRUCTURE_ERROR');
  assert.ok(infraResult.flagDetails.includes('Process exited with code 1'));

  // 2. Missing guidance tool takes second priority (even if guide missing and low pass rate)
  const missingToolResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: [],
    guidesConsumed: [],
    guidedPassRate: 50,
  });
  assert.strictEqual(missingToolResult.flag, 'MISSING_GUIDANCE_TOOL');
  assert.ok(missingToolResult.flagDetails.includes('did not invoke modern-web-guidance'));

  // 3. Missing expected guide takes third priority (when tool is present, but expected guide is missing)
  const missingGuideResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: ['modern-web-guidance'],
    guidesConsumed: ['some-other-guide'],
    guidedPassRate: 50,
  });
  assert.strictEqual(missingGuideResult.flag, 'MISSING_EXPECTED_GUIDE');
  assert.ok(missingGuideResult.flagDetails.includes("did not consume the expected guide 'size-aware-styling'"));

  // 4. Low guided pass rate (< 90%)
  const lowPassRateResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: ['modern-web-guidance'],
    guidesConsumed: ['size-aware-styling'],
    guidedPassRate: 75,
  });
  assert.strictEqual(lowPassRateResult.flag, 'LOW_GUIDED_PASS_RATE');
  assert.ok(lowPassRateResult.flagDetails.includes('75%'));

  // 5. High unguided pass rate (=== 100%)
  const highUnguidedResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: ['modern-web-guidance'],
    guidesConsumed: ['size-aware-styling'],
    guidedPassRate: 100,
    unguidedPassRate: 100,
  });
  assert.strictEqual(highUnguidedResult.flag, 'HIGH_UNGUIDED_PASS_RATE');
  assert.ok(highUnguidedResult.flagDetails.includes('Unguided pass rate is 100%'));

  // 6. Healthy (>= 90%, unguided < 100%, and all tools/guides present)
  const healthyResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: ['modern-web-guidance'],
    guidesConsumed: ['size-aware-styling'],
    guidedPassRate: 100,
    unguidedPassRate: 75,
  });
  assert.strictEqual(healthyResult.flag, 'HEALTHY');
  assert.ok(healthyResult.flagDetails.includes('≥ 90%'));
});

test('computeTargetSummary extracts metrics and flags from evals.json correctly', (t) => {
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-dev-report-'));
  const tmpDir = path.join(rootTmp, 'size-aware-styling');
  const category = 'css';
  const name = 'size-aware-styling';
  const guideResultsDir = getGuideResultsDir({ category, name });
  const testResultsDir = path.join(guideResultsDir, 'daily-grind');
  fs.mkdirSync(testResultsDir, { recursive: true });

  const mockEvalsJson = {
    summary: {
      guidedPassRate: 50,
      unguidedPassRate: 50,
      guidedEarlyFailures: 0,
    },
    results: {
      'daily-grind - size-aware-styling - guided': [
        {
          results: [
            { passed: true, message: 'Check 1' },
            { passed: false, message: 'Check 2' },
          ],
          guidanceToolsUsed: ['modern-web-guidance'],
          guidesUsed: ['size-aware-styling'],
          expectedToolPrefixes: ['modern-web-guidance'],
          prompt: 'Update the app components.',
        },
      ],
      'daily-grind - size-aware-styling - unguided': [
        {
          results: [
            { passed: true, message: 'Check 1' },
            { passed: false, message: 'Check 2' },
          ],
          guidanceToolsUsed: [],
          guidesUsed: [],
          prompt: 'Update the app components.',
        },
      ],
    },
  };

  fs.writeFileSync(path.join(testResultsDir, 'evals.json'), JSON.stringify(mockEvalsJson));

  t.after(() => {
    fs.rmSync(rootTmp, { recursive: true, force: true });
    fs.rmSync(guideResultsDir, { recursive: true, force: true });
  });

  const summary = computeTargetSummary(tmpDir, 'daily-grind', { category, name });
  assert.ok(summary !== null);
  assert.strictEqual(summary?.baseApp, 'daily-grind');
  assert.strictEqual(summary?.guidedPassRate, 50);
  assert.strictEqual(summary?.unguidedPassRate, 50);
  assert.strictEqual(summary?.flag, 'LOW_GUIDED_PASS_RATE');
});

test('buildInitialDevReport builds interleaved report with evals and diagnostic placeholders', (t) => {
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-evals-interleaved-'));
  const tmpDir = path.join(rootTmp, 'size-aware-styling');
  const category = 'css';
  const name = 'size-aware-styling';
  const guideResultsDir = getGuideResultsDir({ category, name });
  const dgDir = path.join(guideResultsDir, 'daily-grind');
  const dtDir = path.join(guideResultsDir, 'devtools-times');
  fs.mkdirSync(dgDir, { recursive: true });
  fs.mkdirSync(dtDir, { recursive: true });

  fs.writeFileSync(path.join(dgDir, 'evals.md'), '| Run | Pass Rate |\n| guided | 100% |\n\n## DAILY-GRIND - GUIDED\n\n### Run 1 Details\n| ✅ | Check 1 |');
  fs.writeFileSync(path.join(dtDir, 'evals.md'), '| Run | Pass Rate |\n| guided | 50% |\n\n## DEVTOOLS-TIMES - GUIDED\n\n### Run 1 Details\n| ❌ | Check 2 |');

  t.after(() => {
    fs.rmSync(rootTmp, { recursive: true, force: true });
    fs.rmSync(guideResultsDir, { recursive: true, force: true });
  });

  const summaries: TargetEvalSummary[] = [
    {
      baseApp: 'daily-grind',
      flag: 'HEALTHY',
      flagDetails: 'Healthy run',
      guidedPassRate: 100,
      unguidedPassRate: 50,
    },
    {
      baseApp: 'devtools-times',
      flag: 'LOW_GUIDED_PASS_RATE',
      flagDetails: 'Low pass rate',
      guidedPassRate: 50,
      unguidedPassRate: 0,
    },
  ];

  const report = buildInitialDevReport(tmpDir, summaries, { category, name });
  assert.ok(report.includes('# Evaluation Report: size-aware-styling'));
  assert.ok(report.includes('> [!NOTE]'));
  assert.ok(report.includes('needs-dev-rerun'));
  assert.ok(report.includes('## Summary'));
  assert.ok(report.includes('<!-- TODO: Complete overall summary across all targets -->'));
  assert.ok(report.indexOf('## Summary') < report.indexOf('## Target: `daily-grind`'));
  assert.ok(report.includes('## Target: `daily-grind` (Status: `HEALTHY`)'));
  assert.ok(report.includes('### Evaluation Results'));
  assert.ok(report.includes('#### DAILY-GRIND - GUIDED'));
  assert.ok(report.includes('##### Run 1 Details'));
  assert.ok(report.includes('Check 1'));
  assert.ok(report.includes('### Diagnostic Analysis & Actionable Recommendations'));
  assert.ok(report.includes('## Target: `devtools-times` (Status: `LOW_GUIDED_PASS_RATE`)'));
  assert.ok(report.includes('#### DEVTOOLS-TIMES - GUIDED'));
  assert.ok(report.includes('Check 2'));

  const healthyReport = buildInitialDevReport(tmpDir, [summaries[0]!], { category, name });
  assert.ok(!healthyReport.includes('> [!NOTE]'));
  assert.ok(!healthyReport.includes('needs-dev-rerun'));
});

test('computeTargetSummary creates CALIBRATION_FAILED summary directly from calibration error details', () => {
  const summary = computeTargetSummary('/tmp/fake-guide', 'daily-grind', undefined, 'All golden solutions failed test 3');
  assert.ok(summary !== null);
  assert.strictEqual(summary.baseApp, 'daily-grind');
  assert.strictEqual(summary.flag, 'CALIBRATION_FAILED');
  assert.strictEqual(summary.guidedPassRate, 0);
  assert.ok(summary.flagDetails.includes('All golden solutions failed test 3'));
});

test('buildInitialDevReport formats CALIBRATION_FAILED targets with calibration details', () => {
  const summaries: TargetEvalSummary[] = [
    {
      baseApp: 'daily-grind',
      flag: 'CALIBRATION_FAILED',
      flagDetails: 'Calibration failed: shared test assertion failure on card styling',
      guidedPassRate: 0,
      unguidedPassRate: null,
    },
  ];

  const report = buildInitialDevReport('/tmp/fake-guide', summaries);
  assert.ok(report.includes('## Target: `daily-grind` (Status: `CALIBRATION_FAILED`)'));
  assert.ok(report.includes('Calibration failed prior to evaluation run:'));
  assert.ok(report.includes('shared test assertion failure on card styling'));
});

test('findSharedFailingTests extracts intersection of failing tests across active agents', () => {
  const activeAgents = [Agents.JETSKI_CLI, Agents.CLAUDE_CODE, Agents.CODEX_CLI];

  // Case 1: All 3 fail test-A and test-B
  const allFailResult = {
    [Agents.JETSKI_CLI]: { passed: 1, failed: 2, failingTests: ['test-A', 'test-B', 'test-C'] },
    [Agents.CLAUDE_CODE]: { passed: 1, failed: 2, failingTests: ['test-A', 'test-B', 'test-D'] },
    [Agents.CODEX_CLI]: { passed: 2, failed: 2, failingTests: ['test-A', 'test-B'] },
  };
  assert.deepStrictEqual(
    findSharedFailingTests(allFailResult, activeAgents),
    ['test-A', 'test-B']
  );

  // Case 2: One agent passed all tests (no failing tests)
  const onePassResult = {
    [Agents.JETSKI_CLI]: { passed: 3, failed: 0, failingTests: [] },
    [Agents.CLAUDE_CODE]: { passed: 1, failed: 2, failingTests: ['test-A', 'test-B'] },
    [Agents.CODEX_CLI]: { passed: 1, failed: 2, failingTests: ['test-A'] },
  };
  assert.deepStrictEqual(
    findSharedFailingTests(onePassResult, activeAgents),
    []
  );

  // Case 3: Disjoint failures across agents
  const disjointResult = {
    [Agents.JETSKI_CLI]: { passed: 2, failed: 1, failingTests: ['test-A'] },
    [Agents.CLAUDE_CODE]: { passed: 2, failed: 1, failingTests: ['test-B'] },
    [Agents.CODEX_CLI]: { passed: 2, failed: 1, failingTests: ['test-C'] },
  };
  assert.deepStrictEqual(
    findSharedFailingTests(disjointResult, activeAgents),
    []
  );

  // Case 4: No active agents
  assert.deepStrictEqual(findSharedFailingTests({}, []), []);
});

test('findTestedToSkippedExpectations detects TESTED to SKIPPED changes in grader manifests', (t) => {
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-manifest-flip-'));
  const beforePath = path.join(rootTmp, 'before-grader.ts');
  const afterPath = path.join(rootTmp, 'after-grader.ts');

  t.after(() => {
    fs.rmSync(rootTmp, { recursive: true, force: true });
  });

  fs.writeFileSync(
    beforePath,
    [
      '// Expectation 1: TESTED - Checks modal opening',
      '// Expectation 2: TESTED - Checks Escape dismissal',
      '// Expectation 3: SKIPPED: No form in target app or task',
      '// Expectation 4: TESTED - Checks focus restoration',
    ].join('\n')
  );
  fs.writeFileSync(
    afterPath,
    [
      '// Expectation 1: TESTED - Checks modal opening',
      '// Expectation 2: SKIPPED: Agent did not implement Escape dismissal',
      '// Expectation 3: SKIPPED: Updated skip reason for form',
      '// Expectation 4: SKIPPED: Agent did not restore focus',
    ].join('\n')
  );

  const beforeManifest = extractManifestEntries(beforePath);
  const afterManifest = extractManifestEntries(afterPath);
  assert.deepStrictEqual(findTestedToSkippedExpectations(beforeManifest, afterManifest), [2, 4]);
  assert.deepStrictEqual(findTestedToSkippedExpectations(beforeManifest, beforeManifest), []);
});
