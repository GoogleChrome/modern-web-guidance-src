import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { type GuideInventory } from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import {
  buildPipelineReportData,
  computeBurndown,
  filterCatchAllReviewers,
  findLegacyFormatGuides,
  findStaleEvals,
  formatShortDate,
  hasSubstantiveExpectationsDiff,
  matchUseCaseIssue,
  parseBurndownCheckpoints,
  parseEvalReportFromPrBody,
  renderPipelineIssueBody,
  type GitFileHistory,
  type IssueSummary,
  type PrSummary,
} from './sync-pipeline-issue.ts';

function makeGuide(overrides: Partial<GuideInventory> = {}): GuideInventory {
  const category = overrides.category ?? 'ui-components';
  const name = overrides.name ?? 'sample-guide';
  const dir = path.join(rootDir, 'guides', category, name);
  return {
    name,
    category,
    dir,
    isStub: false,
    hasGuide: true,
    draft: false,
    isPublished: true,
    hasDemo: true,
    hasNegativeDemo: false,
    hasTask: true,
    hasExpectations: true,
    expectationsEmpty: false,
    hasGrader: true,
    isDisciplineGuide: false,
    targets: [
      {
        name: 'daily-grind',
        dir: path.join(dir, 'targets', 'daily-grind'),
        hasSolution: true,
        hasZeroPassrate: true,
        hasGrader: true,
        hasTask: true,
      },
      {
        name: 'devtools-times',
        dir: path.join(dir, 'targets', 'devtools-times'),
        hasSolution: true,
        hasZeroPassrate: true,
        hasGrader: true,
        hasTask: true,
      },
    ],
    featureIds: ['popover'],
    ...overrides,
  };
}

describe('hasSubstantiveExpectationsDiff', () => {
  it('returns false when only Basic presence lines and blank lines are added or modified', () => {
    const diff = [
      '--- a/guides/css/foo/expectations.md',
      '+++ b/guides/css/foo/expectations.md',
      '@@ -1,3 +1,5 @@',
      '+',
      '+Basic presence: The component renders a visible card.',
      '-* Basic presence: Old basic presence text',
      '+1. Basic presence: Numbered basic presence text',
    ].join('\n');
    assert.equal(hasSubstantiveExpectationsDiff(diff), false);
  });

  it('returns true when a substantive expectation line is added or modified', () => {
    const diff = [
      '--- a/guides/css/foo/expectations.md',
      '+++ b/guides/css/foo/expectations.md',
      '@@ -3,1 +3,2 @@',
      '+Basic presence: The dialog is visible.',
      '+- Pressing Escape closes the popover without losing focus.',
    ].join('\n');
    assert.equal(hasSubstantiveExpectationsDiff(diff), true);
  });
});

describe('parseEvalReportFromPrBody', () => {
  it('extracts dual-target Pass@1 rates and HEALTHY status', () => {
    const body = [
      '# Evaluation Report: drag',
      '',
      '## Target: `daily-grind` (Status: `HEALTHY`)',
      '| Group | Pass Rate | Test Runs |',
      '|---|---|---|',
      '| **Unguided** | 65% (11/17) | 1 |',
      '| **Guided** | 100% (17/17) | 1 |',
      '',
      '## Target: `devtools-times` (Status: `HEALTHY`)',
      '| Group | Pass Rate | Test Runs |',
      '|---|---|---|',
      '| **Unguided** | 50% (8/16) | 1 |',
      '| **Guided** | 100% (16/16) | 1 |',
    ].join('\n');

    assert.deepEqual(parseEvalReportFromPrBody(body), {
      dailyGrindPassRate: 100,
      devtoolsTimesPassRate: 100,
      isHealthy: true,
    });
  });

  it('marks isHealthy false when any target is LOW_GUIDED_PASS_RATE or < 100%', () => {
    const body = [
      '## Target: `daily-grind` (Status: `LOW_GUIDED_PASS_RATE`)',
      '| **Guided** | 83% (10/12) | 1 |',
      '## Target: `devtools-times` (Status: `HEALTHY`)',
      '| **Guided** | 91% (10/11) | 1 |',
    ].join('\n');

    assert.deepEqual(parseEvalReportFromPrBody(body), {
      dailyGrindPassRate: 83,
      devtoolsTimesPassRate: 91,
      isHealthy: false,
    });
  });
});

