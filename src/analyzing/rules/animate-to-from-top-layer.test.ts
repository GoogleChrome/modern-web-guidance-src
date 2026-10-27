import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  animateToFromTopLayerMatcher
} from './animate-to-from-top-layer.ts';
void test('animate-to-from-top-layer JS matcher', async (t) => {
  await t.test('flags animationend and transitionend listeners calling dialog.close() or popover.hidePopover()', () => {
    const code = `
      const dialog = document.querySelector('dialog');
      dialog.addEventListener('animationend', () => {
        dialog.classList.remove('is-closing');
        dialog.close();
      }, { once: true });

      const popover = document.querySelector('[popover]');
      popover.addEventListener('transitionend', () => {
        popover.hidePopover();
      });
    `;
    const matches = matchJsRule(animateToFromTopLayerMatcher, 'top-layer.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by allow-discrete / @starting-style or non-top-layer elements', () => {
    const code = `
      const dialog = document.querySelector('dialog');
      if (!CSS.supports('transition-behavior', 'allow-discrete')) {
        dialog.addEventListener('transitionend', () => {
          dialog.close();
        });
      }

      const toast = document.querySelector('.toast');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    `;
    const matches = matchJsRule(animateToFromTopLayerMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });
});
