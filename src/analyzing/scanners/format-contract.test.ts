import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { SyntaxKind } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';
import { shouldScanFile } from './file-filter.ts';
import {
  FORMAT_REGISTRY,
  type FormatEngine,
} from './format-registry.ts';
import { scanFiles } from './index.ts';

const CONTRACT_DOM_SNIPPET = '<custom-contract-element></custom-contract-element>';
const CONTRACT_JS_SNIPPET = '__contractJsTest__();';
const CONTRACT_CSS_SNIPPET = '.contract-css-target { color: red; }';
const CONTRACT_DEP_SNIPPET = '"contract-legacy-pkg": "^1.0.0"';

const testDomRule: AnalyzerRule = {
  id: 'contract-dom-rule',
  guideId: 'contract-test',
  guideHash: '000000000000',
  summary: 'Contract test DOM rule',
  verifierRubric: { keepWhen: [], dropWhen: [] },
  matcher: {
    kind: 'dom',
    selector: 'custom-contract-element',
    fastTokens: ['custom-contract-element'],
    matchElement(element) {
      if (element.tagName.toLowerCase() === 'custom-contract-element') {
        return { message: 'Contract DOM matched' };
      }
      return null;
    },
  } satisfies DomRuleMatcher,
};

const testJsRule: AnalyzerRule = {
  id: 'contract-js-rule',
  guideId: 'contract-test',
  guideHash: '000000000000',
  summary: 'Contract test JS rule',
  verifierRubric: { keepWhen: [], dropWhen: [] },
  matcher: {
    kind: 'js',
    fastTokens: ['__contractJsTest__'],
    matchFile(sourceFile) {
      const matches: AnalyzerMatch[] = [];
      sourceFile.forEachDescendant((node) => {
        if (
          node.getKind() === SyntaxKind.CallExpression &&
          (node as any).getExpression().getText() === '__contractJsTest__'
        ) {
          const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
          matches.push({ line, column, message: 'Contract JS matched' });
        }
      });
      return matches;
    },
  } satisfies JsRuleMatcher,
};

const testCssRule: AnalyzerRule = {
  id: 'contract-css-rule',
  guideId: 'contract-test',
  guideHash: '000000000000',
  summary: 'Contract test CSS rule',
  verifierRubric: { keepWhen: [], dropWhen: [] },
  matcher: {
    kind: 'css',
    fastTokens: ['.contract-css-target'],
    matchRule(styleRule) {
      if (styleRule.selectorText === '.contract-css-target') {
        return { message: 'Contract CSS matched' };
      }
      return null;
    },
  } satisfies CssRuleMatcher,
};

const testDepRule: AnalyzerRule = {
  id: 'contract-dep-rule',
  guideId: 'contract-test',
  guideHash: '000000000000',
  summary: 'Contract test Dependency rule',
  verifierRubric: { keepWhen: [], dropWhen: [] },
  matcher: {
    kind: 'dependency',
    packages: ['contract-legacy-pkg'],
    matchPackage(pkgName) {
      if (pkgName === 'contract-legacy-pkg') {
        return { message: 'Contract dependency matched' };
      }
      return null;
    },
  } satisfies DependencyRuleMatcher,
};

const RULE_BY_ENGINE: Readonly<Record<FormatEngine, AnalyzerRule>> = {
  dom: testDomRule,
  js: testJsRule,
  css: testCssRule,
  dependency: testDepRule,
};

const SNIPPET_BY_ENGINE: Readonly<Record<FormatEngine, string>> = {
  dom: CONTRACT_DOM_SNIPPET,
  js: CONTRACT_JS_SNIPPET,
  css: CONTRACT_CSS_SNIPPET,
  dependency: CONTRACT_DEP_SNIPPET,
};

interface FormatShell {
  readonly extension: string;
  readonly build: (slots: { dom?: string; js?: string; css?: string; dependency?: string }) => string;
}

