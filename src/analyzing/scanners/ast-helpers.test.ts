import assert from 'node:assert/strict';
import test from 'node:test';
import { Node, Project } from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  isRequireOfPackage,
  isUnshadowedGlobal,
  matchesPackageSpec,
  resolveLocalExpression,
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
