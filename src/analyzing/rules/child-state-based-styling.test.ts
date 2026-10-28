import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import {
  childStateBasedStylingJsParentClassRule,
} from './child-state-based-styling.ts';

const jsMatcher = childStateBasedStylingJsParentClassRule.matcher as JsRuleMatcher;

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