const SHELLS: Readonly<Record<string, FormatShell>> = {
  css: {
    extension: 'css',
    build: ({ css = '/* default */' }) => [
      ':root { --theme: #3b82f6; }',
      css,
    ].join('\n'),
  },
  scss: {
    extension: 'scss',
    build: ({ css = '/* default */' }) => [
      '// SCSS theme stylesheet',
      '// Configuration section',
      css,
    ].join('\n'),
  },
  less: {
    extension: 'less',
    build: ({ css = '/* default */' }) => [
      '// Less theme stylesheet',
      '// Configuration section',
      css,
    ].join('\n'),
  },
  html: {
    extension: 'html',
    build: ({
      dom = '<main>Hello</main>',
      js = "console.log('client');",
      css = 'body { margin: 0; }',
    }) => [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <style>',
      `  ${css}`,
      '  </style>',
      '</head>',
      '<body>',
      `  ${dom}`,
      '  <script>',
      `  ${js}`,
      '  </script>',
      '</body>',
      '</html>',
    ].join('\n'),
  },
  php: {
    extension: 'php',
    build: ({
      dom = '<main>Hello</main>',
      js = "console.log('client');",
      css = 'body { margin: 0; }',
    }) => [
      "<?php $title = 'App'; ?>",
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <title><?= $title ?></title>',
      '  <style>',
      `  ${css}`,
      '  </style>',
      '</head>',
      '<body>',
      `  ${dom}`,
      '  <script>',
      `  ${js}`,
      '  </script>',
      '</body>',
      '</html>',
    ].join('\n'),
  },
  vue: {
    extension: 'vue',
    build: ({
      dom = '<div class="card">Hello</div>',
      js = "const title = 'Card';",
      css = '.card { padding: 1rem; }',
    }) => [
      '<script setup lang="ts">',
      js,
      '</script>',
      '<template>',
      `  ${dom}`,
      '</template>',
      '<style scoped>',
      css,
      '</style>',
    ].join('\n'),
  },
  svelte: {
    extension: 'svelte',
    build: ({
      dom = '<div class="container">Hello</div>',
      js = 'let count = 0;',
      css = '.container { margin: 0 auto; }',
    }) => [
      '<script context="module">',
      'export const preload = true;',
      '</script>',
      '<script>',
      js,
      '</script>',
      dom,
      '<style>',
      css,
      '</style>',
    ].join('\n'),
  },
  glimmer: {
    extension: 'gts',
    build: ({
      dom = '<div class="card">Hello</div>',
      js = "console.log('rendered');",
      css = '.card { color: blue; }',
    }) => [
      "import Component from '@glimmer/component';",
      '',
      'export default class Header extends Component {',
      '  <template>',
      '    <style>',
      `      ${css}`,
      '    </style>',
      `    ${dom}`,
      '  </template>',
      '',
      '  didRender() {',
      `    ${js}`,
      '  }',
      '}',
    ].join('\n'),
  },
  astro: {
    extension: 'astro',
    build: ({
      dom = '<main><h1>Hello</h1></main>',
      js = 'const title = "Astro";',
      css = 'main { display: flex; }',
    }) => [
      '---',
      js,
      '---',
      dom,
      '<script>',
      "console.log('client script');",
      '</script>',
      '<style>',
      css,
      '</style>',
    ].join('\n'),
  },
  javascript: {
    extension: 'js',
    build: ({
      js = "console.log('js');",
      css = '.box { color: red; }',
    }) => [
      "import { css } from 'lit';",
      'export function init() {',
      `  ${js}`,
      '}',
      'export const styles = css`',
      `  ${css}`,
      '`;',
    ].join('\n'),
  },
  typescript: {
    extension: 'ts',
    build: ({
      js = "console.log('ts');",
      css = '.box { color: red; }',
    }) => [
      "import { css } from 'lit';",
      'export function init() {',
      `  ${js}`,
      '}',
      'export const styles = css`',
      `  ${css}`,
      '`;',
    ].join('\n'),
  },
  jsx: {
    extension: 'jsx',
    build: ({
      dom = '<div className="container">Hello</div>',
      js = "console.log('jsx');",
      css = '.box { color: red; }',
    }) => [
      "import { css } from 'lit';",
      'export function init() {',
      `  ${js}`,
      '}',
      'export function Widget() {',
      '  return (',
      `    ${dom}`,
      '  );',
      '}',
      'export const styles = css`',
      `  ${css}`,
      '`;',
    ].join('\n'),
  },
  tsx: {
    extension: 'tsx',
    build: ({
      dom = '<div className="container">Hello</div>',
      js = "console.log('tsx');",
      css = '.box { color: red; }',
    }) => [
      "import { css } from 'lit';",
      'export function init() {',
      `  ${js}`,
      '}',
      'export function Widget() {',
      '  return (',
      `    ${dom}`,
      '  );',
      '}',
      'export const styles = css`',
      `  ${css}`,
      '`;',
    ].join('\n'),
  },
  'package.json': {
    extension: 'json',
    build: ({ dependency = '"neutral-pkg": "^1.0.0"' }) => [
      '{',
      '  "name": "fixture",',
      '  "dependencies": {',
      `    ${dependency}`,
      '  }',
      '}',
    ].join('\n'),
  },
  'styled-components-styled': {
    extension: 'ts',
    build: ({ css = 'color: red;' }) => `export const Box = styled.div\`\n  ${css}\n\`;`,
  },
  'object-styles': {
    extension: 'ts',
    build: ({ css = "color: 'red'" }) => `export const styles = {\n  root: {\n    ${css}\n  },\n};`,
  },
  'angular-inline': {
    extension: 'ts',
    build: ({ dom = '<p>Hello</p>', css = 'p { color: red; }' }) =>
      `@Component({\n  template: \`${dom}\`,\n  styles: [\`${css}\`],\n})\nexport class App {}`,
  },
  'lit-html': {
    extension: 'ts',
    build: ({ dom = '<p>Hello</p>' }) =>
      `import { html } from 'lit';\nexport const t = html\`${dom}\`;`,
  },
};

