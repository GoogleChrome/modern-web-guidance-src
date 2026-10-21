import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject, scanJsSource } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  declarativeDialogPopoverControlClickListenerMatcher,
  declarativeDialogPopoverControlClickListenerRule,
  declarativeDialogPopoverControlMatcher,
  declarativeDialogPopoverControlRule,
} from './declarative-dialog-popover-control.ts';

const domRules: readonly DomRuleMatcher[] = [declarativeDialogPopoverControlMatcher];
const jsRules: readonly JsRuleMatcher[] = [declarativeDialogPopoverControlClickListenerMatcher];

function runJsxScan(filePath: string, code: string) {
  const project = createInMemoryProject();
  const sf = project.createSourceFile(filePath, code, { overwrite: true });
  return scanJsx(filePath, sf, domRules);
}

describe('declarativeDialogPopoverControlRule (DOM)', () => {
  it('has valid rule metadata and non-empty phase2Rubric', () => {
    assert.equal(declarativeDialogPopoverControlRule.id, 'declarative-dialog-popover-control');
    assert.equal(
      declarativeDialogPopoverControlClickListenerRule.id,
      'declarative-dialog-popover-control/click-listener',
    );
    assert.ok(declarativeDialogPopoverControlRule.phase2Rubric.keepWhen.length > 0);
    assert.ok(declarativeDialogPopoverControlRule.phase2Rubric.dropWhen.length > 0);
  });

  it('flags button with onclick calling showModal()', () => {
    const html = `
      <button onclick="document.getElementById('dlg').showModal()">Open</button>
      <dialog id="dlg">Hello</dialog>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  it('flags button with onclick calling togglePopover()', () => {
    const html = `
      <button onclick="menu.togglePopover()">Menu</button>
      <div id="menu" popover>Items</div>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 1);
  });

  it('flags button with aria-controls referencing an actual <dialog> in the document', () => {
    const html = `
      <button aria-controls="settings-dlg">Settings</button>
      <dialog id="settings-dlg">Content</dialog>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 1);
  });

  it('ignores button with aria-controls when target is not a <dialog> or [popover]', () => {
    const html = `
      <button aria-controls="accordion-panel">Expand</button>
      <div id="accordion-panel">Details</div>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores button that already has commandfor attribute', () => {
    const html = `
      <button commandfor="dlg" command="show-modal">Open</button>
      <dialog id="dlg">Hello</dialog>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores button that already has popovertarget attribute', () => {
    const html = `
      <button popovertarget="menu">Menu</button>
      <div id="menu" popover>Items</div>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores button with unrelated onclick handler', () => {
    const html = `
      <button onclick="submitForm()">Submit</button>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores button with onclick calling dialog.close("confirm") with a return value argument', () => {
    const html = `
      <button onclick="dialog.close('confirm')">Confirm</button>
      <dialog id="dialog">Hello</dialog>
    `;
    const matches = scanHtml('index.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores Bootstrap data-bs-toggle="modal" and data-toggle="modal" attributes', () => {
    const html = `
      <button type="button" data-bs-toggle="modal" data-bs-target="#exampleModal">
        Launch modal
      </button>
      <button type="button" data-toggle="popover" data-target="#pop">
        Launch popover
      </button>
    `;
    const matches = scanHtml('modal.html', html, domRules);
    assert.equal(matches.length, 0);
  });

  it('ignores JSX button with spread attributes', () => {
    const jsx = `
      export function Trigger(props) {
        return <button {...props} onClick={() => dlg.showModal()}>Open</button>;
      }
    `;
    const matches = runJsxScan('Trigger.tsx', jsx);
    assert.equal(matches.length, 0);
  });

  it('ignores JSX button with dynamic commandfor={id}', () => {
    const jsx = `
      export function Trigger({ id }) {
        return <button commandfor={id} onClick={() => dlg.showModal()}>Open</button>;
      }
    `;
    const matches = runJsxScan('Trigger.tsx', jsx);
    assert.equal(matches.length, 0);
  });

  it('does not falsely attribute sibling onclick to a button without an onclick handler', () => {
    const html = `
      <button type="submit">Save</button>
      <button onclick="document.getElementById('dlg').showModal()">Open</button>
      <dialog id="dlg">Content</dialog>
    `;
    const matches = scanHtml('sibling.html', html, domRules);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

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
});
