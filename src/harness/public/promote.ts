import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot, rootDir } from '../../core/paths.ts';
import { applyPromote, applyUnpublish, DEFAULT_ALLOWLIST_PATH, loadValidatedAllowlist, validateAllowlistPolicy } from './allowlist.ts';
import type { PendingChange, PublicAllowlist } from './allowlist.ts';
import { addPendingChange, buildSelectedSuites } from './builder.ts';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { checkoutPublished, publishPublicEvals } from './publish.ts';
import { assertClean } from './scrub.ts';
import { GcsSuiteStore } from './suite-store.ts';

/**
 * CLI: change what the public dashboard shows by editing the allowlist.
 *
 *   gd promote <suite-id>                      make a suite eligible (or restore one)
 *   gd unpublish <suite-id>                    hide a whole suite
 *   gd unpublish <suite-id> --guide <guide>    hide one guide within a suite (repeatable)
 *
 * Flags:
 *   --now        also update gh-pages immediately using local gcloud credentials,
 *                instead of waiting for the scheduled job. Requires
 *                PUBLIC_EVALS_FORBIDDEN_TOKENS so the suite is scrubbed with the
 *                same operator list the job uses.
 *   --no-pr      edit the allowlist in place; do not branch, commit, or open a PR
 *   --dry-run    print what would change and stop
 *
 * The allowlist is the source of truth, so every change still goes through a
 * pull request even when `--now` has already updated the site. Until that PR
 * merges, the change is remembered in the published build state so the
 * scheduled job keeps applying it.
 */

const ALLOWLIST_PATH = DEFAULT_ALLOWLIST_PATH;

/** Writes the allowlist with stable formatting so diffs stay one line per change. */
export function writeAllowlist(filePath: string, allowlist: PublicAllowlist): void {
  const ordered = {
    $schema: './public-suites-allowlist.schema.json',
    include: allowlist.include,
    exclude: allowlist.exclude,
    overrides: allowlist.overrides,
    releasedModels: allowlist.releasedModels,
    ...(allowlist.retention ? { retention: allowlist.retention } : {}),
  };
  fs.writeFileSync(filePath, JSON.stringify(ordered, null, 2) + '\n');
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      guide: { type: 'string', multiple: true, default: [] },
      now: { type: 'boolean', default: false },
      'no-pr': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, suiteId] = positionals;

  if (values.help || !suiteId || (command !== 'promote' && command !== 'unpublish')) {
    console.log('Usage: promote.ts (promote|unpublish) <suite-id> [--guide <guide>]... [--now] [--no-pr] [--dry-run]');
    return values.help ? 0 : 1;
  }
  if (command === 'promote' && values.guide.length > 0) {
    console.error(cRed('--guide only applies to unpublish'));
    return 1;
  }
  // The id ends up in a public branch name, PR title, and build state.
  assertClean(suiteId, 'suite id', { forbiddenTokens: forbiddenTokens() });

  const current = loadValidatedAllowlist(ALLOWLIST_PATH);
  const change = command === 'promote'
    ? applyPromote(current, suiteId)
    : applyUnpublish(current, suiteId, values.guide);

  const problems = validateAllowlistPolicy(change.allowlist);
  if (problems.length > 0) {
    console.error(cRed('Change would violate allowlist policy:'));
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    return 1;
  }

  if (change.edits.length === 0) {
    console.log(cYellow(`Allowlist already reflects "${command} ${suiteId}"; nothing to change.`));
  } else {
    for (const edit of change.edits) {
      console.log(`${cCyan('allowlist')} ${edit}`);
    }
  }

  if (values['dry-run']) {
    console.log(cBold('\nDry run; nothing written.'));
    return 0;
  }

  if (change.edits.length > 0) {
    writeAllowlist(ALLOWLIST_PATH, change.allowlist);
    if (!values['no-pr']) {
      openPullRequest(command, suiteId, values.guide, change.edits);
    }
  }

  if (values.now) {
    await updateSiteNow(current, { command, suiteId, guides: values.guide });
  }
  return 0;
}

/** Commits the allowlist change on a fresh branch and opens a PR with `gh`. */
function openPullRequest(command: string, suiteId: string, guides: readonly string[], edits: readonly string[]): void {
  const dirty = git(['status', '--porcelain', '--', ALLOWLIST_PATH]).trim();
  if (!dirty) {
    return;
  }
  const otherChanges = git(['status', '--porcelain']).trim().split('\n').filter(line => line && !line.endsWith('public-suites-allowlist.json'));
  if (otherChanges.length > 0) {
    throw new Error('Working tree has other changes; commit or stash them before opening an allowlist PR.');
  }

  const branch = `public-evals/${command}-${suiteId}`.replaceAll(/[^A-Za-z0-9/_.-]/g, '-');
  const scope = guides.length > 0 ? `${suiteId} (${guides.join(', ')})` : suiteId;
  const title = `public-evals: ${command} ${scope}`;
  const body = edits.map(edit => `- ${edit}`).join('\n');

  git(['checkout', '-b', branch]);
  git(['add', '--', ALLOWLIST_PATH]);
  git(['commit', '--quiet', '-m', title]);
  git(['push', '--quiet', '-u', 'origin', branch]);
  const url = execFileSync('gh', ['pr', 'create', '--title', title, '--body', body], { cwd: rootDir, encoding: 'utf8' }).trim();
  console.log(`${cGreen('pull request')} ${url}`);
}

/**
 * Updates the live site without waiting for the scheduled job. Records the
 * change as pending in the published build state and runs the same
 * incremental build the job runs against the checked-in allowlist, so the job
 * (still on that allowlist until the PR merges) reaches the same result
 * instead of undoing this one. The pending change clears itself once the
 * allowlist reflects it.
 */
async function updateSiteNow(allowlist: PublicAllowlist, change: PendingChange): Promise<void> {
  const tokens = forbiddenTokens([], process.env, { requireList: true });
  const outDir = fs.mkdtempSync(path.join(defaultOutRoot, 'public-evals-now-'));
  try {
    const publishedHead = checkoutPublished(outDir);
    addPendingChange(outDir, change);

    const results = await buildSelectedSuites({
      store: new GcsSuiteStore(),
      outDir,
      allowlist,
      forbiddenTokens: tokens,
      forbiddenTokensVersion: forbiddenTokensVersion(),
    });

    const mine = results.find(result => result.suiteId === change.suiteId);
    const hidesWholeSuite = change.command === 'unpublish' && change.guides.length === 0;
    if (!hidesWholeSuite && mine?.status !== 'built' && mine?.status !== 'unchanged') {
      throw new Error(`${change.suiteId} was not published: ${mine?.reason ?? 'not selected by the allowlist'}`);
    }
    for (const result of results.filter(r => r.status === 'built' || r.status === 'removed')) {
      console.log(`${cCyan('site')} ${result.status} ${result.suiteId}`);
    }

    await publishPublicEvals(outDir, { message: `public-evals: ${change.command} ${change.suiteId}`, expectedHead: publishedHead });
    console.log(cGreen('published to gh-pages'));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' });
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (isMain) {
  main().then(
    code => process.exit(code),
    err => {
      console.error(cRed(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    },
  );
}
