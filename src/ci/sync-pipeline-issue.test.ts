import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { type GuideInventory } from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import {
  buildPipelineReportData,
  buildUseCaseIssueIndex,
  classifyPr,
  fetchWeeklyProgressHistory,
  filterCatchAllReviewers,
  countGen2Evals,
  findStaleEvals,
  formatReviewDecision,
  formatShortDate,
  matchUseCaseIssue,
  parseEvalReportFromPrBody,
  PIPELINE_SCALE_MAX,
  renderPipelineIssueBody,
  renderProgressChart,
  renderFunnel,
  renderTwoRowProgressBar,
  sanitizeIssueTitle,
  type GitFileHistory,
  type IssueSummary,
  type PrSummary,
  type WeeklyProgressPoint,
} from './sync-pipeline-issue.ts';

/** Baseline complete guides on origin/main as of 2026-07-22 (test fixture expectation). */
const EXPECTED_BASELINE_COMPLETE = 129;

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

function readySince(...slugs: string[]): Map<string, string> {
  return new Map(slugs.map(slug => [slug, '2026-10-01']));
}

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

describe('fetchWeeklyProgressHistory & baseline', () => {
  it('computes 129 complete feature guides on origin/main as of 2026-07-22 including discipline guides', () => {
    const weeklyPoints = fetchWeeklyProgressHistory();
    assert.ok(weeklyPoints.length >= 1);
    assert.equal(weeklyPoints[0].complete, EXPECTED_BASELINE_COMPLETE);
    assert.equal(PIPELINE_SCALE_MAX, 200);
    assert.equal(PIPELINE_SCALE_MAX - EXPECTED_BASELINE_COMPLETE, 71);
  });
});

describe('renderTwoRowProgressBar', () => {
  it('renders exact 73-column bars for Guides and Evals rows with header, ruler, and legend', () => {
    const res = renderTwoRowProgressBar({
      complete: 140,
      openEvalGuides: 16,
      contentLanded: 168,
      openGuideGuides: 17,
      baseline: 127,
      staleEvalsCount: 0,
    });
    assert.equal(res.header, 'Guides on main since Jul 22 · 1 column = 1 guide');
    // 73 columns:
    // Guides: 41 '█', 17 '░', 15 '·' = 73
    // Evals:  13 '█', 16 '░', 44 '·' = 73
    assert.equal(
      res.guidesRow,
      'Guides    ' + '█'.repeat(41) + '░'.repeat(17) + '·'.repeat(15) + '  168 +17 PRs'
    );
    assert.equal(
      res.evalsRow,
      'Evals     ' + '█'.repeat(13) + '░'.repeat(16) + '·'.repeat(44) + '  140 +16 PRs'
    );
    const [ticks, nums] = res.rulerLine.split('\n');
    // Ticks sit under the first bar column (127), guide 150, and the last bar column (200).
    assert.deepEqual([...ticks].flatMap((c, i) => (c === '┬' ? [i] : [])), [10, 32, 82]);
    assert.equal(nums.trim().split(/\s+/).join(' '), '127 150 200');
    assert.equal(nums.lastIndexOf('200') + 2, 82);
    assert.match(res.text, /█ landed on main {3}░ open PR {3}· not yet$/);
  });

  it('safely clamps when counts are below baseline or over scale', () => {
    const below = renderTwoRowProgressBar({
      complete: 120,
      openEvalGuides: 5,
      contentLanded: 125,
      openGuideGuides: 2,
      baseline: 127,
      staleEvalsCount: 0,
    });
    assert.equal(
      below.guidesRow,
      'Guides    ' + '░'.repeat(2) + '·'.repeat(71) + '  125 +2 PRs'
    );
    assert.equal(
      below.evalsRow,
      'Evals     ' + '░'.repeat(5) + '·'.repeat(68) + '  120 +5 PRs'
    );

    const over = renderTwoRowProgressBar({
      complete: 205,
      openEvalGuides: 10,
      contentLanded: 210,
      openGuideGuides: 5,
      baseline: 127,
      staleEvalsCount: 0,
    });
    assert.equal(
      over.guidesRow,
      'Guides    ' + '█'.repeat(73) + '  210 +5 PRs'
    );
    assert.equal(
      over.evalsRow,
      'Evals     ' + '█'.repeat(73) + '  205 +10 PRs'
    );
  });
});

