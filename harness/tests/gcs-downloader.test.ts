import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { downloadRunFromGcsIfMissing, downloadSuiteEvalsIfMissing } from '../lib/gcs-downloader.ts';
import { NORMALIZER_VERSION } from '../lib/trajectory-normalizer.ts';
import { resultsDir } from '../../lib/paths.ts';

describe('gcs-downloader', () => {
  test('downloadRunFromGcsIfMissing returns early when complete directory exists locally and upgrades stale trajectory_summary.json', async () => {
    const testSuite = `test-gcs-local-${Date.now()}`;
    const testRunDir = path.join(resultsDir, testSuite, '1', 'details-styling', 'task', 'guided');
    fs.mkdirSync(testRunDir, { recursive: true });
    try {
      // Create local run directory with suite evals.json, _results.json, stale trajectory_summary.json (no normalizerVersion), and raw session log
      fs.writeFileSync(path.join(resultsDir, testSuite, 'evals.json'), JSON.stringify({ suite: testSuite, agent: 'claude_code' }));
      fs.writeFileSync(path.join(testRunDir, 'details-styling_results.json'), JSON.stringify({ suites: [] }));
      fs.writeFileSync(path.join(testRunDir, 'trajectory_summary.json'), JSON.stringify({ agent: 'claude_code', steps: [{ stepNumber: 1 }] }));
      fs.writeFileSync(
        path.join(testRunDir, 'session-1.jsonl'),
        JSON.stringify({
          role: 'assistant',
          timestamp: '2026-08-09T21:00:00.000Z',
          message: { content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'npx modern-web-guidance search "dialog"' } }] }
        })
      );

      // Calling downloadRunFromGcsIfMissing should hit cache AND upgrade trajectory_summary.json to NORMALIZER_VERSION
      const result = await downloadRunFromGcsIfMissing(testRunDir);
      assert.strictEqual(result, true);

      const upgradedSummary = JSON.parse(fs.readFileSync(path.join(testRunDir, 'trajectory_summary.json'), 'utf8'));
      assert.strictEqual(upgradedSummary.normalizerVersion, NORMALIZER_VERSION);
      assert.strictEqual(upgradedSummary.steps[0].action.canonicalCategory, 'skill_search');
    } finally {
      fs.rmSync(path.join(resultsDir, testSuite), { recursive: true, force: true });
    }
  });

  test('partial local directory with only trajectory_summary.json (missing _results.json and sentinel) triggers GCS download instead of returning cached true', async () => {
    const testSuite = `test-gcs-partial-${Date.now()}`;
    const testRunDir = path.join(resultsDir, testSuite, '1', 'details-styling', 'task', 'guided');
    fs.mkdirSync(testRunDir, { recursive: true });

    const origFetch = globalThis.fetch;
    const origToken = process.env.GD_GCS_TOKEN;
    let listApiCalled = false;

    try {
      fs.writeFileSync(path.join(resultsDir, testSuite, 'evals.json'), JSON.stringify({ suite: testSuite }));
      // Only trajectory_summary.json is present (no _results.json, no runtime.json, no .gcs_download_complete)
      fs.writeFileSync(
        path.join(testRunDir, 'trajectory_summary.json'),
        JSON.stringify({ normalizerVersion: NORMALIZER_VERSION, agent: 'claude_code', steps: [{ stepNumber: 1 }] })
      );

      process.env.GD_GCS_TOKEN = 'Bearer mock-test-token';
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('prefix=')) {
          listApiCalled = true;
          return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      const result = await downloadRunFromGcsIfMissing(testRunDir);
      assert.strictEqual(listApiCalled, true, 'Expected GCS list API to be invoked for incomplete local run directory');
      assert.strictEqual(result, false, 'Expected false when GCS returns 0 files for partial directory');
    } finally {
      globalThis.fetch = origFetch;
      if (origToken === undefined) {
        delete process.env.GD_GCS_TOKEN;
      } else {
        process.env.GD_GCS_TOKEN = origToken;
      }
      fs.rmSync(path.join(resultsDir, testSuite), { recursive: true, force: true });
    }
  });

  test('downloadSuiteEvalsIfMissing deduplicates concurrent downloads for the same suiteName', async () => {
    const testSuite = `test-gcs-dedup-${Date.now()}`;
    const origFetch = globalThis.fetch;
    let fetchCount = 0;

    try {
      globalThis.fetch = (async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 25));
        return new Response(JSON.stringify({ suite: testSuite, agent: 'claude_code' }), { status: 200 });
      }) as typeof fetch;

      await Promise.all([
        downloadSuiteEvalsIfMissing(testSuite, 'Bearer mock-token'),
        downloadSuiteEvalsIfMissing(testSuite, 'Bearer mock-token'),
        downloadSuiteEvalsIfMissing(testSuite, 'Bearer mock-token')
      ]);

      assert.strictEqual(fetchCount, 1, 'Expected concurrent evals.json downloads for the same suite to be deduplicated into a single request');
      assert.ok(fs.existsSync(path.join(resultsDir, testSuite, 'evals.json')));
    } finally {
      globalThis.fetch = origFetch;
      fs.rmSync(path.join(resultsDir, testSuite), { recursive: true, force: true });
    }
  });

  test('validates GCS bucket configuration constants', async () => {
    const gcsModule = await import('../lib/gcs-downloader.ts');
    assert.ok(gcsModule.downloadRunFromGcsIfMissing);
    assert.strictEqual(typeof gcsModule.downloadRunFromGcsIfMissing, 'function');
  });

  test('resolveRunPath resolves both repo-relative and results-relative suite paths', async () => {
    const { resolveRunPath } = await import('../lib/gcs-downloader.ts');
    const relativeSuite = 'nightly-2026-08-10_17-00-02-jetski_cli/1/details-styling/task/guided';

    // Results-relative path
    const resolved1 = resolveRunPath(relativeSuite);
    assert.ok(resolved1);
    assert.strictEqual(resolved1.relativeRunPath, relativeSuite);
    assert.ok(resolved1.absoluteRunDir.endsWith(relativeSuite));

    // Repo-relative path
    const resolved2 = resolveRunPath(`harness/results/${relativeSuite}`);
    assert.ok(resolved2);
    assert.strictEqual(resolved2.relativeRunPath, relativeSuite);
    assert.ok(resolved2.absoluteRunDir.endsWith(relativeSuite));
  });
});
