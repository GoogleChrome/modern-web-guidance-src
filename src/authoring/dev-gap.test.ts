import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { planFixes, fixEvalGaps, evalGapFixCli, type OpenPr, type FixEvalGapsOptions } from './dev-gap.ts';
import { rootDir, getGuideResultsDir } from '../core/paths.ts';
import { REPORT_FILE, TARGETS_DIR, type GuideInventory } from '../core/guide-validation.ts';

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
    draft: false,
    ...overrides,
  } as GuideInventory;
}

const pr = (number: number, title: string, labels: string[] = [], headRefName?: string): OpenPr => ({
  number,
  title,
  headRefName,
  labels: labels.map(name => ({ name })),
});

describe('planFixes', () => {
  it('queues a guide with guidance and expectations but no evals and no PR', () => {
    const { toFix, skipped } = planFixes([makeGuide('scrollspy')], [], new Set());
    assert.deepStrictEqual(toFix.map(g => g.guidePath), ['guides/css/scrollspy']);
    assert.deepStrictEqual(skipped, []);
  });

  it('ignores drafts, incomplete guides, and complete guides', () => {
    const guides = [
      makeGuide('draft-bool', { draft: true }),
      makeGuide('draft-str', { draft: 'blocked' }),
      makeGuide('no-guide', { hasGuide: false }),
      makeGuide('no-expectations', { hasExpectations: false }),
      makeGuide('empty-expectations', { expectationsEmpty: true }),
      makeGuide('complete', { hasGrader: true, hasTask: true }),
      makeGuide('needs-evals'),
      makeGuide('missing-task', { hasGrader: true, hasTask: false }),
    ];
    const { toFix, skipped } = planFixes(guides, [], new Set());
    assert.deepStrictEqual(toFix.map(g => g.guidePath), ['guides/css/needs-evals', 'guides/css/missing-task']);
    assert.deepStrictEqual(skipped, []);
  });

  it('skips guides with an open gd pr PR without rerun labels, matching the exact title', () => {
    const openPrs = [pr(5, 'grader updates: spinner'), pr(6, 'grader updates: spinner-large'), pr(7, 'Fix scrollspy typo')];
    const { toFix, skipped } = planFixes([makeGuide('spinner'), makeGuide('scrollspy')], openPrs, new Set());
    assert.deepStrictEqual(skipped, [{ guidePath: 'guides/css/spinner', reason: 'already has PR #5' }]);
    assert.deepStrictEqual(toFix.map(g => g.guidePath), ['guides/css/scrollspy']);
  });

  it('queues an open PR with needs-eval-run or needs-eval-gen instead of skipping it', () => {
    const openPrs = [
      pr(5, 'grader updates: spinner', ['needs-eval-run'], 'gd-dev/spinner'),
      pr(6, 'grader updates: scrollspy', ['needs-eval-gen', 'needs-eval-run'], 'gd-dev/scrollspy'),
    ];
    const { toFix, skipped } = planFixes(
      [makeGuide('spinner'), makeGuide('scrollspy')],
      openPrs,
      new Set(['gd-dev/spinner', 'gd-dev/scrollspy'])
    );
    assert.deepStrictEqual(skipped, []);
    assert.deepStrictEqual(
      toFix.map(g => ({ guidePath: g.guidePath, prNumber: g.prNumber, branch: g.branch, rerunMode: g.rerunMode })),
      [
        { guidePath: 'guides/css/spinner', prNumber: 5, branch: 'gd-dev/spinner', rerunMode: 'needs-eval-run' },
        { guidePath: 'guides/css/scrollspy', prNumber: 6, branch: 'gd-dev/scrollspy', rerunMode: 'needs-eval-gen' },
      ]
    );
  });

  it('queues an open PR with a rerun label even when the guide already has evals on main', () => {
    const completeGuide = makeGuide('popover', { hasGrader: true, hasTask: true });
    const openPrs = [pr(12, 'grader updates: popover', ['needs-eval-run'], 'gd-dev/popover')];
    const { toFix, skipped } = planFixes([completeGuide], openPrs, new Set(['gd-dev/popover']));
    assert.deepStrictEqual(skipped, []);
    assert.deepStrictEqual(
      toFix.map(g => ({ guidePath: g.guidePath, prNumber: g.prNumber, branch: g.branch, rerunMode: g.rerunMode })),
      [{ guidePath: 'guides/css/popover', prNumber: 12, branch: 'gd-dev/popover', rerunMode: 'needs-eval-run' }]
    );
  });

  it('skips guides whose gd-dev branch already exists', () => {
    const { toFix, skipped } = planFixes([makeGuide('spinner')], [], new Set(['gd-dev/spinner']));
    assert.deepStrictEqual(toFix, []);
    assert.deepStrictEqual(skipped, [{ guidePath: 'guides/css/spinner', reason: 'branch gd-dev/spinner already exists (delete it to retry)' }]);
  });
});

