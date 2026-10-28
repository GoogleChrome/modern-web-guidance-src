import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { formAssociatedCustomElementsRule } from './form-associated-custom-elements.ts';

if (formAssociatedCustomElementsRule.matcher.kind !== 'js') {
  throw new Error('Expected JS matcher');
}
const jsMatcher: JsRuleMatcher = formAssociatedCustomElementsRule.matcher;

void test('form-associated-custom-elements: positive matches', async (t) => {
  await t.test('flags custom element creating <input> and setting .type = "hidden"', () => {
    const code = `
      class RatingInput extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
          this._input = document.createElement('input');
          this._input.type = 'hidden';
          this.appendChild(this._input);
        }
        set value(v) {
          this._input.value = v;
        }
      }
      customElements.define('rating-input', RatingInput);
    `;
    const { matches } = scanJsSource('rating-input.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 7);
    assert.match(matches[0]?.message ?? '', /formAssociated/);
  });

  await t.test('flags custom element setting type="hidden" via setAttribute', () => {
    const code = `
      class ToggleControl extends HTMLElement {
        connectedCallback() {
          const input = document.createElement('input');
          input.setAttribute('type', 'hidden');
          input.name = this.getAttribute('name') || '';
          this.appendChild(input);
          this.hiddenInput = input;
        }
      }
    `;
    const { matches } = scanJsSource('toggle-control.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
  });

  await t.test('flags custom element rendering <input type="hidden"> in template and syncing value', () => {
    const code = `
      class CustomSwitch extends HTMLElement {
        connectedCallback() {
          this.innerHTML = '<input type="hidden" name="sw"><button type="button"></button>';
          this.hiddenField = this.querySelector('input[type="hidden"]');
        }
        toggle(nextVal) {
          this.hiddenField.value = String(nextVal);
        }
      }
    `;
    const { matches } = scanJsSource('custom-switch.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
  });
});

void test('form-associated-custom-elements: negative / exempt cases', async (t) => {
  await t.test('exempts custom element already using static formAssociated = true', () => {
    const code = `
      class ModernRating extends HTMLElement {
        static formAssociated = true;
        constructor() {
          super();
          this.#internals = this.attachInternals();
        }
        set value(v) {
          this.#internals.setFormValue(v);
        }
      }
    `;
    const { matches } = scanJsSource('modern-rating.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts custom element with visible text input instead of hidden input', () => {
    const code = `
      class SearchBox extends HTMLElement {
        connectedCallback() {
          this.input = document.createElement('input');
          this.input.type = 'search';
          this.appendChild(this.input);
        }
      }
    `;
    const { matches } = scanJsSource('search-box.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts fallback guarded by attachInternals / setFormValue feature detection', () => {
    const code = `
      class FallbackInput extends HTMLElement {
        connectedCallback() {
          if (!('attachInternals' in HTMLElement.prototype && 'setFormValue' in ElementInternals.prototype)) {
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            this.appendChild(hidden);
          }
        }
      }
    `;
    const { matches } = scanJsSource('fallback-input.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
