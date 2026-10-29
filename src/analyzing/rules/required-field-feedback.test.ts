import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  requiredFieldFeedbackCssMatcher,
  requiredFieldFeedbackJsMatcher
} from './required-field-feedback.ts';
void test('required-field-feedback CSS matcher', async (t) => {
  await t.test('flags :required:invalid and [required]:invalid selectors', () => {
    const css = `
      input:required:invalid {
        border-color: #d93025;
      }
      input[required]:invalid + .error-msg {
        display: block;
      }
    `;
    const matches = scanCss('form.css', css, [requiredFieldFeedbackCssMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('strips :not(...) before matching :invalid and exempts :user-invalid', () => {
    const css = `
      input:required:not(:invalid) {
        border-color: green;
      }
      :not(input[required]:invalid) {
        color: inherit;
      }
    `;
    const matches = scanCss('valid.css', css, [requiredFieldFeedbackCssMatcher]);
    assert.equal(matches.length, 0);

    const modernCss = `
      input:user-invalid {
        border-color: #d93025;
      }
    `;
    const modernMatches = scanCss('modern.css', modernCss, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(modernMatches.length, 0);
  });

  await t.test('flags touched / dirty paired :invalid selectors (e.g. Bootstrap .was-validated)', () => {
    const css = `
      .was-validated .form-control:invalid {
        border-color: #dc3545;
      }
      input.is-touched:invalid {
        border-color: #d93025;
      }
      .dirty input:invalid {
        box-shadow: 0 0 0 1px red;
      }
    `;
    const matches = scanCss('bootstrap-feedback.css', css, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts bare :invalid without required or touched/dirty class', () => {
    const css = `
      input:invalid {
        color: red;
      }
      textarea:invalid {
        border-color: orange;
      }
      .container :invalid {
        outline: none;
      }
    `;
    const matches = scanCss('bare-invalid.css', css, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts z-index-only layering rules, background-image: none icon resets, sibling feedback rules, and @charset vendor stylesheets', () => {
    const css = `
      .was-validated .input-group .form-control:invalid:focus {
        z-index: 2;
      }
      .was-validated .form-control:invalid {
        background-image: none;
      }
      .was-validated :invalid ~ .invalid-feedback {
        display: block;
      }
      .was-validated .form-control:invalid:focus {
        border-color: #dc3545;
      }
    `;
    const matches = scanCss('styles/validation.css', css, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(matches.length, 0);

    const vendorCss = `@charset "UTF-8";
/*!
 * Vendor CSS v5.1.3
 * Licensed under MIT
 */
.was-validated .form-control:invalid {
  border-color: #dc3545;
}`;
    const vendorMatches = scanCss('styles/vendor-lib.css', vendorCss, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(vendorMatches.length, 0);
  });
});

void test('required-field-feedback JS matcher', async (t) => {
  await t.test('flags blur / invalid listeners on inputs toggling .touched / .dirty / .interacted / .was-validated', () => {
    const code = `
      const emailInput = document.querySelector('input[required]');
      emailInput.addEventListener('blur', () => {
        emailInput.classList.add('touched');
      });
      emailInput.addEventListener('invalid', () => {
        emailInput.classList.add('was-validated');
      });
    `;
    const matches = matchJsRule(requiredFieldFeedbackJsMatcher, 'validation.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts aria-invalid accessibility sync and CSS.supports(":user-invalid") guards', () => {
    const code = `
      const input = document.querySelector('input[required]');
      input.addEventListener('blur', () => {
        if (!input.checkValidity()) {
          input.setAttribute('aria-invalid', 'true');
        }
      });

      if (!CSS.supports('selector(:user-invalid)')) {
        input.addEventListener('blur', () => {
          input.classList.add('dirty');
        });
      }
    `;
    const matches = matchJsRule(requiredFieldFeedbackJsMatcher, 'a11y.js', code);
    assert.equal(matches.length, 0);
  });
});