describe('fixEvalGaps', () => {
  let originalCli: typeof evalGapFixCli;
  let tempGuidesRoot: string;
  let calls: string[];
  let branch: string;
  let treeStatus: string;

  /** A guide in a temp dir, so the results handling runs against a real filesystem. */
  function tempGuide(name: string): GuideInventory {
    const dir = path.join(tempGuidesRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    return makeGuide(name, { dir });
  }

  const resultsDir = (inv: GuideInventory) => getGuideResultsDir(inv);

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

  /** Runs fixEvalGaps against the given guides on disk. */
  function run(guides: GuideInventory[], options: FixEvalGapsOptions = {}): Promise<boolean> {
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
    evalGapFixCli.checkoutPrBranch = b => { calls.push(`checkout-pr ${b}`); branch = b; };
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
    for (const name of ['scrollspy', 'spinner', 'progress-ring', 'a', 'b']) {
      fs.rmSync(getGuideResultsDir({ category: 'css', name }), { recursive: true, force: true });
    }
  });

  it('opens a PR on its own branch, returns to main, and deletes the branch', async () => {
    const guide = tempGuide('scrollspy');
    stubDev([guide]);

    assert.strictEqual(await run([guide]), true);
    assert.deepStrictEqual(calls, ['pull', ...prCalls('scrollspy')]);
  });

  it('checks out the PR branch and preserves existing evals when rerunning a PR with needs-eval-run', async () => {
    const guide = tempGuide('scrollspy');
    const targetDir = path.join(guide.dir, TARGETS_DIR, 'daily-grind');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'grader.ts'), '// existing grader\n');
    evalGapFixCli.listOpenPrs = () => [pr(42, 'grader updates: scrollspy', ['needs-eval-run'], 'gd-dev/scrollspy')];
    stubDev([guide]);

    assert.strictEqual(await run([guide]), true);
    assert.strictEqual(fs.existsSync(path.join(targetDir, 'grader.ts')), true);
    assert.deepStrictEqual(calls, [
      'pull',
      'checkout-pr gd-dev/scrollspy',
      'pr scrollspy',
      'reset scrollspy',
      'delete gd-dev/scrollspy',
    ]);
  });

  it('deletes target evals before running gd dev when rerunning a PR with needs-eval-gen', async () => {
    const guide = tempGuide('scrollspy');
    const dailyGrindDir = path.join(guide.dir, TARGETS_DIR, 'daily-grind');
    const devtoolsTimesDir = path.join(guide.dir, TARGETS_DIR, 'devtools-times');
    fs.mkdirSync(dailyGrindDir, { recursive: true });
    fs.mkdirSync(devtoolsTimesDir, { recursive: true });
    fs.writeFileSync(path.join(dailyGrindDir, 'grader.ts'), '// old daily-grind grader\n');
    fs.writeFileSync(path.join(devtoolsTimesDir, 'grader.ts'), '// devtools-times grader untouched\n');
    evalGapFixCli.listOpenPrs = () => [pr(42, 'grader updates: scrollspy', ['needs-eval-gen'], 'gd-dev/scrollspy')];

    let dailyGrindExistedDuringDev = true;
    evalGapFixCli.runDevGuide = async inv => {
      dailyGrindExistedDuringDev = fs.existsSync(dailyGrindDir);
      fs.mkdirSync(resultsDir(inv), { recursive: true });
      fs.writeFileSync(path.join(resultsDir(inv), REPORT_FILE), '# Report\n');
      return true;
    };

    assert.strictEqual(await run([guide]), true);
    assert.strictEqual(dailyGrindExistedDuringDev, false);
    assert.strictEqual(fs.existsSync(path.join(devtoolsTimesDir, 'grader.ts')), true);
    assert.deepStrictEqual(calls, [
      'pull',
      'checkout-pr gd-dev/scrollspy',
      'pr scrollspy',
      'reset scrollspy',
      'delete gd-dev/scrollspy',
    ]);
  });

  it('defaults targets to daily-grind and respects custom targets', async () => {
    const guide = tempGuide('scrollspy');
    const seenTargets: (readonly string[] | undefined)[] = [];
    evalGapFixCli.runDevGuide = async (inv, opts) => {
      seenTargets.push(opts.targets);
      fs.mkdirSync(resultsDir(inv), { recursive: true });
      fs.writeFileSync(path.join(resultsDir(inv), REPORT_FILE), '# Report\n');
      return true;
    };

    assert.strictEqual(await run([guide]), true);
    assert.strictEqual(await run([guide], { targets: ['daily-grind', 'devtools-times'] }), true);
    assert.deepStrictEqual(seenTargets, [['daily-grind'], ['daily-grind', 'devtools-times']]);
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
    assert.match(output, /pr-opened.*scrollspy.*cleanup failed: checkout failed/);
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
