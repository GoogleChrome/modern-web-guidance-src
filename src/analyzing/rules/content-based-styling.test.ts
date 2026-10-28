import assert from 'node:assert/strict';
import test from 'node:test';
import { scanJsSource } from '../scanners/js-scanner.ts';
import type { JsRuleMatcher } from '../schema.ts';
import { contentBasedStylingRule } from './content-based-styling.ts';

if (contentBasedStylingRule.matcher.kind !== 'js') {
  throw new Error('Expected JS matcher');
}
const jsMatcher: JsRuleMatcher = contentBasedStylingRule.matcher;

void test('content-based-styling: JS positive matches', async (t) => {
  await t.test('flags if (card.querySelector("img")) card.classList.add("has-image")', () => {
    const code = `
      const cards = document.querySelectorAll('.article-card');
      cards.forEach((card) => {
        if (card.querySelector('img')) {
          card.classList.add('has-image');
        }
      });
    `;
    const { matches } = scanJsSource('card-image.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /:has\(\)/);
  });

  await t.test('flags container.classList.toggle("is-empty", container.children.length === 0)', () => {
    const code = `
      function updateEmptyState(list) {
        list.classList.toggle('is-empty', list.children.length === 0);
      }
    `;
    const { matches } = scanJsSource('empty-list.js', code, [jsMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });
});

void test('content-based-styling: JS negative / exempt cases', async (t) => {
  await t.test('exempts fallback guarded by CSS.supports("selector(:has(*))")', () => {
    const code = `
      if (!CSS.supports('selector(:has(*))')) {
        document.querySelectorAll('.article-card').forEach((card) => {
          if (card.querySelector('img')) {
            card.classList.add('has-image');
          }
        });
      }
    `;
    const { matches } = scanJsSource('guarded-has.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts form input event handlers (owned by child-state-based-styling/js-parent-class)', () => {
    const code = `
      input.addEventListener('focus', () => {
        if (field.querySelector('input')) {
          field.classList.add('has-focus');
        }
      });
    `;
    const { matches } = scanJsSource('form-focus.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts onfocus/onblur/onchange/oninput property assignments', () => {
    const code = `
      input.onchange = () => {
        el.classList.toggle('has-error', el.children.length > 0);
      };
    `;
    const { matches } = scanJsSource('form-onchange.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts if blocks performing additional non-styling operations', () => {
    const code = `
      if (card.querySelector('img')) {
        card.classList.add('has-image');
        initLightbox(card);
      }
    `;
    const { matches } = scanJsSource('lightbox-init.js', code, [jsMatcher]);
    assert.equal(matches.length, 0);
  });
});
