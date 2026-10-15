import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { accessibleErrorAnnouncementRule } from './accessible-error-announcement.ts';

const matcher = accessibleErrorAnnouncementRule.matcher as CssRuleMatcher;

void test('accessible-error-announcement: positive brownfield matches', async (t) => {
  await t.test('flags raw input:invalid error border styling', () => {
    const css = `
      input:invalid {
        border-color: #dc3545;
        box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
      }
    `;
    const matches = scanCss('form.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /:user-invalid/);
  });

  await t.test('flags input:focus:invalid from real-world Bootstrap fixture', () => {
    const css = `
      input:focus:invalid, textarea:focus:invalid, select:focus:invalid {
        color: #b94a48;
        border-color: #ee5f5b;
      }
    `;
    const matches = scanCss('bootstrap.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags input:invalid:not(:placeholder-shown) pseudo-pattern', () => {
    const css = `
      input:invalid:not(:placeholder-shown) {
        border-color: red;
        background-color: #ffe6e6;
      }
    `;
    const matches = scanCss('floating-label.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags select:invalid with custom background indicator', () => {
    const css = `
      .custom-select:invalid {
        background-color: #333131;
        border-color: #e3342f;
      }
    `;
    const matches = scanCss('select.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('accessible-error-announcement: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets already using :user-invalid', () => {
    const css = `
      input:user-invalid {
        border-color: red;
      }
      input:invalid {
        border-color: red;
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules gated behind .was-validated submission class', () => {
    const css = `
      .was-validated .form-control:invalid {
        border-color: #dc3545;
      }
      .was-validated .custom-select:invalid {
        border-color: #dc3545;
      }
    `;
    const matches = scanCss('bootstrap-validated.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules that do not apply error visual styling', () => {
    const css = `
      input:invalid {
        cursor: pointer;
      }
    `;
    const matches = scanCss('cursor.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts selectors without :invalid', () => {
    const css = `
      input:valid {
        border-color: green;
      }
      .has-error {
        border-color: red;
      }
    `;
    const matches = scanCss('valid.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
