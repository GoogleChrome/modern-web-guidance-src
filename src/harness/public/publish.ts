import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { rootDir } from '../../core/paths.ts';
import { PUBLIC_EVALS_DIR } from './builder.ts';

/**
 * Moves `public-evals/` between the local output directory and the `gh-pages`
 * branch. The UI is deployed to the same branch by `deploy:dashboard`; this
 * module only ever touches the `public-evals/` subtree.
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

  // Clone into the directory gh-pages itself uses, so publishPublicEvals reuses it instead of
  // cloning the whole site a second time.
  const clone = ghpages.getCacheDir(repoUrl);
  if (!fs.existsSync(path.join(clone, '.git'))) {
    fs.rmSync(clone, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(clone), { recursive: true });
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', BRANCH, '--single-branch', '--origin', REMOTE, repoUrl, clone], { stdio: 'ignore' });
  } else {
    execFileSync('git', ['-C', clone, 'fetch', '--quiet', '--depth', '1', REMOTE, BRANCH], { stdio: 'ignore' });
    execFileSync('git', ['-C', clone, 'checkout', '--quiet', '--force', `${REMOTE}/${BRANCH}`], { stdio: 'ignore' });
  }
  // Leftovers from an interrupted publish would otherwise be copied out as suite directories.
  execFileSync('git', ['-C', clone, 'clean', '--quiet', '-fdx'], { stdio: 'ignore' });

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

function assertExpectedHead(repoUrl: string, expectedHead: string | null | undefined): void {
  if (expectedHead === undefined) {
    return;
  }
  const head = remoteHead(repoUrl);
  if (head !== expectedHead) {
    throw new Error(`${BRANCH} moved while building (${expectedHead ?? 'none'} → ${head ?? 'none'}); rerun to pick up the other change`);
  }
}

/**
 * Replaces `public-evals/` on the `gh-pages` branch with `<outDir>/public-evals/`.
 * Other files on the branch are untouched. The branch is rewritten as a single
 * commit so its size tracks the live site rather than accumulating history.
 */
export async function publishPublicEvals(outDir: string, options: PublishOptions): Promise<void> {
  const source = path.join(outDir, PUBLIC_EVALS_DIR);
  if (!fs.existsSync(path.join(source, 'suites.gen.json'))) {
    throw new Error(`${source} has no suites.gen.json; run the builder first`);
  }
  const repoUrl = options.repoUrl ?? originRemoteUrl();
  assertExpectedHead(repoUrl, options.expectedHead);

  // `gh-pages` swallows rejections on its returned Promise unless a callback is passed.
  await new Promise<void>((resolve, reject) => {
    void ghpages.publish(
      source,
      {
        repo: repoUrl,
        branch: BRANCH,
        remote: REMOTE,
        dest: PUBLIC_EVALS_DIR,
        add: false,
        remove: '.',
        history: false,
        nojekyll: true,
        dotfiles: false,
        message: options.message,
        user: options.user,
        beforeAdd: async () => {
          assertExpectedHead(repoUrl, options.expectedHead);
          return undefined;
        },
      },
      (err: unknown) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve();
        }
      },
    );
  });
}
