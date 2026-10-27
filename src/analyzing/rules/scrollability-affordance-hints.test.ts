import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollabilityAffordanceHintsMatcher
} from './scrollability-affordance-hints.ts';
void test('scrollability-affordance-hints JS matcher', async (t) => {
  await t.test('flags horizontal scroll listener comparing scrollLeft, scrollWidth, and clientWidth to toggle has-scroll-left / has-scroll-right', () => {
    const code = `
      const scroller = document.querySelector('.table-scroller');
      scroller.addEventListener('scroll', () => {
        scroller.classList.toggle('has-scroll-left', scroller.scrollLeft > 0);
        scroller.classList.toggle(
          'has-scroll-right',
          scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth
        );
      });
    `;
    const matches = matchJsRule(scrollabilityAffordanceHintsMatcher, 'affordance.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags vertical scroll listener comparing scrollTop, scrollHeight, and clientHeight to toggle can-scroll / is-scrollable', () => {
    const code = `
      const pane = document.querySelector('.pane');
      pane.addEventListener('scroll', () => {
        const canScrollMore = pane.scrollTop + pane.clientHeight < pane.scrollHeight;
        pane.classList.toggle('can-scroll', canScrollMore);
      });
    `;
    const matches = matchJsRule(scrollabilityAffordanceHintsMatcher, 'vertical-affordance.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports("container-type", "scroll-state") or infinite scroll fetch', () => {
    const code = `
      const scroller = document.querySelector('.scroller');
      if (!CSS.supports('container-type', 'scroll-state')) {
        scroller.addEventListener('scroll', () => {
          scroller.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth);
        });
      }

      scroller.addEventListener('scroll', () => {
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight) {
          fetchMoreItems();
        }
      });
    `;
    const matches = matchJsRule(scrollabilityAffordanceHintsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags ResizeObserver comparing scrollWidth and clientWidth to toggle scroll-shadow', () => {
    const code = `
      const table = document.querySelector('.responsive-table');
      const resizeObserver = new ResizeObserver(() => {
        table.classList.toggle('scroll-shadow', table.scrollWidth > table.clientWidth);
      });
      resizeObserver.observe(table);
    `;
    const matches = matchJsRule(scrollabilityAffordanceHintsMatcher, 'ro-affordance.js', code);
    assert.equal(matches.length, 1);
  });
});
