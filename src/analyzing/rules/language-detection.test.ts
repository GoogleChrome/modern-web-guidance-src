import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  LANGUAGE_DETECTION_GUIDE_HASH,
  languageDetectionJsMatcher,
  languageDetectionJsRule,
  languageDetectionPackageMatcher,
  languageDetectionPackageRule,
  languageDetectionRules,
} from './language-detection.ts';

void test('language-detection: rule metadata', () => {
  assert.equal(
    languageDetectionPackageRule.id,
    'language-detection/package-lang-detect',
  );
  assert.equal(languageDetectionPackageRule.guideId, 'language-detection');
  assert.equal(
    languageDetectionPackageRule.guideHash,
    LANGUAGE_DETECTION_GUIDE_HASH,
  );
  assert.equal(LANGUAGE_DETECTION_GUIDE_HASH.length, 12);

  assert.equal(languageDetectionJsRule.id, 'language-detection/js-lang-detect');
  assert.equal(languageDetectionJsRule.guideId, 'language-detection');
  assert.equal(languageDetectionJsRule.guideHash, LANGUAGE_DETECTION_GUIDE_HASH);

  assert.equal(languageDetectionRules.length, 2);
  assert.ok(languageDetectionPackageRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(languageDetectionPackageRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(languageDetectionJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(languageDetectionJsRule.verifierRubric.dropWhen.length >= 2);
});

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
    const project = createInMemoryProject();
    const code = `
      const code1 = franc('Alle menslike wesens word vry');
      const ranked = francAll('O Brasil caiu 26 posições');
      const detector = new LanguageDetect();
      const scores = detector.detect('This is a test');
      const direct = new LanguageDetect().detect('Bonjour tout le monde');
    `;
    const sourceFile = project.createSourceFile('detect.js', code);
    const matches = languageDetectionJsMatcher.matchFile(sourceFile, {
      filePath: 'detect.js',
      fileContent: code,
    });
    assert.equal(matches.length, 4);
  });

  await t.test('flags imported franc, LanguageDetect, and tinyld', () => {
    const project = createInMemoryProject();
    const code = `
      import { franc } from 'franc-min';
      import LanguageDetect from 'languagedetect';
      import * as tinyld from 'tinyld';
      franc('Bonjour tout le monde');
      new LanguageDetect().detect('Hello world');
      tinyld.detect('Hola mundo');
    `;
    const sourceFile = project.createSourceFile('imported-detect.js', code);
    const matches = languageDetectionJsMatcher.matchFile(sourceFile, {
      filePath: 'imported-detect.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by "LanguageDetector" in self', () => {
    const project = createInMemoryProject();
    const code = `
      if ('LanguageDetector' in self) {
        const detector = await LanguageDetector.create();
        await detector.detect(text);
      } else {
        const fallback = franc(text);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = languageDetectionJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated detect() calls', () => {
    const project = createInMemoryProject();
    const code = `
      const browser = bowser.detect();
      const feature = featureDetector.detect('webgl');
    `;
    const sourceFile = project.createSourceFile('other.js', code);
    const matches = languageDetectionJsMatcher.matchFile(sourceFile, {
      filePath: 'other.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
