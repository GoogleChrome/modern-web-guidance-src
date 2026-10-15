import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { dialogRule } from './dialog.ts';

const matcher = dialogRule.matcher as DomRuleMatcher;

void test('dialog: positive brownfield matches', async (t) => {
  await t.test('flags div with role="dialog" and aria-modal="true" in HTML', () => {
    const html = `
      <div id="modal-container" role="dialog" aria-modal="true" aria-labelledby="heading">
        <h2 id="heading">Confirm Action</h2>
        <button id="ok">OK</button>
      </div>
    `;
    const matches = scanHtml('components/modal.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /native HTML <dialog> element/);
  });

  await t.test('flags Bootstrap-style div.modal with role="dialog" in HTML', () => {
    const html = `
      <div class="modal fade" id="exampleModal" role="dialog">
        <div class="modal-dialog">
          <div class="modal-content">
            <p>Body text</p>
          </div>
        </div>
      </div>
    `;
    const matches = scanHtml('index.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /modernize with the native HTML <dialog>/);
  });

  await t.test('flags div with role="dialog", aria-modal="true", and tabindex="-1"', () => {
    const html = `
      <div id="my-dialog" role="dialog" aria-modal="true" tabindex="-1">
        <p>Accessible custom modal dialog</p>
      </div>
    `;
    const matches = scanHtml('dialog.html', html, [matcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags modal alertdialog with aria-modal="true"', () => {
    const html = `
      <div role="alertdialog" aria-modal="true" id="alert-box">
        <p>Warning: Unsaved changes!</p>
      </div>
    `;
    const matches = scanHtml('alert.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /alertdialog/);
  });

  await t.test('flags custom dialog in JSX component', () => {
    const project = createInMemoryProject();
    const code = `
      export function ConfirmDialog({ isOpen, onConfirm }) {
        if (!isOpen) return null;
        return (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-body">
              <p>Are you sure?</p>
              <button onClick={onConfirm}>Yes</button>
            </div>
          </div>
        );
      }
    `;
    const sourceFile = project.createSourceFile('ConfirmDialog.tsx', code);
    const matches = scanJsx('ConfirmDialog.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });
});

void test('dialog: negative / exempt cases', async (t) => {
  await t.test('exempts native HTML <dialog> even if role="dialog" is redundantly added', () => {
    const html = `
      <dialog id="native-dlg" role="dialog" aria-modal="true">
        <h2>Native Dialog</h2>
        <form method="dialog">
          <button>Close</button>
        </form>
      </dialog>
    `;
    const matches = scanHtml('native.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts role="alertdialog" notification banner without aria-modal="true"', () => {
    const html = `
      <div role="alertdialog" aria-live="assertive" class="toast-banner">
        <span>Network disconnected!</span>
      </div>
    `;
    const matches = scanHtml('toast.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-modal inline popups with aria-modal="false"', () => {
    const html = `
      <div role="dialog" aria-modal="false" class="tooltip-popup">
        <span>Quick definition popup</span>
      </div>
    `;
    const matches = scanHtml('tooltip.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts elements with spread attributes in JSX (skipIfHasSpread)', () => {
    const project = createInMemoryProject();
    const code = `
      export function Wrapper(props) {
        return <div {...props} role="dialog" aria-modal="true" />;
      }
    `;
    const sourceFile = project.createSourceFile('Wrapper.tsx', code);
    const matches = scanJsx('Wrapper.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-modal popup with role="dialog" and tabindex="-1" lacking aria-modal="true" or modal class', () => {
    const html = `
      <div id="popup-menu" role="dialog" tabindex="-1">
        <p>Non-modal dropdown or popup</p>
      </div>
    `;
    const matches = scanHtml('popup.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts generic div with role="dialog" lacking modal traits', () => {
    const html = `
      <div role="dialog" id="plain-panel">
        <span>Non-modal panel</span>
      </div>
    `;
    const matches = scanHtml('panel.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
