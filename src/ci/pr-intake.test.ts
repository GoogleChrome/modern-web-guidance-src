import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractIssueNumbers,
  extractNoreplyLogin,
  isSmallProseTypoFix,
  evaluatePrIntake,
  parsePrimaryBlameAuthor,
  resolveInfraReviewers,
  selectLeadReviewer,
  formatAutoCloseComment,
  formatClaHoldComment,
  INTAKE_CLOSE_MARKER,
  INTAKE_CLA_MARKER,
  type LinkedIssueInfo,
  type PrIntakeInput
} from './pr-intake.ts';
import { githubApi, handlePR, parsePrIntakeMetadata, triagePullRequest, type AtlConfig } from './atl-triage.ts';

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
  it('returns empty array for pure SME content files, demo variants, and guide assets', () => {
    assert.deepEqual(
      resolveInfraReviewers([
        'guides/css/anchor/guide.md',
        'guides/css/anchor/demo.html',
        'guides/ui-components/carousel/demo-vertical.html',
        'guides/pwa/install-web-app/manifest.webmanifest',
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

describe('parsePrIntakeMetadata (real gh pr view shapes)', () => {
  it('marks default-named external forks as isSameRepo=false and filters google-cla app comments', () => {
    const parsed = parsePrIntakeMetadata({
      title: 'docs(guides): align dialog examples',
      body: '<!-- no-atl-triage -->\nFixes #3615',
      state: 'OPEN',
      isDraft: false,
      isCrossRepository: true,
      additions: 13,
      deletions: 10,
      headRefOid: '7eddac9f226',
      headRefName: 'fix-dialog',
      headRepository: {
        id: 'R_123',
        name: 'modern-web-guidance-src',
        nameWithOwner: 'mschoi0411/modern-web-guidance-src'
      },
      headRepositoryOwner: { login: 'mschoi0411' },
      author: { login: 'mschoi0411' },
      labels: [],
      files: [{ path: 'guides/html/html/guide.md' }],
      reviewRequests: [],
      reviews: [],
      comments: [
        { author: { login: 'google-cla' }, body: 'Thanks for your pull request!' },
        { author: { login: 'mschoi0411' }, body: 'I signed it' }
      ],
      statusCheckRollup: [{ name: 'cla/google', status: 'COMPLETED', conclusion: 'FAILURE' }]
    });

    assert.equal(parsed.isSameRepo, false);
    assert.deepEqual(parsed.participantLogins, []);
    assert.equal(parsed.claState, 'failure');
  });

  it('marks upstream branches as isSameRepo=true', () => {
    const parsed = parsePrIntakeMetadata({
      title: 'legacy-scan: fix',
      body: '',
      state: 'OPEN',
      isDraft: false,
      isCrossRepository: false,
      headRefOid: '111111',
      headRefName: 'fix/legacy-scan',
      headRepository: {
        name: 'modern-web-guidance-src',
        nameWithOwner: 'GoogleChrome/modern-web-guidance-src'
      },
      headRepositoryOwner: { login: 'GoogleChrome' },
      author: { login: 'paulirish' },
      statusCheckRollup: [{ name: 'cla/google', conclusion: 'SUCCESS' }]
    });

    assert.equal(parsed.isSameRepo, true);
    assert.equal(parsed.claState, 'success');
  });
});

describe('parsePrimaryBlameAuthor & extractNoreplyLogin', () => {
  it('extracts login only from numeric-ID GitHub noreply emails', () => {
    assert.equal(extractNoreplyLogin('41588129+dvdherron@users.noreply.github.com'), 'dvdherron');
    assert.equal(extractNoreplyLogin('stu@alwaystwisted.com'), null);
    assert.equal(extractNoreplyLogin('rviscomi@users.noreply.github.com'), null);
  });

  it('ignores YAML frontmatter and blank lines when computing primary guide author', () => {
    const guide = [
      '---',
      'name: sample',
      'description: Sample guide',
      'web-feature-ids:',
      '  - popover',
      '---',
      '',
      '# Sample Guide',
      ...Array.from({ length: 12 }, (_, i) => `Body line ${i + 1}`)
    ].join('\n');

    const stubSha = 'a'.repeat(40);
    const bodySha = 'b'.repeat(40);
    const driveBySha = 'c'.repeat(40);

    const lines = guide.split('\n');
    const porcelain: string[] = [];
    lines.forEach((text, idx) => {
      const lineNo = idx + 1;
      const isFrontmatter = lineNo <= 6;
      const isLastLine = lineNo === lines.length;
      const sha = isFrontmatter ? stubSha : isLastLine ? driveBySha : bodySha;
      const mail = isFrontmatter
        ? '<rviscomi@users.noreply.github.com>'
        : isLastLine
        ? '<ext@example.com>'
        : '<jamesnw@gmail.com>';
      porcelain.push(`${sha} ${lineNo} ${lineNo} 1`, `author Test`, `author-mail ${mail}`, `\t${text}`);
    });

    const res = parsePrimaryBlameAuthor(guide, porcelain.join('\n'));
    assert.ok(res);
    assert.equal(res.email, 'jamesnw@gmail.com');
    assert.equal(res.sha, bodySha);
    assert.equal(res.bodyLines, 12);
  });

  it('returns null on frontmatter-only stubs or guides under 10 substantive lines', () => {
    const stub = '---\nname: stub\ndraft: stub\n---\n';
    const sha = 'a'.repeat(40);
    const porcelain = stub
      .split('\n')
      .map((t, i) => `${sha} ${i + 1} ${i + 1} 1\nauthor-mail <a@b.com>\n\t${t}`)
      .join('\n');
    assert.equal(parsePrimaryBlameAuthor(stub, porcelain), null);
  });
});

describe('selectLeadReviewer waterfall & stickiness', () => {
  it('stops at the first non-empty eligible tier and cascades when excluded', () => {
    const tiers = [['jamesnw'], ['bramus'], ['LeaVerou']];
    assert.equal(
      selectLeadReviewer({ tiers, excludedLogins: new Set() }),
      'jamesnw'
    );
    assert.equal(
      selectLeadReviewer({ tiers, excludedLogins: new Set(['jamesnw']) }),
      'bramus'
    );
    assert.equal(
      selectLeadReviewer({ tiers, excludedLogins: new Set(['jamesnw', 'bramus']) }),
      'LeaVerou'
    );
  });

  it('keeps an already-reviewed candidate across tiers without paging a new reviewer mid-review', () => {
    const tiers = [['jamesnw'], ['LeaVerou']];
    assert.equal(
      selectLeadReviewer({
        tiers,
        excludedLogins: new Set(),
        alreadyReviewedLogins: new Set(['leaverou'])
      }),
      'LeaVerou'
    );
  });

  it('keeps sticky already-requested candidate within winning tier and uses openReviewCounts otherwise', () => {
    const tiers = [['LJWatson', 'jenjknoll']];
    const counts = new Map([
      ['ljwatson', 5],
      ['jenjknoll', 1]
    ]);
    assert.equal(
      selectLeadReviewer({
        tiers,
        excludedLogins: new Set(),
        openReviewCounts: counts,
        tieSeed: 100
      }),
      'jenjknoll'
    );
    assert.equal(
      selectLeadReviewer({
        tiers,
        excludedLogins: new Set(),
        alreadyRequestedLogins: new Set(['ljwatson']),
        openReviewCounts: counts,
        tieSeed: 100
      }),
      'LJWatson'
    );
  });
});

describe('handlePR git-author Tier 1 integration', () => {
  it('routes existing guide update to active git-blame primary author, and cascades when PR author or removed', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-author-tier1-'));
    const bodyLines = Array.from({ length: 15 }, (_, i) => `Rule ${i + 1}: use native popover.`).join('\n');
    const guideText = `---\nname: popover-menu\nweb-feature-ids:\n  - popover\n---\n\n${bodyLines}\n`;
    const guideDir = path.join(tmpDir, 'ui-behaviors', 'popover-menu');
    fs.mkdirSync(guideDir, { recursive: true });
    fs.writeFileSync(path.join(guideDir, 'guide.md'), guideText, 'utf8');

    const sha = 'd'.repeat(40);
    const porcelain = guideText
      .split('\n')
      .map((t, i) => `${sha} ${i + 1} ${i + 1} 1\nauthor-mail <jamesnw@gmail.com>\n\t${t}`)
      .join('\n');

    const mBlame = mock.method(githubApi, 'getGuideBlamePorcelain', () => porcelain);
    const mCommitLogin = mock.method(githubApi, 'getCommitAuthorLogin', () => 'jamesnw');
    const mWrite = mock.method(githubApi, 'hasUserWriteAccess', (u: string) => u.toLowerCase() === 'jamesnw');
    const mRevState = mock.method(githubApi, 'getPrReviewState', () => ({ reviewRequests: [], reviews: [] }));
    const mRemoved = mock.method(githubApi, 'getPrRemovedReviewers', () => []);
    const mFileContent = mock.method(githubApi, 'getPrFileContent', () => null);
    const mUnlabeled = mock.method(githubApi, 'getPrUnlabeledEvents', () => []);

    const cfg: AtlConfig = {
      default: { 'ui-behaviors': 'LeaVerou' },
      web_features: {},
      web_features_groups: {}
    };

    try {
      // 1. Someone else updates jamesnw's guide -> routes to jamesnw instead of LeaVerou!
      const r1 = handlePR(
        4001,
        'other-peer',
        cfg,
        undefined,
        tmpDir,
        ['content'],
        {
          dryRun: true,
          isDraft: false,
          prBody: '',
          preloadedFiles: ['guides/ui-behaviors/popover-menu/guide.md'],
          enableGitAuthorRouting: true
        }
      );
      assert.deepEqual(r1, ['jamesnw']);

      // 2. jamesnw updates his own guide -> cascades to LeaVerou!
      const r2 = handlePR(
        4002,
        'jamesnw',
        cfg,
        undefined,
        tmpDir,
        ['content'],
        {
          dryRun: true,
          isDraft: false,
          prBody: '',
          preloadedFiles: ['guides/ui-behaviors/popover-menu/guide.md'],
          enableGitAuthorRouting: true
        }
      );
      assert.deepEqual(r2, ['LeaVerou']);

      // 3. jamesnw was manually unassigned -> cascades to LeaVerou!
      mRemoved.mock.mockImplementation(() => ['jamesnw']);
      const r3 = handlePR(
        4003,
        'other-peer',
        cfg,
        undefined,
        tmpDir,
        ['content'],
        {
          dryRun: true,
          isDraft: false,
          prBody: '',
          preloadedFiles: ['guides/ui-behaviors/popover-menu/guide.md'],
          enableGitAuthorRouting: true
        }
      );
      assert.deepEqual(r3, ['LeaVerou']);
    } finally {
      mBlame.mock.restore();
      mCommitLogin.mock.restore();
      mWrite.mock.restore();
      mRevState.mock.restore();
      mRemoved.mock.restore();
      mFileContent.mock.restore();
      mUnlabeled.mock.restore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
