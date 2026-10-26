import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { cBold, cCyan, cGreen, cRed, cYellow } from '../../core/colors.ts';
import { outDir as defaultOutRoot, rootDir } from '../../core/paths.ts';
import { DEFAULT_ALLOWLIST_PATH, globToRegExp, loadValidatedAllowlist, validateAllowlistPolicy } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { buildSuite, PUBLIC_EVALS_DIR, writeManifest } from './builder.ts';
import { forbiddenTokens } from './forbidden-tokens.ts';
import { checkoutPublished, publishPublicEvals } from './publish.ts';
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
 *                instead of waiting for the scheduled job
 *   --no-pr      edit the allowlist in place; do not branch, commit, or open a PR
 *   --dry-run    print what would change and stop
 *
 * The allowlist is the source of truth, so every change still goes through a
 * pull request even when `--now` has already updated the site.
 */

const ALLOWLIST_PATH = DEFAULT_ALLOWLIST_PATH;

/** The result of applying a command to the allowlist, before anything is written. */
export interface AllowlistChange {
  allowlist: PublicAllowlist;
  /** Human-readable description of each edit; empty means nothing needed to change. */
  edits: string[];
}

/** Makes `suiteId` eligible: drops it from `exclude`, drops any override, and adds it to `include` if no pattern admits it. */
export function applyPromote(current: PublicAllowlist, suiteId: string): AllowlistChange {
  const edits: string[] = [];
  const allowlist = clone(current);

  if (allowlist.exclude.includes(suiteId)) {
    allowlist.exclude = allowlist.exclude.filter(id => id !== suiteId);
    edits.push(`remove ${suiteId} from exclude`);
  }
  if (allowlist.overrides.some(override => override.id === suiteId)) {
    allowlist.overrides = allowlist.overrides.filter(override => override.id !== suiteId);
    edits.push(`remove overrides for ${suiteId}`);
  }
  if (!allowlist.include.some(pattern => globToRegExp(pattern).test(suiteId))) {
    allowlist.include = [...allowlist.include, suiteId];
    edits.push(`add ${suiteId} to include`);
  }
  return { allowlist, edits };
}

/** Hides `suiteId` entirely, or only the given guides within it. */
export function applyUnpublish(current: PublicAllowlist, suiteId: string, guides: readonly string[]): AllowlistChange {
  const edits: string[] = [];
  const allowlist = clone(current);

  if (guides.length === 0) {
    if (!allowlist.exclude.includes(suiteId)) {
      allowlist.exclude = [...allowlist.exclude, suiteId];
      edits.push(`add ${suiteId} to exclude`);
    }
    return { allowlist, edits };
  }

  const existing = allowlist.overrides.find(override => override.id === suiteId);
  const already = new Set(existing?.excludeGuides ?? []);
  const added = guides.filter(guide => !already.has(guide));
  if (added.length > 0) {
    const excludeGuides = [...already, ...added];
    allowlist.overrides = [
      ...allowlist.overrides.filter(override => override.id !== suiteId),
      { id: suiteId, excludeGuides },
    ];
    edits.push(`exclude guide(s) ${added.join(', ')} from ${suiteId}`);
  }
  return { allowlist, edits };
}

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

function clone(allowlist: PublicAllowlist): PublicAllowlist {
  return structuredClone(allowlist);
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
    const removeWholeSuite = command === 'unpublish' && values.guide.length === 0;
    await updateSiteNow(command, suiteId, change.allowlist, removeWholeSuite);
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

/** Updates the live site for one suite without waiting for the scheduled job. */
async function updateSiteNow(command: string, suiteId: string, allowlist: PublicAllowlist, removeWholeSuite: boolean): Promise<void> {
  const outDir = fs.mkdtempSync(path.join(defaultOutRoot, 'public-evals-now-'));
  try {
    checkoutPublished(outDir);
    const suiteDir = path.join(outDir, PUBLIC_EVALS_DIR, suiteId);

    if (removeWholeSuite) {
      fs.rmSync(suiteDir, { recursive: true, force: true });
      console.log(`${cCyan('site')} removed ${suiteId}`);
    } else {
      const result = await buildSuite(suiteId, {
        store: new GcsSuiteStore(),
        outDir,
        allowlist,
        forbiddenTokens: forbiddenTokens(),
      });
      if (result.status === 'skipped') {
        throw new Error(`${suiteId} was not published: ${result.reason}`);
      }
      console.log(`${cCyan('site')} built ${suiteId} (${result.files} files)`);
    }

    const count = writeManifest(outDir, []);
    await publishPublicEvals(outDir, { message: `public-evals: ${command} ${suiteId}` });
    console.log(cGreen(`published ${count} suite(s) to gh-pages`));
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
