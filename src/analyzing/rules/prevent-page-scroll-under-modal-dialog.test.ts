import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  preventPageScrollUnderModalDialogMatcher,
  preventPageScrollUnderModalDialogRule,
} from './prevent-page-scroll-under-modal-dialog.ts';

describe('prevent-page-scroll-under-modal-dialog rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(preventPageScrollUnderModalDialogRule.id, 'prevent-page-scroll-under-modal-dialog');
    assert.equal(preventPageScrollUnderModalDialogRule.guideId, 'prevent-page-scroll-under-modal-dialog');
    assert.equal(
      preventPageScrollUnderModalDialogRule.guideHash,
      PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
    );
    assert.equal(preventPageScrollUnderModalDialogRule.guideHash.length, 12);
    assert.ok(preventPageScrollUnderModalDialogRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(preventPageScrollUnderModalDialogRule.phase2Rubric.dropWhen.length >= 2);
  });

  test('flags document.body.style.overflow = "hidden" in Modal component', () => {
    const code = `
      class Modal {
        componentDidMount() {
          if (this.props.isOpen) {
            document.body.style.overflow = 'hidden';
          }
        }
      }
    `;
    const { matches } = scanJsSource(
      'components/Modal/index.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags document.documentElement.style.overflow = "hidden" in openDialog handler', () => {
    const code = `
      function openDialog(dialogId) {
        document.documentElement.style.overflow = 'hidden';
        showOverlay(dialogId);
      }
    `;
    const { matches } = scanJsSource(
      'ui/dialog.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags document.body.style.overflowY = "hidden" in overlay manager', () => {
    const code = `
      export function lockScrollForOverlay() {
        document.body.style.overflowY = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'utils/overlay-scroll.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags setProperty("overflow", "hidden") in popup trigger', () => {
    const code = `
      function showPopup(popup) {
        document.body.style.setProperty('overflow', 'hidden');
        popup.classList.add('visible');
      }
    `;
    const { matches } = scanJsSource(
      'ui/popup.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('ignores fullscreen editor addon without modal/overlay context', () => {
    const code = `
      function toggleFullScreen(editor) {
        if (!editor.state.fullScreen) {
          document.documentElement.style.overflow = 'hidden';
          editor.state.fullScreen = true;
        }
      }
    `;
    const { matches } = scanJsSource(
      'vendor/codemirror/addon/display/fullscreen.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores internal element overflow manipulation', () => {
    const code = `
      function truncateCard(cardElement) {
        cardElement.style.overflow = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'components/card.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('ignores overflow assignment to "auto" or "" (unlocking)', () => {
    const code = `
      function closeModal() {
        document.body.style.overflow = '';
      }
    `;
    const { matches } = scanJsSource(
      'components/modal.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
