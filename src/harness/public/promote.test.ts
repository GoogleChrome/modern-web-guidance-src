import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPromote, applyUnpublish, loadValidatedAllowlist } from './allowlist.ts';
import type { PendingChange, PublicAllowlist } from './allowlist.ts';
import type { SuiteBuildResult } from './builder.ts';
import { FIXTURE_SUITE, makeFixtureStore } from './fixtures/make-store.ts';
import {
  checkNowPolicy,
  checkSiteOutcome,
  flagConflict,
  openPullRequest,
  runNow,
  verifyCleanAtOriginMain,
  writeAllowlist,
} from './promote.ts';
import { LocalSuiteStore } from './suite-store.ts';

const NIGHTLY = 'nightly-2026-10-20_20-43-48-codex_cli';
const CREATED_AT = '2026-10-25T12:00:00Z';

const base: PublicAllowlist = {
  include: ['nightly-*-codex_cli'],
  exclude: [],
  overrides: [],
  releasedModels: ['example-model'],
};

function makePending(
  command: 'promote' | 'unpublish',
  suiteId = NIGHTLY,
  guides: string[] = [],
  createdAt = CREATED_AT,
): PendingChange {
  return { command, suiteId, guides, createdAt };
}

function makeResult(suiteId: string, status: SuiteBuildResult['status'], reason?: string): SuiteBuildResult {
  return { suiteId, status, reason, files: 0, bytes: 0, truncatedPatches: 0 };
}

describe('writeAllowlist', () => {
  test('writes stable, schema-first JSON that loads back unchanged', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-write-'));
    const file = path.join(dir, 'allowlist.json');
    const allowlist = applyUnpublish(base, NIGHTLY, ['security']).allowlist;

    writeAllowlist(file, allowlist);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('{\n  "$schema": "./allowlist.schema.json",\n  "include"'));
    assert.ok(text.endsWith('}\n'));
    assert.deepEqual(loadValidatedAllowlist(file), allowlist);
  });

  test('refuses to write an allowlist that violates schema or policy', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-invalid-'));
    const file = path.join(dir, 'allowlist.json');

    assert.throws(() => writeAllowlist(file, { ...base, exclude: ['nightly-*'] }), /allowlist schema/);
    assert.throws(() => writeAllowlist(file, { ...base, include: ['adhoc-*'] }), /allowlist policy/);
    assert.ok(!fs.existsSync(file), 'invalid allowlist is never written');
  });
});

describe('flagConflict', () => {
  test('--now and --no-pr cannot be combined; every other combination is allowed', () => {
    assert.match(flagConflict({ now: true, 'no-pr': true }) ?? '', /--now and --no-pr cannot be combined/);
    assert.equal(flagConflict({ now: true, 'no-pr': false }), undefined);
    assert.equal(flagConflict({ now: false, 'no-pr': true }), undefined);
    assert.equal(flagConflict({ now: false, 'no-pr': false }), undefined);
  });
});

describe('verifyCleanAtOriginMain', () => {
  const MAIN_SHA = '1111111122222222333333334444444455555555';
  const OTHER_SHA = 'aaaaaaaa22222222333333334444444455555555';

  function fakeGit(opts: { status?: string; head?: string; originMain?: string }) {
    return (args: string[]): string => {
      const cmd = args.join(' ');
      if (cmd === 'status --porcelain') return opts.status ?? '';
      if (cmd === 'rev-parse HEAD') return `${opts.head ?? MAIN_SHA}\n`;
      if (cmd === 'rev-parse origin/main') return `${opts.originMain ?? MAIN_SHA}\n`;
      throw new Error(`unexpected git call: ${cmd}`);
    };
  }

  test('passes when the working tree is clean and HEAD equals origin/main', () => {
    assert.doesNotThrow(() => verifyCleanAtOriginMain(fakeGit({})));
  });

  test('refuses any uncommitted change, including to allowlist.json itself', () => {
    assert.throws(
      () => verifyCleanAtOriginMain(fakeGit({ status: ' M src/harness/public/allowlist.json\n' })),
      /uncommitted changes/,
    );
  });

  test('refuses when HEAD is on a branch or behind origin/main', () => {
    assert.throws(
      () => verifyCleanAtOriginMain(fakeGit({ head: OTHER_SHA, originMain: MAIN_SHA })),
      /HEAD \(aaaaaaaa\) is not at origin\/main \(11111111\)/,
    );
  });
});

