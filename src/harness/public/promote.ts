import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot, rootDir } from '../../core/paths.ts';
import {
  applyPromote,
  applyUnpublish,
  DEFAULT_ALLOWLIST_PATH,
  loadValidatedAllowlist,
  parseValidatedAllowlist,
  validateAllowlistPolicy,
} from './allowlist.ts';
import type { AllowlistChange, PendingChange, PublicAllowlist } from './allowlist.ts';
import {
  addPendingChange,
  buildSelectedSuites,
  publishedForbiddenTokensVersion,
} from './builder.ts';
import type { SuiteBuildResult } from './builder.ts';
import { forbiddenTokens, forbiddenTokensVersion } from './forbidden-tokens.ts';
import { checkoutPublished, publishPublicEvals } from './publish.ts';
import { assertClean } from './scrub.ts';
import { GcsSuiteStore } from './suite-store.ts';
import type { SuiteStore } from './suite-store.ts';

/**
 * CLI: change what the public dashboard shows by editing the allowlist.
 *
 *   gd promote <suite-id>                      make a suite eligible (or restore one)
 *   gd unpublish <suite-id>                    hide a whole suite
 *   gd unpublish <suite-id> --guide <guide>    hide one guide within a suite (repeatable)
 *
 * Flags:
 *   --now        also update gh-pages immediately using local gcloud credentials.
 *                Builds against the allowlist on origin/main plus this pending
 *                change, and requires HEAD == origin/main, a clean working tree,
 *                and a PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION matching the live site.
 *   --no-pr      edit the allowlist in place; do not branch, commit, or open a PR.
 *                Not combinable with --now: a site change must always have a PR.
 *   --dry-run    print what would change and stop
 *
 * Every command requires PUBLIC_EVALS_FORBIDDEN_TOKENS so suite ids and guide
 * names are checked against the full operator list before entering branch
 * names, PR titles, or build state.
 */

const ALLOWLIST_PATH = DEFAULT_ALLOWLIST_PATH;
const ALLOWLIST_REPO_PATH = path.relative(rootDir, ALLOWLIST_PATH).split(path.sep).join('/');

/** Writes the allowlist with stable formatting after validating the serialized JSON against schema + policy. */
export function writeAllowlist(filePath: string, allowlist: PublicAllowlist): void {
  const ordered = {
    $schema: './allowlist.schema.json',
    include: allowlist.include,
    exclude: allowlist.exclude,
    overrides: allowlist.overrides,
    releasedModels: allowlist.releasedModels,
    ...(allowlist.retention ? { retention: allowlist.retention } : {}),
  };
  const text = JSON.stringify(ordered, null, 2) + '\n';
  parseValidatedAllowlist(text, filePath);
  fs.writeFileSync(filePath, text);
}

export interface PromoteFlags {
  now: boolean;
  'no-pr': boolean;
}

/** The one flag combination that is refused outright: `--now` without a PR would change the site with no review trail. */
export function flagConflict(flags: PromoteFlags): string | undefined {
  return flags.now && flags['no-pr'] ? '--now and --no-pr cannot be combined: a change to the live site must always have a pull request' : undefined;
}

/**
 * Refuses to open a PR or run `--now` unless the working tree is clean and
 * `HEAD` matches `origin/main`, so neither unreviewed branch commits nor
 * uncommitted scrubber/allowlist edits can ride into the PR or the live site.
 */
export function verifyCleanAtOriginMain(runGit: (args: string[]) => string = git): void {
  if (runGit(['status', '--porcelain']).trim() !== '') {
    throw new Error('Working tree has uncommitted changes; commit or stash them before opening an allowlist PR or running --now.');
  }
  const head = runGit(['rev-parse', 'HEAD']).trim();
  const originMain = runGit(['rev-parse', 'origin/main']).trim();
  if (head !== originMain) {
    throw new Error(`HEAD (${head.slice(0, 8)}) is not at origin/main (${originMain.slice(0, 8)}); check out origin/main before opening an allowlist PR or running --now.`);
  }
}

/**
 * Enforces the two `--now` safety invariants against the live state:
 *  1. `promote --now` cannot undo a reviewed `exclude` on `origin/main`.
 *  2. `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION` must match the published build
 *     state (once any suites are recorded) so `--now` does not rescrub the site
 *     under a mismatched token list.
 */
export function checkNowPolicy(
  change: PendingChange,
  originMainAllowlist: PublicAllowlist,
  publishedTokensVersion: number | undefined,
  localTokensVersion: number,
): void {
  if (change.command === 'promote' && originMainAllowlist.exclude.includes(change.suiteId)) {
    throw new Error(`${change.suiteId} is excluded by the allowlist on origin/main; that takedown was reviewed, so restore it by merging the PR rather than with --now`);
  }
  if (publishedTokensVersion !== undefined && publishedTokensVersion !== localTokensVersion) {
    throw new Error(
      `Published build-state.json uses PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION=${publishedTokensVersion}, got ${localTokensVersion}; match the published version before running --now`,
    );
  }
}

