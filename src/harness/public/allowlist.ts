import fs from 'node:fs';

/**
 * The public allowlist file (`src/dashboard/public-suites-allowlist.json`).
 * It is the only input that decides which suites, models, and guides reach the
 * public dashboard, so it is kept in the repository and changed by pull request.
 */
export interface PublicAllowlist {
  /**
   * Suite IDs or glob patterns (`*` and `?` only) that are eligible for
   * publishing, e.g. `nightly-*-codex_cli`. A suite must match one of these.
   */
  include: string[];
  /** Exact suite IDs that must not be published even if they match `include`. */
  exclude: string[];
  /** Per-suite guide-level overrides. */
  overrides: Array<{ id: string; excludeGuides?: string[] }>;
  /** Model identifiers that may appear publicly. Empty means nothing publishes. */
  releasedModels: string[];
}

/** Reads and minimally validates the allowlist file. Schema validation lives in CI. */
export function loadAllowlist(filePath: string): PublicAllowlist {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`${filePath}: expected a JSON object`);
  }
  const record = parsed as Record<string, unknown>;
  return {
    include: stringArray(record, 'include', filePath),
    exclude: stringArray(record, 'exclude', filePath),
    overrides: overridesArray(record, filePath),
    releasedModels: stringArray(record, 'releasedModels', filePath),
  };
}

/** Suite IDs from `candidates` that match an `include` pattern and are not excluded. Sorted. */
export function selectSuites(allowlist: PublicAllowlist, candidates: readonly string[]): string[] {
  const includes = allowlist.include.map(globToRegExp);
  const excluded = new Set(allowlist.exclude);
  return candidates
    .filter(id => !excluded.has(id) && includes.some(re => re.test(id)))
    .sort();
}

/** The override entry for a suite, if any. */
export function overrideFor(allowlist: PublicAllowlist, suiteId: string): { excludeGuides?: string[] } | undefined {
  return allowlist.overrides.find(entry => entry.id === suiteId);
}

/**
 * Converts a simple glob to an anchored regular expression. Only `*` (any run
 * of characters) and `?` (one character) are special; everything else is
 * literal. Kept deliberately small so the allowlist stays easy to review.
 */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (const char of glob) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function stringArray(record: Record<string, unknown>, key: string, filePath: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`${filePath}: "${key}" must be an array of strings`);
  }
  return value;
}

function overridesArray(record: Record<string, unknown>, filePath: string): PublicAllowlist['overrides'] {
  const value = record['overrides'];
  if (!Array.isArray(value)) {
    throw new Error(`${filePath}: "overrides" must be an array`);
  }
  return value.map((entry, i) => {
    if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') {
      throw new Error(`${filePath}: overrides[${i}] must be an object with a string "id"`);
    }
    const excludeGuides = entry.excludeGuides;
    if (excludeGuides !== undefined && (!Array.isArray(excludeGuides) || !excludeGuides.every((g: unknown) => typeof g === 'string'))) {
      throw new Error(`${filePath}: overrides[${i}].excludeGuides must be an array of strings`);
    }
    return { id: entry.id, ...(excludeGuides ? { excludeGuides } : {}) };
  });
}
