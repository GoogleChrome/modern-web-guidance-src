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

  await t.test('flags balanceText imported from a local balanceText utility module or Vue SFC script', () => {
    const scriptWithCall = `
      import { balanceText } from '@/utils/balanceText';
      const title = balanceText(album.title, titleRef.value?.offsetWidth || 0);
    `;
    const callMatches = matchJsRule(
      improveTextLayoutAndLegibilityJsMatcher,
      'AlbumInfo.ts',
      scriptWithCall,
    );
    assert.equal(callMatches.length, 1);

    const vueSfc = `<template>
  <div v-html="balanceText(playlist.name, 400)" />
</template>
<script setup lang="ts">
import { balanceText } from '@/utils/balanceText';
</script>`;
    const vueMatches = matchJsRule(
      improveTextLayoutAndLegibilityJsMatcher,
      'PlaylistInfo.vue',
      vueSfc,
    );
    assert.equal(vueMatches.length, 1);
    assert.equal(vueMatches[0]?.line, 5);
  });

  await t.test('exempts when guarded by CSS.supports("text-wrap", "balance") or local Balancer/balanceText helpers', () => {
    const code = `
      if (!CSS.supports('text-wrap', 'balance')) {
        balanceText('.headline');
      }
      function Balancer({ children }) { return <div>{children}</div>; }
      export const Local = () => <Balancer>Not react-wrap-balancer</Balancer>;
      function balanceText(text) {
        const count = (text.match(/\\*\\*/g) || []).length;
        return count % 2 !== 0 ? text + '**' : text;
      }
      balanceText('**markdown');
    `;
    const matches = matchJsRule(improveTextLayoutAndLegibilityJsMatcher, 'guarded.tsx', code);
    assert.equal(matches.length, 0);
  });
});