describe('parseBurndownCheckpoints & computeBurndown', () => {
  it('parses checkpoints from hidden comment or Mermaid bar line', () => {
    assert.deepEqual(
      parseBurndownCheckpoints('hello\n<!-- burndown-checkpoints: [66, 62, 50, 0, 0, 0] -->'),
      [66, 62, 50, 0, 0, 0]
    );
    assert.deepEqual(
      parseBurndownCheckpoints('```mermaid\nxychart-beta\n    bar [66, 61, 0, 0, 0, 0]\n```'),
      [66, 61, 0, 0, 0, 0]
    );
  });

  it('preserves prior week checkpoints and updates current week slot', () => {
    const w2DateMs = Date.parse('2026-10-14T12:00:00Z'); // Week 2
    const burndown = computeBurndown(148, [66, 62, 0, 0, 0, 0], w2DateMs);
    assert.equal(burndown.weekIdx, 2);
    assert.equal(burndown.remaining, 52); // 200 - 148
    assert.deepEqual(burndown.barValues, [66, 62, 52, 0, 0, 0]);
    assert.deepEqual(burndown.xAxisLabels, ['W0', 'W1', 'W2 (Now)', 'W3', 'W4', 'W5']);
    assert.deepEqual(burndown.requiredLine, [66, 62, 52, 35, 17, 0]);
  });
});

describe('findStaleEvals', () => {
  it('flags complete guides with substantive expectations updates after evals and unions open issues', () => {
    const g1 = makeGuide({ category: 'forms', name: 'forms' });
    const g2 = makeGuide({ category: 'css', name: 'trivial-presence-only' });
    const g3 = makeGuide({ category: 'security', name: 'issue-flagged' });

    const history = new Map<string, GitFileHistory>([
      [
        'forms/forms',
        {
          expSha: 'aaa',
          expTs: 200,
          expDate: '2026-10-04',
          expPr: 1676,
          evalSha: 'bbb',
          evalTs: 100,
          evalDate: '2026-05-18',
          isSubstantiveDiff: true,
        },
      ],
      [
        'css/trivial-presence-only',
        {
          expSha: 'ccc',
          expTs: 200,
          expDate: '2026-10-05',
          expPr: 1700,
          evalSha: 'ddd',
          evalTs: 100,
          evalDate: '2026-06-01',
          isSubstantiveDiff: false,
        },
      ],
    ]);

    const openIssues: IssueSummary[] = [
      {
        number: 1685,
        title: 'Expectations changed for the forms guide',
        body: '',
        assignees: [],
        labels: ['expectations-changed'],
      },
      {
        number: 1690,
        title: 'Expectations changed for the issue-flagged guide',
        body: '',
        assignees: [],
        labels: ['expectations-changed'],
      },
    ];

    const stale = findStaleEvals([g1, g2, g3], history, openIssues);
    assert.deepEqual(stale, [
      {
        slug: 'forms/forms',
        expDate: 'Oct 4',
        expPr: 1676,
        evalDate: 'May 18',
        issueNumber: 1685,
      },
      {
        slug: 'security/issue-flagged',
        expDate: 'recently',
        expPr: null,
        evalDate: 'earlier',
        issueNumber: 1690,
      },
    ]);
  });
});

