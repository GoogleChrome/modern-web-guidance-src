import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  collectSummariesFromPublicEvals,
  fetchPublicEvalsManifest,
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

test('fetchPublicEvalsManifest reads public-evals/suites.gen.json from gh-pages in an isolated temp repo', () => {
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-pages-remote-'));
  try {
    execFileSync('git', ['init', '--quiet', '-b', 'gh-pages'], { cwd: remoteDir });
    execFileSync('git', ['config', 'uploadpack.allowFilter', 'true'], { cwd: remoteDir });
    fs.mkdirSync(path.join(remoteDir, 'public-evals'), { recursive: true });
    const expected: PublicSuiteManifestEntry[] = [
      { testId: 'nightly-2026-11-15_04-22-06-codex_cli', agent: 'codex_cli', taskCount: 229 },
    ];
    fs.writeFileSync(
      path.join(remoteDir, 'public-evals', 'suites.gen.json'),
      JSON.stringify(expected),
    );
    execFileSync('git', ['add', '.'], { cwd: remoteDir });
    execFileSync(
      'git',
      ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '--quiet', '-m', 'seed'],
      { cwd: remoteDir },
    );

    assert.deepStrictEqual(fetchPublicEvalsManifest(remoteDir), expected);
  } finally {
    fs.rmSync(remoteDir, { recursive: true, force: true });
  }
});

test('collectSummariesFromPublicEvals preserves slower-cadence agents when other agents have 10+ newer runs', () => {
  const makeEntry = (testId: string, timestamp: string, agent: string, model: string): PublicSuiteManifestEntry => ({
    testId,
    timestamp,
    agent,
    model,
    taskCount: 229,
    guidedStats: { passed: 1800, total: 1960 },
    unguidedStats: { passed: 1000, total: 1960 },
  });

  const manifest: PublicSuiteManifestEntry[] = [
    // 5 nights * 2 agents = 10 newer runs that would otherwise fill a global top-10 slice
    makeEntry('nightly-2026-11-20_06-00-00-antigravity_cli', '2026-11-20T06:00:00.000Z', 'antigravity_cli', 'gemini-4-argon'),
    makeEntry('nightly-2026-11-20_04-00-00-claude_code', '2026-11-20T04:00:00.000Z', 'claude_code', 'claude-opus-5-5'),
    makeEntry('nightly-2026-11-19_06-00-00-antigravity_cli', '2026-11-19T06:00:00.000Z', 'antigravity_cli', 'gemini-4-argon'),
    makeEntry('nightly-2026-11-19_04-00-00-claude_code', '2026-11-19T04:00:00.000Z', 'claude_code', 'claude-opus-5-5'),
    makeEntry('nightly-2026-11-18_06-00-00-antigravity_cli', '2026-11-18T06:00:00.000Z', 'antigravity_cli', 'gemini-4-argon'),
    makeEntry('nightly-2026-11-18_04-00-00-claude_code', '2026-11-18T04:00:00.000Z', 'claude_code', 'claude-opus-5-5'),
    makeEntry('nightly-2026-11-17_06-00-00-antigravity_cli', '2026-11-17T06:00:00.000Z', 'antigravity_cli', 'gemini-4-argon'),
    makeEntry('nightly-2026-11-17_04-00-00-claude_code', '2026-11-17T04:00:00.000Z', 'claude_code', 'claude-opus-5-5'),
    makeEntry('nightly-2026-11-16_06-00-00-antigravity_cli', '2026-11-16T06:00:00.000Z', 'antigravity_cli', 'gemini-4-argon'),
    makeEntry('nightly-2026-11-16_04-00-00-claude_code', '2026-11-16T04:00:00.000Z', 'claude_code', 'claude-opus-5-5'),
    // Older codex_cli runs
    makeEntry('nightly-2026-11-15_05-00-00-codex_cli', '2026-11-15T05:00:00.000Z', 'codex_cli', 'gpt-6.1-sol'),
    makeEntry('nightly-2026-11-14_05-00-00-codex_cli', '2026-11-14T05:00:00.000Z', 'codex_cli', 'gpt-6.1-sol'),
    makeEntry('nightly-2026-11-13_05-00-00-codex_cli', '2026-11-13T05:00:00.000Z', 'codex_cli', 'gpt-6.1-sol'),
  ];

  const result = collectSummariesFromPublicEvals(manifest, 10);
  assert.strictEqual(result.length, 10);
  assert.deepStrictEqual(
    result.filter(r => r.agent === 'codex_cli').map(r => r.testId),
    [
      'nightly-2026-11-15_05-00-00-codex_cli',
      'nightly-2026-11-14_05-00-00-codex_cli',
    ],
  );
  // Output remains sorted newest-first overall
  const timestamps = result.map(r => Date.parse(r.timestamp));
  assert.deepStrictEqual(timestamps, [...timestamps].sort((a, b) => b - a));
});
