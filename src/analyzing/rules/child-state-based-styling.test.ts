import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { CssRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  childStateBasedStylingDeferredRules,
  childStateBasedStylingJsParentClassRule,
} from './child-state-based-styling.ts';

const cssMatcher = childStateBasedStylingDeferredRules[0]!.matcher as CssRuleMatcher;
const jsMatcher = childStateBasedStylingJsParentClassRule.matcher as JsRuleMatcher;

void test('child-state-based-styling: CSS positive brownfield matches', async (t) => {
  await t.test('flags input:checked + label sibling workaround', () => {
    const css = `
      input[type="checkbox"]:checked + label {
        color: #007bff;
        font-weight: bold;
      }
    `;
    const matches = scanCss('toggle.css', css, [cssMatcher]);
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
    const matches = scanCss('input.css', css, [cssMatcher]);
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
    const matches = scanCss('audiomass.css', audiomassCss, [cssMatcher]);
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
    const matches = scanCss('feedback.css', css, [cssMatcher]);
    assert.equal(matches.length, 2);
  });
});

void test('child-state-based-styling: CSS negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets already using :has()', () => {
    const css = `
      .card:has(input:checked) {
        border-color: #007bff;
      }
      input:checked + label {
        color: #007bff;
      }
    `;
    const matches = scanCss('modern.css', css, [cssMatcher]);
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
    const matches = scanCss('standard.css', css, [cssMatcher]);
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
    const matches = scanCss('content.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts child combinators with state', () => {
    const css = `
      .nav > li.active > a {
        color: red;
      }
    `;
    const matches = scanCss('nav.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('child-state-based-styling/js-parent-class: JS positive matches', async (t) => {
  await t.test('flags focus/blur event listeners adding/removing focused class on parentElement', () => {
    const code = `
      const input = document.querySelector('input');
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('is-focused');
      });
      input.addEventListener('blur', () => {
        input.parentElement.classList.remove('is-focused');
      });
    `;
    const { matches } = scanJsSource('input-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.line, 4);
    assert.equal(matches[1]?.line, 7);
    assert.match(matches[0]?.message ?? '', /CSS :has\(\) selector/);
  });

  await t.test('flags closest(.form-group) class toggle on change event', () => {
    const code = `
      function bindInputEvents(field) {
        field.addEventListener('change', (e) => {
          const group = field.closest('.form-group');
          group.classList.toggle('has-value', field.value.length > 0);
        });
      }
    `;
    const { matches } = scanJsSource('field-change.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  await t.test('flags onfocus property assignment modifying parentNode classList', () => {
    const code = `
      function setupField(input) {
        input.onfocus = function() {
          input.parentNode.classList.add('active');
        };
      }
    `;
    const { matches } = scanJsSource('onfocus.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });
});

void test('child-state-based-styling/js-parent-class: JS negative / exempt cases', async (t) => {
  await t.test('exempts classList modification directly on input itself', () => {
    const code = `
      input.addEventListener('focus', () => {
        input.classList.add('focused');
      });
    `;
    const { matches } = scanJsSource('self-target.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts click listeners toggling non-form UI state', () => {
    const code = `
      button.addEventListener('click', () => {
        button.parentElement.classList.toggle('open');
      });
    `;
    const { matches } = scanJsSource('click-open.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code guarded by CSS :has() feature check', () => {
    const code = `
      if (!CSS.supports('selector(:has(*))')) {
        input.addEventListener('focus', () => {
          input.parentElement.classList.add('is-focused');
        });
      }
    `;
    const { matches } = scanJsSource('guarded.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts event delegation handlers checking e.target.matches', () => {
    const code = `
      document.addEventListener('focusin', (e) => {
        if (e.target.matches('.form-input')) {
          e.target.parentElement.classList.add('is-focused');
        }
      });
    `;
    const { matches } = scanJsSource('delegation.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts state management dispatch inside focus handler', () => {
    const code = `
      input.addEventListener('focus', () => {
        dispatch({ type: 'INPUT_FOCUSED' });
        input.parentElement.classList.add('is-focused');
      });
    `;
    const { matches } = scanJsSource('redux-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
