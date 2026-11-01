import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import {
  selectMenuInteractionCssMatcher,
} from './select-menu-interaction.ts';

void test('select-menu-interaction CSS matcher', async (t) => {
  await t.test('flags select:invalid without :user-invalid', () => {
    const css = `
      select:invalid {
        border-color: #d93025;
      }
      select.form-control:invalid + .error-msg {
        display: block;
      }
    `;
    const matches = scanCss('select.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts stylesheets already using select:user-invalid', () => {
    const css = `
      select:user-invalid {
        border-color: #d93025;
      }
    `;
    const matches = scanCss('modern.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts input:invalid not targeting <select> and :not(:invalid)', () => {
    const css = `
      input:invalid {
        border-color: red;
      }
      select:not(:invalid) {
        border-color: green;
      }
      select.form-control:not(:invalid) {
        border-color: green;
      }
      :not(select:invalid) {
        color: inherit;
      }
    `;
    const matches = scanCss('input.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts browser default :invalid resets, placeholder dimming, touched/validated gates, custom select widgets, and required-field-feedback overlap', () => {
    const css = `
      input:invalid, select:invalid, textarea:invalid {
        box-shadow: none;
        outline: none;
      }
      select:invalid + .z-decorator > .invalid {
        margin: 0.1em 0 0 1em;
      }
      input::placeholder, select:invalid {
        color: var(--pico-form-element-placeholder-color);
        opacity: 1;
      }
      select:invalid {
        color: #999;
      }
      form.was-validated select:invalid ~ .select2-container--bootstrap4 .select2-selection {
        border-color: #dc3545;
      }
      form.invalid input:invalid, form.invalid select:invalid {
        border: 2px solid red;
      }
      input:focus:required:invalid, textarea:focus:required:invalid, select:focus:required:invalid {
        color: #b94a48;
        border-color: #ee5f5b;
      }
    `;
    const matches = scanCss('resets.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
