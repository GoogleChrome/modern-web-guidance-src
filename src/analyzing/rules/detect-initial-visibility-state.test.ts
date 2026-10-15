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

  test('flags document.visibilityState access without VisibilityStateEntry', () => {
    const code = `
      function checkPageVisibility() {
        if (document.visibilityState === 'hidden') {
          console.log('Page loaded in background');
        }
      }
    `;
    const { matches } = scanJsSource(
      'analytics/visibility.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /VisibilityStateEntry/);
  });

  test('flags document.hidden access without VisibilityStateEntry', () => {
    const code = `
      function isHidden() {
        return document.hidden;
      }
    `;
    const { matches } = scanJsSource(
      'utils/hidden.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /VisibilityStateEntry/);
  });

  test('flags addEventListener("visibilitychange") listener', () => {
    const code = `
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          pauseVideo();
        }
      });
    `;
    const { matches } = scanJsSource(
      'media/video.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.ok(matches.length >= 1);
    assert.match(matches[0].message, /VisibilityStateEntry/);
  });

  test('flags vendor-prefixed webkitHidden', () => {
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
    assert.match(matches[0].message, /VisibilityStateEntry/);
  });

  test('ignores code when file references VisibilityStateEntry', () => {
    const code = `
      function getVisibilityInfo() {
        if ('VisibilityStateEntry' in window) {
          const entries = performance.getEntriesByType('visibility-state');
          return entries.length > 0 && entries[0].name === 'hidden';
        }
        return document.visibilityState === 'hidden';
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
