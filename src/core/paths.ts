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
export const rootDir = path.resolve(import.meta.dirname, '../..');

export const guidesDir = path.join(rootDir, 'guides');
export const featuresDir = path.join(rootDir, 'features');
export const baseAppsDir = path.join(rootDir, 'src/harness/base-apps');
export const outDir = path.join(rootDir, 'out');
export const resultsDir = path.join(rootDir, 'results');
export const suitesDir = path.join(resultsDir, 'suites');
export const dashboardDir = path.join(rootDir, 'src/dashboard');

export interface GuideResultsInventory {
  category: string;
  name: string;
}

/**
 * Returns the path to the results directory for a specific guide:
 * results/guides/<category>/<name>/
 */
export function getGuideResultsDir(inv: GuideResultsInventory): string {
  if (!inv.name) {
    throw new Error(`getGuideResultsDir: missing name in inventory for category "${inv.category}"`);
  }
  return path.join(resultsDir, 'guides', inv.category, inv.name);
}

/**
 * Resolves the results directory for a guide from its directory path or optional guide info.
 */
export function resolveGuideResultsDir(targetDir: string, guideInfo?: Partial<GuideResultsInventory>): string {
  if (guideInfo?.category && guideInfo?.name) {
    return getGuideResultsDir({ category: guideInfo.category, name: guideInfo.name });
  }
  const resolvedTarget = path.resolve(targetDir);
  const rel = path.relative(guidesDir, resolvedTarget);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    const parts = rel.split(path.sep);
    if (parts.length >= 2) {
      return getGuideResultsDir({ category: parts[0], name: parts[1] });
    }
    if (parts.length === 1) {
      return getGuideResultsDir({ category: parts[0], name: parts[0] });
    }
  }
  const parts = resolvedTarget.split(path.sep);
  const name = parts[parts.length - 1];
  const category = parts[parts.length - 2] || 'cat';
  return getGuideResultsDir({ category, name });
}
