import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  equalWidthTextLinesJsMatcher,
  equalWidthTextLinesJsRule,
  equalWidthTextLinesPackageMatcher,
  equalWidthTextLinesPackageRule,
  equalWidthTextLinesRules,
} from './equal-width-text-lines.ts';

void test('equal-width-text-lines: rule metadata', () => {
  assert.equal(equalWidthTextLinesPackageRule.id, 'equal-width-text-lines/package-fittext');
  assert.equal(equalWidthTextLinesPackageRule.guideId, 'equal-width-text-lines');
  assert.equal(equalWidthTextLinesPackageRule.guideHash, EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH);
  assert.equal(EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH.length, 12);

  assert.equal(equalWidthTextLinesJsRule.id, 'equal-width-text-lines/js-fittext');
  assert.equal(equalWidthTextLinesJsRule.guideId, 'equal-width-text-lines');
  assert.equal(equalWidthTextLinesJsRule.guideHash, EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH);

  assert.equal(equalWidthTextLinesRules.length, 2);
  assert.ok(equalWidthTextLinesPackageRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(equalWidthTextLinesPackageRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(equalWidthTextLinesJsRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(equalWidthTextLinesJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('equal-width-text-lines dependency matcher', async (t) => {
  await t.test('flags fitty in dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        fitty: '^2.3.6',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [equalWidthTextLinesPackageMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /fitty/);
  });

  await t.test('flags fittext in devDependencies', () => {
    const pkg = JSON.stringify({
      devDependencies: {
        fittext: '^0.0.4',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [equalWidthTextLinesPackageMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /fittext/);
  });

  await t.test('flags jquery-fittext and react-fitty', () => {
    const pkg = JSON.stringify({
      dependencies: {
        'jquery-fittext': '^1.2.0',
        'react-fitty': '^1.0.0',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [equalWidthTextLinesPackageMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        react: '^18.0.0',
        lodash: '^4.17.21',
      },
    }, null, 2);
    const matches = scanPackageJson('package.json', pkg, [equalWidthTextLinesPackageMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('equal-width-text-lines JS matcher', async (t) => {
  await t.test('flags fitty call', () => {
    const project = createInMemoryProject();
    const code = `
      fitty('.lockup-line');
    `;
    const sourceFile = project.createSourceFile('poster.js', code);
    const matches = equalWidthTextLinesJsMatcher.matchFile(sourceFile, {
      filePath: 'poster.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /text-fit/);
  });

  await t.test('flags jQuery .fitText call', () => {
    const project = createInMemoryProject();
    const code = `
      $("#bigTitle").fitText(0.6);
      $("#underBigTitle").fitText(2.5);
    `;
    const sourceFile = project.createSourceFile('header.js', code);
    const matches = equalWidthTextLinesJsMatcher.matchFile(sourceFile, {
      filePath: 'header.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by CSS.supports for text-fit', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('text-fit', 'grow per-line-all')) {
        fitty('.lockup-line');
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = equalWidthTextLinesJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts unrelated function calls', () => {
    const project = createInMemoryProject();
    const code = `
      const bounds = map.fitBounds(coords);
      const formatted = formatText(title);
    `;
    const sourceFile = project.createSourceFile('unrelated.js', code);
    const matches = equalWidthTextLinesJsMatcher.matchFile(sourceFile, {
      filePath: 'unrelated.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
