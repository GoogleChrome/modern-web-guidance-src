import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import child_process from 'node:child_process';
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
      'canvas-html': 'override-issue-reviewer',
      'user-action-pseudos': 'user-action-reviewer'
    },
    web_features_groups: {
      'scrolling': 'group-issue-reviewer'
    }
  };

  let execMock: any;
  before(() => {
    execMock = mock.method(child_process, 'execSync', () => '');
  });

  after(() => {
    execMock.mock.restore();
  });

  it('returns matched ATLs for matching labels', () => {
    const result = handleIssue(123, ['category:performance', 'category:motion', 'other-label'], '', mockConfig);
    assert.deepStrictEqual(result.sort(), ['philipwalton', 'rviscomi', 'paulirish'].sort());
  });

  it('returns overridden ATL for feature labels', () => {
    const result = handleIssue(123, ['canvas-html'], '', mockConfig);
    assert.deepStrictEqual(result, ['override-issue-reviewer']);
  });

  it('returns overridden ATL for group labels', () => {
    const result = handleIssue(123, ['scrolling'], '', mockConfig);
    assert.deepStrictEqual(result, ['group-issue-reviewer']);
  });

  it('returns empty array when no labels match', () => {
    const result = handleIssue(123, ['other-label'], '', mockConfig);
    assert.deepStrictEqual(result, []);
  });

  it('returns ATLs matched from web-feature ID in the description directly', () => {
    const description = `This is an issue about canvas-html feature implementation.`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['override-issue-reviewer']);
  });

  it('returns ATLs matched from web-feature ID in the description as part of a group', () => {
    // scroll-driven-animations belongs to 'scrolling' (which resolves to group-issue-reviewer)
    const description = `Let's add support for scroll-driven-animations!`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['group-issue-reviewer']);
  });

  it('combines ATLs from both labels and description features without duplicates', () => {
    // 'category:performance' label maps to ['rviscomi', 'paulirish']
    // 'canvas-html' inside description maps to 'override-issue-reviewer'
    const description = `Please look at canvas-html behavior under load.`;
    const result = handleIssue(123, ['category:performance'], description, mockConfig);
    assert.deepStrictEqual(
      result.sort(),
      ['rviscomi', 'paulirish', 'override-issue-reviewer'].sort()
    );
  });

  it('supports extracting Web Feature ID from new-feature issue template format', () => {
    const description = `
### web-feature-id

canvas-html

### Feature description
Some description.
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['override-issue-reviewer']);
  });

  it('supports extracting Web Feature ID from webstatus.dev URLs in the issue template', () => {
    const description = `
### web-feature-id

https://webstatus.dev/features/canvas-html

### Feature description
Some description.
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['override-issue-reviewer']);
  });

  it('supports extracting Web Feature ID from bold label format (issue 1174 style)', () => {
    const description = `
This feature represents the behavior described in this section of the CSS spec:
https://www.w3.org/TR/selectors-4/#useraction-pseudos

---
**Web Feature ID**: user-action-pseudos
**Chrome Releases**: Chrome 148, Chrome 149
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['user-action-reviewer']);
  });

  it('supports extracting Web Feature ID from plain text label format', () => {
    const description = `
Web Feature ID: user-action-pseudos
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['user-action-reviewer']);
  });

  it('supports extracting Web Feature ID wrapped in backticks or markdown tags', () => {
    const description = `
**Web Feature ID**: \`user-action-pseudos\`
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['user-action-reviewer']);
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

  it('filters out already requested and reviewed ATLs case-insensitively', () => {
    // Stub execSync to return mock values
    const execMock = mock.method(child_process, 'execSync', (command: string) => {
      if (command.includes('--json files')) {
        // Return files lists
        return 'guides/performance/deliver-optimized-decorative-images/guide.md\nguides/motion/carousel-slide-effects/expectations.md\n';
      }
      if (command.includes('--json reviews,reviewRequests')) {
        // Return active requested / reviewed ATLs with mixed case to test case-insensitivity
        return JSON.stringify({
          reviewRequests: [
            { login: 'Override-Pr-Reviewer' }
          ],
          reviews: [
            { author: { login: 'PhilipWalton' }, state: 'APPROVED' }
          ]
        });
      }
      if (command.includes('--add-reviewer')) {
        return '';
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    try {
      // both 'override-pr-reviewer' (via feature 'image-set' override) and 'philipwalton' (default motion)
      // are resolved, but they are excluded because they are in reviewRequests/reviews.
      // So no additional review request is made.
      const result = handlePR(456, 'some-contributor', mockConfig);
      assert.deepStrictEqual(result, []);
      
      // Ensure the add-reviewer command was not run since matchedAtls is empty after exclusions
      const calls = execMock.mock.calls;
      const addReviewerCalled = calls.some(call => String(call.arguments[0]).includes('--add-reviewer'));
      assert.strictEqual(addReviewerCalled, false);
    } finally {
      execMock.mock.restore();
    }
  });
});

