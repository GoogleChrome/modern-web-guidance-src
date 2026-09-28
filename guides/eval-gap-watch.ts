/**
 * Eval gap watch.
 *
 * Files GitHub issues for two eval-health gaps:
 *
 *   1. `missing-evals`        — a guide has guidance and expectations, but no evals.
 *   2. `expectations-changed` — a guide that already has evals had its
 *                               expectations.md edited in a push that didn't
 *                               also touch its evals, so they may be stale.
 *
 * Issues are keyed by a hidden marker comment so reruns don't file duplicates.
 * `missing-evals` issues close themselves once evals land.
 *
 * Usage: node --experimental-strip-types guides/eval-gap-watch.ts [--dry-run]
 */

import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanAllGuides,
  getGuideStatus,
  ProjectStatus,
  EXPECTATIONS_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  type GuideInventory,
} from '../lib/guide-validation.ts';
import { rootDir } from '../lib/paths.ts';

export const EVAL_OWNERS = ['micahjo7', 'paulirish', 'TravenReese'];
export const EVAL_GAP_LABEL = 'eval-gap';

export type GapKind = 'missing-evals' | 'expectations-changed';

export interface Gap {
  kind: GapKind;
  /** Repo-relative guide directory, e.g. `guides/css/scrollspy`. */
  guidePath: string;
  guideName: string;
}

/** An open issue carrying the eval-gap label. */
export interface ExistingIssue {
  number: number;
  body: string;
  title: string;
}

// --- Detection ---

function toGap(kind: GapKind, inv: GuideInventory): Gap {
  return { kind, guidePath: path.relative(rootDir, inv.dir), guideName: inv.name };
}

/** Case 1: guidance and expectations are populated, but there are no evals. */
export function findMissingEvals(guides: GuideInventory[]): Gap[] {
  return guides
    .filter(inv => getGuideStatus(inv) === ProjectStatus.NeedsEvals)
    .map(inv => toGap('missing-evals', inv));
}

/** True when the changed files edit a guide's expectations.md without touching its evals. */
function editsExpectationsOnly(files: string[], guidePath: string): boolean {
  const inGuide = files.filter(f => f.startsWith(`${guidePath}/`)).map(f => f.slice(guidePath.length + 1));
  return inGuide.includes(EXPECTATIONS_FILE) &&
    !inGuide.some(f => f === GRADER_FILE || f.startsWith('tasks/') || f.startsWith(`${TARGETS_DIR}/`));
}

/** Case 2: a complete guide had expectations.md edited in a change that left its evals alone. */
export function findChangedExpectations(guides: GuideInventory[], changedFiles: string[]): Gap[] {
  return guides
    .filter(inv => getGuideStatus(inv) === null && editsExpectationsOnly(changedFiles, path.relative(rootDir, inv.dir)))
    .map(inv => toGap('expectations-changed', inv));
}

/** Repo-relative paths changed between a commit (e.g. a push's "before") and HEAD. */
export function getChangedFiles(before: string): string[] {
  try {
    const output = child_process.execFileSync('git', ['diff', '--name-only', before, 'HEAD'], {
      encoding: 'utf8',
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output.split('\n').filter(Boolean);
  } catch {
    // e.g. the first push to a branch, or a force push that dropped `before`.
    console.warn(`⚠️ Could not diff ${before}..HEAD; skipping the expectations check.`);
    return [];
  }
}

// --- Issue content ---

export function buildMarker(kind: GapKind, guidePath: string): string {
  return `<!-- eval-gap-watch:${kind}:${guidePath} -->`;
}

export function parseMarker(body: string): { kind: GapKind; guidePath: string } | null {
  const match = body.match(/<!--\s*eval-gap-watch:(missing-evals|expectations-changed):(\S+?)\s*-->/);
  return match ? { kind: match[1] as GapKind, guidePath: match[2] } : null;
}

export function buildIssue(gap: Gap): { title: string; body: string } {
  const link = `[\`${gap.guidePath}\`](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/${gap.guidePath})`;

  const { title, summary, action } = gap.kind === 'missing-evals'
    ? {
        title: `Evals missing for the ${gap.guideName} guide`,
        summary: `${link} has guidance and populated \`${EXPECTATIONS_FILE}\`, but its evals are missing.`,
        action: `Run \`gd dev ${gap.guidePath}\` to create the evals.`,
      }
    : {
        title: `Expectations changed for the ${gap.guideName} guide`,
        summary: `\`${EXPECTATIONS_FILE}\` in ${link} was edited, and this guide already has evals.`,
        action: `Run \`gd dev ${gap.guidePath}\` to update the evals.`,
      };

  const body = [
    summary,
    '',
    action,
    '',
    '<sub>Filed automatically by `guides/eval-gap-watch.ts`.</sub>',
    buildMarker(gap.kind, gap.guidePath),
  ].join('\n');

  return { title, body };
}

// --- Planning ---

/**
 * Returns the issues to file and close, given the currently open issues. A gap
 * with an open issue is left alone. Only `missing-evals` auto-closes, since it
 * is recomputed from the tree every run; `expectations-changed` is a
 * point-in-time alert a human closes.
 */
export function planIssues(gaps: Gap[], existing: ExistingIssue[]): { toCreate: Gap[]; toClose: ExistingIssue[] } {
  const openIssues = new Map<string, ExistingIssue>();
  for (const issue of existing) {
    const marker = parseMarker(issue.body);
    if (marker) openIssues.set(`${marker.kind}:${marker.guidePath}`, issue);
  }

  const gapKeys = new Set(gaps.map(g => `${g.kind}:${g.guidePath}`));

  return {
    toCreate: gaps.filter(g => !openIssues.has(`${g.kind}:${g.guidePath}`)),
    toClose: [...openIssues]
      .filter(([key]) => key.startsWith('missing-evals:') && !gapKeys.has(key))
      .map(([, issue]) => issue),
  };
}

// --- GitHub API ---

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

// --- Main ---

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes('--dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  if (dryRun) console.log('🧪 Dry run — no issues will be filed or closed.\n');

  // The push's "before" commit. Manual runs have none, so they only check for missing evals.
  const before = process.env.EVAL_GAP_BEFORE;

  const guides = scanAllGuides();
  const changedFiles = before ? getChangedFiles(before) : [];

  const gaps = [...findMissingEvals(guides), ...findChangedExpectations(guides, changedFiles)];
  console.log(`Scanned ${guides.length} guides and ${changedFiles.length} changed file(s), found ${gaps.length} gap(s).`);

  const { toCreate, toClose } = planIssues(gaps, githubApi.listIssues());

  if (toCreate.length === 0 && toClose.length === 0) {
    console.log('✅ No changes needed.');
    return;
  }

  if (!dryRun && toCreate.length > 0) githubApi.ensureLabel();

  for (const gap of toCreate) {
    const { title, body } = buildIssue(gap);
    if (dryRun) {
      console.log(`[DRY RUN] Would file "${title}"`);
      continue;
    }
    githubApi.createIssue(title, body);
  }

  for (const issue of toClose) {
    if (dryRun) {
      console.log(`[DRY RUN] Would close #${issue.number} ("${issue.title}")`);
      continue;
    }
    githubApi.closeIssue(issue.number);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
