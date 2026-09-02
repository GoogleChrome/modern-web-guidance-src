import { test } from 'node:test';
import assert from 'node:assert';
import { generateJsonReport, generateMarkdownReport } from '../lib/reporting.ts';
import type { Metrics, RunResult } from '../lib/metrics.ts';

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
  assert.ok(md.includes('| ✅ | Check 1 |'));
  assert.ok(md.includes('&lt;with angle brackets&gt;'));
});

test('generateJsonReport includes skillVersion and cliVersion when provided', () => {
  const report = generateJsonReport(
    dummyMetrics,
    {},
    '2026-06-26T14:00:00Z',
    1,
    'gemini-cli',
    'mcp',
    'gemini-pro',
    1234,
    '2026_05_16-c5e78707',
    '0.0.174'
  );

  assert.strictEqual(report.skillVersion, '2026_05_16-c5e78707');
  assert.strictEqual(report.cliVersion, '0.0.174');
  assert.strictEqual(report.agent, 'gemini-cli');
  assert.strictEqual(report.serving, 'mcp');
});

test('generateJsonReport handles omitted optional version parameters gracefully', () => {
  const report = generateJsonReport(
    dummyMetrics,
    {},
    '2026-06-26T14:00:00Z',
    1,
    'codex',
    'skills_cli',
    'gpt-4o'
  );

  assert.strictEqual(report.skillVersion, undefined);
  assert.strictEqual(report.cliVersion, undefined);
  assert.strictEqual(report.agent, 'codex');
});
