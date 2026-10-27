import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  scrollSnapStateSyncMatcher
} from './scroll-snap-state-sync.ts';
void test('scroll-snap-state-sync JS matcher', async (t) => {
  await t.test('flags debounced scroll and scrollend listeners computing Math.round(el.scrollLeft / width)', () => {
    const code = `
      const scroller = document.querySelector('.snap-scroller');
      let timeoutId;
      scroller.addEventListener('scroll', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const idx = Math.round(scroller.scrollLeft / scroller.clientWidth);
          setActiveSlide(idx);
        }, 100);
      });

      scroller.addEventListener('scrollend', () => {
        const idx = Math.round(scroller.scrollTop / scroller.clientHeight);
        setActiveSlide(idx);
      });
    `;
    const matches = matchJsRule(scrollSnapStateSyncMatcher, 'snap-sync.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by "onscrollsnapchange" in window or non-debounced realtime scroll listeners', () => {
    const code = `
      const scroller = document.querySelector('.snap-scroller');
      if (!('onscrollsnapchange' in window)) {
        scroller.addEventListener('scrollend', () => {
          const idx = Math.round(scroller.scrollLeft / scroller.clientWidth);
          setActiveSlide(idx);
        });
      }

      scroller.addEventListener('scroll', () => {
        const idx = Math.round(scroller.scrollLeft / scroller.clientWidth);
        setPendingSlide(idx);
      });
    `;
    const matches = matchJsRule(scrollSnapStateSyncMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags scroll listeners debounced using lodash debounce helper', () => {
    const code = `
      const gallery = document.querySelector('.gallery-snap');
      const onScrollDebounced = debounce(() => {
        const activeIdx = Math.floor(gallery.scrollLeft / gallery.clientWidth);
        syncGalleryState(activeIdx);
      }, 200);
      gallery.addEventListener('scroll', onScrollDebounced);
    `;
    const matches = matchJsRule(scrollSnapStateSyncMatcher, 'lodash-debounce.js', code);
    assert.equal(matches.length, 1);
  });
});
