import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTAKE_CLA_MARKER,
  INTAKE_CLOSE_MARKER,
  evaluatePrIntake,
  extractIssueNumbers,
  formatAutoCloseComment,
  formatClaHoldComment,
  hasNoAtlTriageDirective,
  isSmallProseTypoFix,
  type LinkedIssueInfo,
  type PrIntakeInput
} from './pr-intake.ts';

function makeIntakeInput(
  overrides: Partial<Omit<PrIntakeInput, 'resolveIssue'>> & {
    issues?: Record<number, LinkedIssueInfo>;
    resolveIssue?: (n: number) => LinkedIssueInfo | null;
  } = {}
): PrIntakeInput {
  const { issues = {}, resolveIssue, ...rest } = overrides;
  return {
    prAuthor: 'external-dev',
    authorIsBot: false,
    authorHasWriteAccess: false,
    authorIsOrgMember: false,
    hasMaintainerEngagement: false,
    prLabels: [],
    title: 'Add cool guide',
    body: 'Fixes #100',
    files: ['guides/css/anchor/guide.md'],
    additions: 50,
    deletions: 10,
    claState: 'success',
    resolveIssue: resolveIssue ?? (n => issues[n] ?? null),
    ...rest
  };
}

describe('extractIssueNumbers', () => {
  it('extracts title refs and target/closing body refs while ignoring code, comments, hex colors, and prose asides', () => {
    const body = [
      'Fixes #123, closes https://github.com/GoogleChrome/modern-web-guidance-src/issues/456',
      'Color swatch is #888 and unrelated to #3618-adjacent.',
      '<!-- Fixes #999 -->',
      'Inline `Fixes #888` and fenced block with unclosed comment:',
      '```html',
      '<!-- unclosed comment inside code fence',
      'Fixes #777',
      '```',
      'Part of #321, and [#654](https://github.com/GoogleChrome/modern-web-guidance-src/issues/654)'
    ].join('\n');

    assert.deepEqual(extractIssueNumbers('[#42] Update guide (#77)', body), [42, 77, 123, 456, 321, 654]);
  });
});

describe('hasNoAtlTriageDirective', () => {
  it('matches HTML comment directive outside code spans and ignores code examples', () => {
    assert.equal(hasNoAtlTriageDirective('<!-- no-atl-triage -->'), true);
    assert.equal(hasNoAtlTriageDirective('Text\n<!--  NO-ATL-TRIAGE  -->'), true);
    assert.equal(hasNoAtlTriageDirective(''), false);
    assert.equal(hasNoAtlTriageDirective(null), false);
    assert.equal(hasNoAtlTriageDirective('Plain text no-atl-triage mention'), false);
    assert.equal(hasNoAtlTriageDirective('Inline `<!-- no-atl-triage -->` example'), false);
    assert.equal(hasNoAtlTriageDirective('```md\n<!-- no-atl-triage -->\n```'), false);
    assert.equal(hasNoAtlTriageDirective('`<!-- no-atl-triage -->`\n<!-- no-atl-triage -->'), true);
  });
});

describe('isSmallProseTypoFix', () => {
  it('allows <=5-line markdown prose typo fixes in at most one guide and rejects code/eval/multi-guide edits', async t => {
    const cases: Array<{ name: string; files: string[]; additions: number; deletions: number; expected: boolean }> = [
      { name: '2-line guide.md fix', files: ['guides/css/popover/guide.md'], additions: 2, deletions: 2, expected: true },
      { name: '1-line README fix', files: ['README.md'], additions: 1, deletions: 1, expected: true },
      { name: '1-line docs/*.md fix', files: ['docs/ATLS.md'], additions: 1, deletions: 1, expected: true },
      { name: '0-line empty diff', files: ['README.md'], additions: 0, deletions: 0, expected: false },
      { name: '>5 additions', files: ['guides/css/popover/guide.md'], additions: 6, deletions: 1, expected: false },
      { name: 'demo.html edit', files: ['guides/css/popover/demo.html'], additions: 1, deletions: 1, expected: false },
      { name: 'expectations.md edit', files: ['guides/css/popover/expectations.md'], additions: 1, deletions: 1, expected: false },
      { name: 'task.md edit', files: ['guides/css/popover/tasks/task.md'], additions: 1, deletions: 1, expected: false },
      { name: 'GOVERNANCE.md edit', files: ['GOVERNANCE.md'], additions: 1, deletions: 1, expected: false },
      { name: '.github template edit', files: ['.github/PULL_REQUEST_TEMPLATE.md'], additions: 1, deletions: 1, expected: false },
      { name: 'features/*.md edit', files: ['features/popover.md'], additions: 1, deletions: 1, expected: false },
      { name: 'skills-src edit', files: ['skills-src/baseline/SKILL.md'], additions: 1, deletions: 1, expected: false },
      { name: '2-file doc sweep', files: ['README.md', 'CONTRIBUTING.md'], additions: 2, deletions: 2, expected: false },
      {
        name: 'sweeping 2 guides',
        files: ['guides/css/a/guide.md', 'guides/css/b/guide.md'],
        additions: 2,
        deletions: 2,
        expected: false
      }
    ];

    for (const c of cases) {
      await t.test(c.name, () => {
        assert.equal(isSmallProseTypoFix(c), c.expected);
      });
    }
  });
});

