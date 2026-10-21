import type { RunResult } from '../lib/metrics.ts';

/**
 * Guide-level overrides from the public allowlist file. Lets a single broken
 * guide eval be dropped from a published suite instead of pulling the whole
 * nightly.
 */
export interface SuiteOverride {
  /** Exact suite ID this override applies to. */
  id: string;
  /** Guides whose results and artifacts are left out of the public copy. */
  excludeGuides?: string[];
}

/** Thrown when the suite's result keys or an `excludeGuides` entry cannot be applied safely. */
export class OverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverrideError';
  }
}

/** Results keyed by `"<task> - <guide> - <guided|unguided>"`, as in `evals.json#results`. */
export type ResultsByKey = Record<string, RunResult[]>;

/**
 * The guide a result key belongs to. The harness writes keys as
 * `${task} - ${guide} - ${runType}` (see `collection.ts`), so the guide is
 * always the middle part. Throws on any other shape rather than guessing, so a
 * malformed key cannot slip past an exclusion.
 */
export function guideOfResultKey(key: string): string {
  const parts = key.split(' - ');
  if (parts.length !== 3) {
    throw new OverrideError(`Malformed result key (expected "<task> - <guide> - <runType>"): ${JSON.stringify(key)}`);
  }
  return parts[1];
}

/**
 * Returns a copy of `results` without any scenario belonging to a guide in
 * `guides`. Throws if a listed guide matches nothing, since that almost always
 * means a typo in the allowlist and silently publishing would defeat the point.
 */
export function withoutGuides(results: ResultsByKey, guides: readonly string[]): ResultsByKey {
  const excluded = new Set(guides);
  const matched = new Set<string>();
  const kept: ResultsByKey = {};

  for (const [key, runs] of Object.entries(results)) {
    const guide = guideOfResultKey(key);
    if (excluded.has(guide)) {
      matched.add(guide);
    } else {
      kept[key] = runs;
    }
  }

  const unmatched = guides.filter(guide => !matched.has(guide));
  if (unmatched.length > 0) {
    throw new OverrideError(`excludeGuides lists guides not present in this suite: ${unmatched.join(', ')}`);
  }
  return kept;
}

/** Distinct guides present in `results`. */
export function guidesIn(results: ResultsByKey): Set<string> {
  return new Set(Object.keys(results).map(guideOfResultKey));
}
