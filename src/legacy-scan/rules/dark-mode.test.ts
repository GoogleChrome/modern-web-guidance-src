import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import { darkModeCssRule } from './dark-mode.ts';

const cssMatcher = darkModeCssRule.matcher as CssRuleMatcher;

void test('dark-mode: CSS positive brownfield matches', async (t) => {
  await t.test('flags rules inside @media (prefers-color-scheme: dark) without color-scheme', () => {
    const css = `
      body {
        background-color: #fff;
        color: #333;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: #121212;
          color: #eee;
        }
      }
    `;
    const matches = scanCss('theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 7);
    assert.match(matches[0]?.message ?? '', /color-scheme/);
  });
});

void test('dark-mode: CSS negative / exempt cases', async (t) => {
  await t.test('exempts stylesheets that declare color-scheme', () => {
    const css = `
      :root {
        color-scheme: light dark;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: #000;
        }
      }
    `;
    const matches = scanCss('modern-theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets using light-dark() function', () => {
    const css = `
      body {
        background-color: light-dark(#fff, #000);
      }
      @media (prefers-color-scheme: dark) {
        .custom {
          color: red;
        }
      }
    `;
    const matches = scanCss('light-dark-theme.css', css, [cssMatcher]);
    assert.equal(matches.length, 0);
  });
});
