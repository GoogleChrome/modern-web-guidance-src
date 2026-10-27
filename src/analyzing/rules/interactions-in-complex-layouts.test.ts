import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  interactionsInComplexLayoutsJsMatcher,
  interactionsInComplexLayoutsPackageMatcher
} from './interactions-in-complex-layouts.ts';
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
    const code = `
      import fastdom from 'fastdom';

      fastdom.measure(() => {
        const height = column.clientHeight;
        fastdom.mutate(() => {
          column.style.minHeight = height + 'px';
        });
      });
    `;
    const matches = matchJsRule(interactionsInComplexLayoutsJsMatcher, 'board.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("content-visibility", "auto")', () => {
    const code = `
      import fastdom from 'fastdom';

      if (!CSS.supports('content-visibility', 'auto')) {
        fastdom.measure(() => {
          fastdom.mutate(() => {});
        });
      }
    `;
    const matches = matchJsRule(interactionsInComplexLayoutsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts performance.measure and shadowed local fastdom bindings', () => {
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
    const matches = matchJsRule(interactionsInComplexLayoutsJsMatcher, 'shadowed.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags fastdom extended instances', () => {
    const code = `
      import fastdom from 'fastdom';
      const customFastdom = fastdom.extend({});
      customFastdom.mutate(() => {
        element.style.transform = 'scale(1.1)';
      });
    `;
    const matches = matchJsRule(interactionsInComplexLayoutsJsMatcher, 'extend.js', code);
    assert.equal(matches.length, 1);
  });
});
