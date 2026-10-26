import fs from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import { dashboardDir } from '../../core/paths.ts';

/**
 * The public allowlist file (`src/dashboard/public-suites-allowlist.json`).
 * It is the only input that decides which suites, models, and guides reach the
 * public dashboard, so it is kept in the repository and changed by pull request.
 *
 * Shape is enforced by `public-suites-allowlist.schema.json` (one source of
 * truth for editors and the loader). The few rules a schema cannot express
 * live in `validateAllowlistPolicy`.
 */
export interface PublicAllowlist {
  /** Suite IDs or glob patterns (`*` and `?` only) that are eligible for publishing. */
  include: string[];
  /** Exact suite IDs that must not be published even if they match `include`. */
  exclude: string[];
  /** Per-suite guide-level overrides. */
  overrides: Array<{ id: string; excludeGuides: string[] }>;
  /** Model identifiers that may appear publicly. Empty means nothing publishes. */
  releasedModels: string[];
  /** Limits on how much history stays published; see `applyRetention`. */
  retention?: { maxAgeDays?: number; maxSuites?: number };
}

export const DEFAULT_ALLOWLIST_PATH = path.join(dashboardDir, 'public-suites-allowlist.json');
const SCHEMA_PATH = path.join(dashboardDir, 'public-suites-allowlist.schema.json');

const validateShape = new Ajv2020({ allErrors: true }).compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')));

/** Reads the allowlist and checks it against the JSON Schema. Throws listing every violation. */
export function loadAllowlist(filePath: string): PublicAllowlist {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!validateShape(parsed)) {
    const problems = (validateShape.errors ?? []).map((err: ErrorObject) => `${err.instancePath || '/'} ${err.message ?? ''}`.trim());
    throw new Error(`${filePath} does not match the allowlist schema:\n  - ${problems.join('\n  - ')}`);
  }
  const { $schema: _schema, ...allowlist } = parsed as PublicAllowlist & { $schema?: string };
  return allowlist;
}

/** Loads and policy-checks the allowlist; the one entry point every command should use. */
export function loadValidatedAllowlist(filePath = DEFAULT_ALLOWLIST_PATH): PublicAllowlist {
  const allowlist = loadAllowlist(filePath);
  const problems = validateAllowlistPolicy(allowlist);
  if (problems.length > 0) {
    throw new Error(`${filePath} violates allowlist policy:\n  - ${problems.join('\n  - ')}`);
  }
  return allowlist;
}

/** Suite IDs from `candidates` that match an `include` pattern and are not excluded. Sorted. */
export function selectSuites(allowlist: PublicAllowlist, candidates: readonly string[]): string[] {
  const includes = allowlist.include.map(globToRegExp);
  const excluded = new Set(allowlist.exclude);
  return candidates
    .filter(id => !excluded.has(id) && includes.some(re => re.test(id)))
    .sort();
}

/** The result of applying a command to the allowlist, before anything is written. */
export interface AllowlistChange {
  allowlist: PublicAllowlist;
  /** Human-readable description of each edit; empty means the allowlist already reflects the command. */
  edits: string[];
}

/** Makes `suiteId` eligible: drops it from `exclude`, drops any override, and adds it to `include` if no pattern admits it. */
export function applyPromote(current: PublicAllowlist, suiteId: string): AllowlistChange {
  const edits: string[] = [];
  const allowlist = structuredClone(current);

  if (allowlist.exclude.includes(suiteId)) {
    allowlist.exclude = allowlist.exclude.filter(id => id !== suiteId);
    edits.push(`remove ${suiteId} from exclude`);
  }
  if (allowlist.overrides.some(override => override.id === suiteId)) {
    allowlist.overrides = allowlist.overrides.filter(override => override.id !== suiteId);
    edits.push(`remove overrides for ${suiteId}`);
  }
  if (!allowlist.include.some(pattern => globToRegExp(pattern).test(suiteId))) {
    allowlist.include = [...allowlist.include, suiteId];
    edits.push(`add ${suiteId} to include`);
  }
  return { allowlist, edits };
}

