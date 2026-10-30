import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankOutsideRange,
  blankRanges,
  extractScriptBlocks,
  extractStyleBlocks,
  prepareHtmlForDomScan,
} from './sfc-extractor.ts';

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
