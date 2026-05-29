import path from 'path';

/**
 * Returns the repository root directory.
 * 
 * NOTE: We used to use \`git rev-parse --show-toplevel\` here to support git worktrees.
 * However, that failed when processes were spawned from directories resolved outside 
 * the project (e.g. via symlinks into another git repository), causing it to incorrectly 
 * resolve to that external repository's root instead of this project's root.
 * 
 * Using \`import.meta.dirname\` is robust and works correctly regardless of the current
 * working directory or surrounding git repositories.
 */
export const rootDir = path.resolve(import.meta.dirname, '..');

export const guidesDir = path.join(rootDir, 'guides');
export const harnessDir = path.join(rootDir, 'harness');
export const baseAppsDir = path.join(harnessDir, 'base_apps');
export const resultsDir = path.join(harnessDir, 'results');
export const evalViewDir = path.join(rootDir, 'eval-view');
