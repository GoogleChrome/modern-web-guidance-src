import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  LIGHT_DISMISS_A_DIALOG_GUIDE_HASH,
  lightDismissADialogJsMatcher,
  lightDismissADialogRule,
  lightDismissADialogRules,
} from './light-dismiss-a-dialog.ts';

void test('light-dismiss-a-dialog: rule metadata', () => {
  assert.equal(lightDismissADialogRule.id, 'light-dismiss-a-dialog');
  assert.equal(lightDismissADialogRule.guideId, 'light-dismiss-a-dialog');
  assert.equal(lightDismissADialogRule.guideHash, LIGHT_DISMISS_A_DIALOG_GUIDE_HASH);
  assert.equal(LIGHT_DISMISS_A_DIALOG_GUIDE_HASH.length, 12);
  assert.equal(lightDismissADialogRules.length, 1);
  assert.ok(lightDismissADialogRule.verifierRubric.keepWhen.length > 0);
  assert.ok(lightDismissADialogRule.verifierRubric.dropWhen.length >= 2);
});

void test('light-dismiss-a-dialog: positive brownfield matches', async (t) => {
  await t.test('flags event.target === dialog backdrop click check', () => {
    const project = createInMemoryProject();
    const code = `
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
          dialog.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('modal.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'modal.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags early return if event.target !== dialog', () => {
    const project = createInMemoryProject();
    const code = `
      dialog.addEventListener('click', (e) => {
        if (e.target !== dialog) return;
        dialog.close();
      });
    `;
    const sourceFile = project.createSourceFile('early-return.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'early-return.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags event.target.tagName === "DIALOG" check', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('click', (e) => {
        if (e.target.tagName === 'DIALOG') {
          e.target.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('tagname.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'tagname.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags getBoundingClientRect coordinate bounds check', () => {
    const project = createInMemoryProject();
    const code = `
      dialog.addEventListener('click', (e) => {
        const rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
          dialog.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('coords.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'coords.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags dialog.onclick assignment', () => {
    const project = createInMemoryProject();
    const code = `
      dialog.onclick = function(e) {
        if (e.target === this) {
          this.close();
        }
      };
    `;
    const sourceFile = project.createSourceFile('onclick.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'onclick.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags outside click check using !dialog.contains(e.target)', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('click', (event) => {
        if (!dialog.contains(event.target)) {
          dialog.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('contains.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'contains.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags outside click check using !e.target.closest("dialog")', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('click', (event) => {
        if (!event.target.closest('dialog')) {
          modal.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('closest-negated.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'closest-negated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });

  await t.test('flags modal.close() with event.target === modal', () => {
    const project = createInMemoryProject();
    const code = `
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('modal-backdrop.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'modal-backdrop.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /closedby="any"/);
  });
});

void test('light-dismiss-a-dialog: negative / exempt cases', async (t) => {
  await t.test('exempts when guarded by closedBy in HTMLDialogElement.prototype', () => {
    const project = createInMemoryProject();
    const code = `
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target === dialog) {
            dialog.close();
          }
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts close button click listener', () => {
    const project = createInMemoryProject();
    const code = `
      closeBtn.addEventListener('click', () => {
        dialog.close();
      });
    `;
    const sourceFile = project.createSourceFile('button.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'button.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dialog close event listener', () => {
    const project = createInMemoryProject();
    const code = `
      dialog.addEventListener('close', () => {
        cleanupModal();
      });
    `;
    const sourceFile = project.createSourceFile('close-event.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'close-event.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-dialog closest("dialog") close button loops', () => {
    const project = createInMemoryProject();
    const code = `
      btn.addEventListener('click', (e) => {
        const dialog = e.target.closest('dialog');
        if (dialog) dialog.close();
      });
    `;
    const sourceFile = project.createSourceFile('close-btn.js', code);
    const matches = lightDismissADialogJsMatcher.matchFile(sourceFile, {
      filePath: 'close-btn.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
