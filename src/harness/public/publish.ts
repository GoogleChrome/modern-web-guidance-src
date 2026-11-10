import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { outDir as defaultOutRoot, rootDir } from '../../core/paths.ts';
import { PUBLIC_EVALS_DIR } from './builder.ts';

/**
 * Moves `public-evals/` between the local output directory and the `gh-pages`
 * branch. The UI is deployed to the same branch by `deploy:dashboard`; this
 * module only ever touches the `public-evals/` subtree.
 *
 * Plain `git` plus `fs`, not the `gh-pages` package: that library expands the
 * publish directory into one argument per file and hands all of them to a
 * single `git rm`, which exceeds the kernel's argument limit (`E2BIG`) at the
 * ~35k files a full site holds.
 */

const BRANCH = 'gh-pages';
const REMOTE = 'origin';

export interface PublishOptions {
  /** Commit message on the `gh-pages` branch. */
  message: string;
  /** Repository URL to publish to. Defaults to `origin` of the repo checkout. */
  repoUrl?: string;
  /** Git author/committer for the `gh-pages` commit (tests on machines without `~/.gitconfig`). */
  user?: { name: string; email: string };
  /**
   * The remote `gh-pages` head this build started from (see
   * `checkoutPublished`). Checked before starting and again right before
   * committing and pushing: if the branch has moved since, publishing is
   * refused rather than overwriting someone else's change.
   */
  expectedHead?: string | null;
}

/** Resolves `origin`'s URL in the repo checkout. */
export function originRemoteUrl(): string {
  return execFileSync('git', ['remote', 'get-url', REMOTE], { cwd: rootDir, encoding: 'utf8' }).trim();
}

/** Where the shallow clone of `gh-pages` for `repoUrl` lives between runs (under the gitignored `out/`). */
export function cloneDir(repoUrl: string): string {
  return path.join(defaultOutRoot, 'gh-pages-clone', repoUrl.replace(/[^\w.-]+/g, '_'));
}

/**
 * Copies the currently published `public-evals/` into `<outDir>/public-evals/`
 * so a single suite can be added or removed without rebuilding the rest.
 * Returns the remote branch head, or null (and an empty `outDir`) when the
 * branch does not exist yet. Any other failure to reach the remote throws:
 * treating it as "nothing published" would rebuild and replace the site.
 */
export function checkoutPublished(outDir: string, repoUrl = originRemoteUrl()): string | null {
  const dest = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const head = remoteHead(repoUrl);
  if (head === null) {
    return null;
  }
  const clone = syncClone(repoUrl, head);
  const published = path.join(clone, PUBLIC_EVALS_DIR);
  if (fs.existsSync(published)) {
    fs.cpSync(published, dest, { recursive: true });
  }
  return head;
}

/** The remote `gh-pages` commit, or null if the branch does not exist. */
export function remoteHead(repoUrl: string): string | null {
  const out = execFileSync('git', ['ls-remote', repoUrl, `refs/heads/${BRANCH}`], { encoding: 'utf8' }).trim();
  return out === '' ? null : out.split(/\s+/)[0];
}

function movedError(expectedHead: string | null, head: string | null): Error {
  return new Error(`${BRANCH} moved while building (${expectedHead ?? 'none'} → ${head ?? 'none'}); rerun to pick up the other change`);
}

/**
 * Replaces `public-evals/` on the `gh-pages` branch with `<outDir>/public-evals/`.
 * Other files on the branch are untouched. The branch is rewritten as a single
 * commit so its size tracks the live site rather than accumulating history.
 * Does nothing when the published copy already matches.
 */
