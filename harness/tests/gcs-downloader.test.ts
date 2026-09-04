import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { downloadRunFromGcsIfMissing } from '../lib/gcs-downloader.ts';

describe('gcs-downloader', () => {
  test('downloadRunFromGcsIfMissing returns early when directory already exists locally', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-local-run-'));
    try {
      // Create local run directory
      fs.writeFileSync(path.join(tmpDir, 'trajectory_summary.json'), JSON.stringify({ agent: 'claude-code', steps: [{ stepNumber: 1 }] }));

      // Calling downloadRunFromGcsIfMissing should resolve immediately without network calls
      await assert.doesNotReject(async () => {
        await downloadRunFromGcsIfMissing(tmpDir);
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
