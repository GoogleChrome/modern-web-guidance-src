import { execSync } from 'child_process';
import path from 'path';
/**
 * Returns the repository root directory. Uses `git rev-parse --show-toplevel`
 * so that the correct root is returned even when running from a git worktree.
 */
export function getRootDir(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Fallback to import.meta.dirname-based resolution (e.g. outside a git repo).
    return path.resolve(import.meta.dirname, '..');
  }
}

export const rootDir = getRootDir();

export const guidesDir = path.join(rootDir, 'guides');
export const harnessDir = path.join(rootDir, 'harness');
export const tasksDir = path.join(harnessDir, 'tasks');
export const baseAppsDir = path.join(harnessDir, 'base_apps');
export const resultsDir = path.join(harnessDir, 'results');
export const evalViewDir = path.join(rootDir, 'eval-view');
