import assert from 'node:assert/strict';
import test from 'node:test';
import { Node, Project, SyntaxKind } from 'ts-morph';
import {
  areNodesEqual,
  findImportBinding,
  getAssignedTarget,
  getAssignment,
  getMemberAccess,
  getSafeModuleSpecifier,
  getSemanticParent,
  getSingleArgument,
  getStaticNumber,
  getStaticString,
  hasBindingName,
  isCallableNode,
  isDomClassOrAttrMutation,
  isGlobalMember,
  isGlobalReference,
  isIdentifierReference,
  isLibraryReference,
  isProtectedByFeatureGuard,
  isRequireOfPackage,
  isUnshadowedGlobal,
  matchEventListenerCall,
  matchesPackageSpec,
  resolveCallableNode,
  resolveLexicalBinding,
  resolveLocalExpression,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
  unwrapPropertyAccess,
} from './ast-helpers.ts';

test('isProtectedByFeatureGuard: bare variable and negative early-return guards', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('bare variable null-check does NOT guard subsequent code', () => {
    const source = project.createSourceFile(
      'nullCheck.ts',
      `
      function processElement(container: HTMLElement | null) {
        if (!container) return;
        legacyResizeObserverPolyfill(container);
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyResizeObserverPolyfill'));
    assert.ok(callNode);

    // 'container' as a CSS keyword token must NOT match bare variable !container
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['container', 'container-type']),
      false,
      'if (!container) return must not falsely suppress findings as a feature guard',
    );
  });

  await t.test('negative modern feature check does NOT guard subsequent code', () => {
    const source = project.createSourceFile(
      'negativeScheduler.ts',
      `
      function scheduleWork() {
        if (!window.scheduler) return;
        legacyTaskYield();
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyTaskYield'));
    assert.ok(callNode);

    // Negative check if (!window.scheduler) return exits when missing, so subsequent code
    // runs when window.scheduler IS present (not a legacy fallback)
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['scheduler', 'window.scheduler']),
      false,
      'if (!window.scheduler) return must not treat subsequent code as guarded fallback',
    );
  });

  await t.test('positive modern feature check DOES guard subsequent fallback code', () => {
    const source = project.createSourceFile(
      'positiveScheduler.ts',
      `
      function scheduleWork() {
        if (window.scheduler) return;
        legacyTaskYield();
      }
      `,
      { overwrite: true },
    );

    const callNode = source.getDescendants().find((n) => n.getText().startsWith('legacyTaskYield'));
    assert.ok(callNode);

    // Positive check if (window.scheduler) return exits when supported, so subsequent code
    // runs when window.scheduler is falsy (legitimate guarded fallback)
    assert.equal(
      isProtectedByFeatureGuard(callNode, ['scheduler', 'window.scheduler']),
      true,
      'if (window.scheduler) return must guard subsequent legacy fallback code',
    );
  });
});

