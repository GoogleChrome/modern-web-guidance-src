import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SyntaxKind } from 'ts-morph';
import type {
  AnalyzerRule,
  CssRuleMatcher,
  DomRuleMatcher,
} from '../schema.ts';
import {
  normalizeCssDeclValue,
  scanCss,
  scanCssRules,
} from './css-scanner.ts';
import { scanHtml, scanJsx, tokenizeHtmlTags } from './dom-scanner.ts';
import { isProtectedByFeatureGuard } from './ast-helpers.ts';
import { withVirtualSourceFile } from './js-scanner.ts';
import { prepareHtmlForDomScan } from './sfc-extractor.ts';
import {
  computeGuideHash,
  createInMemoryProject,
  scanFiles,
  scanRepoFiles,
} from './index.ts';

void test('scanFiles: Lit CSS tag whitespace preserves finding locations', async (t) => {
  const rule: AnalyzerRule = {
    id: 'test-lit-anchor',
    guideId: 'anchor-positioning',
    guideHash: '000000000000',
    summary: 'test',
    matcher: {
      kind: 'css',
      fastTokens: ['anchor-name'],
      matchRule: (view) => view.hasProperty('anchor-name')
        ? { message: 'anchor declaration' }
        : null,
    },
    verifierRubric: { keepWhen: ['anchor declaration'], dropWhen: [] },
  };

  for (const extension of ['js', 'mjs', 'ts']) {
    for (const separator of ['', ' ', '\t', '\n', '\r\n']) {
      await t.test(`${extension}, separator ${JSON.stringify(separator)}`, () => {
        const source = `const styles = css${separator}\`\n.tooltip { anchor-name: --tip; }\n\`;`;
        const file = `src/card.${extension}`;
        const findings = scanFiles(new Map([[file, source]]), [rule]);
        assert.equal(findings.length, 1);
        assert.equal(findings[0]?.file, file);
        const line = source.slice(0, source.indexOf('.tooltip')).split('\n').length;
        assert.equal(findings[0]?.line, line);
        assert.ok(findings[0]?.codeSnippet.includes('.tooltip'));
      });
    }
  }

  for (const extension of ['js', 'mjs', 'ts']) {
    await t.test(`${extension}, CRLF line endings throughout`, () => {
      const source = [
        'import { css } from "lit";',
        'const styles = css',
        '`',
        '.tooltip { anchor-name: --tip; }',
        '`;',
        '',
      ].join('\r\n');
      const file = `src/card.${extension}`;
      const findings = scanFiles(new Map([[file, source]]), [rule]);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]?.file, file);
      assert.equal(findings[0]?.line, 4);
      assert.ok(findings[0]?.codeSnippet.includes('.tooltip'));
    });
  }

  await t.test('does not scan untagged templates or a different identifier as CSS', () => {
    for (const tag of ['', 'notcss ', 'obj.css']) {
      const source = `const styles = ${tag}\`.tooltip { anchor-name: --tip; }\`;`;
      assert.deepEqual(scanFiles(new Map([['src/card.js', source]]), [rule]), []);
    }
  });

  await t.test('ignores Lit CSS text in comments/strings and preserves lines across brace interpolations', () => {
    const ignored = [
      '// css `.tooltip { anchor-name: --tip; }`;',
      '/* css `.tooltip { anchor-name: --tip; }`; */',
      'const doc = "css `.tooltip { anchor-name: --tip; }`";',
      'const docTmpl = `css \\`.tooltip { anchor-name: --tip; }\\``;',
    ].join('\n');
    assert.deepEqual(scanFiles(new Map([['src/docs.ts', ignored]]), [rule]), []);

    const complexSource = [
      "import { css } from 'lit';",
      'const styles = css`',
      '  .a { content: "${fn("}")}"; }',
      '  .b { color: ${useDark ? `black` : `}`}; }',
      '  .tooltip { anchor-name: --tip; }',
      '`;',
    ].join('\n');
    const findings = scanFiles(new Map([['src/complex.ts', complexSource]]), [rule]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 5);
  });
});

