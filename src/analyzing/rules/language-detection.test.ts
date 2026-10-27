import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  languageDetectionJsMatcher,
  languageDetectionPackageMatcher
} from './language-detection.ts';
void test('language-detection dependency matcher', async (t) => {
  await t.test('flags franc, franc-min, franc-all, languagedetect, and tinyld in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          franc: '^6.1.0',
          'franc-min': '^6.1.0',
          'franc-all': '^6.1.0',
          languagedetect: '^2.0.0',
          tinyld: '^1.2.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      languageDetectionPackageMatcher,
    ]);
    assert.equal(matches.length, 5);
  });

  await t.test('exempts devDependencies and CLI/server-only packages', () => {
    const devOnlyPkg = JSON.stringify(
      {
        devDependencies: {
          franc: '^6.1.0',
        },
      },
      null,
      2,
    );
    assert.equal(
      scanPackageJson('package.json', devOnlyPkg, [
        languageDetectionPackageMatcher,
      ]).length,
      0,
    );

    const cliPkg = JSON.stringify(
      {
        name: 'my-cli-tool',
        bin: './bin/cli.js',
        dependencies: {
          franc: '^6.1.0',
        },
      },
      null,
      2,
    );
    assert.equal(
      scanPackageJson('package.json', cliPkg, [languageDetectionPackageMatcher])
        .length,
      0,
    );
  });
});

void test('language-detection JS matcher', async (t) => {
  await t.test('flags franc(), francAll(), and new LanguageDetect().detect()', () => {
    const code = `
      const code1 = franc('Alle menslike wesens word vry');
      const ranked = francAll('O Brasil caiu 26 posições');
      const detector = new LanguageDetect();
      const scores = detector.detect('This is a test');
      const direct = new LanguageDetect().detect('Bonjour tout le monde');
    `;
    const matches = matchJsRule(languageDetectionJsMatcher, 'detect.js', code);
    assert.equal(matches.length, 4);
  });

  await t.test('flags imported franc, LanguageDetect, and tinyld', () => {
    const code = `
      import { franc } from 'franc-min';
      import LanguageDetect from 'languagedetect';
      import * as tinyld from 'tinyld';
      franc('Bonjour tout le monde');
      new LanguageDetect().detect('Hello world');
      tinyld.detect('Hola mundo');
    `;
    const matches = matchJsRule(languageDetectionJsMatcher, 'imported-detect.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by "LanguageDetector" in self', () => {
    const code = `
      if ('LanguageDetector' in self) {
        const detector = await LanguageDetector.create();
        await detector.detect(text);
      } else {
        const fallback = franc(text);
      }
    `;
    const matches = matchJsRule(languageDetectionJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated detect() calls', () => {
    const code = `
      const browser = bowser.detect();
      const feature = featureDetector.detect('webgl');
    `;
    const matches = matchJsRule(languageDetectionJsMatcher, 'other.js', code);
    assert.equal(matches.length, 0);
  });
});
