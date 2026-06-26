import { test } from 'node:test';
import assert from 'node:assert';
import { generateJsonReport } from '../lib/reporting.ts';
import type { Metrics } from '../lib/metrics.ts';

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
  testStats: {},
  sortedKeys: [],
};

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
