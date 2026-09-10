import { describe, it, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  normalizeLabel,
  handleIssue,
  handlePR,
  findGuidesTranscludingFeature,
  isSmeContentFile,
  isContentRelatedIssue,
  getKnownCategories,
  KNOWN_CATEGORIES,
  extractFeatureIdsFromContent,
  githubApi
} from './atl-triage.ts';
import { getTranscludedFeatureIds, parseArguments } from '../serving/lib/macro-parsing.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Override GitHub tokens with dummy credentials so unmocked tests cannot mutate production resources
process.env.GH_TOKEN = 'fake-test-token';
process.env.GITHUB_TOKEN = 'fake-test-token';

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

describe('isSmeContentFile', () => {
  it('returns true for SME content files in use case directories', () => {
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/guide.md'), true);
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/demo.html'), true);
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/expectations.md'), true);
  });

  it('returns true for discipline-level guides and skills', () => {
    assert.strictEqual(isSmeContentFile('guides/css/css/guide.md'), true);
    assert.strictEqual(isSmeContentFile('guides/modern-web-guidance/SKILL.md'), true);
  });

  it('returns false for evaluation infrastructure and task artifacts', () => {
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/grader.ts'), false);
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/negative-demo.html'), false);
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/tasks/task.md'), false);
    assert.strictEqual(isSmeContentFile('guides/css/style-parent-with-has/targets/daily-grind/grader.ts'), false);
  });

  it('returns false for non-guides or repo config files', () => {
    assert.strictEqual(isSmeContentFile('README.md'), false);
    assert.strictEqual(isSmeContentFile('features/scrollbar-color.md'), false);
    assert.strictEqual(isSmeContentFile('guides/atls.json'), false);
    assert.strictEqual(isSmeContentFile('guides/atl-triage.ts'), false);
  });
});

