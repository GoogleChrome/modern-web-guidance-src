import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  lightDismissADialogJsMatcher
} from './light-dismiss-a-dialog.ts';
void test('light-dismiss-a-dialog: positive brownfield matches', async (t) => {
  await t.test('flags event.target === dialog backdrop click check', () => {
    const code = `
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
          dialog.close();
        }
      });
    `;
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'modal.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'early-return.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'tagname.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'coords.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'onclick.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'contains.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'closest-negated.js', code);
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'modal-backdrop.js', code);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });
});

void test('light-dismiss-a-dialog: negative / exempt cases', async (t) => {
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
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts close button click listener', () => {
    const code = `
      closeBtn.addEventListener('click', () => {
        dialog.close();
      });
    `;
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'button.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dialog close event listener', () => {
    const code = `
      dialog.addEventListener('close', () => {
        cleanupModal();
      });
    `;
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'close-event.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-dialog closest("dialog") close button loops', () => {
    const code = `
      btn.addEventListener('click', (e) => {
        const dialog = e.target.closest('dialog');
        if (dialog) dialog.close();
      });
    `;
    const matches = matchJsRule(lightDismissADialogJsMatcher, 'close-btn.js', code);
    assert.equal(matches.length, 0);
  });
});
