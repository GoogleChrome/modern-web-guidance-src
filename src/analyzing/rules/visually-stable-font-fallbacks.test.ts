import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  visuallyStableFontFallbacksJsMatcher,
  visuallyStableFontFallbacksPackageMatcher
} from './visually-stable-font-fallbacks.ts';
void test('visually-stable-font-fallbacks dependency matcher', async (t) => {
  await t.test('flags fontfaceobserver and webfontloader', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          fontfaceobserver: '^2.3.0',
          webfontloader: '^1.6.28',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      visuallyStableFontFallbacksPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          react: '^18.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      visuallyStableFontFallbacksPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('visually-stable-font-fallbacks JS matcher', async (t) => {
  await t.test('flags new FontFaceObserver().load() and WebFont.load()', () => {
    const code = `
      import FontFaceObserver from 'fontfaceobserver';
      import WebFont from 'webfontloader';

      const font = new FontFaceObserver('Inter');
      font.load().then(() => {
        document.documentElement.classList.add('fonts-loaded');
      });

      WebFont.load({
        google: { families: ['Roboto:400,700'] },
        active: () => {
          document.body.classList.add('wf-active');
        },
      });
    `;
    const matches = matchJsRule(visuallyStableFontFallbacksJsMatcher, 'fonts.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("font-size-adjust", ...) or canvas drawing', () => {
    const code = `
      import FontFaceObserver from 'fontfaceobserver';

      if (!CSS.supports('font-size-adjust', 'from-font')) {
        new FontFaceObserver('Inter').load().then(() => {
          document.documentElement.classList.add('fonts-loaded');
        });
      }

      function renderBadge(canvas) {
        const ctx = canvas.getContext('2d');
        new FontFaceObserver('Arcade').load().then(() => {
          ctx.fillText('Score: 100', 10, 20);
          ctx.measureText('Score: 100');
        });
      }
    `;
    const matches = matchJsRule(visuallyStableFontFallbacksJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);

    const cssGuardedCode = `
      import FontFaceObserver from 'fontfaceobserver';
      const style = "@font-face { font-family: 'Fallback'; size-adjust: 105%; ascent-override: 90%; }";
      new FontFaceObserver('Inter').load().then(() => {
        document.documentElement.classList.add('fonts-loaded');
      });
    `;
    const cssGuardedMatches = matchJsRule(visuallyStableFontFallbacksJsMatcher, 'css-guarded.js', cssGuardedCode);
    assert.equal(cssGuardedMatches.length, 0);
  });

  await t.test('exempts shadowed local FontFaceObserver or WebFont classes', () => {
    const code = `
      import FontFaceObserver from 'fontfaceobserver';

      function localScope() {
        class FontFaceObserver {
          load() { return Promise.resolve(); }
        }
        const obs = new FontFaceObserver();
        obs.load();
      }
    `;
    const matches = matchJsRule(visuallyStableFontFallbacksJsMatcher, 'shadowed.js', code);
    assert.equal(matches.length, 0);
  });
});
