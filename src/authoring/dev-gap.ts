/**
 * Eval gap fix. Backs `gd dev-gap`.
 *
 * Works through open `missing-evals` issues filed by `eval-gap-watch.ts`. For
 * each guide without an open `gd pr` PR or a leftover `gd-dev/` branch, runs
 * `gd dev`, opens a PR with `gd pr`, then returns to `main` and deletes the
 * local branch. eval-gap-watch closes the issue once the evals land.
 *
 * Usage: gd dev-gap [--dry-run] [--limit <n>]
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
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir, getGuideResultsDir } from '../core/paths.ts';
import type { SuiteConfig } from '../harness/config.ts';
import { devPrBranch, devPrTitle, runDevPr } from './pr.ts';

export const EVAL_OWNERS = ['micahjo7', 'TravenReese'];
export const EVAL_GAP_LABEL = 'eval-gap';

export type GapKind = 'missing-evals' | 'expectations-changed';

/** An open issue carrying the eval-gap label. */
export interface ExistingIssue {
  number: number;
  body: string;
  title: string;
}

export function buildMarker(kind: GapKind, guidePath: string): string {
  return `<!-- eval-gap-watch:${kind}:${guidePath} -->`;
}

export function parseMarker(body: string): { kind: GapKind; guidePath: string } | null {
  const match = body.match(/<!--\s*eval-gap-watch:(missing-evals|expectations-changed):(\S+?)\s*-->/);
  return match ? { kind: match[1] as GapKind, guidePath: match[2] } : null;
}

