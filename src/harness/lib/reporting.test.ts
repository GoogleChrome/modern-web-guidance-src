import { test } from 'node:test';
import assert from 'node:assert';
import { generateJsonReport, generateMarkdownReport } from './reporting.ts';
import type { Metrics, RunResult } from './metrics.ts';

const dummyMetrics: Metrics = {
  summary: {
    unguidedMedian: 0,
    guidedMedian: 100,
    unguidedPassRate: 0,
    guidedPassRate: 100,
    unguidedPassed: 0,
    unguidedTotal: 10,
    guidedPassed: 10,
    guidedTotal: 10,
    runsPerTest: 1,
  },
  testStats: {
    'daily-grind - size-aware-styling - guided': {
      medianPassRate: 100,
      runPassRates: [100],
      passedChecks: 2,
      totalChecks: 2,
    },
  },
  sortedKeys: ['daily-grind - size-aware-styling - guided'],
};

test('generateMarkdownReport renders combined unguided and guided columns for paired runs', () => {
  const pairedMetrics: Metrics = {
    summary: {
      unguidedMedian: 50,
      guidedMedian: 100,
      unguidedPassRate: 50,
      guidedPassRate: 100,
      unguidedPassed: 1,
      unguidedTotal: 2,
      guidedPassed: 2,
      guidedTotal: 2,
      runsPerTest: 1,
    },
    testStats: {
      'daily-grind - size-aware-styling - unguided': {
        medianPassRate: 50,
        runPassRates: [50],
        passedChecks: 1,
        totalChecks: 2,
      },
      'daily-grind - size-aware-styling - guided': {
        medianPassRate: 100,
        runPassRates: [100],
        passedChecks: 2,
        totalChecks: 2,
      },
    },
    sortedKeys: [
      'daily-grind - size-aware-styling - unguided',
      'daily-grind - size-aware-styling - guided',
    ],
  };

  const allResults: Record<string, RunResult[]> = {
    'daily-grind - size-aware-styling - unguided': [
      {
        runNumber: 1,
        results: [
          { id: '1', passed: true, message: 'Check 1' },
          { id: '2', passed: false, message: 'Check 2 <with angle brackets>' },
        ],
      },
    ],
    'daily-grind - size-aware-styling - guided': [
      {
        runNumber: 1,
        results: [
          { id: '1', passed: true, message: 'Check 1' },
          { id: '2', passed: true, message: 'Check 2 <with angle brackets>' },
        ],
        guidesUsed: ['size-aware-styling'],
        guidanceToolsUsed: ['modern-web-guidance'],
      },
    ],
  };

  const md = generateMarkdownReport(pairedMetrics, allResults);
  assert.ok(md.includes('## DAILY-GRIND - SIZE-AWARE-STYLING'));
  assert.ok(!md.includes('## DAILY-GRIND - SIZE-AWARE-STYLING - UNGUIDED'));
  assert.ok(!md.includes('## DAILY-GRIND - SIZE-AWARE-STYLING - GUIDED'));
  assert.ok(!md.includes('**Pass rates across runs:**'));
  assert.ok(md.includes('| Unguided (1/2) | Guided (2/2) | Expectation |'));
  assert.ok(md.includes('| ✅ | ✅ | Check 1 |'));
  assert.ok(md.includes('| ❌ | ✅ | Check 2 &lt;with angle brackets&gt; |'));
});

