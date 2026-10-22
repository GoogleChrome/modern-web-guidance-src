import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getDesiredLabels, buildIssueContent, buildFeatureToIssueMap, buildUseCaseMaps, getFeaturesNeedingSync, buildUseCaseChecklist, updateFeatureIssueBody, USE_CASES_START, USE_CASES_END, REQUIRED_FILES_START, buildRequiredFilesChecklist, preserveTemplateUseCases, reconcileNeedsUseCasesProjectStatus, NEEDS_INVESTIGATION_STATUS, assertSafeNewIssueCount, fetchIssuesByLabel, getProjectDetails } from './sync-use-cases.ts';
import { ProjectStatus, validateGuide, classifyGuide, processGuideInventory, type GuideInventory } from '../core/guide-validation.ts';
import { pendingFeatures } from '../core/baseline.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sync-use-cases-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}


describe('validateGuide', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  function writeTempGuide(content: string, dirName = 'my-use-case'): string {
    const guideDir = path.join(tempDir, dirName);
    if (!fs.existsSync(guideDir)) {
      fs.mkdirSync(guideDir);
    }
    const filePath = path.join(guideDir, 'guide.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  test('returns error for missing file', () => {
    const fakePath = path.join(tempDir, 'does-not-exist.md');
    const result = validateGuide(fakePath);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /Could not read file/);
    assert.strictEqual(result.body, '');
    assert.deepStrictEqual(result.data, {});
    assert.strictEqual(result.filePath, fakePath);
  });

  test('returns error for missing name field', () => {
    const filePath = writeTempGuide(`---
description: A description
web-feature-ids:
  - dialog-closedby
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /Missing "name"/.test(e)));
  });

  test('returns error for missing description field', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
web-feature-ids:
  - dialog-closedby
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /Missing "description"/.test(e)));
  });

  test('returns error for missing web-feature-ids', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /Missing "web-feature-ids"/.test(e)));
  });

  test('returns error when web-feature-ids is not an array', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids: not-an-array
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /"web-feature-ids" must be an array/.test(e)));
  });

  test('returns error for unknown feature ID', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - fake-feature-that-does-not-exist
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.length > 0, 'Should report an error for unknown feature ID');
  });

  test('returns no errors for valid guide', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

Body content.
`);
    const result = validateGuide(filePath);
    assert.deepStrictEqual(result.errors, []);
  });

  test('returns parsed frontmatter data and body', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

Body content here.
`);
    const result = validateGuide(filePath);
    assert.strictEqual(result.data.name, 'my-use-case');
    assert.strictEqual(result.data.description, 'A description');
    assert.deepStrictEqual(result.data['web-feature-ids'], ['dialog-closedby']);
    assert.ok(result.body.includes('Body content here.'));
    assert.strictEqual(result.filePath, filePath);
  });

  test('returns empty body when only frontmatter is present', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---
`);
    const result = validateGuide(filePath);
    assert.strictEqual(result.body.trim(), '');
  });

  test('reports multiple errors when multiple fields are missing', () => {
    const filePath = writeTempGuide(`---
---
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /Missing "name"/.test(e)));
    assert.ok(result.errors.some((e: string) => /Missing "description"/.test(e)));
    assert.ok(result.errors.some((e: string) => /Missing "web-feature-ids"/.test(e)));
  });

  test('returns error for BASELINE_STATUS macro with invalid feature ID', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

{{ BASELINE_STATUS(fake-feature-id) }}
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.length > 0, 'Should report error for invalid feature ID in macro');
  });

  test('returns no errors for BASELINE_STATUS macro with valid feature ID', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

{{ BASELINE_STATUS(dialog-closedby) }}
`);
    const result = validateGuide(filePath);
    assert.deepStrictEqual(result.errors, []);
  });

  test('returns error for BASELINE_STATUS macro with missing args', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

{{ BASELINE_STATUS() }}
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some((e: string) => /BASELINE_STATUS/.test(e)));
  });

  test('supports multiple feature IDs', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
  - view-transitions
---

# My Use Case

Body content.
`);
    const result = validateGuide(filePath);
    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.data['web-feature-ids'], ['dialog-closedby', 'view-transitions']);
  });

  test('reports errors for each invalid feature ID', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - fake-one
  - fake-two
---

# My Use Case

Body content.
`);
    const result = validateGuide(filePath);
    assert.strictEqual(result.errors.length, 2);
  });
});

