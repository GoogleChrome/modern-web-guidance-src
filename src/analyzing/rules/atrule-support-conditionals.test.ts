import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  atruleSupportConditionalsJsMatcher,
  atruleSupportConditionalsJsRule,
  atruleSupportConditionalsPackageMatcher,
  atruleSupportConditionalsPackageRule,
  atruleSupportConditionalsRules,
} from './atrule-support-conditionals.ts';

void test('atrule-support-conditionals: rule metadata', () => {
  assert.equal(
    atruleSupportConditionalsPackageRule.id,
    'atrule-support-conditionals/package-modernizr',
  );
  assert.equal(
    atruleSupportConditionalsPackageRule.guideId,
    'atrule-support-conditionals',
  );
  assert.equal(
    atruleSupportConditionalsPackageRule.guideHash,
    ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  );
  assert.equal(ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH.length, 12);

  assert.equal(
    atruleSupportConditionalsJsRule.id,
    'atrule-support-conditionals/js-modernizr',
  );
  assert.equal(
    atruleSupportConditionalsJsRule.guideId,
    'atrule-support-conditionals',
  );
  assert.equal(
    atruleSupportConditionalsJsRule.guideHash,
    ATRULE_SUPPORT_CONDITIONALS_GUIDE_HASH,
  );

  assert.equal(atruleSupportConditionalsRules.length, 2);
  assert.ok(atruleSupportConditionalsPackageRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(atruleSupportConditionalsPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(atruleSupportConditionalsJsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(atruleSupportConditionalsJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('atrule-support-conditionals dependency matcher', async (t) => {
  await t.test('flags modernizr in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          modernizr: '^3.12.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      atruleSupportConditionalsPackageMatcher,
    ]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /modernizr/);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          postcss: '^8.4.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      atruleSupportConditionalsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('atrule-support-conditionals JS matcher', async (t) => {
  await t.test('flags Modernizr.testProp, testAllProps, and prefixed calls', () => {
    const project = createInMemoryProject();
    const code = `
      const hasPointerEvents = Modernizr.testProp('pointerEvents');
      const hasBoxSizing = Modernizr.testAllProps('boxSizing', 'border-box', true);
      const transformProp = Modernizr.prefixed('transform');
    `;
    const sourceFile = project.createSourceFile('feature.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'feature.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('flags Modernizr.atRule() and imported Modernizr usage', () => {
    const project = createInMemoryProject();
    const code = `
      import Modernizr from 'modernizr';
      const hasKeyframes = Modernizr.atRule('@keyframes');
      const hasFontFace = Modernizr.fontface;
    `;
    const sourceFile = project.createSourceFile('atrule.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'atrule.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Modernizr\.atRule/);
  });

  await t.test('flags Modernizr.css* and Modernizr.flexbox / Modernizr.cssgrid property checks', () => {
    const project = createInMemoryProject();
    const code = `
      if (Modernizr.cssanimations && Modernizr.flexbox && Modernizr.cssgrid) {
        enableGridAnimations();
      }
    `;
    const sourceFile = project.createSourceFile('layout.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'layout.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Modernizr\.cssanimations/);
  });

  await t.test('exempts non-CSS HTML5 API checks on Modernizr', () => {
    const project = createInMemoryProject();
    const code = `
      if (Modernizr.webgl && Modernizr.canvas && Modernizr.localstorage) {
        initScene();
      }
      if (Modernizr.TouchEvent || Modernizr.websockets) {
        connectSocket();
      }
    `;
    const sourceFile = project.createSourceFile('html5.js', code);
    const matches = atruleSupportConditionalsJsMatcher.matchFile(sourceFile, {
      filePath: 'html5.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
