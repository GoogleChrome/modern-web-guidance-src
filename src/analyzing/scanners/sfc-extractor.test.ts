import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankOutsideRange,
  blankPreprocessorLineComments,
  blankRanges,
  extractScriptBlocks,
  extractStyleBlocks,
  prepareHtmlForDomScan,
} from './sfc-extractor.ts';

void test('sfc-extractor: Lit CSS tag whitespace preserves source offsets', async (t) => {
  for (const separator of ['', ' ', '\t', '\n', '\r\n']) {
    await t.test(`separator ${JSON.stringify(separator)}`, () => {
      const css = '.card { color: red; }';
      const source = `const styles = css${separator}\`\n${css}\n\`;`;
      const blocks = extractStyleBlocks('src/card.ts', source);
      assert.equal(blocks.length, 1);
      assert.equal(blocks[0]?.trim(), css);
      assert.equal(blocks[0]?.length, source.length);
      assert.equal(blocks[0]?.indexOf(css), source.indexOf(css));
    });
  }
});

void test('sfc-extractor: Lit CSS preserves offsets and CRLF throughout the source', () => {
  const css = '.card { color: red; }';
  const source = [
    'import { css } from "lit";',
    'const styles = css',
    '`',
    css,
    '`;',
    '',
  ].join('\r\n');
  const blocks = extractStyleBlocks('src/card.ts', source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.trim(), css);
  assert.equal(blocks[0]?.length, source.length);
  assert.equal(blocks[0]?.indexOf(css), source.indexOf(css));
  assert.deepEqual(blocks[0]?.match(/\r\n/g), source.match(/\r\n/g));
});

// Known regex limitations; AST-based tagged-template extraction is a follow-up.
void test('sfc-extractor: ignores Lit CSS text inside comments', {
  todo: 'Requires AST-based tagged-template extraction',
}, () => {
  const source = '// css `.card { color: red; }`;';
  assert.deepEqual(extractStyleBlocks('src/card.ts', source), []);
});

void test('sfc-extractor: ignores Lit CSS text inside strings', {
  todo: 'Requires AST-based tagged-template extraction',
}, () => {
  const source = 'const text = "css `.card { color: red; }`";';
  assert.deepEqual(extractStyleBlocks('src/card.ts', source), []);
});

void test('sfc-extractor: Astro frontmatter extraction', async (t) => {
  await t.test('extracts frontmatter containing internal --- comments without premature termination', () => {
    const astro = [
      '---',
      '// --- Helpers ---',
      'import { helper } from "./utils.js";',
      '// --- Data ---',
      'const title = "Astro Page";',
      '---',
      '<h1>{title}</h1>',
    ].join('\n');

    const blocks = extractScriptBlocks('src/pages/index.astro', astro);
    assert.equal(blocks.length, 1);
    const block = blocks[0];
    assert.ok(block);
    assert.equal(block.virtualPath, 'src/pages/index.astro.ts');
    assert.equal(block.blankedContent.includes('// --- Helpers ---'), true);
    assert.equal(block.blankedContent.includes('const title = "Astro Page";'), true);
    assert.equal(block.blankedContent.includes('import { helper } from "./utils.js";'), true);
    // Content outside frontmatter must be blanked
    assert.equal(block.blankedContent.includes('<h1>'), false);
  });

  await t.test('extracts standard Astro frontmatter cleanly', () => {
    const astro = '---\nconst x = 42;\n---\n<p>{x}</p>';
    const blocks = extractScriptBlocks('src/pages/test.astro', astro);
    assert.equal(blocks.length, 1);
    const block = blocks[0];
    assert.ok(block);
    assert.equal(block.virtualPath, 'src/pages/test.astro.ts');
    assert.equal(block.blankedContent.includes('const x = 42;'), true);
  });
});

