import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gitExec } from './git-utils.ts';
import { extractTargetFilesFromPatch, applyPatchSync, capturePatchFromGit, initGitRepo } from './patch-utils.ts';

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

  test('ignores package manager lockfiles in patch headers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-lockfile-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    const patchContent = `--- a/index.html
+++ b/index.html
@@ -1 +1 @@
-old
+new
--- /dev/null
+++ b/package-lock.json
@@ -0,0 +1,3 @@
+{}
--- /dev/null
+++ b/pnpm-lock.yaml
@@ -0,0 +1,2 @@
+lockfileVersion: '9.0'
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      const files = extractTargetFilesFromPatch(patchPath);
      assert.deepStrictEqual(files, ['index.html']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('ignores task.md, expectations.md, guide.md, and pnpm-workspace.yaml in patch headers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-exclude-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    const patchContent = `--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1 +1 @@
-old
+new
--- /dev/null
+++ b/guide.md
@@ -0,0 +1 @@
+# Guide
--- /dev/null
+++ b/expectations.md
@@ -0,0 +1 @@
+# Expectations
--- /dev/null
+++ b/task.md
@@ -0,0 +1 @@
+# Task
--- /dev/null
+++ b/targets/daily-grind/task.md
@@ -0,0 +1 @@
+# Target Task
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1 @@
+packages: []
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      const files = extractTargetFilesFromPatch(patchPath);
      assert.deepStrictEqual(files, ['src/App.tsx']);
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

  test('applies mixed text and GIT binary patch atomically without partial state', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-binary-'));
    try {
      const srcRepo = path.join(tmpDir, 'src');
      fs.mkdirSync(srcRepo, { recursive: true });
      fs.writeFileSync(path.join(srcRepo, 'index.html'), '<p>before</p>\n');
      initGitRepo(srcRepo);

      const wasmBytes = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0xff, 0xfe]);
      fs.writeFileSync(path.join(srcRepo, 'index.html'), '<p>after</p>\n');
      fs.writeFileSync(path.join(srcRepo, 'worker.js'), 'export const ok = true;\n');
      fs.writeFileSync(path.join(srcRepo, 'module.wasm'), wasmBytes);

      const gitOpts = { cwd: srcRepo, isolated: true, stdio: 'ignore' as const };
      gitExec(['add', '-N', '.'], gitOpts);
      const diff = gitExec(['diff', '--binary'], { cwd: srcRepo, isolated: true });
      assert.match(diff, /^GIT binary patch$/m);

      const patchPath = path.join(tmpDir, 'mixed.patch');
      fs.writeFileSync(patchPath, diff);

      // Plain target directory (not a git repo) matches staging workspace behavior
      const targetDir = path.join(tmpDir, 'target');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'index.html'), '<p>before</p>\n');

      const result = applyPatchSync(targetDir, patchPath);
      assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
      assert.strictEqual(fs.readFileSync(path.join(targetDir, 'index.html'), 'utf8'), '<p>after</p>\n');
      assert.strictEqual(fs.readFileSync(path.join(targetDir, 'worker.js'), 'utf8'), 'export const ok = true;\n');
      assert.deepStrictEqual(fs.readFileSync(path.join(targetDir, 'module.wasm')), wasmBytes);

      // Failing mixed binary patch must leave targetDir untouched (no partial text hunks or .rej files)
      const conflictingDir = path.join(tmpDir, 'conflicting');
      fs.mkdirSync(conflictingDir, { recursive: true });
      fs.writeFileSync(path.join(conflictingDir, 'index.html'), '<p>different</p>\n');
      const failResult = applyPatchSync(conflictingDir, patchPath);
      assert.strictEqual(failResult.success, false);
      assert.match(failResult.error || '', /patch failed|does not apply/i);
      assert.deepStrictEqual(fs.readdirSync(conflictingDir), ['index.html']);
      assert.strictEqual(fs.readFileSync(path.join(conflictingDir, 'index.html'), 'utf8'), '<p>different</p>\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('falls back to patch -p1 for fuzzy/offset text patches and reports useful errors when both fail', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-fuzz-'));
    try {
      const targetDir = path.join(tmpDir, 'target');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'app.txt'), 'header1\nheader2\nalpha\nbeta\ngamma\n');

      const fuzzPatch = path.join(tmpDir, 'fuzz.patch');
      fs.writeFileSync(
        fuzzPatch,
        '--- a/app.txt\n+++ b/app.txt\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+BETA\n gamma\n'
      );

      const res = applyPatchSync(targetDir, fuzzPatch);
      assert.strictEqual(res.success, true, `Expected fuzz fallback to succeed, got: ${res.error}`);
      assert.strictEqual(
        fs.readFileSync(path.join(targetDir, 'app.txt'), 'utf8'),
        'header1\nheader2\nalpha\nBETA\ngamma\n'
      );

      // When both git apply and patch -p1 fail, error captures both diagnostics
      const failDir = path.join(tmpDir, 'fail');
      fs.mkdirSync(failDir, { recursive: true });
      fs.writeFileSync(path.join(failDir, 'app.txt'), 'unrelated\n');

      const failRes = applyPatchSync(failDir, fuzzPatch);
      assert.strictEqual(failRes.success, false);
      assert.match(failRes.error || '', /git apply:/);
      assert.match(failRes.error || '', /patch:/);
      assert.match(failRes.error || '', /FAILED/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('applies git-style patches to a plain directory nested inside an unrelated git repo', () => {
    // Suite workspaces live under results/ in the repo checkout. Inside a repo, git apply reads
    // `diff --git` paths as relative to that repo's root and silently skips ones outside cwd.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-nested-'));
    try {
      initGitRepo(tmpDir);
      const targetDir = path.join(tmpDir, 'results', 'base_app');
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'index.html'), '<p>before</p>\n');

      const patchPath = path.join(tmpDir, 'change.patch');
      fs.writeFileSync(
        patchPath,
        'diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n@@ -1 +1 @@\n-<p>before</p>\n+<p>after</p>\n'
      );

      const result = applyPatchSync(targetDir, patchPath);
      assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
      assert.strictEqual(fs.readFileSync(path.join(targetDir, 'index.html'), 'utf8'), '<p>after</p>\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('applies git-style patches when target directory is reached through a symlink parent', () => {
    // Note: Passes with or without realpathSync on current git; realpath is defensive for platforms/git builds that compare against unresolved ceiling paths (e.g. macOS /var -> /private/var).
    const realTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-symlink-real-'));
    try {
      initGitRepo(realTmpDir);
      const realTargetDir = path.join(realTmpDir, 'results', 'base_app');
      fs.mkdirSync(realTargetDir, { recursive: true });
      fs.writeFileSync(path.join(realTargetDir, 'index.html'), '<p>before</p>\n');

      const symlinkParent = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'patch-symlink-parent-')), 'linked');
      fs.symlinkSync(realTmpDir, symlinkParent);
      const targetDir = path.join(symlinkParent, 'results', 'base_app');

      const patchPath = path.join(realTmpDir, 'change.patch');
      fs.writeFileSync(
        patchPath,
        'diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n@@ -1 +1 @@\n-<p>before</p>\n+<p>after</p>\n'
      );

      const result = applyPatchSync(targetDir, patchPath);
      assert.strictEqual(result.success, true, `Expected success, got error: ${result.error}`);
      assert.strictEqual(fs.readFileSync(path.join(realTargetDir, 'index.html'), 'utf8'), '<p>after</p>\n');
    } finally {
      fs.rmSync(realTmpDir, { recursive: true, force: true });
    }
  });
});

