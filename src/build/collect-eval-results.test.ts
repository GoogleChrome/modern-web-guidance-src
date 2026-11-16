import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectSummariesFromPublicEvals,
  type PublicSuiteManifestEntry,
} from './collect-eval-results.ts';

test('collectSummariesFromPublicEvals filters invalid/non-nightly entries and returns top N sorted by timestamp desc', () => {
  const manifest: PublicSuiteManifestEntry[] = [
    {
      testId: 'opus-medium-1.0-rc-2026-11-08',
      timestamp: '2026-11-16T00:00:00.000Z',
      agent: 'claude_code',
      model: 'claude-opus-5-5',
      taskCount: 229,
      guidedStats: { passed: 1800, total: 1961 },
      unguidedStats: { passed: 1100, total: 1961 },
    },
    {
      testId: 'nightly-2026-11-15_04-22-06-codex_cli',
      timestamp: '2026-11-15T05:21:14.016Z',
      agent: 'codex_cli',
      model: 'gpt-6.1-sol',
      taskCount: 229,
      guidedStats: { passed: 1706, total: 1961 },
      unguidedStats: { passed: 980, total: 1961 },
    },
    {
      testId: 'nightly-2026-11-15_00-00-03-antigravity_cli',
      timestamp: '2026-11-15T06:00:00.000Z',
      agent: 'antigravity_cli',
      model: 'gemini-4-argon',
      taskCount: 229,
      guidedStats: { passed: 1892, total: 1951 },
      unguidedStats: { passed: 1093, total: 1951 },
    },
    {
      testId: 'nightly-2026-11-14_04-00-00-claude_code',
      timestamp: '2026-11-14T05:00:00.000Z',
      agent: 'claude_code',
      model: 'claude-opus-5-5',
      taskCount: 228,
      guidedStats: { passed: 1854, total: 1952 },
      unguidedStats: { passed: 1093, total: 1952 },
    },
    // Filtered: taskCount < 60
    {
      testId: 'nightly-2026-11-15_08-00-00-claude_code',
      timestamp: '2026-11-15T08:30:00.000Z',
      agent: 'claude_code',
      model: 'claude-opus-5-5',
      taskCount: 10,
      guidedStats: { passed: 1710, total: 1900 },
      unguidedStats: { passed: 1045, total: 1900 },
    },
    // Filtered: zero unguided pass rate
    {
      testId: 'nightly-2026-11-15_07-00-00-claude_code',
      timestamp: '2026-11-15T07:30:00.000Z',
      agent: 'claude_code',
      model: 'claude-opus-5-5',
      taskCount: 220,
      guidedStats: { passed: 1710, total: 1900 },
      unguidedStats: { passed: 0, total: 1900 },
    },
    // Filtered: non-allowlisted agent
    {
      testId: 'nightly-2026-11-15_09-00-00-pi',
      timestamp: '2026-11-15T09:30:00.000Z',
      agent: 'pi',
      model: 'openrouter/test',
      taskCount: 220,
      guidedStats: { passed: 1615, total: 1900 },
      unguidedStats: { passed: 950, total: 1900 },
    },
  ];

  assert.deepStrictEqual(collectSummariesFromPublicEvals(manifest, 2), [
    {
      testId: 'nightly-2026-11-15_00-00-03-antigravity_cli',
      timestamp: '2026-11-15T06:00:00.000Z',
      agent: 'antigravity_cli',
      model: 'gemini-4-argon',
      taskCount: 229,
      assertionCount: 1951,
      unguidedPassRate: 56,
      guidedPassRate: 97,
    },
    {
      testId: 'nightly-2026-11-15_04-22-06-codex_cli',
      timestamp: '2026-11-15T05:21:14.016Z',
      agent: 'codex_cli',
      model: 'gpt-6.1-sol',
      taskCount: 229,
      assertionCount: 1961,
      unguidedPassRate: 50,
      guidedPassRate: 87,
    },
  ]);
});
