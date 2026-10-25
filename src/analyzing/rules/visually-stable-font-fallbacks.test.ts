import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  visuallyStableFontFallbacksJsMatcher,
  visuallyStableFontFallbacksJsRule,
  visuallyStableFontFallbacksPackageMatcher,
  visuallyStableFontFallbacksPackageRule,
  visuallyStableFontFallbacksRules,
} from './visually-stable-font-fallbacks.ts';

void test('visually-stable-font-fallbacks: rule metadata', () => {
  assert.equal(
    visuallyStableFontFallbacksPackageRule.id,
    'visually-stable-font-fallbacks/package-font-loader',
  );
  assert.equal(
    visuallyStableFontFallbacksPackageRule.guideId,
    'visually-stable-font-fallbacks',
  );
  assert.equal(
    visuallyStableFontFallbacksPackageRule.guideHash,
    VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  );
  assert.equal(VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH.length, 12);

  assert.equal(
    visuallyStableFontFallbacksJsRule.id,
    'visually-stable-font-fallbacks/js-font-loader',
  );
  assert.equal(
    visuallyStableFontFallbacksJsRule.guideId,
    'visually-stable-font-fallbacks',
  );
  assert.equal(
    visuallyStableFontFallbacksJsRule.guideHash,
    VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  );

  assert.equal(visuallyStableFontFallbacksRules.length, 2);
  assert.ok(visuallyStableFontFallbacksPackageRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(visuallyStableFontFallbacksPackageRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(visuallyStableFontFallbacksJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(visuallyStableFontFallbacksJsRule.verifierRubric.dropWhen.length >= 2);
});

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
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('fonts.js', code);
    const matches = visuallyStableFontFallbacksJsMatcher.matchFile(sourceFile, {
      filePath: 'fonts.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports("font-size-adjust", ...) or canvas drawing', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = visuallyStableFontFallbacksJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);

    const cssGuardedCode = `
      import FontFaceObserver from 'fontfaceobserver';
      const style = "@font-face { font-family: 'Fallback'; size-adjust: 105%; ascent-override: 90%; }";
      new FontFaceObserver('Inter').load().then(() => {
        document.documentElement.classList.add('fonts-loaded');
      });
    `;
    const cssGuardedFile = project.createSourceFile('css-guarded.js', cssGuardedCode);
    const cssGuardedMatches = visuallyStableFontFallbacksJsMatcher.matchFile(
      cssGuardedFile,
      {
        filePath: 'css-guarded.js',
        fileContent: cssGuardedCode,
      },
    );
    assert.equal(cssGuardedMatches.length, 0);
  });

  await t.test('exempts shadowed local FontFaceObserver or WebFont classes', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('shadowed.js', code);
    const matches = visuallyStableFontFallbacksJsMatcher.matchFile(sourceFile, {
      filePath: 'shadowed.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
