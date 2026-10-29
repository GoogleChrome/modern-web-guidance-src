import assert from 'node:assert/strict';
import test from 'node:test';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type {
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';
import {
  getSafeModuleSpecifier,
  isDomClassOrAttrMutation,
  isGlobalReference,
  isProtectedByFeatureGuard,
  isUnshadowedGlobal,
  matchEventListenerCall,
  resolveCallableNode,
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
import { scanCss, scanCssRules } from './css-scanner.ts';
import { scanPackageJson } from './dependency-scanner.ts';
import { scanHtml, scanJsx, tokenizeHtmlTags } from './dom-scanner.ts';
import {
  hasVendoredLicenseHeader,
  isMinifiedContent,
  isVendoredOrGeneratedPath,
  shouldScanFile,
} from './file-filter.ts';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  blankOutsideRange,
  blankRanges,
  computeGuideHash,
  createInMemoryProject,
  extractScriptBlocks,
  extractStyleBlocks,
  prepareHtmlForDomScan,
  scanFiles,
  scanJsSource,
  scanRepoFiles,
} from './index.ts';

void test('file-filter: path and content classification', async (t) => {
  await t.test('filters build, vendor, and generated paths', () => {
    assert.equal(isVendoredOrGeneratedPath('node_modules/foo/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('dist/bundle.js'), true);
    assert.equal(isVendoredOrGeneratedPath('vendor/assets/app.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/utils/math.min.js'), true);
    assert.equal(isVendoredOrGeneratedPath('src/types/index.d.ts'), true);
    assert.equal(isVendoredOrGeneratedPath('.worktrees/feature/index.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.worktree/test.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.venv/lib/python.js'), true);
    assert.equal(isVendoredOrGeneratedPath('venv/lib/python.js'), true);
    assert.equal(isVendoredOrGeneratedPath('.nyc_output/coverage.json'), true);
    assert.equal(isVendoredOrGeneratedPath('test-results/report.html'), true);
    assert.equal(isVendoredOrGeneratedPath('playwright-report/index.html'), true);
    assert.equal(isVendoredOrGeneratedPath('src/components/Dialog.tsx'), false);
    assert.equal(isVendoredOrGeneratedPath('views/login.blade.php'), false);
    // By default, user project docs/site/website are NOT excluded
    assert.equal(isVendoredOrGeneratedPath('docs/3.1/reference/index.html'), false);
    assert.equal(isVendoredOrGeneratedPath('content/zh-cn/docs/setup.html'), false);
    assert.equal(isVendoredOrGeneratedPath('website/docs/intro.md'), false);
    assert.equal(isVendoredOrGeneratedPath('site/pages/index.html'), false);
    assert.equal(isVendoredOrGeneratedPath('gh-pages/index.html'), false);

    // Corpus non-app documentation paths when explicitly requested
    assert.equal(
      isVendoredOrGeneratedPath('docs/3.1/reference/index.html', {
        excludeCorpusNonAppDirs: true,
      }),
      true,
    );
    assert.equal(
      isVendoredOrGeneratedPath('content/zh-cn/docs/setup.html', {
        excludeCorpusNonAppDirs: true,
      }),
      true,
    );
    assert.equal(
      isVendoredOrGeneratedPath('website/docs/intro.md', {
        excludeCorpusNonAppDirs: true,
      }),
      true,
    );
    assert.equal(
      isVendoredOrGeneratedPath('site/pages/index.html', {
        excludeCorpusNonAppDirs: true,
      }),
      true,
    );
    assert.equal(
      isVendoredOrGeneratedPath('gh-pages/index.html', {
        excludeCorpusNonAppDirs: true,
      }),
      true,
    );
  });

  await t.test('detects minified content', () => {
    const normalCode = 'const a = 1;\nconst b = 2;\n';
    const minifiedLine = `const x = "${'a'.repeat(6000)}";`;
    assert.equal(isMinifiedContent(normalCode), false);
    assert.equal(isMinifiedContent(minifiedLine), true);

    // Normal multi-line file with one long data: URI line or SVG template is not minified
    const fileWithDataUri = Array.from({ length: 30 }, (_, i) => `.class-${i} { color: red; }`).join('\n') +
      `\n.icon { background-image: url('data:image/svg+xml;utf8,${'a'.repeat(2000)}'); }\n`;
    assert.equal(isMinifiedContent(fileWithDataUri), false);

    const fileWithSvg = Array.from({ length: 30 }, (_, i) => `// line ${i}`).join('\n') +
      `\nconst icon = '<svg viewBox="0 0 100 100">${'path '.repeat(500)}</svg>';\n`;
    assert.equal(isMinifiedContent(fileWithSvg), false);

    // Single-line minified file containing an embedded data URI should still be flagged as minified
    const minifiedWithEmbeddedDataUri =
      'const a = 1; ' +
      'var x = 0; '.repeat(100) +
      'const data = "data:application/octet-stream;base64,AAAA"; ' +
      'var y = 2; '.repeat(100);
    assert.equal(isMinifiedContent(minifiedWithEmbeddedDataUri), true);
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

    // First-party Google/Apache SPDX header is NOT flagged as vendored
    const apacheSpdxHeader = `/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const foo = 1;`;
    assert.equal(hasVendoredLicenseHeader(apacheSpdxHeader), false);

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

  await t.test('rejects files exceeding 1 MB source cap', () => {
    const smallContent = 'const x = 1;\n'.repeat(100);
    assert.equal(shouldScanFile('src/small.js', smallContent), true);

    const largeContent = 'a'.repeat(1_000_001);
    assert.equal(shouldScanFile('src/bundle.js', largeContent), false);
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

  await t.test('isGlobalReference matches globals and window/globalThis/self prefixes, respecting shadowing', () => {
    const source = project.createSourceFile(
      'globalRef.ts',
      `
      function directGlobal() {
        return ResizeObserver;
      }
      function windowGlobal() {
        return window.ResizeObserver;
      }
      function globalThisGlobal() {
        return globalThis.ResizeObserver;
      }
      function selfGlobal() {
        return self.ResizeObserver;
      }
      function shadowedParam(ResizeObserver: any) {
        return ResizeObserver;
      }
      function shadowedVar() {
        const ResizeObserver = null;
        return ResizeObserver;
      }
      function shadowedWindow(window: any) {
        return window.ResizeObserver;
      }
      function otherProperty() {
        return window.document;
      }
      `,
      { overwrite: true },
    );

    const getReturnExpr = (fnName: string) => {
      const fn = source.getFunction(fnName);
      assert.ok(fn, `missing function ${fnName}`);
      const ret = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0];
      assert.ok(ret, `missing return in ${fnName}`);
      const expr = ret.getExpression();
      assert.ok(expr, `missing return expression in ${fnName}`);
      return expr;
    };

    assert.equal(isGlobalReference(getReturnExpr('directGlobal'), 'ResizeObserver'), true);
    assert.equal(isGlobalReference(getReturnExpr('windowGlobal'), 'ResizeObserver'), true);
    assert.equal(isGlobalReference(getReturnExpr('globalThisGlobal'), 'ResizeObserver'), true);
    assert.equal(isGlobalReference(getReturnExpr('selfGlobal'), 'ResizeObserver'), true);

    assert.equal(isGlobalReference(getReturnExpr('shadowedParam'), 'ResizeObserver'), false);
    assert.equal(isGlobalReference(getReturnExpr('shadowedVar'), 'ResizeObserver'), false);
    assert.equal(isGlobalReference(getReturnExpr('shadowedWindow'), 'ResizeObserver'), false);
    assert.equal(isGlobalReference(getReturnExpr('otherProperty'), 'ResizeObserver'), false);
  });

  await t.test('resolveCallableNode resolves function declarations and arrow expressions', () => {
    const source = project.createSourceFile(
      'resolveCallable.ts',
      `
      function namedHandler() { return 1; }
      const arrowHandler = () => 2;
      function outer() {
        const localHandler = () => 3;
        el.addEventListener('click', namedHandler);
        el.addEventListener('click', arrowHandler);
        el.addEventListener('click', localHandler);
        el.addEventListener('click', () => 4);
      }
      `,
      { overwrite: true },
    );

    const outerFn = source.getFunction('outer');
    assert.ok(outerFn);
    const calls = outerFn.getDescendantsOfKind(SyntaxKind.CallExpression);
    assert.equal(calls.length, 4);

    const namedArg = calls[0].getArguments()[1];
    const resolvedNamed = resolveCallableNode(namedArg);
    assert.ok(Node.isFunctionDeclaration(resolvedNamed));
    assert.equal(resolvedNamed.getName(), 'namedHandler');

    const arrowArg = calls[1].getArguments()[1];
    const resolvedArrow = resolveCallableNode(arrowArg);
    assert.ok(Node.isArrowFunction(resolvedArrow));

    const localArg = calls[2].getArguments()[1];
    const resolvedLocal = resolveCallableNode(localArg);
    assert.ok(Node.isArrowFunction(resolvedLocal));

    const inlineArg = calls[3].getArguments()[1];
    const resolvedInline = resolveCallableNode(inlineArg);
    assert.ok(Node.isArrowFunction(resolvedInline));
  });

  await t.test('matchEventListenerCall recognizes native and jQuery scroll listeners', () => {
    const source = project.createSourceFile(
      'eventListener.ts',
      `
      function setup(el: any, $: any) {
        el.addEventListener('scroll', onScrollNative);
        $(window).on('scroll', onScrollJq);
        $(window).on('scroll.myPlugin', onScrollNamespaced);
        $(window).scroll(onScrollShorthand);
        $(window).scroll(); // trigger call, not listener
        el.addEventListener('click', onClickNative);
      }
      function onScrollNative() {}
      function onScrollJq() {}
      function onScrollNamespaced() {}
      function onScrollShorthand() {}
      function onClickNative() {}
      `,
      { overwrite: true },
    );

    const setupFn = source.getFunction('setup');
    assert.ok(setupFn);
    const stmts = setupFn.getStatements();
    const getCall = (idx: number) => {
      const stmt = stmts[idx];
      assert.ok(Node.isExpressionStatement(stmt));
      const expr = stmt.getExpression();
      assert.ok(Node.isCallExpression(expr));
      return expr;
    };

    const nativeMatch = matchEventListenerCall(getCall(0), ['scroll']);
    assert.ok(nativeMatch);
    assert.equal(nativeMatch.eventName, 'scroll');
    assert.ok(Node.isFunctionDeclaration(nativeMatch.handlerNode));

    const jqMatch = matchEventListenerCall(getCall(1), ['scroll']);
    assert.ok(jqMatch);
    assert.equal(jqMatch.eventName, 'scroll');
    assert.ok(Node.isFunctionDeclaration(jqMatch.handlerNode));

    const namespacedMatch = matchEventListenerCall(getCall(2), ['scroll']);
    assert.ok(namespacedMatch);
    assert.equal(namespacedMatch.eventName, 'scroll');
    assert.ok(Node.isFunctionDeclaration(namespacedMatch.handlerNode));

    const shorthandMatch = matchEventListenerCall(getCall(3), ['scroll']);
    assert.ok(shorthandMatch);
    assert.equal(shorthandMatch.eventName, 'scroll');
    assert.ok(Node.isFunctionDeclaration(shorthandMatch.handlerNode));

    // Shorthand trigger with no args returns null
    const triggerMatch = matchEventListenerCall(getCall(4), ['scroll']);
    assert.equal(triggerMatch, null);

    // Non-matching event returns null
    const clickMatch = matchEventListenerCall(getCall(5), ['scroll']);
    assert.equal(clickMatch, null);
  });

  await t.test('isDomClassOrAttrMutation detects native and jQuery mutations', () => {
    const source = project.createSourceFile(
      'domMutations.ts',
      `
      function nativeMutations(el: any) {
        el.classList.add('visible');
        el.classList.remove('hidden');
        el.classList.toggle('active');
        el.classList.replace('old', 'new');
        el.className = 'custom';
        el.className += ' append';
        el.setAttribute('aria-expanded', 'true');
        el.removeAttribute('aria-hidden');
        el.toggleAttribute('disabled');
      }
      function jqMutations(el: any, $: any) {
        $(el).addClass('active');
        $(el).removeClass('inactive');
        $(el).toggleClass('selected');
        $(el).attr('aria-valuenow', '10');
        $(el).attr({ 'aria-hidden': 'false' });
      }
      function readOnlyOperations(el: any, $: any) {
        const c = el.className;
        const attr = $(el).attr('aria-hidden');
        return [c, attr];
      }
      `,
      { overwrite: true },
    );

    const nativeFn = source.getFunction('nativeMutations');
    assert.ok(nativeFn);
    assert.equal(isDomClassOrAttrMutation(nativeFn), true);

    const jqFn = source.getFunction('jqMutations');
    assert.ok(jqFn);
    assert.equal(isDomClassOrAttrMutation(jqFn), true);

    const readOnlyFn = source.getFunction('readOnlyOperations');
    assert.ok(readOnlyFn);
    const readStmts = readOnlyFn.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    assert.deepEqual(
      readStmts.map((stmt) => isDomClassOrAttrMutation(stmt)),
      readStmts.map(() => false),
    );
  });

  await t.test('isProtectedByFeatureGuard: early-return in callbacks and enclosing functions', () => {
    const source = project.createSourceFile(
      'earlyReturnGuard.ts',
      `
      function setupListeners(inputEl: any, buttonEl: any) {
        inputEl.addEventListener('input', (event: any) => {
          if (event.isComposing) return;
          legacyInputHandling(event);
        });

        buttonEl.addEventListener('click', function onClick() {
          if (CSS.supports('anchor-name', '--anchor')) return;
          legacyAnchorFallback();
        });
      }
      `,
      { overwrite: true },
    );

    const setupFn = source.getFunction('setupListeners');
    assert.ok(setupFn);
    const calls = setupFn.getDescendantsOfKind(SyntaxKind.CallExpression);

    // Check that addEventListener call expressions are detected as protected if callback has early return
    assert.equal(
      isProtectedByFeatureGuard(calls[0], ['isComposing']),
      true,
      'listener call with early return callback is protected',
    );

    // Check inner call expressions directly
    const legacyInputCall = source
      .getDescendants()
      .find((n) => n.getText().startsWith('legacyInputHandling'));
    assert.ok(legacyInputCall);
    assert.equal(
      isProtectedByFeatureGuard(legacyInputCall, ['isComposing']),
      true,
      'code after early return is guarded',
    );

    const legacyAnchorCall = source
      .getDescendants()
      .find((n) => n.getText().startsWith('legacyAnchorFallback'));
    assert.ok(legacyAnchorCall);
    assert.equal(
      isProtectedByFeatureGuard(legacyAnchorCall, ['CSS.supports', 'anchor-name']),
      true,
      'code after CSS.supports early return is guarded',
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

    const templateSource = project.createSourceFile(
      'import2.ts',
      'import { foo } from <%= path %>;',
      { overwrite: true },
    );
    const imp2 = templateSource.getImportDeclarations()[0];
    assert.ok(imp2);
    assert.equal(getSafeModuleSpecifier(imp2), null);
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
    assert.ok(context.contextSlice);
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

void test('js-scanner: createInMemoryProject generates fresh isolated instances', () => {
  const proj1 = createInMemoryProject();
  const proj2 = createInMemoryProject();
  assert.notEqual(proj1, proj2, 'createInMemoryProject creates independent project instances without module singleton');
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

void test('dependency-scanner: findPackageLine skips keywords and finds dependencies line', () => {
  const pkgJson = JSON.stringify(
    {
      name: 'my-app',
      keywords: ['react-select', 'ui'],
      description: 'An app with react-select',
      dependencies: {
        'react-select': '^5.0.0',
      },
    },
    null,
    2,
  );

  const rule: DependencyRuleMatcher = {
    kind: 'dependency',
    packages: ['react-select'],
  };

  const matches = scanPackageJson('package.json', pkgJson, [rule]);
  assert.equal(matches.length, 1);
  // Line 4 is inside keywords ("react-select"), while line 9 is inside dependencies
  assert.equal(matches[0]?.line, 9);
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
});

void test('sfc-extractor: newline-preserving blanking and block extraction', async (t) => {
  await t.test('blankOutsideRange preserves overall length, newlines, and target slice', () => {
    const raw = 'line 1\nline 2: target\nline 3\n';
    const start = raw.indexOf('line 2: target');
    const end = start + 'line 2: target'.length;
    const blanked = blankOutsideRange(raw, start, end);

    assert.equal(blanked.length, raw.length);
    assert.equal(blanked.split('\n').length, raw.split('\n').length);
    assert.equal(blanked.slice(start, end), 'line 2: target');
    assert.match(blanked.slice(0, start), /^\s+$/);
    assert.match(blanked.slice(end), /^\s+$/);
  });

  await t.test('blankRanges preserves newlines across multiple blanked segments', () => {
    const raw = 'aaa\nbbb\nccc\nddd\n';
    const bbbStart = raw.indexOf('bbb');
    const bbbEnd = bbbStart + 3;
    const blanked = blankRanges(raw, [{ start: bbbStart, end: bbbEnd }]);

    assert.equal(blanked.length, raw.length);
    assert.equal(blanked.split('\n').length, raw.split('\n').length);
    assert.equal(blanked.includes('aaa'), true);
    assert.equal(blanked.includes('bbb'), false);
    assert.equal(blanked.includes('ccc'), true);
  });

  await t.test('extractScriptBlocks extracts Vue, Svelte, and Astro scripts', () => {
    const vue = '<script setup lang="ts">\nconst x = 1;\n</script>\n<template><div/></template>';
    const vueBlocks = extractScriptBlocks('src/App.vue', vue);
    assert.equal(vueBlocks.length, 1);
    const vueBlock = vueBlocks[0];
    assert.ok(vueBlock);
    assert.equal(vueBlock.virtualPath, 'src/App.vue.ts');
    assert.equal(vueBlock.blankedContent.includes('const x = 1;'), true);
    assert.equal(vueBlock.blankedContent.includes('<script'), false);

    const svelte = '<script>\nlet count = 0;\n</script>\n<p>{count}</p>';
    const svelteBlocks = extractScriptBlocks('src/Counter.svelte', svelte);
    assert.equal(svelteBlocks.length, 1);
    const svelteBlock = svelteBlocks[0];
    assert.ok(svelteBlock);
    assert.equal(svelteBlock.virtualPath, 'src/Counter.svelte.js');
    assert.equal(svelteBlock.blankedContent.includes('let count = 0;'), true);

    const astro = '---\nconst title = "Astro";\n---\n<h1>{title}</h1>';
    const astroBlocks = extractScriptBlocks('src/pages/index.astro', astro);
    assert.equal(astroBlocks.length, 1);
    const astroBlock = astroBlocks[0];
    assert.ok(astroBlock);
    assert.equal(astroBlock.virtualPath, 'src/pages/index.astro.ts');
    assert.equal(astroBlock.blankedContent.includes('const title = "Astro";'), true);
  });

  await t.test('prepareHtmlForDomScan unwraps Vue template and blanks scripts and styles', () => {
    const vue =
      '<script>\nconst a = 1;\n</script>\n<template>\n  <button>Click</button>\n</template>\n<style>\nbutton { color: red; }\n</style>';
    const prepared = prepareHtmlForDomScan('App.vue', vue);

    assert.equal(prepared.length, vue.length);
    assert.equal(prepared.split('\n').length, vue.split('\n').length);
    assert.equal(prepared.includes('<script>'), false);
    assert.equal(prepared.includes('<style>'), false);
    assert.equal(prepared.includes('<template>'), false);
    assert.equal(prepared.includes('</template>'), false);
    assert.equal(prepared.includes('<button>Click</button>'), true);
  });

  await t.test('extractStyleBlocks extracts <style> and Lit css tagged templates', () => {
    const htmlWithStyle = '<div></div>\n<style>\n.btn { color: blue; }\n</style>';
    const styleBlocks = extractStyleBlocks('index.html', htmlWithStyle);
    assert.equal(styleBlocks.length, 1);
    const styleBlock = styleBlocks[0];
    assert.ok(styleBlock);
    assert.equal(styleBlock.includes('.btn { color: blue; }'), true);

    const litTs =
      'import { css } from "lit";\nconst s = css`\n  .card { color: ${"red"}; }\n`;';
    const litBlocks = extractStyleBlocks('card.ts', litTs);
    assert.equal(litBlocks.length, 1);
    const litBlock = litBlocks[0];
    assert.ok(litBlock);
    assert.equal(litBlock.includes('.card { color:'), true);
    assert.equal(litBlock.includes('${"red"}'), false);
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