test('generateMarkdownReport renders pass rates across runs when runsPerTest > 1', () => {
  const multiRunMetrics: Metrics = {
    summary: {
      unguidedMedian: 50,
      guidedMedian: 100,
      unguidedPassRate: 50,
      guidedPassRate: 83,
      unguidedPassed: 3,
      unguidedTotal: 6,
      guidedPassed: 5,
      guidedTotal: 6,
      runsPerTest: 3,
    },
    testStats: {
      'daily-grind - size-aware-styling - unguided': {
        medianPassRate: 50,
        runPassRates: [0, 50, 100],
        passedChecks: 3,
        totalChecks: 6,
      },
      'daily-grind - size-aware-styling - guided': {
        medianPassRate: 100,
        runPassRates: [50, 100, 100],
        passedChecks: 5,
        totalChecks: 6,
      },
    },
    sortedKeys: [
      'daily-grind - size-aware-styling - unguided',
      'daily-grind - size-aware-styling - guided',
    ],
  };

  const allResults: Record<string, RunResult[]> = {
    'daily-grind - size-aware-styling - unguided': [
      { runNumber: 1, results: [{ id: '1', passed: false, message: 'Check 1' }, { id: '2', passed: false, message: 'Check 2' }] },
      { runNumber: 2, results: [{ id: '1', passed: true, message: 'Check 1' }, { id: '2', passed: false, message: 'Check 2' }] },
      { runNumber: 3, results: [{ id: '1', passed: true, message: 'Check 1' }, { id: '2', passed: true, message: 'Check 2' }] },
    ],
    'daily-grind - size-aware-styling - guided': [
      { runNumber: 1, results: [{ id: '1', passed: true, message: 'Check 1' }, { id: '2', passed: false, message: 'Check 2' }] },
      { runNumber: 2, results: [{ id: '1', passed: true, message: 'Check 1' }, { id: '2', passed: true, message: 'Check 2' }] },
      { runNumber: 3, results: [{ id: '1', passed: true, message: 'Check 1' }, { id: '2', passed: true, message: 'Check 2' }] },
    ],
  };

  const md = generateMarkdownReport(multiRunMetrics, allResults);
  assert.ok(md.includes('**Pass rates across runs:** Unguided: 0%, 50%, 100% (Median: 50%) | Guided: 50%, 100%, 100% (Median: 100%)'));
  assert.ok(md.includes('| Unguided (1/2) | Guided (2/2) | Expectation |'));
  assert.ok(md.includes('| ✅ | ✅ | Check 1 |'));
  assert.ok(md.includes('| ❌ | ✅ | Check 2 |'));
});

test('generateMarkdownReport renders summary table, tools used, guides consumed, and checks', () => {
  const allResults: Record<string, RunResult[]> = {
    'daily-grind - size-aware-styling - guided': [
      {
        runNumber: 1,
        results: [
          { id: '1', passed: true, message: 'Check 1' },
          { id: '2', passed: false, message: 'Check 2 <with angle brackets>' },
        ],
        guidesUsed: ['size-aware-styling'],
        guidanceToolsUsed: ['modern-web-guidance'],
      },
    ],
  };

  const md = generateMarkdownReport(dummyMetrics, allResults);
  assert.ok(md.includes('| Group | Pass Rate | Test Runs |'));
  assert.ok(md.includes('**Guides Consumed:** size-aware-styling'));
  assert.ok(md.includes('**Tools Used:** modern-web-guidance'));
  assert.ok(md.includes('| Guided (1/2) | Expectation |'));
  assert.ok(md.includes('| ✅ | Check 1 |'));
  assert.ok(md.includes('&lt;with angle brackets&gt;'));
});

test('generateMarkdownReport renders N/A when runPassRates is empty due to infra errors', () => {
  const metricsWithEmptyRuns: Metrics = {
    summary: {
      unguidedMedian: 0,
      guidedMedian: 0,
      unguidedPassRate: 0,
      guidedPassRate: 0,
      unguidedPassed: 0,
      unguidedTotal: 0,
      guidedPassed: 0,
      guidedTotal: 0,
      runsPerTest: 1,
    },
    testStats: {
      'daily-grind - size-aware-styling - guided': {
        medianPassRate: 0,
        runPassRates: [],
        passedChecks: 0,
        totalChecks: 0,
      },
    },
    sortedKeys: ['daily-grind - size-aware-styling - guided'],
  };

  const allResults: Record<string, RunResult[]> = {
    'daily-grind - size-aware-styling - guided': [
      {
        runNumber: 1,
        results: [
          { id: 'early-failure-1', passed: false, message: 'Grader not found', isEarlyFailure: true },
        ],
      },
    ],
  };

  const md = generateMarkdownReport(metricsWithEmptyRuns, allResults);
  assert.ok(md.includes('**Pass rates across runs:** N/A'));
  assert.ok(!md.includes('**Pass rates across runs:** %'));
});

test('generateJsonReport includes skillVersion and cliVersion when provided', () => {
  const report = generateJsonReport(
    dummyMetrics,
    {},
    '2026-06-26T14:00:00Z',
    1,
    'gemini-cli',
    'gemini-pro',
    1234,
    '2026_05_16-c5e78707',
    '0.0.174'
  );

  assert.strictEqual(report.skillVersion, '2026_05_16-c5e78707');
  assert.strictEqual(report.cliVersion, '0.0.174');
  assert.strictEqual(report.agent, 'gemini-cli');
  assert.strictEqual(report.serving, 'skills_cli');
});

test('generateJsonReport handles omitted optional version parameters gracefully', () => {
  const report = generateJsonReport(
    dummyMetrics,
    {},
    '2026-06-26T14:00:00Z',
    1,
    'codex',
    'gpt-4o'
  );

  assert.strictEqual(report.skillVersion, undefined);
  assert.strictEqual(report.cliVersion, undefined);
  assert.strictEqual(report.agent, 'codex');
});