describe('classifyGuide', () => {
  test('returns "incomplete" when guide body is empty', () => {
    assert.strictEqual(classifyGuide({ hasGuide: false, hasGrader: true, hasTask: true, hasExpectations: true }), 'incomplete');
  });

  test('returns "needs-calibration" or "needs-test" when grader or task is missing', () => {
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: false, hasTask: true, hasExpectations: true }), 'needs-calibration');
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: true, hasTask: false, hasExpectations: true }), 'needs-test');
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: false, hasTask: false, hasExpectations: true }), 'needs-calibration');
  });

  test('returns "complete" when guide is complete', () => {
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: true, hasTask: true, hasExpectations: true }), 'complete');
  });

  test('returns "incomplete" or "needs-expectations" when draft is set or expectations are missing', () => {
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: true, hasTask: true, draft: 'wip', hasExpectations: true }), 'incomplete');
    assert.strictEqual(classifyGuide({ hasGuide: true, hasGrader: true, hasTask: true, hasExpectations: false }), 'needs-expectations');
  });
});

describe('getDesiredLabels', () => {
  test('always includes new-use-case label', () => {
    const labels = getDesiredLabels([], null);
    assert.ok(labels.includes('new-use-case'));
  });

  test('preserves existing labels', () => {
    const labels = getDesiredLabels(['existing-label'], null);
    assert.ok(labels.includes('existing-label'));
    assert.ok(labels.includes('new-use-case'));
  });

  test('does not duplicate new-use-case if already present', () => {
    const labels = getDesiredLabels(['new-use-case'], null);
    assert.strictEqual(labels.filter(l => l === 'new-use-case').length, 1);
  });

  test('adds priority label when one is available', () => {
    const labels = getDesiredLabels(['new-use-case'], 'P1');
    assert.ok(labels.includes('P1'));
  });

  test('does not add priority label when issue already has one', () => {
    const labels = getDesiredLabels(['new-use-case', 'P2'], 'P1');
    assert.ok(!labels.includes('P1'), 'Should not add P1 when P2 already present');
    assert.ok(labels.includes('P2'), 'Should keep existing priority label');
  });

  test('does not add priority label when none is given', () => {
    const labels = getDesiredLabels(['new-use-case'], null);
    assert.ok(!labels.some(l => /^P\d+$/.test(l)));
  });
});

describe('buildFeatureToIssueMap', () => {
  test('returns empty map for empty input', () => {
    assert.strictEqual(buildFeatureToIssueMap([]).size, 0);
  });

  test('maps feature ID to issue number, state, and body', () => {
    const issues = [{ number: 42, body: 'Feature ID: my-feature', labels: [], state: 'open' }];
    const map = buildFeatureToIssueMap(issues);
    assert.deepStrictEqual(map.get('my-feature'), { number: 42, priorityLabel: null, milestoneNumber: null, state: 'open', body: 'Feature ID: my-feature' });
  });

  test('captures closed state', () => {
    const issues = [{ number: 42, body: 'Feature ID: my-feature', labels: [], state: 'closed' }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('my-feature')?.state, 'closed');
  });

  test('uses empty string for null body', () => {
    const issues = [{ number: 42, body: null, labels: [], state: 'open' }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('my-feature')?.body, undefined); // no match without Feature ID
  });

  test('extracts priority label from issue labels', () => {
    const issues = [{ number: 42, body: 'Feature ID: my-feature', labels: [{ name: 'P1' }, { name: 'new-feature' }], state: 'open' }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('my-feature')?.priorityLabel, 'P1');
  });

  test('extracts milestone from issue', () => {
    const issues = [{ number: 42, body: 'Feature ID: my-feature', labels: [], state: 'open', milestone: { number: 3, title: 'MVP' } }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('my-feature')?.milestoneNumber, 3);
  });


  test('ignores issues without a feature ID in the body', () => {
    const issues = [{ number: 42, body: 'No feature ID here', labels: [], state: 'open' }];
    assert.strictEqual(buildFeatureToIssueMap(issues).size, 0);
  });

  test('ignores issues with no body', () => {
    const issues = [{ number: 42, body: null, labels: [], state: 'open' }];
    assert.strictEqual(buildFeatureToIssueMap(issues).size, 0);
  });

  test('handles string labels as well as label objects', () => {
    const issues = [{ number: 42, body: 'Feature ID: my-feature', labels: ['P2', 'new-feature'], state: 'open' }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('my-feature')?.priorityLabel, 'P2');
  });

  test('strips tmp- prefix from feature IDs extracted from issue bodies', () => {
    const issues = [{ number: 1265, body: '### web-feature-id\n\ntmp-scroll-axis-lock', labels: ['P0', 'new-feature'], state: 'open' }];
    const map = buildFeatureToIssueMap(issues);
    assert.strictEqual(map.get('scroll-axis-lock')?.number, 1265);
    assert.strictEqual(map.get('tmp-scroll-axis-lock'), undefined);
  });

  test('prefers open issue over closed duplicate matching the same stripped feature ID', () => {
    const issuesFirstOpen = [
      { number: 100, body: '### web-feature-id\n\nscroll-axis-lock', labels: [], state: 'open' },
      { number: 101, body: '### web-feature-id\n\ntmp-scroll-axis-lock', labels: [], state: 'closed' },
    ];
    assert.strictEqual(buildFeatureToIssueMap(issuesFirstOpen).get('scroll-axis-lock')?.number, 100);

    const issuesSecondOpen = [
      { number: 101, body: '### web-feature-id\n\ntmp-scroll-axis-lock', labels: [], state: 'closed' },
      { number: 100, body: '### web-feature-id\n\nscroll-axis-lock', labels: [], state: 'open' },
    ];
    assert.strictEqual(buildFeatureToIssueMap(issuesSecondOpen).get('scroll-axis-lock')?.number, 100);
  });
});

