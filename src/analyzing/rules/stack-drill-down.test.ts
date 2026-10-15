import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  STACK_DRILL_DOWN_GUIDE_HASH,
  stackDrillDownMatcher,
  stackDrillDownRule,
} from './stack-drill-down.ts';

describe('stack-drill-down rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(stackDrillDownRule.id, 'stack-drill-down');
    assert.equal(stackDrillDownRule.guideId, 'stack-drill-down');
    assert.equal(stackDrillDownRule.guideHash, STACK_DRILL_DOWN_GUIDE_HASH);
    assert.equal(stackDrillDownRule.guideHash.length, 12);
    assert.ok(stackDrillDownRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(stackDrillDownRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags querySelectorAll forEach loop setting tabIndex = -1 and aria-hidden', () => {
    const code = `
      function deactivateBackgroundPanels() {
        document.querySelectorAll('.app-panel').forEach(panel => {
          panel.tabIndex = -1;
          panel.setAttribute('aria-hidden', 'true');
        });
      }
    `;
    const { matches } = scanJsSource(
      'ui/panels.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /inert/);
  });

  test('flags for..of loop deactivating background views', () => {
    const code = `
      function pushView(newView, allViews) {
        for (const view of allViews) {
          if (view !== newView) {
            view.setAttribute('aria-hidden', 'true');
            view.tabIndex = -1;
          }
        }
      }
    `;
    const { matches } = scanJsSource(
      'nav/stack.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /inert/);
  });

  test('flags siblings forEach loop setting aria-hidden = true', () => {
    const code = `
      function trapModalFocus(modal, siblings) {
        siblings.forEach(sibling => {
          sibling.setAttribute('aria-hidden', 'true');
        });
      }
    `;
    const { matches } = scanJsSource(
      'modal/trap.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /inert/);
  });

  test('ignores decorative SVG/canvas loops setting aria-hidden', () => {
    const code = `
      function hideDecorativeIcons(svgIcons) {
        svgIcons.forEach(svg => {
          svg.setAttribute('aria-hidden', 'true');
        });
      }
    `;
    const { matches } = scanJsSource(
      'icons/render.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores single-element tabIndex = -1 (devtools canary 2547b2ba6d74)', () => {
    const code = `
      function createHiddenFileInput() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.tabIndex = -1;
        fileInput.style.display = 'none';
        return fileInput;
      }
    `;
    const { matches } = scanJsSource(
      'front_end/ui/UIUtils.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores single container tabIndex = -1 (audiomass multitrack pattern)', () => {
    const code = `
      function initAudioTrack(el) {
        const main = el.getElementsByClassName('pk_mt_main')[0];
        main.tabIndex = -1;
      }
    `;
    const { matches } = scanJsSource(
      'audio/multitrack.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores roving tabIndex on tablist items', () => {
    const code = `
      function selectTab(selectedTab, tabs) {
        tabs.forEach(tab => {
          const isSelected = tab === selectedTab;
          tab.tabIndex = isSelected ? 0 : -1;
        });
      }
    `;
    const { matches } = scanJsSource(
      'components/tabs.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores background loop when guarded by inert feature detection', () => {
    const code = `
      function deactivateSiblings(siblings) {
        if ('inert' in HTMLElement.prototype) {
          siblings.forEach(s => { s.inert = true; });
        } else {
          siblings.forEach(s => {
            s.setAttribute('aria-hidden', 'true');
            s.tabIndex = -1;
          });
        }
      }
    `;
    const { matches } = scanJsSource(
      'ui/guarded-inert.js',
      code,
      [stackDrillDownMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
