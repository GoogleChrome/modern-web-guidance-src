import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  searchHiddenContentCssMatcher,
  searchHiddenContentMatcher,
} from './search-hidden-content.ts';

void test('search-hidden-content JS and CSS matchers', async (t) => {
  await t.test('flags JS/JSX accordion or FAQ components hiding collapsed panels with boolean hidden or display: none', () => {
    const code = `
      function toggleAccordionItem(button, panel) {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      }
    `;
    const matches = matchJsRule(searchHiddenContentMatcher, 'accordion.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts JS already using hidden="until-found" or beforematch, and non-accordion navbars/modals', () => {
    const modernCode = `
      function closeAccordionPanel(panel) {
        panel.setAttribute('hidden', 'until-found');
        panel.addEventListener('beforematch', () => panel.removeAttribute('hidden'));
      }
    `;
    assert.equal(matchJsRule(searchHiddenContentMatcher, 'modern.js', modernCode).length, 0);

    const navbarCode = `
      function toggleNavbarMenu(button, dropdown) {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        dropdown.hidden = expanded;
      }
    `;
    assert.equal(matchJsRule(searchHiddenContentMatcher, 'navbar.js', navbarCode).length, 0);
  });

  await t.test('flags CSS accordion/FAQ content panel rules setting display: none', () => {
    const css = `
      .faq-answer-panel {
        display: none;
      }
      .faq-answer-panel.is-open {
        display: block;
      }
    `;
    const matches = scanCss('faq.css', css, [searchHiddenContentCssMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts CSS rules hiding accordion icons or headers', () => {
    const css = `
      .accordion-header-icon {
        display: none;
      }
    `;
    const matches = scanCss('icons.css', css, [searchHiddenContentCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
