import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { PUBLIC_EVALS_DIR } from './builder.ts';

/**
 * Moves `public-evals/` between the local output directory and the `gh-pages`
 * branch. The UI is deployed to the same branch by `deploy:dashboard`; this
 * module only ever touches the `public-evals/` subtree.
 */

const BRANCH = 'gh-pages';

export interface PublishOptions {
  /** Commit message on the `gh-pages` branch. */
  message: string;
  /** Prepare everything but do not push. */
  dryRun?: boolean;
  /** Git remote to publish to. Defaults to `origin`. */
  remote?: string;
}

/**
 * Copies the currently published `public-evals/` into `<outDir>/public-evals/`
 * so a single suite can be added or removed without rebuilding the rest.
 * Leaves `outDir` empty if the branch or directory does not exist yet.
 */
export function checkoutPublished(outDir: string, remote = 'origin'): void {
  const dest = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const remoteUrl = execFileSync('git', ['remote', 'get-url', remote], { encoding: 'utf8' }).trim();
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-'));
  try {
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', BRANCH, remoteUrl, clone], { stdio: 'ignore' });
  } catch {
    return; // No gh-pages branch yet; nothing is published.
  }
  try {
    const published = path.join(clone, PUBLIC_EVALS_DIR);
    if (fs.existsSync(published)) {
      fs.cpSync(published, dest, { recursive: true });
    }
  } finally {
    fs.rmSync(clone, { recursive: true, force: true });
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
  await ghpages.publish(source, {
    branch: BRANCH,
    remote: options.remote ?? 'origin',
    dest: PUBLIC_EVALS_DIR,
    add: false,
    remove: '.',
    history: false,
    nojekyll: true,
    dotfiles: false,
    message: options.message,
    push: !options.dryRun,
  });
}