describe('evaluatePrIntake', () => {
  it('allows collaborators and bots unconditionally regardless of CLA or issue state', () => {
    assert.deepEqual(
      evaluatePrIntake(makeIntakeInput({ authorHasWriteAccess: true, claState: 'missing', body: '' })),
      { kind: 'allow', via: 'write-access' }
    );
    assert.deepEqual(
      evaluatePrIntake(makeIntakeInput({ authorIsBot: true, claState: 'missing', body: '' })),
      { kind: 'allow', via: 'bot' }
    );
  });

  it('closes external PRs with no approved issue, closed issue, or maintainer-only issue', () => {
    assert.deepEqual(evaluatePrIntake(makeIntakeInput({ body: 'No issue' })), {
      kind: 'close',
      reason: 'no-approved-issue',
      referencedIssues: []
    });

    assert.deepEqual(
      evaluatePrIntake(
        makeIntakeInput({
          issues: {
            100: { number: 100, state: 'open', author: 'rviscomi', labels: ['content'], assignees: ['LeaVerou'] }
          }
        })
      ),
      { kind: 'close', reason: 'no-approved-issue', referencedIssues: [100] }
    );

    assert.deepEqual(
      evaluatePrIntake(
        makeIntakeInput({
          issues: {
            100: { number: 100, state: 'closed', author: 'rviscomi', labels: ['pr-welcome'], assignees: [] }
          }
        })
      ),
      { kind: 'close', reason: 'no-approved-issue', referencedIssues: [100] }
    );
  });

  it('allows external PRs via pr-welcome issue, author-assigned issue, PR label, engagement, or typo fix — and short-circuits lookups', () => {
    const lookedUp: number[] = [];
    const res = evaluatePrIntake(
      makeIntakeInput({
        body: 'Fixes #100, #200',
        resolveIssue: n => {
          lookedUp.push(n);
          return n === 100
            ? { number: 100, state: 'open', author: 'rviscomi', labels: ['pr-welcome'], assignees: [] }
            : { number: 200, state: 'open', author: 'rviscomi', labels: [], assignees: [] };
        }
      })
    );
    assert.deepEqual(res, { kind: 'allow', via: 'approved-issue', approvedIssue: 100 });
    assert.deepEqual(lookedUp, [100]);

    assert.deepEqual(
      evaluatePrIntake(
        makeIntakeInput({
          prAuthor: 'ExtUser',
          issues: { 100: { number: 100, state: 'open', author: 'ExtUser', labels: [], assignees: ['extuser'] } }
        })
      ),
      { kind: 'allow', via: 'approved-issue', approvedIssue: 100 }
    );

    assert.deepEqual(
      evaluatePrIntake(makeIntakeInput({ prLabels: ['pr-welcome'], body: '' })),
      { kind: 'allow', via: 'pr-welcome-label', approvedIssue: undefined }
    );

    assert.deepEqual(
      evaluatePrIntake(makeIntakeInput({ hasMaintainerEngagement: true, body: '' })),
      { kind: 'allow', via: 'maintainer-engaged', approvedIssue: undefined }
    );

    const orgLookups: number[] = [];
    assert.deepEqual(
      evaluatePrIntake(
        makeIntakeInput({
          authorIsOrgMember: true,
          body: 'Fixes #100',
          resolveIssue: n => {
            orgLookups.push(n);
            return null;
          }
        })
      ),
      { kind: 'allow', via: 'org-member', approvedIssue: undefined }
    );
    assert.deepEqual(orgLookups, []);

    assert.deepEqual(
      evaluatePrIntake(makeIntakeInput({ body: '', additions: 1, deletions: 1 })),
      { kind: 'allow', via: 'prose-typo-fix', approvedIssue: undefined }
    );
  });

  it('holds approved external and org-member PRs when cla/google is failure, pending, or missing', () => {
    for (const claState of ['failure', 'pending', 'missing'] as const) {
      assert.deepEqual(
        evaluatePrIntake(
          makeIntakeInput({
            claState,
            issues: { 100: { number: 100, state: 'open', author: 'rviscomi', labels: ['pr-welcome'], assignees: [] } }
          })
        ),
        { kind: 'hold-cla', claState, via: 'approved-issue', approvedIssue: 100 }
      );
      assert.deepEqual(
        evaluatePrIntake(makeIntakeInput({ authorIsOrgMember: true, claState, body: '' })),
        { kind: 'hold-cla', claState, via: 'org-member', approvedIssue: undefined }
      );
    }
  });
});

describe('intake comment formatters', () => {
  it('includes idempotency markers, issue context, and zero Unicode em-dashes', () => {
    const closeMsg = formatAutoCloseComment('alice', [1833]);
    assert.ok(closeMsg.startsWith(INTAKE_CLOSE_MARKER));
    assert.ok(closeMsg.includes('#1833'));
    assert.ok(!closeMsg.includes('—'));

    const claMsg = formatClaHoldComment('bob');
    assert.ok(claMsg.startsWith(INTAKE_CLA_MARKER));
    assert.ok(claMsg.includes('cla.developers.google.com'));
    assert.ok(!claMsg.includes('—'));
  });
});
