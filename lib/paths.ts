import path from 'path';

/**
 * Returns the repository root directory.
 * 
 * NOTE: We used to use \`git rev-parse --show-toplevel\` here to support git worktrees.
 * However, that failed when evaluations were run from a directory that was itself
 * inside a DIFFERENT git repository (like \`guidance-evals\`), causing it to resolve
 * to that repo's root instead of this project's root.
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
