import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { planFixes, fixEvalGaps, evalGapFixCli, type OpenPr, type FixEvalGapsOptions } from './eval-gap-fix.ts';
import { buildIssue, type ExistingIssue, type Gap } from './eval-gap-watch.ts';
import { rootDir } from '../lib/paths.ts';
import { REPORT_FILE, TEST_APP_RESULTS_DIR, type GuideInventory } from '../lib/guide-validation.ts';

function makeGuide(name: string, overrides: Partial<GuideInventory> = {}): GuideInventory {
  return {
    dir: path.join(rootDir, 'guides', 'css', name),
    name,
    category: 'css',
    hasGuide: true,
    hasExpectations: true,
    expectationsEmpty: false,
    hasGrader: false,
    hasTask: false,
    isDisciplineGuide: false,
    draft: false,
    ...overrides,
  } as GuideInventory;
}

function issueFor(name: string, number: number, kind: Gap['kind'] = 'missing-evals', guidePath = `guides/css/${name}`): ExistingIssue {
  const { title, body } = buildIssue({ kind, guidePath, guideName: name });
  return { number, title, body };
}

const pr = (number: number, title: string): OpenPr => ({ number, title });

describe('planFixes', () => {
  it('queues a missing-evals issue whose guide still needs evals and has no PR', () => {
    const { toFix, skipped } = planFixes([issueFor('scrollspy', 1)], [], [makeGuide('scrollspy')], new Set());
    assert.deepStrictEqual(toFix.map(g => [g.issueNumber, g.guidePath]), [[1, 'guides/css/scrollspy']]);
    assert.deepStrictEqual(skipped, []);
  });

  it('includes discipline guides', () => {
    const { toFix, skipped } = planFixes([issueFor('css', 1)], [], [makeGuide('css', { isDisciplineGuide: true })], new Set());
    assert.deepStrictEqual(toFix.map(g => [g.issueNumber, g.guidePath]), [[1, 'guides/css/css']]);
    assert.deepStrictEqual(skipped, []);
  });

  it('skips guides with an open gd pr PR, matching the exact title', () => {
    const openPrs = [pr(5, 'grader updates: spinner'), pr(6, 'grader updates: spinner-large'), pr(7, 'Fix scrollspy typo')];
    const { toFix, skipped } = planFixes([issueFor('spinner', 1), issueFor('scrollspy', 2)], openPrs, [makeGuide('spinner'), makeGuide('scrollspy')], new Set());
    assert.deepStrictEqual(skipped.map(s => [s.issueNumber, s.reason]), [[1, 'already has PR #5']]);
    assert.deepStrictEqual(toFix.map(g => g.issueNumber), [2]);
  });

  it('skips guides whose gd-dev branch already exists', () => {
    const { toFix, skipped } = planFixes([issueFor('spinner', 1)], [], [makeGuide('spinner')], new Set(['gd-dev/spinner']));
    assert.deepStrictEqual(toFix, []);
    assert.strictEqual(skipped[0].reason, 'branch gd-dev/spinner already exists (delete it to retry)');
  });

  it('skips expectations-changed issues, unmarked issues, and guides that no longer need evals', () => {
    const issues = [
      issueFor('a', 1, 'expectations-changed'),
      { number: 2, title: 'Manual', body: 'no marker' },
      issueFor('b', 3),
      issueFor('missing', 4),
    ];
    const { toFix, skipped } = planFixes(issues, [], [makeGuide('a'), makeGuide('b', { hasGrader: true, hasTask: true })], new Set());
    assert.deepStrictEqual(toFix, []);
    assert.deepStrictEqual(skipped.map(s => s.reason), [
      'expectations-changed issues are not handled',
      'not filed by eval-gap-watch',
      'guide no longer needs evals',
      'guide not found',
    ]);
  });
});

