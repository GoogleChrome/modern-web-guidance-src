import path from 'path';

/**
 * Returns the repository root directory.
 * 
 * NOTE: We used to use `git rev-parse --show-toplevel` here to support git worktrees.
 * However, that failed when processes were spawned from directories resolved outside 
 * the project (e.g. via symlinks into another git repository), causing it to incorrectly 
 * resolve to that external repository's root instead of this project's root.
 * 
 * Using `import.meta.dirname` is robust and works correctly regardless of the current
 * working directory or surrounding git repositories.
 */
export const rootDir = path.resolve(import.meta.dirname, '..');

export const guidesDir = path.join(rootDir, 'guides');
export const featuresDir = path.join(rootDir, 'features');
export const harnessDir = path.join(rootDir, 'harness');
export const baseAppsDir = path.join(rootDir, 'harness/base_apps');
export const outDir = path.join(rootDir, 'out');
export const resultsDir = path.join(rootDir, 'results');
export const suitesDir = path.join(resultsDir, 'suites');
export const dashboardDir = path.join(rootDir, 'eval-view');
export const evalViewDir = dashboardDir;

export interface GuideResultsInventory {
  category: string;
  slug?: string;
  name?: string;
}

/**
 * Returns the path to the results directory for a specific guide:
 * results/guides/<category>/<slug>/
 */
export function getGuideResultsDir(inv: GuideResultsInventory): string {
  const slug = inv.slug || inv.name;
  if (!slug) {
    throw new Error(`getGuideResultsDir: missing slug/name in inventory for category "${inv.category}"`);
  }
  return path.join(resultsDir, 'guides', inv.category, slug);
}

