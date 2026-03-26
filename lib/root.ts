import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // Fallback to __dirname-based resolution (e.g. outside a git repo).
    return path.resolve(__dirname, '..');
  }
}

export const rootDir = getRootDir();