describe('buildUseCaseMaps', () => {
  test('returns empty maps for empty input', () => {
    const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps([]);
    assert.strictEqual(nameToIssueMap.size, 0);
    assert.strictEqual(subdirToIssueMap.size, 0);
  });

  test('maps use case name from issue title', () => {
    const issue = { number: 1, title: 'Create guide and evals for the my-use-case use case', body: '' };
    const { nameToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(nameToIssueMap.get('my-use-case'), issue);
  });

  test('maps use case name from new-use-case template title and body', () => {
    const issue = {
      number: 2,
      title: 'Create guide for the custom-scrollbars use case',
      body: '### Use case slug\n\ncustom-scrollbars\n\n### Category\n\nvisual-design\n',
    };
    const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(nameToIssueMap.get('custom-scrollbars'), issue);
    assert.strictEqual(subdirToIssueMap.get('guides/visual-design/custom-scrollbars'), issue);
  });

  test('maps subdirectory from issue body', () => {
    const issue = { number: 1, title: 'Some title', body: 'Use case subdir: [guides/html/my-use-case](https://github.com/...)' };
    const { subdirToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(subdirToIssueMap.get('guides/html/my-use-case'), issue);
  });

  test('ignores issues with non-matching title format', () => {
    const issue = { number: 1, title: 'Some unrelated issue', body: '' };
    const { nameToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(nameToIssueMap.size, 0);
  });

  test('handles issues with no body', () => {
    const issue = { number: 1, title: 'Create guide and evals for the my-use-case use case', body: null };
    const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(nameToIssueMap.get('my-use-case'), issue);
    assert.strictEqual(subdirToIssueMap.size, 0);
  });
});

describe('buildRequiredFilesChecklist', () => {
  function makeInventory(overrides: Partial<GuideInventory> = {}): GuideInventory {
    return {
      dir: 'guides/ux/my-use-case',
      name: 'my-use-case',
      category: 'ux',
      hasGuide: false,
      isStub: false,
      hasDemo: false,
      hasExpectations: false,
      expectationsEmpty: false,
      hasNegativeDemo: false,
      hasGrader: false,
      hasTask: false,
      featureIds: [],
      isDisciplineGuide: false,
      isPublished: false,
      ...overrides,
    };
  }

  test('generates unchecked checklist for empty inventory and excludes eval artifacts', () => {
    const inv = makeInventory();
    const result = buildRequiredFilesChecklist(inv);
    assert.ok(result.includes('- [ ] Use case metadata (guide.md frontmatter)'));
    assert.ok(result.includes('- [ ] Use case guidance (guide.md)'));
    assert.ok(result.includes('- [ ] demo.html'));
    assert.ok(result.includes('- [ ] expectations.md'));
    assert.ok(!result.includes('tasks/task.md'));
    assert.ok(!result.includes('negative-demo.html'));
    assert.ok(!result.includes('grader.ts'));
  });

  test('marks checked content files accurately', () => {
    const inv = makeInventory({
      isStub: true,
      hasGuide: true,
      hasDemo: true,
      hasExpectations: true,
      expectationsEmpty: false,
    });
    const result = buildRequiredFilesChecklist(inv);
    assert.ok(result.includes('- [x] Use case metadata (guide.md frontmatter)'));
    assert.ok(result.includes('- [x] Use case guidance (guide.md)'));
    assert.ok(result.includes('- [x] demo.html'));
    assert.ok(result.includes('- [x] expectations.md'));
  });

  test('handles stubs without full guidance', () => {
    const inv = makeInventory({
      isStub: true,
      hasGuide: false,
    });
    const result = buildRequiredFilesChecklist(inv);
    assert.ok(result.includes('- [x] Use case metadata (guide.md frontmatter)'));
    assert.ok(result.includes('- [ ] Use case guidance (guide.md)'));
  });

  test('handles empty expectations', () => {
    const inv = makeInventory({
      hasExpectations: true,
      expectationsEmpty: true,
    });
    const result = buildRequiredFilesChecklist(inv);
    assert.ok(result.includes('- [ ] expectations.md'));
  });

  test('does not check off guide.md and appends draft annotation when draft is truthy', () => {
    const invWip = makeInventory({
      hasGuide: true,
      draft: 'wip',
    });
    assert.ok(buildRequiredFilesChecklist(invWip).includes('- [ ] Use case guidance (guide.md) *(draft: wip)*'));

    const invBlocked = makeInventory({
      hasGuide: true,
      draft: 'blocked',
    });
    const resultBlocked = buildRequiredFilesChecklist(invBlocked);
    assert.ok(resultBlocked.includes('- [ ] Use case guidance (guide.md) *(draft: blocked)*'));

    const invStubDraft = makeInventory({
      hasGuide: false,
      isStub: true,
      draft: 'blocked',
    });
    const resultStubDraft = buildRequiredFilesChecklist(invStubDraft);
    assert.ok(resultStubDraft.includes('- [ ] Use case guidance (guide.md)'));
    assert.ok(!resultStubDraft.includes('*(draft'));
  });
});

describe('buildIssueContent', () => {
  const emptyMap = new Map();
  function makeInventory() {
    return {
      dir: 'guides/ux/my-use-case',
      name: 'my-use-case',
      category: 'ux',
      hasGuide: false,
      isStub: false,
      hasDemo: false,
      hasExpectations: false,
      expectationsEmpty: false,
      hasNegativeDemo: false,
      hasGrader: false,
      hasTask: false,
      featureIds: [],
      isDisciplineGuide: false,
      isPublished: false,
    };
  }

  test('generates correct issue title', () => {
    const { issueTitle } = buildIssueContent('my-use-case', 'A description', [], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.strictEqual(issueTitle, 'Create guide for the my-use-case use case');
  });

  test('includes description in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'A description', [], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.ok(issueBody.startsWith('A description'));
  });

  test('includes subdir link in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', [], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.ok(issueBody.includes('[guides/ux/my-use-case]'));
  });

  test('includes linked feature IDs in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.ok(issueBody.includes('[dialog-closedby](https://webstatus.dev/features/dialog-closedby)'));
  });

  test('returns null priority label and milestone when no features have linked issues', () => {
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.strictEqual(priorityLabel, null);
    assert.strictEqual(milestoneNumber, null);
  });

  test('includes related feature issue links when available', () => {
    const featureMap = new Map([['dialog-closedby', { number: 99, priorityLabel: 'P1', milestoneNumber: 2, state: 'open', body: '' }]]);
    const { issueBody, priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', featureMap, makeInventory());
    assert.ok(issueBody.includes('Related features: #99'));
    assert.strictEqual(priorityLabel, 'P1');
    assert.strictEqual(milestoneNumber, 2);
  });

  test('strips tmp- prefix when matching guide feature IDs to feature issues and generating webstatus links', () => {
    const featureMap = new Map([['scroll-axis-lock', { number: 1265, priorityLabel: 'P0', milestoneNumber: 3, state: 'open', body: '' }]]);
    const { issueBody, priorityLabel, milestoneNumber } = buildIssueContent('diagonal-panning', 'desc', ['tmp-scroll-axis-lock'], 'guides/ui-behaviors/diagonal-panning', featureMap, makeInventory());
    assert.ok(issueBody.includes('Related features: #1265'));
    assert.ok(issueBody.includes('Affected web-feature IDs: [scroll-axis-lock](https://webstatus.dev/features/scroll-axis-lock)'));
    assert.strictEqual(priorityLabel, 'P0');
    assert.strictEqual(milestoneNumber, 3);
  });

  test('uses priority label from first matched feature only when milestones match', () => {
    const featureMap = new Map([
      ['feature-a', { number: 1, priorityLabel: 'P1', milestoneNumber: 1, state: 'open', body: '' }],
      ['feature-b', { number: 2, priorityLabel: 'P2', milestoneNumber: 2, state: 'open', body: '' }],
    ]);
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['feature-a', 'feature-b'], 'guides/ux/my-use-case', featureMap, makeInventory());
    assert.strictEqual(priorityLabel, 'P1');
    assert.strictEqual(milestoneNumber, 1);
  });

  test('inherits priority from feature whose milestone matches existingMilestoneNumber', () => {
    const featureMap = new Map([
      ['feature-a', { number: 1, priorityLabel: 'P0', milestoneNumber: 1, state: 'open', body: '' }],
      ['feature-b', { number: 2, priorityLabel: 'P2', milestoneNumber: 3, state: 'open', body: '' }],
    ]);
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['feature-a', 'feature-b'], 'guides/ux/my-use-case', featureMap, makeInventory(), 3);
    assert.strictEqual(milestoneNumber, 3);
    assert.strictEqual(priorityLabel, 'P2');
  });

  test('inherits milestone and priority when existingMilestoneNumber is null (unassigned existing issue)', () => {
    const featureMap = new Map([
      ['feature-a', { number: 1, priorityLabel: 'P1', milestoneNumber: 3, state: 'open', body: '' }],
    ]);
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['feature-a'], 'guides/ux/my-use-case', featureMap, makeInventory(), null);
    assert.strictEqual(milestoneNumber, 3);
    assert.strictEqual(priorityLabel, 'P1');
  });

  test('omits related features section when no features have linked issues', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.ok(!issueBody.includes('Related features'));
  });

  test('includes the required files checklist', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap, makeInventory());
    assert.ok(issueBody.includes('<!-- required-files-start'));
    assert.ok(issueBody.includes('**Required files:**'));
    assert.ok(issueBody.includes('<!-- required-files-end -->'));
  });
});

