/**
 * Expectations watch.
 *
 * Files a GitHub issue with the `expectations-changed` label when a guide that
 * already has evals has its `expectations.md` edited in a push that didn't
 * also touch its evals, so they may be stale.
 *
 * Issues are keyed by a hidden marker comment so reruns don't file duplicates.
 *
 * Usage: node src/ci/expectations-watch.ts [--dry-run]
 */

import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanAllGuides,
  getGuideStatus,
  EXPECTATIONS_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  type GuideInventory,
} from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';

export const EVAL_OWNERS = ['micahjo7', 'TravenReese'];
export const EXPECTATIONS_CHANGED_LABEL = 'expectations-changed';

export interface ChangedExpectations {
  /** Repo-relative guide directory, e.g. `guides/css/scrollspy`. */
  guidePath: string;
  guideName: string;
}

/** An open issue carrying the expectations-changed label. */
export interface ExistingIssue {
  number: number;
  body: string;
  title: string;
}

// --- Detection ---

/** True when the changed files edit a guide's expectations.md without touching its evals. */
function editsExpectationsOnly(files: string[], guidePath: string): boolean {
  const inGuide = files.filter(f => f.startsWith(`${guidePath}/`)).map(f => f.slice(guidePath.length + 1));
  return inGuide.includes(EXPECTATIONS_FILE) &&
    !inGuide.some(f => f === GRADER_FILE || f.startsWith('tasks/') || f.startsWith(`${TARGETS_DIR}/`));
}

/** Complete guides whose expectations.md changed without touching their evals. */
export function findChangedExpectations(guides: GuideInventory[], changedFiles: string[]): ChangedExpectations[] {
  return guides
    .filter(inv => getGuideStatus(inv) === null && editsExpectationsOnly(changedFiles, path.relative(rootDir, inv.dir)))
    .map(inv => ({ guidePath: path.relative(rootDir, inv.dir), guideName: inv.name }));
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

export function buildMarker(guidePath: string): string {
  return `<!-- expectations-watch:${guidePath} -->`;
}

export function parseMarker(body: string): string | null {
  const match = body.match(/<!--\s*expectations-watch:(\S+?)\s*-->/);
  return match ? match[1] : null;
}

export function buildIssue(gap: ChangedExpectations): { title: string; body: string } {
  const link = `[\`${gap.guidePath}\`](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/${gap.guidePath})`;
  const title = `Expectations changed for the ${gap.guideName} guide`;
  const body = [
    `\`${EXPECTATIONS_FILE}\` in ${link} was edited, and this guide already has evals.`,
    '',
    `Run \`gd dev ${gap.guidePath}\` to update the evals.`,
    '',
    '<sub>Filed automatically by `src/ci/expectations-watch.ts`.</sub>',
    buildMarker(gap.guidePath),
  ].join('\n');

  return { title, body };
}

// --- Planning ---

/** Returns the gaps that do not already have an open expectations-changed issue. */
export function planIssues(gaps: ChangedExpectations[], existing: ExistingIssue[]): ChangedExpectations[] {
  const openGuides = new Set<string>();
  for (const issue of existing) {
    const guidePath = parseMarker(issue.body);
    if (guidePath) openGuides.add(guidePath);
  }
  return gaps.filter(g => !openGuides.has(g.guidePath));
}

// --- GitHub API ---

export const githubApi = {
  ensureLabel(): void {
    try {
      child_process.execFileSync(
        'gh',
        ['label', 'create', EXPECTATIONS_CHANGED_LABEL, '--description', 'Guide expectations.md changed without updating evals', '--color', 'B60205'],
        { stdio: 'pipe' }
      );
    } catch {
      // Label already exists, which is the common case.
    }
  },

  listIssues(): ExistingIssue[] {
    const output = child_process.execFileSync(
      'gh',
      ['issue', 'list', '--label', EXPECTATIONS_CHANGED_LABEL, '--state', 'open', '--limit', '500', '--json', 'number,body,title'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
    return (JSON.parse(output) as ExistingIssue[]).map(i => ({ ...i, body: i.body ?? '' }));
  },

  createIssue(title: string, body: string): void {
    child_process.execFileSync(
      'gh',
      ['issue', 'create', '--title', title, '--body', body, '--label', EXPECTATIONS_CHANGED_LABEL, '--assignee', EVAL_OWNERS.join(',')],
      { stdio: 'inherit' }
    );
  },
};

// --- Main ---

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const dryRun = argv.includes('--dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  if (dryRun) console.log('🧪 Dry run — no issues will be filed.\n');

  const before = process.env.EXPECTATIONS_WATCH_BEFORE || 'HEAD~1';

  const guides = scanAllGuides();
  const changedFiles = getChangedFiles(before);

  const gaps = findChangedExpectations(guides, changedFiles);
  console.log(`Scanned ${guides.length} guides and ${changedFiles.length} changed file(s), found ${gaps.length} changed-expectations gap(s).`);

  if (gaps.length === 0) {
    console.log('✅ No changes needed.');
    return;
  }

  const toCreate = planIssues(gaps, githubApi.listIssues());
  if (toCreate.length === 0) {
    console.log('✅ No changes needed.');
    return;
  }

  if (!dryRun) githubApi.ensureLabel();

  for (const gap of toCreate) {
    const { title, body } = buildIssue(gap);
    if (dryRun) {
      console.log(`[DRY RUN] Would file "${title}"`);
      continue;
    }
    githubApi.createIssue(title, body);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
