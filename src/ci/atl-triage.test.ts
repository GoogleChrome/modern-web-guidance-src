import assert from 'node:assert/strict';
import child_process from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, type TestContext } from 'node:test';
import { getTranscludedFeatureIds, parseArguments } from '../core/macro-parsing.ts';
import { handleIssue, main, triagePullRequest } from './atl-triage.ts';
import {
  githubApi,
  isBotLogin,
  parseIssueTimelineEvents,
  parsePrIntakeMetadata,
  type GhEditSpec,
  type PrIntakeMetadata
} from './github-client.ts';
import type { LinkedIssueInfo } from './pr-intake.ts';
import type { AtlConfig } from './reviewer-routing.ts';

process.env.GH_TOKEN = 'fake-test-token';
process.env.GITHUB_TOKEN = 'fake-test-token';

const sampleAtlConfig: AtlConfig = {
  default: {
    css: 'LeaVerou',
    performance: ['tunetheweb', 'malchata']
  },
  web_features: {},
  web_features_groups: {}
};

const BASE_PR_META: PrIntakeMetadata = {
  title: 'Update guide',
  body: 'Fixes #500',
  state: 'OPEN',
  isDraft: false,
  additions: 20,
  deletions: 5,
  headRefOid: 'abc1234',
  headRefName: 'fix-guide',
  isSameRepo: false,
  author: 'ext-user',
  authorIsBot: false,
  labels: [],
  files: ['guides/css/anchor-positioning-tab-underline/guide.md'],
  reviewRequests: [],
  reviews: [],
  participantLogins: [],
  comments: [],
  claState: 'success'
};

function setupPrMocks(
  t: TestContext,
  overrides: {
    meta?: Partial<PrIntakeMetadata>;
    hasWriteAccess?: (login: string) => boolean;
    isOrgMember?: (login: string) => boolean;
    issues?: Record<number, LinkedIssueInfo>;
    botRequested?: string[];
    removedReviewers?: string[];
    blamePorcelain?: string | null;
    commitLogin?: string | null;
  } = {}
) {
  const calls = {
    prEdits: [] as GhEditSpec[],
    comments: [] as string[],
    closed: [] as number[],
    bodyUpdates: [] as string[]
  };

  t.mock.method(githubApi, 'getPrIntakeMetadata', () => ({ ...BASE_PR_META, ...overrides.meta }));
  t.mock.method(githubApi, 'hasUserWriteAccess', overrides.hasWriteAccess ?? (() => false));
  t.mock.method(githubApi, 'isOrgMember', overrides.isOrgMember ?? (() => false));
  t.mock.method(githubApi, 'getLinkedIssueInfo', (n: number) => overrides.issues?.[n] ?? null);
  t.mock.method(githubApi, 'getIssueTimelineSummary', () => ({
    unlabeledLower: new Set<string>(),
    unassignedLower: new Set<string>(),
    removedReviewersLower: new Set((overrides.removedReviewers ?? []).map(r => r.toLowerCase())),
    botRequestedLower: new Set((overrides.botRequested ?? []).map(r => r.toLowerCase()))
  }));
  t.mock.method(githubApi, 'getPrFileContent', () => null);
  t.mock.method(githubApi, 'getGuideBlamePorcelain', () => overrides.blamePorcelain ?? null);
  t.mock.method(githubApi, 'getCommitAuthorLogin', () => overrides.commitLogin ?? null);
  t.mock.method(githubApi, 'getOpenPrReviewCounts', () => new Map());
  t.mock.method(githubApi, 'editItem', (_kind: 'issue' | 'pr', _n: number, spec: GhEditSpec) => {
    calls.prEdits.push(spec);
  });
  t.mock.method(githubApi, 'addPrComment', (_n: number, body: string) => {
    calls.comments.push(body);
  });
  t.mock.method(githubApi, 'closePr', (n: number) => {
    calls.closed.push(n);
  });
  t.mock.method(githubApi, 'updatePrBody', (_n: number, body: string) => {
    calls.bodyUpdates.push(body);
  });

  return calls;
}

describe('macro-parsing helpers used by CI triage', () => {
  it('parses macro arguments and extracts transcluded feature IDs while ignoring BASELINE_STATUS', () => {
    assert.deepEqual(parseArguments('"customizable-select", "usage"'), ['customizable-select', 'usage']);
    const md = [
      '{{ FEATURE("customizable-select", "usage") }}',
      "{{ FEATURE_FALLBACKS('scrollbar-color') }}",
      '{{ FEATURE_ISSUES("color-scheme") }}',
      '{{ INCLUDE("../../features/light-dark.md#issues") }}',
      '{{ BASELINE_STATUS("popover") }}'
    ].join('\n');
    assert.deepEqual(
      getTranscludedFeatureIds(md).sort(),
      ['color-scheme', 'customizable-select', 'light-dark', 'scrollbar-color'].sort()
    );
  });
});