void test('dom-scanner: HTML bare-attributes and JSX-DOM bridge', async (t) => {
  await t.test('tokenizeHtmlTags locates bare boolean attributes accurately', () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <div class="card">
    <input required type="password" id="pwd">
  </div>
</body>
</html>`;

    const tokens = tokenizeHtmlTags(html);
    const inputToken = tokens.find((tok) => tok.tagName === 'input');
    assert.ok(inputToken);
    assert.equal(inputToken.line, 5, 'bare required attribute is at line 5, not line 1');
    assert.equal(inputToken.attributes['required'], '');
    assert.equal(inputToken.attributes['type'], 'password');
  });

  await t.test('tokenizeHtmlTags ignores < inside script and style bodies', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-size: 14px; }
  </style>
  <script>
    if (a < b) {
      console.log('test <tag>');
    }
  </script>
</head>
<body>
  <input type="text" id="target">
</body>
</html>`;

    const tokens = tokenizeHtmlTags(html);
    const tagNames = tokens.map((tok) => tok.tagName);
    assert.deepEqual(tagNames, ['html', 'head', 'style', 'script', 'body', 'input']);
    const inputToken = tokens.find((tok) => tok.tagName === 'input');
    assert.ok(inputToken);
    assert.equal(inputToken.line, 14);
  });

  await t.test('tokenizeHtmlTags avoids index drift with non-1:1 case-folding characters before script', () => {
    const prefix = 'İ'.repeat(20);
    const html = `<div class="card">${prefix}</div>
<script>
  if (a < b) {
    console.log('test');
  }
</script>
<input id="after-script" type="text">`;

    const tokens = tokenizeHtmlTags(html);
    const inputToken = tokens.find((tok) => tok.attributes['id'] === 'after-script');
    assert.ok(inputToken, 'expected input token after script to be found');
    assert.equal(inputToken.line, 7);
    assert.equal(inputToken.tagName, 'input');
  });

  await t.test('scanHtml flags elements using DomRuleMatcher', () => {
    const html = `<form>
  <input type="password" id="user-password">
</form>`;

    const rule: DomRuleMatcher = {
      kind: 'dom',
      selector: 'input[type="password"]',
      fastTokens: ['type="password"'],
      matchElement: (el) => {
        if (!el.hasAttribute('autocomplete')) {
          return { message: 'Password input missing autocomplete attribute' };
        }
        return null;
      },
    };

    const matches = scanHtml('login.html', html, [rule]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /missing autocomplete/);
  });

  await t.test('scanHtml descends into <template> and nested <template> fragments with exact line numbers', () => {
    const html = `<div class=""></div>
<form class="direct-login">
  <input name="password" type="password">
</form>
<template name="ldapLoginForm">
  <form class="ldap">
    <input name="username" type="text" value="{{loginId}}">
    <input name="password" type="password">
    <template id="nested-step">
      <div id="lh-tools-dropdown" role="menu" class="lh-tools__dropdown"></div>
    </template>
  </form>
</template>
<form class="after-template">
  <input name="password" type="password">
</form>`;

    const passwordRule: DomRuleMatcher = {
      kind: 'dom',
      selector: 'form input[type="password"]',
      fastTokens: ['type="password"'],
      matchElement: (el) =>
        el.hasAttribute('autocomplete') ? null : { message: 'missing autocomplete' },
    };

    const menuRule: DomRuleMatcher = {
      kind: 'dom',
      selector: '[role="menu"]',
      fastTokens: ['role="menu"'],
      matchElement: () => ({ message: 'legacy role=menu' }),
    };

    const matches = scanHtml('accounts/login-buttons.html', html, [passwordRule, menuRule]);
    const byLine = matches.map((m) => ({ line: m.line, message: m.message }));
    assert.deepEqual(byLine, [
      { line: 3, message: 'missing autocomplete' },
      { line: 8, message: 'missing autocomplete' },
      { line: 15, message: 'missing autocomplete' },
      { line: 10, message: 'legacy role=menu' },
    ]);
  });

  await t.test('scanFiles descends into nested <template> blocks inside .vue SFCs with exact line numbers', () => {
    const vue = `<script setup lang="ts">
const showMenu = true;
</script>
<template>
  <div class="wrapper">
    <template v-if="showMenu">
      <ul class="dropdown__list" role="menu">
        <li role="menuitem">Edit</li>
      </ul>
    </template>
  </div>
</template>`;

    const menuRule: AnalyzerRule = {
      id: 'test/vue-nested-template-menu',
      guideId: 'menu',
      guideHash: '000000000000',
      summary: 'test rule',
      matcher: {
        kind: 'dom',
        selector: '[role="menu"]',
        fastTokens: ['role="menu"'],
        matchElement: () => ({ message: 'nested vue menu' }),
      },
      verifierRubric: { keepWhen: ['a'], dropWhen: ['b', 'c'] },
    };

    const findings = scanFiles(new Map([['src/Table.vue', vue]]), [menuRule], {
      repo: 'test',
      commit: 'HEAD',
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 7);
  });

  await t.test('scanHtml matches mixed-case attributes, avoids empty-attribute collisions, and preserves HTML5 first duplicate attribute', () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <input type="">
  <form>
    <input type="password" formControlName="password">
    <input type="password" name="pwd" name="override-pwd" class="  field   input  ">
  </form>
</body>
</html>`;

    const passwordRule: DomRuleMatcher = {
      kind: 'dom',
      selector: 'form input[type="password"]',
      fastTokens: ['type="password"'],
      matchElement: (el) => ({
        message: `found at ${el.getAttribute('formControlName') ?? el.getAttribute('name')}`,
      }),
    };

    const matches = scanHtml('login.component.html', html, [passwordRule]);
    assert.deepEqual(
      matches.map((m) => ({ line: m.line, message: m.message })),
      [
        { line: 6, message: 'found at password' },
        { line: 7, message: 'found at pwd' },
      ],
    );
  });

  await t.test('scanJsx matches JSX elements and respects skipIfHasSpread', () => {
    const project = createInMemoryProject();
    const code = `
    export function LoginForm() {
      return (
        <form>
          <input type="password" id="pass" />
          <input type="password" {...spreadProps} />
        </form>
      );
    }
    `;
    const sourceFile = project.createSourceFile('form.tsx', code);

    const rule: DomRuleMatcher = {
      kind: 'dom',
      selector: 'input[type="password"]',
      fastTokens: ['password'],
      skipIfHasSpread: true,
      matchElement: (el) => {
        if (!el.hasAttribute('autocomplete')) {
          return { message: 'JSX password missing autocomplete' };
        }
        return null;
      },
    };

    const matches = scanJsx('form.tsx', sourceFile, [rule]);
    // The spread input must be skipped; only the first input matches
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  await t.test('scanJsx respects skipIfDynamicAttributes', () => {
    const project = createInMemoryProject();
    const code = `
    export function Form(props: any) {
      return (
        <div>
          <input type="password" autocomplete={props.dynamicVal} />
        </div>
      );
    }
    `;
    const sourceFile = project.createSourceFile('dyn.tsx', code);

    const rule: DomRuleMatcher = {
      kind: 'dom',
      selector: 'input[type="password"]',
      fastTokens: ['password'],
      skipIfDynamicAttributes: ['autocomplete'],
      matchElement: () => ({ message: 'matched' }),
    };

    const matches = scanJsx('dyn.tsx', sourceFile, [rule]);
    assert.equal(matches.length, 0, 'skipped because autocomplete is dynamic');
  });
});

void test('css-scanner: cssomnom selector, declarations, and nested at-rules', async (t) => {
  const css = `
  .accordion-content {
    max-height: 0;
    transition: max-height 0.4s ease-out;
  }

  @media (min-width: 768px) {
    .drawer {
      max-height: 500px;
      transition: max-height 0.5s;
    }
  }

  @supports (interpolate-size: allow-keywords) {
    .modern {
      height: auto;
    }
  }
  `;

  await t.test('scans style rules and checks stylesheet properties', () => {
    const rule: CssRuleMatcher = {
      kind: 'css',
      fastTokens: ['max-height'],
      matchRule: (styleRule, ctx) => {
        if (
          styleRule.hasProperty('max-height') &&
          styleRule.hasProperty('transition')
        ) {
          // Check progressive enhancement
          const hasModernSupport = ctx.stylesheetHasProperty('interpolate-size');
          return {
            message: `max-height accordion animation found (progressive: ${hasModernSupport})`,
          };
        }
        return null;
      },
    };

    const matches = scanCss('styles.css', css, [rule]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /progressive: true/);
  });

  await t.test('detects shorthand and expanded properties via hasProperty and stylesheetHasProperty', () => {
    const shorthandCss = `
    .box {
      border: 1px solid red;
      outline: none;
      line-clamp: 3;
    }
    `;

    let checkedBorder = false;
    let checkedBorderColor = false;
    let checkedOutline = false;
    let checkedStylesheetLineClamp = false;

    const rule: CssRuleMatcher = {
      kind: 'css',
      fastTokens: ['border'],
      matchRule: (view, ctx) => {
        if (view.selectorText === '.box') {
          checkedBorder = view.hasProperty('border');
          checkedBorderColor = view.hasProperty('border-color');
          checkedOutline = view.hasProperty('outline');
          checkedStylesheetLineClamp = ctx.stylesheetHasProperty('line-clamp');
          return { message: 'box-match' };
        }
        return null;
      },
    };

    const matches = scanCss('shorthands.css', shorthandCss, [rule]);
    assert.equal(matches.length, 1);
    assert.equal(checkedBorder, true);
    assert.equal(checkedBorderColor, true);
    assert.equal(checkedOutline, true);
    assert.equal(checkedStylesheetLineClamp, true);
  });

  await t.test('visits nested @media inside style rule as CSSNestedDeclarations', () => {
    const nestedCss = `
    .card {
      color: blue;
      @media (width > 600px) {
        color: red;
      }
    }
    `;

    const visited: Array<{ selectorText: string; parentAtRule: string | null }> = [];

    const rule: CssRuleMatcher = {
      kind: 'css',
      fastTokens: ['color'],
      matchRule: (view) => {
        visited.push({
          selectorText: view.selectorText,
          parentAtRule: view.parentAtRule ?? null,
        });
        return { message: `visited-${view.selectorText}` };
      },
    };

    const matches = scanCss('nested.css', nestedCss, [rule]);
    assert.equal(matches.length, 2);
    assert.deepEqual(visited, [
      { selectorText: '.card', parentAtRule: null },
      { selectorText: '.card', parentAtRule: '@media (width > 600px)' },
    ]);
  });

  await t.test('preserves duplicate fallback declarations in view.declarations', () => {
    const fallbackCss = `
    .hero {
      background-image: -webkit-image-set(url('a.avif') 1x);
      background-image: image-set(url('a.avif') 1x);
    }
    `;

    let capturedDecls: ReadonlyArray<{ property: string; value: string }> = [];

    const rule: CssRuleMatcher = {
      kind: 'css',
      fastTokens: ['background-image'],
      matchRule: (view) => {
        capturedDecls = view.declarations;
        return { message: 'found' };
      },
    };

    const matches = scanCss('hero.css', fallbackCss, [rule]);
    assert.equal(matches.length, 1);
    assert.deepEqual(capturedDecls, [
      { property: 'background-image', value: `-webkit-image-set(url("a.avif") 1x)` },
      { property: 'background-image', value: `image-set(url("a.avif") 1x)` },
    ]);
  });

  await t.test('scanCssRules executes active rules in single-parse pass', () => {
    const multiRuleCss = `
    .btn {
      color: blue;
      max-height: 100px;
    }
    `;

    const dummyRule1: AnalyzerRule & { matcher: CssRuleMatcher } = {
      id: 'rule-1',
      guideId: 'rule-1',
      guideHash: '111111111111',
      summary: 'Rule 1',
      verifierRubric: { keepWhen: [], dropWhen: [] },
      matcher: {
        kind: 'css',
        fastTokens: ['color'],
        matchRule: (view) => {
          if (view.hasProperty('color')) {
            return { message: 'has-color' };
          }
          return null;
        },
      },
    };

    const dummyRule2: AnalyzerRule & { matcher: CssRuleMatcher } = {
      id: 'rule-2',
      guideId: 'rule-2',
      guideHash: '222222222222',
      summary: 'Rule 2',
      verifierRubric: { keepWhen: [], dropWhen: [] },
      matcher: {
        kind: 'css',
        fastTokens: ['max-height'],
        matchRule: (view) => {
          if (view.hasProperty('max-height')) {
            return { message: 'has-max-height' };
          }
          return null;
        },
      },
    };

    const results = scanCssRules('button.css', multiRuleCss, [dummyRule1, dummyRule2]);
    assert.equal(results.length, 2);
    assert.equal(results[0]?.rule.id, 'rule-1');
    assert.equal(results[0]?.match.message, 'has-color');
    assert.equal(results[1]?.rule.id, 'rule-2');
    assert.equal(results[1]?.match.message, 'has-max-height');
  });

  await t.test('normalizeCssDeclValue strips !important, trims, lowercases, and handles nullish inputs', () => {
    assert.equal(normalizeCssDeclValue('  NONE !important '), 'none');
    assert.equal(normalizeCssDeclValue('RGBA(0, 0, 0, 0) !IMPORTANT'), 'rgba(0, 0, 0, 0)');
    assert.equal(normalizeCssDeclValue('  12px  '), '12px');
    assert.equal(normalizeCssDeclValue(null), '');
    assert.equal(normalizeCssDeclValue(undefined), '');
  });

  await t.test('lazy parentAtRule and lazy stylesheetHasProperty cache results and expand shorthands', () => {
    const scopedCss = `
      @supports (text-box-trim: trim-both) {
        .modern { color: green; }
      }
      @scope (.card) {
        .title { margin: 4px 8px; }
        .body { border: 1px solid black; }
      }
    `;

    const parentAtRules: Array<string | null> = [];
    let hasMarginTop = false;
    let hasBorderBottomWidth = false;
    let hasTextBoxTrim = false;
    let hasMissingProp = true;

    const rule: CssRuleMatcher = {
      kind: 'css',
      fastTokens: ['@scope'],
      matchRule: (view, ctx) => {
        if (view.selectorText === '.title' || view.selectorText === '.body') {
          // Access parentAtRule multiple times across sibling rules sharing @scope
          assert.equal(view.parentAtRule, view.parentAtRule);
          parentAtRules.push(view.parentAtRule ?? null);
        }
        if (view.selectorText === '.body') {
          hasMarginTop = ctx.stylesheetHasProperty('margin-top');
          hasBorderBottomWidth = ctx.stylesheetHasProperty('border-bottom-width');
          hasTextBoxTrim = ctx.stylesheetHasProperty('text-box-trim');
          hasMissingProp = ctx.stylesheetHasProperty('non-existent-prop');
          // Second lookup hits propertyResultCache
          assert.equal(ctx.stylesheetHasProperty('margin-top'), true);
          assert.equal(ctx.stylesheetHasProperty('non-existent-prop'), false);
          return { message: 'matched-body' };
        }
        return null;
      },
    };

    const matches = scanCss('scoped.css', scopedCss, [rule]);
    assert.equal(matches.length, 1);
    assert.deepEqual(parentAtRules, ['@scope (.card)', '@scope (.card)']);
    assert.equal(hasMarginTop, true);
    assert.equal(hasBorderBottomWidth, true);
    assert.equal(hasTextBoxTrim, true);
    assert.equal(hasMissingProp, false);
  });
});

void test('scanFiles and computeGuideHash: end-to-end integration', () => {
  const guideContent = '# Autofill Sign In Form Guide\n\nModern pattern.';
  const hash = computeGuideHash(guideContent);
  assert.equal(hash.length, 12);

  const sampleRule: AnalyzerRule = {
    id: 'forms-autofill-password',
    guideId: 'autofill-sign-in-form',
    guideHash: hash,
    summary: 'Flag password inputs lacking autocomplete',
    verifierRubric: {
      keepWhen: ['Real sign-in or registration password input without autocomplete'],
      dropWhen: ['Custom password component with spread props'],
    },
    matcher: {
      kind: 'dom',
      selector: 'input[type="password"]',
      fastTokens: ['type="password"'],
      matchElement: (el) => {
        if (!el.hasAttribute('autocomplete')) {
          return { message: 'Missing autocomplete="current-password"' };
        }
        return null;
      },
    },
  };

  const files = new Map<string, string>([
    [
      'views/login.html',
      '<form>\n  <label>Password</label>\n  <input type="password" name="pwd">\n</form>\n',
    ],
    ['node_modules/dep/index.html', '<input type="password">'],
  ]);

  const findings = scanFiles(files, [sampleRule], {
    repo: 'test-org/test-repo',
    commit: 'a1b2c3d4e5f6',
  });

  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.ok(finding);
  assert.equal(finding.file, 'views/login.html');
  assert.equal(finding.line, 3);
  assert.equal(finding.ruleId, 'forms-autofill-password');
  assert.equal(finding.guideId, 'autofill-sign-in-form');
  assert.equal(finding.guideHash, hash);
  assert.equal(finding.cardId.length, 12);
  assert.ok(finding.codeSnippet.includes('>    3 |   <input type="password" name="pwd">'));
  assert.ok(finding.contextSlice);
  assert.equal(finding.lineContent, '<input type="password" name="pwd">');
});

void test('scanFiles: element rules scan JSX in .js/.mjs/.cjs, not in the TS family', async (t) => {
  const passwordRule: AnalyzerRule = {
    id: 'test-jsx-password',
    guideId: 'autofill-sign-in-form',
    guideHash: '000000000000',
    summary: 'test',
    verifierRubric: { keepWhen: [], dropWhen: [] },
    matcher: {
      kind: 'dom',
      selector: 'input[type="password"]',
      fastTokens: ['password'],
      matchElement: (el) =>
        el.hasAttribute('autocomplete') ? null : { message: 'missing autocomplete' },
    },
  };
  const jsxComponent = [
    "import React from 'react';",
    '',
    'export default function Login() {',
    '  return (',
    '    <form>',
    '      <input type="password" name="password" />',
    '    </form>',
    '  );',
    '}',
    '',
  ].join('\n');

  await t.test('reports the same element findings for .js/.mjs/.cjs as for .jsx', () => {
    const [reference] = scanFiles(new Map([['src/Login.jsx', jsxComponent]]), [passwordRule]);
    assert.ok(reference);
    for (const ext of ['.js', '.mjs', '.cjs']) {
      const findings = scanFiles(new Map([[`src/Login${ext}`, jsxComponent]]), [passwordRule]);
      assert.equal(findings.length, 1, ext);
      assert.equal(findings[0]?.line, reference.line, ext);
      assert.equal(findings[0]?.lineContent, reference.lineContent, ext);
      assert.equal(findings[0]?.codeSnippet, reference.codeSnippet, ext);
    }
  });

  await t.test('keeps .ts/.mts/.cts excluded (angle-bracket type assertions)', () => {
    const casts = 'const el = <HTMLInputElement>document.querySelector(\'[type="password"]\');\n';
    for (const ext of ['.ts', '.mts', '.cts']) {
      const files = new Map([
        [`src/view${ext}`, jsxComponent],
        [`src/casts${ext}`, casts],
      ]);
      assert.deepEqual(scanFiles(files, [passwordRule]), [], ext);
    }
  });

  await t.test('does not parse JSX-free .js files only because element fastTokens match', (st) => {
    const project = createInMemoryProject();
    const createSourceFile = st.mock.method(project, 'createSourceFile');
    const plain = [
      "// <input type=\"password\"> lives only in comments and strings here",
      "const markup = '<form><input type=\"password\"></form>';",
      'export const isLong = (password) => password.length > 8 && markup.length < 100;',
      '',
    ].join('\n');
    const findings = scanFiles(
      new Map([
        ['src/plain.js', plain],
        ['src/Login.js', jsxComponent],
      ]),
      [passwordRule],
      { project },
    );
    assert.deepEqual(
      createSourceFile.mock.calls.map((call) => call.arguments[0]),
      ['src/Login.js'],
    );
    assert.deepEqual(findings.map((f) => f.file), ['src/Login.js']);
  });

  await t.test('known limitation: skips .js JSX with no detectable lead-in', () => {
    // A comment between `return` and the tag hides the expression position from
    // the cheap pre-parse check, so the .js file gets no element findings.
    const hidden = [
      'export function Login() {',
      '  return /* sign-in */ <input type="password" />;',
      '}',
      '',
    ].join('\n');
    assert.equal(scanFiles(new Map([['src/Login.jsx', hidden]]), [passwordRule]).length, 1);
    assert.deepEqual(scanFiles(new Map([['src/Login.js', hidden]]), [passwordRule]), []);
  });
});

void test('sfc and multi-block scanning: Vue, Svelte, Astro, inline HTML, and Lit CSS', async (t) => {
  const domRule: AnalyzerRule = {
    id: 'test-dom-dialog',
    guideId: 'dialog-guide',
    guideHash: '123456789012',
    summary: 'Find dialog elements',
    verifierRubric: { keepWhen: ['dialog tag'], dropWhen: [] },
    matcher: {
      kind: 'dom',
      selector: 'dialog',
      fastTokens: ['<dialog'],
      matchElement: () => ({ message: 'found dialog' }),
    },
  };

  const jsRule: AnalyzerRule = {
    id: 'test-js-temporal',
    guideId: 'temporal-guide',
    guideHash: '123456789012',
    summary: 'Find Temporal usage',
    verifierRubric: { keepWhen: ['Temporal identifier'], dropWhen: [] },
    matcher: {
      kind: 'js',
      fastTokens: ['Temporal'],
      matchFile: (sourceFile) => {
        const matches = [];
        for (const node of sourceFile.getDescendants()) {
          if (node.getText() === 'Temporal') {
            matches.push({
              line: node.getStartLineNumber(),
              column: node.getStart() - node.getStartLinePos() + 1,
              message: 'found Temporal usage',
            });
          }
        }
        return matches;
      },
    },
  };

  const cssRule: AnalyzerRule = {
    id: 'test-css-anchor',
    guideId: 'anchor-guide',
    guideHash: '123456789012',
    summary: 'Find anchor-name declarations',
    verifierRubric: { keepWhen: ['anchor-name property'], dropWhen: [] },
    matcher: {
      kind: 'css',
      fastTokens: ['anchor-name'],
      matchRule: (styleRule) => {
        if (styleRule.hasProperty('anchor-name')) {
          return { message: `found anchor-name in ${styleRule.selectorText}` };
        }
        return null;
      },
    },
  };

  const rules = [domRule, jsRule, cssRule];

  await t.test('scans .vue SFC hitting DOM, JS, and CSS rules with exact line numbers', () => {
    const vueContent = [
      '<script setup lang="ts">',
      "import { ref } from 'vue';",
      'const count = ref(0);',
      'const now = Temporal.Now.instant();',
      '</script>',
      '',
      '<template>',
      '  <div class="container">',
      '    <dialog open>Hello</dialog>',
      '  </div>',
      '</template>',
      '',
      '<style scoped>',
      '.container {',
      '  anchor-name: --my-anchor;',
      '}',
      '</style>',
    ].join('\n');

    const findings = scanFiles(new Map([['src/App.vue', vueContent]]), rules);
    assert.equal(findings.length, 3);

    const domFinding = findings.find((f) => f.ruleId === 'test-dom-dialog');
    assert.ok(domFinding);
    assert.equal(domFinding.file, 'src/App.vue');
    assert.equal(domFinding.line, 9);
    assert.ok(domFinding.codeSnippet.includes('>    9 |     <dialog open>Hello</dialog>'));

    const jsFinding = findings.find((f) => f.ruleId === 'test-js-temporal');
    assert.ok(jsFinding);
    assert.equal(jsFinding.file, 'src/App.vue');
    assert.equal(jsFinding.line, 4);
    assert.ok(jsFinding.codeSnippet.includes('>    4 | const now = Temporal.Now.instant();'));

    const cssFinding = findings.find((f) => f.ruleId === 'test-css-anchor');
    assert.ok(cssFinding);
    assert.equal(cssFinding.file, 'src/App.vue');
    assert.equal(cssFinding.line, 14);
    assert.ok(cssFinding.codeSnippet.includes('>   14 | .container {'));
  });

  await t.test('scans .svelte and .astro multi-block files with exact line numbers', () => {
    const svelteContent = [
      '<script>',
      '  const now = Temporal.Now.instant();',
      '</script>',
      '',
      '<dialog open>Svelte Dialog</dialog>',
      '',
      '<style>',
      '  dialog {',
      '    anchor-name: --svelte-anchor;',
      '  }',
      '</style>',
    ].join('\n');

    const svelteFindings = scanFiles(new Map([['src/App.svelte', svelteContent]]), rules);
    assert.equal(svelteFindings.length, 3);

    const svelteJs = svelteFindings.find((f) => f.ruleId === 'test-js-temporal');
    assert.ok(svelteJs);
    assert.equal(svelteJs.line, 2);

    const svelteDom = svelteFindings.find((f) => f.ruleId === 'test-dom-dialog');
    assert.ok(svelteDom);
    assert.equal(svelteDom.line, 5);

    const svelteCss = svelteFindings.find((f) => f.ruleId === 'test-css-anchor');
    assert.ok(svelteCss);
    assert.equal(svelteCss.line, 8);

    const astroContent = [
      '---',
      'const now = Temporal.Now.instant();',
      '---',
      '',
      '<dialog open>Astro Dialog</dialog>',
      '',
      '<style>',
      '  dialog {',
      '    anchor-name: --astro-anchor;',
      '  }',
      '</style>',
    ].join('\n');

    const astroFindings = scanFiles(new Map([['src/pages/index.astro', astroContent]]), rules);
    assert.equal(astroFindings.length, 3);

    const astroJs = astroFindings.find((f) => f.ruleId === 'test-js-temporal');
    assert.ok(astroJs);
    assert.equal(astroJs.line, 2);

    const astroDom = astroFindings.find((f) => f.ruleId === 'test-dom-dialog');
    assert.ok(astroDom);
    assert.equal(astroDom.line, 5);

    const astroCss = astroFindings.find((f) => f.ruleId === 'test-css-anchor');
    assert.ok(astroCss);
    assert.equal(astroCss.line, 8);
  });

  await t.test('scans .gts and .gjs Glimmer files with exact line numbers', () => {
    const gtsContent = [
      "import Component from '@glimmer/component';",
      '',
      'const Badge = <template><span>{{@label}}</span></template>;',
      '',
      'export default class Clock extends Component {',
      '  now = Temporal.Now.instant();',
      '',
      '  <template>',
      '    {{!-- <dialog open>commented out</dialog> --}}',
      '    <dialog open>{{this.now}}</dialog>',
      '    <style>',
      '      dialog { anchor-name: --clock; }',
      '    </style>',
      '  </template>',
      '}',
    ].join('\n');

    const gtsFindings = scanFiles(new Map([['app/components/clock.gts', gtsContent]]), rules);
    assert.equal(gtsFindings.length, 3);
    assert.equal(gtsFindings.find((f) => f.ruleId === 'test-js-temporal')?.line, 6);
    assert.equal(gtsFindings.find((f) => f.ruleId === 'test-dom-dialog')?.line, 10);
    assert.equal(gtsFindings.find((f) => f.ruleId === 'test-css-anchor')?.line, 12);

    const gjsContent = [
      'const now = Temporal.Now.instant();',
      '',
      '<template>',
      '  <dialog open>{{now}}</dialog>',
      '</template>',
    ].join('\n');

    const gjsFindings = scanFiles(new Map([['app/components/clock.gjs', gjsContent]]), rules);
    assert.equal(gjsFindings.length, 2);
    assert.equal(gjsFindings.find((f) => f.ruleId === 'test-js-temporal')?.line, 1);
    assert.equal(gjsFindings.find((f) => f.ruleId === 'test-dom-dialog')?.line, 4);
  });

  // Reports each TypeScript syntax error, so code mis-read around a template is a finding.
  const syntaxErrorRule: AnalyzerRule = {
    id: 'test-js-syntax-error',
    guideId: 'syntax-guide',
    guideHash: '123456789012',
    summary: 'Report syntax errors',
    verifierRubric: { keepWhen: ['syntax error'], dropWhen: [] },
    matcher: {
      kind: 'js',
      fastTokens: [],
      matchFile: (sourceFile) =>
        sourceFile
          .getProject()
          .getProgram()
          .getSyntacticDiagnostics(sourceFile)
          .map((diagnostic) => ({ line: diagnostic.getLineNumber() ?? 0, column: 1, message: 'syntax error' })),
    },
  };

  // Each template's text says "Temporal": if a template is missed, its markup reaches the
  // JS rule as code and adds a `test-js-temporal` finding on that line.
  const glimmerFindings = (content: string, path = 'app/components/card.gts') =>
    scanFiles(new Map([[path, content]]), [...rules, syntaxErrorRule])
      .map((f) => `${f.ruleId}:${f.line}`)
      .sort();

  await t.test('.gts: a template ends at the first </template>, as in content-tag', () => {
    // content-tag does not support a platform-native <template> nested inside, so Ember
    // cannot build this file. The markup after the inner </template> is not a template.
    const gts = [
      'export default class Modal extends Component {',
      '  <template>',
      '    <template id="row"><span>x</span></template>',
      '    <dialog open>After</dialog>',
      '  </template>',
      '}',
    ].join('\n');
    assert.equal(glimmerFindings(gts).includes('test-dom-dialog:4'), false);
  });

  await t.test('.gts: comment before `class` and braces in `extends`', () => {
    const commentBeforeClass = [
      'export/* */class Card extends Component {',
      '  <template><dialog open>Temporal</dialog></template>',
      '  now = Temporal.Now.instant();',
      '}',
    ].join('\n');
    assert.deepEqual(glimmerFindings(commentBeforeClass), ['test-dom-dialog:2', 'test-js-temporal:3']);

    const bracesInExtends = [
      'class Card extends makeBase({ a: 1 }) {',
      '  <template><dialog open>Temporal</dialog></template>',
      '  now = Temporal.Now.instant();',
      '}',
    ].join('\n');
    assert.deepEqual(glimmerFindings(bracesInExtends), ['test-dom-dialog:2', 'test-js-temporal:3']);
  });

  await t.test('.gjs: regex literals before a template', () => {
    const regexAfterIf = [
      "if (cond) /'/.test(s);",
      'export default <template><dialog open>Temporal</dialog></template>;',
      'const now = Temporal.Now.instant();',
    ].join('\n');
    assert.deepEqual(glimmerFindings(regexAfterIf, 'app/components/card.gjs'), [
      'test-dom-dialog:2',
      'test-js-temporal:3',
    ]);

    const quotesAndSlashes = [
      "const clean = (s) => s.replace(/['\"`]+/g, '').replace(/https?:\\/\\//, '');",
      'const half = total / 2 / count;',
      'export const Card = <template><dialog open>Temporal</dialog></template>;',
      'const now = Temporal.Now.instant();',
    ].join('\n');
    assert.deepEqual(glimmerFindings(quotesAndSlashes, 'app/components/card.gjs'), [
      'test-dom-dialog:3',
      'test-js-temporal:4',
    ]);
  });

  await t.test('.gts: templates in comments, strings and template literals are not templates', () => {
    const gts = [
      '// const Old = <template><dialog open>Temporal</dialog></template>;',
      "const markup = '<template><dialog open>Temporal</dialog></template>';",
      'const label = `${format({ unit: "}" })} <template><dialog open></dialog></template>`;',
      'export default class Card extends Component {',
      '  <template>',
      '    {{!-- <dialog open>Temporal</dialog> --}}',
      '    {{~! <dialog open>Temporal</dialog> ~}}',
      '    <dialog open>Temporal</dialog>',
      '  </template>',
      '}',
    ].join('\n');
    assert.deepEqual(glimmerFindings(gts), ['test-dom-dialog:8']);
  });

  await t.test('.gts: templates in expressions, callbacks and after fields without semicolons', () => {
    const gts = [
      "test('renders', async () => {",
      '  await render(<template><dialog open>Temporal</dialog></template>);',
      '});',
      'const columns = [{ Cell: <template><dialog open>Temporal</dialog></template> }];',
      'class Row extends Component {',
      '  items: Array<string>',
      '  ratings = [1, 2, 3]',
      '  <template><dialog open>Temporal</dialog></template>',
      '  now = Temporal.Now.instant()',
      '}',
      '<template><dialog open>Temporal</dialog></template> satisfies TOC<{ Args: {} }>;',
    ].join('\n');
    assert.deepEqual(glimmerFindings(gts), [
      'test-dom-dialog:11',
      'test-dom-dialog:2',
      'test-dom-dialog:4',
      'test-dom-dialog:8',
      'test-js-temporal:9',
    ]);
  });

  await t.test('.gts: line numbers after multi-byte characters, and styles only from templates', () => {
    const gts = [
      "const title = '🎵 Blåbær';",
      '// <style>p { anchor-name: --js-comment; }</style>',
      'export default class Card extends Component {',
      '  <template>',
      '    {{!-- <style>p { anchor-name: --hbs-comment; }</style> --}}',
      '    <dialog open>{{title}}</dialog>',
      '    <style>dialog { anchor-name: --card; }</style>',
      '  </template>',
      '}',
    ].join('\n');
    assert.deepEqual(glimmerFindings(gts), ['test-css-anchor:7', 'test-dom-dialog:6']);
  });

  await t.test('scans .html file with inline <script> and <style> with exact line numbers', () => {
    const htmlContent = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '  <style>',
      '    .banner {',
      '      anchor-name: --top-banner;',
      '    }',
      '  </style>',
      '  <script>',
      '    const now = Temporal.Now.instant();',
      '  </script>',
      '</head>',
      '<body>',
      '  <dialog open>Inline HTML Dialog</dialog>',
      '</body>',
      '</html>',
    ].join('\n');

    const htmlFindings = scanFiles(new Map([['public/index.html', htmlContent]]), rules);
    assert.equal(htmlFindings.length, 3);

    const htmlCss = htmlFindings.find((f) => f.ruleId === 'test-css-anchor');
    assert.ok(htmlCss);
    assert.equal(htmlCss.line, 5);

    const htmlJs = htmlFindings.find((f) => f.ruleId === 'test-js-temporal');
    assert.ok(htmlJs);
    assert.equal(htmlJs.line, 10);

    const htmlDom = htmlFindings.find((f) => f.ruleId === 'test-dom-dialog');
    assert.ok(htmlDom);
    assert.equal(htmlDom.line, 14);
  });

  await t.test('scans Lit css tagged template literals in .ts file with exact line numbers', () => {
    const litTsContent = [
      "import { LitElement, html, css } from 'lit';",
      '',
      'export class MyElement extends LitElement {',
      '  static styles = css`',
      '    :host {',
      '      display: block;',
      '    }',
      '    .tooltip {',
      '      anchor-name: --lit-tooltip;',
      '    }',
      '  `;',
      '}',
    ].join('\n');

    const litFindings = scanFiles(new Map([['src/components/my-element.ts', litTsContent]]), rules);
    assert.equal(litFindings.length, 1);

    const litCss = litFindings[0];
    assert.ok(litCss);
    assert.equal(litCss.ruleId, 'test-css-anchor');
    assert.equal(litCss.file, 'src/components/my-element.ts');
    assert.equal(litCss.line, 8);
    assert.ok(litCss.codeSnippet.includes('>    8 |     .tooltip {'));
  });
});

