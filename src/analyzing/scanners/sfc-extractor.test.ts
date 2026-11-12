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

void test('sfc-extractor: Glimmer .gts/.gjs files', async (t) => {
  const gts = [
    "import Component from '@glimmer/component';",
    'const Row = <template><tr><td>{{@name}}</td></tr></template>;',
    'export default class List extends Component {',
    '  onKeydown = (e: KeyboardEvent) => {};',
    '  <template>',
    '    {{! <input name="hidden-in-comment"> }}',
    '    <input {{on "keydown" this.onKeydown}} />',
    '  </template>',
    '}',
  ].join('\n');

  await t.test('blanks templates out of the script and keeps the statement around an expression template', () => {
    const blocks = extractScriptBlocks('app/components/list.gts', gts);
    assert.equal(blocks.length, 1);
    const block = blocks[0];
    assert.ok(block);
    assert.equal(block.virtualPath, 'app/components/list.gts.ts');
    assert.equal(block.blankedContent.length, gts.length);
    assert.equal(block.blankedContent.split('\n').length, gts.split('\n').length);
    assert.equal(block.blankedContent.includes('<template>'), false);
    assert.equal(block.blankedContent.includes('<input'), false);
    assert.match(block.blankedContent, /const Row = ` +`;/);
    assert.equal(block.blankedContent.includes('onKeydown = (e: KeyboardEvent) => {};'), true);

    assert.equal(extractScriptBlocks('app/components/list.gjs', gts)[0]?.virtualPath, 'app/components/list.gjs.js');
  });

  await t.test('keeps only template markup for DOM scanning', () => {
    const prepared = prepareHtmlForDomScan('app/components/list.gts', gts);
    assert.equal(prepared.length, gts.length);
    assert.equal(prepared.includes('import Component'), false);
    assert.equal(prepared.includes('onKeydown = '), false);
    assert.equal(prepared.includes('<template'), false);
    assert.equal(prepared.includes('</template>'), false);
    assert.equal(prepared.includes('hidden-in-comment'), false);
    assert.equal(prepared.includes('<tr><td>{{@name}}</td></tr>'), true);
    assert.equal(prepared.includes('<input {{on "keydown" this.onKeydown}} />'), true);
  });

  await t.test('ignores commented-out templates and blanks class-member templates after fields without semicolons', () => {
    const source = [
      '// const Old = <template><dialog open>old</dialog></template>;',
      'export default class Card extends Component {',
      "  title = 'Blåbær'",
      '  // the card body',
      '  <template><dialog open>{{this.title}}</dialog></template>',
      '}',
    ].join('\n');

    const script = extractScriptBlocks('card.gts', source)[0]?.blankedContent;
    assert.ok(script);
    assert.equal(script.length, source.length);
    assert.equal(script.includes('`'), false);
    assert.equal(script.includes('// const Old = <template>'), true);

    const prepared = prepareHtmlForDomScan('card.gts', source);
    assert.equal(prepared.length, source.length);
    assert.equal(prepared.includes('old</dialog>'), false);
    assert.equal(prepared.split('\n')[4], '            <dialog open>{{this.title}}</dialog>           ');
  });

  await t.test('treats `export default <template>` as an expression and ignores templates in strings', () => {
    const source = [
      "const markup = '<template>not a template</template>';",
      'const Hint = `<template>${markup}</template>`;',
      'export default <template><dialog open>{{markup}}</dialog></template>',
    ].join('\n');

    const script = extractScriptBlocks('hint.gjs', source)[0]?.blankedContent;
    assert.ok(script);
    assert.equal(script.split('\n')[0], source.split('\n')[0]);
    assert.equal(script.split('\n')[1], source.split('\n')[1]);
    assert.match(script.split('\n')[2] ?? '', /^export default ` +`$/);

    const prepared = prepareHtmlForDomScan('hint.gjs', source);
    assert.equal(prepared.includes('not a template'), false);
    assert.equal(prepared.includes('<dialog open>{{markup}}</dialog>'), true);
  });

  await t.test('finds class bodies past type arguments and keeps top-level `satisfies` parseable', () => {
    const source = [
      'class Card extends Component<{ Args: { title: string } }> {',
      '  <template>{{@title}}</template>',
      '}',
      'const options = { label: <template>Label</template> };',
      '<template><Card @title="x" /></template> satisfies TOC<{ Args: {} }>;',
    ].join('\n');

    const lines = extractScriptBlocks('card.gts', source)[0]?.blankedContent.split('\n');
    assert.ok(lines);
    assert.match(lines[1] ?? '', /^ +$/);
    assert.match(lines[3] ?? '', /^const options = \{ label: ` +` \};$/);
    assert.match(lines[4] ?? '', /^` +` satisfies TOC<\{ Args: \{\} \}>;$/);
  });
});
