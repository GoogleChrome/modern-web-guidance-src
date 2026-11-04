import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBinary, MAX_PATCH_BYTES, patchFromFiles, preparePatch } from './patch.ts';

const text = (value: string) => Buffer.from(value, 'utf8');

function section(file: string, body = '+hello\n'): string {
  return `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1 @@\n${body}`;
}

describe('preparePatch', () => {
  test('drops lockfile and build-output sections and keeps the rest', () => {
    const raw = section('src/app.ts') + section('pnpm-lock.yaml') + section('dist/bundle.js') + section('index.html');
    const out = preparePatch(raw);
    assert.equal(out.text, section('src/app.ts') + section('index.html'));
    assert.deepEqual(out.droppedFiles, ['pnpm-lock.yaml', 'dist/bundle.js']);
    assert.equal(out.truncated, false);
  });

  test('drops nested lockfiles and node_modules', () => {
    const out = preparePatch(section('web/package-lock.json') + section('a/node_modules/x/index.js'));
    assert.equal(out.text, '');
    assert.equal(out.droppedFiles.length, 2);
  });

  test('drops secrets and agent-local config', () => {
    const files = ['.env', '.env.local', 'config/.env.production', 'certs/server.pem', 'deploy/id_rsa.key', '.claude/settings.json', '.codex/x', '.gemini/x', '.antigravity/x'];
    const out = preparePatch(files.map(file => section(file)).join(''));
    assert.equal(out.text, '');
    assert.deepEqual(out.droppedFiles, files);
  });

  test('keeps files that merely contain an excluded name', () => {
    const files = ['src/build/config.ts', 'docs/dist/readme.md', 'package-lock.json.bak', 'app/.next-steps.md', 'docs/.gemini/notes.md', 'src/environment.ts', 'lib/monkey.ts'];
    const out = preparePatch(files.map(file => section(file)).join(''));
    assert.deepEqual(out.droppedFiles, []);
    assert.equal(out.text, files.map(file => section(file)).join(''));
  });

  test('replaces oversized patches with a placeholder', () => {
    const big = section('src/big.ts', '+' + 'x'.repeat(MAX_PATCH_BYTES) + '\n');
    const out = preparePatch(big);
    assert.equal(out.truncated, true);
    assert.match(out.text, /^# diff omitted: .* exceeds the 1 MB cap\n$/);
  });

  test('applies the cap after dropping excluded files', () => {
    const raw = section('src/ok.ts') + section('pnpm-lock.yaml', '+' + 'x'.repeat(MAX_PATCH_BYTES) + '\n');
    const out = preparePatch(raw);
    assert.equal(out.truncated, false);
    assert.equal(out.text, section('src/ok.ts'));
  });

  test('passes an empty patch through', () => {
    assert.deepEqual(preparePatch(''), { text: '', truncated: false, droppedFiles: [] });
  });

  test('reads git-quoted and space-containing headers, including internal " b/" substrings', () => {
    const quoted = 'diff --git "a/.env" "b/.env"\n--- "a/.env"\n+++ "b/.env"\n@@ -0,0 +1 @@\n+SECRET=1\n';
    const spaced = 'diff --git "a/my config/.env.local" "b/my config/.env.local"\n@@ -0,0 +1 @@\n+x\n';
    const unquotedSpace = section('dir b/.env', '+SECRET=2\n');
    const escaped = 'diff --git "a/\\303\\251/x.ts" "b/\\303\\251/x.ts"\n@@ -0,0 +1 @@\n+ok\n';
    const out = preparePatch(quoted + spaced + unquotedSpace + escaped);
    assert.equal(out.text, escaped);
    assert.deepEqual(out.droppedFiles, ['.env', 'my config/.env.local', 'dir b/.env']);
  });

  test('checks both sides of the header and rename/copy paths', () => {
    const renamedTo = 'diff --git a/src/settings.ts b/.env\nsimilarity index 90%\nrename from src/settings.ts\nrename to .env\n';
    const renamedFrom = 'diff --git a/.env b/src/settings.ts\nsimilarity index 90%\nrename from .env\nrename to src/settings.ts\n';
    const spacedRenameFrom = 'diff --git a/dir b/.env b/dir b/safe.txt\nrename from dir b/.env\nrename to dir b/safe.txt\n';
    const quotedRename = 'diff --git a/src/a.ts b/src/b.ts\nrename from src/a.ts\nrename to "a/.env"\n';
    const out = preparePatch(renamedTo + renamedFrom + spacedRenameFrom + quotedRename + section('src/ok.ts'));
    assert.equal(out.text, section('src/ok.ts'));
    assert.deepEqual(out.droppedFiles, ['.env', '.env', 'dir b/.env', 'a/.env']);
  });

  test('drops a section whose header cannot be read instead of keeping it', () => {
    const garbage = 'diff --git something-odd\n@@ -0,0 +1 @@\n+x\n';
    const wrongPrefix = 'diff --git c/.env d/.env\n@@ -0,0 +1 @@\n+x\n';
    const badEscape = 'diff --git "a/\\q" "b/\\q"\n@@ -0,0 +1 @@\n+x\n';
    const out = preparePatch(garbage + wrongPrefix + badEscape + section('src/ok.ts'));
    assert.equal(out.text, section('src/ok.ts'));
    assert.equal(out.droppedFiles.length, 3);
  });

  test('kept sections are published byte-for-byte: binary, similarity, mode, and short hunk headers survive', () => {
    const binary = 'diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n';
    const renamed = 'diff --git a/src/a.ts b/src/b.ts\nsimilarity index 90%\nrename from src/a.ts\nrename to src/b.ts\n';
    const modeOnly = 'diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\n';
    const shortHunk = 'diff --git a/x.txt b/x.txt\n--- a/x.txt\n+++ b/x.txt\n@@ -1 +1 @@\n-a\n+b\n';
    const raw = binary + renamed + modeOnly + shortHunk + section('pnpm-lock.yaml');
    const out = preparePatch(raw);
    assert.equal(out.text, binary + renamed + modeOnly + shortHunk);
    assert.deepEqual(out.droppedFiles, ['pnpm-lock.yaml']);
  });

  test('a section with a malformed hunk is dropped rather than published half-read', () => {
    const malformed = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-x\n+y\n+z\n';
    const out = preparePatch(malformed + section('src/ok.ts'));
    assert.equal(out.text, section('src/ok.ts'));
    assert.equal(out.droppedFiles.length, 1);
  });
});

describe('patchFromFiles', () => {
  test('emits a diff --git section', () => {
    const out = patchFromFiles('index.html', text('<p>old</p>\n'), text('<p>new</p>\n'));
    assert.ok(out.text.startsWith('diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n'));
    assert.match(out.text, /^-<p>old<\/p>$/m);
    assert.match(out.text, /^\+<p>new<\/p>$/m);
    assert.equal(out.truncated, false);
  });

  test('marks a file missing from the base app as new', () => {
    const out = patchFromFiles('src/new.js', undefined, text('console.log(1);\n'));
    assert.ok(out.text.startsWith('diff --git a/src/new.js b/src/new.js\nnew file mode 100644\n'));
  });

  test('returns an empty patch when nothing changed', () => {
    assert.equal(patchFromFiles('index.html', text('same\n'), text('same\n')).text, '');
  });

  test('drops excluded targets the same way preparePatch does', () => {
    for (const relPath of ['.env', 'config/.env.local', 'server.key', 'pnpm-lock.yaml', 'dist/app.js', '.claude/settings.json']) {
      const out = patchFromFiles(relPath, text('old\n'), text('SECRET=abc\n'));
      assert.equal(out.text, '', relPath);
      assert.deepEqual(out.droppedFiles, [relPath]);
    }
    assert.notEqual(patchFromFiles('src/build/config.ts', text('a\n'), text('b\n')).text, '');
  });

  test('keeps a trailing blank context line, so hunk bodies match their headers', () => {
    const out = patchFromFiles('x.txt', text('a\nb\n\n'), text('a\nc\n\n'));
    const hunk = /^@@ -\d+,(\d+) \+\d+,(\d+) @@\n([\s\S]*)$/.exec(out.text.slice(out.text.indexOf('@@')))!;
    const lines = hunk[3].split('\n').slice(0, -1);
    assert.equal(lines.filter(line => !line.startsWith('+')).length, Number(hunk[1]));
    assert.equal(lines.filter(line => !line.startsWith('-')).length, Number(hunk[2]));
    assert.ok(out.text.endsWith('\n \n'), JSON.stringify(out.text));
  });

  test('emits a one-line binary section instead of diffing image bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x7e, 0x2f, 0x66, 0x58]); // PNG header + "~/fX"
    const out = patchFromFiles('coffee-bean-2x.png', undefined, png);
    assert.equal(out.text, 'diff --git a/coffee-bean-2x.png b/coffee-bean-2x.png\nBinary files /dev/null and b/coffee-bean-2x.png differ\n');
    assert.ok(!out.text.includes('~/'));

    const changed = patchFromFiles('x.png', Buffer.from([0, 1, 2]), Buffer.from([0, 1, 3]));
    assert.match(changed.text, /^diff --git a\/x\.png b\/x\.png\nBinary files a\/x\.png and b\/x\.png differ\n$/);
    assert.equal(patchFromFiles('x.png', Buffer.from([0, 1, 2]), Buffer.from([0, 1, 2])).text, '');
  });
});

describe('isBinary', () => {
  test('NUL bytes and invalid UTF-8 are binary; text and multi-byte UTF-8 are not', () => {
    assert.equal(isBinary(Buffer.from([0x89, 0x50, 0x00])), true);
    assert.equal(isBinary(Buffer.from([0xff, 0xfe, 0x41])), true);
    assert.equal(isBinary(text('plain text\n')), false);
    assert.equal(isBinary(text('café — 日本語 🎉')), false);
    // A multi-byte character split exactly at the 8 KB inspection boundary is still text.
    assert.equal(isBinary(Buffer.concat([Buffer.alloc(7999, 0x61), text('é')])), false);
  });
});
