import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { type GuideInventory } from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import {
  buildPipelineReportData,
  classifyPr,
  computeBurndown,
  filterCatchAllReviewers,
  findLegacyFormatGuides,
  findStaleEvals,
  formatShortDate,
  hasSubstantiveExpectationsDiff,
  isDisciplinePr,
  matchUseCaseIssue,
  parseBurndownCheckpoints,
  parseEvalReportFromPrBody,
  renderPipelineIssueBody,
  renderProgressBar,
  renderTrendTable,
  sparkline,
  SPARKLINE_TICKS,
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
      /\*\*Eval Coverage \(3 finished guides\):\*\* \*\*1 \/ 3 \(33%\)\*\* covered — \*\*1 Gen 2\*\* \(`targets\/`\) · \*\*0 Gen 1\*\* \(legacy root `grader\.ts`\) · \*\*2 Missing evals\*\*/
    );
    assert.match(markdown, /### Gen 1 → Gen 2 Eval Migration \(`1` Gen 2 · `0` Gen 1\)/);
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
      const singleTarget = makeGuide({
        category: 'forms',
        name: 'single-target',
        targets: [
          {
            name: 'daily-grind',
            dir: '/tmp/guides/forms/single-target/targets/daily-grind',
            hasSolution: true,
            hasZeroPassrate: true,
            hasGrader: true,
            hasTask: true,
          },
        ],
      });
      const legacyDg = makeGuide({ category: 'css', name: 'legacy-dg', dir: dgDir, targets: [] });
      const legacyDt = makeGuide({ category: 'html', name: 'legacy-dt', dir: dtDir, targets: [] });

      const result = findLegacyFormatGuides([dualTarget, singleTarget, legacyDt, legacyDg]);
      assert.equal(result.gen2CompleteCount, 2);
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

describe('renderProgressBar', () => {
  it('renders exactly 50 columns with header and only █, ░, · glyphs', () => {
    const res = renderProgressBar({ complete: 140, inReview: 13, goal: 200, barWidth: 50 });
    assert.equal(res.header, '140 landed · 13 in review · 47 to go → 200');
    assert.equal(res.bar.length, 50);
    // 140/4 = 35 landed complete (█), 13/4 = 3 in review (░), 47/4 = 12 remaining (·)
    assert.equal(res.bar, '█'.repeat(35) + '░'.repeat(3) + '·'.repeat(12));
    assert.doesNotMatch(res.text, /▲/);
    assert.doesNotMatch(res.text, /[\u{1F300}-\u{1F9FF}]/u);
  });

  it('handles rounding across varied complete and in-review counts preserving exact 50 cols', () => {
    const testCases = [
      { complete: 0, inReview: 0, expectedCols: 50 },
      { complete: 1, inReview: 0, expectedCols: 50 },
      { complete: 141, inReview: 15, expectedCols: 50 },
      { complete: 50, inReview: 50, expectedCols: 50 },
      { complete: 100, inReview: 25, expectedCols: 50 },
      { complete: 180, inReview: 10, expectedCols: 50 },
      { complete: 198, inReview: 1, expectedCols: 50 },
    ];
    for (const tc of testCases) {
      const res = renderProgressBar({ complete: tc.complete, inReview: tc.inReview, goal: 200, barWidth: 50 });
      assert.equal(res.bar.length, tc.expectedCols, `Failed exact width for complete=${tc.complete}, inReview=${tc.inReview}`);
      assert.equal(res.bar.replace(/[█░·]/g, '').length, 0, `Found unexpected glyph in bar: ${res.bar}`);
    }
  });

  it('reserves at least 1 remaining column when not yet reached goal despite rounding', () => {
    // 199/4 = 49.75 -> 50. Since toGo = 1, should keep 1 remaining column
    const res = renderProgressBar({ complete: 199, inReview: 0, goal: 200, barWidth: 50 });
    assert.equal(res.bar.length, 50);
    assert.equal(res.header, '199 landed · 0 in review · 1 to go → 200');
    assert.equal(res.bar.endsWith('·'), true);
  });

  it('handles over-goal cases without breaking and caps at exact barWidth', () => {
    const overGoal1 = renderProgressBar({ complete: 200, inReview: 0, goal: 200, barWidth: 50 });
    assert.equal(overGoal1.header, '200 landed · 0 in review · 0 to go → 200');
    assert.equal(overGoal1.bar, '█'.repeat(50));
    assert.equal(overGoal1.bar.length, 50);

    const overGoal2 = renderProgressBar({ complete: 215, inReview: 10, goal: 200, barWidth: 50 });
    assert.equal(overGoal2.header, '215 landed · 10 in review · 0 to go → 200');
    assert.equal(overGoal2.bar, '█'.repeat(50));
    assert.equal(overGoal2.bar.length, 50);

    const overGoal3 = renderProgressBar({ complete: 180, inReview: 30, goal: 200, barWidth: 50 });
    assert.equal(overGoal3.header, '180 landed · 30 in review · 0 to go → 200');
    assert.equal(overGoal3.bar.length, 50);
    assert.equal(overGoal3.bar, '█'.repeat(45) + '░'.repeat(5));
  });
});

describe('sparkline & renderTrendTable', () => {
  it('scales values across min and max using standard block glyphs', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7];
    const spark = sparkline(values);
    assert.equal(spark, '▁▂▃▄▅▆▇█');
    assert.equal(spark.length, 8);
  });

  it('renders constant glyph for flat series where min equals max', () => {
    const flat = [42, 42, 42, 42, 42];
    const spark = sparkline(flat);
    assert.equal(spark, SPARKLINE_TICKS[3].repeat(5));
    assert.equal(spark.length, 5);
  });

  it('produces exactly 21 chars for 21 daily data points', () => {
    const dailyPoints = Array.from({ length: 21 }, (_, i) => 120 + i);
    const spark = sparkline(dailyPoints);
    assert.equal(spark.length, 21);
  });

  it('renders a formatted trend table with headers and 7d delta', () => {
    const rows = [
      { label: 'Complete (landed)', values: Array.from({ length: 21 }, (_, i) => 130 + i) },
      { label: 'Eval PRs in review', values: Array.from({ length: 21 }, () => 10) },
      { label: 'Ready for evals', values: Array.from({ length: 21 }, (_, i) => 25 - Math.floor(i / 2)) },
      { label: 'Guide PRs in review', values: Array.from({ length: 21 }, (_, i) => 20 + (i % 3)) },
      { label: 'Use-case issues open', values: Array.from({ length: 21 }, (_, i) => 80 - i) },
    ];
    const table = renderTrendTable(rows);
    const lines = table.split('\n');
    assert.equal(lines.length, 6);
    assert.match(lines[0], /Stage\s+21-day trend\s+Now\s+Δ 7d/);
    assert.match(lines[1], /Complete \(landed\)\s+[▁-█]{21}\s+150\s+\+7/);
    assert.match(lines[2], /Eval PRs in review\s+[▄]{21}\s+10\s+0/);
    assert.match(lines[5], /Use-case issues open\s+[▁-█]{21}\s+60\s+-7/);
  });
});