describe('fixEvalGaps', () => {
  let originalCli: typeof evalGapFixCli;
  let tempGuidesRoot: string;
  let calls: string[];
  let branch: string;
  let treeStatus: string;

  /** A guide in a temp dir, so the test-app-results handling runs against a real filesystem. */
  function tempGuide(name: string): GuideInventory {
    const dir = path.join(tempGuidesRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    return makeGuide(name, { dir });
  }

  const resultsDir = (inv: GuideInventory) => path.join(inv.dir, TEST_APP_RESULTS_DIR);

  /** Stubs `gd dev`: guides in `passing` succeed and write a report, the rest fail. */
  function stubDev(passing: GuideInventory[]): void {
    evalGapFixCli.runDevGuide = async inv => {
      const ok = passing.includes(inv);
      if (ok) {
        fs.mkdirSync(resultsDir(inv), { recursive: true });
        fs.writeFileSync(path.join(resultsDir(inv), REPORT_FILE), '# Report\n');
      }
      return ok;
    };
  }

  /** Calls for one guide that reached `gd pr`. */
  const prCalls = (name: string) => [`branch gd-dev/${name}`, `pr ${name}`, `reset ${name}`, `delete gd-dev/${name}`];

  /** Runs fixEvalGaps with one missing-evals issue per guide. */
  function run(guides: GuideInventory[], options: FixEvalGapsOptions = {}): Promise<boolean> {
    // planFixes keys guides by repo-relative path, so point the issues at the temp dirs.
    evalGapFixCli.listGapIssues = () => guides.map((g, i) => issueFor(g.name, i + 1, 'missing-evals', path.relative(rootDir, g.dir)));
    evalGapFixCli.scanGuides = () => guides;
    return fixEvalGaps(options);
  }

  beforeEach(() => {
    originalCli = { ...evalGapFixCli };
    tempGuidesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-gap-fix-'));
    calls = [];
    branch = 'main';
    treeStatus = '';

    evalGapFixCli.currentBranch = () => branch;
    evalGapFixCli.treeStatus = () => treeStatus;
    evalGapFixCli.pullMain = () => { calls.push('pull'); };
    evalGapFixCli.createBranch = b => { calls.push(`branch ${b}`); branch = b; };
    evalGapFixCli.resetToMain = dir => { calls.push(`reset ${path.basename(dir)}`); branch = 'main'; };
    evalGapFixCli.deleteLocalBranch = b => { calls.push(`delete ${b}`); };
    evalGapFixCli.listDevBranches = () => new Set();
    evalGapFixCli.listOpenPrs = () => [];
    evalGapFixCli.runDevPr = async dir => {
      const name = path.basename(dir);
      calls.push(`pr ${name}`);
      return `https://github.com/example/pull/${name}`;
    };
  });

  afterEach(() => {
    Object.assign(evalGapFixCli, originalCli);
    fs.rmSync(tempGuidesRoot, { recursive: true, force: true });
  });

  it('opens a PR on its own branch, returns to main, and deletes the branch', async () => {
    const guide = tempGuide('scrollspy');
    stubDev([guide]);

    assert.strictEqual(await run([guide]), true);
    assert.deepStrictEqual(calls, ['pull', ...prCalls('scrollspy')]);
  });

  it('discards changes and skips the PR when gd dev fails, then continues', async () => {
    const failing = tempGuide('spinner');
    const passing = tempGuide('progress-ring');
    stubDev([passing]);

    assert.strictEqual(await run([failing, passing]), false);
    assert.deepStrictEqual(calls, ['pull', 'reset spinner', ...prCalls('progress-ring')]);
  });

  it('continues when gd dev throws', async () => {
    const throwing = tempGuide('spinner');
    const passing = tempGuide('progress-ring');
    stubDev([passing]);
    const devStub = evalGapFixCli.runDevGuide;
    evalGapFixCli.runDevGuide = async (inv, opts) => {
      if (inv === throwing) throw new Error('boom');
      return devStub(inv, opts);
    };

    assert.strictEqual(await run([throwing, passing]), false);
    assert.deepStrictEqual(calls, ['pull', 'reset spinner', ...prCalls('progress-ring')]);
  });

  it('clears results from an earlier run so they cannot reach the PR', async () => {
    const guide = tempGuide('scrollspy');
    fs.mkdirSync(resultsDir(guide), { recursive: true });
    fs.writeFileSync(path.join(resultsDir(guide), REPORT_FILE), '# Stale report\n');
    evalGapFixCli.runDevGuide = async () => true; // "succeeds" without writing a new report

    assert.strictEqual(await run([guide]), false);
    assert.deepStrictEqual(calls, ['pull', 'reset scrollspy']);
  });

  it('drops the branch and continues when gd pr fails', async () => {
    const first = tempGuide('scrollspy');
    const second = tempGuide('spinner');
    stubDev([first, second]);
    evalGapFixCli.runDevPr = async dir => { calls.push(`pr ${path.basename(dir)}`); return null; };

    assert.strictEqual(await run([first, second]), false);
    assert.deepStrictEqual(calls, ['pull', ...prCalls('scrollspy'), ...prCalls('spinner')]);
  });

  it('deletes nothing and continues when the branch cannot be created', async () => {
    const first = tempGuide('scrollspy');
    const second = tempGuide('spinner');
    stubDev([first, second]);
    const createStub = evalGapFixCli.createBranch;
    evalGapFixCli.createBranch = b => {
      if (b === 'gd-dev/scrollspy') throw new Error('already exists');
      createStub(b);
    };

    assert.strictEqual(await run([first, second]), false);
    assert.deepStrictEqual(calls, ['pull', 'reset scrollspy', ...prCalls('spinner')]);
  });

  it('still counts the PR as opened when only the branch delete fails', async () => {
    const guide = tempGuide('scrollspy');
    stubDev([guide]);
    evalGapFixCli.deleteLocalBranch = () => { throw new Error('locked'); };

    assert.strictEqual(await run([guide]), true);
  });

  it('stops the batch when it cannot get back to main, still reporting the opened PR', async t => {
    const first = tempGuide('scrollspy');
    const second = tempGuide('spinner');
    stubDev([first, second]);
    evalGapFixCli.resetToMain = () => { throw new Error('checkout failed'); };
    const log = t.mock.method(console, 'log', () => {});

    assert.strictEqual(await run([first, second]), false);
    assert.deepStrictEqual(calls, ['pull', 'branch gd-dev/scrollspy', 'pr scrollspy']);
    const output = log.mock.calls.map(c => String(c.arguments[0])).join('\n');
    assert.match(output, /pr-opened.*#1 .*scrollspy.*cleanup failed: checkout failed/);
  });

  it('stops the batch when the reset leaves files dirty', async () => {
    const first = tempGuide('spinner');
    const second = tempGuide('progress-ring');
    stubDev([second]);
    evalGapFixCli.resetToMain = dir => { calls.push(`reset ${path.basename(dir)}`); treeStatus = '?? stray.txt'; };

    assert.strictEqual(await run([first, second]), false);
    assert.deepStrictEqual(calls, ['pull', 'reset spinner']);
  });

  it('processes at most --limit guides', async () => {
    const guides = [tempGuide('a'), tempGuide('b')];
    stubDev(guides);

    assert.strictEqual(await run(guides, { limit: 1 }), true);
    assert.deepStrictEqual(calls.filter(c => c.startsWith('pr ')), ['pr a']);
  });

  it('does nothing in dry-run mode', async () => {
    const guide = tempGuide('scrollspy');
    evalGapFixCli.runDevGuide = async () => { throw new Error('should not run'); };

    assert.strictEqual(await run([guide], { dryRun: true }), true);
    assert.deepStrictEqual(calls, []);
  });

  it('refuses to start off main', async () => {
    branch = 'feature';
    assert.strictEqual(await run([]), false);
    assert.deepStrictEqual(calls, []);
  });

  it('refuses to start with uncommitted changes on main', async () => {
    treeStatus = ' M guides/css/x/guide.md';
    assert.strictEqual(await run([]), false);
    assert.deepStrictEqual(calls, []);
  });

  it('refuses to start when main cannot be updated', async () => {
    evalGapFixCli.pullMain = () => { throw new Error('diverged'); };
    evalGapFixCli.runDevGuide = async () => { throw new Error('should not run'); };
    assert.strictEqual(await run([tempGuide('scrollspy')]), false);
  });
});
