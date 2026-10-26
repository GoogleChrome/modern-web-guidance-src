import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { createInMemoryProject, scanJsSource } from '../scanners/js-scanner.ts';
import type { CssRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  darkModeCssRule,
  darkModeJsMatchMediaRule,
} from './dark-mode.ts';

const cssMatcher = darkModeCssRule.matcher as CssRuleMatcher;
const jsMatcher = darkModeJsMatchMediaRule.matcher as JsRuleMatcher;

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

void test('dark-mode/js-match-media: JS positive matches', async (t) => {
  const project = createInMemoryProject();

  await t.test('flags matchMedia without a change listener', () => {
    const code = `
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        loadDarkAssets();
      }
    `;
    const { matches } = scanJsSource('theme-init.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /color-scheme/);
  });

  await t.test('flags JS toggling dark theme class without color-scheme', () => {
    const code = `
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      if (media.matches) {
        document.documentElement.classList.add('dark');
      }
    `;
    const { matches } = scanJsSource('theme-toggle.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('dark-mode/js-match-media: JS negative / exempt cases', async (t) => {
  const project = createInMemoryProject();

  await t.test('exempts matchMedia when a change listener is registered and color-scheme is used', () => {
    const code = `
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.style.colorScheme = media.matches ? 'dark' : 'light';
      media.addEventListener('change', (e) => {
        document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light';
      });
    `;
    const { matches } = scanJsSource('modern-listener.js', code, [jsMatcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts code protected by feature guard', () => {
    const code = `
      if (!CSS.supports('color-scheme', 'light dark')) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    `;
    const { matches } = scanJsSource('guarded.js', code, [jsMatcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts matchMedia assigned to property and passed to addEventListener helper', () => {
    const code = `
      class Tokenizer {
        #mediaQueryList;
        constructor() {
          this.#mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
          addEventListener(this.#mediaQueryList, 'change', () => {
            this.handleThemeChange();
          });
        }
      }
    `;
    const { matches } = scanJsSource('tokenizer.js', code, [jsMatcher], project);
    assert.equal(matches.length, 0);
  });
});
