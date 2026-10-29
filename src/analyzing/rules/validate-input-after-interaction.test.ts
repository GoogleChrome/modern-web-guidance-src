import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { validateInputAfterInteractionCssMatcher } from './validate-input-after-interaction.ts';

void test('validate-input-after-interaction CSS matcher', async (t) => {
  await t.test('flags input:invalid and textarea:invalid error styling without :user-invalid', () => {
    const css = `
      input:invalid, textarea:invalid {
        border-color: #d93025;
        background-color: #fff0f0;
      }
      input:not(:placeholder-shown):not(:focus):invalid {
        border: 2px solid red;
      }
      input[type="email"]:invalid ~ .error-message {
        display: block;
      }
    `;
    const matches = scanCss('form.css', css, [validateInputAfterInteractionCssMatcher]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts stylesheets already using :user-invalid', () => {
    const css = `
      input:user-invalid, textarea:user-invalid {
        border-color: #d93025;
      }
    `;
    const matches = scanCss('modern.css', css, [validateInputAfterInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts required:invalid, touched/dirty classes, select:invalid, and browser resets', () => {
    const css = `
      input:required:invalid {
        border-color: red;
      }
      input.touched:invalid, .was-validated input:invalid {
        border-color: red;
      }
      select:invalid {
        border-color: red;
      }
      input:invalid, textarea:invalid {
        box-shadow: none;
        outline: none;
      }
      input:not(:invalid) {
        border-color: green;
      }
      input:invalid .no-boxshadow, textarea:invalid .no-boxshadow {
        background-color: #f0dddd;
      }
    `;
    const matches = scanCss('other.css', css, [validateInputAfterInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