/** Verifies the `--now` build succeeded and achieved the requested visibility change before pushing `gh-pages`. */
export function checkSiteOutcome(change: PendingChange, results: readonly SuiteBuildResult[]): void {
  const failed = results.filter(result => result.status === 'failed');
  if (failed.length > 0) {
    throw new Error(`${failed.length} suite(s) failed to build; nothing published. Fix the cause and rerun --now.`);
  }
  const mine = results.find(result => result.suiteId === change.suiteId);
  const hidesWholeSuite = change.command === 'unpublish' && change.guides.length === 0;
  if (!hidesWholeSuite && mine?.status !== 'built' && mine?.status !== 'unchanged') {
    throw new Error(`${change.suiteId} was not published: ${mine?.reason ?? 'not selected by the allowlist'}`);
  }
}

function formatScope(suiteId: string, guides: readonly string[]): string {
  return guides.length > 0 ? `${suiteId} (${guides.join(', ')})` : suiteId;
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
  const conflict = flagConflict(values);
  if (conflict) {
    console.error(cRed(conflict));
    return 1;
  }

  // Suite ids and guide names end up in public branch names, PR titles, allowlist.json, and build state.
  const tokens = forbiddenTokens([], process.env, { requireList: true });
  const tokensVersion = forbiddenTokensVersion();
  assertClean(suiteId, 'suite id', { forbiddenTokens: tokens });
  const guides = [...new Set(values.guide)];
  for (const guide of guides) {
    assertClean(guide, 'guide name', { forbiddenTokens: tokens });
  }

  const applyChange = (allowlist: PublicAllowlist): AllowlistChange =>
    (command === 'promote' ? applyPromote(allowlist, suiteId) : applyUnpublish(allowlist, suiteId, guides));

  if (values['dry-run'] || values['no-pr']) {
    const current = loadValidatedAllowlist(ALLOWLIST_PATH);
    const change = applyChange(current);
    const problems = validateAllowlistPolicy(change.allowlist);
    if (problems.length > 0) {
      console.error(cRed('Change would violate allowlist policy:'));
      for (const problem of problems) {
        console.error(`  - ${problem}`);
      }
      return 1;
    }
    reportEdits(command, suiteId, guides, change.edits);
    if (values['dry-run']) {
      console.log(cBold('\nDry run; nothing written.'));
      return 0;
    }
    if (change.edits.length > 0) {
      writeAllowlist(ALLOWLIST_PATH, change.allowlist);
    }
    return 0;
  }

  git(['fetch', '--quiet', 'origin', 'main']);
  verifyCleanAtOriginMain(git);
  const originMainAllowlist = parseValidatedAllowlist(
    git(['show', `origin/main:${ALLOWLIST_REPO_PATH}`]),
    `origin/main:${ALLOWLIST_REPO_PATH}`,
  );
  const change = applyChange(originMainAllowlist);
  const problems = validateAllowlistPolicy(change.allowlist);
  if (problems.length > 0) {
    console.error(cRed('Change would violate allowlist policy:'));
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    return 1;
  }
  reportEdits(command, suiteId, guides, change.edits);

  const pendingChange: PendingChange = {
    command,
    suiteId,
    guides,
    createdAt: new Date().toISOString(),
  };

  if (!values.now) {
    if (change.edits.length > 0) {
      openPullRequest(command, suiteId, guides, change.edits, change.allowlist);
    }
    return 0;
  }

  fs.mkdirSync(defaultOutRoot, { recursive: true });
  const outDir = fs.mkdtempSync(path.join(defaultOutRoot, 'public-evals-now-'));
  try {
    await runNow({
      outDir,
      originMainAllowlist,
      change,
      pendingChange,
      tokens,
      tokensVersion,
    });
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  return 0;
}

function reportEdits(command: string, suiteId: string, guides: readonly string[], edits: readonly string[]): void {
  if (edits.length === 0) {
    console.log(cYellow(`Allowlist already reflects "${command} ${formatScope(suiteId, guides)}"; nothing to change.`));
    return;
  }
  for (const edit of edits) {
    console.log(`${cCyan('allowlist')} ${edit}`);
  }
}

function currentGitRef(runGit: (args: string[]) => string): string {
  try {
    return runGit(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  } catch {
    return runGit(['rev-parse', 'HEAD']).trim();
  }
}

export interface PullRequestDeps {
  allowlistPath?: string;
  runGit?: (args: string[]) => string;
  runGh?: (args: string[]) => string;
}

/**
 * Commits the allowlist change on a temporary branch, opens a PR with `gh` (or
 * reuses an existing open PR on retry), switches back to the starting ref, and
 * deletes the temporary local branch.
 */
export function openPullRequest(
  command: string,
  suiteId: string,
  guides: readonly string[],
  edits: readonly string[],
  nextAllowlist: PublicAllowlist,
  deps: PullRequestDeps = {},
): string {
  const allowlistPath = deps.allowlistPath ?? ALLOWLIST_PATH;
  const runGit = deps.runGit ?? git;
  const runGh = deps.runGh ?? gh;
  const suffix = guides.length > 0 ? `${suiteId}-${guides.join('-')}` : suiteId;
  const branch = `public-evals/${command}-${suffix}`.replaceAll(/[^A-Za-z0-9/_.-]/g, '-');
  const title = `public-evals: ${command} ${formatScope(suiteId, guides)}`;
  const body = edits.map(edit => `- ${edit}`).join('\n');

  const openPrs = JSON.parse(
    runGh(['pr', 'list', '--head', branch, '--base', 'main', '--state', 'open', '--json', 'url']),
  ) as Array<{ url?: string }>;
  if (openPrs[0]?.url) {
    console.log(`${cGreen('pull request')} ${openPrs[0].url}`);
    return openPrs[0].url;
  }

  const previousRef = currentGitRef(runGit);
  runGit(['checkout', '-B', branch]);
  try {
    writeAllowlist(allowlistPath, nextAllowlist);
    runGit(['add', '--', allowlistPath]);
    runGit(['commit', '--quiet', '-m', title]);
    runGit(['push', '--quiet', '--force', '-u', 'origin', branch]);
    const url = runGh(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body]).trim();
    console.log(`${cGreen('pull request')} ${url}`);
    return url;
  } finally {
    try {
      runGit(['checkout', '--force', '--quiet', previousRef]);
    } finally {
      if (previousRef !== branch) {
        runGit(['branch', '-D', branch]);
      }
    }
  }
}

export interface RunNowContext {
  outDir: string;
  originMainAllowlist: PublicAllowlist;
  change: AllowlistChange;
  pendingChange: PendingChange;
  tokens: string[];
  tokensVersion: number;
  store?: SuiteStore;
  baseAppsDir?: string;
  checkout?: (outDir: string) => string | null;
  openPr?: () => void;
  publish?: (outDir: string, opts: { message: string; expectedHead: string | null }) => Promise<void>;
}

/**
 * Executes `--now`: checks out `gh-pages`, builds and validates the site
 * outcome against `origin/main` + the pending change *before* creating any
 * branch or PR, then opens (or reuses) the allowlist PR and publishes `gh-pages`.
 */
export async function runNow(ctx: RunNowContext): Promise<void> {
  const { pendingChange } = ctx;
  const publishedHead = (ctx.checkout ?? checkoutPublished)(ctx.outDir);
  checkNowPolicy(pendingChange, ctx.originMainAllowlist, publishedForbiddenTokensVersion(ctx.outDir), ctx.tokensVersion);

  addPendingChange(ctx.outDir, pendingChange);
  const results = await buildSelectedSuites({
    store: ctx.store ?? new GcsSuiteStore(),
    outDir: ctx.outDir,
    allowlist: ctx.originMainAllowlist,
    forbiddenTokens: ctx.tokens,
    forbiddenTokensVersion: ctx.tokensVersion,
    ...(ctx.baseAppsDir ? { baseAppsDir: ctx.baseAppsDir } : {}),
  });

  for (const result of results) {
    if (result.status === 'built' || result.status === 'removed') {
      console.log(`${cCyan('site')} ${result.status} ${result.suiteId}`);
    } else if (result.status === 'skipped') {
      console.log(`${cYellow('site')} skipped ${result.suiteId}  ${result.code}: ${result.reason}`);
    } else if (result.status === 'failed') {
      console.log(`${cRed('site')} FAILED ${result.suiteId}  ${result.reason}`);
    }
  }
  checkSiteOutcome(pendingChange, results);

  if (ctx.change.edits.length > 0) {
    const openPr = ctx.openPr ?? (() => {
      openPullRequest(
        pendingChange.command,
        pendingChange.suiteId,
        pendingChange.guides,
        ctx.change.edits,
        ctx.change.allowlist,
      );
    });
    openPr();
  }

  await (ctx.publish ?? publishPublicEvals)(ctx.outDir, {
    message: `public-evals: ${pendingChange.command} ${formatScope(pendingChange.suiteId, pendingChange.guides)}`,
    expectedHead: publishedHead,
  });
  console.log(cGreen('published to gh-pages'));
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' });
}

function gh(args: string[]): string {
  return execFileSync('gh', args, { cwd: rootDir, encoding: 'utf8' });
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
