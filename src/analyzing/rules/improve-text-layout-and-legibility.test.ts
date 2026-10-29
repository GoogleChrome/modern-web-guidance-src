import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  improveTextLayoutAndLegibilityJsMatcher,
  improveTextLayoutAndLegibilityPackageMatcher
} from './improve-text-layout-and-legibility.ts';
void test('improve-text-layout-and-legibility dependency matcher', async (t) => {
  await t.test('flags react-wrap-balancer and balance-text', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'react-wrap-balancer': '^1.1.0',
          'balance-text': '^3.3.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      improveTextLayoutAndLegibilityPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
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
      improveTextLayoutAndLegibilityPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('improve-text-layout-and-legibility JS matcher', async (t) => {
  await t.test('flags balanceText(), jQuery .balanceText(), and <Balancer>', () => {
    const code = `
      import balanceText from 'balance-text';
      import Balancer from 'react-wrap-balancer';

      balanceText('.headline', { watch: true });
      $('.hero-title').balanceText();
      export const Hero = () => <h1><Balancer>Balanced Heading</Balancer></h1>;
    `;
    const matches = matchJsRule(improveTextLayoutAndLegibilityJsMatcher, 'balance.tsx', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by CSS.supports("text-wrap", "balance") or local Balancer component', () => {
    const code = `
      if (!CSS.supports('text-wrap', 'balance')) {
        balanceText('.headline');
      }
      function Balancer({ children }) { return <div>{children}</div>; }
      export const Local = () => <Balancer>Not react-wrap-balancer</Balancer>;
    `;
    const matches = matchJsRule(improveTextLayoutAndLegibilityJsMatcher, 'guarded.tsx', code);
    assert.equal(matches.length, 0);
  });
});
