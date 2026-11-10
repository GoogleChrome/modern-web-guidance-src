import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import {
  declarativeDialogPopoverControlClickListenerMatcher,
} from './declarative-dialog-popover-control.ts';

const jsRules: readonly JsRuleMatcher[] = [declarativeDialogPopoverControlClickListenerMatcher];

describe('declarativeDialogPopoverControlClickListenerRule (AST)', () => {
  it('flags addEventListener("click", () => dialog.showModal())', () => {
    const js = `
      const openBtn = document.querySelector('#open');
      const dialog = document.querySelector('#dlg');
      openBtn.addEventListener('click', () => {
        dialog.showModal();
      });
    `;
    const { matches } = scanJsSource('modal.js', js, jsRules);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  it('flags addEventListener("click", () => popover.togglePopover())', () => {
    const js = `
      btn.addEventListener('click', () => popover.togglePopover());
    `;
    const { matches } = scanJsSource('popover.js', js, jsRules);
    assert.equal(matches.length, 1);
  });

  it('flags pure click listener with preventDefault and local getElementById lookup', () => {
    const js = `
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('settings-modal');
        modal.showModal();
      });
    `;
    const { matches } = scanJsSource('settings.js', js, jsRules);
    assert.equal(matches.length, 1);
  });

  it('ignores jQuery $(btn).on("click", () => $("#modal").modal("show"))', () => {
    const js = `
      $('#open-btn').on('click', function () {
        $('#my-modal').modal('show');
      });
    `;
    const { matches } = scanJsSource('legacy.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores dialog.close("confirm") when passing a returnValue argument', () => {
    const js = `
      confirmBtn.addEventListener('click', () => {
        dialog.close('confirm');
      });
    `;
    const { matches } = scanJsSource('confirm.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores click listeners with side effects like fetch() or classList.add()', () => {
    const js = `
      openBtn.addEventListener('click', () => {
        fetch('/api/analytics');
        dialog.showModal();
      });
      menuBtn.addEventListener('click', () => {
        menuBtn.classList.add('is-active');
        popover.togglePopover();
      });
    `;
    const { matches } = scanJsSource('impure.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores non-click event listeners calling showModal', () => {
    const js = `
      window.addEventListener('keydown', () => {
        dialog.showModal();
      });
    `;
    const { matches } = scanJsSource('keys.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores click listeners that do not call dialog/popover methods', () => {
    const js = `
      btn.addEventListener('click', () => {
        console.log('clicked');
      });
    `;
    const { matches } = scanJsSource('log.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores click listeners on document, window, overlay, or the dialog itself', () => {
    const js = `
      overlay.addEventListener('click', () => dialog.close());
      document.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', () => dialog.close());
    `;
    const { matches } = scanJsSource('backdrop.js', js, jsRules);
    assert.equal(matches.length, 0);
  });

  it('ignores event.data.dialog and custom class instances constructed with new', () => {
    const js = `
      $container.on('click', { dialog: this }, function(event) {
        event.data.dialog.close();
      });
      const audioProcessingModal = new AudioProcessingModal();
      openModalBtn.addEventListener('click', () => {
        audioProcessingModal.showModal();
      });
    `;
    const { matches } = scanJsSource('exempt-patterns.js', js, jsRules);
    assert.equal(matches.length, 0);
  });
});
