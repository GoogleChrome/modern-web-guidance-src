import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLL_SNAP_STATE_SYNC_GUIDE_HASH,
  scrollSnapStateSyncMatcher,
  scrollSnapStateSyncRule,
  scrollSnapStateSyncRules,
} from './scroll-snap-state-sync.ts';

void test('scroll-snap-state-sync: rule metadata', () => {
  assert.equal(scrollSnapStateSyncRule.id, 'scroll-snap-state-sync');
  assert.equal(scrollSnapStateSyncRule.guideId, 'scroll-snap-state-sync');
  assert.equal(
    scrollSnapStateSyncRule.guideHash,
    SCROLL_SNAP_STATE_SYNC_GUIDE_HASH,
  );
  assert.equal(SCROLL_SNAP_STATE_SYNC_GUIDE_HASH.length, 12);
  assert.equal(scrollSnapStateSyncRules.length, 1);
  assert.ok(scrollSnapStateSyncRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(scrollSnapStateSyncRule.phase2Rubric.dropWhen.length >= 2);
});

void test('scroll-snap-state-sync JS matcher', async (t) => {
  await t.test('flags debounced scroll and scrollend listeners computing Math.round(el.scrollLeft / width)', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('snap-sync.js', code);
    const matches = scrollSnapStateSyncMatcher.matchFile(sourceFile, {
      filePath: 'snap-sync.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by "onscrollsnapchange" in window or non-debounced realtime scroll listeners', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollSnapStateSyncMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags scroll listeners debounced using lodash debounce helper', () => {
    const project = createInMemoryProject();
    const code = `
      const gallery = document.querySelector('.gallery-snap');
      const onScrollDebounced = debounce(() => {
        const activeIdx = Math.floor(gallery.scrollLeft / gallery.clientWidth);
        syncGalleryState(activeIdx);
      }, 200);
      gallery.addEventListener('scroll', onScrollDebounced);
    `;
    const sourceFile = project.createSourceFile('lodash-debounce.js', code);
    const matches = scrollSnapStateSyncMatcher.matchFile(sourceFile, {
      filePath: 'lodash-debounce.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