describe('getFeaturesNeedingSync', () => {
  function makeFeatureMap(entries: Array<[string, { number: number; state: string }]>) {
    return new Map(entries.map(([id, { number, state }]) => [id, { number, priorityLabel: null, milestoneNumber: null, state, body: '' }]));
  }

  test('returns empty array when feature map is empty', () => {
    const result = getFeaturesNeedingSync(new Map(), new Set(['autofill']), new Set(['autofill']));
    assert.deepStrictEqual(result, []);
  });

  test('skips closed feature with no use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set());
    assert.deepStrictEqual(result, []);
  });

  test('includes open feature issue when it has active use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill']), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], { featureId: 'autofill', issueNumber: 27, closeReason: null, targetStatus: 'Needs use cases' });
  });

  test('never reopens closed feature issue even when it has active use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill']), new Set(['autofill']));
    assert.deepStrictEqual(result, []);
  });

  test('closes open feature as completed when all use cases are implemented', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], { featureId: 'autofill', issueNumber: 27, closeReason: 'completed', targetStatus: null });
  });

  test('sets "Needs use cases" for open feature with no use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set());
    assert.deepStrictEqual(result, [{ featureId: 'autofill', issueNumber: 27, closeReason: null, targetStatus: 'Needs use cases' }]);
  });

  test('skips already-closed feature with all use cases implemented', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set(['autofill']));
    assert.deepStrictEqual(result, []);
  });

  test('handles use case with multiple features, only some with open issues', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    // Use case maps to both 'autofill' and 'css-transitions', but only autofill has an issue
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill', 'css-transitions']), new Set(['autofill', 'css-transitions']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].featureId, 'autofill');
  });

  test('includes only open features when multiple features have active use cases', () => {
    const featureMap = makeFeatureMap([
      ['autofill', { number: 27, state: 'closed' }],
      ['view-transitions', { number: 55, state: 'open' }],
    ]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill', 'view-transitions']), new Set(['autofill', 'view-transitions']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].featureId, 'view-transitions');
    assert.strictEqual(result[0].targetStatus, 'Needs use cases');
  });

  test('closes feature with completed use cases', () => {
    const featureMap = makeFeatureMap([
      ['autofill', { number: 27, state: 'open' }],
    ]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].featureId, 'autofill');
    assert.strictEqual(result[0].closeReason, 'completed');
  });

  test('sets "Needs use cases" for feature with no use cases', () => {
    const featureMap = makeFeatureMap([
      ['view-transitions', { number: 55, state: 'open' }],
    ]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set());
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].featureId, 'view-transitions');
    assert.strictEqual(result[0].targetStatus, 'Needs use cases');
  });

  test('matches feature sets symmetrically regardless of tmp- prefix on map key or set entry', () => {
    const featureMap = makeFeatureMap([['tmp-scroll-axis-lock', { number: 1265, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['scroll-axis-lock']), new Set(['scroll-axis-lock']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].targetStatus, ProjectStatus.NeedsUseCases);
  });
});

