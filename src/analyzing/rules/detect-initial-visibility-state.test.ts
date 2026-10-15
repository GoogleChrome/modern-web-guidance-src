import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH,
  detectInitialVisibilityStateMatcher,
  detectInitialVisibilityStateRule,
  detectInitialVisibilityStateRules,
} from './detect-initial-visibility-state.ts';

describe('detect-initial-visibility-state rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(detectInitialVisibilityStateRule.id, 'detect-initial-visibility-state');
    assert.equal(detectInitialVisibilityStateRule.guideId, 'detect-initial-visibility-state');
    assert.equal(detectInitialVisibilityStateRule.guideHash, DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH);
    assert.equal(detectInitialVisibilityStateRule.guideHash.length, 12);
    assert.ok(detectInitialVisibilityStateRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(detectInitialVisibilityStateRule.phase2Rubric.dropWhen.length >= 2);
    assert.equal(detectInitialVisibilityStateRules.length, 1);
  });

  test('flags wasHidden variable declaration alongside visibilitychange listener', () => {
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
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /VisibilityStateEntry/);
    assert.match(matches[0].message, /wasHidden/);
  });

  test('flags hiddenAtLoad variable assignment alongside visibilitychange listener', () => {
    const code = `
      const hiddenAtLoad = document.hidden;
      window.addEventListener('visibilitychange', function() {
        if (hiddenAtLoad) {
          logBackgroundStart();
        }
      });
    `;
    const { matches } = scanJsSource(
      'utils/hidden.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /VisibilityStateEntry/);
    assert.match(matches[0].message, /hiddenAtLoad/);
  });

  test('flags object property backgroundLoad alongside visibilitychange listener', () => {
    const code = `
      const telemetry = {
        backgroundLoad: document.visibilityState === 'hidden',
      };
      document.addEventListener('visibilitychange', () => {});
    `;
    const { matches } = scanJsSource(
      'analytics/telemetry.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /backgroundLoad/);
  });

  test('flags class property wasHidden alongside visibilitychange listener', () => {
    const code = `
      class VisTracker {
        wasHidden = document.hidden;
        constructor() {
          document.addEventListener('visibilitychange', () => this.check());
        }
      }
    `;
    const { matches } = scanJsSource(
      'analytics/class-tracker.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /wasHidden/);
  });

  test('flags vendor-prefixed webkitHidden without visibilitychange listener', () => {
    const code = `
      const isHidden = document.webkitHidden;
    `;
    const { matches } = scanJsSource(
      'compat/webkit.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /webkitHidden/);
  });

  test('flags vendor-prefixed webkitVisibilityState and mozHidden', () => {
    const code = `
      const state = document.webkitVisibilityState || document.mozHidden;
    `;
    const { matches } = scanJsSource(
      'compat/vendor.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 2);
  });

  test('flags vendor-prefixed in expression', () => {
    const code = `
      if ('webkitHidden' in document) {
        console.log('webkit prefix supported');
      }
    `;
    const { matches } = scanJsSource(
      'compat/check.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /webkitHidden/);
  });

  test('ignores generic document.visibilityState check without initial variable', () => {
    const code = `
      function checkPageVisibility() {
        if (document.visibilityState === 'hidden') {
          console.log('Currently hidden');
        }
        return document.hidden;
      }
    `;
    const { matches } = scanJsSource(
      'analytics/generic.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores runtime visibilitychange listener pausing video without initial variable', () => {
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
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores initial variable assignment without visibilitychange listener in file', () => {
    const code = `
      const wasHidden = document.hidden;
      console.log('Current state:', wasHidden);
    `;
    const { matches } = scanJsSource(
      'utils/one-off.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores code when file references VisibilityStateEntry', () => {
    const code = `
      function getVisibilityInfo() {
        if ('VisibilityStateEntry' in window) {
          const entries = performance.getEntriesByType('visibility-state');
          return entries.length > 0 && entries[0].name === 'hidden';
        }
        let wasHidden = document.visibilityState === 'hidden';
        document.addEventListener('visibilitychange', () => {});
      }
    `;
    const { matches } = scanJsSource(
      'perf/modern-vis.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores code when file references getEntriesByType("visibility-state")', () => {
    const code = `
      const entries = performance.getEntriesByType('visibility-state');
      let wasHidden = document.hidden;
      document.addEventListener('visibilitychange', onVis);
    `;
    const { matches } = scanJsSource(
      'perf/timeline.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores custom object with hidden or visibilityState property', () => {
    const code = `
      const item = { hidden: true, visibilityState: 'visible' };
      if (item.hidden) {
        doSomething();
      }
    `;
    const { matches } = scanJsSource(
      'models/item.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
