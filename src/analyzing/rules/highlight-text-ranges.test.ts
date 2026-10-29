import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  highlightTextRangesJsMatcher,
  highlightTextRangesPackageMatcher
} from './highlight-text-ranges.ts';
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
    const code = `
      new Mark(document.querySelector('article')).mark(searchTerm);
      const marker = new Mark(container);
      marker.markRegExp(/error/gi);
    `;
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'search.js', code);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /CSS\.highlights/);
  });

  await t.test('flags imported Mark from mark.js', () => {
    const code = `
      import Mark from 'mark.js';
      const instance = new Mark(document.body);
      instance.mark('keyword');
    `;
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'imported-mark.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by "highlights" in CSS or CSS.highlights', () => {
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
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts performance.mark() and unrelated mark() methods', () => {
    const code = `
      performance.mark('render-start');
      editor.mark('bold');
    `;
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'perf.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('handles template imports without throwing', () => {
    const code = `
      import { helper } from <%= path %>;
      import Mark from 'mark.js';
      const instance = new Mark(document.body);
      instance.mark('keyword');
    `;
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'template-import.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts mark.js usage that queries <mark> DOM nodes for interactive listeners', () => {
    const code = `
      function markAndBind(marker, words) {
        marker.mark(words);
        const markers = document.querySelectorAll("mark");
        markers.forEach((m) => m.addEventListener("click", () => marker.unmark()));
      }
    `;
    const matches = matchJsRule(highlightTextRangesJsMatcher, 'interactive-mark.js', code);
    assert.equal(matches.length, 0);
  });
});
