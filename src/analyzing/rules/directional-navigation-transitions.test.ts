import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  directionalNavigationTransitionsCssMatcher,
  directionalNavigationTransitionsMatcher,
} from './directional-navigation-transitions.ts';

void test('directional-navigation-transitions JS and CSS matchers', async (t) => {
  await t.test('flags JS toggling directional class or dataset on documentElement around document.startViewTransition()', () => {
    const code = `
      function navigate(direction, renderPage) {
        document.documentElement.dataset.direction = direction;
        const transition = document.startViewTransition(() => {
          renderPage();
        });
        transition.finished.finally(() => {
          delete document.documentElement.dataset.direction;
        });
      }
    `;
    const matches = matchJsRule(directionalNavigationTransitionsMatcher, 'nav.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts JS already passing { update, types } or toggling dark/light theme', () => {
    const code = `
      function navigateModern(direction, renderPage) {
        document.startViewTransition({
          update: () => renderPage(),
          types: [direction],
        });
      }

      function toggleTheme(newTheme) {
        document.startViewTransition(() => {
          document.documentElement.setAttribute('data-theme', newTheme);
        });
      }
    `;
    const matches = matchJsRule(directionalNavigationTransitionsMatcher, 'modern-nav.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags CSS scoping ::view-transition-old/new with html[data-transition=forwards/backwards] or html.back', () => {
    const css = `
      html[data-transition="forwards"]::view-transition-old(main) {
        animation-name: slide-out-left;
      }
      html[data-transition="forwards"]::view-transition-new(main) {
        animation-name: slide-in-right;
      }
    `;
    const matches = scanCss('transitions.css', css, [directionalNavigationTransitionsCssMatcher]);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts CSS already using :active-view-transition-type()', () => {
    const css = `
      html:active-view-transition-type(forwards)::view-transition-old(main) {
        animation-name: slide-out-left;
      }
    `;
    const matches = scanCss('modern.css', css, [directionalNavigationTransitionsCssMatcher]);
    assert.equal(matches.length, 0);
  });
});