/** Hides `suiteId` entirely, or only the given guides within it. */
export function applyUnpublish(current: PublicAllowlist, suiteId: string, guides: readonly string[]): AllowlistChange {
  const edits: string[] = [];
  const allowlist = structuredClone(current);

  if (guides.length === 0) {
    if (!allowlist.exclude.includes(suiteId)) {
      allowlist.exclude = [...allowlist.exclude, suiteId];
      edits.push(`add ${suiteId} to exclude`);
    }
    return { allowlist, edits };
  }

  const existing = allowlist.overrides.find(override => override.id === suiteId);
  const already = new Set(existing?.excludeGuides ?? []);
  const added = guides.filter(guide => !already.has(guide));
  if (added.length > 0) {
    const excludeGuides = [...already, ...added];
    allowlist.overrides = [
      ...allowlist.overrides.filter(override => override.id !== suiteId),
      { id: suiteId, excludeGuides },
    ];
    edits.push(`exclude guide(s) ${added.join(', ')} from ${suiteId}`);
  }
  return { allowlist, edits };
}

/**
 * A `gd promote --now` / `gd unpublish --now` whose allowlist PR has not merged
 * yet. Recorded in the published build state so the scheduled job, still on
 * the old allowlist, applies the same change instead of undoing it.
 */
export interface PendingChange {
  command: 'promote' | 'unpublish';
  suiteId: string;
  /** For `unpublish`: hide only these guides. Empty hides the whole suite. */
  guides: string[];
}

export function applyPendingChange(allowlist: PublicAllowlist, change: PendingChange): AllowlistChange {
  return change.command === 'promote'
    ? applyPromote(allowlist, change.suiteId)
    : applyUnpublish(allowlist, change.suiteId, change.guides);
}

/**
 * Layers pending changes over the checked-in allowlist. A change the allowlist
 * already reflects (its PR merged) has done its job and is dropped.
 */
export function applyPendingChanges(
  allowlist: PublicAllowlist,
  pending: readonly PendingChange[],
): { allowlist: PublicAllowlist; pending: PendingChange[] } {
  const stillPending: PendingChange[] = [];
  let effective = allowlist;
  for (const change of pending) {
    const applied = applyPendingChange(effective, change);
    if (applied.edits.length > 0) {
      stillPending.push(change);
      effective = applied.allowlist;
    }
  }
  return { allowlist: effective, pending: stillPending };
}

/**
 * Applies `retention` to already-selected suites: drops suites older than
 * `maxAgeDays` and keeps at most the `maxSuites` newest. Keeps the public site
 * under GitHub Pages' size cap without anyone editing `exclude` by hand.
 */
export function applyRetention(
  allowlist: PublicAllowlist,
  suites: readonly { id: string; createdAt: Date }[],
  now = new Date(),
): string[] {
  const { maxAgeDays, maxSuites } = allowlist.retention ?? {};
  let kept = [...suites].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (maxAgeDays !== undefined) {
    const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
    kept = kept.filter(suite => suite.createdAt.getTime() >= cutoff);
  }
  if (maxSuites !== undefined) {
    kept = kept.slice(0, maxSuites);
  }
  return kept.map(suite => suite.id).sort();
}

/**
 * When a suite was run, for retention. Nightly ids embed the run time
 * (`nightly-2026-10-20_20-43-48-codex_cli`), which is stable; the bucket's
 * `timeCreated` resets if a suite is re-uploaded, so it is only a fallback.
 * The id's time is read as UTC; the runner's zone may differ by hours, which
 * does not matter at day granularity.
 */
export function suiteCreatedAt(suiteId: string, fallback: Date): Date {
  const match = /(\d{4})-(\d{2})-(\d{2})[_T](\d{2})-(\d{2})-(\d{2})/.exec(suiteId);
  if (!match) {
    return fallback;
  }
  const [, y, mo, d, h, mi, s] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * The one policy rule the schema cannot express: wildcard `include` patterns
 * must start with `nightly-`, so only the automated nightlies can be admitted
 * in bulk. One-off suites need an exact ID.
 */
export function validateAllowlistPolicy(allowlist: PublicAllowlist): string[] {
  return allowlist.include
    .filter(pattern => isGlob(pattern) && !pattern.startsWith('nightly-'))
    .map(pattern => `include pattern "${pattern}" uses wildcards but does not start with "nightly-"`);
}

/** The override entry for a suite, if any. */
export function overrideFor(allowlist: PublicAllowlist, suiteId: string): { excludeGuides: string[] } | undefined {
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

function isGlob(text: string): boolean {
  return text.includes('*') || text.includes('?');
}
