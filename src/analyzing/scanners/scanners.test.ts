import assert from 'node:assert/strict';
import test from 'node:test';
import { Project } from 'ts-morph';
import type {
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';
import {
  getSafeModuleSpecifier,
  isProtectedByFeatureGuard,
  isUnshadowedGlobal,
  resolveLocalExpression,
  unwrapExpression,
} from './ast-helpers.ts';
import {
  extractCompactSnippet,
  formatNumberedLines,
  sliceJsAstContext,
  sliceStructuredBlock,
  sliceStructuredContext,
} from './context-slicer.ts';
import { scanCss } from './css-scanner.ts';
import { scanPackageJson } from './dependency-scanner.ts';
import { scanHtml, scanJsx, tokenizeHtmlTags } from './dom-scanner.ts';
import {
  hasVendoredLicenseHeader,
  isMinifiedContent,
  isVendoredOrGeneratedPath,
  shouldScanFile,
} from './file-filter.ts';
import {
  computeGuideHash,
  createInMemoryProject,
  scanFiles,
  scanJsSource,
} from './index.ts';

void test('file-filter: path and content classification', async (t) => {
  await t.test('filters build, vendor, and generated paths', () => {
    assert.equal(isVendoredOrGeneratedPath('node_modules/foo/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('dist/bundle.js'), true);
    assert.equal(isVendoredOrGeneratedPath('vendor/assets/app.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/utils/math.min.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/types/index.d.ts'), true);
    assert.equal(isVendoredOrGeneratedPath('src/components/Dialog.tsx'), false);
    assert.equal(isVendoredOrGeneratedPath('views/login.blade.php'), false);
  });

  await t.test('detects minified content', () => {
    const normalCode = 'const a = 1;\nconst b = 2;\n';
    const minifiedLine = `const x = "${'a'.repeat(6000)}";`;
    assert.equal(isMinifiedContent(normalCode), false);
    assert.equal(isMinifiedContent(minifiedLine), true);
  });

  await t.test('detects third-party license headers with semver', () => {
    const thirdPartyHeader = `/*!
 * jQuery JavaScript Library v3.6.0
 * https://jquery.com/
 * Includes Sizzle.js
 * Copyright OpenJS Foundation and other contributors
 * Released under the MIT license
 */
(function() { return 1; })();`;

    assert.equal(hasVendoredLicenseHeader(thirdPartyHeader), true);

    // Protected first-party code
    assert.equal(
      hasVendoredLicenseHeader(thirdPartyHeader, { ownNames: ['jquery'] }),
      false,
    );

    const firstPartyHeader = `// Copyright 2026 The Authors. All rights reserved.\nconst x = 10;\n`;
    assert.equal(hasVendoredLicenseHeader(firstPartyHeader), false);
  });

  await t.test('shouldScanFile integrates path and content guards', () => {
    assert.equal(shouldScanFile('node_modules/pkg/index.js'), false);
    assert.equal(shouldScanFile('src/app.js', 'console.log("hello");'), true);
  });
});

void test('ast-helpers: AST combinators and branch-aware feature guards', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('unwrapExpression strips parentheses and type assertions', () => {
    const source = project.createSourceFile(
      'unwrap.ts',
      'const x = (((foo as string) satisfies string));',
      { overwrite: true },
    );
    const varDecl = source.getVariableDeclarations()[0];
    assert.ok(varDecl);
    const init = varDecl.getInitializer();
    assert.ok(init);
    const unwrapped = unwrapExpression(init);
    assert.equal(unwrapped.getText(), 'foo');
  });

  await t.test('resolveLocalExpression traces 1-hop local variables', () => {
    const source = project.createSourceFile(
      'resolve.ts',
      `
      function test() {
        const dialog = document.getElementById('my-dialog');
        const ref = dialog;
        ref.showModal();
      }
      `,
      { overwrite: true },
    );

    // Find identifier 'ref' at call site
    const identifiers = source
      .getDescendants()
      .filter((n) => n.getText() === 'ref');
    const callTarget = identifiers[identifiers.length - 1];
    assert.ok(callTarget);

    const resolved = resolveLocalExpression(callTarget, 2);
    assert.equal(resolved.getText(), "document.getElementById('my-dialog')");
  });

  await t.test('isUnshadowedGlobal detects shadowed vs unshadowed globals', () => {
    const source = project.createSourceFile(
      'globals.ts',
      `
      function clean() {
        const d = Temporal.Now.instant();
      }
      function shadowedByParam(Temporal: unknown) {
        return Temporal;
      }
      function shadowedByVar() {
        const Temporal = 'local';
        return Temporal;
      }
      `,
      { overwrite: true },
    );

    const cleanFn = source.getFunction('clean');
    assert.ok(cleanFn);
    const cleanTemporal = cleanFn
      .getDescendants()
      .find((n) => n.getText() === 'Temporal');
    assert.ok(cleanTemporal);
    assert.equal(isUnshadowedGlobal(cleanTemporal, 'Temporal'), true);

    const paramFn = source.getFunction('shadowedByParam');
    assert.ok(paramFn);
    const paramTemporal = paramFn
      .getDescendants()
      .find((n) => n.getText() === 'Temporal');
    assert.ok(paramTemporal);
    assert.equal(isUnshadowedGlobal(paramTemporal, 'Temporal'), false);

    const varFn = source.getFunction('shadowedByVar');
    assert.ok(varFn);
    const varTemporal = varFn
      .getDescendants()
      .find((n) => n.getText() === 'Temporal');
    assert.ok(varTemporal);
    assert.equal(isUnshadowedGlobal(varTemporal, 'Temporal'), false);
  });

  await t.test('isProtectedByFeatureGuard: branch-aware positive and negative if', () => {
    const source = project.createSourceFile(
      'guards.ts',
      `
      function branchAware(el: any) {
        if ('showModal' in el) {
          el.showModal();
        } else {
          fallbackOpen(el);
        }

        if (!('showModal' in el)) {
          negativeFallback(el);
        } else {
          negativeModern(el);
        }
      }
      `,
      { overwrite: true },
    );

    const fallbackCall = source
      .getDescendants()
      .find((n) => n.getText().startsWith('fallbackOpen'));
    assert.ok(fallbackCall);
    assert.equal(
      isProtectedByFeatureGuard(fallbackCall, ['showModal']),
      true,
      'else branch of positive check is protected',
    );

    const modernCall = source
      .getDescendants()
      .find((n) => n.getText() === 'el.showModal()');
    assert.ok(modernCall);
    assert.equal(
      isProtectedByFeatureGuard(modernCall, ['showModal']),
      false,
      'then branch of positive check is not fallback',
    );

    const negFallback = source
      .getDescendants()
      .find((n) => n.getText().startsWith('negativeFallback'));
    assert.ok(negFallback);
    assert.equal(
      isProtectedByFeatureGuard(negFallback, ['showModal']),
      true,
      'then branch of negative check is protected',
    );

    const negModern = source
      .getDescendants()
      .find((n) => n.getText().startsWith('negativeModern'));
    assert.ok(negModern);
    assert.equal(
      isProtectedByFeatureGuard(negModern, ['showModal']),
      false,
      'else branch of negative check is modern path',
    );
  });

  await t.test('isProtectedByFeatureGuard: ternary, logical fallback, and early return', () => {
    const source = project.createSourceFile(
      'guards2.ts',
      `
      function ternaryCase(el: any) {
        return ('showModal' in el) ? el.showModal() : legacyTernary(el);
      }
      function logicalFallback() {
        return window.Temporal || legacyTimezone();
      }
      function earlyReturn(el: any) {
        if ('showModal' in el) {
          el.showModal();
          return;
        }
        legacyEarlyReturn(el);
      }
      `,
      { overwrite: true },
    );

    const ternaryFallback = source
      .getDescendants()
      .find((n) => n.getText().startsWith('legacyTernary'));
    assert.ok(ternaryFallback);
    assert.equal(
      isProtectedByFeatureGuard(ternaryFallback, ['showModal']),
      true,
      'ternary false branch is protected',
    );

    const logicalRight = source
      .getDescendants()
      .find((n) => n.getText().startsWith('legacyTimezone'));
    assert.ok(logicalRight);
    assert.equal(
      isProtectedByFeatureGuard(logicalRight, ['Temporal']),
      true,
      'logical OR fallback RHS is protected',
    );

    const earlyCall = source
      .getDescendants()
      .find((n) => n.getText().startsWith('legacyEarlyReturn'));
    assert.ok(earlyCall);
    assert.equal(
      isProtectedByFeatureGuard(earlyCall, ['showModal']),
      true,
      'statement after positive early return is protected',
    );
  });

  await t.test('getSafeModuleSpecifier handles template imports safely', () => {
    const normalSource = project.createSourceFile(
      'import1.ts',
      "import { foo } from './bar.ts';",
      { overwrite: true },
    );
    const imp1 = normalSource.getImportDeclarations()[0];
    assert.ok(imp1);
    assert.equal(getSafeModuleSpecifier(imp1), './bar.ts');
  });
});

void test('context-slicer: AST and structured context slicing', async (t) => {
  await t.test('formatNumberedLines formats with cursor marker', () => {
    const lines = ['const a = 1;', 'const b = 2;', 'const c = 3;'];
    const formatted = formatNumberedLines(lines, 10, 11);
    assert.match(formatted, /10 \| const a = 1;/);
    assert.match(formatted, />   11 \| const b = 2;/);
    assert.match(formatted, /12 \| const c = 3;/);
  });

  await t.test('sliceJsAstContext includes imports and enclosing scope', () => {
    const project = createInMemoryProject();
    const code = `import { helper } from './helper.ts';\n\nfunction calculate() {\n  const x = 10;\n  return x * 2;\n}\n`;
    const sourceFile = project.createSourceFile('calc.ts', code);

    const slice = sliceJsAstContext(sourceFile, 4);
    assert.match(slice, /\/\/ --- Imports ---/);
    assert.match(slice, /helper\.ts/);
    assert.match(slice, /\/\/ --- Scope ---/);
    assert.match(slice, />    4 \|   const x = 10;/);
  });

  await t.test('sliceJsAstContext folds functions exceeding 120 lines', () => {
    const project = createInMemoryProject();
    const bodyLines = Array.from({ length: 150 }, (_, i) => `  line_${i + 1}();`);
    const code = `function hugeFunction() {\n${bodyLines.join('\n')}\n}\n`;
    const sourceFile = project.createSourceFile('huge.ts', code);

    const slice = sliceJsAstContext(sourceFile, 75);
    assert.match(slice, /lines folded in enclosing scope/);
    assert.match(slice, />\s+75 \|   line_74\(\);/);
  });

  await t.test('sliceStructuredBlock and extractCompactSnippet slice accurately', () => {
    const html = '<form>\n  <input type="password">\n  <button>Submit</button>\n</form>\n';
    const snippet = extractCompactSnippet(html, 2);
    assert.match(snippet, />    2 \|   <input type="password">/);

    const block = sliceStructuredBlock(html, 3);
    assert.match(block, />    3 \|   <button>Submit<\/button>/);

    const context = sliceStructuredContext('test.html', html, 2);
    assert.ok(context.codeSnippet);
    assert.ok(context.astSlice);
  });
});

void test('js-scanner: scanJsSource with fastTokens and AST matching', () => {
  const code = `
  function openDialog(dialog: HTMLDialogElement) {
    dialog.showModal();
  }
  `;

  const rule: JsRuleMatcher = {
    kind: 'js',
    fastTokens: ['showModal'],
    matchFile: (sourceFile) => {
      const matches = [];
      const calls = sourceFile
        .getDescendants()
        .filter((n) => n.getText() === 'dialog.showModal()');
      for (const call of calls) {
        const { line, column } = sourceFile.getLineAndColumnAtPos(call.getStart());
        matches.push({ line, column, message: 'imperative showModal call' });
      }
      return matches;
    },
  };

  const { matches } = scanJsSource('app.ts', code, [rule]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.line, 3);
  assert.equal(matches[0]?.message, 'imperative showModal call');

  // Verify fastTokens skip when token is absent
  const skipped = scanJsSource('app.ts', 'const x = 1;', [rule]);
  assert.equal(skipped.matches.length, 0);
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
});

void test('dependency-scanner: package.json dependency detection', () => {
  const pkgJson = JSON.stringify(
    {
      name: 'my-app',
      dependencies: {
        'moment-timezone': '^0.5.40',
        react: '^19.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    },
    null,
    2,
  );

  const rule: DependencyRuleMatcher = {
    kind: 'dependency',
    packages: ['moment-timezone', 'date-fns-tz'],
  };

  const matches = scanPackageJson('package.json', pkgJson, [rule]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.line, 4);
  assert.match(matches[0]?.message ?? '', /moment-timezone/);
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
    phase2Rubric: {
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
  assert.ok(finding.astSlice);
});