describe('checkNowPolicy', () => {
  test('refuses promote --now for a suite excluded on origin/main, but allows unpublish --now and non-excluded promotes', () => {
    const excluded: PublicAllowlist = { ...base, exclude: [NIGHTLY] };
    assert.throws(
      () => checkNowPolicy(makePending('promote'), excluded, 0, 0),
      /excluded by the allowlist on origin\/main/,
    );
    assert.doesNotThrow(() => checkNowPolicy(makePending('unpublish'), excluded, 0, 0));
    assert.doesNotThrow(() => checkNowPolicy(makePending('promote', 'adhoc-suite'), base, 0, 0));
  });

  test('refuses forbiddenTokensVersion mismatch when published state has suites, and allows bootstrapping empty state', () => {
    assert.throws(
      () => checkNowPolicy(makePending('unpublish'), base, 2, 0),
      /PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION=2, got 0/,
    );
    assert.throws(
      () => checkNowPolicy(makePending('unpublish'), base, 0, 1),
      /PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION=0, got 1/,
    );
    assert.doesNotThrow(() => checkNowPolicy(makePending('unpublish'), base, 2, 2));
    assert.doesNotThrow(() => checkNowPolicy(makePending('promote'), base, undefined, 3));
  });
});

describe('checkSiteOutcome', () => {
  test('refuses when any suite failed or when a promoted / guide-filtered suite did not publish', () => {
    assert.throws(
      () => checkSiteOutcome(makePending('unpublish'), [makeResult('other-suite', 'failed', 'timeout')]),
      /1 suite\(s\) failed to build/,
    );
    assert.throws(
      () => checkSiteOutcome(makePending('promote'), [makeResult(NIGHTLY, 'skipped', 'unreleased-model')]),
      /was not published: unreleased-model/,
    );
    assert.throws(
      () => checkSiteOutcome(makePending('unpublish', NIGHTLY, ['security']), []),
      /not selected by the allowlist/,
    );
  });

  test('accepts built/unchanged for promote and guide-level unpublish, and removed/absent for whole-suite unpublish', () => {
    assert.doesNotThrow(() => checkSiteOutcome(makePending('promote'), [makeResult(NIGHTLY, 'built')]));
    assert.doesNotThrow(() => checkSiteOutcome(makePending('unpublish', NIGHTLY, ['security']), [makeResult(NIGHTLY, 'unchanged')]));
    assert.doesNotThrow(() => checkSiteOutcome(makePending('unpublish'), [makeResult(NIGHTLY, 'removed')]));
    assert.doesNotThrow(() => checkSiteOutcome(makePending('unpublish'), []));
  });
});

describe('openPullRequest', () => {
  test('creates a temporary branch, opens the PR, restores the starting ref, and deletes the local branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-pr-'));
    const allowlistPath = path.join(dir, 'allowlist.json');
    const change = applyUnpublish(base, NIGHTLY, ['security']);
    const gitCalls: string[] = [];
    const ghCalls: string[] = [];

    const url = openPullRequest('unpublish', NIGHTLY, ['security'], change.edits, change.allowlist, {
      allowlistPath,
      runGit: args => {
        gitCalls.push(args.join(' '));
        if (args[0] === 'symbolic-ref') return 'main\n';
        return '';
      },
      runGh: args => {
        ghCalls.push(args.join(' '));
        if (args[1] === 'list') return '[]';
        return 'https://github.com/example/repo/pull/42\n';
      },
    });

    const expectedBranch = `public-evals/unpublish-${NIGHTLY}-security`;
    assert.equal(url, 'https://github.com/example/repo/pull/42');
    assert.deepEqual(loadValidatedAllowlist(allowlistPath), change.allowlist);
    assert.deepEqual(gitCalls, [
      'symbolic-ref --quiet --short HEAD',
      `checkout -B ${expectedBranch}`,
      `add -- ${allowlistPath}`,
      `commit --quiet -m public-evals: unpublish ${NIGHTLY} (security)`,
      `push --quiet --force -u origin ${expectedBranch}`,
      'checkout --force --quiet main',
      `branch -D ${expectedBranch}`,
    ]);
    assert.equal(ghCalls.length, 2);
    assert.match(ghCalls[0], new RegExp(`^pr list --head ${expectedBranch} --base main --state open --json url$`));
    assert.match(ghCalls[1], new RegExp(`^pr create --base main --head ${expectedBranch}`));
  });

  test('reuses an existing open PR on retry without creating or pushing a branch', () => {
    const change = applyUnpublish(base, NIGHTLY, []);
    const gitCalls: string[] = [];

    const url = openPullRequest('unpublish', NIGHTLY, [], change.edits, change.allowlist, {
      runGit: args => {
        gitCalls.push(args.join(' '));
        return '';
      },
      runGh: args => {
        assert.equal(args[1], 'list');
        return JSON.stringify([{ url: 'https://github.com/example/repo/pull/99' }]);
      },
    });

    assert.equal(url, 'https://github.com/example/repo/pull/99');
    assert.deepEqual(gitCalls, []);
  });

  test('restores the starting ref and deletes the temporary branch even if gh pr create fails', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-pr-fail-'));
    const allowlistPath = path.join(dir, 'allowlist.json');
    const change = applyUnpublish(base, NIGHTLY, []);
    const gitCalls: string[] = [];

    assert.throws(
      () => openPullRequest('unpublish', NIGHTLY, [], change.edits, change.allowlist, {
        allowlistPath,
        runGit: args => {
          gitCalls.push(args.join(' '));
          if (args[0] === 'symbolic-ref') return 'main\n';
          return '';
        },
        runGh: args => {
          if (args[1] === 'list') return '[]';
          throw new Error('gh api timeout');
        },
      }),
      /gh api timeout/,
    );

    const expectedBranch = `public-evals/unpublish-${NIGHTLY}`;
    assert.deepEqual(gitCalls.slice(-2), [
      'checkout --force --quiet main',
      `branch -D ${expectedBranch}`,
    ]);
  });
});

