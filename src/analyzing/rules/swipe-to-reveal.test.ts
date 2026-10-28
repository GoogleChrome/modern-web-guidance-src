import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  swipeToRevealMatcher,
} from './swipe-to-reveal.ts';

void test('swipe-to-reveal JS matcher', async (t) => {
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

  await t.test('exempts off-canvas navigation drawers and swipe-to-remove files', () => {
    const navDrawerCode = `
      class SideNav {
        _update() {
          const translateX = Math.min(0, this._currentX - this._startX);
          this._sideNavContainerEl.style.transform = \`translateX(\${translateX}px)\`;
        }
      }
    `;
    assert.equal(
      matchJsRule(swipeToRevealMatcher, 'side-nav.js', navDrawerCode).length,
      0,
    );

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
