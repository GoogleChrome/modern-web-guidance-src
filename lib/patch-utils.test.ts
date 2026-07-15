import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractTargetFilesFromPatch, applyPatch, applyPatchSync } from './patch-utils.ts';

describe('extractTargetFilesFromPatch', () => {
  test('extracts modified file paths from unified diff headers and ignores deleted files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    const patchContent = `--- a/src/components/SignInForm.tsx
+++ b/src/components/SignInForm.tsx
@@ -10,3 +10,3 @@
- const x = 1;
+ const x = 2;
--- a/src/styles/main.css
+++ b/src/styles/main.css
@@ -1,2 +1,3 @@
 /* comment */
+body { color: red; }
--- a/deleted.ts
+++ /dev/null
@@ -1,5 +0,0 @@
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      const files = extractTargetFilesFromPatch(patchPath);
      assert.deepStrictEqual(files, ['src/components/SignInForm.tsx', 'src/styles/main.css']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('applyPatchSync', () => {
  test('applies unified diff patch synchronously to target directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-apply-sync-'));
    const targetFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(targetFile, 'hello world\n');

    const patchPath = path.join(tmpDir, 'change.patch');
    const patchContent = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-hello world
+hello guidance
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      const result = applyPatchSync(tmpDir, patchPath);
      assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
      const updatedContent = fs.readFileSync(targetFile, 'utf8');
      assert.strictEqual(updatedContent, 'hello guidance\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns error when patch file or target directory does not exist', () => {
    const res1 = applyPatchSync('/nonexistent/dir', '/nonexistent/patch.patch');
    assert.strictEqual(res1.success, false);
    assert.match(res1.error || '', /not found/i);
  });
});

describe('applyPatch', () => {
  test('applies unified diff patch asynchronously to target directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-apply-async-'));
    const targetFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(targetFile, 'hello world\n');

    const patchPath = path.join(tmpDir, 'change.patch');
    const patchContent = `--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-hello world
+hello guidance
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      const result = await applyPatch(tmpDir, patchPath);
      assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
      const updatedContent = fs.readFileSync(targetFile, 'utf8');
      assert.strictEqual(updatedContent, 'hello guidance\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