describe('buildUseCaseChecklist', () => {
  test('marks completed use cases with [x]', () => {
    const result = buildUseCaseChecklist([{ name: 'sign-up-form', issueNumber: 322, complete: true }]);
    assert.ok(result.includes('- [x] #322'));
  });

  test('marks incomplete use cases with [ ]', () => {
    const result = buildUseCaseChecklist([{ name: 'sign-in-form', issueNumber: 321, complete: false }]);
    assert.ok(result.includes('- [ ] #321'));
  });

  test('skips entries with no issue number', () => {
    const result = buildUseCaseChecklist([{ name: 'new', issueNumber: 0, complete: false }]);
    assert.strictEqual(result, '');
  });

  test('produces one line per use case', () => {
    const result = buildUseCaseChecklist([
      { name: 'a', issueNumber: 1, complete: true },
      { name: 'b', issueNumber: 2, complete: false },
    ]);
    assert.strictEqual(result.split('\n').length, 2);
  });
});

describe('updateFeatureIssueBody', () => {
  const useCases = [
    { name: 'sign-up-form', issueNumber: 322, complete: true },
    { name: 'sign-in-form', issueNumber: 321, complete: false },
  ];

  test('appends checklist section when none exists', () => {
    const body = 'Feature ID: autofill\n\nSome description.';
    const result = updateFeatureIssueBody(body, useCases);
    assert.ok(result.includes(USE_CASES_START));
    assert.ok(result.includes(USE_CASES_END));
    assert.ok(result.startsWith('Feature ID: autofill'));
  });

  test('includes the checklist in the body', () => {
    const result = updateFeatureIssueBody('', useCases);
    assert.ok(result.includes(buildUseCaseChecklist(useCases)));
  });

  test('replaces existing checklist section', () => {
    const body = updateFeatureIssueBody('Feature ID: autofill', [{ name: 'sign-up-form', issueNumber: 322, complete: false }]);
    const result = updateFeatureIssueBody(body, useCases);
    assert.ok(result.includes('- [x] #322'));
    assert.strictEqual(result.indexOf(USE_CASES_START), result.lastIndexOf(USE_CASES_START));
  });

  test('preserves content before and after existing checklist with consistent spacing', () => {
    const body = `Before\n\n${updateFeatureIssueBody('', [{ name: 'old', issueNumber: 1, complete: false }])}\n\nAfter`;
    const result = updateFeatureIssueBody(body, useCases);
    assert.ok(result.startsWith('Before\n\n'));
    assert.ok(result.endsWith('\n\nAfter'));
  });

  test('returns unchanged body if checklist is already up to date', () => {
    const body = updateFeatureIssueBody('Feature ID: autofill', useCases);
    assert.strictEqual(updateFeatureIssueBody(body, useCases), body);
  });
});

