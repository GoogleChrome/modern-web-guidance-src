import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { accessibleWebComponentsRule } from './accessible-web-components.ts';

if (accessibleWebComponentsRule.matcher.kind !== 'js') {
  throw new Error('Expected JS matcher');
}
const jsMatcher: JsRuleMatcher = accessibleWebComponentsRule.matcher;

void test('accessible-web-components: positive matches', async (t) => {
  await t.test('flags this.setAttribute("role", ...) and aria-* in connectedCallback', () => {
    const code = `
      class ToggleSwitch extends HTMLElement {
        connectedCallback() {
          this.setAttribute('role', 'switch');
          this.setAttribute('aria-checked', 'false');
        }
      }
      customElements.define('toggle-switch', ToggleSwitch);
    `;
    const { matches } = scanJsSource('toggle-switch.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
    assert.match(matches[0]?.message ?? '', /attachInternals/);
  });

  await t.test('flags this.setAttribute("aria-expanded", ...) in constructor or helper called from connectedCallback', () => {
    const code = `
      class AccordionPanel extends HTMLElement {
        connectedCallback() {
          this._initA11y();
        }
        _initA11y() {
          this.setAttribute('aria-expanded', 'false');
        }
      }
    `;
    const { matches } = scanJsSource('accordion-panel.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 7);
  });
});

void test('accessible-web-components: negative / exempt cases', async (t) => {
  await t.test('exempts custom element already using attachInternals()', () => {
    const code = `
      class ModernSwitch extends HTMLElement {
        constructor() {
          super();
          this._internals = this.attachInternals();
          this._internals.role = 'switch';
          this._internals.ariaChecked = 'false';
        }
      }
    `;
    const { matches } = scanJsSource('modern-switch.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts setAttribute on internal shadow DOM child elements', () => {
    const code = `
      class CustomDialog extends HTMLElement {
        connectedCallback() {
          this.button.setAttribute('role', 'button');
          this.button.setAttribute('aria-pressed', 'false');
        }
      }
    `;
    const { matches } = scanJsSource('custom-dialog.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts IDREF ARIA attributes like aria-labelledby and aria-controls', () => {
    const code = `
      class LabeledWidget extends HTMLElement {
        connectedCallback() {
          this.setAttribute('aria-labelledby', 'heading-1');
          this.setAttribute('aria-controls', 'panel-1');
        }
      }
    `;
    const { matches } = scanJsSource('labeled-widget.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts fallback guarded by ElementInternals feature check', () => {
    const code = `
      class SafeWidget extends HTMLElement {
        connectedCallback() {
          if (!('ElementInternals' in window && 'role' in ElementInternals.prototype)) {
            this.setAttribute('role', 'region');
          }
        }
      }
    `;
    const { matches } = scanJsSource('safe-widget.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('flags custom element setting role via self = this in ready() lifecycle', () => {
    const code = `
      class CustomSlider extends PolymerElement {
        ready() {
          const self = this;
          self.setAttribute('role', 'slider');
        }
      }
    `;
    const { matches } = scanJsSource('custom-slider.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
  });
});
