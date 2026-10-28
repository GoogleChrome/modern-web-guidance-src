import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { groupElementTransitionsMatcher } from './group-element-transitions.ts';

void test('group-element-transitions CSS matcher', async (t) => {
  await t.test('flags comma-grouped numbered ::view-transition-group selectors', () => {
    const css = `
      ::view-transition-group(card-1),
      ::view-transition-group(card-2),
      ::view-transition-group(card-3) {
        animation-duration: 300ms;
        animation-timing-function: ease-out;
      }
    `;
    const matches = scanCss('cards.css', css, [groupElementTransitionsMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags separate CSS rules repeated for 3+ numbered ::view-transition-group selectors once per prefix', () => {
    const css = `
      ::view-transition-group(item-1) { animation-duration: 250ms; }
      ::view-transition-group(item-2) { animation-duration: 250ms; }
      ::view-transition-group(item-3) { animation-duration: 250ms; }
    `;
    const matches = scanCss('items.css', css, [groupElementTransitionsMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts stylesheets already using view-transition-class and page-level landmark transitions', () => {
    const modernCss = `
      .card { view-transition-class: card-item; }
      ::view-transition-group(*.card-item) { animation-duration: 300ms; }
    `;
    assert.equal(scanCss('modern.css', modernCss, [groupElementTransitionsMatcher]).length, 0);

    const landmarkCss = `
      ::view-transition-old(root),
      ::view-transition-new(root),
      ::view-transition-group(header) {
        animation-duration: 200ms;
      }
    `;
    assert.equal(scanCss('landmarks.css', landmarkCss, [groupElementTransitionsMatcher]).length, 0);
  });
});