describe('processGuideInventory', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    fs.mkdirSync(path.join(tempDir, 'my-use-case'));
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  function makeInventory(overrides: Partial<GuideInventory> = {}): GuideInventory {
    return {
      dir: path.join(tempDir, 'my-use-case'),
      name: 'my-use-case',
      category: 'test',
      hasGuide: true,
      isStub: false,
      hasDemo: true,
      hasExpectations: false,
      expectationsEmpty: false,
      hasNegativeDemo: false,

      hasGrader: false,
      hasTask: false,
      featureIds: [],
      isDisciplineGuide: false,
      isPublished: false,
      ...overrides,
    };
  }

  test('returns exactly one error for one invalid feature ID', () => {
    fs.writeFileSync(path.join(tempDir, 'my-use-case', 'guide.md'), `---
name: my-use-case
description: A description
web-feature-ids:
  - invalid-feature-id-test
---

# My Use Case

Body content.
`);
    const result = processGuideInventory([makeInventory()]);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /invalid-feature-id-test/);
  });

  test('returns no errors for a valid guide', () => {
    fs.writeFileSync(path.join(tempDir, 'my-use-case', 'guide.md'), `---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---

# My Use Case

Body content.
`);
    const result = processGuideInventory([makeInventory()]);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.hasError, false);
    assert.strictEqual(result.preparedGuides.length, 1);
  });

  test('strips tmp- prefix from featuresWithAnyUseCases and featuresWithActiveUseCases', () => {
    pendingFeatures['tmp-mock-feature'] = {
      issue: 'https://github.com/web-platform-dx/web-features/issues/99999'
    };
    try {
      fs.writeFileSync(path.join(tempDir, 'my-use-case', 'guide.md'), `---
name: my-use-case
description: A description
web-feature-ids:
  - tmp-mock-feature
---

# My Use Case

Body content.
`);
      const result = processGuideInventory([makeInventory()]);
      assert.strictEqual(result.errors.length, 0);
      assert.ok(result.featuresWithAnyUseCases.has('mock-feature'));
      assert.ok(result.featuresWithActiveUseCases.has('mock-feature'));
      assert.ok(!result.featuresWithAnyUseCases.has('tmp-mock-feature'));
    } finally {
      delete pendingFeatures['tmp-mock-feature'];
    }
  });
});

