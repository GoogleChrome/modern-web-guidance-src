import { join, resolve } from 'node:path';

/** Path to repository root for the analyzer worktree. */
export const WORKTREE_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Local-only internal docs, specs, and corpus definitions.
 * Excluded from git tracking via .git/info/exclude.
 */
export const ANALYZER_INTERNAL_DIR = join(WORKTREE_ROOT, 'analyzer-internal');

export const REPOS_CONFIG_PATH = join(ANALYZER_INTERNAL_DIR, 'repos.json');
export const LABELS_DIR = join(ANALYZER_INTERNAL_DIR, 'labels');
