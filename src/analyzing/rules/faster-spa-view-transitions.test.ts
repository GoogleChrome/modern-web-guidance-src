import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  fasterSpaViewTransitionsCssMatcher,
  fasterSpaViewTransitionsJsMatcher,
} from './faster-spa-view-transitions.ts';

void test('faster-spa-view-transitions JS and CSS matchers', async (t) => {
  await t.test('flags CSS inactive SPA view selectors using display: none', () => {
    const css = `
      .spa-view.inactive {
        display: none;
      }
    `;
    const matches = scanCss('views.css', css, [fasterSpaViewTransitionsCssMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /content-visibility: hidden/);
  });

  await t.test('exempts CSS @supports not (content-visibility: hidden) fallback rules', () => {
    const css = `
      @supports not (content-visibility: hidden) {
        .spa-view.inactive {
          display: none;
        }
      }
    `;
    const matches = scanCss('views.css', css, [fasterSpaViewTransitionsCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('flags JS SPA view switchers hiding inactive views via style.display = "none"', () => {
    const code = `
      function switchToView(viewId) {
        document.querySelectorAll('.spa-view').forEach((view) => {
          view.style.display = 'none';
        });
        const activeView = document.getElementById(viewId);
        activeView.style.display = 'block';
      }
    `;
    const matches = matchJsRule(
      fasterSpaViewTransitionsJsMatcher,
      'router.js',
      code,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /content-visibility: hidden/);
  });
});
