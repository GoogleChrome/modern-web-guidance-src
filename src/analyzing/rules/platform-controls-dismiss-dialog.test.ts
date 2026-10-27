import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  platformControlsDismissDialogJsMatcher
} from './platform-controls-dismiss-dialog.ts';
void test('platform-controls-dismiss-dialog: positive brownfield matches', async (t) => {
  await t.test('flags window.addEventListener("keydown") checking event.key === "Escape"', () => {
    const code = `
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'modal-esc.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /Escape/);
  });

  await t.test('flags keydown checking event.keyCode === 27 calling dialog.close()', () => {
    const code = `
      document.addEventListener('keydown', (e) => {
        if (e.keyCode === 27) {
          dialog.close();
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'dialog-esc.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags window.addEventListener("popstate") dismissing modal dialog', () => {
    const code = `
      window.addEventListener('popstate', (event) => {
        if (modal.classList.contains('active')) {
          modal.classList.remove('active');
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'popstate-dismiss.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /popstate/);
  });

  await t.test('flags switch case on keyCode 27 dismissing drawer', () => {
    const code = `
      window.addEventListener('keydown', (e) => {
        switch (e.keyCode) {
          case 27:
            drawer.classList.remove('open');
            break;
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'switch-esc.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags document.onkeydown assignment dismissing modal', () => {
    const code = `
      document.onkeydown = function(e) {
        if (e.key === 'Escape') {
          hideModal();
        }
      };
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'onkeydown.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('platform-controls-dismiss-dialog: negative / exempt cases', async (t) => {
  await t.test('exempts keydown handler guarded by CloseWatcher', () => {
    const code = `
      if (!('CloseWatcher' in window)) {
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            closeModal();
          }
        });
      }
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts keydown handler checking ArrowDown or Enter (not Escape)', () => {
    const code = `
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitForm();
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'enter.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Escape key listener closing websocket or audio context', () => {
    const code = `
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          socket.close();
        }
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'websocket.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts popstate listener for page routing without modal dismiss', () => {
    const code = `
      window.addEventListener('popstate', (event) => {
        renderPage(window.location.pathname);
      });
    `;
    const matches = matchJsRule(platformControlsDismissDialogJsMatcher, 'router.js', code);
    assert.equal(matches.length, 0);
  });
});