test('matchesPackageSpec, isRequireOfPackage, and isLibraryReference', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('matchesPackageSpec matches exact package names and subpaths only', () => {
    assert.equal(matchesPackageSpec('capsize', ['capsize', '@capsizecss/core']), true);
    assert.equal(matchesPackageSpec('@capsizecss/core/metrics', ['capsize', '@capsizecss/core']), true);
    assert.equal(matchesPackageSpec('capsize-extra', ['capsize']), false);
    assert.equal(matchesPackageSpec(null, ['capsize']), false);
  });

  await t.test('isRequireOfPackage supports direct and optional curried require()', () => {
    const sf = project.createSourceFile(
      'req.js',
      `
      const a = require('country-list');
      const b = require('country-list')();
      `,
      { overwrite: true },
    );
    const decls = sf.getVariableDeclarations();
    const initA = decls[0]?.getInitializer();
    const initB = decls[1]?.getInitializer();
    assert.ok(initA && initB);
    assert.equal(isRequireOfPackage(initA, ['country-list']), true);
    assert.equal(isRequireOfPackage(initB, ['country-list']), false);
    assert.equal(isRequireOfPackage(initB, ['country-list'], { allowCurriedRequire: true }), true);
  });

  await t.test('isLibraryReference resolves ESM imports, CJS require, globals, and local shadowing', () => {
    const sf = project.createSourceFile(
      'libRef.ts',
      `
      import tippy from 'tippy.js';
      import { computePosition as calcPos } from '@floating-ui/dom';
      import ecDefault, { ec as NamedEC } from 'elliptic';

      const cjsToast = require('toastify-js');
      const { createPopper: popperFn } = require('@popperjs/core');

      tippy('#btn');
      calcPos(ref, floating);
      new ecDefault('p256');
      new NamedEC('p256');
      cjsToast({});
      popperFn(ref, tip);
      Popper.createPopper(ref, tip);
      AOS.init();

      function shadowed(tippy: (s: string) => void) {
        tippy('#local');
      }
      `,
      { overwrite: true },
    );

    const calls = sf.getDescendants().filter(Node.isCallExpression);
    const news = sf.getDescendants().filter(Node.isNewExpression);

    const tippyGlobalImportCall = calls.find((c) => c.getText() === "tippy('#btn')");
    const calcPosCall = calls.find((c) => c.getText() === 'calcPos(ref, floating)');
    const cjsToastCall = calls.find((c) => c.getText() === 'cjsToast({})');
    const popperFnCall = calls.find((c) => c.getText() === 'popperFn(ref, tip)');
    const umdPopperCall = calls.find((c) => c.getText() === 'Popper.createPopper(ref, tip)');
    const aosCall = calls.find((c) => c.getText() === 'AOS.init()');
    const shadowedCall = calls.find((c) => c.getText() === "tippy('#local')");
    const ecDefaultNew = news[0];
    const namedEcNew = news[1];

    assert.ok(
      tippyGlobalImportCall &&
        calcPosCall &&
        cjsToastCall &&
        popperFnCall &&
        umdPopperCall &&
        aosCall &&
        shadowedCall &&
        ecDefaultNew &&
        namedEcNew,
    );

    const aosCallee = aosCall.getExpression();
    assert.ok(Node.isPropertyAccessExpression(aosCallee));

    assert.equal(
      isLibraryReference(tippyGlobalImportCall.getExpression(), 'tippy', ['tippy.js']),
      true,
    );
    assert.equal(
      isLibraryReference(calcPosCall.getExpression(), 'computePosition', ['@floating-ui/dom']),
      true,
    );
    assert.equal(
      isLibraryReference(cjsToastCall.getExpression(), 'Toastify', ['toastify-js']),
      true,
    );
    assert.equal(
      isLibraryReference(popperFnCall.getExpression(), 'createPopper', ['@popperjs/core']),
      true,
    );
    assert.equal(
      isLibraryReference(umdPopperCall.getExpression(), 'createPopper', ['@popperjs/core'], {
        globalNamespaces: ['Popper'],
      }),
      true,
    );
    assert.equal(
      isLibraryReference(aosCallee.getExpression(), 'AOS', ['aos']),
      true,
    );
    assert.equal(
      isLibraryReference(aosCallee.getExpression(), 'AOS', ['aos'], {
        allowGlobal: false,
      }),
      false,
    );
    assert.equal(
      isLibraryReference(shadowedCall.getExpression(), 'tippy', ['tippy.js']),
      false,
    );
    assert.equal(
      isLibraryReference(ecDefaultNew.getExpression(), 'ec', ['elliptic'], {
        allowDefaultImport: false,
        allowGlobal: false,
      }),
      false,
    );
    assert.equal(
      isLibraryReference(namedEcNew.getExpression(), 'ec', ['elliptic'], {
        allowDefaultImport: false,
        allowGlobal: false,
      }),
      true,
    );
  });

  await t.test('handles for-loop variable shadowing and initializers across scope walks', () => {
    const sf = project.createSourceFile(
      'forLoopScopes.ts',
      `
      for (const Temporal of items) {
        Temporal.now();
      }
      for (const el = document.getElementById('box'); el; ) {
        el.focus();
      }
      `,
      { overwrite: true },
    );

    const calls = sf.getDescendants().filter(Node.isCallExpression);
    const temporalNowCall = calls.find((c) => c.getText() === 'Temporal.now()');
    const elFocusCall = calls.find((c) => c.getText() === 'el.focus()');
    assert.ok(temporalNowCall && elFocusCall);

    const temporalExpr = temporalNowCall.getExpression();
    const elExpr = elFocusCall.getExpression();
    assert.ok(Node.isPropertyAccessExpression(temporalExpr) && Node.isPropertyAccessExpression(elExpr));

    assert.equal(
      isUnshadowedGlobal(temporalExpr.getExpression(), 'Temporal'),
      false,
      'for-of loop variable must shadow global identifier',
    );
    assert.equal(
      resolveLocalExpression(elExpr.getExpression()).getText(),
      "document.getElementById('box')",
      'for-statement initializer must resolve via resolveLocalExpression',
    );
  });

  await t.test('handles destructured parameter shadowing and aliased named imports', () => {
    const sf = project.createSourceFile(
      'destructuredAndAliasedImports.ts',
      `
      import { Temporal as AliasedTemporal } from '@js-temporal/polyfill';

      function withDestructuredParam({ Temporal }: { Temporal: { now: () => void } }) {
        Temporal.now();
      }

      Temporal.now();
      AliasedTemporal.now();
      `,
      { overwrite: true },
    );

    const calls = sf.getDescendants().filter(Node.isCallExpression);
    const paramCall = calls[0];
    const unshadowedGlobalCall = calls[1];
    const aliasedCall = calls[2];
    assert.ok(paramCall && unshadowedGlobalCall && aliasedCall);

    const paramExpr = paramCall.getExpression();
    const globalExpr = unshadowedGlobalCall.getExpression();
    const aliasedExpr = aliasedCall.getExpression();
    assert.ok(
      Node.isPropertyAccessExpression(paramExpr) &&
        Node.isPropertyAccessExpression(globalExpr) &&
        Node.isPropertyAccessExpression(aliasedExpr),
    );

    assert.equal(
      isUnshadowedGlobal(paramExpr.getExpression(), 'Temporal'),
      false,
      'destructured parameter { Temporal } must shadow global Temporal',
    );
    assert.equal(
      isUnshadowedGlobal(globalExpr.getExpression(), 'Temporal'),
      true,
      'import { Temporal as AliasedTemporal } must not shadow bare global Temporal',
    );
    assert.equal(
      isUnshadowedGlobal(aliasedExpr.getExpression(), 'AliasedTemporal'),
      false,
      'import { Temporal as AliasedTemporal } must shadow local alias AliasedTemporal',
    );
  });

  await t.test(
    'handles renamed destructuring, default values, nested patterns, and rest elements',
    () => {
      const sf = project.createSourceFile(
        'destructuringEdgeCases.ts',
        `
        function renamedAndDefault(obj: any) {
          const { Temporal: LocalTemporal, other = Temporal } = obj;
          Temporal.now();
          LocalTemporal.now();
          other.now();
        }

        function nestedAndRest(obj: any) {
          const { outer: { inner: [NestedTemporal] }, ...RestTemporal } = obj;
          NestedTemporal.now();
          RestTemporal.now();
        }
        `,
        { overwrite: true },
      );

      const calls = sf.getDescendants().filter(Node.isCallExpression);
      const [
        globalTemporalCall,
        localTemporalCall,
        otherCall,
        nestedTemporalCall,
        restTemporalCall,
      ] = calls;
      assert.ok(
        globalTemporalCall &&
          localTemporalCall &&
          otherCall &&
          nestedTemporalCall &&
          restTemporalCall,
      );

      const getReceiver = (call: Node) => {
        const expr = Node.isCallExpression(call) ? call.getExpression() : null;
        assert.ok(expr && Node.isPropertyAccessExpression(expr));
        return expr.getExpression();
      };

      assert.equal(
        isUnshadowedGlobal(getReceiver(globalTemporalCall), 'Temporal'),
        true,
        'source property key in { Temporal: LocalTemporal } and default value in { other = Temporal } must NOT shadow Temporal',
      );
      assert.equal(
        isUnshadowedGlobal(getReceiver(localTemporalCall), 'LocalTemporal'),
        false,
        'target binding LocalTemporal in { Temporal: LocalTemporal } must shadow LocalTemporal',
      );
      assert.equal(
        isUnshadowedGlobal(getReceiver(otherCall), 'other'),
        false,
        'target binding other in { other = Temporal } must shadow other',
      );
      assert.equal(
        isUnshadowedGlobal(getReceiver(nestedTemporalCall), 'NestedTemporal'),
        false,
        'nested object/array pattern { outer: { inner: [NestedTemporal] } } must shadow NestedTemporal',
      );
      assert.equal(
        isUnshadowedGlobal(getReceiver(nestedTemporalCall), 'outer'),
        true,
        'intermediate property key outer in { outer: { inner: [NestedTemporal] } } must NOT shadow outer',
      );
      assert.equal(
        isUnshadowedGlobal(getReceiver(restTemporalCall), 'RestTemporal'),
        false,
        'rest element ...RestTemporal must shadow RestTemporal',
      );
    },
  );
});

