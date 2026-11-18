import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractIssueNumbers,
  isSmallProseTypoFix,
  evaluatePrIntake,
  resolveInfraReviewers,
  formatAutoCloseComment,
  formatClaHoldComment,
  INTAKE_CLOSE_MARKER,
  INTAKE_CLA_MARKER,
  type LinkedIssueInfo,
  type PrIntakeInput
} from './pr-intake.ts';
import { githubApi, triagePullRequest, type AtlConfig } from './atl-triage.ts';

function makeInput(overrides: Partial<PrIntakeInput> = {}): PrIntakeInput {
  return {
    prAuthor: 'ext-user',
    authorIsBot: false,
    authorHasWriteAccess: false,
    hasMaintainerEngagement: false,
    prLabels: [],
    title: 'Update dialog guide',
    body: 'Fixes #100',
    files: ['guides/ui-components/dialog/guide.md'],
    additions: 20,
    deletions: 5,
    claState: 'success',
    linkedIssues: new Map<number, LinkedIssueInfo>(),
    ...overrides
  };
}

describe('extractIssueNumbers', () => {
  it('extracts #refs from title brackets, parentheses, and closing keywords', () => {
    const refs = extractIssueNumbers(
      '[#1216] rating guide and demo (#2102)',
      'Fixes #3618, #3619 and closes https://github.com/GoogleChrome/modern-web-guidance-src/issues/3444'
    );
    assert.deepEqual(refs, [1216, 2102, 3618, 3619, 3444]);
  });

  it('ignores casual prose mentions like #3618-adjacent or raw CSS hex colors', () => {
    const body = [
      'Changed #888 to #595959 for contrast.',
      'falls back to patch -p1 (already reported as #3618-adjacent; unrelated to this change)',
      'Once #3600 lands I will rebase.'
    ].join('\n');
    assert.deepEqual(extractIssueNumbers('core: parse patch paths', body), []);
  });

  it('ignores #refs inside HTML comments, inline code spans, and fenced code blocks', () => {
    const body = [
      '<!-- Fixes #999 -->',
      'Changed `#888` to `#595959` for contrast.',
      '```css',
      '.btn { color: #666; }',
      '```',
      'Fixes #3528'
    ].join('\n');
    assert.deepEqual(extractIssueNumbers('fix(demos): contrast', body), [3528]);
  });

  it('ignores 7+ digit numbers like 6-hex colors with alpha or large IDs', () => {
    assert.deepEqual(extractIssueNumbers('test', 'Ref #1234567 and #42'), [42]);
  });
});

describe('isSmallProseTypoFix', () => {
  it('allows <=5 line markdown prose/link fixes in a single guide or root doc', () => {
    assert.equal(
      isSmallProseTypoFix({
        files: ['guides/css/anchor-positioning/guide.md'],
        additions: 2,
        deletions: 2
      }),
      true
    );
    assert.equal(
      isSmallProseTypoFix({
        files: ['CONTRIBUTING.md', 'docs/CONTEXT.md'],
        additions: 3,
        deletions: 3
      }),
      true
    );
  });

  it('rejects non-markdown files, expectations.md, task.md, >1 guide, or >5 line diffs', () => {
    assert.equal(
      isSmallProseTypoFix({
        files: ['guides/css/anchor-positioning/demo.html'],
        additions: 1,
        deletions: 1
      }),
      false
    );
    assert.equal(
      isSmallProseTypoFix({
        files: ['guides/css/anchor-positioning/expectations.md'],
        additions: 1,
        deletions: 1
      }),
      false
    );
    assert.equal(
      isSmallProseTypoFix({
        files: ['guides/css/a/guide.md', 'guides/css/b/guide.md'],
        additions: 2,
        deletions: 2
      }),
      false
    );
    assert.equal(
      isSmallProseTypoFix({
        files: ['guides/css/a/guide.md'],
        additions: 6,
        deletions: 1
      }),
      false
    );
  });
});

