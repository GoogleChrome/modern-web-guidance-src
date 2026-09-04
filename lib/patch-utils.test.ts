import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { extractTargetFilesFromPatch, applyPatchSync, capturePatchFromGit } from './patch-utils.ts';

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

describe('capturePatchFromGit', () => {
  test('captures untracked modifications from git repo into patch file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-patch-'));
    const repoDir = path.join(tmpDir, 'repo');
    const patchDest = path.join(tmpDir, 'out', 'change.patch');
    fs.mkdirSync(repoDir, { recursive: true });

    try {
      // Initialize git repo with one tracked file
      execSync('git init && git config user.name "Test" && git config user.email "test@example.com"', { cwd: repoDir, stdio: 'ignore' });
      fs.writeFileSync(path.join(repoDir, 'existing.txt'), 'hello\n');
      execSync('git add . && git commit -m "init"', { cwd: repoDir, stdio: 'ignore' });

      // Create untracked change
      fs.writeFileSync(path.join(repoDir, 'newfile.txt'), 'world\n');

      const result = capturePatchFromGit(repoDir, patchDest);
      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(patchDest), true);
      const patchContent = fs.readFileSync(patchDest, 'utf8');
      assert.match(patchContent, /newfile\.txt/);
      assert.match(patchContent, /\+world/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('captures changes even when agent commits them to git', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-committed-'));
    const repoDir = path.join(tmpDir, 'repo');
    const patchDest = path.join(tmpDir, 'out', 'agent.patch');
    fs.mkdirSync(repoDir, { recursive: true });

    try {
      // 1. Initial harness repo setup with initial commit
      execSync('git init && git config user.name "AI" && git config user.email "ai@example.com"', { cwd: repoDir, stdio: 'ignore' });
      fs.writeFileSync(path.join(repoDir, 'index.html'), '<html>original</html>\n');
      execSync('git add . && git commit -m "init"', { cwd: repoDir, stdio: 'ignore' });

      // 2. Agent modifies files AND runs git commit
      fs.writeFileSync(path.join(repoDir, 'index.html'), '<html>updated</html>\n');
      fs.writeFileSync(path.join(repoDir, 'translator.js'), 'console.log("translator");\n');
      execSync('git add . && git commit -m "Agent commit"', { cwd: repoDir, stdio: 'ignore' });

      // 3. capturePatchFromGit should capture diff against the initial commit
      const result = capturePatchFromGit(repoDir, patchDest);
      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(patchDest), true);

      const patchContent = fs.readFileSync(patchDest, 'utf8');
      assert.match(patchContent, /index\.html/);
      assert.match(patchContent, /translator\.js/);
      assert.match(patchContent, /\+console\.log\("translator"\);/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns false when no modifications exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-empty-'));
    const patchDest = path.join(tmpDir, 'empty.patch');
    try {
      execSync('git init && git config user.name "Test" && git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'ignore' });
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello\n');
      execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'ignore' });

      const result = capturePatchFromGit(tmpDir, patchDest);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.diff, '');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('generateUnifiedDiff', () => {
  test('returns "No differences detected." for identical content', async () => {
    const { generateUnifiedDiff } = await import('./patch-utils.ts');
    assert.strictEqual(generateUnifiedDiff('const a = 1;\n', 'const a = 1;\n'), 'No differences detected.');
    assert.strictEqual(generateUnifiedDiff('', ''), 'No differences detected.');
  });

  test('generates unified diff for modified lines with custom labels', async () => {
    const { generateUnifiedDiff } = await import('./patch-utils.ts');
    const oldText = 'line 1\nline 2\nline 3';
    const newText = 'line 1\nline 2 modified\nline 3';
    const diff = generateUnifiedDiff(oldText, newText, 'OldFile', 'NewFile');

    assert.match(diff, /^--- OldFile/m);
    assert.match(diff, /^\+\+\+ NewFile/m);
    assert.match(diff, /^@@ -\d+,\d+ \+\d+,\d+ @@/m);
    assert.match(diff, /^-line 2/m);
    assert.match(diff, /^\+line 2 modified/m);
  });

  test('handles insertions at beginning, middle, and end correctly with prefix/suffix trimming', async () => {
    const { generateUnifiedDiff } = await import('./patch-utils.ts');
    const oldText = 'header\nshared 1\nshared 2\nfooter';
    const newText = 'top new\nheader\nshared 1\nmiddle inserted\nshared 2\nfooter\nbottom new';
    const diff = generateUnifiedDiff(oldText, newText);

    assert.match(diff, /^\+top new/m);
    assert.match(diff, /^\+middle inserted/m);
    assert.match(diff, /^\+bottom new/m);
  });

  test('handles empty string edge cases correctly', async () => {
    const { generateUnifiedDiff } = await import('./patch-utils.ts');
    const diffFromEmpty = generateUnifiedDiff('', 'new content\n');
    assert.match(diffFromEmpty, /^\+new content/m);

    const diffToEmpty = generateUnifiedDiff('old content\n', '');
    assert.match(diffToEmpty, /^-old content/m);
  });
});



