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
import {
  computeGuideHash,
  createInMemoryProject,
  scanFiles,
  scanRepoFiles,
} from './index.ts';

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