function findExpectedLine(content: string, snippet: string): number {
  const firstSnippetLine = snippet.trim().split('\n')[0] ?? '';
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes(firstSnippetLine));
  if (index === -1) {
    throw new Error(`Snippet line "${firstSnippetLine}" not found in content:\n${content}`);
  }
  return index + 1;
}

describe('FORMAT_REGISTRY scanFiles contract tests', () => {
  const supportedEntries = FORMAT_REGISTRY.filter((f) => f.status === 'supported');
  const expectedSkipEntries = FORMAT_REGISTRY.filter((f) => f.status === 'expected-skip');

  for (const entry of supportedEntries) {
    for (const engine of entry.engines) {
      test(`supported format "${entry.id}" produces finding for engine "${engine}"`, () => {
        const shell = SHELLS[entry.id];
        assert.ok(shell, `Missing shell builder for ${entry.id}`);

        const snippet = SNIPPET_BY_ENGINE[engine];
        const content = shell.build({ [engine]: snippet });
        const filePath = entry.id === 'package.json' ? 'package.json' : `src/app/item.${shell.extension}`;
        const expectedLine = findExpectedLine(content, snippet);
        const rule = RULE_BY_ENGINE[engine];
        const findings = scanFiles(new Map([[filePath, content]]), [rule]);

        assert.equal(
          findings.length,
          1,
          `Expected exactly 1 finding for "${entry.id}" x "${engine}", found ${findings.length}`,
        );
        const finding = findings[0]!;
        assert.equal(finding.file, filePath);
        assert.equal(finding.line, expectedLine);
      });
    }
  }

  describe('secondary extension routing', () => {
    test('.htm routes to DOM engine', () => {
      const htm = `<!DOCTYPE html>\n<html><body>\n${CONTRACT_DOM_SNIPPET}\n</body></html>`;
      const findings = scanFiles(new Map([['src/app/page.htm', htm]]), [testDomRule]);
      assert.equal(findings.length, 1);
    });

    test('.gjs routes to DOM engine', () => {
      const gjs = `<template>\n  ${CONTRACT_DOM_SNIPPET}\n</template>`;
      const findings = scanFiles(new Map([['src/app/Component.gjs', gjs]]), [testDomRule]);
      assert.equal(findings.length, 1);
    });

    test('.mjs routes to JS engine', () => {
      const mjs = `// mjs\n${CONTRACT_JS_SNIPPET}`;
      const findings = scanFiles(new Map([['src/app/index.mjs', mjs]]), [testJsRule]);
      assert.equal(findings.length, 1);
    });

    test('.cjs routes to JS engine', () => {
      const cjs = `// cjs\n${CONTRACT_JS_SNIPPET}`;
      const findings = scanFiles(new Map([['src/app/index.cjs', cjs]]), [testJsRule]);
      assert.equal(findings.length, 1);
    });

    test('.mts routes to JS engine', () => {
      const mts = `// mts\n${CONTRACT_JS_SNIPPET}`;
      const findings = scanFiles(new Map([['src/app/index.mts', mts]]), [testJsRule]);
      assert.equal(findings.length, 1);
    });

    test('.cts routes to JS engine', () => {
      const cts = `// cts\n${CONTRACT_JS_SNIPPET}`;
      const findings = scanFiles(new Map([['src/app/index.cts', cts]]), [testJsRule]);
      assert.equal(findings.length, 1);
    });
  });

  describe('expected-skip formats produce 0 findings', () => {
    for (const entry of expectedSkipEntries) {
      test(`expected-skip format "${entry.id}" produces 0 findings`, () => {
        const engine = entry.engines[0]!;
        const shell = SHELLS[entry.id];
        assert.ok(shell, `Missing shell builder for expected-skip ${entry.id}`);

        const snippet = SNIPPET_BY_ENGINE[engine];
        const content = shell.build({ [engine]: snippet });
        const filePath = `src/app/skip.${shell.extension}`;
        const rule = RULE_BY_ENGINE[engine];
        const findings = scanFiles(new Map([[filePath, content]]), [rule]);

        assert.equal(
          findings.length,
          0,
          `Expected 0 findings for expected-skip format "${entry.id}", found: ${JSON.stringify(findings)}`,
        );
      });
    }
  });

  describe('regression fixtures for real bugs (PR #3526, #3540, #3588)', () => {
    test('custom element starting with style- or script- is not treated as style/script block (#3526)', () => {
      const vue = [
        '<template>',
        '  <style-provider theme="dark">',
        `    ${CONTRACT_DOM_SNIPPET}`,
        '  </style-provider>',
        '</template>',
        '<style>',
        '.theme-btn { color: blue; }',
        '</style>',
      ].join('\n');

      const findings = scanFiles(new Map([['src/app/CustomProvider.vue', vue]]), [testDomRule]);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]?.file, 'src/app/CustomProvider.vue');
      assert.equal(findings[0]?.line, 3);
    });

    test('Lit css tagged template with whitespace before backtick is extracted (#3540)', () => {
      const ts = [
        "import { css } from 'lit';",
        'export const styles = css   `',
        `  ${CONTRACT_CSS_SNIPPET}`,
        '`;',
      ].join('\n');

      const findings = scanFiles(new Map([['src/app/whitespace-lit.ts', ts]]), [testCssRule]);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]?.file, 'src/app/whitespace-lit.ts');
      assert.equal(findings[0]?.line, 3);
    });

    // Marked as todo: style blocks inside HTML comments currently produce false positives on main (fix in PR #3588)
    test.todo('style block inside HTML comment produces zero findings (pending PR #3588)', () => {
      const html = [
        '<!--',
        '<style>',
        `  ${CONTRACT_CSS_SNIPPET}`,
        '</style>',
        '-->',
        '<div>hello</div>',
      ].join('\n');

      const findings = scanFiles(new Map([['src/app/comment.html', html]]), [testCssRule]);
      assert.equal(findings.length, 0);
    });
  });

  describe('gap 4c: Gerber PCB files with .gts extension are skipped', () => {
    test('skips Gerber PCB files by their %FS / %MO header', () => {
      const gerber = [
        '%FSLAX34Y34*%',
        '%MOMM*%',
        '<template>',
        '  <custom-contract-element></custom-contract-element>',
        '</template>',
      ].join('\n');

      assert.equal(shouldScanFile('board.gts', gerber), false);
      const findings = scanFiles(new Map([['board.gts', gerber]]), [testDomRule]);
      assert.equal(findings.length, 0);
    });

    test('still scans real Glimmer .gts files', () => {
      const glimmer = [
        "import Component from '@glimmer/component';",
        'export default class Card extends Component {',
        '  <template><custom-contract-element></custom-contract-element></template>',
        '}',
      ].join('\n');

      assert.equal(shouldScanFile('card.gts', glimmer), true);
    });
  });

  describe('gap 4d: hasSpreadAttribute and skipIfHasSpread in markup formats', () => {
    const testSpreadSkipRule: AnalyzerRule = {
      id: 'contract-spread-skip-rule',
      guideId: 'contract-test',
      guideHash: '000000000000',
      summary: 'Contract test spread skip rule',
      verifierRubric: { keepWhen: [], dropWhen: [] },
      matcher: {
        kind: 'dom',
        selector: 'custom-contract-element',
        fastTokens: ['custom-contract-element'],
        skipIfHasSpread: true,
        matchElement(element) {
          if (element.tagName.toLowerCase() === 'custom-contract-element') {
            return { message: 'Found element' };
          }
          return null;
        },
      } satisfies DomRuleMatcher,
    };

    let observedSpread = false;
    const testSpreadInspectRule: AnalyzerRule = {
      id: 'contract-spread-inspect-rule',
      guideId: 'contract-test',
      guideHash: '000000000000',
      summary: 'Contract test spread inspect rule',
      verifierRubric: { keepWhen: [], dropWhen: [] },
      matcher: {
        kind: 'dom',
        selector: 'custom-contract-element',
        fastTokens: ['custom-contract-element'],
        matchElement(element) {
          observedSpread = Boolean(element.hasSpreadAttribute);
          return { message: 'Found element' };
        },
      } satisfies DomRuleMatcher,
    };

    test('sets hasSpreadAttribute and respects skipIfHasSpread for Glimmer ...attributes', () => {
      const gts = '<template><custom-contract-element ...attributes /></template>';
      observedSpread = false;
      scanFiles(new Map([['src/Component.gts', gts]]), [testSpreadInspectRule]);
      assert.equal(observedSpread, true);

      const findings = scanFiles(new Map([['src/Component.gts', gts]]), [testSpreadSkipRule]);
      assert.equal(findings.length, 0);
    });

    test('sets hasSpreadAttribute and respects skipIfHasSpread for Svelte {...props}', () => {
      const svelte = '<custom-contract-element {...props} />';
      observedSpread = false;
      scanFiles(new Map([['src/Component.svelte', svelte]]), [testSpreadInspectRule]);
      assert.equal(observedSpread, true);

      const findings = scanFiles(new Map([['src/Component.svelte', svelte]]), [testSpreadSkipRule]);
      assert.equal(findings.length, 0);
    });

    test('sets hasSpreadAttribute and respects skipIfHasSpread for Vue v-bind="..."', () => {
      const vue = '<template><custom-contract-element v-bind="attrs" /></template>';
      observedSpread = false;
      scanFiles(new Map([['src/Component.vue', vue]]), [testSpreadInspectRule]);
      assert.equal(observedSpread, true);

      const findings = scanFiles(new Map([['src/Component.vue', vue]]), [testSpreadSkipRule]);
      assert.equal(findings.length, 0);
    });
  });
});
