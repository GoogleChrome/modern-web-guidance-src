import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { checkboxRule } from './checkbox.ts';

const matcher = checkboxRule.matcher as CssRuleMatcher;

void test('checkbox: positive brownfield matches', async (t) => {
  await t.test('flags input[type="checkbox"] with display: none', () => {
    const css = `
      input[type="checkbox"] {
        display: none;
      }
    `;
    const matches = scanCss('checkbox.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /accent-color/);
  });

  await t.test('flags .checkbox input with display: none', () => {
    const css = `
      .checkbox input {
        display: none;
      }
    `;
    const matches = scanCss('form.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags [type="checkbox"] with opacity: 0 and position: absolute', () => {
    const css = `
      [type="checkbox"]:not(:checked),
      [type="checkbox"]:checked {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
    `;
    const matches = scanCss('material.css', css, [matcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('flags .custom-control-input with visibility: hidden in checkbox styles', () => {
    const css = `
      .custom-checkbox .custom-control-input {
        visibility: hidden;
      }
    `;
    const matches = scanCss('bootstrap.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
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
});