void test('scanFiles: SCSS/Less files and // comments in <style lang="scss|less"> (#3553)', () => {
  const thumbRule: AnalyzerRule = {
    id: 'test-css-scrollbar-thumb',
    guideId: 'customize-scrollbar-color-and-thickness',
    guideHash: '123456789012',
    summary: 'Flags ::-webkit-scrollbar-thumb',
    verifierRubric: { keepWhen: ['scrollbar thumb'], dropWhen: [] },
    matcher: {
      kind: 'css',
      fastTokens: ['scrollbar-thumb'],
      matchRule: (view) =>
        view.selectorText.includes('scrollbar-thumb')
          ? { message: `found scrollbar thumb in ${view.selectorText}` }
          : null,
    },
  };

  const legacyRule = '.box::-webkit-scrollbar-thumb { background: red; }';
  const files = new Map<string, string>([
    ['src/styles/case1.css', legacyRule],
    ['src/styles/case2.scss', `// header comment\n.custom {\n  &::-webkit-scrollbar-thumb { background: red; }\n}`],
    ['src/styles/case2.less', `@thumb-bg: red;\n// header comment\n.custom {\n  &::-webkit-scrollbar-thumb { background: @thumb-bg; }\n}`],
    ['src/AppClean.vue', `<template><div/></template>\n<style lang="scss">\n${legacyRule}\n</style>`],
    ['src/AppBlockComment.vue', `<template><div/></template>\n<style lang="scss">\n/* comment */\n${legacyRule}\n</style>`],
    ['src/AppLineComment.vue', `<template><div/></template>\n<style lang="scss">\n// line comment\n${legacyRule}\n</style>`],
    ['src/AppLessComment.vue', `<template><div/></template>\n<style lang="less">\n// line comment\n${legacyRule}\n</style>`],
    ['src/styles/case6_nested.css', '.box { &::-webkit-scrollbar-thumb { background: red; } }'],
  ]);

  const findings = scanFiles(files, [thumbRule]);
  assert.equal(findings.length, 8);

  const byFile = new Map(findings.map((f) => [f.file, f]));
  assert.equal(byFile.get('src/styles/case1.css')?.line, 1);
  assert.equal(byFile.get('src/styles/case2.scss')?.line, 3);
  assert.ok(byFile.get('src/styles/case2.scss')?.codeSnippet.includes('// header comment'));
  assert.equal(byFile.get('src/styles/case2.less')?.line, 4);
  assert.ok(byFile.get('src/styles/case2.less')?.codeSnippet.includes('// header comment'));
  assert.equal(byFile.get('src/AppClean.vue')?.line, 3);
  assert.equal(byFile.get('src/AppBlockComment.vue')?.line, 4);
  assert.equal(byFile.get('src/AppLineComment.vue')?.line, 4);
  assert.equal(byFile.get('src/AppLessComment.vue')?.line, 4);
  assert.equal(byFile.get('src/styles/case6_nested.css')?.line, 1);
});

