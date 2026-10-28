import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  swipeToRevealMatcher,
  swipeToRevealPackageMatcher,
} from './swipe-to-reveal.ts';

void test('swipe-to-reveal JS and package matchers', async (t) => {
  await t.test('flags touchmove/touchend handlers translating a row to reveal action buttons without deleting the item', () => {
    const code = `
      const actionWidth = 140;
      let startX = 0;
      let deltaX = 0;

      row.addEventListener('touchmove', (e) => {
        deltaX = Math.max(-actionWidth, Math.min(0, e.touches[0].clientX - startX));
        row.style.transform = \`translateX(\${deltaX}px)\`;
      });

      row.addEventListener('touchend', () => {
        const openOffset = deltaX < -actionWidth / 2 ? -actionWidth : 0;
        row.style.transform = \`translateX(\${openOffset}px)\`;
      });
    `;
    const matches = matchJsRule(swipeToRevealMatcher, 'swipe-actions.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /overscroll-behavior: chain/);
  });

  await t.test('flags react-swipeable-list and rc-swipeout in package.json', () => {
    const pkg = JSON.stringify({
      name: 'list-app',
      dependencies: {
        'react-swipeable-list': '^1.8.0',
      },
    });
    const matches = scanPackageJson('package.json', pkg, [swipeToRevealPackageMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts swipe-to-remove files that delete the row via .remove()', () => {
    const removeCode = `
      const actionWidth = 140;
      row.addEventListener('touchmove', (e) => {
        const deltaX = e.touches[0].clientX - startX;
        row.style.transform = \`translateX(\${deltaX}px)\`;
      });
      row.addEventListener('touchend', () => {
        row.remove();
      });
    `;
    assert.equal(
      matchJsRule(swipeToRevealMatcher, 'remove.js', removeCode).length,
      0,
    );
  });
});
