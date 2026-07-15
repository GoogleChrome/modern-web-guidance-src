import test, { describe, it } from 'node:test';
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
    performance: ['rviscomi', 'paulirish'],
    accessibility: 'rviscomi',
    'css-layout': 'malchata',
    motion: 'philipwalton'
  };

  it('returns matched ATLs for matching labels', () => {
    // Note: handleIssue normally executes `gh issue edit` which we want to mock or bypass.
    // In our handleIssue code, it tries to run execSync but catches errors.
    // We can verify that it returns the correct ATLs.
    const result = handleIssue(123, ['category:performance', 'category:motion', 'other-label'], mockConfig);
    assert.deepStrictEqual(result.sort(), ['philipwalton', 'rviscomi', 'paulirish'].sort());
  });

  it('returns empty array when no labels match', () => {
    const result = handleIssue(123, ['other-label'], mockConfig);
    assert.deepStrictEqual(result, []);
  });
});

describe('handlePR', () => {
  const mockConfig = {
    performance: ['rviscomi', 'paulirish'],
    accessibility: 'rviscomi',
    'css-layout': 'malchata',
    motion: 'philipwalton'
  };

  it('requests review from matching ATLs for content files', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md',
      'guides/motion/carousel-slide-effects/expectations.md',
      'guides/css-layout/grid-layout/demo.html',
      'guides/css-layout/grid-layout/other-file.json' // shouldn't trigger
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles);
    assert.deepStrictEqual(result.sort(), ['rviscomi', 'paulirish', 'philipwalton', 'malchata'].sort());
  });

  it('does not request review from the PR author', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md',
      'guides/motion/carousel-slide-effects/expectations.md'
    ];

    // Author is rviscomi, so only paulirish and philipwalton should be requested
    const result = handlePR(456, 'rviscomi', mockConfig, mockFiles);
    assert.deepStrictEqual(result.sort(), ['paulirish', 'philipwalton'].sort());
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
