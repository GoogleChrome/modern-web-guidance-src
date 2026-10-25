import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  highlightTextRangesJsMatcher,
  highlightTextRangesJsRule,
  highlightTextRangesPackageMatcher,
  highlightTextRangesPackageRule,
  highlightTextRangesRules,
} from './highlight-text-ranges.ts';

void test('highlight-text-ranges: rule metadata', () => {
  assert.equal(
    highlightTextRangesPackageRule.id,
    'highlight-text-ranges/package-markjs',
  );
  assert.equal(
    highlightTextRangesPackageRule.guideId,
    'highlight-text-ranges',
  );
  assert.equal(
    highlightTextRangesPackageRule.guideHash,
    HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  );
  assert.equal(HIGHLIGHT_TEXT_RANGES_GUIDE_HASH.length, 12);

  assert.equal(highlightTextRangesJsRule.id, 'highlight-text-ranges/js-markjs');
  assert.equal(highlightTextRangesJsRule.guideId, 'highlight-text-ranges');
  assert.equal(
    highlightTextRangesJsRule.guideHash,
    HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  );

  assert.equal(highlightTextRangesRules.length, 2);
  assert.ok(highlightTextRangesPackageRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(highlightTextRangesPackageRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(highlightTextRangesJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(highlightTextRangesJsRule.verifierRubric.dropWhen.length >= 2);
});

void test('highlight-text-ranges dependency matcher', async (t) => {
  await t.test('flags mark.js and markjs in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'mark.js': '^8.11.1',
          markjs: '^8.11.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      highlightTextRangesPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          marked: '^9.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      highlightTextRangesPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('highlight-text-ranges JS matcher', async (t) => {
  await t.test('flags new Mark(...).mark(...) and new Mark(...).markRegExp(...)', () => {
    const project = createInMemoryProject();
    const code = `
      new Mark(document.querySelector('article')).mark(searchTerm);
      const marker = new Mark(container);
      marker.markRegExp(/error/gi);
    `;
    const sourceFile = project.createSourceFile('search.js', code);
    const matches = highlightTextRangesJsMatcher.matchFile(sourceFile, {
      filePath: 'search.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /CSS\.highlights/);
  });

  await t.test('flags imported Mark from mark.js', () => {
    const project = createInMemoryProject();
    const code = `
      import Mark from 'mark.js';
      const instance = new Mark(document.body);
      instance.mark('keyword');
    `;
    const sourceFile = project.createSourceFile('imported-mark.js', code);
    const matches = highlightTextRangesJsMatcher.matchFile(sourceFile, {
      filePath: 'imported-mark.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by "highlights" in CSS or CSS.highlights', () => {
    const project = createInMemoryProject();
    const code = `
      if (!('highlights' in CSS)) {
        new Mark(article).mark(query);
      }
      if (CSS.highlights) {
        CSS.highlights.set('search', highlight);
      } else {
        const instance = new Mark(article);
        instance.markRegExp(/term/g);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = highlightTextRangesJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts performance.mark() and unrelated mark() methods', () => {
    const project = createInMemoryProject();
    const code = `
      performance.mark('render-start');
      editor.mark('bold');
    `;
    const sourceFile = project.createSourceFile('perf.js', code);
    const matches = highlightTextRangesJsMatcher.matchFile(sourceFile, {
      filePath: 'perf.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