describe('buildPipelineReportData & renderPipelineIssueBody', () => {
  it('routes guides across Stage 2 and Stage 3 and renders markdown with zero @mentions or bare #refs', () => {
    const completeGuide = makeGuide({ category: 'css', name: 'anchor-pos' });
    const stubWithPr = makeGuide({
      category: 'ui-atoms',
      name: 'icons',
      isStub: true,
      hasGuide: false,
      hasDemo: false,
      hasExpectations: false,
      hasGrader: false,
      hasTask: false,
    });
    const stubWithIssue = makeGuide({
      category: 'ui-components',
      name: 'breadcrumbs',
      isStub: true,
      hasGuide: false,
      hasDemo: false,
      hasExpectations: false,
      hasGrader: false,
      hasTask: false,
    });
    const needsEvalWithPr = makeGuide({
      category: 'ui-behaviors',
      name: 'drag',
      hasGrader: false,
      hasTask: false,
    });
    const needsEvalReady = makeGuide({
      category: 'forms',
      name: 'slider',
      hasGrader: false,
      hasTask: false,
    });

    const openPrs: PrSummary[] = [
      {
        number: 1416,
        title: 'Add icons guide',
        body: '',
        isDraft: false,
        headRefName: 'feat/icons',
        author: 'sturobson',
        reviewers: ['LeaVerou'],
        labels: [],
        files: ['guides/ui-atoms/icons/guide.md', 'guides/ui-atoms/icons/demo.html'],
      },
      {
        number: 732,
        title: 'Old PR touching renamed complete guide',
        body: '',
        isDraft: false,
        headRefName: 'old/anchor-pos',
        author: 'someone',
        reviewers: [],
        labels: [],
        files: ['guides/js/anchor-pos/guide.md', 'guides/js/anchor-pos/demo.html'],
      },
      {
        number: 1741,
        title: 'grader updates: drag (daily-grind, devtools-times)',
        body: [
          '## Target: `daily-grind` (Status: `HEALTHY`)',
          '| **Guided** | 100% (17/17) | 1 |',
          '## Target: `devtools-times` (Status: `HEALTHY`)',
          '| **Guided** | 100% (17/17) | 1 |',
        ].join('\n'),
        isDraft: false,
        headRefName: 'gd-dev/drag',
        author: 'micahjo7',
        reviewers: ['TravenReese'],
        labels: ['gd-dev-eval'],
        files: ['guides/ui-behaviors/drag/targets/daily-grind/grader.ts'],
      },
    ];

    const openUseCaseIssues: IssueSummary[] = [
      {
        number: 1222,
        title: 'Create guide and evals for the icons use case',
        body: 'Use case subdir: [guides/ui-atoms/icons]',
        assignees: ['LeaVerou'],
        labels: ['new-use-case'],
      },
      {
        number: 1233,
        title: 'Create guide and evals for the breadcrumbs use case',
        body: 'Use case subdir: [guides/ui-components/breadcrumbs]',
        assignees: ['LeaVerou'],
        labels: ['new-use-case'],
      },
    ];

    const report = buildPipelineReportData({
      guides: [completeGuide, stubWithPr, stubWithIssue, needsEvalWithPr, needsEvalReady],
      openPrs,
      openUseCaseIssues,
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
      existingIssueBody: '<!-- burndown-checkpoints: [66, 62, 0, 0, 0, 0] -->',
      nowMs: Date.parse('2026-10-09T12:00:00Z'),
    });

    assert.equal(report.needsGuidancePrs.length, 1);
    assert.equal(report.needsGuidancePrs[0].slug, 'ui-atoms/icons');
    assert.equal(report.needsGuidanceIssues.length, 1);
    assert.equal(report.needsGuidanceIssues[0].slug, 'ui-components/breadcrumbs');
    assert.equal(report.openEvalPrs.length, 1);
    assert.equal(report.openEvalPrs[0].slug, 'ui-behaviors/drag');
    assert.deepEqual(report.readyForEvalSlugs, ['forms/slider']);

    const markdown = renderPipelineIssueBody(report);
    assert.match(markdown, /## Stage 2: Needs guidance \(2\)/);
    assert.match(markdown, /## Stage 3: Needs evals \(2\)/);
    assert.match(
      markdown,
      /- \[ \] \[\*\*ui-behaviors\/drag\*\*\]\(https:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/tree\/main\/guides\/ui-behaviors\/drag\) · \[PR #1741\]\(https:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/pull\/1741\) · `HEALTHY` · Pass@1: dg 100%, dt 100% · `micahjo7` → `TravenReese`/
    );

    // Ensure zero raw @username mentions anywhere
    assert.doesNotMatch(markdown, /(?:^|[\s(])@[A-Za-z0-9_-]+/);

    // Ensure every #NNNN in list items is inside a markdown link [PR #NNNN] or [#NNNN]
    for (const line of markdown.split('\n')) {
      if (!line.startsWith('- [ ]')) continue;
      const strippedLinks = line.replace(/\[(?:PR )?#\d+\]\([^)]+\)/g, '');
      assert.doesNotMatch(strippedLinks, /#\d+/, `Found bare issue/PR reference in line: ${line}`);
    }
  });

  it('matches template-filed new-use-case issues via Category and Use case slug headers', () => {
    const issue: IssueSummary = {
      number: 1742,
      title: '[Use Case] Custom list markers',
      body: '### Category\n\nui-atoms\n\n### Use case slug\n\ncustom-list-markers\n',
      assignees: ['LeaVerou'],
      labels: ['new-use-case'],
    };
    const matched = matchUseCaseIssue('ui-atoms/custom-list-markers', 'custom-list-markers', [issue], [], []);
    assert.equal(matched?.number, 1742);
    assert.equal(formatShortDate('2026-10-04'), 'Oct 4');
    assert.deepEqual(filterCatchAllReviewers(['paulirish', 'micahjo7', 'LeaVerou'], 'guidance'), ['LeaVerou']);
    assert.deepEqual(filterCatchAllReviewers(['TravenReese', 'micahjo7', 'paulirish'], 'guidance'), ['TravenReese']);
    assert.deepEqual(filterCatchAllReviewers(['TravenReese', 'paulirish'], 'evals'), ['TravenReese']);
  });

  it('identifies legacy root grader.ts guides and computes missing target from tasks/task.md base_app', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-evals-test-'));
    try {
      const dgDir = path.join(tmpRoot, 'css', 'legacy-dg');
      fs.mkdirSync(path.join(dgDir, 'tasks'), { recursive: true });
      fs.writeFileSync(path.join(dgDir, 'grader.ts'), 'export default {};');
      fs.writeFileSync(path.join(dgDir, 'tasks', 'task.md'), '---\nbase_app: daily-grind\n---\n- Prompt');

      const dtDir = path.join(tmpRoot, 'html', 'legacy-dt');
      fs.mkdirSync(path.join(dtDir, 'tasks'), { recursive: true });
      fs.writeFileSync(path.join(dtDir, 'grader.ts'), 'export default {};');
      fs.writeFileSync(path.join(dtDir, 'tasks', 'task.md'), '---\nbase_app: devtools-times\n---\n- Prompt');

      const dualTarget = makeGuide({ category: 'forms', name: 'dual-target' });
      const legacyDg = makeGuide({ category: 'css', name: 'legacy-dg', dir: dgDir, targets: [] });
      const legacyDt = makeGuide({ category: 'html', name: 'legacy-dt', dir: dtDir, targets: [] });

      const result = findLegacyFormatGuides([dualTarget, legacyDt, legacyDg]);
      assert.equal(result.dualTargetCompleteCount, 1);
      assert.deepEqual(result.legacyEvals, [
        { slug: 'css/legacy-dg', missingTarget: 'devtools-times' },
        { slug: 'html/legacy-dt', missingTarget: 'daily-grind' },
      ]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
