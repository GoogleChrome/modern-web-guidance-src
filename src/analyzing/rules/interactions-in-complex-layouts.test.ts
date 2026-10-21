import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  interactionsInComplexLayoutsJsMatcher,
  interactionsInComplexLayoutsJsRule,
  interactionsInComplexLayoutsPackageMatcher,
  interactionsInComplexLayoutsPackageRule,
  interactionsInComplexLayoutsRules,
} from './interactions-in-complex-layouts.ts';

void test('interactions-in-complex-layouts: rule metadata', () => {
  assert.equal(
    interactionsInComplexLayoutsPackageRule.id,
    'interactions-in-complex-layouts/package-fastdom',
  );
  assert.equal(
    interactionsInComplexLayoutsPackageRule.guideId,
    'interactions-in-complex-layouts',
  );
  assert.equal(
    interactionsInComplexLayoutsPackageRule.guideHash,
    INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  );
  assert.equal(INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH.length, 12);

  assert.equal(
    interactionsInComplexLayoutsJsRule.id,
    'interactions-in-complex-layouts/js-fastdom',
  );
  assert.equal(
    interactionsInComplexLayoutsJsRule.guideId,
    'interactions-in-complex-layouts',
  );
  assert.equal(
    interactionsInComplexLayoutsJsRule.guideHash,
    INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  );

  assert.equal(interactionsInComplexLayoutsRules.length, 2);
  assert.ok(interactionsInComplexLayoutsPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(interactionsInComplexLayoutsPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(interactionsInComplexLayoutsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(interactionsInComplexLayoutsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('interactions-in-complex-layouts dependency matcher', async (t) => {
  await t.test('flags fastdom', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          fastdom: '^1.0.11',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interactionsInComplexLayoutsPackageMatcher,
    ]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interactionsInComplexLayoutsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('interactions-in-complex-layouts JS matcher', async (t) => {
  await t.test('flags fastdom.measure and fastdom.mutate calls', () => {
    const project = createInMemoryProject();
    const code = `
      import fastdom from 'fastdom';

      fastdom.measure(() => {
        const height = column.clientHeight;
        fastdom.mutate(() => {
          column.style.minHeight = height + 'px';
        });
      });
    `;
    const sourceFile = project.createSourceFile('board.js', code);
    const matches = interactionsInComplexLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'board.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("content-visibility", "auto")', () => {
    const project = createInMemoryProject();
    const code = `
      import fastdom from 'fastdom';

      if (!CSS.supports('content-visibility', 'auto')) {
        fastdom.measure(() => {
          fastdom.mutate(() => {});
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = interactionsInComplexLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts performance.measure and shadowed local fastdom bindings', () => {
    const project = createInMemoryProject();
    const code = `
      import fastdom from 'fastdom';

      performance.measure('render-board');

      const customMetrics = { measure: (name) => name };
      customMetrics.measure('layout-step');

      function localScope() {
        const fastdom = { measure: (fn) => fn(), mutate: (fn) => fn() };
        fastdom.measure(() => {});
        fastdom.mutate(() => {});
      }
    `;
    const sourceFile = project.createSourceFile('shadowed.js', code);
    const matches = interactionsInComplexLayoutsJsMatcher.matchFile(sourceFile, {
      filePath: 'shadowed.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
