import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PATCH_BYTES, patchFromFiles, preparePatch } from './patch.ts';

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
});

describe('patchFromFiles', () => {
  test('emits a diff --git section the dashboard can render', () => {
    const out = patchFromFiles('index.html', '<p>old</p>\n', '<p>new</p>\n');
    assert.ok(out.text.startsWith('diff --git a/index.html b/index.html\n--- a/index.html\n+++ b/index.html\n'));
    assert.match(out.text, /^-<p>old<\/p>$/m);
    assert.match(out.text, /^\+<p>new<\/p>$/m);
    assert.equal(out.truncated, false);
  });

  test('marks a file missing from the base app as new', () => {
    const out = patchFromFiles('src/new.js', undefined, 'console.log(1);\n');
    assert.ok(out.text.startsWith('diff --git a/src/new.js b/src/new.js\nnew file mode 100644\n'));
  });

  test('returns an empty patch when nothing changed', () => {
    assert.equal(patchFromFiles('index.html', 'same\n', 'same\n').text, '');
  });
});
