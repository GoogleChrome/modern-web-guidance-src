import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/index.ts';
import {
  detectInitialVisibilityStateMatcher
} from './detect-initial-visibility-state.ts';
void test('detect-initial-visibility-state: positive matches', async (t) => {
  await t.test('flags vendor-prefixed webkitHidden, mozHidden, msHidden, webkitVisibilityState', () => {
    const code = `
      const isHidden = document.webkitHidden || document.mozHidden || document.msHidden;
      const visState = document.webkitVisibilityState;
    `;
    const { matches } = scanJsSource(
      'compat/webkit.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 4);
    assert.match(matches[0]?.message ?? '', /webkitHidden/);
  });

  await t.test('flags vendor-prefixed visibilitychange event listeners', () => {
    const code = `
      document.addEventListener('webkitvisibilitychange', onVisChange);
      document.addEventListener('mozvisibilitychange', onVisChange);
      document.addEventListener('msvisibilitychange', onVisChange);
    `;
    const { matches } = scanJsSource(
      'compat/events.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /webkitvisibilitychange/);
  });

  await t.test('flags standalone vendor-prefixed in-document check', () => {
    const code = `
      if ('webkitHidden' in document) {
        pauseVideo();
      }
    `;
    const { matches } = scanJsSource(
      'compat/check.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /webkitHidden/);
  });

  await t.test('flags wasHidden variable declaration alongside visibilitychange listener', () => {
    const code = `
      let wasHidden = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', () => {
        if (wasHidden && document.visibilityState === 'visible') {
          sendMetric('page_became_visible');
          wasHidden = false;
        }
      });
    `;
    const { matches } = scanJsSource(
      'analytics/visibility.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /wasHidden/);
  });

  await t.test('flags initiallyBackgrounded and firstHiddenTime load-state tracking', () => {
    const code = `
      let initiallyBackgrounded = document.visibilityState === 'hidden';
      let firstHiddenTime = document.hidden ? 0 : Infinity;
      document.addEventListener('visibilitychange', (event) => {
        if (document.visibilityState === 'hidden') {
          firstHiddenTime = Math.min(firstHiddenTime, event.timeStamp);
        }
      });
    `;
    const { matches } = scanJsSource(
      'analytics/rum.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 2);
  });
});

void test('detect-initial-visibility-state: negative / exempt cases', async (t) => {
  await t.test('exempts generic initialState object and live tab-switch wasHidden tracking', () => {
    const code = `
      const initialState = {
        hidden: document.hidden,
        playing: false,
      };
      let wasHidden = document.hidden;
      document.addEventListener('visibilitychange', () => {
        if (wasHidden && !document.hidden) {
          refreshFeed();
        }
        wasHidden = document.hidden;
      });
    `;
    const { matches } = scanJsSource(
      'ui/feed.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts vendor-prefixed properties used as fallback behind document.visibilityState or document.hidden', () => {
    const code = `
      const state = document.visibilityState ?? document.webkitVisibilityState;
      const hidden = document.hidden ?? document.webkitHidden;
      let propName = 'hidden';
      if ('hidden' in document) {
        propName = 'hidden';
      } else if ('webkitHidden' in document) {
        propName = 'webkitHidden';
      }
    `;
    const { matches } = scanJsSource(
      'compat/fallback.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts runtime visibilitychange listener without initial state variable', () => {
    const code = `
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          videoPlayer.pause();
        } else {
          videoPlayer.play();
        }
      });
    `;
    const { matches } = scanJsSource(
      'media/video.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code already using VisibilityStateEntry or visibility-state performance entries', () => {
    const code = `
      const entries = performance.getEntriesByType('visibility-state');
      let wasHidden = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', () => {});
    `;
    const { matches } = scanJsSource(
      'perf/modern.js',
      code,
      [detectInitialVisibilityStateMatcher]
    );
    assert.equal(matches.length, 0);
  });
});
