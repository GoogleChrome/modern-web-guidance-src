/**
 * Eval gap fix. Backs `gd dev-gap`.
 *
 * Scans guides on disk for non-draft guides that have populated `guide.md` and
 * `expectations.md` but are missing evals (`grader.ts` or `task.md`, in legacy
 * format or `targets/`). For each guide without an open `gd pr` PR or a
 * leftover `gd-dev/` branch, runs `gd dev`, opens a PR with `gd pr`, then
 * returns to `main` and deletes the local branch. Also reruns open `gd pr` PRs
 * labeled `needs-eval-gen` or `needs-eval-run`.
 *
 * Usage: gd dev-gap [--dry-run] [--limit <n>] [--targets <apps>]
 */

import child_process from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { cBold, cCyan, cDim, cGreen, cRed } from '../core/colors.ts';
import {
  scanAllGuides,
  getGuideStatus,
  ProjectStatus,
  REPORT_FILE,
  TARGETS_DIR,
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir, getGuideResultsDir } from '../core/paths.ts';
import type { SuiteConfig } from '../harness/config.ts';
import { devPrBranch, devPrTitle, runDevPr, type DevPrRerunLabel } from './pr.ts';

export interface OpenPr {
  number: number;
  title: string;
  headRefName?: string;
  labels?: { name: string }[];
}

interface GapToFix {
  guidePath: string;
  inv: GuideInventory;
  prNumber?: number;
  branch?: string;
  rerunMode?: DevPrRerunLabel;
}

interface SkippedGap {
  guidePath: string;
  reason: string;
}

export interface FixEvalGapsOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  suiteConfig?: SuiteConfig;
  targets?: readonly string[];
}

function getRerunMode(pr: OpenPr): DevPrRerunLabel | undefined {
  const names = new Set((pr.labels ?? []).map(l => l.name));
  // `needs-eval-gen` supersedes `needs-eval-run` since it also runs evals.
  if (names.has('needs-eval-gen')) return 'needs-eval-gen';
  if (names.has('needs-eval-run')) return 'needs-eval-run';
  return undefined;
}

/** Decides which guides missing evals (or labeled PRs) to work on, and why any are skipped. */
export function planFixes(
  guides: GuideInventory[],
  openPrs: OpenPr[],
  existingBranches: Set<string>
): { toFix: GapToFix[]; skipped: SkippedGap[] } {
  const toFix: GapToFix[] = [];
  const skipped: SkippedGap[] = [];
  const handledPrs = new Set<number>();

  for (const inv of guides) {
    if (getGuideStatus(inv) !== ProjectStatus.NeedsEvals) continue;
    const guidePath = path.relative(rootDir, inv.dir);

    // `gd pr` titles its PR the same way whichever branch it runs from.
    const pr = openPrs.find(p => p.title === devPrTitle(inv.name) || p.headRefName === devPrBranch(inv.name));
    if (pr) {
      handledPrs.add(pr.number);
      const rerunMode = getRerunMode(pr);
      if (rerunMode) {
        toFix.push({
          guidePath,
          inv,
          prNumber: pr.number,
          branch: pr.headRefName ?? devPrBranch(inv.name),
          rerunMode,
        });
      } else {
        skipped.push({ guidePath, reason: `already has PR #${pr.number}` });
      }
      continue;
    }

    // A leftover branch (e.g. from a PR closed without merging) would make the
    // push fail after a full `gd dev` run, so skip until someone deletes it.
    const branch = devPrBranch(inv.name);
    if (existingBranches.has(branch)) {
      skipped.push({ guidePath, reason: `branch ${branch} already exists (delete it to retry)` });
      continue;
    }

    toFix.push({ guidePath, inv });
  }

  // Also check open PRs that were not matched above (e.g. guides that already
  // have evals on main) for `needs-eval-gen` / `needs-eval-run` rerun labels.
  for (const pr of openPrs) {
    if (handledPrs.has(pr.number)) continue;
    const rerunMode = getRerunMode(pr);
    if (!rerunMode) continue;
    const inv = guides.find(g => pr.title === devPrTitle(g.name) || pr.headRefName === devPrBranch(g.name));
    if (!inv) continue;
    toFix.push({
      guidePath: path.relative(rootDir, inv.dir),
      inv,
      prNumber: pr.number,
      branch: pr.headRefName ?? devPrBranch(inv.name),
      rerunMode,
    });
  }

  return { toFix, skipped };
}

