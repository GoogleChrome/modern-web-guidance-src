import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  computeDevReportFlag,
  computeTargetSummary,
  buildInitialDevReport,
  type TargetEvalSummary,
} from './lib/dev-report.ts';

test('computeDevReportFlag enforces strict priority ordering', () => {
  // 1. Infrastructure error takes top priority
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

  // 5. Healthy (>= 90% and all tools/guides present)
  const healthyResult = computeDevReportFlag({
    guideName: 'size-aware-styling',
    hasEarlyFailure: false,
    toolsUsed: ['modern-web-guidance'],
    guidesConsumed: ['size-aware-styling'],
    guidedPassRate: 100,
  });
  assert.strictEqual(healthyResult.flag, 'HEALTHY');
  assert.ok(healthyResult.flagDetails.includes('≥ 90%'));
});

test('computeTargetSummary extracts metrics and flags from evals.json correctly', (t) => {
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-dev-report-'));
  const tmpDir = path.join(rootTmp, 'size-aware-styling');
  const testResultsDir = path.join(tmpDir, 'test-app-results', 'daily-grind');
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
  });

  const summary = computeTargetSummary(tmpDir, 'daily-grind');
  assert.ok(summary !== null);
  assert.strictEqual(summary?.baseApp, 'daily-grind');
  assert.strictEqual(summary?.guidedPassRate, 50);
  assert.strictEqual(summary?.unguidedPassRate, 50);
  assert.strictEqual(summary?.flag, 'LOW_GUIDED_PASS_RATE');
});

test('buildInitialDevReport builds interleaved report with evals and diagnostic placeholders', (t) => {
  const rootTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-evals-interleaved-'));
  const tmpDir = path.join(rootTmp, 'size-aware-styling');
  const dgDir = path.join(tmpDir, 'test-app-results', 'daily-grind');
  const dtDir = path.join(tmpDir, 'test-app-results', 'devtools-times');
  fs.mkdirSync(dgDir, { recursive: true });
  fs.mkdirSync(dtDir, { recursive: true });

  fs.writeFileSync(path.join(dgDir, 'evals.md'), '| Run | Pass Rate |\n| guided | 100% |\n\n## DAILY-GRIND - GUIDED\n\n### Run 1 Details\n| ✅ | Check 1 |');
  fs.writeFileSync(path.join(dtDir, 'evals.md'), '| Run | Pass Rate |\n| guided | 50% |\n\n## DEVTOOLS-TIMES - GUIDED\n\n### Run 1 Details\n| ❌ | Check 2 |');

  t.after(() => {
    fs.rmSync(rootTmp, { recursive: true, force: true });
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

  const report = buildInitialDevReport(tmpDir, summaries);
  assert.ok(report.includes('# Evaluation Report: size-aware-styling'));
  assert.ok(report.includes('## Target: `daily-grind` (Status: `HEALTHY`)'));
  assert.ok(report.includes('### Evaluation Results'));
  assert.ok(report.includes('#### DAILY-GRIND - GUIDED'));
  assert.ok(report.includes('##### Run 1 Details'));
  assert.ok(report.includes('Check 1'));
  assert.ok(report.includes('### Diagnostic Analysis & Actionable Recommendations'));
  assert.ok(report.includes('## Target: `devtools-times` (Status: `LOW_GUIDED_PASS_RATE`)'));
  assert.ok(report.includes('#### DEVTOOLS-TIMES - GUIDED'));
  assert.ok(report.includes('Check 2'));
});