void test('scanFiles: SCSS // edge cases, URL preservation, and CRLF line numbers (#3553)', () => {
  const thumbRule: AnalyzerRule = {
    id: 'test-css-scrollbar-thumb',
    guideId: 'customize-scrollbar-color-and-thickness',
    guideHash: '123456789012',
    summary: 'Flags ::-webkit-scrollbar-thumb',
    verifierRubric: { keepWhen: ['scrollbar thumb'], dropWhen: [] },
    matcher: {
      kind: 'css',
      fastTokens: ['scrollbar-thumb'],
      matchRule: (view) =>
        view.selectorText.includes('scrollbar-thumb')
          ? { message: `found scrollbar thumb in ${view.selectorText}` }
          : null,
    },
  };

  const legacyRule = '.box::-webkit-scrollbar-thumb { background: red; }';
  const files = new Map<string, string>([
    ['src/styles/commented-out.scss', `// ${legacyRule}`],
    ['src/styles/commented-out.less', `// ${legacyRule}`],
    [
      'src/styles/url-spaced.scss',
      `.h { background: url( //cdn.example.com/b.png ); }\n${legacyRule}`,
    ],
    [
      'src/styles/url-path-slashes.scss',
      `.h { background: url(/images//logo.png); }\n${legacyRule}`,
    ],
    [
      'src/styles/paren-and-scheme-crlf.scss',
      [
        '.a { color: rgb(// red',
        '  255, 0, 0); }',
        '.b { color:// comment',
        '  blue; }',
        legacyRule,
      ].join('\r\n'),
    ],
  ]);

  const findings = scanFiles(files, [thumbRule]);
  const byFile = new Map(findings.map((f) => [f.file, f]));

  assert.equal(byFile.has('src/styles/commented-out.scss'), false);
  assert.equal(byFile.has('src/styles/commented-out.less'), false);
  assert.equal(byFile.get('src/styles/url-spaced.scss')?.line, 2);
  assert.equal(byFile.get('src/styles/url-path-slashes.scss')?.line, 2);
  assert.equal(byFile.get('src/styles/paren-and-scheme-crlf.scss')?.line, 5);
  assert.equal(findings.length, 3);
});