describe('github-client boundary parsers', () => {
  it('classifies bot logins consistently across [bot], app/, and known GitHub App slugs', () => {
    assert.equal(isBotLogin('github-actions[bot]'), true);
    assert.equal(isBotLogin('google-cla'), true);
    assert.equal(isBotLogin('chrome-devrel-infra'), true);
    assert.equal(isBotLogin('app/dependabot'), true);
    assert.equal(isBotLogin('paulirish'), false);
    assert.equal(isBotLogin(''), false);
  });

  it('parses default-named external forks as isSameRepo=false and filters bot comments from participants', () => {
    const forked = parsePrIntakeMetadata({
      title: 'Fix dialog',
      body: 'Fixes #3615',
      state: 'OPEN',
      isCrossRepository: true,
      headRepository: { name: 'modern-web-guidance-src', nameWithOwner: 'mschoi0411/modern-web-guidance-src' },
      headRepositoryOwner: { login: 'mschoi0411' },
      author: { login: 'mschoi0411' },
      comments: [
        { author: { login: 'google-cla' }, body: 'Sign CLA' },
        { author: { login: 'mschoi0411' }, body: 'Signed' }
      ],
      statusCheckRollup: [{ name: 'cla/google', conclusion: 'FAILURE' }]
    });
    assert.equal(forked.isSameRepo, false);
    assert.deepEqual(forked.participantLogins, []);
    assert.equal(forked.claState, 'failure');

    const upstream = parsePrIntakeMetadata({
      isCrossRepository: false,
      headRepository: { name: 'modern-web-guidance-src', nameWithOwner: 'GoogleChrome/modern-web-guidance-src' },
      headRepositoryOwner: { login: 'GoogleChrome' },
      author: { login: 'paulirish' },
      statusCheckRollup: [{ name: 'cla/google', conclusion: 'SUCCESS' }]
    });
    assert.equal(upstream.isSameRepo, true);
    assert.equal(upstream.claState, 'success');
  });

  it('summarizes timeline events and tracks latest bot vs human review_requested actor', () => {
    const summary = parseIssueTimelineEvents([
      { event: 'review_requested', actorLogin: 'chrome-devrel-infra', reviewer: 'LeaVerou' },
      { event: 'review_requested', actorLogin: 'paulirish', actorType: 'User', reviewer: 'TravenReese' },
      { event: 'review_requested', actorLogin: 'github-actions[bot]', actorType: 'Bot', reviewer: 'bramus' },
      { event: 'review_requested', actorLogin: 'LeaVerou', actorType: 'User', reviewer: 'bramus' },
      { event: 'unlabeled', actorLogin: 'rviscomi', actorType: 'User', label: 'Needs-ATL' },
      { event: 'unlabeled', actorLogin: 'chrome-devrel-infra', label: 'awaiting-cla' },
      { event: 'unassigned', actorLogin: 'paulirish', actorType: 'User', assignee: 'RViscomi' },
      { event: 'review_request_removed', actorLogin: 'LeaVerou', actorType: 'User', reviewer: 'Malchata' }
    ]);

    assert.deepEqual(Array.from(summary.botRequestedLower), ['leaverou']);
    assert.deepEqual(Array.from(summary.unlabeledLower), ['needs-atl']);
    assert.deepEqual(Array.from(summary.unassignedLower), ['rviscomi']);
    assert.deepEqual(Array.from(summary.removedReviewersLower), ['malchata']);
  });
});

describe('handleIssue orchestration', () => {
  it('applies issue label and assignee updates in one editItem call and respects no-atl-triage and dryRun', t => {
    const edits: GhEditSpec[] = [];
    t.mock.method(githubApi, 'getIssueSnapshot', () => ({ body: '', labels: [], assignees: [] }));
    t.mock.method(githubApi, 'getIssueTimelineSummary', () => ({
      unlabeledLower: new Set<string>(),
      unassignedLower: new Set<string>(),
      removedReviewersLower: new Set<string>(),
      botRequestedLower: new Set<string>()
    }));
    t.mock.method(githubApi, 'editItem', (_kind: 'issue' | 'pr', _n: number, spec: GhEditSpec) => {
      edits.push(spec);
    });

    assert.deepEqual(handleIssue(10, ['css'], '<!-- no-atl-triage -->', sampleAtlConfig), []);
    assert.equal(edits.length, 0);

    assert.deepEqual(handleIssue(10, ['css'], '', sampleAtlConfig, { dryRun: true }), ['LeaVerou']);
    assert.equal(edits.length, 0);

    assert.deepEqual(handleIssue(10, ['css', 'needs-atl'], '', sampleAtlConfig, { dryRun: false }), ['LeaVerou']);
    assert.deepEqual(edits, [
      { addLabels: [], removeLabels: ['needs-atl'], addAssignees: ['LeaVerou'] }
    ]);
  });
});

