import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  pullToRevealJsMatcher,
  pullToRevealPackageMatcher,
} from './pull-to-reveal.ts';

void test('pull-to-reveal: positive brownfield matches', async (t) => {
  await t.test('flags pulltorefreshjs in package.json', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        pulltorefreshjs: '^0.1.22',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      pullToRevealPackageMatcher,
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /scroll-initial-target/);
  });

  await t.test('flags PullToRefresh.init() in JS', () => {
    const code = `
      import PullToRefresh from 'pulltorefreshjs';
      PullToRefresh.init({
        mainElement: 'body',
        onRefresh() { window.location.reload(); },
      });
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'ptr.ts', code);
    assert.equal(matches.length, 1);
  });
});

void test('pull-to-reveal: negative / exempt cases', async (t) => {
  await t.test('exempts files already using scroll-initial-target', () => {
    const code = `
      import PullToRefresh from 'pulltorefreshjs';
      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        PullToRefresh.init({ mainElement: 'body' });
      }
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'fallback.ts', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts generic init() calls on non-PullToRefresh objects', () => {
    const code = `
      AppController.init({ mainElement: 'body' });
    `;
    const matches = matchJsRule(pullToRevealJsMatcher, 'app.ts', code);
    assert.equal(matches.length, 0);
  });
});