function initTestRepo(repoDir: string) {
  fs.writeFileSync(path.join(repoDir, 'existing.txt'), 'hello\n');
  initGitRepo(repoDir);
}

describe('capturePatchFromGit', () => {
  test('captures untracked modifications from git repo into patch file and excludes lockfiles', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-patch-'));
    const repoDir = path.join(tmpDir, 'repo');
    const patchDest = path.join(tmpDir, 'out', 'change.patch');
    fs.mkdirSync(repoDir, { recursive: true });

    try {
      initTestRepo(repoDir);

      // Create untracked change plus lockfiles that should be excluded
      fs.writeFileSync(path.join(repoDir, 'newfile.txt'), 'world\n');
      fs.writeFileSync(path.join(repoDir, 'package-lock.json'), '{"lockfileVersion": 3}\n');
      fs.writeFileSync(path.join(repoDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');

      const result = capturePatchFromGit(repoDir, patchDest);
      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(patchDest), true);
      const patchContent = fs.readFileSync(patchDest, 'utf8');
      assert.match(patchContent, /newfile\.txt/);
      assert.match(patchContent, /\+world/);
      assert.doesNotMatch(patchContent, /package-lock\.json/);
      assert.doesNotMatch(patchContent, /pnpm-lock\.yaml/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('excludes task.md, expectations.md, guide.md, and pnpm-workspace.yaml from captured patch', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-patch-exclusions-'));
    const repoDir = path.join(tmpDir, 'repo');
    const patchDest = path.join(tmpDir, 'out', 'change.patch');
    fs.mkdirSync(repoDir, { recursive: true });

    try {
      initTestRepo(repoDir);

      // Create valid modifications and excluded files
      fs.writeFileSync(path.join(repoDir, 'valid.txt'), 'valid content\n');
      fs.writeFileSync(path.join(repoDir, 'guide.md'), '# Guide\n');
      fs.writeFileSync(path.join(repoDir, 'expectations.md'), '# Expectations\n');
      fs.writeFileSync(path.join(repoDir, 'task.md'), '# Task\n');
      fs.writeFileSync(path.join(repoDir, 'pnpm-workspace.yaml'), 'packages: []\n');

      const nestedDir = path.join(repoDir, 'sub');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'guide.md'), '# Sub Guide\n');
      fs.writeFileSync(path.join(nestedDir, 'task.md'), '# Sub Task\n');

      const result = capturePatchFromGit(repoDir, patchDest);
      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(patchDest), true);
      const patchContent = fs.readFileSync(patchDest, 'utf8');
      assert.match(patchContent, /valid\.txt/);
      assert.doesNotMatch(patchContent, /guide\.md/);
      assert.doesNotMatch(patchContent, /expectations\.md/);
      assert.doesNotMatch(patchContent, /task\.md/);
      assert.doesNotMatch(patchContent, /pnpm-workspace\.yaml/);
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
      const opts = { cwd: repoDir, isolated: true, stdio: 'ignore' as const };
      fs.writeFileSync(path.join(repoDir, 'index.html'), '<html>original</html>\n');
      initGitRepo(repoDir);

      fs.writeFileSync(path.join(repoDir, 'index.html'), '<html>updated</html>\n');
      fs.writeFileSync(path.join(repoDir, 'translator.js'), 'console.log("translator");\n');
      gitExec(['add', '.'], opts);
      gitExec(['commit', '-q', '-m', 'Agent commit'], opts);

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
      initTestRepo(tmpDir);

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


