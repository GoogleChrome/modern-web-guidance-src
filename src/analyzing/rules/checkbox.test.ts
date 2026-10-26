import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { checkboxCssMatcher } from './checkbox.ts';

const matcher = checkboxCssMatcher;

void test('checkbox: positive brownfield matches', async (t) => {
  await t.test('flags [type="checkbox"] with opacity: 0 and sibling replacement', () => {
    const css = `
      [type="checkbox"]:not(:checked),
      [type="checkbox"]:checked {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      [type="checkbox"] + label {
        position: relative;
        padding-left: 25px;
      }
    `;
    const matches = scanCss('material.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /accent-color/);
  });

  await t.test('flags custom checkbox pseudo-element checkmark styling', () => {
    const css = `
      input:checked + label::before {
        content: "✓";
        background-color: #007bff;
        border-color: #007bff;
      }
    `;
    const matches = scanCss('custom-check.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags .custom-checkbox with appearance: none', () => {
    const css = `
      .custom-checkbox {
        appearance: none;
        border: 2px solid #333;
      }
    `;
    const matches = scanCss('custom.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('checkbox: negative / exempt cases', async (t) => {
  await t.test('exempts bare input[type="checkbox"] with display: none without visual replacement', () => {
    const css = `
      input[type="checkbox"] {
        display: none;
      }
    `;
    const matches = scanCss('checkbox.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts bare opacity: 0 without sibling custom-box replacement', () => {
    const css = `
      input[type="checkbox"] {
        opacity: 0;
      }
    `;
    const matches = scanCss('hidden.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets already using accent-color', () => {
    const css = `
      :root {
        accent-color: #007bff;
      }
      input[type="checkbox"] {
        display: none;
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts screen-reader utility classes (.sr-only, .visually-hidden)', () => {
    const css = `
      .sr-only input[type="checkbox"] {
        position: absolute;
        opacity: 0;
      }
      .visually-hidden input[type="checkbox"] {
        display: none;
      }
    `;
    const matches = scanCss('a11y.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated input rules', () => {
    const css = `
      input[type="text"] {
        display: block;
        width: 100%;
      }
    `;
    const matches = scanCss('text.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts custom toggle-switch components (.switch, .toggle)', () => {
    const css = `
      .switch input[type="checkbox"] {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .switch + span.slider {
        position: relative;
      }
    `;
    const matches = scanCss('switch.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts design system form resets stripping appearance without visual replacement', () => {
    const css = `
      input[type="checkbox"], input[type="radio"] {
        appearance: none;
        -webkit-appearance: none;
        margin: 0;
      }
    `;
    const matches = scanCss('reset.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts modern appearance: none directly on input[type="checkbox"] (recommended technique)', () => {
    const css = `
      input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border: 2px solid #555;
      }
    `;
    const matches = scanCss('modern-checkbox.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts radio and star rating pseudo elements', () => {
    const css = `
      input[type="radio"]:checked + label::before {
        content: "";
        border-radius: 50%;
      }
      .star-rating input:checked + label::before {
        content: "★";
      }
      .rate-widget input:checked + label::before {
        content: "\\2605";
      }
      input[type="checkbox"]:checked + label.star::before {
        content: "\\f005";
      }
      input[type="checkbox"]:checked + label::before {
        content: "☆";
      }
      .rate-bar input[type="checkbox"] {
        opacity: 0;
      }
      .rate-bar input[type="checkbox"] + label {
        display: inline-block;
      }
    `;
    const matches = scanCss('radio-star.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts general toggle buttons and non-checkbox appearance: none', () => {
    const css = `
      .toggle-button {
        appearance: none;
        border: 1px solid #ccc;
      }
      .btn-toggle input:checked + label::before {
        content: "";
      }
      .select-box {
        appearance: none;
      }
    `;
    const matches = scanCss('toggles.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules inside @supports (accent-color: ...)', () => {
    const css = `
      @supports (accent-color: red) {
        .custom-checkbox {
          appearance: none;
        }
      }
    `;
    const matches = scanCss('fallback.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
