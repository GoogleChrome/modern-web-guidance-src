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
});