test('ast-helpers: AST combinators and branch-aware feature guards', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('unwrapExpression strips parentheses and type assertions', () => {
    const source = project.createSourceFile(
      'unwrap.ts',
      'const x = (((foo as string) satisfies string));',
      { overwrite: true },
    );
    const init = source.getVariableDeclarations()[0]?.getInitializer();
    assert.ok(init);
    assert.equal(unwrapExpression(init).getText(), 'foo');
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
    const callTarget = source
      .getDescendants()
      .filter((n) => n.getText() === 'ref')
      .at(-1);
    assert.ok(callTarget);
    assert.equal(
      resolveLocalExpression(callTarget, 2).getText(),
      "document.getElementById('my-dialog')",
    );
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

    const findTemporal = (fnName: string) => {
      const fn = source.getFunction(fnName);
      assert.ok(fn);
      const node = fn.getDescendants().find((n) => n.getText() === 'Temporal');
      assert.ok(node);
      return node;
    };

    assert.equal(isUnshadowedGlobal(findTemporal('clean'), 'Temporal'), true);
    assert.equal(isUnshadowedGlobal(findTemporal('shadowedByParam'), 'Temporal'), false);
    assert.equal(isUnshadowedGlobal(findTemporal('shadowedByVar'), 'Temporal'), false);
  });

  await t.test('isProtectedByFeatureGuard: branch-aware positive, negative, ternary, logical, and early return', () => {
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
      function memberDictCheck(this: any) {
        if (!('modal' in this.dialogOptions)) {
          legacyMemberDict();
        }
      }
      function shadowedParam(Temporal: any) {
        if (!Temporal.Duration) {
          legacyShadowedDuration();
        }
      }
      function unshadowedGlobalParam() {
        if (!Temporal.Duration) {
          legacyGlobalDuration();
        }
      }
      `,
      { overwrite: true },
    );

    const findCall = (prefix: string) => {
      const node = source.getDescendants().find((n) => n.getText().startsWith(prefix));
      assert.ok(node);
      return node;
    };

    assert.equal(isProtectedByFeatureGuard(findCall('fallbackOpen'), ['showModal']), true);
    assert.equal(isProtectedByFeatureGuard(findCall('el.showModal()'), ['showModal']), false);
    assert.equal(isProtectedByFeatureGuard(findCall('negativeFallback'), ['showModal']), true);
    assert.equal(isProtectedByFeatureGuard(findCall('negativeModern'), ['showModal']), false);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyTernary'), ['showModal']), true);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyTimezone'), ['Temporal']), true);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyEarlyReturn'), ['showModal']), true);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyMemberDict'), ['dialog', 'HTMLDialogElement', 'showModal']), false);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyShadowedDuration'), ['Temporal']), false);
    assert.equal(isProtectedByFeatureGuard(findCall('legacyGlobalDuration'), ['Temporal']), true);
  });

  await t.test('isProtectedByFeatureGuard: compound && / || and window.CSS.supports guards', () => {
    const source = project.createSourceFile(
      'compoundGuards.ts',
      `
      function compoundAndNegative() {
        if (typeof CSS !== 'undefined' && !CSS.supports('field-sizing', 'content')) {
          legacyCall();
        }
      }

      function compoundOrNegative() {
        if (typeof CSS === 'undefined' || !CSS.supports('field-sizing', 'content')) {
          legacyCall();
        }
      }

      function compoundAndPositiveElse() {
        if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')) {
          modernCall();
        } else {
          legacyCall();
        }
      }

      function optionalChainingNegative() {
        if (!window.CSS?.supports?.('field-sizing', 'content')) {
          legacyCall();
        }
      }

      function compoundAndPositiveThen() {
        if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')) {
          legacyCall();
        }
      }

      function windowCssSupports() {
        if (!window.CSS.supports('field-sizing', 'content')) {
          legacyCall();
        }
      }

      function globalThisCssSupports() {
        if (!globalThis.CSS.supports('field-sizing', 'content')) {
          legacyCall();
        }
      }
      `,
      { overwrite: true },
    );

    const getFnCall = (fnName: string, callPrefix: string) => {
      const fn = source.getFunction(fnName);
      assert.ok(fn, `missing function ${fnName}`);
      const node = fn.getDescendants().find((n) => n.getText().startsWith(callPrefix));
      assert.ok(node, `missing call starting with ${callPrefix} in ${fnName}`);
      return node;
    };

    // 1. typeof CSS !== 'undefined' && !CSS.supports('field-sizing', 'content') (protected in then branch)
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('compoundAndNegative', 'legacyCall'), ['field-sizing']),
      true,
    );

    // 2. typeof CSS === 'undefined' || !CSS.supports('field-sizing', 'content') (protected in then branch)
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('compoundOrNegative', 'legacyCall'), ['field-sizing']),
      true,
    );

    // 3. typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content') (protected in else branch)
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('compoundAndPositiveElse', 'legacyCall'), ['field-sizing']),
      true,
    );
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('compoundAndPositiveElse', 'modernCall'), ['field-sizing']),
      false,
    );

    // 4. !window.CSS?.supports?.('field-sizing', 'content') (protected in then branch)
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('optionalChainingNegative', 'legacyCall'), ['field-sizing']),
      true,
    );

    // 5. Negative test: typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content') (NOT protected in then branch)
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('compoundAndPositiveThen', 'legacyCall'), ['field-sizing']),
      false,
    );

    // Extra: window.CSS.supports and globalThis.CSS.supports
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('windowCssSupports', 'legacyCall'), ['field-sizing']),
      true,
    );
    assert.equal(
      isProtectedByFeatureGuard(getFnCall('globalThisCssSupports', 'legacyCall'), ['field-sizing']),
      true,
    );
  });

  await t.test('isGlobalReference matches globals and window/globalThis/self prefixes, respecting shadowing', () => {
    const source = project.createSourceFile(
      'globalRef.ts',
      `
      function directGlobal() { return ResizeObserver; }
      function windowGlobal() { return window.ResizeObserver; }
      function globalThisGlobal() { return globalThis.ResizeObserver; }
      function selfGlobal() { return self.ResizeObserver; }
      function shadowedParam(ResizeObserver: any) { return ResizeObserver; }
      function shadowedVar() { const ResizeObserver = null; return ResizeObserver; }
      function shadowedWindow(window: any) { return window.ResizeObserver; }
      function otherProperty() { return window.document; }
      `,
      { overwrite: true },
    );

    const getReturnExpr = (fnName: string) => {
      const expr = source
        .getFunction(fnName)
        ?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]
        ?.getExpression();
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

    const calls = source.getFunction('outer')?.getDescendantsOfKind(SyntaxKind.CallExpression);
    assert.ok(calls && calls.length === 4);

    const resolvedNamed = resolveCallableNode(calls[0]?.getArguments()[1]);
    assert.ok(Node.isFunctionDeclaration(resolvedNamed));
    assert.equal(resolvedNamed.getName(), 'namedHandler');

    assert.ok(Node.isArrowFunction(resolveCallableNode(calls[1]?.getArguments()[1])));
    assert.ok(Node.isArrowFunction(resolveCallableNode(calls[2]?.getArguments()[1])));
    assert.ok(Node.isArrowFunction(resolveCallableNode(calls[3]?.getArguments()[1])));
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
        $(window).scroll();
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

    const stmts = source.getFunction('setup')?.getStatements() ?? [];
    const getCall = (idx: number) => {
      const stmt = stmts[idx];
      assert.ok(stmt && Node.isExpressionStatement(stmt));
      const expr = stmt.getExpression();
      assert.ok(Node.isCallExpression(expr));
      return expr;
    };

    for (const idx of [0, 1, 2, 3]) {
      const match = matchEventListenerCall(getCall(idx), ['scroll']);
      assert.ok(match);
      assert.equal(match.eventName, 'scroll');
      assert.ok(Node.isFunctionDeclaration(match.handlerNode));
    }
    assert.equal(matchEventListenerCall(getCall(4), ['scroll']), null);
    assert.equal(matchEventListenerCall(getCall(5), ['scroll']), null);
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
    const jqFn = source.getFunction('jqMutations');
    const readOnlyFn = source.getFunction('readOnlyOperations');
    assert.ok(nativeFn && jqFn && readOnlyFn);
    assert.equal(isDomClassOrAttrMutation(nativeFn), true);
    assert.equal(isDomClassOrAttrMutation(jqFn), true);

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

    const firstCall = source.getFunction('setupListeners')?.getDescendantsOfKind(SyntaxKind.CallExpression)[0];
    assert.ok(firstCall);
    assert.equal(isProtectedByFeatureGuard(firstCall, ['isComposing']), true);

    const legacyInputCall = source.getDescendants().find((n) => n.getText().startsWith('legacyInputHandling'));
    const legacyAnchorCall = source.getDescendants().find((n) => n.getText().startsWith('legacyAnchorFallback'));
    assert.ok(legacyInputCall && legacyAnchorCall);
    assert.equal(isProtectedByFeatureGuard(legacyInputCall, ['isComposing']), true);
    assert.equal(isProtectedByFeatureGuard(legacyAnchorCall, ['CSS.supports', 'anchor-name']), true);
  });

  await t.test('getSafeModuleSpecifier handles template imports safely', () => {
    const imp1 = project
      .createSourceFile('import1.ts', "import { foo } from './bar.ts';", { overwrite: true })
      .getImportDeclarations()[0];
    assert.ok(imp1);
    assert.equal(getSafeModuleSpecifier(imp1), './bar.ts');

    const imp2 = project
      .createSourceFile('import2.ts', 'import { foo } from <%= path %>;', { overwrite: true })
      .getImportDeclarations()[0];
    assert.ok(imp2);
    assert.equal(getSafeModuleSpecifier(imp2), null);
  });
});

test('shared AST helpers: static literals, member/method/assignment unwrapping, structural equality, and binding resolution', async (t) => {
  const project = new Project({ useInMemoryFileSystem: true });

  await t.test('getStaticString and getStaticNumber handle literals, unary signs, and non-literals safely', () => {
    const source = project.createSourceFile(
      'literals.ts',
      'const a = ("hello" as const); const b = -42; const c = +7; const d = -foo; const e = -0;',
      { overwrite: true },
    );
    const inits = source.getVariableDeclarations().map((d) => d.getInitializer());
    assert.equal(getStaticString(inits[0]), 'hello');
    assert.equal(getStaticString(inits[1]), null);
    assert.equal(getStaticNumber(inits[1]), -42);
    assert.equal(getStaticNumber(inits[2]), 7);
    assert.equal(getStaticNumber(inits[3]), null);
    assert.equal(getStaticNumber(inits[4]), 0);
  });

  await t.test('unwrapPropertyAccess, getMemberAccess, unwrapMethodCall, and getSingleArgument', () => {
    const source = project.createSourceFile(
      'members.ts',
      `
      const a = (el as any)['children'].length;
      el.removeChild(child);
      obj.multi(1, 2);
      obj.spread(...items);
      `,
      { overwrite: true },
    );
    const lenExpr = source.getVariableDeclarationOrThrow('a').getInitializerOrThrow();
    assert.equal(getMemberAccess(lenExpr)?.name, 'length');
    const childrenAccess = unwrapPropertyAccess(getMemberAccess(lenExpr)?.expression, 'children');
    assert.ok(childrenAccess);
    assert.equal(unwrapPropertyAccess(lenExpr, 'other'), null);

    const calls = source.getDescendantsOfKind(SyntaxKind.CallExpression);
    assert.equal(unwrapMethodCall(calls[0], { methodName: 'removeChild', arity: 1 })?.methodName, 'removeChild');
    assert.equal(unwrapMethodCall(calls[0], { methodName: new Set(['remove', 'removeChild']), arity: { min: 1, max: 2 } })?.args.length, 1);
    assert.equal(unwrapMethodCall(calls[1], { methodName: 'multi', arity: 1 }), null);
    assert.ok(getSingleArgument(calls[0]!));
    assert.equal(getSingleArgument(calls[1]!), null);
    assert.equal(getSingleArgument(calls[2]!), null);
  });

  await t.test('getSemanticParent, getAssignment, getAssignedTarget, and areNodesEqual', () => {
    const source = project.createSourceFile(
      'assign.ts',
      `
      const evt = (doc.createEvent('Event') as Event)!;
      cached ??= getValue();
      const same1 = arr[/* note */ idx + 1];
      const same2 = (arr[idx + 1]);
      const quote1 = obj['key'];
      const quote2 = obj["key"];
      `,
      { overwrite: true },
    );
    const createCall = source.getDescendantsOfKind(SyntaxKind.CallExpression)[0]!;
    const { parent } = getSemanticParent(createCall);
    assert.ok(Node.isVariableDeclaration(parent));
    assert.equal(getAssignedTarget(createCall)?.getText(), 'evt');

    const cachedAssign = source.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((b) =>
      b.getOperatorToken().getKind() === SyntaxKind.QuestionQuestionEqualsToken,
    )!;
    assert.equal(getAssignment(cachedAssign)?.operator, SyntaxKind.QuestionQuestionEqualsToken);

    const decls = source.getVariableDeclarations();
    assert.equal(areNodesEqual(decls[1]!.getInitializer(), decls[2]!.getInitializer()), true);
    assert.equal(areNodesEqual(decls[3]!.getInitializer(), decls[4]!.getInitializer()), true);
    assert.equal(areNodesEqual(decls[1]!.getInitializer(), decls[3]!.getInitializer()), false);
  });

  await t.test('isGlobalMember, isCallableNode, hasBindingName, findImportBinding, isIdentifierReference, resolvesToBinding', () => {
    const source = project.createSourceFile(
      'bindings.ts',
      `
      import { AbortController as AC } from 'abort';
      function outer(flag: boolean) {
        const controller = new AbortController();
        const obj = { controller: 1, err: new Error('x') };
        if (flag) {
          const { controller } = { controller: { abort() {} } };
          controller.abort();
        }
        function innerHoist() {
          if (flag) { var controller = { abort() {} }; }
          controller.abort();
        }
        const cb = ({ controller }) => controller.abort();
        obj.controller;
        controller.abort();
        return { controller, AC, err: new window.TypeError('bad') };
      }
      `,
      { overwrite: true },
    );
    assert.ok(findImportBinding(source, 'AC'));
    const outerFn = source.getFunctionOrThrow('outer');
    assert.equal(isCallableNode(outerFn), true);
    const decl = outerFn.getVariableDeclarationOrThrow('controller');
    assert.equal(hasBindingName(decl, 'controller'), true);
    assert.equal(resolveLexicalBinding(decl, 'AbortController'), null);

    const newError = source.getDescendantsOfKind(SyntaxKind.NewExpression)[2];
    assert.ok(newError);
    assert.equal(isGlobalMember(newError.getExpression(), new Set(['Error', 'TypeError'])), 'TypeError');

    const resolvedCalls = source
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((id) => resolvesToBinding(id, decl))
      .map((id) => id.getStartLineNumber());
    assert.deepEqual(resolvedCalls, [16, 17]);

    const objPropId = source
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((p) => p.getText() === 'obj.controller')
      ?.getNameNode();
    assert.ok(Node.isIdentifier(objPropId));
    assert.equal(isIdentifierReference(objPropId), false);
  });

  await t.test('isProtectedByFeatureGuard recognizes typeof function, Reflect.has, hasOwnProperty, and polyfill blocks', () => {
    const source = project.createSourceFile(
      'guards-extended.ts',
      `
      function f1(el: any, flag: boolean) {
        if (typeof el.replaceChildren === 'function') { el.replaceChildren(); return; }
        el.innerHTML = '';

        if (typeof el.replaceChildren !== 'function') { el.innerHTML = ''; }
        if (Reflect.has(AbortSignal, 'timeout')) return AbortSignal.timeout(1);
        new AbortController();

        if (!AbortSignal.hasOwnProperty('timeout')) { new AbortController(); }
        if (Object.hasOwn(AbortSignal, 'timeout')) { return; }
        new AbortController();

        Element.prototype.replaceChildren = function () { this.innerHTML = ''; };
        AbortSignal.timeout ??= (ms: number) => {
          const c = new AbortController();
          return c.signal;
        };
        Object.defineProperty(AbortSignal, 'timeout', {
          value() { return new AbortController().signal; },
        });
      }
      `,
      { overwrite: true },
    );

    const innerHtmlAssigns = source
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .filter((p) => p.getName() === 'innerHTML');
    assert.equal(innerHtmlAssigns.length, 3);
    for (const p of innerHtmlAssigns) {
      assert.equal(isProtectedByFeatureGuard(p, ['replaceChildren']), true);
    }

    const abortCtrls = source
      .getDescendantsOfKind(SyntaxKind.NewExpression)
      .filter((n) => n.getExpression().getText() === 'AbortController');
    assert.equal(abortCtrls.length, 5);
    for (const ac of abortCtrls) {
      assert.equal(isProtectedByFeatureGuard(ac, ['timeout']), true);
    }

    const nonPolyfillSource = project.createSourceFile(
      'non-polyfills.ts',
      `
      class Store {
        private groupBy(xs: any[], key: (x: any) => string) {
          return xs.reduce((acc, item) => {
            const k = key(item);
            (acc[k] ??= []).push(item);
            return acc;
          }, {} as Record<string, any[]>);
        }

        assignOnThis() {
          (this as any).groupBy = () => new AbortController();
        }
      }

      function localHelper() {
        const helper: any = {};
        helper.groupBy = (xs: any[]) => xs.reduce((a, b) => a, {});
        Object.defineProperty(helper, 'timeout', {
          value() { return new AbortController().signal; },
        });
      }
      `,
      { overwrite: true },
    );

    const reduceCall = nonPolyfillSource
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((c) => c.getExpression().getText() === 'xs.reduce');
    assert.ok(reduceCall);
    assert.equal(isProtectedByFeatureGuard(reduceCall, ['groupBy']), false);

    for (const ac of nonPolyfillSource
      .getDescendantsOfKind(SyntaxKind.NewExpression)
      .filter((n) => n.getExpression().getText() === 'AbortController')) {
      assert.equal(isProtectedByFeatureGuard(ac, ['timeout', 'groupBy']), false);
    }
  });

  await t.test('invalidates scope and token caches when a SourceFile is overwritten in-place', () => {
    const sf1 = project.createSourceFile(
      'in-place-overwrite.ts',
      `
        import lib from 'alpha-pkg';
        function check() {
          const lib2 = 'local';
          return lib2 + lib + window.globalFlag;
        }
        el.innerHTML = '';
      `,
      { overwrite: true },
    );

    const call1Id = sf1
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .find((id) => id.getText() === 'lib' && id.getParent()?.getKind() === SyntaxKind.BinaryExpression);
    assert.ok(call1Id);
    assert.equal(findImportBinding(sf1, 'lib')?.importedName, 'default');
    assert.equal(resolveLexicalBinding(call1Id, 'lib')?.kind, 'import');
    assert.equal(isLibraryReference(call1Id, 'lib', ['alpha-pkg']), true);

    const innerHtml1 = sf1
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((p) => p.getName() === 'innerHTML');
    assert.ok(innerHtml1);
    assert.equal(isProtectedByFeatureGuard(innerHtml1, ['replaceChildren']), false);

    // Overwrite the exact same virtual path so ts-morph mutates and returns the same SourceFile instance
    const sf2 = project.createSourceFile(
      'in-place-overwrite.ts',
      `
        import renamed from 'beta-pkg';
        function check(lib: string) {
          if (typeof el.replaceChildren === 'function') { return; }
          el.innerHTML = lib + renamed;
        }
      `,
      { overwrite: true },
    );

    assert.strictEqual(sf1, sf2, 'expected ts-morph overwrite:true to reuse SourceFile instance');
    assert.equal(findImportBinding(sf2, 'lib'), null);
    assert.equal(findImportBinding(sf2, 'renamed')?.importedName, 'default');

    const innerHtml2 = sf2
      .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((p) => p.getName() === 'innerHTML');
    assert.ok(innerHtml2);
    const libRef2 = sf2
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .find((id) => id.getText() === 'lib' && Node.isBinaryExpression(id.getParent()));
    assert.ok(libRef2);
    assert.equal(resolveLexicalBinding(libRef2, 'lib')?.kind, 'parameter');
    assert.equal(isLibraryReference(libRef2, 'lib', ['alpha-pkg']), false);
    assert.equal(isProtectedByFeatureGuard(innerHtml2, ['replaceChildren']), true);
  });
});