export async function publishPublicEvals(outDir: string, options: PublishOptions): Promise<void> {
  const source = path.join(outDir, PUBLIC_EVALS_DIR);
  if (!fs.existsSync(path.join(source, 'suites.gen.json'))) {
    throw new Error(`${source} has no suites.gen.json; run the builder first`);
  }
  const repoUrl = options.repoUrl ?? originRemoteUrl();
  const head = remoteHead(repoUrl);
  if (options.expectedHead !== undefined && head !== options.expectedHead) {
    throw movedError(options.expectedHead, head);
  }
  const clone = syncClone(repoUrl, head);
  const published = path.join(clone, PUBLIC_EVALS_DIR);
  fs.rmSync(published, { recursive: true, force: true });
  // Dot-prefixed entries (editor or OS droppings) are never part of the public contract.
  fs.cpSync(source, published, { recursive: true, filter: src => !path.basename(src).startsWith('.') });
  fs.writeFileSync(path.join(clone, '.nojekyll'), '');

  // `--force`: a stale `.gitignore` (`*.log`) left on the branch by an earlier deploy would otherwise
  // silently drop every `modern-web.log`; the dot-prefix filter above is the only junk guard this tree needs.
  git(clone, ['add', '-A', '--force', '--', PUBLIC_EVALS_DIR, '.nojekyll']);
  if (!indexDiffersFromHead(clone, head)) {
    return;
  }

  const tree = git(clone, ['write-tree']).trim();
  const authorEnv: Record<string, string> = options.user
    ? {
        GIT_AUTHOR_NAME: options.user.name,
        GIT_AUTHOR_EMAIL: options.user.email,
        GIT_COMMITTER_NAME: options.user.name,
        GIT_COMMITTER_EMAIL: options.user.email,
      }
    : {};
  // No parent: one commit holding the whole site, as `gh-pages`' history:false did.
  const commit = git(clone, ['commit-tree', tree, '-m', options.message], authorEnv).trim();
  // The lease makes the expectedHead check atomic with the push: if the branch moved while
  // the site was building, the remote rejects the update instead of us overwriting it.
  const force = options.expectedHead === undefined
    ? '--force'
    : `--force-with-lease=refs/heads/${BRANCH}:${options.expectedHead ?? ''}`;
  const push = spawnSync('git', ['push', '--quiet', force, REMOTE, `${commit}:refs/heads/${BRANCH}`], { cwd: clone, encoding: 'utf8' });
  if (push.status !== 0) {
    if (/stale info|rejected/.test(push.stderr) && options.expectedHead !== undefined) {
      throw movedError(options.expectedHead, remoteHead(repoUrl));
    }
    throw new Error(`git push to ${BRANCH} failed: ${push.stderr.trim() || push.status}`);
  }
  // The index and working tree already hold the new site; only HEAD needs to move.
  git(clone, ['reset', '--quiet', '--soft', commit]);
}

/**
 * Makes `cloneDir(repoUrl)` a shallow clone of `gh-pages` at `head`, with a
 * clean working tree. When the branch does not exist yet (`head === null`) the
 * clone is an empty repository with `origin` configured, so the first publish
 * creates the branch.
 */
function syncClone(repoUrl: string, head: string | null): string {
  const clone = cloneDir(repoUrl);
  // No branch on the remote: start from an empty repository, so that nothing left in a clone
  // from an earlier publish (if the branch was deleted since) can ride into the first commit.
  if (head === null || !fs.existsSync(path.join(clone, '.git'))) {
    fs.rmSync(clone, { recursive: true, force: true });
    fs.mkdirSync(clone, { recursive: true });
    git(clone, ['init', '--quiet']);
    git(clone, ['remote', 'add', REMOTE, repoUrl]);
  }
  if (head === null) {
    return clone;
  }
  git(clone, ['fetch', '--quiet', '--depth', '1', REMOTE, BRANCH]);
  git(clone, ['checkout', '--quiet', '--force', `${REMOTE}/${BRANCH}`]);
  // Leftovers from an interrupted publish would otherwise be copied out as suite directories.
  git(clone, ['clean', '--quiet', '-fdx']);
  return clone;
}

/**
 * Whether the staged tree differs from the published commit. Answered by exit
 * code, not by listing paths: `git status` output for a full site is several
 * megabytes, more than `execFileSync` buffers.
 */
function indexDiffersFromHead(clone: string, head: string | null): boolean {
  if (head === null) {
    return true;
  }
  const result = spawnSync('git', ['diff', '--cached', '--quiet', head], { cwd: clone, stdio: 'ignore' });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git diff --cached exited with ${result.status ?? result.signal}`);
  }
  return result.status === 1;
}

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  // Output is normally a hash or nothing; the generous buffer keeps a chatty failure readable.
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
}