describe('evaluatePrIntake', () => {
  it('allows bots and authors with write access regardless of issue or CLA state', () => {
    assert.deepEqual(
      evaluatePrIntake(makeInput({ authorIsBot: true, claState: 'missing', body: '' })),
      { kind: 'allow', via: 'bot' }
    );
    assert.deepEqual(
      evaluatePrIntake(makeInput({ authorHasWriteAccess: true, claState: 'failure', body: '' })),
      { kind: 'allow', via: 'write-access' }
    );
  });

  it('closes unsolicited external PRs when linked issue lacks pr-welcome and author assignment', () => {
    const linkedIssues = new Map<number, LinkedIssueInfo>([
      [
        1833,
        {
          number: 1833,
          state: 'open',
          author: 'rviscomi',
          labels: ['content', 'ui-behaviors'],
          assignees: ['LeaVerou']
        }
      ]
    ]);
    assert.deepEqual(
      evaluatePrIntake(makeInput({ body: 'Fixes #1833 and color #888', linkedIssues })),
      { kind: 'close', reason: 'no-approved-issue', referencedIssues: [1833] }
    );
  });

  it('allows external PR when linked open issue has pr-welcome or assigns author and CLA passed', () => {
    const welcomeIssues = new Map<number, LinkedIssueInfo>([
      [
        200,
        {
          number: 200,
          state: 'open',
          author: 'LeaVerou',
          labels: ['content', 'pr-welcome'],
          assignees: []
        }
      ]
    ]);
    assert.deepEqual(
      evaluatePrIntake(makeInput({ body: 'Fixes #200', linkedIssues: welcomeIssues })),
      { kind: 'allow', via: 'approved-issue', approvedIssue: 200 }
    );

    const assignedIssues = new Map<number, LinkedIssueInfo>([
      [
        1216,
        {
          number: 1216,
          state: 'open',
          author: 'app/chrome-devrel-infra',
          labels: ['new-use-case'],
          assignees: ['LeaVerou', 'Ext-User']
        }
      ]
    ]);
    assert.deepEqual(
      evaluatePrIntake(makeInput({ title: '[#1216] rating guide', body: '', linkedIssues: assignedIssues })),
      { kind: 'allow', via: 'approved-issue', approvedIssue: 1216 }
    );
  });

  it('holds reviewer assignment when authorized PR has failing or pending CLA', () => {
    const welcomeIssues = new Map<number, LinkedIssueInfo>([
      [
        200,
        {
          number: 200,
          state: 'open',
          author: 'LeaVerou',
          labels: ['pr-welcome'],
          assignees: []
        }
      ]
    ]);
    assert.deepEqual(
      evaluatePrIntake(makeInput({ body: 'Fixes #200', claState: 'failure', linkedIssues: welcomeIssues })),
      { kind: 'hold-cla', claState: 'failure', via: 'approved-issue', approvedIssue: 200 }
    );
    assert.deepEqual(
      evaluatePrIntake(
        makeInput({ hasMaintainerEngagement: true, body: '', claState: 'failure' })
      ),
      { kind: 'hold-cla', claState: 'failure', via: 'maintainer-engaged', approvedIssue: undefined }
    );
  });

  it('honors pr-welcome label directly on PR as maintainer override', () => {
    assert.deepEqual(
      evaluatePrIntake(makeInput({ prLabels: ['pr-welcome'], body: '' })),
      { kind: 'allow', via: 'pr-welcome-label', approvedIssue: undefined }
    );
  });
});

describe('resolveInfraReviewers', () => {
  it('returns empty array for pure SME content files', () => {
    assert.deepEqual(
      resolveInfraReviewers([
        'guides/css/anchor/guide.md',
        'guides/css/anchor/demo.html',
        'guides/css/anchor/expectations.md',
        'features/popover.md',
        'skills-src/web-baseline/SKILL.md'
      ]),
      []
    );
  });

  it('routes eval, public harness, config, and general infra paths accurately', () => {
    assert.deepEqual(
      resolveInfraReviewers(['guides/css/anchor/grader.ts']),
      ['TravenReese', 'micahjo7', 'lusayaa']
    );
    assert.deepEqual(
      resolveInfraReviewers(['src/harness/public/scrub.ts']),
      ['paulirish', 'micahjo7', 'TravenReese']
    );
    assert.deepEqual(
      resolveInfraReviewers(['.github/atls.json']),
      ['paulirish', 'rviscomi', 'micahjo7', 'lusayaa']
    );
    assert.deepEqual(
      resolveInfraReviewers(['src/analyzing/rules/dialog.ts']),
      ['paulirish', 'micahjo7', 'lusayaa']
    );
  });
});

