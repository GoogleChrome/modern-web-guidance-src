import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  spatialNavigationMatcher,
} from './spatial-navigation.ts';

void test('spatial-navigation JS matcher', async (t) => {
  await t.test('flags 2D arrow-key focus handlers using fixed column-count math or unfiltered getBoundingClientRect', () => {
    const fixedColsCode = `
      grid.addEventListener('keydown', (e) => {
        const cols = 4;
        if (e.key === 'ArrowRight') next = index + 1;
        else if (e.key === 'ArrowLeft') next = index - 1;
        else if (e.key === 'ArrowDown') next = index + cols;
        else if (e.key === 'ArrowUp') next = index - cols;
        items[next]?.focus();
      });
    `;
    const matches1 = matchJsRule(spatialNavigationMatcher, 'grid-nav.js', fixedColsCode);
    assert.equal(matches1.length, 1);

    const unfilteredRectCode = `
      container.addEventListener('keydown', (e) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const currentRect = document.activeElement.getBoundingClientRect();
        const candidate = findClosest(candidates, currentRect, e.key);
        candidate?.focus();
      });
    `;
    const matches2 = matchJsRule(spatialNavigationMatcher, 'spatial.js', unfilteredRectCode);
    assert.equal(matches2.length, 1);

    const classDelegatedCode = `
      class ThumbnailGrid {
        setup() {
          this.container.addEventListener('keydown', (e) => {
            switch (e.key) {
              case 'ArrowLeft': this.#goToNextItem(e.target, false, true); break;
              case 'ArrowRight': this.#goToNextItem(e.target, true, true); break;
              case 'ArrowDown': this.#goToNextItem(e.target, true, false); break;
              case 'ArrowUp': this.#goToNextItem(e.target, false, false); break;
            }
          });
        }
        #goToNextItem(target, forward, horizontal) {
          const { x, y } = target.getBoundingClientRect();
          const next = this.items.find((item) => item.div.getBoundingClientRect().x === x && item.div.getBoundingClientRect().y !== y);
          if (next) this.#focusItem(next);
        }
        #focusItem(item) {
          item.div.focus();
        }
      }
    `;
    const matches3 = matchJsRule(spatialNavigationMatcher, 'thumbnail-grid.js', classDelegatedCode);
    assert.equal(matches3.length, 1);
  });

  await t.test('exempts spatial navigation that filters candidates with checkVisibility() or 1D menu/tablist widgets', () => {
    const modernCode = `
      container.addEventListener('keydown', (e) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        const visible = candidates.filter((el) => el.checkVisibility());
        const currentRect = document.activeElement.getBoundingClientRect();
        const best = findBest(visible, currentRect, e.key);
        if (best) {
          e.preventDefault();
          best.focus();
        }
      });
    `;
    assert.equal(
      matchJsRule(spatialNavigationMatcher, 'modern-spatial.js', modernCode).length,
      0,
    );
  });
});
