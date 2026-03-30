import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ProjectStatus, validateGuide, getStatusName, getIssueStateChanges, getDesiredLabels, buildIssueContent, buildFeatureToIssueMap, buildUseCaseMaps, getFeaturesNeedingSync, buildUseCaseChecklist, updateFeatureIssueBody, processGuideInventory, USE_CASES_START, USE_CASES_END } from './sync-use-cases.ts';
import type { GuideInventory } from '../harness/lib/utils.ts';

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

  function writeTempGuide(content: string): string {
    const filePath = path.join(tempDir, 'guide.md');
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
    assert.ok(result.errors.some(e => /Missing "name"/.test(e)));
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
    assert.ok(result.errors.some(e => /Missing "description"/.test(e)));
  });

  test('returns error for missing web-feature-ids', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
---
Body content.
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some(e => /Missing "web-feature-ids"/.test(e)));
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
    assert.ok(result.errors.some(e => /"web-feature-ids" must be an array/.test(e)));
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
    assert.ok(result.errors.some(e => /Missing "name"/.test(e)));
    assert.ok(result.errors.some(e => /Missing "description"/.test(e)));
    assert.ok(result.errors.some(e => /Missing "web-feature-ids"/.test(e)));
  });

  test('returns error for BASELINE_STATUS macro with invalid feature ID', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---
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
{{ BASELINE_STATUS() }}
`);
    const result = validateGuide(filePath);
    assert.ok(result.errors.some(e => /BASELINE_STATUS/.test(e)));
  });

  test('supports multiple feature IDs', () => {
    const filePath = writeTempGuide(`---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
  - view-transitions
---
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
Body content.
`);
    const result = validateGuide(filePath);
    assert.strictEqual(result.errors.length, 2);
  });
});

describe('getStatusName', () => {
  test('returns "Needs guidance" when guide body is empty', () => {
    assert.strictEqual(getStatusName('', true, true), ProjectStatus.NeedsGuidance);
  });

  test('returns "Needs guidance" when guide body is only whitespace', () => {
    assert.strictEqual(getStatusName('   \n\t  ', true, true), ProjectStatus.NeedsGuidance);
  });

  test('returns "Needs evals" when grader is missing', () => {
    assert.strictEqual(getStatusName('Some content.', false, true), ProjectStatus.NeedsEvals);
  });

  test('returns "Needs evals" when prompts are missing', () => {
    assert.strictEqual(getStatusName('Some content.', true, false), ProjectStatus.NeedsEvals);
  });

  test('returns "Needs evals" when both grader and prompts are missing', () => {
    assert.strictEqual(getStatusName('Some content.', false, false), ProjectStatus.NeedsEvals);
  });

  test('returns null when guide is complete', () => {
    assert.strictEqual(getStatusName('Some content.', true, true), null);
  });

  test('returns "Needs guidance" before "Needs evals" since guidance must come first', () => {
    assert.strictEqual(getStatusName('', false, false), ProjectStatus.NeedsGuidance);
  });
});

describe('getIssueStateChanges', () => {
  test('open issue stays open when incomplete', () => {
    const result = getIssueStateChanges('open', ProjectStatus.NeedsGuidance);
    assert.strictEqual(result.needsClose, false);
    assert.strictEqual(result.needsReopen, false);
  });

  test('open issue is closed when complete', () => {
    const result = getIssueStateChanges('open', null);
    assert.strictEqual(result.needsClose, true);
    assert.strictEqual(result.needsReopen, false);
  });

  test('closed issue is reopened when incomplete', () => {
    const result = getIssueStateChanges('closed', ProjectStatus.NeedsEvals);
    assert.strictEqual(result.needsClose, false);
    assert.strictEqual(result.needsReopen, true);
  });

  test('closed issue stays closed when complete', () => {
    const result = getIssueStateChanges('closed', null);
    assert.strictEqual(result.needsClose, false);
    assert.strictEqual(result.needsReopen, false);
  });

  test('open issue stays open when complete but status is Needs investigation', () => {
    const result = getIssueStateChanges('open', null, ProjectStatus.NeedsInvestigation);
    assert.strictEqual(result.needsClose, false);
    assert.strictEqual(result.needsReopen, false);
  });

  test('closed issue reopens when complete but status is Needs investigation', () => {
    const result = getIssueStateChanges('closed', null, ProjectStatus.NeedsInvestigation);
    assert.strictEqual(result.needsClose, false);
    assert.strictEqual(result.needsReopen, true);
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

  test('maps subdirectory from issue body', () => {
    const issue = { number: 1, title: 'Some title', body: 'Use case subdir: [guides/user-experience/my-use-case](https://github.com/...)' };
    const { subdirToIssueMap } = buildUseCaseMaps([issue]);
    assert.strictEqual(subdirToIssueMap.get('guides/user-experience/my-use-case'), issue);
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

describe('buildIssueContent', () => {
  const emptyMap = new Map();

  test('generates correct issue title', () => {
    const { issueTitle } = buildIssueContent('my-use-case', 'A description', [], 'guides/ux/my-use-case', emptyMap);
    assert.strictEqual(issueTitle, 'Create guide and evals for the my-use-case use case');
  });

  test('includes description in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'A description', [], 'guides/ux/my-use-case', emptyMap);
    assert.ok(issueBody.startsWith('A description'));
  });

  test('includes subdir link in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', [], 'guides/ux/my-use-case', emptyMap);
    assert.ok(issueBody.includes('[guides/ux/my-use-case]'));
  });

  test('includes linked feature IDs in issue body', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap);
    assert.ok(issueBody.includes('[dialog-closedby](https://webstatus.dev/features/dialog-closedby)'));
  });

  test('returns null priority label and milestone when no features have linked issues', () => {
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap);
    assert.strictEqual(priorityLabel, null);
    assert.strictEqual(milestoneNumber, null);
  });

  test('includes related feature issue links when available', () => {
    const featureMap = new Map([['dialog-closedby', { number: 99, priorityLabel: 'P1', milestoneNumber: 2, state: 'open', body: '' }]]);
    const { issueBody, priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', featureMap);
    assert.ok(issueBody.includes('Related features: #99'));
    assert.strictEqual(priorityLabel, 'P1');
    assert.strictEqual(milestoneNumber, 2);
  });

  test('uses priority label from first matched feature only', () => {
    const featureMap = new Map([
      ['feature-a', { number: 1, priorityLabel: 'P1', milestoneNumber: 1, state: 'open', body: '' }],
      ['feature-b', { number: 2, priorityLabel: 'P2', milestoneNumber: 2, state: 'open', body: '' }],
    ]);
    const { priorityLabel, milestoneNumber } = buildIssueContent('my-use-case', 'desc', ['feature-a', 'feature-b'], 'guides/ux/my-use-case', featureMap);
    assert.strictEqual(priorityLabel, 'P1');
    assert.strictEqual(milestoneNumber, 1);
  });

  test('omits related features section when no features have linked issues', () => {
    const { issueBody } = buildIssueContent('my-use-case', 'desc', ['dialog-closedby'], 'guides/ux/my-use-case', emptyMap);
    assert.ok(!issueBody.includes('Related features'));
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
    assert.deepStrictEqual(result[0], { featureId: 'autofill', issueNumber: 27, needsReopen: false, closeReason: null, targetStatus: 'Needs evals' });
  });

  test('flags closed feature issue for reopening when it has active use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill']), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], { featureId: 'autofill', issueNumber: 27, needsReopen: true, closeReason: null, targetStatus: 'Needs evals' });
  });

  test('closes open feature as completed when all use cases are implemented', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], { featureId: 'autofill', issueNumber: 27, needsReopen: false, closeReason: 'completed', targetStatus: null });
  });

  test('sets "Needs use cases" for open feature with no use cases', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set());
    assert.deepStrictEqual(result, [{ featureId: 'autofill', issueNumber: 27, needsReopen: false, closeReason: null, targetStatus: 'Needs use cases' }]);
  });

  test('skips already-closed feature with all use cases implemented', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(), new Set(['autofill']));
    assert.deepStrictEqual(result, []);
  });

  test('handles use case with multiple features, only some with issues', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'closed' }]]);
    // Use case maps to both 'autofill' and 'css-transitions', but only autofill has an issue
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill', 'css-transitions']), new Set(['autofill', 'css-transitions']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].featureId, 'autofill');
  });

  test('includes multiple features when all have active use cases', () => {
    const featureMap = makeFeatureMap([
      ['autofill', { number: 27, state: 'closed' }],
      ['view-transitions', { number: 55, state: 'open' }],
    ]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill', 'view-transitions']), new Set(['autofill', 'view-transitions']));
    assert.strictEqual(result.length, 2);
    assert.ok(result.every(f => f.targetStatus === 'Needs evals'));
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

  test('sets "Needs investigation" for feature with use cases needing investigation', () => {
    const featureMap = makeFeatureMap([['autofill', { number: 27, state: 'open' }]]);
    const result = getFeaturesNeedingSync(featureMap, new Set(['autofill']), new Set(['autofill']), new Set(['autofill']));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].targetStatus, ProjectStatus.NeedsInvestigation);
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
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  function makeInventory(overrides: Partial<GuideInventory> = {}): GuideInventory {
    return {
      dir: tempDir,
      name: 'my-use-case',
      category: 'test',
      hasGuide: true,
      isStub: false,
      hasDemo: true,
      hasExpectations: false,
      expectationsEmpty: false,
      hasNegativeDemo: false,
      hasGrader: false,
      hasPrompts: false,
      hasTask: false,
      featureIds: [],
      ...overrides,
    };
  }

  test('returns exactly one error for one invalid feature ID', () => {
    fs.writeFileSync(path.join(tempDir, 'guide.md'), `---
name: my-use-case
description: A description
web-feature-ids:
  - invalid-feature-id-test
---
Body content.
`);
    const result = processGuideInventory([makeInventory()]);
    assert.strictEqual(result.errors.length, 1);
    assert.match(result.errors[0], /invalid-feature-id-test/);
  });

  test('returns no errors for a valid guide', () => {
    fs.writeFileSync(path.join(tempDir, 'guide.md'), `---
name: my-use-case
description: A description
web-feature-ids:
  - dialog-closedby
---
Body content.
`);
    const result = processGuideInventory([makeInventory()]);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.hasError, false);
    assert.strictEqual(result.preparedGuides.length, 1);
  });
});