describe('triagePullRequest orchestration', () => {
  it('closes unapproved external PRs even if body contains <!-- no-atl-triage -->, clearing bot reviewers', t => {
    const calls = setupPrMocks(t, {
      meta: {
        body: '<!-- no-atl-triage -->\nFixes #1833',
        reviewRequests: ['LeaVerou']
      },
      issues: {
        1833: { number: 1833, state: 'open', author: 'rviscomi', labels: ['content'], assignees: ['LeaVerou'] }
      },
      botRequested: ['leaverou']
    });

    const res = triagePullRequest(3602, sampleAtlConfig, { dryRun: false });
    assert.equal(res.decision?.kind, 'close');
    assert.deepEqual(calls.prEdits, [{ removeReviewers: ['LeaVerou'] }]);
    assert.equal(calls.comments.length, 1);
    assert.ok(calls.comments[0].includes('#1833'));
    assert.deepEqual(calls.closed, [3602]);
  });

  it('adds awaiting-cla and withholds reviewers when an approved external PR fails cla/google', t => {
    const calls = setupPrMocks(t, {
      meta: { claState: 'failure' },
      issues: {
        500: { number: 500, state: 'open', author: 'LeaVerou', labels: ['pr-welcome'], assignees: [] }
      }
    });

    const res = triagePullRequest(3634, sampleAtlConfig, { dryRun: false });
    assert.equal(res.decision?.kind, 'hold-cla');
    assert.deepEqual(calls.prEdits, [{ addLabels: ['awaiting-cla'], removeReviewers: [] }]);
    assert.equal(calls.comments.length, 1);
  });

  it('wakes awaiting-cla PRs once CLA passes, routes Tier 1 git author + infra owners, and removes stale bot reviewers', t => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-pr-orch-'));
    try {
      const guideDir = path.join(tmpDir, 'css', 'tabs');
      fs.mkdirSync(guideDir, { recursive: true });
      const guideText = ['---', 'name: tabs', '---', '', ...Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`)].join('\n');
      fs.writeFileSync(path.join(guideDir, 'guide.md'), guideText, 'utf8');

      const sha = 'f'.repeat(40);
      const porcelain = guideText
        .split('\n')
        .map((txt, i) => `${sha} ${i + 1} ${i + 1} 1\nauthor-mail <jamesnw@gmail.com>\n\t${txt}`)
        .join('\n');

      const calls = setupPrMocks(t, {
        meta: {
          labels: ['awaiting-cla'],
          files: ['guides/css/tabs/guide.md', 'src/cli/foo.ts'],
          reviewRequests: ['bramus', 'TravenReese']
        },
        issues: {
          500: { number: 500, state: 'open', author: 'LeaVerou', labels: ['pr-welcome'], assignees: [] }
        },
        hasWriteAccess: login => login.toLowerCase() === 'jamesnw',
        botRequested: ['bramus'],
        blamePorcelain: porcelain,
        commitLogin: 'jamesnw'
      });

      const res = triagePullRequest(3700, sampleAtlConfig, { dryRun: false, guidesRootDir: tmpDir });
      assert.equal(res.decision?.kind, 'allow');
      assert.deepEqual(
        res.reviewers.slice().sort(),
        ['jamesnw', 'lusayaa', 'paulirish'].sort()
      );
      assert.deepEqual(calls.prEdits, [
        {
          addLabels: ['content'],
          removeLabels: ['awaiting-cla'],
          removeReviewers: ['bramus'],
          addReviewers: res.reviewers
        }
      ]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('honors <!-- no-atl-triage --> on allowed collaborator PRs without requesting reviewers', t => {
    const calls = setupPrMocks(t, {
      meta: {
        isSameRepo: true,
        author: 'paulirish',
        body: 'Internal cleanup\n\n<!-- no-atl-triage -->'
      }
    });

    const res = triagePullRequest(3701, sampleAtlConfig, { dryRun: false });
    assert.equal(res.decision?.kind, 'allow');
    assert.deepEqual(res.reviewers, []);
    assert.equal(calls.prEdits.length, 0);
  });

  it('propagates transient API errors instead of silently auto-closing PRs or dropping Tier 1 authors', t => {
    const calls = setupPrMocks(t);
    t.mock.method(githubApi, 'getLinkedIssueInfo', () => {
      throw new Error('gh: HTTP 502 Bad Gateway');
    });

    assert.throws(() => triagePullRequest(4005, sampleAtlConfig, { dryRun: false }), /HTTP 502/);
    assert.deepEqual(calls.closed, []);
  });

  it('re-checks claState right after adding awaiting-cla so fork check_run races immediately wake', t => {
    const calls = setupPrMocks(t, {
      issues: {
        500: { number: 500, state: 'open', author: 'LeaVerou', labels: ['pr-welcome'], assignees: [] }
      }
    });
    let metaReads = 0;
    t.mock.method(githubApi, 'getPrIntakeMetadata', () => {
      metaReads++;
      if (metaReads === 1) return { ...BASE_PR_META, claState: 'pending' as const };
      return { ...BASE_PR_META, labels: ['awaiting-cla'], claState: 'success' as const };
    });

    const res = triagePullRequest(4006, sampleAtlConfig, { dryRun: false });
    assert.equal(res.decision?.kind, 'allow');
    assert.deepEqual(res.reviewers, ['LeaVerou']);
    assert.equal(calls.prEdits.length, 2);
  });

  it('lets read-only org members bypass the issue gate while still enforcing cla/google', async t => {
    await t.test('allows and routes when cla/google passes', st => {
      const calls = setupPrMocks(st, {
        meta: {
          author: 'googler-colleague',
          body: 'No linked issue yet',
          claState: 'success'
        },
        isOrgMember: login => login === 'googler-colleague'
      });

      const allowed = triagePullRequest(3719, sampleAtlConfig, { dryRun: false });
      assert.deepEqual(allowed.decision, { kind: 'allow', via: 'org-member', approvedIssue: undefined });
      assert.deepEqual(allowed.reviewers, ['LeaVerou']);
      assert.deepEqual(calls.closed, []);
    });

    await t.test('holds with awaiting-cla when cla/google fails', st => {
      const heldCalls = setupPrMocks(st, {
        meta: {
          author: 'googler-colleague',
          body: 'No linked issue yet',
          claState: 'failure'
        },
        isOrgMember: login => login === 'googler-colleague'
      });

      const held = triagePullRequest(3720, sampleAtlConfig, { dryRun: false });
      assert.deepEqual(held.decision, {
        kind: 'hold-cla',
        claState: 'failure',
        via: 'org-member',
        approvedIssue: undefined
      });
      assert.deepEqual(heldCalls.prEdits, [{ addLabels: ['awaiting-cla'], removeReviewers: [] }]);
      assert.deepEqual(heldCalls.closed, []);
    });
  });

  it('rejects unapproved prose-typo-fix PRs that modify guide.md YAML frontmatter', t => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-fm-tamper-'));
    try {
      const guideDir = path.join(tmpDir, 'css', 'tabs');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, 'guide.md'), '---\nname: tabs\n---\n# Tabs\n', 'utf8');

      const calls = setupPrMocks(t, {
        meta: {
          body: 'Fix typo',
          files: ['guides/css/tabs/guide.md'],
          additions: 1,
          deletions: 1
        }
      });
      t.mock.method(githubApi, 'getPrFileContent', () => '---\nname: tabs\nweb-feature-ids:\n  - popover\n---\n# Tabs\n');

      const res = triagePullRequest(4007, sampleAtlConfig, { dryRun: false, guidesRootDir: tmpDir });
      assert.equal(res.decision?.kind, 'close');
      assert.deepEqual(calls.closed, [4007]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('githubApi wrappers & main() scheduled CLA sweep', () => {
  it('splits --remove-reviewer from --add-reviewer in editItem and discriminates 404/410 vs 5xx errors', t => {
    const ghArgs: string[][] = [];
    t.mock.method(child_process, 'execFileSync', (_cmd: unknown, args?: readonly string[]) => {
      const list = [...(args ?? [])];
      ghArgs.push(list);
      const joined = list.join(' ');
      if (joined.includes('collaborators/ghost/permission')) {
        throw Object.assign(new Error('404'), { stderr: 'gh: HTTP 404 (Not Found)' });
      }
      if (joined.includes('collaborators/flaky/permission')) {
        throw Object.assign(new Error('502'), { stderr: 'gh: HTTP 502 Bad Gateway' });
      }
      if (joined.includes('orgs/{owner}/members/outsider')) {
        throw Object.assign(new Error('404'), {
          stderr: 'gh: User does not exist or is not a member of the organization (HTTP 404)'
        });
      }
      if (joined.includes('orgs/{owner}/members/private-unauth')) {
        throw Object.assign(new Error('404'), {
          stderr: 'gh: User does not exist or is not a public member of the organization (HTTP 404)',
          stdout: JSON.stringify({
            message: 'User does not exist or is not a public member of the organization',
            documentation_url: 'https://docs.github.com/rest/orgs/members#check-public-organization-membership-for-a-user'
          })
        });
      }
      if (joined.includes('orgs/{owner}/members/denied')) {
        throw Object.assign(new Error('403'), { stderr: 'gh: HTTP 403 Forbidden' });
      }
      if (joined.includes('issues/404')) {
        throw Object.assign(new Error('410'), { stderr: 'gh: HTTP 410 Gone' });
      }
      if (joined.includes('issues/999')) {
        return JSON.stringify({ number: 999, pull_request: {} });
      }
      if (joined.includes('commits/deadbeef')) {
        throw Object.assign(new Error('422'), { stderr: 'gh: HTTP 422' });
      }
      if (list[0] === 'pr' && list[1] === 'list') {
        return JSON.stringify([{ number: 11 }, { number: 12 }]);
      }
      return '';
    });

    githubApi.editItem('pr', 55, {
      addLabels: ['content'],
      removeReviewers: ['bramus'],
      addReviewers: ['LeaVerou']
    });
    assert.deepEqual(ghArgs.slice(0, 2), [
      ['pr', 'edit', '55', '--add-label', 'content', '--remove-reviewer', 'bramus'],
      ['pr', 'edit', '55', '--add-reviewer', 'LeaVerou']
    ]);

    assert.equal(githubApi.hasUserWriteAccess(''), false);
    assert.equal(githubApi.hasUserWriteAccess('ghost'), false);
    assert.throws(() => githubApi.hasUserWriteAccess('flaky'), /502/);
    assert.equal(githubApi.isOrgMember(''), false);
    assert.equal(githubApi.isOrgMember('danilsomsikov'), true);
    assert.equal(githubApi.isOrgMember('outsider'), false);
    assert.throws(() => githubApi.isOrgMember('private-unauth'), /404/);
    assert.throws(() => githubApi.isOrgMember('denied'), /403/);
    assert.equal(githubApi.getLinkedIssueInfo(404), null);
    assert.equal(githubApi.getLinkedIssueInfo(999), null);
    assert.equal(githubApi.getCommitAuthorLogin('deadbeef'), null);
    assert.deepEqual(githubApi.listOpenAwaitingClaPrs(), [11, 12]);
  });

  it('sweeps open awaiting-cla PRs on schedule in main() and continues past single-PR errors', t => {
    const tmpEvent = path.join(os.tmpdir(), `mwg-schedule-${process.pid}.json`);
    fs.writeFileSync(tmpEvent, JSON.stringify({ schedule: '0 * * * *' }), 'utf8');
    const prevEventPath = process.env.GITHUB_EVENT_PATH;
    const prevEventName = process.env.GITHUB_EVENT_NAME;
    const prevExitCode = process.exitCode;
    process.env.GITHUB_EVENT_PATH = tmpEvent;
    process.env.GITHUB_EVENT_NAME = 'schedule';

    try {
      const calls = setupPrMocks(t, {
        meta: { labels: ['awaiting-cla'], headRefOid: 'abc1234' },
        issues: { 500: { number: 500, state: 'open', author: 'LeaVerou', labels: ['pr-welcome'], assignees: [] } }
      });
      t.mock.method(githubApi, 'listOpenAwaitingClaPrs', () => [3699, 3700]);
      const baseMeta = githubApi.getPrIntakeMetadata;
      t.mock.method(githubApi, 'getPrIntakeMetadata', (prNumber: number) => {
        if (prNumber === 3699) throw new Error('HTTP 502 Bad Gateway');
        return baseMeta(prNumber);
      });

      main();
      assert.equal(process.exitCode, 1);
      assert.equal(calls.prEdits.length, 1);
      assert.deepEqual(calls.prEdits[0].removeLabels, ['awaiting-cla']);
      assert.deepEqual(calls.prEdits[0].addReviewers, ['LeaVerou']);
    } finally {
      process.exitCode = prevExitCode;
      if (prevEventPath === undefined) delete process.env.GITHUB_EVENT_PATH;
      else process.env.GITHUB_EVENT_PATH = prevEventPath;
      if (prevEventName === undefined) delete process.env.GITHUB_EVENT_NAME;
      else process.env.GITHUB_EVENT_NAME = prevEventName;
      fs.rmSync(tmpEvent, { force: true });
    }
  });
});
