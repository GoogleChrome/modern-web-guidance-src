import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  persistentToastNotificationsJsMatcher
} from './persistent-toast-notifications.ts';
void test('persistent-toast-notifications JS matcher', async (t) => {
  await t.test('flags global Toastify, Notyf, and toastr calls', () => {
    const code = `
      Toastify({ text: 'Saved!' }).showToast();
      const notyf = new Notyf();
      notyf.success('Profile updated');
      notyf.error('Network error');
      toastr.info('New message');
      toastr.warning('Low disk space');
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'toasts.js', code);
    assert.equal(matches.length, 5);
  });

  await t.test('flags imported and required Toastify, Notyf, and toastr', () => {
    const code = `
      import Toastify from 'toastify-js';
      import { Notyf } from 'notyf';
      const toastr = require('toastr');

      const toast = Toastify({ text: 'Uploaded' });
      toast.showToast();
      new Notyf().success('Done');
      toastr.error('Failed');
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'imported-toasts.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts files already using popover="manual" or guarded by showPopover', () => {
    const code = `
      if (!('showPopover' in HTMLElement.prototype)) {
        Toastify({ text: 'Fallback toast' }).showToast();
      }
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated logger.info or console.error calls and local shadowed symbols', () => {
    const code = `
      logger.info('Server started');
      apiResult.success('ok');
      function Toastify() { return { showToast() {} }; }
      Toastify().showToast();
      const { toastr } = customLogger;
      toastr.info('Custom log');
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'unrelated.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags toastr where popover plus JS timer preserves behavior', () => {
    const code = `
      import toastr from 'toastr';
      toastr.success('Saved', 'Title', { timeOut: 3000 });
      toastr.info('Simple notification');
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'timed-toastr.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts progress bars, queue options, and interactive Toastify options', () => {
    const code = `
      import toastr from 'toastr';
      import Toastify from 'toastify-js';
      toastr.success('Saved', 'Title', { progressBar: true });
      toastr.error('Failed', 'Error', { preventDuplicates: true });
      Toastify({ text: 'Open', onClick: () => openDetails() }).showToast();
      Toastify({ text: 'Docs', destination: 'https://example.com', newWindow: true }).showToast();
      Toastify({ text: 'Done', callback: () => cleanup() }).showToast();
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'interactive-toasts.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags hand-rolled toasts with structural second signals (body append or fixed/viewport positioning)', () => {
    const code = `
      $("<div>Saved</div>").appendTo("body").fadeIn(300).delay(2000).fadeOut(300);
      $("<div>Copied</div>").css({ position: "fixed", bottom: "16px", right: "16px" }).fadeIn(200).delay(1500).fadeOut(200);
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'hand-rolled.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts stop().fadeIn().fadeOut(), name-only toasts, and synchronous show/hide layout measurements', () => {
    const code = `
      $el.stop().fadeIn().fadeOut();
      $("#hero-banner").fadeIn(300).delay(2000).fadeOut(300);
      $(".dropdown-menu").slideDown(200).slideUp(200);
      $("<div class='toast'>").fadeIn(200).delay(1000).fadeOut(200);
      $("<div class='notification'>").appendTo(document.body);
      this.$menu.show().css({ position: "absolute", left: 0, top: 0 }).hide();
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'non-toast-animations.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stacked toastr calls in a block, navigation after toast, loop toasts, and empty first arg', () => {
    const code = `
      function onError(data) {
        toastr.error("Cannot get user data");
        toastr.error(data.Message);
      }
      function onSuccess(res) {
        toastr.success(res.message, 'Sucesso');
        window.location.href = '/thanks';
      }
      function fetchAll(types) {
        types.forEach((type) => {
          toastr.error('Failed ' + type);
        });
      }
      function emptyTitle(res) {
        toastr.error('', res.error);
      }
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'app/controllers/user.js', code);
    assert.equal(matches.length, 0);

    const multiCallMatches = matchJsRule(
      persistentToastNotificationsJsMatcher,
      'src/views/upload.js',
      `
        toastr.error('Missing file');
        toastr.success('Uploaded 1');
        toastr.info('Processing');
        toastr.warning('Quota low');
      `,
    );
    assert.equal(multiCallMatches.length, 0);
  });

  await t.test('flags toastr.error inside Promise .catch() and JSX component files', () => {
    const code = `
      import toastr from 'toastr';
      export function SaveButton() {
        const handleSave = () => {
          fetch('/api/save').catch((err) => {
            toastr.error('Failed to save');
          });
        };
        return <button onClick={handleSave}>Save</button>;
      }
    `;
    const matches = matchJsRule(persistentToastNotificationsJsMatcher, 'SaveButton.tsx', code);
    assert.equal(matches.length, 1);
  });
});