describe('renderProgressChart', () => {
  it('renders overlapping xychart-beta bars for guides and evals landed', () => {
    const points: WeeklyProgressPoint[] = [
      { date: '2026-07-22', label: 'Jul 22', complete: 127, contentLanded: 127 },
      { date: '2026-10-14', label: 'Oct 14', complete: 140, contentLanded: 168 },
    ];
    const chart = renderProgressChart(points);
    assert.match(chart, /config:\s+xyChart:\s+height: 200/);
    assert.match(chart, /plotColorPalette: "#FBBC04, #4285F4"/);
    assert.match(chart, /xychart-beta/);
    assert.match(chart, /x-axis \["Jul 22", "Oct 14"\]/);
    assert.match(chart, /y-axis "Guides" 100 --> 200/);
    assert.match(chart, /bar "Guides landed" \[127, 168\]/);
    assert.match(chart, /bar "Evals landed" \[127, 140\]/);
  });
});

describe('renderFunnel', () => {
  it('scales every row to the use-case total and marks open PRs with ░', () => {
    const funnel = renderFunnel({ useCases: 229, guidesLanded: 168, guidePrs: 16, evalsLanded: 140, evalPrs: 22 });
    const rows = funnel.split('\n').slice(1, -1);
    assert.deepEqual(
      rows.map(r => r.slice(16, 76)),
      ['█'.repeat(60), '█'.repeat(44) + '░'.repeat(4) + '·'.repeat(12), '█'.repeat(37) + '░'.repeat(6) + '·'.repeat(17)]
    );
    assert.deepEqual(rows.map(r => r.slice(78)), ['229', '168 +16 PRs', '140 +22 PRs']);
  });
});

