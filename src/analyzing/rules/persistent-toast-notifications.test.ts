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
  assert.ok(persistentToastNotificationsJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(persistentToastNotificationsJsRule.verifierRubric.dropWhen.length >= 2);
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

  await t.test('flags toastr where popover plus JS timer preserves behavior', () => {
    const project = createInMemoryProject();
    const code = `
      import toastr from 'toastr';
      toastr.success('Saved', 'Title', { timeOut: 3000 });
      toastr.info('Simple notification');
    `;
    const sourceFile = project.createSourceFile('timed-toastr.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'timed-toastr.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts progress bars, queue options, and interactive Toastify options', () => {
    const project = createInMemoryProject();
    const code = `
      import toastr from 'toastr';
      import Toastify from 'toastify-js';
      toastr.success('Saved', 'Title', { progressBar: true });
      toastr.error('Failed', 'Error', { preventDuplicates: true });
      Toastify({ text: 'Open', onClick: () => openDetails() }).showToast();
      Toastify({ text: 'Docs', destination: 'https://example.com', newWindow: true }).showToast();
      Toastify({ text: 'Done', callback: () => cleanup() }).showToast();
    `;
    const sourceFile = project.createSourceFile('interactive-toasts.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'interactive-toasts.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags hand-rolled toasts with structural second signals (body append or fixed/viewport positioning)', () => {
    const project = createInMemoryProject();
    const code = `
      $("<div>Saved</div>").appendTo("body").fadeIn(300).delay(2000).fadeOut(300);
      $("<div>Copied</div>").css({ position: "fixed", bottom: "16px", right: "16px" }).fadeIn(200).delay(1500).fadeOut(200);
    `;
    const sourceFile = project.createSourceFile('hand-rolled.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'hand-rolled.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts stop().fadeIn().fadeOut(), name-only toasts, and synchronous show/hide layout measurements', () => {
    const project = createInMemoryProject();
    const code = `
      $el.stop().fadeIn().fadeOut();
      $("#hero-banner").fadeIn(300).delay(2000).fadeOut(300);
      $(".dropdown-menu").slideDown(200).slideUp(200);
      $("<div class='toast'>").fadeIn(200).delay(1000).fadeOut(200);
      $("<div class='notification'>").appendTo(document.body);
      this.$menu.show().css({ position: "absolute", left: 0, top: 0 }).hide();
    `;
    const sourceFile = project.createSourceFile('non-toast-animations.js', code);
    const matches = persistentToastNotificationsJsMatcher.matchFile(sourceFile, {
      filePath: 'non-toast-animations.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
