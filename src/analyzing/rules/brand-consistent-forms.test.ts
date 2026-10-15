import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { brandConsistentFormsRule } from './brand-consistent-forms.ts';

const matcher = brandConsistentFormsRule.matcher as CssRuleMatcher;

void test('brand-consistent-forms: positive cases', async (t) => {
  await t.test('flags input[type="checkbox"] with appearance: none', () => {
    const css = `
      input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border: 2px solid #6200ee;
      }
    `;
    const matches = scanCss('checkbox.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /accent-color/);
  });

  await t.test('flags input[type="radio"] with -moz-appearance: none', () => {
    const css = `
      input[type="radio"] {
        -moz-appearance: none;
        border-radius: 50%;
        background-color: white;
      }
    `;
    const matches = scanCss('radio.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags input[type="range"] slider with -webkit-appearance: none', () => {
    const css = `
      input[type="range"] {
        -webkit-appearance: none;
        width: 100%;
        background: transparent;
      }
    `;
    const matches = scanCss('range.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags progress bar with appearance: none', () => {
    const css = `
      progress {
        appearance: none;
        border-radius: 4px;
        color: #01b6f5;
      }
    `;
    const matches = scanCss('progress.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags .custom-checkbox with appearance: none', () => {
    const css = `
      .custom-checkbox {
        appearance: none;
        border: 1px solid #ccc;
      }
    `;
    const matches = scanCss('form.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('brand-consistent-forms: negative cases', async (t) => {
  await t.test('skips when stylesheet already uses accent-color', () => {
    const css = `
      :root {
        accent-color: #6200ee;
      }

      input[type="checkbox"] {
        appearance: none;
      }
    `;
    const matches = scanCss('theme.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips progressive fallback inside @supports not (accent-color)', () => {
    const css = `
      @supports not (accent-color: red) {
        input[type="checkbox"] {
          appearance: none;
          background: #eee;
        }
      }
    `;
    const matches = scanCss('fallback.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips number input spin buttons with -webkit-appearance: none', () => {
    const css = `
      input::-webkit-outer-spin-button,
      input::-webkit-inner-spin-button {
        -webkit-appearance: none;
      }
    `;
    const matches = scanCss('number.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips search input reset with -webkit-appearance: none', () => {
    const css = `
      input[type="search"] {
        -webkit-appearance: none;
      }
    `;
    const matches = scanCss('search.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips hidden checkboxes (display: none)', () => {
    const css = `
      input[type="checkbox"] {
        display: none;
        appearance: none;
      }
    `;
    const matches = scanCss('hidden.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