describe('preserveTemplateUseCases', () => {
  test('preserves open template-filed new-use-case issues lacking REQUIRED_FILES_START and registers linked features', () => {
    const activeIssueNumbers = new Set<number>([10]);
    const featureUseCaseMap = new Map();
    const featuresWithActiveUseCases = new Set<string>();
    const featuresWithAnyUseCases = new Set<string>();

    const allUseCases = [
      {
        number: 10,
        state: 'open',
        title: 'Create guide and evals for the existing-on-disk use case',
        body: '### web-feature-id\n\ndialog-closedby\n',
      },
      {
        number: 25,
        state: 'open',
        title: 'Create guide for the Custom-Scrollbars use case',
        body: '### Use case slug\n\nCustom-Scrollbars\n\n### Category\n\nvisual-design\n\n### web-feature-id\n\nscrollbar-color, tmp-scroll-axis-lock\n',
      },
      {
        number: 26,
        state: 'open',
        title: 'Create guide and evals for the orphaned-bot-issue use case',
        body: `Some desc\n\n${REQUIRED_FILES_START}\n**Required files:**\n`,
      },
      {
        number: 27,
        state: 'closed',
        title: 'Create guide for the closed-template use case',
        body: '### Use case slug\n\nclosed-template\n',
      },
    ];

    preserveTemplateUseCases(
      allUseCases,
      activeIssueNumbers,
      featureUseCaseMap,
      featuresWithActiveUseCases,
      featuresWithAnyUseCases
    );

    assert.ok(activeIssueNumbers.has(25), 'Should preserve open template issue #25');
    assert.ok(!activeIssueNumbers.has(26), 'Should NOT preserve bot-synced issue #26 that has REQUIRED_FILES_START');
    assert.ok(!activeIssueNumbers.has(27), 'Should NOT preserve closed issue #27');
    assert.ok(featuresWithActiveUseCases.has('scrollbar-color'));
    assert.ok(featuresWithActiveUseCases.has('scroll-axis-lock'));
    assert.deepStrictEqual(featureUseCaseMap.get('scrollbar-color'), [
      { name: 'custom-scrollbars', issueNumber: 25, complete: false },
    ]);
  });
});

describe('reconcileNeedsUseCasesProjectStatus', () => {
  test('moves issues against existing guides out of "Needs use cases" to "Needs investigation" and open use cases to "Needs guidance"', () => {
    const issueStatusMap = new Map<number, string>([
      [1550, ProjectStatus.NeedsUseCases], // new-feature issue -> keep
      [2100, ProjectStatus.NeedsUseCases], // bug/feedback issue against existing guide -> Needs investigation
      [1742, ProjectStatus.NeedsUseCases], // open new-use-case issue -> Needs guidance
      [1200, ProjectStatus.NeedsUseCases], // closed new-use-case issue -> ignore
      [1300, ProjectStatus.NeedsGuidance], // already in Needs guidance -> ignore
    ]);

    const updates = reconcileNeedsUseCasesProjectStatus(
      issueStatusMap,
      [{ number: 1550 }],
      [{ number: 1742, state: 'open' }, { number: 1200, state: 'closed' }],
    );

    assert.deepStrictEqual(
      updates,
      new Map([
        [2100, NEEDS_INVESTIGATION_STATUS],
        [1742, ProjectStatus.NeedsGuidance],
      ])
    );
  });
});

describe('buildUseCaseMaps duplicate resolution', () => {
  test('always prefers the oldest issue (lowest issue number) regardless of iteration order or template format', () => {
    const canonical = {
      number: 263,
      title: 'Create guide and evals for the carousel-slide-effects use case',
      body: 'Use case subdir: [guides/motion/carousel-slide-effects](https://github.com/...)',
    };
    const duplicate = {
      number: 2817,
      title: 'Create guide for the carousel-slide-effects use case',
      body: 'Use case subdir: [guides/motion/carousel-slide-effects](https://github.com/...)',
    };

    const newestFirst = buildUseCaseMaps([duplicate, canonical]);
    assert.strictEqual(newestFirst.nameToIssueMap.get('carousel-slide-effects')?.number, 263);
    assert.strictEqual(newestFirst.subdirToIssueMap.get('guides/motion/carousel-slide-effects')?.number, 263);

    const oldestFirst = buildUseCaseMaps([canonical, duplicate]);
    assert.strictEqual(oldestFirst.nameToIssueMap.get('carousel-slide-effects')?.number, 263);
    assert.strictEqual(oldestFirst.subdirToIssueMap.get('guides/motion/carousel-slide-effects')?.number, 263);

    const templateIssue = {
      number: 2077,
      title: '[Use Case] Quick sign-ins',
      body: '### Category\n\nsecurity\n\n### Use case slug\n\nquick-sign-ins\n',
    };
    const botDuplicate = {
      number: 2555,
      title: 'Create guide for the quick-sign-ins use case',
      body: 'Use case subdir: [guides/security/quick-sign-ins](https://github.com/...)',
    };

    const mixed = buildUseCaseMaps([botDuplicate, templateIssue]);
    assert.strictEqual(mixed.nameToIssueMap.get('quick-sign-ins')?.number, 2077);
    assert.strictEqual(mixed.subdirToIssueMap.get('guides/security/quick-sign-ins')?.number, 2077);
  });
});

describe('assertSafeNewIssueCount', () => {
  test('allows creating issues up to the configured per-run limit', () => {
    assert.doesNotThrow(() => {
      assertSafeNewIssueCount(252, ['new-guide-a', 'new-guide-b'], 15, false);
    });
  });

  test('throws when missing guide count exceeds the per-run limit and allowMassCreate is false', () => {
    const missing = Array.from({ length: 20 }, (_, i) => `guide-${i + 1}`);
    assert.throws(
      () => assertSafeNewIssueCount(252, missing, 15, false),
      /Refusing to create 20 new use-case issues in a single sync run/
    );
  });

  test('allows exceeding the limit when allowMassCreate is true', () => {
    const missing = Array.from({ length: 222 }, (_, i) => `guide-${i + 1}`);
    assert.doesNotThrow(() => {
      assertSafeNewIssueCount(252, missing, 15, true);
    });
  });
});