describe('classifyPr & isDisciplinePr', () => {
  it('classifies PRs adding or modifying guide.md as guide PRs even if touching eval files', () => {
    assert.equal(
      classifyPr({
        headRefName: 'gd-dev/new-feature',
        title: 'grader updates: new-feature',
        files: [
          'guides/html/new-feature/guide.md',
          'guides/html/new-feature/targets/daily-grind/grader.ts',
        ],
      }),
      'guide'
    );
  });

  it('classifies PRs touching only targets/ or grader files as eval PRs', () => {
    assert.equal(
      classifyPr({
        headRefName: 'fix/patch-evals',
        title: 'update daily-grind tests',
        files: ['guides/forms/forms/targets/daily-grind/grader.ts'],
      }),
      'eval'
    );
  });

  it('classifies gd-dev/* branches or grader updates: titles as eval PRs', () => {
    assert.equal(
      classifyPr({
        headRefName: 'gd-dev/styling-web-components',
        title: 'grader updates: styling-web-components',
        files: ['guides/html/styling-web-components/targets/daily-grind/grader.ts'],
      }),
      'eval'
    );
    assert.equal(
      classifyPr({
        headRefName: 'feature/something',
        title: 'grader updates: popover',
        files: ['guides/ui-components/popover/targets/daily-grind/task.md'],
      }),
      'eval'
    );
  });

  it('classifies infra or non-guide PRs as other', () => {
    assert.equal(
      classifyPr({
        headRefName: 'refactor/harness-token-accounting',
        title: 'harness: token accounting fixes',
        files: ['src/harness/run-suite.ts', 'package.json'],
      }),
      'other'
    );
  });

  it('identifies discipline orientation PRs across category roots and named hubs', () => {
    assert.equal(
      isDisciplinePr({
        headRefName: 'gd-dev/web-components',
        files: ['guides/html/web-components/targets/daily-grind/grader.ts'],
      }),
      true
    );
    assert.equal(
      isDisciplinePr({
        headRefName: 'gd-dev/css-layout',
        files: ['guides/css/css-layout/targets/daily-grind/grader.ts'],
      }),
      true
    );
    assert.equal(
      isDisciplinePr({
        headRefName: 'gd-dev/accessibility',
        files: ['guides/accessibility/accessibility/targets/daily-grind/grader.ts'],
      }),
      true
    );
    assert.equal(
      isDisciplinePr({
        headRefName: 'gd-dev/shadow-dom',
        files: ['guides/html/shadow-dom/targets/daily-grind/grader.ts'],
      }),
      false
    );
  });
});

