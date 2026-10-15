import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { adaptScrollbarToContrastPreferencesRule } from './adapt-scrollbar-to-contrast-preferences.ts';

const matcher = adaptScrollbarToContrastPreferencesRule.matcher as CssRuleMatcher;

void test('adapt-scrollbar-to-contrast-preferences: positive brownfield matches', async (t) => {
  await t.test('flags -ms-overflow-style declaration', () => {
    const css = `
      .scroll-container {
        overflow: scroll;
        -ms-overflow-style: -ms-autohiding-scrollbar;
      }
    `;
    const matches = scanCss('container.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /scrollbar-color/);
  });

  await t.test('flags -ms-scrollbar-face-color and -ms-scrollbar-track-color', () => {
    const css = `
      body {
        -ms-scrollbar-face-color: #000000;
        -ms-scrollbar-track-color: #ffffff;
      }
    `;
    const matches = scanCss('ie-theme.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });

  await t.test('flags legacy IE 3d and highlight scrollbar properties', () => {
    const css = `
      .panel {
        -ms-scrollbar-3dlight-color: #e0e0e0;
        -ms-scrollbar-arrow-color: #333333;
        -ms-scrollbar-shadow-color: #888888;
        -ms-scrollbar-darkshadow-color: #000000;
        -ms-scrollbar-highlight-color: #ffffff;
      }
    `;
    const matches = scanCss('legacy-panel.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('adapt-scrollbar-to-contrast-preferences: negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets that pair -ms-overflow-style with scrollbar-width', () => {
    const css = `
      .scroller {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    `;
    const matches = scanCss('modern-paired.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets that pair legacy scrollbar styling with scrollbar-color', () => {
    const css = `
      :root {
        scrollbar-color: #333 #ccc;
      }
      body {
        -ms-scrollbar-face-color: #333;
      }
    `;
    const matches = scanCss('modern-color.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard overflow rules', () => {
    const css = `
      .scrollable {
        overflow-y: auto;
      }
    `;
    const matches = scanCss('overflow.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