describe('fetchIssuesByLabel and getProjectDetails pagination resilience', () => {
  test('fetchIssuesByLabel retries intermittent empty pages and verifies totalCount', async () => {
    let page2Attempts = 0;
    const mockGraphql = async (_query: string, variables: Record<string, any>) => {
      if (!variables.cursor) {
        return {
          repository: {
            issues: {
              totalCount: 2,
              pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
              nodes: [
                {
                  number: 263,
                  title: 'Create guide for the carousel-slide-effects use case',
                  body: 'Body 1',
                  state: 'CLOSED',
                  milestone: { number: 3 },
                  labels: { nodes: [{ name: 'new-use-case' }, { name: 'P1' }] },
                },
              ],
            },
          },
        };
      }
      page2Attempts++;
      if (page2Attempts === 1) {
        // Simulate GitHub intermittent empty page response
        return {
          repository: {
            issues: {
              totalCount: 0,
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        };
      }
      return {
        repository: {
          issues: {
            totalCount: 2,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                number: 226,
                title: 'Create guide for the animate-to-intrinsic-sizes use case',
                body: 'Body 2',
                state: 'OPEN',
                milestone: null,
                labels: { nodes: [{ name: 'new-use-case' }] },
              },
            ],
          },
        },
      };
    };

    const issues = await fetchIssuesByLabel(mockGraphql, 'GoogleChrome', 'modern-web-guidance-src', 'new-use-case', {
      maxRetries: 3,
      retryDelayMs: 0,
    });

    assert.strictEqual(page2Attempts, 2);
    assert.strictEqual(issues.length, 2);
    assert.strictEqual(issues[0].number, 263);
    assert.strictEqual(issues[0].state, 'closed');
    assert.deepStrictEqual(issues[0].milestone, { number: 3 });
    assert.deepStrictEqual(issues[0].labels, [{ name: 'new-use-case' }, { name: 'P1' }]);
    assert.strictEqual(issues[1].number, 226);
    assert.strictEqual(issues[1].state, 'open');
  });

  test('fetchIssuesByLabel throws if pagination remains truncated below totalCount after retries', async () => {
    const mockGraphql = async () => ({
      repository: {
        issues: {
          totalCount: 252,
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ number: 2683, title: 'Only 1 issue returned', body: '', state: 'CLOSED', milestone: null, labels: { nodes: [] } }],
        },
      },
    });

    await assert.rejects(
      () =>
        fetchIssuesByLabel(mockGraphql, 'GoogleChrome', 'modern-web-guidance-src', 'new-use-case', {
          maxRetries: 2,
          retryDelayMs: 0,
        }),
      /Truncated pagination for label "new-use-case": fetched 1 of 252 issues/
    );
  });

  test('getProjectDetails retries empty page and returns null if truncated after retries', async () => {
    let attempts = 0;
    const recoveringGraphql = async (_query: string, variables: Record<string, any>) => {
      attempts++;
      if (!variables.cursor && attempts === 1) {
        return {
          organization: {
            projectV2: {
              id: 'PVT_1',
              fields: { nodes: [{ id: 'F_1', name: 'Status', options: [{ id: 'O_1', name: 'Needs guidance' }] }] },
              items: {
                totalCount: 0,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            },
          },
        };
      }
      return {
        organization: {
          projectV2: {
            id: 'PVT_1',
            fields: { nodes: [{ id: 'F_1', name: 'Status', options: [{ id: 'O_1', name: 'Needs guidance' }] }] },
            items: {
              totalCount: 1,
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  content: { number: 313, state: 'OPEN' },
                  fieldValues: { nodes: [{ name: 'Needs guidance', field: { name: 'Status' } }] },
                },
              ],
            },
          },
        },
      };
    };

    const details = await getProjectDetails('GoogleChrome', 30, recoveringGraphql, { maxRetries: 3, retryDelayMs: 0 });
    assert.ok(details);
    assert.strictEqual(details.issueStatusMap.get(313), 'Needs guidance');

    const truncatedGraphql = async () => ({
      organization: {
        projectV2: {
          id: 'PVT_1',
          fields: { nodes: [{ id: 'F_1', name: 'Status', options: [] }] },
          items: {
            totalCount: 200,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ content: { number: 31, state: 'OPEN' }, fieldValues: { nodes: [] } }],
          },
        },
      },
    });

    const failedDetails = await getProjectDetails('GoogleChrome', 30, truncatedGraphql, { maxRetries: 2, retryDelayMs: 0 });
    assert.strictEqual(failedDetails, null);
  });
});