describe('Discipline hubs exclusion and issue header rendering', () => {
  it('excludes discipline hubs from 200 goal counts, progress bar, and burndown', () => {
    const completeFeatureGuide = makeGuide({ category: 'css', name: 'anchor-pos' });
    const completeDisciplineHub = makeGuide({
      category: 'accessibility',
      name: 'accessibility',
      isDisciplineGuide: true,
      hasGrader: true,
      hasTask: true,
    });
    const needsEvalFeature = makeGuide({
      category: 'forms',
      name: 'slider',
      hasGrader: false,
      hasTask: false,
    });
    const needsEvalWithPr = makeGuide({
      category: 'security',
      name: 'validate-origins',
      hasGrader: false,
      hasTask: false,
    });
    const needsEvalDiscipline = makeGuide({
      category: 'css',
      name: 'css-layout',
      isDisciplineGuide: true,
      hasGrader: false,
      hasTask: false,
    });

    const openPrs: PrSummary[] = [
      {
        number: 2057,
        title: 'grader updates: web-components',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/web-components',
        author: 'rick',
        reviewers: [],
        labels: [],
        files: ['guides/html/web-components/targets/daily-grind/grader.ts'],
      },
      {
        number: 1878,
        title: 'grader updates: validate-origins',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/validate-origins',
        author: 'traven',
        reviewers: [],
        labels: ['gd-dev-eval'],
        files: ['guides/security/validate-origins/targets/daily-grind/grader.ts'],
      },
    ];

    const report = buildPipelineReportData({
      guides: [completeFeatureGuide, completeDisciplineHub, needsEvalFeature, needsEvalWithPr, needsEvalDiscipline],
      openPrs,
      openUseCaseIssues: [],
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
      existingIssueBody: '',
      nowMs: Date.parse('2026-10-13T12:00:00Z'),
    });

    // Complete count excludes accessibility/accessibility discipline guide
    assert.equal(report.completeCount, 1);
    assert.equal(report.evalCompleteCount, 1);

    // Open eval PRs excludes web-components discipline guide
    assert.equal(report.openEvalPrs.length, 1);
    assert.equal(report.openEvalPrs[0].slug, 'security/validate-origins');

    // Ready for eval excludes css/css-layout discipline guide
    assert.deepEqual(report.readyForEvalSlugs, ['forms/slider']);

    const markdown = renderPipelineIssueBody(report);

    // HTML comment emitted
    assert.match(
      markdown,
      /<!-- Discipline orientation guides do not currently require a grader and are excluded from the 200 goal, the progress bar, and trend counts\. This policy may change\. -->/
    );

    // Old two-line header is NOT at the top
    assert.doesNotMatch(markdown, /# Content & Eval Pipeline\n\n\*\*\d+\*\* Needs guidance/);

    // Progress bar code block
    assert.match(markdown, /```\n1 landed · 1 in review · 198 to go → 200\n[█░·]{50}\n```/);

    // Clickable links line below code block
    assert.match(
      markdown,
      /\[1 landed complete\]\(https:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/tree\/main\/guides\) · \[1 eval PRs in review\]\(#open-eval-prs-1\) · \[1 ready for evals\]\(#ready-for-gd-dev-1\)/
    );

    // Trend table code block present
    assert.match(markdown, /```\nStage\s+21-day trend\s+Now\s+Δ 7d/);

    // Exact mermaid init line with height 200
    assert.match(
      markdown,
      /%%\{init: \{'themeVariables': \{'xyChart': \{'plotColorPalette': '#238636, #8b949e, #58a6ff'\}\}, 'xyChart': \{'height': 200\}\}\}%%/
    );

    // No burndown-checkpoints HTML comment
    assert.doesNotMatch(markdown, /<!--\s*burndown-checkpoints:/);
  });

  it('guarantees trend table today points, links line, and section counts match identically', () => {
    const complete1 = makeGuide({ category: 'css', name: 'guide-1' });
    const complete2 = makeGuide({ category: 'css', name: 'guide-2' });
    const needsEval1 = makeGuide({ category: 'forms', name: 'guide-3', hasGrader: false, hasTask: false });
    const needsEval2 = makeGuide({ category: 'forms', name: 'guide-4', hasGrader: false, hasTask: false });
    const needsGuidance1 = makeGuide({
      category: 'html',
      name: 'guide-5',
      hasGuide: false,
      isStub: true,
      hasGrader: false,
      hasTask: false,
    });
    const needsGuidance2 = makeGuide({
      category: 'html',
      name: 'guide-6',
      hasGuide: false,
      isStub: true,
      hasGrader: false,
      hasTask: false,
    });

    const openPrs: PrSummary[] = [
      {
        number: 101,
        title: 'grader updates: guide-3',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/guide-3',
        author: 'dev',
        reviewers: [],
        labels: ['gd-dev-eval'],
        files: ['guides/forms/guide-3/targets/daily-grind/grader.ts'],
      },
      {
        number: 102,
        title: 'Add guide-5 content',
        body: '',
        isDraft: false,
        headRefName: 'feat/guide-5',
        author: 'author',
        reviewers: [],
        labels: [],
        files: ['guides/html/guide-5/guide.md'],
      },
    ];

    const openUseCaseIssues: IssueSummary[] = [
      {
        number: 501,
        title: 'New use case: guide-6',
        body: 'Use case subdir: [guides/html/guide-6]',
        assignees: [],
        labels: ['new-use-case'],
      },
    ];

    const report = buildPipelineReportData({
      guides: [complete1, complete2, needsEval1, needsEval2, needsGuidance1, needsGuidance2],
      openPrs,
      openUseCaseIssues,
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
      existingIssueBody: '',
      nowMs: Date.parse('2026-10-13T12:00:00Z'),
    });

    assert.ok(report.trendHistory);
    const lastIdx = report.trendHistory.complete.length - 1;

    // Assert trend-today == section counts
    assert.equal(report.trendHistory.complete[lastIdx], report.completeCount);
    assert.equal(report.trendHistory.evalPrsInReview[lastIdx], report.openEvalPrs.length);
    assert.equal(report.trendHistory.readyForEvals[lastIdx], report.readyForEvalSlugs.length);
    assert.equal(report.trendHistory.guidePrsInReview[lastIdx], report.needsGuidancePrs.length);
    assert.equal(report.trendHistory.issuesOpen[lastIdx], report.needsGuidanceIssues.length);

    // Assert markdown links line matches the exact same numbers
    const markdown = renderPipelineIssueBody(report);
    const expectedLinksLine = `[${report.completeCount} landed complete](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/guides) · [${report.openEvalPrs.length} eval PRs in review](#open-eval-prs-${report.openEvalPrs.length}) · [${report.readyForEvalSlugs.length} ready for evals](#ready-for-gd-dev-${report.readyForEvalSlugs.length}) · [${report.needsGuidancePrs.length} guide PRs in review](#in-review--open-prs-${report.needsGuidancePrs.length}) · [${report.needsGuidanceIssues.length} use-case issues open](https://github.com/GoogleChrome/modern-web-guidance-src/issues?q=is%3Aissue+is%3Aopen+label%3Anew-use-case)`;
    assert.ok(
      markdown.includes(expectedLinksLine),
      `Expected markdown to contain links line:\n${expectedLinksLine}\nGot:\n${markdown.slice(0, 500)}`
    );
  });
});
