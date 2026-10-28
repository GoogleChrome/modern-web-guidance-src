import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { componentSpecificLightDarkThemeRule } from './component-specific-light-dark-theme.ts';

if (componentSpecificLightDarkThemeRule.matcher.kind !== 'css') {
  throw new Error('Expected CSS matcher');
}
const cssMatcher: CssRuleMatcher = componentSpecificLightDarkThemeRule.matcher;

void test('component-specific-light-dark-theme: CSS positive matches', async (t) => {
  await t.test('flags .dark .card overriding both background and color', () => {
    const css = `
      .card {
        background-color: #ffffff;
        color: #111111;
      }
      .dark .card {
        background-color: #1e1e1e;
        color: #f5f5f5;
      }
    `;
    const matches = scanCss('card-theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
    assert.match(matches[0]?.message ?? '', /color-scheme/);
  });

  await t.test('flags [data-theme="dark"] .code-block overriding component theme variables', () => {
    const css = `
      [data-theme="dark"] .code-block {
        --surface-bg: #111;
        --surface-text: #eee;
      }
    `;
    const matches = scanCss('code-block.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('component-specific-light-dark-theme: CSS negative / exempt cases', async (t) => {
  await t.test('exempts page-root selectors (:root, html, body) owned by dark-mode', () => {
    const css = `
      html.dark, body.dark-theme, :root[data-theme="dark"] {
        background-color: #000;
        color: #fff;
      }
    `;
    const matches = scanCss('root-theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts rules inside @media (prefers-color-scheme: dark) owned by dark-mode', () => {
    const css = `
      @media (prefers-color-scheme: dark) {
        .dark .card {
          background-color: #111;
          color: #eee;
        }
      }
    `;
    const matches = scanCss('media-dark.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts elements without a background override (forbidden by guide)', () => {
    const css = `
      .dark .card-title {
        color: #ffffff;
      }
    `;
    const matches = scanCss('text-only.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Tailwind escaped utility selectors', () => {
    const css = `
      .dark .dark\\:bg-gray-800 {
        background-color: #1f2937;
        color: #fff;
      }
    `;
    const matches = scanCss('tailwind.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts single custom property containing both background and color words', () => {
    const css = `
      .react-flow.dark {
        --xy-background-color-default: #313f4e !important;
      }
    `;
    const matches = scanCss('react-flow.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
