import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeLabel, handleIssue, handlePR } from './atl-triage.ts';

describe('normalizeLabel', () => {
  it('normalizes category prefixes', () => {
    assert.strictEqual(normalizeLabel('category:performance'), 'performance');
    assert.strictEqual(normalizeLabel('category:Performance'), 'performance');
    assert.strictEqual(normalizeLabel('Performance'), 'performance');
  });

  it('normalizes guide prefixes', () => {
    assert.strictEqual(normalizeLabel('guide:css-layout'), 'css-layout');
    assert.strictEqual(normalizeLabel('guides:accessibility'), 'accessibility');
  });

  it('preserves other text but lowercases and trims', () => {
    assert.strictEqual(normalizeLabel('  Some Label  '), 'some label');
  });
});

describe('handleIssue', () => {
  const mockConfig = {
    default: {
      performance: ['rviscomi', 'paulirish'],
      accessibility: 'rviscomi',
      'css-layout': 'malchata',
      motion: 'philipwalton'
    },
    web_features: {
      'canvas-html': 'override-issue-reviewer'
    },
    web_features_groups: {
      'scrolling': 'group-issue-reviewer'
    }
  };

  it('returns matched ATLs for matching labels', () => {
    const result = handleIssue(123, ['category:performance', 'category:motion', 'other-label'], mockConfig);
    assert.deepStrictEqual(result.sort(), ['philipwalton', 'rviscomi', 'paulirish'].sort());
  });

  it('returns overridden ATL for feature labels', () => {
    const result = handleIssue(123, ['canvas-html'], mockConfig);
    assert.deepStrictEqual(result, ['override-issue-reviewer']);
  });

  it('returns overridden ATL for group labels', () => {
    const result = handleIssue(123, ['scrolling'], mockConfig);
    assert.deepStrictEqual(result, ['group-issue-reviewer']);
  });

  it('returns empty array when no labels match', () => {
    const result = handleIssue(123, ['other-label'], mockConfig);
    assert.deepStrictEqual(result, []);
  });
});

describe('handlePR', () => {
  const mockConfig = {
    default: {
      performance: ['rviscomi', 'paulirish'],
      accessibility: 'rviscomi',
      'css-layout': 'malchata',
      motion: 'philipwalton'
    },
    web_features: {
      'image-set': 'override-pr-reviewer'
    },
    web_features_groups: {}
  };

  it('requests review from matching ATLs for content files', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md', // Has 'image-set' feature, will be overridden!
      'guides/motion/carousel-slide-effects/expectations.md',
      'guides/css-layout/grid-layout/demo.html',
      'guides/css-layout/grid-layout/other-file.json' // shouldn't trigger
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles);
    // 'deliver-optimized-decorative-images' resolves to 'override-pr-reviewer' (via feature 'image-set' override)
    // 'carousel-slide-effects' resolves to 'philipwalton' (default motion)
    // 'grid-layout' resolves to 'malchata' (default css-layout)
    assert.deepStrictEqual(result.sort(), ['override-pr-reviewer', 'philipwalton', 'malchata'].sort());
  });

  it('does not request review from the PR author', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md',
      'guides/motion/carousel-slide-effects/expectations.md'
    ];

    // Author is override-pr-reviewer, so only philipwalton should be requested
    const result = handlePR(456, 'override-pr-reviewer', mockConfig, mockFiles);
    assert.deepStrictEqual(result.sort(), ['philipwalton'].sort());
  });

  it('returns empty array when no content files are touched', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/tasks/task.md',
      'README.md'
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles);
    assert.deepStrictEqual(result, []);
  });
});
