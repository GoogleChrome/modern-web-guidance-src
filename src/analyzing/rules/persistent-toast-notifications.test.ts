import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  persistentToastNotificationsJsMatcher,
  persistentToastNotificationsJsRule,
  persistentToastNotificationsRules,
} from './persistent-toast-notifications.ts';

void test('persistent-toast-notifications: rule metadata', () => {
  assert.equal(PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH.length, 12);

  assert.equal(
    persistentToastNotificationsJsRule.id,
    'persistent-toast-notifications/js-toast',
  );
  assert.equal(
    persistentToastNotificationsJsRule.guideId,
    'persistent-toast-notifications',
  );
  assert.equal(
    persistentToastNotificationsJsRule.guideHash,
    PERSISTENT_TOAST_NOTIFICATIONS_GUIDE_HASH,
  );

  assert.equal(persistentToastNotificationsRules.length, 1);
  assert.ok(persistentToastNotificationsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(persistentToastNotificationsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('persistent-toast-notifications JS matcher', async (t) => {
  await t.test('flags global Toastify, Notyf, and toastr calls', () => {
    const project = createInMemoryProject();
    const code = `
      Toastify({ text: 'Saved!' }).showToast();
      const notyf = new Notyf();
      notyf.success('Profile updated');
      notyf.error('Network error');
      toastr.info('New message');
      toastr.warning('Low disk space');
    `;
    const sourceFile = project.createSourceFile('toasts.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'toasts.js',
      fileContent: code,
    });
    assert.equal(matches.length, 5);
  });

  await t.test('flags imported and required Toastify, Notyf, and toastr', () => {
    const project = createInMemoryProject();
    const code = `
      import Toastify from 'toastify-js';
      import { Notyf } from 'notyf';
      const toastr = require('toastr');

      const toast = Toastify({ text: 'Uploaded' });
      toast.showToast();
      new Notyf().success('Done');
      toastr.error('Failed');
    `;
    const sourceFile = project.createSourceFile('imported-toasts.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'imported-toasts.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts files already using popover="manual" or guarded by showPopover', () => {
    const project = createInMemoryProject();
    const code = `
      if (!('showPopover' in HTMLElement.prototype)) {
        Toastify({ text: 'Fallback toast' }).showToast();
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated logger.info or console.error calls and local shadowed symbols', () => {
    const project = createInMemoryProject();
    const code = `
      logger.info('Server started');
      apiResult.success('ok');
      function Toastify() { return { showToast() {} }; }
      Toastify().showToast();
      const { toastr } = customLogger;
      toastr.info('Custom log');
    `;
    const sourceFile = project.createSourceFile('unrelated.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'unrelated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts auto-dismiss timed toasts, progress bars, and toast queue managers (Area 2.3)', () => {
    const project = createInMemoryProject();
    const code = `
      import Toastify from 'toastify-js';
      import { Notyf } from 'notyf';
      import toastr from 'toastr';

      Toastify({ text: 'Auto dismiss', duration: 3000 }).showToast();
      new Notyf({ duration: 4000, ripple: true }).success('Timed');
      toastr.success('Saved', 'Title', { timeOut: 5000, progressBar: true });
    `;
    const sourceFile = project.createSourceFile('timed-queue.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'timed-queue.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