describe('runNow ordering', () => {
  test('never opens a PR or publishes when the build rejects an unknown guide or unreleased suite', async () => {
    const { root, baseApps } = makeFixtureStore();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-now-invalid-'));
    const freshCreatedAt = new Date().toISOString();
    let prsOpened = 0;
    let publishes = 0;

    const badGuideChange = applyUnpublish(base, FIXTURE_SUITE, ['typo-guide']);
    await assert.rejects(
      () => runNow({
        outDir,
        originMainAllowlist: base,
        change: badGuideChange,
        pendingChange: makePending('unpublish', FIXTURE_SUITE, ['typo-guide'], freshCreatedAt),
        tokens: ['exampleuser'],
        tokensVersion: 0,
        store: new LocalSuiteStore(root),
        baseAppsDir: baseApps,
        checkout: () => 'deadbeef',
        openPr: () => { prsOpened++; },
        publish: async () => { publishes++; },
      }),
      /was not published/,
    );
    assert.equal(prsOpened, 0);
    assert.equal(publishes, 0);

    const unreleasedId = 'nightly-2026-10-21_00-00-00-claude_code';
    const unreleasedPromote = applyPromote(base, unreleasedId);
    await assert.rejects(
      () => runNow({
        outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'run-now-unreleased-')),
        originMainAllowlist: base,
        change: unreleasedPromote,
        pendingChange: makePending('promote', unreleasedId, [], freshCreatedAt),
        tokens: ['exampleuser'],
        tokensVersion: 0,
        store: new LocalSuiteStore(root),
        baseAppsDir: baseApps,
        checkout: () => 'deadbeef',
        openPr: () => { prsOpened++; },
        publish: async () => { publishes++; },
      }),
      /was not published/,
    );
    assert.equal(prsOpened, 0);
    assert.equal(publishes, 0);
  });

  test('builds and validates the site before opening the PR and publishing gh-pages', async () => {
    const { root, baseApps } = makeFixtureStore();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-now-ok-'));
    const freshCreatedAt = new Date().toISOString();
    const events: string[] = [];
    const change = applyUnpublish(base, FIXTURE_SUITE, ['security']);

    await runNow({
      outDir,
      originMainAllowlist: base,
      change,
      pendingChange: makePending('unpublish', FIXTURE_SUITE, ['security'], freshCreatedAt),
      tokens: ['exampleuser'],
      tokensVersion: 0,
      store: new LocalSuiteStore(root),
      baseAppsDir: baseApps,
      checkout: () => {
        events.push('checkout');
        return 'abc12345';
      },
      openPr: () => {
        assert.ok(
          fs.existsSync(path.join(outDir, 'public-evals', FIXTURE_SUITE, 'evals.json')),
          'site build finished before openPr ran',
        );
        events.push('openPr');
      },
      publish: async (_dir, opts) => {
        assert.equal(opts.expectedHead, 'abc12345');
        events.push('publish');
      },
    });

    assert.deepEqual(events, ['checkout', 'openPr', 'publish']);
  });
});