describe('comment formatters', () => {
  it('embeds idempotency markers and linked issue context', () => {
    const closeMsg = formatAutoCloseComment('alice', [1833]);
    assert.ok(closeMsg.startsWith(INTAKE_CLOSE_MARKER));
    assert.ok(closeMsg.includes('#1833'));
    assert.ok(closeMsg.includes('pr-welcome'));

    const claMsg = formatClaHoldComment('bob');
    assert.ok(claMsg.startsWith(INTAKE_CLA_MARKER));
    assert.ok(claMsg.includes('cla.developers.google.com'));
  });
});

const sampleAtlConfig: AtlConfig = {
  default: {
    css: 'LeaVerou',
    performance: ['tunetheweb', 'malchata']
  },
  web_features: {},
  web_features_groups: {}
};

describe('triagePullRequest orchestration', () => {
  it('closes unapproved external PR, clears bot reviewers, and posts idempotent close comment', () => {
    const removedReviewers: string[][] = [];
    const postedComments: string[] = [];
    const closedPrs: number[] = [];

    const m1 = mock.method(githubApi, 'getPrIntakeMetadata', () => ({
      title: 'Fix RTL tabs',
      body: 'Fixes #1833',
      state: 'OPEN',
      isDraft: false,
      additions: 40,
      deletions: 10,
      headRefOid: 'abc1234',
      headRefName: 'fix-rtl',
      isSameRepo: false,
      author: 'ext-user',
      authorIsBot: false,
      labels: [],
      files: ['guides/css/tabs/guide.md', 'src/analyzing/foo.ts'],
      reviewRequests: ['LeaVerou'],
      participantLogins: [],
      comments: [],
      claState: 'success' as const
    }));
    const m2 = mock.method(githubApi, 'hasUserWriteAccess', () => false);
    const m3 = mock.method(githubApi, 'getLinkedIssueInfo', () => ({
      number: 1833,
      state: 'open' as const,
      author: 'rviscomi',
      labels: ['content'],
      assignees: ['LeaVerou']
    }));
    const m4 = mock.method(githubApi, 'getPrBotRequestedReviewers', () => ['leaverou']);
    const m5 = mock.method(githubApi, 'removePrReviewers', (_pr: number, revs: string[]) => {
      removedReviewers.push(revs);
    });
    const m6 = mock.method(githubApi, 'addPrComment', (_pr: number, body: string) => {
      postedComments.push(body);
    });
    const m7 = mock.method(githubApi, 'closePr', (pr: number) => {
      closedPrs.push(pr);
    });

    try {
      const res = triagePullRequest(3602, sampleAtlConfig, { dryRun: false });
      assert.equal(res.decision?.kind, 'close');
      assert.deepEqual(res.reviewers, []);
      assert.deepEqual(removedReviewers, [['LeaVerou']]);
      assert.equal(postedComments.length, 1);
      assert.ok(postedComments[0].includes('#1833'));
      assert.deepEqual(closedPrs, [3602]);
    } finally {
      m1.mock.restore();
      m2.mock.restore();
      m3.mock.restore();
      m4.mock.restore();
      m5.mock.restore();
      m6.mock.restore();
      m7.mock.restore();
    }
  });

  it('adds awaiting-cla and withholds reviewers when approved issue PR fails CLA', () => {
    const addedLabels: string[][] = [];
    const postedComments: string[] = [];
    const addedReviewers: string[][] = [];

    const m1 = mock.method(githubApi, 'getPrIntakeMetadata', () => ({
      title: 'Update dialog guide',
      body: 'Fixes #500',
      state: 'OPEN',
      isDraft: false,
      additions: 15,
      deletions: 3,
      headRefOid: 'def5678',
      headRefName: 'dialog-fix',
      isSameRepo: false,
      author: 'ext-user',
      authorIsBot: false,
      labels: [],
      files: ['guides/css/dialog/guide.md'],
      reviewRequests: [],
      participantLogins: [],
      comments: [],
      claState: 'failure' as const
    }));
    const m2 = mock.method(githubApi, 'hasUserWriteAccess', () => false);
    const m3 = mock.method(githubApi, 'getLinkedIssueInfo', () => ({
      number: 500,
      state: 'open' as const,
      author: 'LeaVerou',
      labels: ['pr-welcome'],
      assignees: []
    }));
    const m4 = mock.method(githubApi, 'addPrLabels', (_pr: number, labels: string[]) => {
      addedLabels.push(labels);
    });
    const m5 = mock.method(githubApi, 'addPrComment', (_pr: number, body: string) => {
      postedComments.push(body);
    });
    const m6 = mock.method(githubApi, 'addPrReviewers', (_pr: number, revs: string[]) => {
      addedReviewers.push(revs);
    });

    try {
      const res = triagePullRequest(3634, sampleAtlConfig, { dryRun: false });
      assert.equal(res.decision?.kind, 'hold-cla');
      assert.deepEqual(addedLabels, [['awaiting-cla']]);
      assert.equal(postedComments.length, 1);
      assert.equal(addedReviewers.length, 0);
    } finally {
      m1.mock.restore();
      m2.mock.restore();
      m3.mock.restore();
      m4.mock.restore();
      m5.mock.restore();
      m6.mock.restore();
    }
  });

  it('removes awaiting-cla and routes both Content ATL and Infra owners once allowed', () => {
    const removedLabels: string[][] = [];
    const addedReviewers: string[][] = [];

    const m1 = mock.method(githubApi, 'getPrIntakeMetadata', () => ({
      title: 'Update css guide and cli',
      body: 'Fixes #500',
      state: 'OPEN',
      isDraft: false,
      additions: 15,
      deletions: 3,
      headRefOid: 'def5678',
      headRefName: 'css-cli',
      isSameRepo: false,
      author: 'ext-user',
      authorIsBot: false,
      labels: ['awaiting-cla', 'content'],
      files: ['guides/css/anchor-positioning-tab-underline/guide.md', 'src/cli/foo.ts'],
      reviewRequests: [],
      participantLogins: [],
      comments: [],
      claState: 'success' as const
    }));
    const m2 = mock.method(githubApi, 'hasUserWriteAccess', () => false);
    const m3 = mock.method(githubApi, 'getLinkedIssueInfo', () => ({
      number: 500,
      state: 'open' as const,
      author: 'LeaVerou',
      labels: ['pr-welcome'],
      assignees: []
    }));
    const m4 = mock.method(githubApi, 'removePrLabels', (_pr: number, labels: string[]) => {
      removedLabels.push(labels);
    });
    const m5 = mock.method(githubApi, 'getPrFileContent', () => null);
    const m6 = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    const m7 = mock.method(githubApi, 'getPrRemovedReviewers', () => []);
    const m8 = mock.method(githubApi, 'addPrReviewers', (_pr: number, revs: string[]) => {
      addedReviewers.push(revs);
    });

    try {
      const res = triagePullRequest(3700, sampleAtlConfig, { dryRun: false });
      assert.equal(res.decision?.kind, 'allow');
      assert.deepEqual(removedLabels, [['awaiting-cla']]);
      assert.deepEqual(
        res.reviewers.slice().sort(),
        ['LeaVerou', 'paulirish', 'micahjo7', 'lusayaa'].sort()
      );
      assert.equal(addedReviewers.length, 1);
    } finally {
      m1.mock.restore();
      m2.mock.restore();
      m3.mock.restore();
      m4.mock.restore();
      m5.mock.restore();
      m6.mock.restore();
      m7.mock.restore();
      m8.mock.restore();
    }
  });
});
