import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import {
  normalizeLabel,
  handleIssue,
  handlePR,
  findGuidesTranscludingFeature,
  githubApi
} from './atl-triage.ts';
import { getTranscludedFeatureIds, parseArguments } from '../serving/lib/macro-parsing.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('parseArguments', () => {
  it('parses single arguments unquoted and quoted', () => {
    assert.deepStrictEqual(parseArguments('"popover"'), ['popover']);
    assert.deepStrictEqual(parseArguments("'popover'"), ['popover']);
    assert.deepStrictEqual(parseArguments('popover'), ['popover']);
  });

  it('parses multiple arguments with mixed quotes and whitespace', () => {
    assert.deepStrictEqual(
      parseArguments('"customizable-select", "usage"'),
      ['customizable-select', 'usage']
    );
    assert.deepStrictEqual(
      parseArguments("'user-pseudos', 'aria-invalid'"),
      ['user-pseudos', 'aria-invalid']
    );
    assert.deepStrictEqual(
      parseArguments('user-pseudos, "aria-invalid"'),
      ['user-pseudos', 'aria-invalid']
    );
  });
});

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

describe('getTranscludedFeatureIds', () => {
  it('extracts feature IDs from FEATURE macro', () => {
    const content = `
# Some Guide
{{ FEATURE("customizable-select", "usage") }}
{{ FEATURE('popover') }}
{{ FEATURE(user-pseudos, "aria-invalid") }}
`;
    const result = getTranscludedFeatureIds(content);
    assert.deepStrictEqual(result.sort(), ['customizable-select', 'popover', 'user-pseudos'].sort());
  });

  it('extracts feature IDs from FEATURE_FALLBACKS macro', () => {
    const content = `
{{ FEATURE_FALLBACKS("scrollbar-color") }}
{{ FEATURE_FALLBACKS('light-dark') }}
{{ FEATURE_FALLBACKS(color-scheme) }}
`;
    const result = getTranscludedFeatureIds(content);
    assert.deepStrictEqual(result.sort(), ['scrollbar-color', 'light-dark', 'color-scheme'].sort());
  });

  it('extracts feature IDs from FEATURE_ISSUES macro', () => {
    const content = `
{{ FEATURE_ISSUES("color-scheme") }}
{{ FEATURE_ISSUES('accent-color') }}
`;
    const result = getTranscludedFeatureIds(content);
    assert.deepStrictEqual(result.sort(), ['color-scheme', 'accent-color'].sort());
  });

  it('extracts feature IDs from INCLUDE macros referencing features/*.md', () => {
    const content = `
{{ INCLUDE("features/popover.md#fallbacks") }}
{{ INCLUDE("../features/customizable-select.md") }}
{{ INCLUDE("../../features/light-dark.md#issues") }}
{{ INCLUDE('features/accent-color.md') }}
`;
    const result = getTranscludedFeatureIds(content);
    assert.deepStrictEqual(result.sort(), ['popover', 'customizable-select', 'light-dark', 'accent-color'].sort());
  });

  it('returns empty array when no transclusion macros are present', () => {
    const content = `
# Plain Guide
This guide has no feature transclusions.
{{ BASELINE_STATUS("popover") }}
{{ GUIDE_REF("forms") }}
`;
    const result = getTranscludedFeatureIds(content);
    assert.deepStrictEqual(result, []);
  });

  it('handles empty or falsy content gracefully', () => {
    assert.deepStrictEqual(getTranscludedFeatureIds(''), []);
  });
});

