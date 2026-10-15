import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject, scanJsSource } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  declarativeDialogPopoverControlBootstrapRule,
  declarativeDialogPopoverControlClickListenerRule,
} from './declarative-dialog-popover-control.ts';

const domMatcher =
  declarativeDialogPopoverControlBootstrapRule.matcher as DomRuleMatcher;
const jsMatcher =
  declarativeDialogPopoverControlClickListenerRule.matcher as JsRuleMatcher;

void test('declarative-dialog-popover-control DOM: positive brownfield matches', async (t) => {
  await t.test('flags legacy data-toggle="modal" trigger (CyberChef fixture)', () => {
    const html = `
      <div id="banner">
        <a href="#" data-toggle="modal" data-target="#download-modal">Download CyberChef</a>
      </div>
    `;
    const matches = scanHtml('index.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /commandfor/);
  });

  await t.test('flags Bootstrap 5 data-bs-toggle="modal" trigger', () => {
    const html = `
      <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#exampleModal">
        Launch demo modal
      </button>
    `;
    const matches = scanHtml('modal.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags data-toggle="popover" trigger (Ray-Optics fixture)', () => {
    const html = `
      <label class="btn btn-secondary" data-toggle="popover" data-trigger="hover" data-content="Help text">
        Settings
      </label>
    `;
    const matches = scanHtml('controls.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /popovertarget/);
  });

  await t.test('flags data-toggle="modal" in JSX element', () => {
    const project = createInMemoryProject();
    const code = `
      export function ModalTrigger() {
        return (
          <button type="button" data-toggle="modal" data-target="#myModal">
            Open
          </button>
        );
      }
    `;
    const sourceFile = project.createSourceFile('ModalTrigger.tsx', code);
    const matches = scanJsx('ModalTrigger.tsx', sourceFile, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });
});

void test('declarative-dialog-popover-control DOM: negative / exempt cases', async (t) => {
  await t.test('exempts buttons already using commandfor and command="show-modal"', () => {
    const html = `
      <button commandfor="confirm-dialog" command="show-modal" data-toggle="modal">
        Open Confirmation
      </button>
    `;
    const matches = scanHtml('dialog.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts buttons already using popovertarget', () => {
    const html = `
      <button popovertarget="my-popover" data-toggle="popover">
        Toggle
      </button>
    `;
    const matches = scanHtml('popover.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts JSX buttons with spread attributes', () => {
    const project = createInMemoryProject();
    const code = `
      export function CustomButton(props: any) {
        return <button data-toggle="modal" {...props}>Open</button>;
      }
    `;
    const sourceFile = project.createSourceFile('Button.tsx', code);
    const matches = scanJsx('Button.tsx', sourceFile, [domMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('declarative-dialog-popover-control JS: positive click listener matches', async (t) => {
  await t.test('flags addEventListener("click") calling showModal()', () => {
    const js = `
      const openBtn = document.querySelector('#open-modal');
      openBtn.addEventListener('click', () => {
        dialog.showModal();
      });
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /commandfor/);
  });

  await t.test('flags addEventListener("click") calling dialog.close()', () => {
    const js = `
      const closeBtn = document.querySelector('#close-modal');
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dialog.close();
      });
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags addEventListener("click") calling togglePopover()', () => {
    const js = `
      const trigger = document.getElementById('pop-trigger');
      trigger.addEventListener('click', () => {
        myPopover.togglePopover();
      });
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags jQuery .on("click") and .click() calling modal("show")', () => {
    const js = `
      $('#merge-btn').on('click', () => {
        $('#merge-products-modal').modal('show');
      });
      $('#other-btn').click(function() {
        $('#other-modal').modal('show');
      });
    `;
    const { matches } = scanJsSource('products.js', js, [jsMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 5);
  });

  await t.test('flags onclick property assignment calling showModal()', () => {
    const js = `
      btn.onclick = () => {
        myDialog.showModal();
      };
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('declarative-dialog-popover-control JS: negative / exempt cases', async (t) => {
  await t.test('exempts click listener guarded by commandForElement feature check', () => {
    const js = `
      if (!('commandForElement' in HTMLButtonElement.prototype)) {
        btn.addEventListener('click', () => {
          dialog.showModal();
        });
      }
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated .close() calls on sockets or streams', () => {
    const js = `
      disconnectBtn.addEventListener('click', () => {
        webSocket.close();
      });
      cancelBtn.addEventListener('click', () => {
        fileStream.close();
      });
    `;
    const { matches } = scanJsSource('stream.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts listeners that do not toggle modals', () => {
    const js = `
      btn.addEventListener('click', () => {
        console.log('clicked');
      });
    `;
    const { matches } = scanJsSource('app.js', js, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
