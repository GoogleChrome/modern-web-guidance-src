import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanCss, scanJsSource, scanPackageJson } from '../scanners/index.ts';
import preventPageScrollUnderModalDialogRules, {
  PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
  preventPageScrollUnderModalDialogCssMatcher,
  preventPageScrollUnderModalDialogCssRule,
  preventPageScrollUnderModalDialogDependencyMatcher,
  preventPageScrollUnderModalDialogDependencyRule,
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
    assert.ok(preventPageScrollUnderModalDialogRule.verifierRubric.keepWhen.length >= 2);
    assert.ok(preventPageScrollUnderModalDialogRule.verifierRubric.dropWhen.length >= 2);

    assert.equal(preventPageScrollUnderModalDialogCssRule.id, 'prevent-page-scroll-under-modal-dialog/css');
    assert.equal(preventPageScrollUnderModalDialogCssRule.guideId, 'prevent-page-scroll-under-modal-dialog');
    assert.equal(
      preventPageScrollUnderModalDialogCssRule.guideHash,
      PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
    );
    assert.ok(preventPageScrollUnderModalDialogCssRule.verifierRubric.dropWhen.length >= 2);

    assert.equal(
      preventPageScrollUnderModalDialogDependencyRule.id,
      'prevent-page-scroll-under-modal-dialog/package-scroll-lock',
    );
    assert.equal(
      preventPageScrollUnderModalDialogDependencyRule.guideId,
      'prevent-page-scroll-under-modal-dialog',
    );
    assert.equal(
      preventPageScrollUnderModalDialogDependencyRule.guideHash,
      PREVENT_PAGE_SCROLL_UNDER_MODAL_DIALOG_GUIDE_HASH,
    );
    assert.ok(preventPageScrollUnderModalDialogDependencyRule.verifierRubric.dropWhen.length >= 2);
    assert.equal(preventPageScrollUnderModalDialogRules.length, 3);
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

  test('flags document.documentElement.style.overflow = "hidden" with prefix camelCase modal cue', () => {
    const code = `
      function syncViewport(modalOpen) {
        if (modalOpen) {
          document.documentElement.style.overflow = 'hidden';
        }
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

  test('flags camelCase modal handler setting document.body.style.overflowY = "hidden"', () => {
    const code = `
      const checkMobileAuth = () => {
        setShowMobileModal(true);
        document.body.style.overflowY = 'hidden';
      };
    `;
    const { matches } = scanJsSource(
      'src/components/Navbar.jsx',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /overflowY = 'hidden'/);
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

  test('ignores fullscreen canvas game toggle even in file with overlay in path', () => {
    const code = `
      function enterFullscreenCanvasGame() {
        document.body.style.overflow = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'components/overlay/canvas-game.js',
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

  test('flags disableBodyScroll and enableBodyScroll calls', () => {
    const code = `
      import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock';
      function openModal(modalEl) {
        disableBodyScroll(modalEl);
      }
      function closeModal(modalEl) {
        enableBodyScroll(modalEl);
      }
    `;
    const { matches } = scanJsSource(
      'src/modal.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 2);
    assert.match(matches[0].message, /disableBodyScroll/);
    assert.match(matches[1].message, /enableBodyScroll/);
  });

  test('exempts generic .overflow-hidden and .no-scroll utility classes without body/html or modal context', () => {
    const css = `
      .overflow-hidden {
        overflow: hidden;
      }
      .card .no-scroll {
        overflow: hidden;
      }
      .no-scroll {
        overflow: hidden;
        -ms-overflow-style: none;
      }
      .no-scroll-y {
        overflow-y: hidden;
      }
    `;
    const matches = scanCss('styles/utilities.css', css, [
      preventPageScrollUnderModalDialogCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });

  test('exempts horizontal overflowX = "hidden" and top-level IIFE context smearing', () => {
    const code = `
      (function () {
        const label = 'debug overlay';
        function restoreHorizontalClip() {
          document.body.style.overflowX = 'hidden';
        }
        function enterBlockingDebugger() {
          document.body.style.overflow = 'hidden';
        }
        return [label, restoreHorizontalClip, enterBlockingDebugger];
      })();
    `;
    const { matches } = scanJsSource(
      'src/runtime.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('exempts unrelated functions setting body overflow even if <dialog> exists elsewhere in file', () => {
    const code = `
      function renderDialogMarkup() {
        return '<dialog id="feedback">Feedback</dialog>';
      }

      function handleWindowResize() {
        document.body.style.overflow = 'hidden';
      }
    `;
    const { matches } = scanJsSource(
      'utils/layout.js',
      code,
      [preventPageScrollUnderModalDialogMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('exempts self-referential lockScroll / scroll-lock utilities, descendant CSS selectors, and PerfectScrollbar layout hooks', () => {
    const genericScrollUtil = `
      export function lockScroll(open) {
        if (open) {
          document.documentElement.style.overflow = 'hidden';
        }
      }
      export function addBodyScrollLock() {
        document.body.classList.add('scroll-lock');
      }
      export function updateModalityState() {
        document.body.style.overflow = 'hidden';
      }
    `;
    assert.equal(
      scanJsSource(
        'assets/js/mixins/miscellaneous.js',
        genericScrollUtil,
        [preventPageScrollUnderModalDialogMatcher],
        project,
      ).matches.length,
      0,
    );

    const rtlLayoutCode = `
      import React from 'react';
      import PerfectScrollbar from 'perfect-scrollbar';
      import Sidebar from 'components/Sidebar/Sidebar.js';

      export default function RTL() {
        const [mobileOpen, setMobileOpen] = React.useState(false);
        const handleDrawerToggle = () => {
          setMobileOpen(!mobileOpen);
        };
        React.useEffect(() => {
          const ps = new PerfectScrollbar(document.body);
          document.body.style.overflow = 'hidden';
          return () => ps.destroy();
        }, []);
        return <Sidebar open={mobileOpen} handleDrawerToggle={handleDrawerToggle} />;
      }
    `;
    assert.equal(
      scanJsSource(
        'layouts/RTL.js',
        rtlLayoutCode,
        [preventPageScrollUnderModalDialogMatcher],
        project,
      ).matches.length,
      0,
    );

    const descendantModalCss = `
      body.modal-open .modal-content {
        overflow: hidden;
      }
      .no-scroll > .inner-panel {
        overflow: hidden;
      }
      body.modal-open::before {
        overflow: hidden;
      }
    `;
    assert.equal(
      scanCss('styles/modal.css', descendantModalCss, [
        preventPageScrollUnderModalDialogCssMatcher,
      ]).length,
      0,
    );

    const scrollLockUtilityCss = `
      .scroll-lock {
        overflow: hidden;
      }
    `;
    assert.equal(
      scanCss('styles/layout.css', scrollLockUtilityCss, [
        preventPageScrollUnderModalDialogCssMatcher,
      ]).length,
      0,
    );
  });

  test('flags package.json dependencies on scroll lock packages', () => {
    const pkgJson = JSON.stringify({
      dependencies: {
        'body-scroll-lock': '^4.0.0-beta.0',
        'scroll-lock': '^2.1.5',
      },
      peerDependencies: {
        'no-scroll': '^2.1.1',
      },
    });
    const matches = scanPackageJson('package.json', pkgJson, [
      preventPageScrollUnderModalDialogDependencyMatcher,
    ]);
    assert.equal(matches.length, 3);
    assert.match(matches[0].message, /body-scroll-lock/);
  });

  test('exempts non-modal disableBodyScroll and drawer/sliding-pane effects while flagging React modal useEffect with keydown and class Modal methods', () => {
    const nonModalDisableScroll = `
      function openMobileMenu() {
        overlay.style.transitionDuration = '400ms';
        disableBodyScroll(menuTopNav);
      }
    `;
    assert.equal(
      scanJsSource(
        'src/main.js',
        nonModalDisableScroll,
        [preventPageScrollUnderModalDialogMatcher],
        project,
      ).matches.length,
      0,
    );

    const drawerEffectCode = `
      const Wrap = () => {
        useEffect(() => {
          if (isOpen) {
            document.body.style.overflow = 'hidden';
          }
        }, [isOpen]);
        return <Drawer placement="bottom" isOpen={isOpen} />;
      };
    `;
    assert.equal(
      scanJsSource(
        'apps/app/components/Subscription/preview.tsx',
        drawerEffectCode,
        [preventPageScrollUnderModalDialogMatcher],
        project,
      ).matches.length,
      0,
    );

    const reactModalWithKeydownAndClassModal = `
      export function ModalDialog({ isOpen }) {
        useEffect(() => {
          if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', onEscape);
          }
        }, [isOpen]);
        return null;
      }
      export class CustomDialog {
        async openModal() {
          document.body.classList.add('modal-open');
        }
      }
    `;
    assert.equal(
      scanJsSource(
        'src/components/Modal/index.js',
        reactModalWithKeydownAndClassModal,
        [preventPageScrollUnderModalDialogMatcher],
        project,
      ).matches.length,
      2,
    );
  });
});