void test('slice-c: vendored library whole-file detection & AST matcher suppression', async (testingContext) => {
  const fittextRule: AnalyzerRule = {
    id: 'dependency-jquery-fittext',
    guideId: 'fittext-modernization',
    guideHash: 'abcdef123456',
    summary: 'Replace jQuery FitText with CSS clamp()',
    verifierRubric: { keepWhen: ['FitText usage'], dropWhen: [] },
    matcher: {
      kind: 'dependency',
      packages: ['jquery-fittext', 'fittext'],
      matchPackage: (pkgName) => ({
        message: `Package "${pkgName}" is targeted for CSS clamp() migration.`,
      }),
    },
  };

  const bslRule: AnalyzerRule = {
    id: 'dependency-body-scroll-lock',
    guideId: 'body-scroll-lock-modernization',
    guideHash: 'abcdef123456',
    summary: 'Replace body-scroll-lock with CSS overscroll-behavior',
    verifierRubric: { keepWhen: ['body-scroll-lock usage'], dropWhen: [] },
    matcher: {
      kind: 'dependency',
      packages: ['body-scroll-lock'],
    },
  };

  const jsAstRule: AnalyzerRule = {
    id: 'js-legacy-measurements',
    guideId: 'measurement-guide',
    guideHash: 'abcdef123456',
    summary: 'Flag getBoundingClientRect calls',
    verifierRubric: { keepWhen: ['measurement calls'], dropWhen: [] },
    matcher: {
      kind: 'js',
      fastTokens: ['getBoundingClientRect'],
      matchFile: (sourceFile) => {
        const matches = [];
        for (const descendant of sourceFile.getDescendants()) {
          if (
            descendant.getKind() === SyntaxKind.Identifier &&
            descendant.getText() === 'getBoundingClientRect'
          ) {
            matches.push({
              line: descendant.getStartLineNumber(),
              message: 'Flagged legacy measurement',
            });
          }
        }
        return matches;
      },
    },
  };

  await testingContext.test('produces exactly 1 file-level finding at line 1 for vendored library files', () => {
    const files = new Map<string, string>([
      [
        'vendor/jquery.fittext.js',
        '/*! jQuery FitText.js 1.2 */\n(function($){\n  var el = document.getElementById("box");\n  el.getBoundingClientRect();\n})(jQuery);',
      ],
      [
        'libs/body-scroll-lock.min.js',
        'var bodyScrollLock=function(){ document.body.getBoundingClientRect(); };',
      ],
    ]);

    const findings = scanFiles(files, [fittextRule, bslRule, jsAstRule], {
      repo: 'test-org/test-app',
      commit: '1234567890ab',
    });

    // Exactly 1 finding for fittext and 1 finding for body-scroll-lock
    assert.equal(findings.length, 2);

    const fittextFinding = findings.find((finding) => finding.file === 'vendor/jquery.fittext.js');
    assert.ok(fittextFinding);
    assert.equal(fittextFinding.line, 1);
    assert.equal(fittextFinding.ruleId, 'dependency-jquery-fittext');
    assert.equal(fittextFinding.isVendoredLibrary, true);
    assert.match(fittextFinding.message, /jquery\.fittext\.js/);
    assert.match(fittextFinding.message, /targeted for CSS clamp\(\) migration/);

    const bslFinding = findings.find((finding) => finding.file === 'libs/body-scroll-lock.min.js');
    assert.ok(bslFinding);
    assert.equal(bslFinding.line, 1);
    assert.equal(bslFinding.ruleId, 'dependency-body-scroll-lock');
    assert.equal(bslFinding.isVendoredLibrary, true);
    assert.match(bslFinding.message, /body-scroll-lock/);
  });

  await testingContext.test('produces 0 line-by-line JS AST findings inside vendored library files', () => {
    const files = new Map<string, string>([
      [
        'vendor/jquery.fittext.js',
        '/*! jQuery FitText.js 1.2 */\n' +
          'function compute() {\n' +
          '  element.getBoundingClientRect();\n' +
          '  element.getBoundingClientRect();\n' +
          '  element.getBoundingClientRect();\n' +
          '}\n',
      ],
      [
        'vendor/moment-with-cn.js',
        '//! moment.js\n//! locale : chinese (zh-cn)\n' +
          'function run() {\n' +
          '  element.getBoundingClientRect();\n' +
          '}\n',
      ],
    ]);

    const findings = scanFiles(files, [jsAstRule]);
    assert.equal(findings.length, 0, 'vendored files must produce 0 line-by-line JS AST findings');
  });

  await testingContext.test('files inside node_modules, dist, and build produce 0 findings of any kind', () => {
    const files = new Map<string, string>([
      [
        'node_modules/jquery-fittext/jquery.fittext.js',
        '/*! jQuery FitText.js 1.2 */\n(function($){})(jQuery);',
      ],
      [
        'dist/body-scroll-lock.min.js',
        'var bodyScrollLock=function(){};',
      ],
      [
        'build/tablesaw.js',
        '/*! Tablesaw - v3.1.2 */',
      ],
    ]);

    const findings = scanFiles(files, [fittextRule, bslRule, jsAstRule]);
    assert.equal(findings.length, 0, 'node_modules, dist, and build must produce 0 findings');
  });

  await testingContext.test('scanRepoFiles walks disk and collects vendored files while skipping build output', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'slice-c-repo-'));
    try {
      await mkdir(join(tempDir, 'vendor'), { recursive: true });
      await mkdir(join(tempDir, 'node_modules', 'pkg'), { recursive: true });
      await mkdir(join(tempDir, 'dist'), { recursive: true });
      await mkdir(join(tempDir, 'src'), { recursive: true });

      await writeFile(
        join(tempDir, 'vendor', 'jquery.fittext.js'),
        '/*! jQuery FitText.js 1.2 */\n(function($){\n  document.body.getBoundingClientRect();\n})(jQuery);',
      );
      await writeFile(
        join(tempDir, 'node_modules', 'pkg', 'jquery.fittext.js'),
        '/*! jQuery FitText.js 1.2 */',
      );
      await writeFile(
        join(tempDir, 'dist', 'bundle.js'),
        '/*! FitText */',
      );
      await writeFile(
        join(tempDir, 'src', 'app.js'),
        'const rect = document.body.getBoundingClientRect();',
      );

      const findings = await scanRepoFiles(tempDir, [fittextRule, jsAstRule], {
        repo: 'test-org/repo-scan',
        commit: 'feedbeef1234',
      });

      // Exactly 2 findings: 1 whole-file vendored finding at line 1 for vendor/jquery.fittext.js,
      // and 1 AST finding for src/app.js. 0 findings for node_modules/dist, and 0 AST findings inside vendored file.
      assert.equal(findings.length, 2);

      const vendoredFinding = findings.find((finding) => finding.file === 'vendor/jquery.fittext.js');
      assert.ok(vendoredFinding);
      assert.equal(vendoredFinding.line, 1);
      assert.equal(vendoredFinding.isVendoredLibrary, true);
      assert.equal(vendoredFinding.ruleId, 'dependency-jquery-fittext');

      const appFinding = findings.find((finding) => finding.file === 'src/app.js');
      assert.ok(appFinding);
      assert.equal(appFinding.line, 1);
      assert.equal(appFinding.ruleId, 'js-legacy-measurements');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

void test('scanFiles: per-file exception boundary', () => {
  // If a file handler encounters an unexpected exception on one malformed file,
  // the try/catch boundary ensures remaining files are still scanned without aborting.
  const files = new Map([
    ['src/app.js', 'const x = 1;'],
    ['src/styles.css', '.box { display: block; }'],
  ]);
  const findings = scanFiles(files, []);
  assert.deepEqual(findings, []);
});

void test('ast-helpers: feature-guard AST blind spots and identifier resolution', async (t) => {
  await t.test('resolves cached boolean feature variables in early returns and if statements', () => {
    const code = `
      const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');
      function resizeInput(el) {
        if (supportsFieldSizing) return;
        legacyFallback();
      }

      const hasSetHTML = "setHTML" in Element.prototype;
      function renderOutput(raw) {
        if (!hasSetHTML) {
          fallbackSanitize();
        } else {
          modernSanitize();
        }
      }

      function renderOutputElse(raw) {
        if (hasSetHTML) {
          modernSanitize();
        } else {
          fallbackSanitizeElse();
        }
      }
    `;

    withVirtualSourceFile('guards.ts', code, (sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const findCall = (name: string) => {
        const found = calls.find((c) => c.getExpression().getText() === name);
        assert.ok(found, `call ${name} must exist`);
        return found;
      };

      // Early return via cached supportsFieldSizing protects fallback
      assert.equal(isProtectedByFeatureGuard(findCall('legacyFallback'), ['field-sizing']), true);

      // Negative if (!hasSetHTML) then branch protects fallbackSanitize
      assert.equal(isProtectedByFeatureGuard(findCall('fallbackSanitize'), ['sethtml']), true);
      assert.equal(isProtectedByFeatureGuard(findCall('modernSanitize'), ['sethtml']), false);

      // Positive if (hasSetHTML) else branch protects fallbackSanitizeElse
      assert.equal(isProtectedByFeatureGuard(findCall('fallbackSanitizeElse'), ['sethtml']), true);
    });
  });

  await t.test('handles self-referential / circular variable declarations without infinite loops', () => {
    const code = `
      let a = b;
      let b = a;
      function testCircle() {
        if (a) return;
        unprotectedFallback();
      }

      let selfRef = selfRef;
      function testSelfRef() {
        if (!selfRef) {
          unprotectedSelfRef();
        }
      }
    `;

    withVirtualSourceFile('cycle.ts', code, (sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const findCall = (name: string) => {
        const found = calls.find((c) => c.getExpression().getText() === name);
        assert.ok(found, `call ${name} must exist`);
        return found;
      };

      // Circular and self-referential variables must not loop and must not falsely guard
      assert.equal(isProtectedByFeatureGuard(findCall('unprotectedFallback'), ['someToken']), false);
      assert.equal(isProtectedByFeatureGuard(findCall('unprotectedSelfRef'), ['someToken']), false);
    });
  });

  await t.test('recognizes Object.hasOwn and hasOwnProperty.call feature guards', () => {
    const code = `
      function testHasOwn() {
        if (!Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
          fallbackHasOwn();
        }
      }

      function testProtoHasOwnProperty() {
        if (!Object.prototype.hasOwnProperty.call(HTMLButtonElement.prototype, 'commandForElement')) {
          fallbackProtoHasOwnProperty();
        }
      }

      function testBareHasOwnProperty() {
        if (hasOwnProperty.call(HTMLButtonElement.prototype, 'commandForElement')) return;
        fallbackBareHasOwnProperty();
      }

      function testDictionaryCheck(dialogOptions: any) {
        if (!Object.hasOwn(dialogOptions, 'modal')) {
          dictionaryFallback();
        }
        if (!dialogOptions.hasOwnProperty('modal')) {
          dictionaryFallback2();
        }
        if (!('modal' in dialogOptions)) {
          dictionaryFallback3();
        }
      }
    `;

    withVirtualSourceFile('hasown.ts', code, (sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const findCall = (name: string) => {
        const found = calls.find((c) => c.getExpression().getText() === name);
        assert.ok(found, `call ${name} must exist`);
        return found;
      };

      assert.equal(isProtectedByFeatureGuard(findCall('fallbackHasOwn'), ['commandforelement']), true);
      assert.equal(isProtectedByFeatureGuard(findCall('fallbackProtoHasOwnProperty'), ['commandforelement']), true);
      assert.equal(isProtectedByFeatureGuard(findCall('fallbackBareHasOwnProperty'), ['commandforelement']), true);
      // Non-browser feature target dictionary checks must NOT be mistaken for feature guards
      // even if the dictionary variable name contains a feature token like 'dialog'
      assert.equal(isProtectedByFeatureGuard(findCall('dictionaryFallback'), ['dialog']), false);
      assert.equal(isProtectedByFeatureGuard(findCall('dictionaryFallback2'), ['dialog']), false);
      assert.equal(isProtectedByFeatureGuard(findCall('dictionaryFallback3'), ['dialog']), false);
    });
  });

  await t.test('matches feature guard tokens case-insensitively', () => {
    const code = `
      function testCaseInsensitive() {
        if (!('interestForElement' in HTMLButtonElement.prototype)) {
          fallbackTooltip();
        }
      }
    `;

    withVirtualSourceFile('case.ts', code, (sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const findCall = (name: string) => {
        const found = calls.find((c) => c.getExpression().getText() === name);
        assert.ok(found, `call ${name} must exist`);
        return found;
      };

      // Token 'interestfor' matches 'interestForElement' case-insensitively
      assert.equal(isProtectedByFeatureGuard(findCall('fallbackTooltip'), ['interestfor']), true);
    });
  });
});

void test('sfc-extractor: prepareHtmlForDomScan unwraps all Vue template tags preserving offsets', async (t) => {
  await t.test('blanks nested template v-if and template v-for tags so ancestor selectors match', () => {
    const vue = `<template>
  <form id="checkout">
    <template v-if="showBilling">
      <div class="field">
        <template v-for="item in items">
          <input type="text" name="street_address" />
        </template>
      </div>
    </template>
  </form>
</template>`;

    const prepared = prepareHtmlForDomScan('Test.vue', vue);
    assert.equal(prepared.length, vue.length);
    assert.equal(prepared.split('\n').length, vue.split('\n').length);
    // All <template> and </template> occurrences should be replaced with spaces
    assert.equal(/<\/?template\b/i.test(prepared), false);
    assert.equal(prepared.includes('<input type="text" name="street_address" />'), true);
  });

  await t.test('handles > inside quoted attributes in template tags and preserves matching in linkedom', () => {
    const vue = `<template>
  <form id="orderForm">
    <template v-if="items.length > 0">
      <input type="password" name="password" id="pwd" />
    </template>
  </form>
</template>`;

    const rule: AnalyzerRule = {
      id: 'test/form-pwd',
      guideId: 'autofill-sign-in-form',
      guideHash: '000000000000',
      summary: 'test',
      matcher: {
        kind: 'dom',
        selector: 'form input[type="password"]',
        fastTokens: ['password'],
        matchElement: () => ({ message: 'missing autocomplete' }),
      },
      verifierRubric: { keepWhen: ['a'], dropWhen: ['b'] },
    };

    const findings = scanFiles(new Map([['src/Order.vue', vue]]), [rule]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.line, 4);
  });
});

void test('scanFiles & scanRepoFiles: lazy SourceFile proxy, Project rotation, and batched I/O', async (t) => {
  await t.test('lazySourceFile skips AST creation on early ctx.fileContent exit and forwards has/getPrototypeOf when used', () => {
    const project = createInMemoryProject();
    let createSourceFileCalls = 0;
    const origCreate = project.createSourceFile.bind(project);
    project.createSourceFile = ((...args: Parameters<typeof origCreate>) => {
      createSourceFileCalls++;
      return origCreate(...args);
    }) as typeof project.createSourceFile;

    let sawHasOperator = false;
    let sawPrototype = false;

    const rule: AnalyzerRule = {
      id: 'test/lazy-sf',
      guideId: 'dialog',
      guideHash: '000000000000',
      summary: 'test lazy SourceFile',
      verifierRubric: { keepWhen: ['a'], dropWhen: ['b'] },
      matcher: {
        kind: 'js',
        fastTokens: ['legacyWidget'],
        matchFile: (sf, ctx) => {
          if (ctx.fileContent.includes('modernGuard')) {
            return [];
          }
          sawHasOperator = 'getDescendantsOfKind' in sf;
          sawPrototype = Object.getPrototypeOf(sf) !== Object.prototype;
          return sf
            .getDescendantsOfKind(SyntaxKind.CallExpression)
            .map((c) => ({ line: c.getStartLineNumber(), message: 'hit' }));
        },
      },
    };

    const guardedFindings = scanFiles(
      new Map([['src/guarded.ts', 'const modernGuard = true; legacyWidget();']]),
      [rule],
      { project },
    );
    assert.equal(guardedFindings.length, 0);
    assert.equal(createSourceFileCalls, 0, 'must not parse AST when rule exits early on ctx.fileContent');

    const activeFindings = scanFiles(
      new Map([['src/active.ts', 'legacyWidget();']]),
      [rule],
      { project },
    );
    assert.equal(activeFindings.length, 1);
    assert.equal(createSourceFileCalls, 1);
    assert.equal(sawHasOperator, true);
    assert.equal(sawPrototype, true);
  });

  await t.test('scanFiles rotates ephemeral Project across >25 AST-parsed files and scanRepoFiles preserves order, maxFiles, and skippedDocsAndTestsCount across >64 files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'batched-io-repo-'));
    try {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await mkdir(join(tempDir, 'test'), { recursive: true });

      for (let i = 0; i < 80; i++) {
        const padded = String(i).padStart(3, '0');
        await writeFile(
          join(tempDir, 'src', `file-${padded}.ts`),
          `export const idx = ${i};\nlegacyTarget(${i});\n`,
        );
      }
      for (let j = 0; j < 10; j++) {
        await writeFile(
          join(tempDir, 'src', `a-spec-${j}.test.ts`),
          `legacyTarget(${j});\n`,
        );
      }

      const seenProjects = new Set<unknown>();
      const rule: AnalyzerRule = {
        id: 'test/batched-scan',
        guideId: 'dialog',
        guideHash: '000000000000',
        summary: 'test batched scan',
        verifierRubric: { keepWhen: ['a'], dropWhen: ['b'] },
        matcher: {
          kind: 'js',
          fastTokens: ['legacyTarget'],
          matchFile: (sf) => {
            seenProjects.add(sf.getProject());
            return sf
              .getDescendantsOfKind(SyntaxKind.CallExpression)
              .map((c) => ({ line: c.getStartLineNumber(), message: c.getText() }));
          },
        },
      };

      const stats: { skippedDocsAndTestsCount?: number } = {};
      const findings = await scanRepoFiles(tempDir, [rule], {
        maxFiles: 70,
        stats,
      });

      assert.equal(findings.length, 70, 'must cap scanned files at maxFiles=70 across 64-file batches');
      assert.equal(seenProjects.size, 3, 'must rotate ephemeral Project every 25 AST-parsed files (25 + 25 + 20 = 3 Projects)');
      assert.equal(stats.skippedDocsAndTestsCount, 10, 'must count all 10 skipped test files before hitting maxFiles');
      const expectedFiles = Array.from({ length: 70 }, (_, i) => `src/file-${String(i).padStart(3, '0')}.ts`);
      assert.deepEqual(
        findings.map((f) => f.file),
        expectedFiles,
        'must preserve exact lexicographical file ordering across concurrent I/O batches and >25 file Project rotations',
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});



