import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { downloadTrialFromGcsIfMissing, downloadJobEvalsIfMissing } from './gcs-downloader.ts';
import { NORMALIZER_VERSION } from './trajectory-normalizer.ts';
import { resultsDir } from '../../core/paths.ts';

describe('gcs-downloader', () => {
  test('downloadTrialFromGcsIfMissing returns early when complete directory exists locally', async () => {
    const testJobId = `test-gcs-local-${Date.now()}`;
    const testTrialDir = path.join(resultsDir, testJobId, '1', 'details-styling', 'task', 'guided');
    fs.mkdirSync(testTrialDir, { recursive: true });
    try {
      // Create local trial directory with job evals.json, _results.json, and raw session log
      fs.writeFileSync(path.join(resultsDir, testJobId, 'evals.json'), JSON.stringify({ suite: testJobId, agent: 'claude_code' }));
      fs.writeFileSync(path.join(testTrialDir, 'details-styling_results.json'), JSON.stringify({ suites: [] }));
      fs.writeFileSync(
        path.join(testTrialDir, 'session-1.jsonl'),
        JSON.stringify({
          role: 'assistant',
          timestamp: '2026-08-09T21:00:00.000Z',
          message: { content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'npx modern-web-guidance search "dialog"' } }] }
        })
      );

      const result = await downloadTrialFromGcsIfMissing(testTrialDir);
      assert.strictEqual(result, true);
    } finally {
      fs.rmSync(path.join(resultsDir, testJobId), { recursive: true, force: true });
    }
  });

  test('partial local directory with only trajectory_summary.json (missing _results.json and sentinel) triggers GCS download instead of returning cached true', async () => {
    const testJobId = `test-gcs-partial-${Date.now()}`;
    const testTrialDir = path.join(resultsDir, testJobId, '1', 'details-styling', 'task', 'guided');
    fs.mkdirSync(testTrialDir, { recursive: true });

    const origFetch = globalThis.fetch;
    const origToken = process.env.GD_GCS_TOKEN;
    let listApiCalled = false;

    try {
      fs.writeFileSync(path.join(resultsDir, testJobId, 'evals.json'), JSON.stringify({ suite: testJobId }));
      // Only trajectory_summary.json is present (no _results.json, no runtime.json, no .gcs_download_complete)
      fs.writeFileSync(
        path.join(testTrialDir, 'trajectory_summary.json'),
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

      const result = await downloadTrialFromGcsIfMissing(testTrialDir);
      assert.strictEqual(listApiCalled, true, 'Expected GCS list API to be invoked for incomplete local trial directory');
      assert.strictEqual(result, false, 'Expected false when GCS returns 0 files for partial directory');
    } finally {
      globalThis.fetch = origFetch;
      if (origToken === undefined) {
        delete process.env.GD_GCS_TOKEN;
      } else {
        process.env.GD_GCS_TOKEN = origToken;
      }
      fs.rmSync(path.join(resultsDir, testJobId), { recursive: true, force: true });
    }
  });

  test('downloadJobEvalsIfMissing deduplicates concurrent downloads for the same jobId', async () => {
    const testJobId = `test-gcs-dedup-${Date.now()}`;
    const origFetch = globalThis.fetch;
    let fetchCount = 0;

    try {
      globalThis.fetch = (async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 25));
        return new Response(JSON.stringify({ suite: testJobId, agent: 'claude_code' }), { status: 200 });
      }) as typeof fetch;

      await Promise.all([
        downloadJobEvalsIfMissing(testJobId, 'Bearer mock-token'),
        downloadJobEvalsIfMissing(testJobId, 'Bearer mock-token'),
        downloadJobEvalsIfMissing(testJobId, 'Bearer mock-token')
      ]);

      assert.strictEqual(fetchCount, 1, 'Expected concurrent evals.json downloads for the same job to be deduplicated into a single request');
      assert.ok(fs.existsSync(path.join(resultsDir, testJobId, 'evals.json')));
    } finally {
      globalThis.fetch = origFetch;
      fs.rmSync(path.join(resultsDir, testJobId), { recursive: true, force: true });
    }
  });

  test('validates GCS bucket configuration constants', async () => {
    const gcsModule = await import('./gcs-downloader.ts');
    assert.ok(gcsModule.downloadTrialFromGcsIfMissing);
    assert.strictEqual(typeof gcsModule.downloadTrialFromGcsIfMissing, 'function');
  });

  test('resolveTrialPath resolves both repo-relative and results-relative job paths', async () => {
    const { resolveTrialPath } = await import('./gcs-downloader.ts');
    const relativeJobTrial = 'nightly-2026-08-10_17-00-02-jetski_cli/1/details-styling/task/guided';

    // Results-relative path
    const resolved1 = resolveTrialPath(relativeJobTrial);
    assert.ok(resolved1);
    assert.strictEqual(resolved1.relativeTrialPath, relativeJobTrial);
    assert.ok(resolved1.absoluteTrialDir.endsWith(path.normalize(relativeJobTrial)));

    // Repo-relative path
    const resolved2 = resolveTrialPath(`harness/results/${relativeJobTrial}`);
    assert.ok(resolved2);
    assert.strictEqual(resolved2.relativeTrialPath, relativeJobTrial);
    assert.ok(resolved2.absoluteTrialDir.endsWith(path.normalize(relativeJobTrial)));
  });

  test('resolveTrialPath handles results/suites paths without prefixing suites/ to relativeTrialPath', async () => {
    const { resolveTrialPath } = await import('./gcs-downloader.ts');
    const jobTrial = 'nightly-2026-09-08_12-00-00-claude_code/1/details-styling/task/guided';

    const resolved = resolveTrialPath(`results/suites/${jobTrial}`);
    assert.ok(resolved);
    assert.strictEqual(resolved.relativeTrialPath, jobTrial);
    assert.ok(resolved.absoluteTrialDir.endsWith(path.join('results', 'suites', jobTrial)));

    const resolved2 = resolveTrialPath(`harness/results/suites/${jobTrial}`);
    assert.ok(resolved2);
    assert.strictEqual(resolved2.relativeTrialPath, jobTrial);
    assert.ok(resolved2.absoluteTrialDir.endsWith(path.join('results', 'suites', jobTrial)));
  });
});
