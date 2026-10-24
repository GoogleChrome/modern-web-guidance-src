import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  PLATFORM_CONTROLS_DISMISS_DIALOG_GUIDE_HASH,
  platformControlsDismissDialogJsMatcher,
  platformControlsDismissDialogRule,
  platformControlsDismissDialogRules,
} from './platform-controls-dismiss-dialog.ts';

void test('platform-controls-dismiss-dialog: rule metadata', () => {
  assert.equal(platformControlsDismissDialogRule.id, 'platform-controls-dismiss-dialog');
  assert.equal(platformControlsDismissDialogRule.guideId, 'platform-controls-dismiss-dialog');
  assert.equal(
    platformControlsDismissDialogRule.guideHash,
    PLATFORM_CONTROLS_DISMISS_DIALOG_GUIDE_HASH,
  );
  assert.equal(PLATFORM_CONTROLS_DISMISS_DIALOG_GUIDE_HASH.length, 12);
  assert.equal(platformControlsDismissDialogRules.length, 1);
  assert.ok(platformControlsDismissDialogRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(platformControlsDismissDialogRule.phase2Rubric.dropWhen.length >= 2);
});

void test('platform-controls-dismiss-dialog: positive brownfield matches', async (t) => {
  await t.test('flags window.addEventListener("keydown") checking event.key === "Escape"', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });
    `;
    const sourceFile = project.createSourceFile('modal-esc.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'modal-esc.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /Escape/);
  });

  await t.test('flags keydown checking event.keyCode === 27 calling dialog.close()', () => {
    const project = createInMemoryProject();
    const code = `
      document.addEventListener('keydown', (e) => {
        if (e.keyCode === 27) {
          dialog.close();
        }
      });
    `;
    const sourceFile = project.createSourceFile('dialog-esc.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'dialog-esc.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags window.addEventListener("popstate") dismissing modal dialog', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('popstate', (event) => {
        if (modal.classList.contains('active')) {
          modal.classList.remove('active');
        }
      });
    `;
    const sourceFile = project.createSourceFile('popstate-dismiss.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'popstate-dismiss.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /popstate/);
  });

  await t.test('flags switch case on keyCode 27 dismissing drawer', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('keydown', (e) => {
        switch (e.keyCode) {
          case 27:
            drawer.classList.remove('open');
            break;
        }
      });
    `;
    const sourceFile = project.createSourceFile('switch-esc.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'switch-esc.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags document.onkeydown assignment dismissing modal', () => {
    const project = createInMemoryProject();
    const code = `
      document.onkeydown = function(e) {
        if (e.key === 'Escape') {
          hideModal();
        }
      };
    `;
    const sourceFile = project.createSourceFile('onkeydown.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'onkeydown.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('platform-controls-dismiss-dialog: negative / exempt cases', async (t) => {
  await t.test('exempts keydown handler guarded by CloseWatcher', () => {
    const project = createInMemoryProject();
    const code = `
      if (!('CloseWatcher' in window)) {
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            closeModal();
          }
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts keydown handler checking ArrowDown or Enter (not Escape)', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitForm();
        }
      });
    `;
    const sourceFile = project.createSourceFile('enter.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'enter.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts popstate listener for page routing without modal dismiss', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('popstate', (event) => {
        renderPage(window.location.pathname);
      });
    `;
    const sourceFile = project.createSourceFile('router.js', code);
    const matches = platformControlsDismissDialogJsMatcher.matchFile(sourceFile, {
      filePath: 'router.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
