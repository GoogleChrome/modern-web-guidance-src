import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanCss, scanJsSource } from '../scanners/index.ts';
import {
  PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  preventPageScrollUnderModalDialogCssMatcher,
  preventPageScrollUnderModalDialogCssRule,
  preventPageScrollUnderModalDialogMatcher,
  preventPageScrollUnderModalDialogRule,
  preventPageScrollUnderModalDialogRules,
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

    assert.equal(preventPageScrollUnderModalDialogCssRule.id, 'prevent-page-scroll-under-modal-dialog/css');
    assert.equal(preventPageScrollUnderModalDialogCssRule.guideId, 'prevent-page-scroll-under-modal-dialog');
    assert.equal(
      preventPageScrollUnderModalDialogCssRule.guideHash,
      PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
    );
    assert.ok(preventPageScrollUnderModalDialogCssRule.phase2Rubric.dropWhen.length >= 2);
    assert.equal(preventPageScrollUnderModalDialogRules.length, 2);
  });

  test('flags document.body.style.overflow = "hidden" in modal open handler', () => {
    const code = `
      function showModalDialog() {
        document.body.style.overflow = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'ui/modal.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags document.documentElement.style.overflow = "hidden"', () => {
    const code = `
      function lockScroll() {
        document.documentElement.style.overflow = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'ui/lock.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags document.body.classList.add("modal-open")', () => {
    const code = `
      function openModal() {
        document.body.classList.add('modal-open');
      }
    `;
    const { matches } = scanJsSource(
      'modal/open.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /classList\.add/);
  });

  test('flags document.body.classList.add("no-scroll")', () => {
    const code = `
      function freezePage() {
        document.body.classList.add('no-scroll');
      }
    `;
    const { matches } = scanJsSource(
      'overlay/freeze.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /classList\.add/);
  });

  test('ignores fullscreen editor function toggle without modal/overlay', () => {
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

  test('flags CSS rule setting body.modal-open { overflow: hidden }', () => {
    const css = `
      body.modal-open {
        overflow: hidden;
      }
    `;
    const matches = scanCss('styles/modal.css', css, [
      preventPageScrollUnderModalDialogCssMatcher,
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('flags CSS rule setting .no-scroll { overflow-y: hidden }', () => {
    const css = `
      .no-scroll {
        overflow-y: hidden;
      }
    `;
    const matches = scanCss('styles/overlay.css', css, [
      preventPageScrollUnderModalDialogCssMatcher,
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overscroll-behavior/);
  });

  test('ignores CSS when stylesheet declares overscroll-behavior', () => {
    const css = `
      body.modal-open {
        overflow: hidden;
      }
      dialog:modal {
        overscroll-behavior: contain;
      }
    `;
    const matches = scanCss('styles/dialog.css', css, [
      preventPageScrollUnderModalDialogCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});
