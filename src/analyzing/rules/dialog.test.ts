import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  dialogJsMatcher
} from './dialog.ts';
void test('dialog: positive brownfield matches', async (t) => {
  await t.test('flags event.target === dialog backdrop click check', () => {
    const code = `
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
          dialog.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'modal.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags early return if event.target !== dialog', () => {
    const code = `
      dialog.addEventListener('click', (e) => {
        if (e.target !== dialog) return;
        dialog.close();
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'early-return.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags event.target.tagName === "DIALOG" check', () => {
    const code = `
      document.addEventListener('click', (e) => {
        if (e.target.tagName === 'DIALOG') {
          e.target.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'tagname.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags getBoundingClientRect coordinate bounds check', () => {
    const code = `
      dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
          dialog.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'coords.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags dialog.onclick assignment', () => {
    const code = `
      dialog.onclick = function(e) {
        if (e.target === this) {
          this.close();
        }
      };
    `;
    const matches = matchJsRule(dialogJsMatcher, 'onclick.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('flags outside click check using !dialog.contains(e.target)', () => {
    const code = `
      document.addEventListener('click', (event) => {
        if (!dialog.contains(event.target)) {
          dialog.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'contains.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags outside click check using !e.target.closest("dialog")', () => {
    const code = `
      document.addEventListener('click', (event) => {
        if (!event.target.closest('dialog')) {
          modal.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'closest-negated.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags modal.close() with event.target === modal', () => {
    const code = `
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.close();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'modal-backdrop.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags backdrop click listeners that close a dialog via helper methods or functions', () => {
    const code = `
      class ModalController {
        setup() {
          const editDialog = this.querySelector<HTMLDialogElement>('#edit-dialog');
          editDialog?.addEventListener('click', (e) => {
            if (e.target === editDialog) {
              this.closeEditModal();
            }
          });

          const confirmDialog = this.querySelector<HTMLDialogElement>('#confirm-dialog');
          confirmDialog?.addEventListener('click', (e) => {
            if (e.target === confirmDialog) {
              confirmDialog.close();
            }
          });

          const settingsDialog = this.querySelector<HTMLDialogElement>('#settings-dialog');
          settingsDialog?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
              this.handleDismiss();
            }
          });
        }
        closeEditModal() {}
        handleDismiss() {}
      }
    `;
    const matches = matchJsRule(dialogJsMatcher, 'helper-backdrop.ts', code);
    assert.deepEqual(
      matches.map((m) => m.line),
      [5, 12, 19],
    );
  });

  await t.test('flags backdrop click listener calling a standalone dismiss/close helper with no literal .close() in file', () => {
    const code = `
      confirmDialog.addEventListener('click', (e) => {
        if (e.target === confirmDialog) {
          dismissConfirmDialog();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'dismiss-only.js', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags backdrop click listener delegating to a same-file helper that calls .close()', () => {
    const code = `
      class Editor {
        setup() {
          const panel = this.querySelector('#editor');
          panel?.addEventListener('click', (e) => {
            if (e.target === panel) {
              this.resetAndHide();
            }
          });
        }
        resetAndHide() {
          this.dialog.close();
        }
      }
    `;
    const matches = matchJsRule(dialogJsMatcher, 'same-file-helper.ts', code);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });
});

void test('dialog: negative / exempt cases', async (t) => {
  await t.test('exempts when guarded by closedBy in HTMLDialogElement.prototype', () => {
    const code = `
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target === dialog) {
            dialog.close();
          }
        });
      }
    `;
    const matches = matchJsRule(dialogJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts close button click listener', () => {
    const code = `
      closeBtn.addEventListener('click', () => {
        dialog.close();
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'button.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dialog close event listener', () => {
    const code = `
      dialog.addEventListener('close', () => {
        cleanupModal();
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'close-event.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-dialog closest("dialog") close button loops', () => {
    const code = `
      btn.addEventListener('click', (e) => {
        const dialog = e.target.closest('dialog');
        if (dialog) dialog.close();
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'close-btn.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts positive dialog.contains(event.target) click listener', () => {
    const code = `
      document.addEventListener('click', (event) => {
        if (dialog.contains(event.target)) {
          highlightDialog(dialog);
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'inside-click.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-dialog menu/popover backdrop listeners calling non-dialog close helpers', () => {
    const code = `
      menu.addEventListener('click', (e) => {
        if (e.target === menu) {
          closeMenu();
        }
      });
      dropdown.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          dismissDropdown();
        }
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'menu-backdrop.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts close button listener calling a close helper', () => {
    const code = `
      cancelBtn.addEventListener('click', () => {
        this.closeEditModal();
      });
    `;
    const matches = matchJsRule(dialogJsMatcher, 'cancel-btn.js', code);
    assert.equal(matches.length, 0);
  });
});
