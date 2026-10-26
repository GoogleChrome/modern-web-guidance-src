import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES, getCategoryTitle, getCategoryIndex, isKnownCategory } from './categories.ts';
import { guidesDir } from './paths.ts';

describe('categories', () => {
  it('returns human-readable title for known categories', () => {
    assert.strictEqual(getCategoryTitle('css'), 'CSS');
    assert.strictEqual(getCategoryTitle('visual-design'), 'Visual Design');
    assert.strictEqual(getCategoryTitle('user-experience'), 'User Experience');
    assert.strictEqual(getCategoryTitle('built-in-ai'), 'Built-in AI');
    assert.strictEqual(getCategoryTitle('webmcp'), 'WebMCP');
  });

  it('throws on unknown categories instead of silently falling back', () => {
    assert.throws(
      () => getCategoryTitle('nonexistent-category'),
      /Unknown category "nonexistent-category"\. Register it in src\/core\/categories\.ts\./
    );
    assert.throws(
      () => getCategoryIndex('nonexistent-category'),
      /Unknown category "nonexistent-category"\. Register it in src\/core\/categories\.ts\./
    );
  });

  it('correctly reports category membership', () => {
    assert.strictEqual(isKnownCategory('html'), true);
    assert.strictEqual(isKnownCategory('random-cat'), false);
  });

  it('orders categories canonically with distinct indexes', () => {
    const indexes = CATEGORIES.map(c => getCategoryIndex(c.slug));
    assert.deepStrictEqual(indexes, CATEGORIES.map((_, i) => i));
    assert.ok(getCategoryIndex('visual-design') < getCategoryIndex('html'));
    assert.ok(getCategoryIndex('html') < getCategoryIndex('performance'));
    assert.ok(getCategoryIndex('performance') < getCategoryIndex('pwa'));
  });

  it('ensures every guide category directory under guides/ is registered in categories.ts', () => {
    const ignoredDirs = new Set(['modern-web-guidance', 'node_modules']);
    const entries = fs.readdirSync(guidesDir, { withFileTypes: true });
    const categoryDirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && !ignoredDirs.has(e.name))
      .map(e => e.name);

    for (const dirName of categoryDirs) {
      assert.ok(
        isKnownCategory(dirName),
        `Directory "guides/${dirName}" has no entry in CATEGORIES. Add it to src/core/categories.ts.`
      );
    }
  });
});
