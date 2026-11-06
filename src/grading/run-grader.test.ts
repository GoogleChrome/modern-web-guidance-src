import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageGradingWorkspace, PatchApplyError } from './run-grader.ts';

describe('stageGradingWorkspace', () => {
  it('throws PatchApplyError and cleans up temp dir when a patch fails to apply', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-grader-test-'));
    const badPatch = path.join(tmpDir, 'bad.patch');
    fs.writeFileSync(
      badPatch,
      'diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n@@ -1,3 +1,3 @@\n-THIS_LINE_DOES_NOT_EXIST\n+REPLACEMENT\n'
    );

    const beforeTmpEntries = new Set(
      fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('grade-run-'))
    );

    try {
      await assert.rejects(
        () => stageGradingWorkspace('daily-grind', badPatch),
        (err: unknown) => {
          assert.ok(err instanceof PatchApplyError, 'Expected PatchApplyError');
          assert.equal(err.patchPath, badPatch);
          assert.match(err.message, /Failed to apply bad\.patch/);
          return true;
        }
      );

      const afterTmpEntries = fs
        .readdirSync(os.tmpdir())
        .filter((name) => name.startsWith('grade-run-') && !beforeTmpEntries.has(name));
      assert.deepEqual(afterTmpEntries, [], 'Failed staging should clean up its temp HOME dir');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
