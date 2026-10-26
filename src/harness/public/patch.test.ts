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