describe('formatReviewDecision', () => {
  it('maps review decisions and draft states to lowercase strings', () => {
    assert.equal(formatReviewDecision('APPROVED', false), 'approved');
    assert.equal(formatReviewDecision('CHANGES_REQUESTED', false), 'changes requested');
    assert.equal(formatReviewDecision('REVIEW_REQUIRED', false), 'awaiting review');
    assert.equal(formatReviewDecision(null, false), 'awaiting review');
    assert.equal(formatReviewDecision(undefined, false), 'awaiting review');
    assert.equal(formatReviewDecision('APPROVED', true), 'draft');
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
      readySinceBySlug: readySince('forms/slider'),
      guides: [completeGuide, stubWithPr, stubWithIssue, needsEvalWithPr, needsEvalReady],
      openPrs,
      openUseCaseIssues,
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
    });

    assert.equal(report.needsGuidancePrs.length, 1);
    assert.equal(report.needsGuidancePrs[0].slug, 'ui-atoms/icons');
    assert.equal(report.needsGuidanceIssues.length, 1);
    assert.equal(report.needsGuidanceIssues[0].slug, 'ui-components/breadcrumbs');
    assert.equal(report.openEvalPrs.length, 1);
    assert.equal(report.openEvalPrs[0].slug, 'ui-behaviors/drag');
    assert.deepEqual(report.readyForEvals, [{ slug: 'forms/slider', readySince: '2026-10-01' }]);

    const markdown = renderPipelineIssueBody(report);
    assert.match(markdown, /## Stage 2: Needs guidance \(2\)/);
    assert.doesNotMatch(markdown, /^#####/m);
    assert.doesNotMatch(markdown, /^- \[ \]/m);
    assert.match(markdown, /## Stage 3: Needs evals \(2\)/);
    assert.match(markdown, /## Eval format: Gen 1 → Gen 2/);
    // The funnel sits between Stage 2 and Stage 3.
    assert.match(markdown, /## Stage 2:[\s\S]*### Funnel[\s\S]*## Stage 3:/);
    assert.match(markdown, /Quality audits \(point-in-time snapshots, not tracked above\)/);
    assert.match(markdown, /Evals in Gen 2 format {3}█{70} {2}1 \/ 1 \(100%\)/);
    assert.match(markdown, /#### Eval PRs: awaiting review \(1\)\n\n- Pass@1 dg \*\*100%\*\* · dt \*\*100%\*\* · \[\*\*ui-behaviors\/drag\*\*\]/);
    assert.match(markdown, /#### Ready for evals \(1\)[\s\S]*- \[\*\*forms\/slider\*\*\]\([^)]+\) · ready since Oct 1 \(\d+ days\)/);

    // Ensure zero raw @username mentions anywhere
    assert.doesNotMatch(markdown, /(?:^|[\s(])@[A-Za-z0-9_-]+/);

    // Ensure every #NNNN in list items is inside a markdown link [PR #NNNN] or [#NNNN]
    const bareRefs = markdown
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.replace(/\[(?:PR )?#\d+\]\([^)]+\)/g, ''))
      .filter(line => /#\d+/.test(line));
    assert.deepEqual(bareRefs, []);
  });

  it('matches template-filed new-use-case issues via Category and Use case slug headers', () => {
    const issue: IssueSummary = {
      number: 1742,
      title: '[Use Case] Custom list markers',
      body: '### Category\n\nui-atoms\n\n### Use case slug\n\ncustom-list-markers\n',
      assignees: ['LeaVerou'],
      labels: ['new-use-case'],
    };
    const index = buildUseCaseIssueIndex([issue], []);
    const matched = matchUseCaseIssue('ui-atoms/custom-list-markers', 'custom-list-markers', index, []);
    assert.equal(matched?.number, 1742);
    assert.equal(formatShortDate('2026-10-04'), 'Oct 4');
    assert.deepEqual(filterCatchAllReviewers(['paulirish', 'micahjo7', 'LeaVerou'], 'guidance'), ['LeaVerou']);
    assert.deepEqual(filterCatchAllReviewers(['TravenReese', 'micahjo7', 'paulirish'], 'guidance'), ['TravenReese']);
    assert.deepEqual(filterCatchAllReviewers(['TravenReese', 'paulirish'], 'evals'), ['TravenReese']);
  });

  it('counts Gen 2 evals and the subset with both targets', () => {
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
    const legacy = makeGuide({ category: 'css', name: 'legacy', targets: [] });
    const incompleteWithTargets = makeGuide({
      category: 'forms',
      name: 'incomplete-with-targets',
      hasGrader: false,
      hasTask: false,
      targets: [
        {
          name: 'daily-grind',
          dir: '/tmp/guides/forms/incomplete-with-targets/targets/daily-grind',
          hasSolution: true,
          hasZeroPassrate: true,
          hasGrader: true,
          hasTask: true,
        },
      ],
    });
    assert.deepEqual(countGen2Evals([dualTarget, singleTarget, legacy, incompleteWithTargets]), {
      gen2CompleteCount: 2,
      dualTargetCompleteCount: 1,
    });
  });
});

describe('classifyPr', () => {
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
});

describe('Discipline guides inclusion and issue header rendering', () => {
  it('includes discipline guides in all counts and the progress bar', () => {
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
        title: 'grader updates: css-layout',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/css-layout',
        author: 'rick',
        reviewers: [],
        labels: [],
        files: ['guides/css/css-layout/targets/daily-grind/grader.ts'],
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
      readySinceBySlug: readySince('forms/slider'),
      guides: [completeFeatureGuide, completeDisciplineHub, needsEvalFeature, needsEvalWithPr, needsEvalDiscipline],
      openPrs,
      openUseCaseIssues: [],
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
    });

    // Complete count includes accessibility/accessibility discipline guide
    assert.equal(report.completeCount, 2);

    // Open eval PRs includes css-layout discipline guide
    assert.equal(report.openEvalPrs.length, 2);
    assert.deepEqual(
      report.openEvalPrs.map(p => p.slug),
      ['css/css-layout', 'security/validate-origins']
    );

    // Ready for eval includes forms/slider
    assert.deepEqual(report.readyForEvals, [{ slug: 'forms/slider', readySince: '2026-10-01' }]);

    // Invariant check
    assert.equal(
      report.openEvalPrs.length + report.readyForEvals.length,
      report.contentLandedCount - report.completeCount
    );

    const markdown = renderPipelineIssueBody(report);

    // HTML comment excluded discipline guides is no longer emitted
    assert.doesNotMatch(
      markdown,
      /<!-- Discipline orientation guides/
    );

    // Progress bar code block with 2 symmetric rows (Guides, Evals) and ruler line
    assert.match(
      markdown,
      /```\nGuides on main since Jul 22 · 1 column = 1 guide\nGuides\s+[█░·]{71}\s+\d+ \+\d+ PRs\nEvals\s+[█░·]{71}\s+\d+ \+\d+ PRs\n\s+┬\s+┬\s+┬\n\s+\d+\s+150\s+200\n█ landed on main {3}░ open PR {3}· not yet\n```/
    );

    // Clickable links line below code block
    assert.match(
      markdown,
      /\[2 evals landed\]\(https:\/\/github\.com\/GoogleChrome\/modern-web-guidance-src\/tree\/main\/guides\) · \[2 eval PRs\]\(#stage-3-needs-evals-3\) · \[1 ready for evals\]\(#ready-for-evals-1\)/
    );

    // Weekly progress chart present with YAML frontmatter config
    assert.match(
      markdown,
      /### Progress since Jul 22\n\n```mermaid\n---\nconfig:\n  xyChart:\n    height: 200\n  themeVariables:\n    xyChart:\n      plotColorPalette: "#FBBC04, #4285F4"\n---\nxychart-beta/
    );

  });

  it('deduplicates open needs-guidance PRs by slug', () => {
    const guide = makeGuide({
      category: 'html',
      name: 'guide-dup',
      hasGuide: false,
      isStub: true,
      hasGrader: false,
      hasTask: false,
    });
    const openPrs: PrSummary[] = [
      {
        number: 301,
        title: 'Add guide-dup content first PR',
        body: '',
        isDraft: false,
        headRefName: 'feat/guide-dup-1',
        author: 'author1',
        reviewers: [],
        labels: [],
        files: ['guides/html/guide-dup/guide.md'],
      },
      {
        number: 302,
        title: 'Add guide-dup content second PR',
        body: '',
        isDraft: false,
        headRefName: 'feat/guide-dup-2',
        author: 'author2',
        reviewers: [],
        labels: [],
        files: ['guides/html/guide-dup/guide.md'],
      },
    ];

    const report = buildPipelineReportData({
      guides: [guide],
      openPrs,
      openUseCaseIssues: [],
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
      weeklyProgressPoints: [
        { date: '2026-07-22', label: 'Jul 22', complete: 0, contentLanded: 0 },
      ],
    });

    assert.equal(report.needsGuidancePrs.length, 1);
    assert.equal(report.needsGuidancePrs[0].slug, 'html/guide-dup');
    assert.equal(report.needsGuidancePrs[0].prNumber, 301);
  });

  it('guarantees links line, funnel, and section counts match identically', () => {
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
      readySinceBySlug: readySince('forms/guide-4'),
      guides: [complete1, complete2, needsEval1, needsEval2, needsGuidance1, needsGuidance2],
      openPrs,
      openUseCaseIssues,
      openFeatureIssues: [
        {
          number: 801,
          title: 'Feature backlog item',
          body: '',
          assignees: ['LeaVerou'],
          labels: ['new-feature'],
        },
      ],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
      weeklyProgressPoints: [
        { date: '2026-07-22', label: 'Jul 22', complete: 127, contentLanded: 127 },
        { date: '2026-10-13', label: 'Oct 13', complete: 2, contentLanded: 4 },
      ],
    });

    assert.equal(report.completeCount, 2);
    assert.equal(report.openEvalPrs.length, 1);
    assert.equal(report.readyForEvals.length, 1);
    assert.equal(report.needsGuidancePrs.length, 1);
    assert.equal(report.needsGuidanceIssues.length, 1);
    assert.equal(report.needsUseCasesIssues.length, 1);

    const markdown = renderPipelineIssueBody(report);

    // Stage 1, links line, & funnel match the section counts
    assert.match(markdown, /## Stage 1: Needs use cases \(1\)/);
    assert.match(markdown, /\[1 features awaiting use cases\]\(#stage-1-needs-use-cases-1\)/);
    // Funnel: 4 guides landed + 1 guide PR + 1 not started = 6 use cases.
    assert.match(markdown, /Use cases {7}█{60} {2}6\n/);
    assert.match(markdown, /Guides landed {3}[█░·]{60} {2}4 \+1 PRs\n/);
    assert.match(markdown, /Evals landed {4}[█░·]{60} {2}2 \+1 PRs\n/);

    // Assert markdown links line matches the exact same numbers
    const expectedLinksLine = `[2 evals landed](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/guides) · [1 eval PRs](#stage-3-needs-evals-2) · [1 ready for evals](#ready-for-evals-1) · [1 guide PRs](#guide-prs-1) · [1 use cases not started](#not-started-1) · [1 features awaiting use cases](#stage-1-needs-use-cases-1)`;
    assert.ok(
      markdown.includes(expectedLinksLine),
      `Expected markdown to contain links line:\n${expectedLinksLine}\nGot:\n${markdown.slice(0, 500)}`
    );
  });

  it('enforces the invariant that openEvalPrs + readyForEvals equals contentLanded - completeCount', () => {
    const complete1 = makeGuide({ category: 'css', name: 'guide-1' });
    const needsEval1 = makeGuide({ category: 'forms', name: 'guide-2', hasGrader: false, hasTask: false });
    const needsEval2 = makeGuide({ category: 'forms', name: 'guide-3', hasGrader: false, hasTask: false });
    const needsGuidance1 = makeGuide({
      category: 'html',
      name: 'guide-4',
      hasGuide: false,
      isStub: true,
      hasGrader: false,
      hasTask: false,
    });

    // Open PR for guide-2 (eval PR)
    const openPrs: PrSummary[] = [
      {
        number: 101,
        title: 'grader updates: guide-2',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/guide-2',
        author: 'dev',
        reviewers: [],
        labels: ['gd-dev-eval'],
        files: ['guides/forms/guide-2/targets/daily-grind/grader.ts'],
      },
      // Eval PR for guide-4 (which is still NeedsGuidance on main: should NOT be counted as an eval PR for needsEvals)
      {
        number: 102,
        title: 'grader updates: guide-4',
        body: '',
        isDraft: false,
        headRefName: 'gd-dev/guide-4',
        author: 'dev',
        reviewers: [],
        labels: ['gd-dev-eval'],
        files: ['guides/html/guide-4/targets/daily-grind/grader.ts'],
      },
    ];

    const report = buildPipelineReportData({
      readySinceBySlug: readySince('forms/guide-2', 'forms/guide-3'),
      guides: [complete1, needsEval1, needsEval2, needsGuidance1],
      openPrs,
      openUseCaseIssues: [],
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
    });

    // Content landed = 1 complete + 2 needsEvals = 3
    assert.equal(report.completeCount, 1);
    assert.equal(report.contentLandedCount, 3);
    // openEvalPrs only counts guide-2 (guide-4 is ignored since not in NeedsEvals on main)
    assert.equal(report.openEvalPrs.length, 1);
    assert.equal(report.readyForEvals.length, 1);
    assert.equal(
      report.openEvalPrs.length + report.readyForEvals.length,
      report.contentLandedCount - report.completeCount
    );
  });

  it('sanitizes issue titles with raw HTML tags and mentions to protect markdown structure', () => {
    assert.equal(sanitizeIssueTitle('Customizable <select>'), 'Customizable &lt;select&gt;');
    assert.equal(
      sanitizeIssueTitle('Capability Elements <usermedia> MVP'),
      'Capability Elements &lt;usermedia&gt; MVP'
    );
    assert.equal(
      sanitizeIssueTitle('Media capture <camera> & <microphone>'),
      'Media capture &lt;camera&gt; &amp; &lt;microphone&gt;'
    );
    assert.equal(
      sanitizeIssueTitle('@starting-style support'),
      '`@starting-style` support'
    );
  });

  it('lists blocked guides with their reason apart from not-started ones', () => {
    const blocked = makeGuide({
      category: 'forms',
      name: 'button-group',
      draft: 'blocked',
      draftReason: 'listbox <select> lacks horizontal nav (#1275)',
      hasGrader: false,
      hasTask: false,
    });
    const report = buildPipelineReportData({
      readySinceBySlug: readySince(),
      guides: [makeGuide({ category: 'css', name: 'guide-1' }), blocked],
      openPrs: [],
      openUseCaseIssues: [],
      openFeatureIssues: [],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
    });
    const markdown = renderPipelineIssueBody(report);
    assert.match(markdown, /#### Blocked \(1\)[\s\S]*\*\*forms\/button-group\*\*.* · listbox &lt;select&gt; lacks horizontal nav \(#1275\)/);
    assert.match(markdown, /#### Not started \(0\)/);
    assert.doesNotMatch(markdown, /#### In progress/);
  });

  it('guarantees balanced details tags and code fences in generated issue body', () => {
    const complete = makeGuide({ category: 'css', name: 'guide-1' });
    const report = buildPipelineReportData({
      readySinceBySlug: readySince(),
      guides: [complete],
      openPrs: [],
      openUseCaseIssues: [],
      openFeatureIssues: [
        {
          number: 51,
          title: 'Customizable <select>',
          body: '',
          assignees: ['pattishin'],
          labels: ['new-feature'],
        },
        {
          number: 35,
          title: '@starting-style',
          body: '',
          assignees: ['LeaVerou'],
          labels: ['new-feature'],
        },
      ],
      openExpectationsChangedIssues: [],
      gitHistory: new Map(),
    });

    const markdown = renderPipelineIssueBody(report);

    // Balanced <details> and </details>
    const openDetails = (markdown.match(/<details>/g) ?? []).length;
    const closeDetails = (markdown.match(/<\/details>/g) ?? []).length;
    assert.ok(openDetails > 0, 'Expected at least one <details> block');
    assert.equal(openDetails, closeDetails, '<details> and </details> counts must be balanced');

    // Balanced code fences
    const fenceCount = (markdown.match(/^```/gm) ?? []).length;
    assert.ok(fenceCount > 0, 'Expected code fences');
    assert.equal(fenceCount % 2, 0, 'Code fence count must be even');

    // Title escaping prevents unclosed HTML element swallowing subsequent headings
    assert.match(markdown, /Customizable &lt;select&gt;/);
    assert.match(markdown, /`@starting-style`/);
    assert.match(markdown, /## Stage 2: Needs guidance/);
    assert.match(markdown, /## Stage 3: Needs evals/);
  });

  it('fails fast when there are no weekly progress points to take a baseline from', () => {
    const complete = makeGuide({ category: 'css', name: 'guide-1' });
    assert.throws(
      () => {
        buildPipelineReportData({
      readySinceBySlug: readySince(),
          guides: [complete],
          openPrs: [],
          openUseCaseIssues: [],
          openFeatureIssues: [],
          openExpectationsChangedIssues: [],
          gitHistory: new Map(),
          weeklyProgressPoints: [],
        });
      },
      /Cannot determine baseline: no weekly progress points/
    );
  });
});
