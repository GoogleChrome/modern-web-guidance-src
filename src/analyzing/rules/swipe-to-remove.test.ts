import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  swipeToRemoveMatcher,
} from './swipe-to-remove.ts';

void test('swipe-to-remove JS matcher', async (t) => {
  await t.test('flags touchmove/touchend handlers applying translateX and removing the item past a threshold', () => {
    const code = `
      let startX = 0;
      let deltaX = 0;

      row.addEventListener('touchmove', (e) => {
        deltaX = e.touches[0].clientX - startX;
        row.style.transform = \`translateX(\${deltaX}px)\`;
      });

      row.addEventListener('touchend', () => {
        if (Math.abs(deltaX) > 120) {
          row.remove();
        } else {
          row.style.transform = 'translateX(0px)';
        }
      });
    `;
    const matches = matchJsRule(swipeToRemoveMatcher, 'swipe-delete.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /scroll-snap-type: x mandatory/);
  });

  await t.test('exempts swipe-to-reveal drawers without item removal and horizontal carousels', () => {
    const revealOnlyCode = `
      const actionWidth = 160;
      row.addEventListener('touchmove', (e) => {
        const deltaX = e.touches[0].clientX - startX;
        row.style.transform = \`translateX(\${deltaX}px)\`;
      });
    `;
    assert.equal(
      matchJsRule(swipeToRemoveMatcher, 'reveal.js', revealOnlyCode).length,
      0,
    );
  });
});
