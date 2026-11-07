import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageGradingWorkspace, PatchApplyError, runPlaywright } from './run-grader.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('runPlaywright stdio handling', () => {
  for (const stdio of ['ignore', 'pipe'] as const) {
    test(`does not deadlock when stdio is '${stdio}' and grader writes >1 MB to stdout`, { timeout: 20_000 }, async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `run-grader-stdout-${stdio}-`));
      try {
        const fixtureImportPath = path.join(__dirname, 'test-fixture.ts');
        const graderFile = path.join(tempDir, 'grader.ts');
        fs.writeFileSync(
          graderFile,
          [
            `import { test, expect } from ${JSON.stringify(fixtureImportPath)};`,
            `test('writes large stdout then fails', () => {`,
            `  process.stdout.write('x'.repeat(1024 * 1024) + '\\n');`,
            `  expect(1).toBe(2);`,
            `});`,
          ].join('\n'),
          'utf8',
        );
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name: 'stdout-deadlock-repro', type: 'module', scripts: {} }),
          'utf8',
        );

        const res = await runPlaywright(tempDir, graderFile, stdio);
        assert.strictEqual(res.stats.expected, 0);
        assert.strictEqual(res.stats.unexpected, 1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  }
});
