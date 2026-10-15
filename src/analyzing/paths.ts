import { homedir } from 'node:os';
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
export const CARDS_DIR = join(LABELS_DIR, 'cards');
export const GRADES_PATH = join(LABELS_DIR, 'grades.paulirish.jsonl');
export const CALIBRATION_DECK_PATH = join(LABELS_DIR, 'calibration-deck.json');
export const M3_SPOTCHECK_DECK_PATH = join(LABELS_DIR, 'm3-spotcheck-deck.json');
export const GUIDE_SUMMARIES_PATH = join(LABELS_DIR, 'guide-summaries.json');
export const GUIDES_DIR = join(WORKTREE_ROOT, 'guides');
export const PROGRESS_LOG_PATH = join(ANALYZER_INTERNAL_DIR, 'PROGRESS.md');

/** Default clone cache directory for checked-out test repos. */
export const CACHE_ROOT = join(homedir(), '.cache', 'analyzer-repos');

export interface RepoConfigEntry {
  repo: string;
  split: string;
  commit: string;
  localPath?: string | null;
}

/**
 * Resolves the absolute directory path for a repo, respecting localPath override.
 */
export function repoDir(entry: RepoConfigEntry, root: string = CACHE_ROOT): string {
  if (entry.localPath) {
    return resolve(entry.localPath.replace(/^~(?=\/)/, homedir()));
  }
  return join(root, entry.repo);
}