export const githubApi = {
  ensureLabel(): void {
    try {
      child_process.execFileSync(
        'gh',
        ['label', 'create', EVAL_GAP_LABEL, '--description', 'Guide is missing evals or its expectations changed', '--color', 'B60205'],
        { stdio: 'pipe' }
      );
    } catch {
      // Label already exists, which is the common case.
    }
  },

  listIssues(): ExistingIssue[] {
    const output = child_process.execFileSync(
      'gh',
      ['issue', 'list', '--label', EVAL_GAP_LABEL, '--state', 'open', '--limit', '500', '--json', 'number,body,title'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
    return (JSON.parse(output) as ExistingIssue[]).map(i => ({ ...i, body: i.body ?? '' }));
  },

  createIssue(title: string, body: string): void {
    child_process.execFileSync(
      'gh',
      ['issue', 'create', '--title', title, '--body', body, '--label', EVAL_GAP_LABEL, '--assignee', EVAL_OWNERS.join(',')],
      { stdio: 'inherit' }
    );
  },

  closeIssue(issueNumber: number): void {
    child_process.execFileSync(
      'gh',
      ['issue', 'close', String(issueNumber), '--reason', 'completed', '--comment', 'Closing — this guide no longer has a missing-evals gap.'],
      { stdio: 'inherit' }
    );
  },
};

export interface OpenPr {
  number: number;
  title: string;
}

interface GapToFix {
  issueNumber: number;
  guidePath: string;
  inv: GuideInventory;
}

interface SkippedGap {
  issueNumber: number;
  guidePath: string | null;
  reason: string;
}

export interface FixEvalGapsOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  suiteConfig?: SuiteConfig;
}

/** Decides which open eval-gap issues to work on, and why the rest are skipped. */
export function planFixes(
  issues: ExistingIssue[],
  openPrs: OpenPr[],
  guides: GuideInventory[],
  existingBranches: Set<string>
): { toFix: GapToFix[]; skipped: SkippedGap[] } {
  const guidesByPath = new Map(guides.map(inv => [path.relative(rootDir, inv.dir), inv]));
  const toFix: GapToFix[] = [];
  const skipped: SkippedGap[] = [];

  for (const issue of issues) {
    const marker = parseMarker(issue.body);
    const skip = (reason: string) => skipped.push({ issueNumber: issue.number, guidePath: marker?.guidePath ?? null, reason });

    if (!marker) { skip('not filed by eval-gap-watch'); continue; }
    if (marker.kind !== 'missing-evals') { skip(`${marker.kind} issues are not handled`); continue; }

    const inv = guidesByPath.get(marker.guidePath);
    if (!inv) { skip('guide not found'); continue; }
    if (getGuideStatus(inv) !== ProjectStatus.NeedsEvals) { skip('guide no longer needs evals'); continue; }

    // `gd pr` titles its PR the same way whichever branch it runs from.
    const pr = openPrs.find(p => p.title === devPrTitle(inv.name));
    if (pr) { skip(`already has PR #${pr.number}`); continue; }

    // A leftover branch (e.g. from a PR closed without merging) would make the
    // push fail after a full `gd dev` run, so skip until someone deletes it.
    const branch = devPrBranch(inv.name);
    if (existingBranches.has(branch)) { skip(`branch ${branch} already exists (delete it to retry)`); continue; }

    toFix.push({ issueNumber: issue.number, guidePath: marker.guidePath, inv });
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
  /** Switches to `main`, dropping tracked edits anywhere and untracked (non-ignored) files in `dir`. */
  resetToMain: (dir: string) => {
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
    ['pr', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )),
  listGapIssues: (): ExistingIssue[] => githubApi.listIssues(),
  scanGuides: (): GuideInventory[] => scanAllGuides(),
  runDevGuide: async (inv: GuideInventory, options: FixEvalGapsOptions): Promise<boolean> => {
    const { devGuide } = await import('./dev.ts');
    return devGuide(inv.dir, { test: true, verbose: options.verbose, suiteConfig: options.suiteConfig }, inv);
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
  const branch = devPrBranch(inv.name);
  let createdBranch = false;

  let outcome: Outcome;
  try {
    // Clear guide results so the report can only come from this run.
    const resultsDir = getGuideResultsDir(inv);
    fs.rmSync(resultsDir, { recursive: true, force: true });

    const devOk = await evalGapFixCli.runDevGuide(inv, options);
    if (!devOk || !fs.existsSync(path.join(resultsDir, REPORT_FILE))) {
      outcome = { gap, status: 'dev-failed', detail: devOk ? `gd dev wrote no ${REPORT_FILE}` : 'gd dev failed' };
    } else {
      // Branch off main here so `gd pr` commits to a fresh branch this run owns.
      evalGapFixCli.createBranch(branch);
      createdBranch = true;
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
    evalGapFixCli.listGapIssues(),
    evalGapFixCli.listOpenPrs(),
    evalGapFixCli.scanGuides(),
    evalGapFixCli.listDevBranches()
  );
  const queue = toFix.slice(0, options.limit);

  console.log(cBold(`\nEval-gap issues: ${toFix.length} to fix, ${skipped.length} skipped\n`));
  for (const s of skipped) console.log(cDim(`  skip #${s.issueNumber}${s.guidePath ? ` ${s.guidePath}` : ''} — ${s.reason}`));
  for (const g of queue) console.log(`  ${cCyan('fix')}  #${g.issueNumber} ${g.guidePath}`);
  if (queue.length < toFix.length) console.log(cDim(`  (limited to ${queue.length} of ${toFix.length})`));
  console.log('');

  if (options.dryRun) {
    console.log('🧪 Dry run — nothing was run. Planned from your local checkout; pull main first for an up-to-date plan.');
    return true;
  }

  const outcomes: Outcome[] = [];
  for (const [i, gap] of queue.entries()) {
    console.log(cBold(`\n[${i + 1}/${queue.length}] #${gap.issueNumber} ${gap.guidePath}`));
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
    console.log(`  ${color(o.status.padEnd(10))} #${o.gap.issueNumber} ${o.gap.guidePath} ${cDim(`— ${o.detail}`)}`);
  }
  const notRun = queue.length - outcomes.length;
  if (notRun > 0) console.log(cDim(`  ${notRun} guide(s) not attempted`));

  return notRun === 0 && outcomes.every(o => o.status === 'pr-opened');
}
