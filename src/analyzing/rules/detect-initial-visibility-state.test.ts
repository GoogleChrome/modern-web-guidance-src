import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH,
  detectInitialVisibilityStateMatcher,
  detectInitialVisibilityStateRule,
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
  });

  test('flags direct access to document.webkitHidden', () => {
    const code = `
      function isPageHidden() {
        return document.webkitHidden;
      }
    `;
    const { matches } = scanJsSource(
      'utils/page-state.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /webkitHidden/);
  });

  test('flags standalone "webkitHidden" in document check', () => {
    const code = `
      const isIOS7 = isIOS && "webkitHidden" in document;
    `;
    const { matches } = scanJsSource(
      'compat/browser.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /webkitHidden/);
  });

  test('flags standalone webkitvisibilitychange listener', () => {
    const code = `
      document.addEventListener('webkitvisibilitychange', () => {
        if (document.webkitHidden) {
          pauseAudio();
        }
      });
    `;
    const { matches } = scanJsSource(
      'audio/player.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.ok(matches.length >= 1);
    assert.match(matches[0].message, /webkitvisibilitychange|webkitHidden/);
  });

  test('flags vendor property when placed as primary branch before standard', () => {
    const code = `
      function checkHidden() {
        return document.webkitHidden || document.hidden;
      }
    `;
    const { matches } = scanJsSource(
      'views/visibility.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /webkitHidden/);
  });

  test('ignores vendor property when paired as secondary fallback in logical OR', () => {
    const code = `
      function checkHidden() {
        return document.hidden || document.webkitHidden;
      }
    `;
    const { matches } = scanJsSource(
      'utils/safe-visibility.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores vendor property ladder when standard is primary branch in ternary', () => {
    const code = `
      var hiddenProperty = 'hidden' in document ? 'hidden' :
        'webkitHidden' in document ? 'webkitHidden' :
        'mozHidden' in document ? 'mozHidden' :
        null;
    `;
    const { matches } = scanJsSource(
      'spike.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores vendor property in else-branch of standard feature check', () => {
    const code = `
      function getVis() {
        if ('hidden' in document) {
          return document.hidden;
        } else if ('webkitHidden' in document) {
          return document.webkitHidden;
        }
        return false;
      }
    `;
    const { matches } = scanJsSource(
      'compat/vis.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores webkitHidden on custom non-document object', () => {
    const code = `
      const config = { webkitHidden: true };
      if (config.webkitHidden) {
        doSomething();
      }
    `;
    const { matches } = scanJsSource(
      'models/config.js',
      code,
      [detectInitialVisibilityStateMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