void test('sfc-extractor: Vue and Svelte script & style extraction', async (t) => {
  await t.test('extracts Vue scripts and styles', () => {
    const vue = '<template><div></div></template>\n<script>\nexport default {};\n</script>\n<style>\n.btn { color: red; }\n</style>';
    const scriptBlocks = extractScriptBlocks('src/App.vue', vue);
    assert.equal(scriptBlocks.length, 1);
    assert.equal(scriptBlocks[0]?.blankedContent.includes('export default {};'), true);

    const styleBlocks = extractStyleBlocks('src/App.vue', vue);
    assert.equal(styleBlocks.length, 1);
    assert.equal(styleBlocks[0]?.includes('.btn { color: red; }'), true);
  });

  await t.test('disambiguates virtual paths for multiple script blocks in one HTML file', () => {
    const html = [
      '<!DOCTYPE html>',
      '<html><body>',
      '<script>',
      'const a = 1;',
      '</script>',
      '<div>middle</div>',
      '<script lang="ts">',
      'const b: number = 2;',
      '</script>',
      '<script>',
      'const c = 3;',
      '</script>',
      '</body></html>',
    ].join('\n');

    const blocks = extractScriptBlocks('src/index.html', html);
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0]?.virtualPath, 'src/index.html.js');
    assert.equal(blocks[1]?.virtualPath, 'src/index.html.block1.ts');
    assert.equal(blocks[2]?.virtualPath, 'src/index.html.block2.js');
  });

  await t.test('blankOutsideRange, blankRanges, prepareHtmlForDomScan, and Lit css extraction', () => {
    const raw = 'line 1\nline 2: target\nline 3\n';
    const start = raw.indexOf('line 2: target');
    const end = start + 'line 2: target'.length;
    const blanked = blankOutsideRange(raw, start, end);
    assert.equal(blanked.length, raw.length);
    assert.equal(blanked.split('\n').length, raw.split('\n').length);
    assert.equal(blanked.slice(start, end), 'line 2: target');

    const multi = 'aaa\nbbb\nccc\nddd\n';
    const bbbStart = multi.indexOf('bbb');
    const blankedRanges = blankRanges(multi, [{ start: bbbStart, end: bbbStart + 3 }]);
    assert.equal(blankedRanges.length, multi.length);
    assert.equal(blankedRanges.includes('bbb'), false);
    assert.equal(blankedRanges.includes('ccc'), true);

    const vue =
      '<script>\nconst a = 1;\n</script>\n<template>\n  <button>Click</button>\n</template>\n<style>\nbutton { color: red; }\n</style>';
    const prepared = prepareHtmlForDomScan('App.vue', vue);
    assert.equal(prepared.length, vue.length);
    assert.equal(prepared.includes('<script>'), false);
    assert.equal(prepared.includes('<style>'), false);
    assert.equal(prepared.includes('<template>'), false);
    assert.equal(prepared.includes('<button>Click</button>'), true);

    const litTs = 'import { css } from "lit";\nconst s = css`\n  .card { color: ${"red"}; }\n`;';
    const litBlocks = extractStyleBlocks('card.ts', litTs);
    assert.equal(litBlocks.length, 1);
    assert.equal(litBlocks[0]?.includes('.card { color:'), true);
    assert.equal(litBlocks[0]?.includes('${"red"}'), false);
  });
});

void test('sfc-extractor: custom elements whose names start with script- or style-', async (t) => {
  const vue = [
    '<template>',
    '  <style-provider theme="dark">',
    '    <script-editor v-model="code"></script-editor>',
    '    <button>Save</button>',
    '  </style-provider>',
    '</template>',
    '<script setup>',
    'const code = "";',
    '</script>',
    '<style>',
    'button { color: red; }',
    '</style>',
  ].join('\n');

  await t.test('extracts only the real <script> body', () => {
    const blocks = extractScriptBlocks('App.vue', vue);
    assert.equal(blocks.length, 1);
    const content = blocks[0]?.blankedContent ?? '';
    assert.equal(content.includes('const code = "";'), true);
    assert.equal(content.includes('v-model'), false);
    assert.equal(content.includes('<button>'), false);
  });

  await t.test('extracts only the real <style> body', () => {
    const blocks = extractStyleBlocks('App.vue', vue);
    assert.equal(blocks.length, 1);
    const content = blocks[0] ?? '';
    assert.equal(content.includes('button { color: red; }'), true);
    assert.equal(content.includes('theme="dark"'), false);
    assert.equal(content.includes('<button>'), false);
  });

  await t.test('keeps the template markup for DOM scanning', () => {
    const prepared = prepareHtmlForDomScan('App.vue', vue);
    assert.equal(prepared.length, vue.length);
    assert.equal(prepared.includes('<style-provider theme="dark">'), true);
    assert.equal(prepared.includes('<script-editor v-model="code"></script-editor>'), true);
    assert.equal(prepared.includes('<button>Save</button>'), true);
    assert.equal(prepared.includes('const code'), false);
    assert.equal(prepared.includes('button { color: red; }'), false);
  });
});

void test('sfc-extractor: blankPreprocessorLineComments and preprocessor <style> blocks', async (t) => {
  await t.test('blanks // line comments while preserving offsets and CRLF newlines', () => {
    const scss = ['// header', '.box { color: red; } // inline', '// footer'].join('\r\n');
    const blanked = blankPreprocessorLineComments(scss);
    assert.equal(blanked.length, scss.length);
    assert.deepEqual(blanked.match(/\r\n/g), scss.match(/\r\n/g));
    assert.equal(blanked.includes('//'), false);
    assert.equal(blanked.includes('.box { color: red; }'), true);
  });

  await t.test('preserves // inside block comments, strings, and URLs', () => {
    const scss = [
      '.a { background: url(https://example.com/a.png); }',
      '.b { background: url(//cdn.example.com/b.png); }',
      '.c { content: "// literal"; }',
      '/* // block comment */',
      '.d { color: blue; }',
    ].join('\n');
    assert.equal(blankPreprocessorLineComments(scss), scss);
  });

  await t.test('blanks // comments inside <style lang="scss|sass|less"> only', () => {
    for (const lang of ['scss', 'sass', 'less']) {
      const vue = `<template><div/></template>\n<style lang="${lang}" scoped>\n// note\n.box { color: red; }\n</style>`;
      const blocks = extractStyleBlocks('App.vue', vue);
      assert.equal(blocks.length, 1);
      assert.equal(blocks[0]?.length, vue.length);
      assert.equal(blocks[0]?.includes('// note'), false);
      assert.equal(blocks[0]?.includes('.box { color: red; }'), true);
    }

    const plainVue = '<template><div/></template>\n<style>\n// preserved\n.box { content: "// ok"; }\n</style>';
    const plainBlocks = extractStyleBlocks('App.vue', plainVue);
    assert.equal(plainBlocks[0]?.includes('// preserved'), true);
  });
});
