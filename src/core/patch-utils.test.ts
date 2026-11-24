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

  test('does not treat added/removed hunk lines starting with +++ or --- as file headers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-hunk-content-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    // The hunk adds a line "++ leading plus-plus line", which the diff emits as "+++ leading ...".
    const patchContent = `diff --git a/notes.md b/notes.md
index 7c88e8a..2f5f31f 100644
--- a/notes.md
+++ b/notes.md
@@ -1 +1,3 @@
 # notes
+++ leading plus-plus line
++++ three pluses
--- a/removed.md
--- removed line starting with two minuses
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      assert.deepStrictEqual(extractTargetFilesFromPatch(patchPath), ['notes.md']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('handles git-quoted non-ASCII paths, diff -u timestamps, and paths containing spaces', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-quoted-path-test-'));
    try {
      const quoted = path.join(tmpDir, 'quoted.patch');
      // core.quotePath quotes non-ASCII paths as octal byte escapes.
      fs.writeFileSync(
        quoted,
        'diff --git "a/\\351\\241\\265\\351\\235\\242.md" "b/\\351\\241\\265\\351\\235\\242.md"\n' +
          'index 111..222 100644\n' +
          '--- "a/\\351\\241\\265\\351\\235\\242.md"\n' +
          '+++ "b/\\351\\241\\265\\351\\235\\242.md"\n' +
          '@@ -1 +1 @@\n-a\n+b\n',
      );
      assert.deepStrictEqual(extractTargetFilesFromPatch(quoted), ['页面.md']);

      const timestamped = path.join(tmpDir, 'timestamps.patch');
      fs.writeFileSync(
        timestamped,
        '--- a/app.js\t2026-11-17 10:00:00.000000000 +0800\n' +
          '+++ b/app.js\t2026-11-17 10:00:01.000000000 +0800\n' +
          '@@ -1 +1 @@\n-a\n+b\n',
      );
      assert.deepStrictEqual(extractTargetFilesFromPatch(timestamped), ['app.js']);

      const spaced = path.join(tmpDir, 'spaced.patch');
      fs.writeFileSync(
        spaced,
        'diff --git a/my file.txt b/my file.txt\n' +
          'index 111..222 100644\n' +
          '--- a/my file.txt\n' +
          '+++ b/my file.txt\n' +
          '@@ -1 +1 @@\n-one\n+two\n',
      );
      assert.deepStrictEqual(extractTargetFilesFromPatch(spaced), ['my file.txt']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('includes binary additions and empty new files that emit no text header', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-binary-targets-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    const patchContent = `diff --git a/icons/app-192.png b/icons/app-192.png
new file mode 100644
index 0000000..e69de29
Binary files /dev/null and b/icons/app-192.png differ
diff --git a/wasm/smallpt.wasm b/wasm/smallpt.wasm
new file mode 100755
index 0000000000000000000000000000000000000000..9ca925f33a990aa83c1125dd62990356b1abc04e
GIT binary patch
literal 27504
zcmc(I2UrwW*Z<kZE-WZ^5X<ap?AWj!zk9+dl#dzfEuw!Q8sq0SQ2Y=!HULc5{)H

diff --git a/assets/preview.png b/assets/preview.png
new file mode 100644
index 0000000..e69de29
diff --git a/index.html b/index.html
--- a/index.html
+++ b/index.html
@@ -1 +1 @@
-<p>before</p>
+<p>after</p>
`;
    fs.writeFileSync(patchPath, patchContent);

    try {
      assert.deepStrictEqual(extractTargetFilesFromPatch(patchPath), [
        'icons/app-192.png',
        'wasm/smallpt.wasm',
        'assets/preview.png',
        'index.html',
      ]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('reports each file once when a patch repeats its headers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-dup-test-'));
    const patchPath = path.join(tmpDir, 'demo.patch');
    fs.writeFileSync(
      patchPath,
      'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\n+b\n' +
        'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-a\n+c\n',
    );

    try {
      assert.deepStrictEqual(extractTargetFilesFromPatch(patchPath), ['a.txt']);
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

      const prevEnv = { LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, LANGUAGE: process.env.LANGUAGE };
      process.env.LANG = process.env.LC_ALL = 'es_ES.UTF-8';
      process.env.LANGUAGE = 'es';
      try {
        const localizedFail = applyPatchSync(conflictingDir, patchPath);
        assert.strictEqual(localizedFail.success, false);
        assert.match(localizedFail.error || '', /patch failed|does not apply/i);
      } finally {
        for (const [k, v] of Object.entries(prevEnv)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
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
    const symlinkParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-symlink-parent-'));
    try {
      initGitRepo(realTmpDir);
      const realTargetDir = path.join(realTmpDir, 'results', 'base_app');
      fs.mkdirSync(realTargetDir, { recursive: true });
      fs.writeFileSync(path.join(realTargetDir, 'index.html'), '<p>before</p>\n');

      const symlinkParent = path.join(symlinkParentDir, 'linked');
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
      fs.rmSync(symlinkParentDir, { recursive: true, force: true });
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

      // Create untracked change plus lockfiles and build/dependency artifacts that should be excluded
      fs.writeFileSync(path.join(repoDir, 'newfile.txt'), 'world\n');
      fs.writeFileSync(path.join(repoDir, 'package-lock.json'), '{"lockfileVersion": 3}\n');
      fs.writeFileSync(path.join(repoDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      fs.mkdirSync(path.join(repoDir, 'node_modules', 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
      fs.mkdirSync(path.join(repoDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'dist', 'bundle.js'), 'console.log(1);\n');

      const result = capturePatchFromGit(repoDir, patchDest);
      assert.strictEqual(result.success, true);
      assert.strictEqual(fs.existsSync(patchDest), true);
      const patchContent = fs.readFileSync(patchDest, 'utf8');
      assert.match(patchContent, /newfile\.txt/);
      assert.match(patchContent, /\+world/);
      assert.doesNotMatch(patchContent, /package-lock\.json/);
      assert.doesNotMatch(patchContent, /pnpm-lock\.yaml/);
      assert.doesNotMatch(patchContent, /node_modules/);
      assert.doesNotMatch(patchContent, /dist\//);
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


