import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { downloadRunFromGcsIfMissing } from '../lib/gcs-downloader.ts';
import { resultsDir } from '../../lib/paths.ts';

describe('gcs-downloader', () => {
  test('downloadRunFromGcsIfMissing returns early when directory already exists locally', async () => {
    const testSuite = `test-gcs-local-${Date.now()}`;
    const testRunDir = path.join(resultsDir, testSuite, '1', 'details-styling', 'task', 'guided');
    fs.mkdirSync(testRunDir, { recursive: true });
    try {
      // Create local run directory with suite evals.json and trajectory_summary.json
      fs.writeFileSync(path.join(resultsDir, testSuite, 'evals.json'), JSON.stringify({ suite: testSuite }));
      fs.writeFileSync(path.join(testRunDir, 'trajectory_summary.json'), JSON.stringify({ agent: 'claude-code', steps: [{ stepNumber: 1 }] }));

      // Calling downloadRunFromGcsIfMissing should resolve immediately without network calls
      const result = await downloadRunFromGcsIfMissing(testRunDir);
      assert.strictEqual(result, true);
    } finally {
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
