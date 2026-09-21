/**
 * Eval gap watch.
 *
 * Files GitHub issues for two eval-health gaps:
 *
 *   1. `missing-evals`        — a guide has guidance and expectations, but no evals.
 *   2. `expectations-changed` — a guide that already has evals had its
 *                               expectations.md edited, so the evals may be stale.
 *
 * Issues are keyed by a hidden marker comment so reruns don't file duplicates.
 * `missing-evals` issues close themselves once evals land.
 *
 * Usage: node --experimental-strip-types guides/eval-gap-watch.ts [--dry-run]
 */

import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanAllGuides, EXPECTATIONS_FILE, type GuideInventory } from '../lib/guide-validation.ts';
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

export interface ExistingIssue {
  number: number;
  body: string;
  state: 'OPEN' | 'CLOSED';
  title: string;
}

// --- Detection ---

/** True when a guide has evals, in either the legacy or targets layout. */
export function hasEvals(inv: GuideInventory): boolean {
  return inv.hasGrader && inv.hasTask;
}

/** True when a guide is complete enough that evals are expected of it. */
function isEvalCandidate(inv: GuideInventory): boolean {
  // Drafts are withheld from distribution, so they aren't expected to have evals yet.
  return !inv.draft && inv.hasGuide && inv.hasExpectations && !inv.expectationsEmpty;
}

function toGap(kind: GapKind, inv: GuideInventory): Gap {
  return { kind, guidePath: path.relative(rootDir, inv.dir), guideName: inv.name };
}

/** Case 1: guidance and expectations are populated, but there are no evals. */
export function findMissingEvals(guides: GuideInventory[]): Gap[] {
  return guides
    .filter(inv => isEvalCandidate(inv) && !hasEvals(inv))
    .map(inv => toGap('missing-evals', inv));
}

/** Case 2: a guide that already has evals had its expectations.md edited. */
export function findChangedExpectations(guides: GuideInventory[], changedFiles: string[]): Gap[] {
  const changed = new Set(changedFiles);
  return guides
    .filter(inv => hasEvals(inv) && changed.has(path.join(path.relative(rootDir, inv.dir), EXPECTATIONS_FILE)))
    .map(inv => toGap('expectations-changed', inv));
}

/**
 * Repo-relative paths changed since a date expression (e.g. `7 days ago`).
 *
 * Resolving the base from history rather than a push event keeps this working
 * on a schedule, where there is no previous-commit reference to diff against.
 */
export function getChangedFiles(since: string): string[] {
  try {
    const base = child_process.execFileSync('git', ['rev-list', '-1', `--before=${since}`, 'HEAD'], {
      encoding: 'utf8',
      cwd: rootDir,
    }).trim();

    if (!base) {
      console.warn(`⚠️ No commit found before "${since}"; skipping the expectations diff.`);
      return [];
    }

    const output = child_process.execFileSync('git', ['diff', '--name-only', `${base}..HEAD`], {
      encoding: 'utf8',
      cwd: rootDir,
    });
    return output.split('\n').map(f => f.trim()).filter(Boolean);
  } catch (err) {
    console.warn(`⚠️ Could not diff since "${since}":`, err);
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
        summary: `${link} has guidance and populated \`${EXPECTATIONS_FILE}\`, but no evals.`,
        action: `Generate and calibrate a grader: \`pnpm generate-grader ${gap.guideName}\`, then \`gd dev ${gap.guideName} --test-grader\`.`,
      }
    : {
        title: `Expectations changed for the ${gap.guideName} guide, which already has evals`,
        summary: `\`${EXPECTATIONS_FILE}\` in ${link} was edited, and this guide already has evals.`,
        action: 'Confirm the graders still verify the updated expectations, then close this issue.',
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
 * Returns the issues to file and close. A gap with an open issue is left alone.
 * Only `missing-evals` auto-closes, since it is recomputed from the tree every
 * run; `expectations-changed` is a point-in-time alert a human closes.
 */
export function planIssues(gaps: Gap[], existing: ExistingIssue[]): { toCreate: Gap[]; toClose: ExistingIssue[] } {
  const openIssues = new Map<string, ExistingIssue>();
  for (const issue of existing) {
    const marker = issue.state === 'OPEN' ? parseMarker(issue.body) : null;
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
      ['issue', 'list', '--label', EVAL_GAP_LABEL, '--state', 'all', '--limit', '500', '--json', 'number,body,state,title'],
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
      ['issue', 'close', String(issueNumber), '--reason', 'completed', '--comment', 'Resolved — this guide now has evals.'],
      { stdio: 'inherit' }
    );
  },
};

// --- Main ---

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes('--dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  if (dryRun) console.log('🧪 Dry run — no issues will be filed or closed.\n');

  // Matches the workflow's weekly cadence, with a day of overlap so an edit
  // landing near the run boundary isn't missed.
  const since = process.env.EVAL_GAP_SINCE ?? '8 days ago';

  const guides = scanAllGuides();
  const changedFiles = getChangedFiles(since);

  const gaps = [...findMissingEvals(guides), ...findChangedExpectations(guides, changedFiles)];
  console.log(`Scanned ${guides.length} guides (expectations diffed since "${since}"), found ${gaps.length} gap(s).`);

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