describe('isContentRelatedIssue', () => {
  it('returns true for content-specific issue labels', () => {
    assert.strictEqual(isContentRelatedIssue(['new-feature'], ''), true);
    assert.strictEqual(isContentRelatedIssue(['new-use-case'], ''), true);
    assert.strictEqual(isContentRelatedIssue(['content'], ''), true);
    assert.strictEqual(isContentRelatedIssue(['gd-dev-content'], ''), true);
  });

  it('returns true for known category and prefix labels', () => {
    assert.strictEqual(isContentRelatedIssue(['accessibility'], ''), true);
    assert.strictEqual(isContentRelatedIssue(['category:performance'], ''), true);
    assert.strictEqual(isContentRelatedIssue(['guide:forms'], ''), true);
  });

  it('returns true when use case subdir pattern is in description', () => {
    const desc = 'Use case subdir: [guides/css/style-parent-with-has](https://github.com/...)';
    assert.strictEqual(isContentRelatedIssue([], desc), true);
  });

  it('returns true when web-feature ID is in description', () => {
    const desc = '### web-feature-id\ncanvas-html';
    assert.strictEqual(isContentRelatedIssue([], desc), true);
  });

  it('returns false for non-content issues without content signals', () => {
    assert.strictEqual(isContentRelatedIssue(['Tooling'], 'Fix the CLI bug on Windows'), false);
    assert.strictEqual(isContentRelatedIssue(['dependencies'], 'Bump typescript to 5.8'), false);
  });

  it('detects dynamically discovered categories from custom guides directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-cat-test-'));
    try {
      const customCategoryDir = path.join(tmpDir, 'custom-cat', 'sample-guide');
      fs.mkdirSync(customCategoryDir, { recursive: true });
      fs.writeFileSync(path.join(customCategoryDir, 'guide.md'), '# Custom Guide\n', 'utf8');

      assert.strictEqual(isContentRelatedIssue(['category:custom-cat'], '', undefined, tmpDir), true);
      assert.strictEqual(isContentRelatedIssue(['custom-cat'], '', undefined, tmpDir), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('getKnownCategories', () => {
  it('includes fallback categories and static categories', () => {
    const categories = getKnownCategories();
    assert.ok(categories.has('css'));
    assert.ok(categories.has('pwa'));
    assert.ok(categories.has('performance'));
    assert.ok(categories.has('accessibility'));
    assert.ok(categories.has('motion'));
    assert.ok(!categories.has('lib'));
    assert.ok(!categories.has('modern-web-guidance'));

    assert.ok(KNOWN_CATEGORIES.has('css'));
    assert.ok(KNOWN_CATEGORIES.has('pwa'));
  });

  it('includes categories from atlConfig.default', () => {
    const config = {
      default: {
        'brand-new-category': 'someone'
      },
      web_features: {},
      web_features_groups: {}
    };
    const categories = getKnownCategories(undefined, config);
    assert.ok(categories.has('brand-new-category'));
  });

  it('discovers categories containing use case guides from filesystem', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-discover-cat-'));
    try {
      // Category with use case
      const guideDir = path.join(tmpDir, 'dynamic-category', 'my-use-case');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Guide\n', 'utf8');

      // Non-category dir (e.g. lib or ignored)
      const libDir = path.join(tmpDir, 'lib');
      fs.mkdirSync(libDir, { recursive: true });
      fs.writeFileSync(path.join(libDir, 'util.ts'), 'export const x = 1;\n', 'utf8');

      const categories = getKnownCategories(tmpDir);
      assert.ok(categories.has('dynamic-category'));
      assert.ok(!categories.has('lib'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
  let addIssueLabelsMock: any;
  let removeIssueLabelsMock: any;
  let issueUnlabeledMock: any;

  before(() => {
    unassignedMock = mock.method(githubApi, 'getIssueUnassignedLogins', () => []);
    assigneesMock = mock.method(githubApi, 'getIssueCurrentAssignees', () => []);
    addAssigneesMock = mock.method(githubApi, 'addIssueAssignees', () => {});
    addIssueLabelsMock = mock.method(githubApi, 'addIssueLabels', () => {});
    removeIssueLabelsMock = mock.method(githubApi, 'removeIssueLabels', () => {});
    issueUnlabeledMock = mock.method(githubApi, 'getIssueUnlabeledEvents', () => []);
  });

  beforeEach(() => {
    unassignedMock.mock.mockImplementation(() => []);
    assigneesMock.mock.mockImplementation(() => []);
    issueUnlabeledMock.mock.mockImplementation(() => []);
    addAssigneesMock.mock.resetCalls();
    addIssueLabelsMock.mock.resetCalls();
    removeIssueLabelsMock.mock.resetCalls();
  });

  after(() => {
    unassignedMock.mock.restore();
    assigneesMock.mock.restore();
    addAssigneesMock.mock.restore();
    addIssueLabelsMock.mock.restore();
    removeIssueLabelsMock.mock.restore();
    issueUnlabeledMock.mock.restore();
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

  it('does not assign an ATL from a mere keyword mention in prose', () => {
    const description = `This is an issue about canvas-html feature implementation.`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, []);
  });

  it('does not assign an ATL from a group keyword mention in prose', () => {
    // scroll-driven-animations belongs to 'scrolling'
    const description = `Let's add support for scroll-driven-animations!`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, []);
  });

  it('combines ATLs from both labels and structured description features without duplicates', () => {
    // 'category:performance' label maps to ['rviscomi', 'paulirish']
    // 'canvas-html' inside description maps to 'override-issue-reviewer'
    const description = `
Please look at behavior under load.

**Web Feature ID**: canvas-html
`;
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

  it('does not assign an ATL just because prose text mentions a category or feature group keyword like transitions', () => {
    const description = `We should ensure smooth page transitions and responsive interactions when navigating between tabs.`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, []);
  });

  it('assigns the category ATL if the issue is a use case under that category', () => {
    const description = `Use case subdir: [guides/css-layout/some-use-case](https://github.com/...)`;
    const result = handleIssue(123, [], description, mockConfig);
    assert.deepStrictEqual(result, ['malchata']);
  });

  it('assigns both the category ATL and feature override ATL for use case issues', () => {
    const description = `
Use case subdir: [guides/css-layout/some-use-case](https://github.com/...)
Affected web-feature IDs: [canvas-html](https://webstatus.dev/features/canvas-html)
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
      assert.strictEqual(addIssueLabelsMock.mock.callCount(), 0);
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

  it('labels content issue with needs-atl when new-feature issue has no matching ATL', () => {
    addIssueLabelsMock.mock.resetCalls();
    const result = handleIssue(123, ['new-feature'], 'Some unknown feature description', mockConfig);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 1);
    assert.deepStrictEqual(addIssueLabelsMock.mock.calls[0].arguments, [123, ['needs-atl']]);
  });

  it('labels content issue with needs-atl when new-use-case is under category without an ATL', () => {
    addIssueLabelsMock.mock.resetCalls();
    const description = 'Use case subdir: [guides/unknown-category/my-use-case](https://github.com/...)';
    const result = handleIssue(123, ['new-use-case'], description, mockConfig);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 1);
    assert.deepStrictEqual(addIssueLabelsMock.mock.calls[0].arguments, [123, ['needs-atl']]);
  });

  it('does not re-add needs-atl label if it was previously removed from the issue', () => {
    issueUnlabeledMock.mock.mockImplementation(() => ['needs-atl']);
    const result = handleIssue(123, ['new-feature'], 'Some unknown feature description', mockConfig);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 0);
  });

  it('does not label with needs-atl when ATL is found and assigned', () => {
    addIssueLabelsMock.mock.resetCalls();
    const result = handleIssue(123, ['category:performance'], '', mockConfig);
    assert.deepStrictEqual(result.sort(), ['paulirish', 'rviscomi'].sort());
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 0);
  });

  it('removes needs-atl label when ATL is found for an issue that previously had needs-atl', () => {
    removeIssueLabelsMock.mock.resetCalls();
    const result = handleIssue(123, ['category:performance', 'needs-atl'], '', mockConfig);
    assert.deepStrictEqual(result.sort(), ['paulirish', 'rviscomi'].sort());
    assert.strictEqual(removeIssueLabelsMock.mock.callCount(), 1);
    assert.deepStrictEqual(removeIssueLabelsMock.mock.calls[0].arguments, [123, ['needs-atl']]);
  });

  it('removes needs-atl label and assigns LeaVerou when css label is added to new-feature issue', () => {
    removeIssueLabelsMock.mock.resetCalls();
    addAssigneesMock.mock.resetCalls();
    const configWithCss = {
      ...mockConfig,
      default: {
        ...mockConfig.default,
        css: 'LeaVerou'
      }
    };
    const result = handleIssue(123, ['new-feature', 'needs-atl', 'css'], '', configWithCss);
    assert.deepStrictEqual(result, ['LeaVerou']);
    assert.strictEqual(removeIssueLabelsMock.mock.callCount(), 1);
    assert.deepStrictEqual(removeIssueLabelsMock.mock.calls[0].arguments, [123, ['needs-atl']]);
    assert.strictEqual(addAssigneesMock.mock.callCount(), 1);
    assert.deepStrictEqual(addAssigneesMock.mock.calls[0].arguments, [123, ['LeaVerou']]);
  });

  it('removes needs-atl label when a recognized ATL is already assigned to the issue', () => {
    removeIssueLabelsMock.mock.resetCalls();
    assigneesMock.mock.mockImplementation(() => ['LeaVerou']);
    const configWithCss = {
      ...mockConfig,
      default: {
        ...mockConfig.default,
        css: 'LeaVerou'
      }
    };
    // No css label, but LeaVerou is already an assignee
    handleIssue(123, ['new-feature', 'needs-atl'], '', configWithCss);
    assert.strictEqual(removeIssueLabelsMock.mock.callCount(), 1);
    assert.deepStrictEqual(removeIssueLabelsMock.mock.calls[0].arguments, [123, ['needs-atl']]);
  });

  it('does not label non-content issues with needs-atl', () => {
    addIssueLabelsMock.mock.resetCalls();
    const result = handleIssue(123, ['Tooling'], 'Fix the CLI bug on Windows', mockConfig);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 0);
  });

  it('respects dryRun option and does not call modifying githubApi methods', () => {
    addIssueLabelsMock.mock.resetCalls();
    addAssigneesMock.mock.resetCalls();
    const result = handleIssue(123, ['category:performance'], '', mockConfig, { dryRun: true });
    assert.deepStrictEqual(result.sort(), ['paulirish', 'rviscomi'].sort());
    assert.strictEqual(addIssueLabelsMock.mock.callCount(), 0);
    assert.strictEqual(addAssigneesMock.mock.callCount(), 0);
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
  let addPrLabelsMock: any;
  let removePrLabelsMock: any;
  let getPrUnlabeledMock: any;
  let getPrRemovedReviewersMock: any;
  let getPrIsDraftMock: any;

  before(() => {
    addReviewersMock = mock.method(githubApi, 'addPrReviewers', () => {});
    addPrLabelsMock = mock.method(githubApi, 'addPrLabels', () => {});
    removePrLabelsMock = mock.method(githubApi, 'removePrLabels', () => {});
    getPrUnlabeledMock = mock.method(githubApi, 'getPrUnlabeledEvents', () => []);
    getPrRemovedReviewersMock = mock.method(githubApi, 'getPrRemovedReviewers', () => []);
    getPrIsDraftMock = mock.method(githubApi, 'getPrIsDraft', () => false);
  });

  beforeEach(() => {
    addReviewersMock.mock.resetCalls();
    addPrLabelsMock.mock.resetCalls();
    removePrLabelsMock.mock.resetCalls();
    getPrIsDraftMock.mock.resetCalls();
    getPrUnlabeledMock.mock.mockImplementation(() => []);
    getPrRemovedReviewersMock.mock.mockImplementation(() => []);
    getPrIsDraftMock.mock.mockImplementation(() => false);
  });

  after(() => {
    addReviewersMock.mock.restore();
    addPrLabelsMock.mock.restore();
    removePrLabelsMock.mock.restore();
    getPrUnlabeledMock.mock.restore();
    getPrRemovedReviewersMock.mock.restore();
    getPrIsDraftMock.mock.restore();
  });

  it('requests review from matching ATLs for content files', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/guide.md', // Has 'image-set' feature, will be overridden!
      'guides/motion/carousel-slide-effects/expectations.md',
      'guides/css-layout/grid-layout/guide.md',
      'guides/css-layout/grid-layout/other-file.json' // shouldn't trigger
    ];

    const result = handlePR(99999, 'some-contributor', mockConfig, mockFiles);
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
    const result = handlePR(99999, 'override-pr-reviewer', mockConfig, mockFiles);
    assert.deepStrictEqual(result.sort(), ['rviscomi', 'paulirish', 'philipwalton'].sort());
  });

  it('returns empty array when no content files are touched and gd-dev-content label is not set', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/tasks/task.md',
      'guides/performance/deliver-optimized-decorative-images/targets/daily-grind/grader.ts',
      'README.md'
    ];

    const result = handlePR(99999, 'some-contributor', mockConfig, mockFiles, undefined, ['gd-dev-eval']);
    assert.deepStrictEqual(result, []);
  });

  it('requests review from ATL and labels content when demo.html is modified, even with gd-dev-eval label', () => {
    addPrLabelsMock.mock.resetCalls();
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/demo.html'
    ];

    const filesMock = mock.method(githubApi, 'getPrFiles', () => mockFiles);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      const result = handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, ['gd-dev-eval']);
      assert.deepStrictEqual(result.sort(), ['override-pr-reviewer', 'rviscomi', 'paulirish'].sort());
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('assigns corresponding ATL when gd-dev-content label is present even if only target eval files were touched', () => {
    const mockFiles = [
      'guides/performance/deliver-optimized-decorative-images/targets/daily-grind/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/targets/daily-grind/patches/zero-passrate.patch',
      'guides/motion/carousel-slide-effects/targets/daily-grind/task.md'
    ];

    const result = handlePR(99999, 'some-contributor', mockConfig, mockFiles, undefined, ['gd-dev-content']);
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
      const result = handlePR(99999, 'some-contributor', mockConfig);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('filters out reviewers whose review request was previously removed case-insensitively', () => {
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({
      reviewRequests: [],
      reviews: []
    }));
    getPrRemovedReviewersMock.mock.mockImplementation(() => ['Malchata']);

    try {
      const result = handlePR(99999, 'some-contributor', mockConfig);
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
    const result = handlePR(99999, 'some-contributor', config, mockFiles);
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
    const result = handlePR(99999, 'some-contributor', config, mockFiles);
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
    const result = handlePR(99999, 'some-contributor', config, mockFiles);
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
    const result1 = handlePR(99999, 'user-pseudos-owner', config, ['features/user-pseudos.md']);
    assert.deepStrictEqual(result1.sort(), ['css-owner', 'forms-owner'].sort());

    // Author is forms-owner
    const result2 = handlePR(99999, 'forms-owner', config, ['features/user-pseudos.md']);
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

      const result = handlePR(99999, 'some-contributor', config, ['features/my-feature.md'], tmpDir);
      assert.deepStrictEqual(result.sort(), ['my-feature-owner', 'custom-cat-owner'].sort());
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('labels PR with content when touching guide.md', () => {
    addPrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('labels PR with content when touching demo.html', () => {
    addPrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/demo.html'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('labels PR with content when touching expectations.md', () => {
    addPrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/expectations.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('does not label PR with content when touching only eval files', () => {
    addPrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/performance/deliver-optimized-decorative-images/grader.ts',
      'guides/performance/deliver-optimized-decorative-images/tasks/task.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('does not re-add content label if already present', () => {
    addPrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, ['content']);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('does not re-add content label if it was previously removed from the PR', () => {
    getPrUnlabeledMock.mock.mockImplementation(() => ['content']);
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('labels PR with needs-atl when touching content with no configured ATL', () => {
    addPrLabelsMock.mock.resetCalls();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-triage-pr-no-atl-'));
    try {
      const guideDir = path.join(tmpDir, 'no-atl-category', 'some-guide');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, 'guide.md'), '# No ATL Guide\n', 'utf8');

      const emptyConfig = { default: {}, web_features: {}, web_features_groups: {} };
      const filesMock = mock.method(githubApi, 'getPrFiles', () => [
        'guides/no-atl-category/some-guide/guide.md'
      ]);
      const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));

      try {
        handlePR(99999, 'some-contributor', emptyConfig, undefined, tmpDir);
        assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
        assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content', 'needs-atl']]);
      } finally {
        filesMock.mock.restore();
        reviewStateMock.mock.restore();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('labels PR with content and needs-atl when touching demo.html in a category with no ATL', () => {
    addPrLabelsMock.mock.resetCalls();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-demo-test-'));
    try {
      const guideDir = path.join(tmpDir, 'no-atl-category', 'some-guide');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, 'guide.md'), '# No ATL Guide\n', 'utf8');
      fs.writeFileSync(path.join(guideDir, 'demo.html'), '<!DOCTYPE html><html></html>\n', 'utf8');

      const emptyConfig = { default: {}, web_features: {}, web_features_groups: {} };
      const filesMock = mock.method(githubApi, 'getPrFiles', () => [
        'guides/no-atl-category/some-guide/demo.html'
      ]);
      const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));

      try {
        handlePR(99999, 'some-contributor', emptyConfig, undefined, tmpDir);
        assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
        assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content', 'needs-atl']]);
      } finally {
        filesMock.mock.restore();
        reviewStateMock.mock.restore();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does not re-add needs-atl label if it was previously removed from the PR', () => {
    getPrUnlabeledMock.mock.mockImplementation(() => ['needs-atl']);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-triage-pr-unlabeled-'));
    try {
      const guideDir = path.join(tmpDir, 'no-atl-category', 'some-guide');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, 'guide.md'), '# No ATL Guide\n', 'utf8');

      const emptyConfig = { default: {}, web_features: {}, web_features_groups: {} };
      const filesMock = mock.method(githubApi, 'getPrFiles', () => [
        'guides/no-atl-category/some-guide/guide.md'
      ]);
      const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));

      try {
        handlePR(99999, 'some-contributor', emptyConfig, undefined, tmpDir);
        // Only 'content' should be added, 'needs-atl' should be skipped because it was previously removed
        assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
        assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
      } finally {
        filesMock.mock.restore();
        reviewStateMock.mock.restore();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('removes needs-atl label when ATL is found on a PR that had needs-atl', () => {
    removePrLabelsMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, ['needs-atl']);
      assert.strictEqual(removePrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(removePrLabelsMock.mock.calls[0].arguments, [99999, ['needs-atl']]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('respects dryRun option and does not call modifying githubApi methods', () => {
    addPrLabelsMock.mock.resetCalls();
    addReviewersMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      const result = handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, [], { dryRun: true });
      assert.deepStrictEqual(result, ['malchata']);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('fetches guide content from PR ref via getPrFileContent when guide does not exist locally (fork PR)', () => {
    addPrLabelsMock.mock.resetCalls();
    addReviewersMock.mock.resetCalls();

    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/custom-fork-category/new-guide/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    const getPrFileContentMock = mock.method(githubApi, 'getPrFileContent', (_prNumber: number, filePath: string) => {
      if (filePath === 'guides/custom-fork-category/new-guide/guide.md') {
        return `---
name: new-guide
web-feature-ids:
  - user-pseudos
---
# New Guide from Fork
`;
      }
      return null;
    });

    const customConfig = {
      default: {
        'custom-fork-category': 'category-owner'
      },
      web_features: {
        'user-pseudos': 'feature-pseudos-owner'
      },
      web_features_groups: {}
    };

    try {
      const result = handlePR(789, 'fork-contributor', customConfig);
      assert.strictEqual(getPrFileContentMock.mock.callCount(), 1);
      assert.deepStrictEqual(result.sort(), ['category-owner', 'feature-pseudos-owner'].sort());
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [789, ['content']]);
      assert.strictEqual(addReviewersMock.mock.callCount(), 1);
      assert.deepStrictEqual(addReviewersMock.mock.calls[0].arguments, [789, result]);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
      getPrFileContentMock.mock.restore();
    }
  });

  it('skips triage if PR is in draft mode via options.isDraft', () => {
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      const result = handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, [], { isDraft: true });
      assert.deepStrictEqual(result, []);
      assert.strictEqual(filesMock.mock.callCount(), 0);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('skips triage if PR is detected as draft via githubApi.getPrIsDraft', () => {
    getPrIsDraftMock.mock.mockImplementation(() => true);
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/css-layout/grid-layout/guide.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    try {
      const result = handlePR(99999, 'some-contributor', mockConfig);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(getPrIsDraftMock.mock.callCount(), 1);
      assert.strictEqual(filesMock.mock.callCount(), 0);
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 0);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
    }
  });

  it('does not construct bogus guide paths or request reviews for guides/modern-web-guidance/SKILL.md', () => {
    addPrLabelsMock.mock.resetCalls();
    addReviewersMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/modern-web-guidance/SKILL.md'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    const getPrFileContentMock = mock.method(githubApi, 'getPrFileContent', () => null);

    try {
      const result = handlePR(99999, 'some-contributor', mockConfig);
      assert.deepStrictEqual(result, []);
      // Should label content because touchesSmeContent is true
      assert.strictEqual(addPrLabelsMock.mock.callCount(), 1);
      assert.deepStrictEqual(addPrLabelsMock.mock.calls[0].arguments, [99999, ['content']]);
      // Should NOT try to fetch guides/modern-web-guidance/SKILL.md/guide.md
      assert.strictEqual(getPrFileContentMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
      getPrFileContentMock.mock.restore();
    }
  });

  it('skips non-category directories like guides/lib when resolving guides', () => {
    addPrLabelsMock.mock.resetCalls();
    addReviewersMock.mock.resetCalls();
    const filesMock = mock.method(githubApi, 'getPrFiles', () => [
      'guides/lib/guide-validation.ts'
    ]);
    const reviewStateMock = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    const getPrFileContentMock = mock.method(githubApi, 'getPrFileContent', () => null);

    try {
      const result = handlePR(99999, 'some-contributor', mockConfig, undefined, undefined, ['content']);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(getPrFileContentMock.mock.callCount(), 0);
      assert.strictEqual(addReviewersMock.mock.callCount(), 0);
    } finally {
      filesMock.mock.restore();
      reviewStateMock.mock.restore();
      getPrFileContentMock.mock.restore();
    }
  });
});

describe('extractFeatureIdsFromContent', () => {
  it('extracts web-feature-ids correctly from frontmatter', () => {
    const markdown = `---
name: test-guide
web-feature-ids:
  - accent-color
  - indeterminate
  - masks
description: Some description
---
# Content
`;
    const featureIds = extractFeatureIdsFromContent(markdown);
    assert.deepStrictEqual(featureIds, ['accent-color', 'indeterminate', 'masks']);
  });

  it('returns empty array when frontmatter or web-feature-ids are missing', () => {
    assert.deepStrictEqual(extractFeatureIdsFromContent('# Just Markdown'), []);
    assert.deepStrictEqual(extractFeatureIdsFromContent('---\nname: foo\n---\n'), []);
  });
});