describe('findGuidesTranscludingFeature', () => {
  it('finds guides that transclude a feature in a mock directory structure', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-triage-test-'));
    try {
      // Create mock guide directories
      const formsGuideDir = path.join(tmpDir, 'forms', 'rich-picker');
      fs.mkdirSync(formsGuideDir, { recursive: true });
      fs.writeFileSync(path.join(formsGuideDir, 'guide.md'), '{{ FEATURE("customizable-select", "usage") }}', 'utf8');

      const visualGuideDir = path.join(tmpDir, 'visual-design', 'scroll-colors');
      fs.mkdirSync(visualGuideDir, { recursive: true });
      fs.writeFileSync(path.join(visualGuideDir, 'guide.md'), '{{ FEATURE_FALLBACKS("scrollbar-color") }}', 'utf8');

      const matches = findGuidesTranscludingFeature('customizable-select', tmpDir);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0].category, 'forms');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('finds real repository guides that transclude scrollbar-color', () => {
    const matches = findGuidesTranscludingFeature('scrollbar-color');
    assert.ok(matches.length >= 1);
    const categories = matches.map(m => m.category);
    assert.ok(categories.includes('visual-design'));
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

  let unassignedMock: any;
  let assigneesMock: any;
  let addAssigneesMock: any;

  before(() => {
    unassignedMock = mock.method(githubApi, 'getIssueUnassignedLogins', () => []);
    assigneesMock = mock.method(githubApi, 'getIssueCurrentAssignees', () => []);
    addAssigneesMock = mock.method(githubApi, 'addIssueAssignees', () => {});
  });

  after(() => {
    unassignedMock.mock.restore();
    assigneesMock.mock.restore();
    addAssigneesMock.mock.restore();
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
  it('assigns the category ATL if the issue is a use case under that category', () => {
    const description = `Use case subdir: [guides/css-layout/some-use-case](https://github.com/...)`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['malchata']);
  });

  it('assigns both the category ATL and feature override ATL for use case issues', () => {
    const description = `
Use case subdir: [guides/css-layout/some-use-case](https://github.com/...)
Affected web-feature IDs: [canvas-html](...)
`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result.sort(), ['malchata', 'override-issue-reviewer'].sort());
  });

  it('skips auto-assigning ATLs who have previously been unassigned from the issue', () => {
    unassignedMock.mock.mockImplementation(() => ['RVISCOMI']); // Test mixed-case matching

    try {
      const result = handleIssue(123, ['category:performance'], '', mockConfig);
      // 'rviscomi' was unassigned, so only 'paulirish' should be assigned
      assert.deepStrictEqual(result, ['paulirish']);
    } finally {
      unassignedMock.mock.mockImplementation(() => []);
    }
  });

  it('returns empty array when all candidate ATLs were previously unassigned', () => {
    unassignedMock.mock.mockImplementation(() => ['rviscomi', 'paulirish']);

    try {
      const result = handleIssue(123, ['category:performance'], '', mockConfig);
      assert.deepStrictEqual(result, []);
    } finally {
      unassignedMock.mock.mockImplementation(() => []);
    }
  });

  it('skips ATLs who are already assigned to the issue', () => {
    assigneesMock.mock.mockImplementation(() => ['rviscomi']);

    try {
      const result = handleIssue(123, ['category:performance'], '', mockConfig);
      // 'rviscomi' is already assigned, so only 'paulirish' is newly assigned
      assert.deepStrictEqual(result, ['paulirish']);
    } finally {
      assigneesMock.mock.mockImplementation(() => []);
    }
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

  let addReviewersMock: any;

  before(() => {
    addReviewersMock = mock.method(githubApi, 'addPrReviewers', () => {});
  });

  after(() => {
    addReviewersMock.mock.restore();
  });

  it('requests review from matching ATLs for content files', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md', // Has 'image-set' feature, will be overridden!
      'guides/motion/carousel-slide-effects/expectations.md',
      'guides/css-layout/grid-layout/guide.md',
      'guides/css-layout/grid-layout/other-file.json' // shouldn't trigger
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles);
    // 'deliver-optimized-decorative-images' resolves to 'override-pr-reviewer' (via feature 'image-set' override) + 'rviscomi', 'paulirish' (default performance)
    // 'carousel-slide-effects' resolves to 'philipwalton' (default motion)
    // 'grid-layout' resolves to 'malchata' (default css-layout)
    assert.deepStrictEqual(result.sort(), ['override-pr-reviewer', 'rviscomi', 'paulirish', 'philipwalton', 'malchata'].sort());
  });

  it('does not request review from the PR author', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md',
      'guides/motion/carousel-slide-effects/expectations.md'
    ];

    // Author is override-pr-reviewer, so only rviscomi, paulirish, and philipwalton should be requested
    const result = handlePR(456, 'override-pr-reviewer', mockConfig, mockFiles);
    assert.deepStrictEqual(result.sort(), ['rviscomi', 'paulirish', 'philipwalton'].sort());
  });

  it('returns empty array when no content files are touched and gd-dev-content label is not set', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/tasks/task.md',
      'guides/performance/deliver-optimized-decorative-images/demo.html',
      'README.md'
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles, undefined, ['gd-dev-eval']);
    assert.deepStrictEqual(result, []);
  });

  it('assigns corresponding ATL when gd-dev-content label is present even if only target eval files were touched', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/targets/daily-grind/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/targets/daily-grind/patches/zero-passrate.patch',
      'guides/motion/carousel-slide-effects/targets/daily-grind/task.md'
    ];

    const result = handlePR(456, 'some-contributor', mockConfig, mockFiles, undefined, ['gd-dev-content']);
    // 'deliver-optimized-decorative-images' has 'image-set' -> override-pr-reviewer + rviscomi, paulirish (performance)
    // 'carousel-slide-effects' -> philipwalton (motion)
    assert.deepStrictEqual(
      result.sort(),
      ['override-pr-reviewer', 'rviscomi', 'paulirish', 'philipwalton'].sort()
    );
  });

  it('filters out already requested and reviewed ATLs case-insensitively', () => {

    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/performance/deliver-optimized-decorative-images/guide.md',
      'guides/motion/carousel-slide-effects/expectations.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({
      reviewRequests: ['Override-Pr-Reviewer', 'rviscomi', 'paulirish'],
      reviews: ['PhilipWalton']
    }));

    try {
      const result = handlePR(456, 'some-contributor', mockConfig);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('auto-assigns feature-level owners and transcluding guide category owners when features/*.md is modified', () => {
    const config = {
      default: {
        'visual-design': 'visual-owner',
        forms: 'forms-owner'
      },
      web_features: {
        'scrollbar-color': 'feature-scrollbar-owner'
      },
      web_features_groups: {}
    };

    const mockFiles = ['features/scrollbar-color.md'];
    const result = handlePR(456, 'some-contributor', config, mockFiles);
    // 'scrollbar-color' has feature owner 'feature-scrollbar-owner'
    // and is transcluded in 'visual-design' guides -> category owner 'visual-owner'
    assert.deepStrictEqual(result.sort(), ['feature-scrollbar-owner', 'visual-owner'].sort());
  });

  it('auto-assigns feature group owners and transcluding guide category owners for feature files', () => {
    const config = {
      default: {
        'visual-design': 'visual-owner'
      },
      web_features: {},
      web_features_groups: {
        scrolling: 'scrolling-group-owner'
      }
    };

    const mockFiles = ['features/scrollbar-color.md'];
    const result = handlePR(456, 'some-contributor', config, mockFiles);
    // 'scrollbar-color' belongs to group 'scrolling' -> 'scrolling-group-owner'
    // and is transcluded in 'visual-design' -> 'visual-owner'
    assert.deepStrictEqual(result.sort(), ['scrolling-group-owner', 'visual-owner'].sort());
  });

  it('auto-assigns category owners across multiple categories where a feature is transcluded', () => {
    const config = {
      default: {
        css: 'css-owner',
        forms: 'forms-owner'
      },
      web_features: {
        'user-pseudos': 'user-pseudos-owner'
      },
      web_features_groups: {}
    };

    const mockFiles = ['features/user-pseudos.md'];
    const result = handlePR(456, 'some-contributor', config, mockFiles);
    // 'user-pseudos' is transcluded in css/style-parent-with-has and forms/* guides
    assert.deepStrictEqual(result.sort(), ['user-pseudos-owner', 'css-owner', 'forms-owner'].sort());
  });

  it('excludes author when author is the feature owner or category owner of modified feature file', () => {
    const config = {
      default: {
        css: 'css-owner',
        forms: 'forms-owner'
      },
      web_features: {
        'user-pseudos': 'user-pseudos-owner'
      },
      web_features_groups: {}
    };

    // Author is user-pseudos-owner
    const result1 = handlePR(456, 'user-pseudos-owner', config, ['features/user-pseudos.md']);
    assert.deepStrictEqual(result1.sort(), ['css-owner', 'forms-owner'].sort());

    // Author is forms-owner
    const result2 = handlePR(456, 'forms-owner', config, ['features/user-pseudos.md']);
    assert.deepStrictEqual(result2.sort(), ['user-pseudos-owner', 'css-owner'].sort());
  });

  it('supports custom guides directory for testing transclusion matching in handlePR', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-triage-pr-test-'));
    try {
      const customCategoryDir = path.join(tmpDir, 'custom-category', 'my-guide');
      fs.mkdirSync(customCategoryDir, { recursive: true });
      fs.writeFileSync(
        path.join(customCategoryDir, 'guide.md'),
        '{{ FEATURE("my-feature") }}',
        'utf8'
      );

      const config = {
        default: {
          'custom-category': 'custom-cat-owner'
        },
        web_features: {
          'my-feature': 'my-feature-owner'
        },
        web_features_groups: {}
      };

      const result = handlePR(456, 'some-contributor', config, ['features/my-feature.md'], tmpDir);
      assert.deepStrictEqual(result.sort(), ['my-feature-owner', 'custom-cat-owner'].sort());
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
