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

  await t.test('flags [type="checkbox"] with appearance: none alongside sibling replacement', () => {
    const css = `
      [type="checkbox"] {
        appearance: none;
      }
      [type="checkbox"] + label::before {
        content: "✓";
      }
    `;
    const matches = scanCss('custom.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags checkboxes inside accordion, panel, or tab containers', () => {
    const css = `
      .accordion [type="checkbox"]:checked + label::before {
        content: "✓";
      }
      .tab-panel input[type="checkbox"]:checked + label:before {
        content: "✓";
      }
    `;
    const matches = scanCss('containers.css', css, [matcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags comma-grouped checkbox and radio rules with opacity: 0 and sibling pseudo-element box', () => {
    const css = `
      input[type="checkbox"],
      input[type="radio"] {
        opacity: 0;
        position: absolute;
      }
      input[type="checkbox"] + label::before,
      input[type="radio"] + label::before {
        content: "";
        display: inline-block;
      }
      input[type="checkbox"]:checked + label::before,
      input[type="radio"]:checked + label::before {
        content: "✓";
      }
    `;
    const matches = scanCss('grouped-controls.css', css, [matcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 12);
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
      .clearfix::after {
        content: "";
        display: table;
      }
      input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border: 2px solid #555;
      }
      input[type="checkbox"]::before {
        content: "";
        width: 10px;
        height: 10px;
      }
      input[type="checkbox"]:indeterminate::before {
        content: "-";
      }
      input[type="checkbox"] + label {
        cursor: pointer;
      }
    `;
    const matches = scanCss('modern-checkbox.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts CSS-only accordion/tab disclosure hacks and multi-widget resets', () => {
    const css = `
      input.accordion[type="checkbox"]:checked + label::after {
        content: "-";
      }
      .accordion[type="checkbox"]:checked + label::after {
        content: "-";
      }
      input.foldable[type="checkbox"]:checked + label::before {
        content: "+";
      }
      [type="checkbox"]:checked + label.arrow::before {
        content: "▸";
      }
      .payment-tab-trigger > input:checked ~ label::before {
        border-color: green;
      }
      input.tab:checked + span::before {
        background: #ddd;
      }
      input[type="checkbox"].quote-show-more {
        -webkit-appearance: none;
      }
      .chrome-bootstrap select,
      .chrome-bootstrap input[type="checkbox"],
      .chrome-bootstrap button {
        -webkit-appearance: none;
      }
    `;
    const matches = scanCss('disclosures-and-resets.css', css, [matcher]);
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

  await t.test('exempts commented/excluded sibling rules and non-subject opacity: 0 on ::before or descendants', () => {
    const commentedAndExcludedSiblingCss = `
      /* input[type="checkbox"] + label::before { content: "✓"; } */
      .switch input[type="checkbox"] + span::before {
        content: "";
      }
      input[type="checkbox"] {
        appearance: none;
        width: 18px;
        height: 18px;
      }
      input[type="checkbox"]::before {
        content: "";
        opacity: 0;
      }
      input[type="checkbox"]:checked::before {
        opacity: 1;
      }
    `;
    assert.equal(scanCss('modern-with-comment.css', commentedAndExcludedSiblingCss, [matcher]).length, 0);

    const nonSubjectOpacityCss = `
      input[type="checkbox"] + label {
        cursor: pointer;
      }
      input[type="checkbox"]:not(:checked) + label .checkmark {
        opacity: 0;
      }
      .custom-checkbox label {
        opacity: 0;
      }
    `;
    assert.equal(scanCss('non-subject.css', nonSubjectOpacityCss, [matcher]).length, 0);
  });
});
