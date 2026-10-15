import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { childStateBasedStylingRule } from './child-state-based-styling.ts';

const matcher = childStateBasedStylingRule.matcher as CssRuleMatcher;

void test('child-state-based-styling: positive brownfield matches', async (t) => {
  await t.test('flags input:checked + label sibling workaround', () => {
    const css = `
      input[type="checkbox"]:checked + label {
        color: #007bff;
        font-weight: bold;
      }
    `;
    const matches = scanCss('toggle.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /container :has\(\) selector/);
  });

  await t.test('flags input:focus ~ .indicator subsequent sibling hack', () => {
    const css = `
      .form-input:focus ~ .underline-indicator {
        transform: scaleX(1);
        background-color: blue;
      }
    `;
    const matches = scanCss('input.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags real-world audiomass main.css fixture', () => {
    const audiomassCss = `
      .pk_check:checked+label {
        position: relative;
        display: inline-block;
        height: 24px;
      }
      .pk_check:not(:checked)+label {
        position: relative;
        display: inline-block;
      }
    `;
    const matches = scanCss('audiomass.css', audiomassCss, [matcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('flags input:valid and input:invalid sibling feedback', () => {
    const css = `
      input:valid + .validation-check {
        display: block;
      }
      input:invalid ~ .error-text {
        display: block;
      }
    `;
    const matches = scanCss('feedback.css', css, [matcher]);
    assert.equal(matches.length, 2);
  });
});

void test('child-state-based-styling: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets already using :has()', () => {
    const css = `
      .card:has(input:checked) {
        border-color: #007bff;
      }
      input:checked + label {
        color: #007bff;
      }
    `;
    const matches = scanCss('modern.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard focus and hover pseudo-classes without sibling combinators', () => {
    const css = `
      input:focus {
        border-color: blue;
        outline: none;
      }
      button:hover {
        background-color: green;
      }
    `;
    const matches = scanCss('standard.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts adjacent sibling combinators between ordinary elements without state', () => {
    const css = `
      h2 + p {
        margin-top: 0;
      }
      li + li {
        border-top: 1px solid #ccc;
      }
    `;
    const matches = scanCss('content.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts child combinators with state', () => {
    const css = `
      .nav > li.active > a {
        color: red;
      }
    `;
    const matches = scanCss('nav.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
