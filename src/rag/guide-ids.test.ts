import { describe, test } from 'node:test';
import assert from 'node:assert';
import { editDistance, normalizeGuideId, suggestGuideIds } from './guide-ids.ts';

describe('normalizeGuideId', () => {
  test('lowercases and trims plain IDs', () => {
    assert.strictEqual(normalizeGuideId('  Tabs '), 'tabs');
    assert.strictEqual(normalizeGuideId('scroll-snap-state-sync'), 'scroll-snap-state-sync');
  });

  test('strips category and guides/ path prefixes', () => {
    assert.strictEqual(normalizeGuideId('ui-components/tabs'), 'tabs');
    assert.strictEqual(normalizeGuideId('guides/ui-components/tabs'), 'tabs');
    assert.strictEqual(normalizeGuideId('./guides/ui-components/tabs/'), 'tabs');
    assert.strictEqual(normalizeGuideId('guides\\ui-components\\tabs'), 'tabs');
  });

  test('strips .md and /guide.md suffixes', () => {
    assert.strictEqual(normalizeGuideId('tabs.md'), 'tabs');
    assert.strictEqual(normalizeGuideId('tabs/guide.md'), 'tabs');
    assert.strictEqual(normalizeGuideId('GUIDES/UI-Components/Tabs/Guide.md'), 'tabs');
  });

  test('treats a trailing-slash directory path as the guide it names', () => {
    assert.strictEqual(normalizeGuideId('guides/forms/'), 'forms');
    assert.strictEqual(normalizeGuideId('ui-components/tabs//'), 'tabs');
  });

  test('returns an empty string when only separators remain', () => {
    assert.strictEqual(normalizeGuideId('/'), '');
    assert.strictEqual(normalizeGuideId('///'), '');
  });
});

describe('editDistance', () => {
  test('counts insertions, deletions and substitutions', () => {
    assert.strictEqual(editDistance('', ''), 0);
    assert.strictEqual(editDistance('tabs', 'tabs'), 0);
    assert.strictEqual(editDistance('tab', 'tabs'), 1);
    assert.strictEqual(editDistance('colour', 'color'), 1);
    assert.strictEqual(editDistance('kitten', 'sitting'), 3);
  });

  test('counts an adjacent transposition as one edit', () => {
    assert.strictEqual(editDistance('mneu', 'menu'), 1);
    assert.strictEqual(editDistance('toolbra', 'toolbar'), 1);
  });
});

describe('suggestGuideIds', () => {
  const ids = [
    'tabs',
    'toolbar',
    'menu',
    'app-menus',
    'navbar',
    'navigation-drawer',
    'scroll-snap-state-sync',
    'scroll-snap-realtime-feedback',
    'scroll-progress-indicator',
    'trusted-types',
    'validate-origins',
    'verify-email-ownership',
    'css',
    'declarative-dialog-popover-control',
    'interest-triggered-tooltips',
    'app-menus',
  ];

  test('ranks the intended ID first for adjacent transpositions', () => {
    assert.strictEqual(suggestGuideIds('tbas', ids)[0], 'tabs');
    assert.strictEqual(suggestGuideIds('trusted-tyeps', ids)[0], 'trusted-types');
  });

  test('ranks the intended ID first for common typos', () => {
    assert.strictEqual(suggestGuideIds('toolbra', ids)[0], 'toolbar');
    assert.strictEqual(suggestGuideIds('mneu', ids)[0], 'menu');
    assert.strictEqual(suggestGuideIds('trusted-type', ids)[0], 'trusted-types');
    assert.strictEqual(suggestGuideIds('validate-origin', ids)[0], 'validate-origins');
    assert.strictEqual(suggestGuideIds('navigaton-drawer', ids)[0], 'navigation-drawer');
  });

  test('matches truncated IDs and missing or extra words', () => {
    assert.strictEqual(suggestGuideIds('verify-email', ids)[0], 'verify-email-ownership');
    assert.strictEqual(suggestGuideIds('scroll-progress', ids)[0], 'scroll-progress-indicator');
    assert.strictEqual(suggestGuideIds('nav-drawer', ids)[0], 'navigation-drawer');
    assert.strictEqual(suggestGuideIds('navigation-side-drawer', ids)[0], 'navigation-drawer');
    assert.strictEqual(suggestGuideIds('scroll-progress-indicator-bar', ids)[0], 'scroll-progress-indicator');
  });

  test('suggests longer IDs containing a close match of a single-word query', () => {
    assert.deepStrictEqual(suggestGuideIds('popovr', ids), ['declarative-dialog-popover-control']);
    assert.deepStrictEqual(suggestGuideIds('tooltip', ids), ['interest-triggered-tooltips']);
  });

  test('ignores short prefixes and very short queries for partial matches', () => {
    assert.deepStrictEqual(suggestGuideIds('apple', ids), []);
    assert.deepStrictEqual(suggestGuideIds('a', ['light-dismiss-a-dialog']), []);
  });

  test('drops candidates just below the suggestion threshold', () => {
    // One edit in a 5-letter word (similarity 0.8) is just enough; one edit in a 4-letter word (0.75) is not.
    assert.deepStrictEqual(suggestGuideIds('toost', ['persistent-toast-notifications']), [
      'persistent-toast-notifications',
    ]);
    assert.deepStrictEqual(suggestGuideIds('cord', ['persistent-card-notifications']), []);
  });

  test('normalizes the query before comparing', () => {
    assert.strictEqual(suggestGuideIds('guides/ui-components/TOOLBRA.md', ids)[0], 'toolbar');
  });

  test('returns at most three suggestions', () => {
    const suggestions = suggestGuideIds('scroll-snap', ids);
    assert.ok(suggestions.length >= 1 && suggestions.length <= 3, `got ${suggestions.join(', ')}`);
    assert.ok(suggestions.every((id) => id.startsWith('scroll-')));
  });

  test('returns no suggestions for hopeless input', () => {
    assert.deepStrictEqual(suggestGuideIds('qwfp-zxcv', ids), []);
    assert.deepStrictEqual(suggestGuideIds('x', ids), []);
    assert.deepStrictEqual(suggestGuideIds('', ids), []);
  });

  test('returns no suggestions when there are no candidates', () => {
    assert.deepStrictEqual(suggestGuideIds('tabs', []), []);
  });
});