function git(args: string[]): string {
  return child_process.execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Side effects, grouped so tests can stub them. */
export const evalGapFixCli = {
  currentBranch: () => git(['branch', '--show-current']),
  /** Empty when the working tree is clean. */
  treeStatus: () => git(['status', '--porcelain']),
  pullMain: () => { git(['pull', '--ff-only']); },
  createBranch: (branch: string) => { git(['checkout', '-b', branch]); },
  checkoutPrBranch: (branch: string) => {
    git(['fetch', 'origin', branch]);
    git(['checkout', '-B', branch, `origin/${branch}`]);
  },
  /** Switches to `main`, dropping tracked edits anywhere and untracked (non-ignored) files in `dir`. */
  resetToMain: (dir: string) => {
    git(['reset', '--hard']);
    git(['checkout', '-f', 'main']);
    git(['clean', '-fd', '--', dir]);
  },
  deleteLocalBranch: (branch: string) => { git(['branch', '-D', branch]); },
  /** `gd-dev/*` branch names that exist locally or on origin. */
  listDevBranches: (): Set<string> => {
    const local = git(['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads/gd-dev/']).split('\n');
    const remote = git(['ls-remote', '--heads', 'origin', 'refs/heads/gd-dev/*']).split('\n')
      .map(line => line.split('\trefs/heads/')[1]);
    return new Set([...local, ...remote].filter(Boolean));
  },
  listOpenPrs: (): OpenPr[] => JSON.parse(child_process.execFileSync(
    'gh',
    ['pr', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title,headRefName,labels'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )),
  scanGuides: (): GuideInventory[] => scanAllGuides(),
  runDevGuide: async (inv: GuideInventory, options: FixEvalGapsOptions): Promise<boolean> => {
    const { devGuide } = await import('./dev.ts');
    return devGuide(inv.dir, {
      test: true,
      verbose: options.verbose,
      suiteConfig: options.suiteConfig,
      targets: options.targets ?? ['daily-grind'],
    });
  },
  runDevPr,
};

interface Outcome {
  gap: GapToFix;
  status: 'pr-opened' | 'dev-failed' | 'pr-failed' | 'error';
  detail: string;
}

/**
 * Runs `gd dev` then `gd pr` for one guide, then returns to a clean `main`,
 * dropping whatever didn't make it into a PR. Never throws; cleanup failures
 * are noted on the outcome and the caller checks the tree.
 */
async function fixOne(gap: GapToFix, options: FixEvalGapsOptions): Promise<Outcome> {
  const { inv } = gap;
  const branch = gap.branch ?? devPrBranch(inv.name);
  const targets = options.targets ?? ['daily-grind'];
  let createdBranch = false;

  let outcome: Outcome;
  try {
    // Clear guide results so the report can only come from this run.
    const resultsDir = getGuideResultsDir(inv);
    fs.rmSync(resultsDir, { recursive: true, force: true });

    if (gap.rerunMode) {
      evalGapFixCli.checkoutPrBranch(branch);
      createdBranch = true;
      if (gap.rerunMode === 'needs-eval-gen') {
        for (const t of targets) {
          fs.rmSync(path.join(inv.dir, TARGETS_DIR, t), { recursive: true, force: true });
        }
      }
    }

    const devOk = await evalGapFixCli.runDevGuide(inv, { ...options, targets });
    if (!devOk || !fs.existsSync(path.join(resultsDir, REPORT_FILE))) {
      outcome = { gap, status: 'dev-failed', detail: devOk ? `gd dev wrote no ${REPORT_FILE}` : 'gd dev failed' };
    } else {
      if (!createdBranch) {
        // Branch off main here so `gd pr` commits to a fresh branch this run owns.
        evalGapFixCli.createBranch(branch);
        createdBranch = true;
      }
      const prUrl = await evalGapFixCli.runDevPr(inv.dir);
      outcome = prUrl
        ? { gap, status: 'pr-opened', detail: prUrl }
        : { gap, status: 'pr-failed', detail: 'gd pr failed (branch may be on origin; delete it to retry)' };
    }
  } catch (err) {
    outcome = { gap, status: 'error', detail: (err as Error).message };
  }

  try {
    evalGapFixCli.resetToMain(inv.dir);
    if (createdBranch) evalGapFixCli.deleteLocalBranch(branch);
  } catch (err) {
    outcome.detail += ` (cleanup failed: ${(err as Error).message})`;
  }
  return outcome;
}

export async function fixEvalGaps(options: FixEvalGapsOptions = {}): Promise<boolean> {
  if (!options.dryRun) {
    if (evalGapFixCli.currentBranch() !== 'main' || evalGapFixCli.treeStatus() !== '') {
      console.error(cRed('❌ Run this from a clean `main` branch.'));
      return false;
    }
    try {
      evalGapFixCli.pullMain();
    } catch (err) {
      console.error(cRed(`❌ Could not update main: ${(err as Error).message}`));
      return false;
    }
  }

  const { toFix, skipped } = planFixes(
    evalGapFixCli.scanGuides(),
    evalGapFixCli.listOpenPrs(),
    evalGapFixCli.listDevBranches()
  );
  const queue = toFix.slice(0, options.limit);

  console.log(cBold(`\nGuides missing evals: ${toFix.length} to fix, ${skipped.length} skipped\n`));
  for (const s of skipped) console.log(cDim(`  skip ${s.guidePath} — ${s.reason}`));
  for (const g of queue) {
    const suffix = g.rerunMode ? ` (PR #${g.prNumber}: ${g.rerunMode})` : '';
    console.log(`  ${cCyan('fix')}  ${g.guidePath}${cDim(suffix)}`);
  }
  if (queue.length < toFix.length) console.log(cDim(`  (limited to ${queue.length} of ${toFix.length})`));
  console.log('');

  if (options.dryRun) {
    console.log('🧪 Dry run — nothing was run. Planned from your local checkout; pull main first for an up-to-date plan.');
    return true;
  }

  const outcomes: Outcome[] = [];
  for (const [i, gap] of queue.entries()) {
    const suffix = gap.rerunMode ? ` (PR #${gap.prNumber}: ${gap.rerunMode})` : '';
    console.log(cBold(`\n[${i + 1}/${queue.length}] ${gap.guidePath}${suffix}`));
    outcomes.push(await fixOne(gap, options));

    // Stop if cleanup left something behind; it would leak into the next guide's PR.
    const status = evalGapFixCli.treeStatus();
    if (evalGapFixCli.currentBranch() !== 'main' || status !== '') {
      console.error(cRed('\n❌ Could not get back to a clean `main`; stopping the batch.'));
      if (status) console.error(cDim(status));
      break;
    }
  }

  console.log(cBold('\nSummary'));
  for (const o of outcomes) {
    const color = o.status === 'pr-opened' ? cGreen : cRed;
    console.log(`  ${color(o.status.padEnd(10))} ${o.gap.guidePath} ${cDim(`— ${o.detail}`)}`);
  }
  const notRun = queue.length - outcomes.length;
  if (notRun > 0) console.log(cDim(`  ${notRun} guide(s) not attempted`));

  return notRun === 0 && outcomes.every(o => o.status === 'pr-opened');
}
