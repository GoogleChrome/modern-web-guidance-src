import fs from 'node:fs';
import path from 'node:path';

/**
 * The public allowlist file (`src/harness/public/allowlist.json`). It is the
 * only input that decides which suites, models, and guides reach the public
 * copy. Shape is enforced by `assertAllowlistShape` below and documented for
 * editors in `allowlist.schema.json`.
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
  /**
   * Limits on how much history stays published. `maxAgeDays` is applied by
   * `withinMaxAge`; `maxSuitesPerAgent` and then `maxSuites` after the
   * agent/model gate so unreleased runs do not consume slots. The per-agent
   * cap keeps an agent whose recent runs are unreleased from being aged out
   * entirely by the others.
   */
  retention?: { maxAgeDays?: number; maxSuites?: number; maxSuitesPerAgent?: number };
}

export const DEFAULT_ALLOWLIST_PATH = path.join(import.meta.dirname, 'allowlist.json');

/** Suite ids and model names: anything without whitespace. */
const NON_BLANK_RE = /^\S+$/;
/** Exact suite ids: no whitespace and no glob characters. */
const EXACT_ID_RE = /^[^*?\s]+$/;
/** Guide folder names; also keeps `--guide` values out of paths they should not reach. */
const GUIDE_NAME_RE = /^[\w.-]+$/;

const TOP_LEVEL_KEYS = new Set(['$schema', 'include', 'exclude', 'overrides', 'releasedModels', 'retention']);
const REQUIRED_KEYS = ['include', 'exclude', 'overrides', 'releasedModels'] as const;
const OVERRIDE_KEYS = new Set(['id', 'excludeGuides']);
const RETENTION_KEYS = new Set(['maxAgeDays', 'maxSuites', 'maxSuitesPerAgent']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collects every way `value` departs from the allowlist shape, as
 * `<path> <problem>` strings. This is the enforced definition;
 * `allowlist.schema.json` mirrors it for editor hints only, so a rule changed
 * here should be changed there too.
 */
function shapeProblems(value: unknown): string[] {
  const problems: string[] = [];
  const report = (where: string, problem: string): void => { problems.push(`${where} ${problem}`.trim()); };

  const checkObjectKeys = (where: string, obj: Record<string, unknown>, allowed: Set<string>, required: readonly string[]): void => {
    for (const key of required) {
      if (!(key in obj)) report(where, `must have required property '${key}'`);
    }
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) report(where, `must NOT have additional properties (${JSON.stringify(key)})`);
    }
  };

  const checkStringArray = (where: string, items: unknown, pattern: RegExp, minItems = 0): void => {
    if (!Array.isArray(items)) {
      report(where, 'must be array');
      return;
    }
    if (items.length < minItems) report(where, `must NOT have fewer than ${minItems} items`);
    if (new Set(items.map(item => JSON.stringify(item))).size !== items.length) report(where, 'must NOT have duplicate items');
    items.forEach((item, i) => {
      if (typeof item !== 'string') report(`${where}/${i}`, 'must be string');
      else if (!pattern.test(item)) report(`${where}/${i}`, `must match pattern "${pattern.source}"`);
    });
  };

  if (!isRecord(value)) {
    report('/', 'must be object');
    return problems;
  }
  checkObjectKeys('/', value, TOP_LEVEL_KEYS, REQUIRED_KEYS);
  if ('$schema' in value && typeof value['$schema'] !== 'string') report('/$schema', 'must be string');
  if ('include' in value) checkStringArray('/include', value['include'], NON_BLANK_RE);
  if ('exclude' in value) checkStringArray('/exclude', value['exclude'], EXACT_ID_RE);
  if ('releasedModels' in value) checkStringArray('/releasedModels', value['releasedModels'], NON_BLANK_RE);

  if ('overrides' in value) {
    const overrides = value['overrides'];
    if (!Array.isArray(overrides)) {
      report('/overrides', 'must be array');
    } else {
      overrides.forEach((override, i) => {
        const where = `/overrides/${i}`;
        if (!isRecord(override)) {
          report(where, 'must be object');
          return;
        }
        checkObjectKeys(where, override, OVERRIDE_KEYS, ['id', 'excludeGuides']);
        if ('id' in override) {
          if (typeof override['id'] !== 'string') report(`${where}/id`, 'must be string');
          else if (!EXACT_ID_RE.test(override['id'])) report(`${where}/id`, `must match pattern "${EXACT_ID_RE.source}"`);
        }
        if ('excludeGuides' in override) checkStringArray(`${where}/excludeGuides`, override['excludeGuides'], GUIDE_NAME_RE, 1);
      });
    }
  }

  if ('retention' in value) {
    const retention = value['retention'];
    if (!isRecord(retention)) {
      report('/retention', 'must be object');
    } else {
      checkObjectKeys('/retention', retention, RETENTION_KEYS, []);
      for (const key of RETENTION_KEYS) {
        if (!(key in retention)) continue;
        const limit = retention[key];
        if (!Number.isInteger(limit)) report(`/retention/${key}`, 'must be integer');
        else if ((limit as number) < 1) report(`/retention/${key}`, 'must be >= 1');
      }
    }
  }
  return problems;
}

/** Throws listing every way `value` departs from the allowlist schema, naming `source`. */
export function assertAllowlistShape(value: unknown, source: string): void {
  const problems = shapeProblems(value);
  if (problems.length > 0) {
    throw new Error(`${source} does not match the allowlist schema:\n  - ${problems.join('\n  - ')}`);
  }
}

/** Parses allowlist JSON and checks its shape. Throws listing every violation, naming `source`. */
export function parseAllowlist(text: string, source: string): PublicAllowlist {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${source} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
  assertAllowlistShape(parsed, source);
  const { $schema: _schema, ...allowlist } = parsed as PublicAllowlist & { $schema?: string };
  return allowlist;
}

/** Parses and policy-checks allowlist JSON from any source (a file, `git show`, ...). */
export function parseValidatedAllowlist(text: string, source: string): PublicAllowlist {
  const allowlist = parseAllowlist(text, source);
  const problems = validateAllowlistPolicy(allowlist);
  if (problems.length > 0) {
    throw new Error(`${source} violates allowlist policy:\n  - ${problems.join('\n  - ')}`);
  }
  return allowlist;
}

/** Loads and policy-checks the allowlist; the one entry point every caller should use. */
export function loadValidatedAllowlist(filePath = DEFAULT_ALLOWLIST_PATH): PublicAllowlist {
  return parseValidatedAllowlist(fs.readFileSync(filePath, 'utf8'), filePath);
}

/** Suite IDs from `candidates` that match an `include` pattern and are not excluded. Sorted. */
export function selectSuites(allowlist: PublicAllowlist, candidates: readonly string[]): string[] {
  const includes = allowlist.include.map(globToRegExp);
  const excluded = new Set(allowlist.exclude);
  return candidates
    .filter(id => !excluded.has(id) && includes.some(re => re.test(id)))
    .sort();
}

/**
 * `retention.maxAgeDays` half of retention: suites no older than that (all of
 * them when unset). `maxSuites` is applied after the agent/model gate so
 * "keep 30" means 30 publishable suites rather than 30 minus unreleased runs.
 */
export function withinMaxAge<T extends { createdAt: Date }>(allowlist: PublicAllowlist, suites: readonly T[], now = new Date()): T[] {
  const { maxAgeDays } = allowlist.retention ?? {};
  if (maxAgeDays === undefined) {
    return [...suites];
  }
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return suites.filter(suite => suite.createdAt.getTime() >= cutoff);
}

/**
 * Applies `retention.maxSuitesPerAgent` and then `retention.maxSuites` to
 * publishable suites in newest-first order, returning the ones that keep a
 * slot. The per-agent cap runs first so a prolific agent cannot push another
 * agent's older suites out of the global budget.
 */
export function withinSuiteCaps<T extends { agent?: string }>(allowlist: PublicAllowlist, newestFirstSuites: readonly T[]): T[] {
  const { maxSuites, maxSuitesPerAgent } = allowlist.retention ?? {};
  const perAgent = new Map<string, number>();
  const kept: T[] = [];
  for (const suite of newestFirstSuites) {
    if (maxSuites !== undefined && kept.length >= maxSuites) {
      break;
    }
    const agent = suite.agent ?? '';
    const seen = perAgent.get(agent) ?? 0;
    if (maxSuitesPerAgent !== undefined && seen >= maxSuitesPerAgent) {
      continue;
    }
    perAgent.set(agent, seen + 1);
    kept.push(suite);
  }
  return kept;
}

/** Returns a copy sorted newest-first by `createdAt`. */
export function newestFirst<T extends { createdAt: Date }>(suites: readonly T[]): T[] {
  return [...suites].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** The run time embedded in nightly ids, e.g. `nightly-2026-10-20_20-43-48-codex_cli`. */
const SUITE_ID_TIME_RE = /(\d{4})-(\d{2})-(\d{2})[_T](\d{2})-(\d{2})-(\d{2})/;

/**
 * When a suite was run, for retention. Nightly ids embed the run time
 * (`nightly-2026-10-20_20-43-48-codex_cli`), which is stable; the bucket's
 * `timeCreated` resets if a suite is re-uploaded, so it is only a fallback.
 * The id's time is read as UTC; the runner's zone may differ by hours, which
 * does not matter at day granularity.
 */
export function suiteCreatedAt(suiteId: string, fallback: Date): Date {
  const match = SUITE_ID_TIME_RE.exec(suiteId);
  if (!match) {
    return fallback;
  }
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

/**
 * The policy rules the schema cannot express. Wildcard `include` patterns
 * must start with `nightly-`, so only the automated nightlies can be admitted
 * in bulk (one-off suites need an exact ID); and each suite has at most one
 * `overrides` entry, so there is one place to read its exclusions from.
 */
export function validateAllowlistPolicy(allowlist: PublicAllowlist): string[] {
  const problems = allowlist.include
    .filter(pattern => isGlob(pattern) && !pattern.startsWith('nightly-'))
    .map(pattern => `include pattern "${pattern}" uses wildcards but does not start with "nightly-"`);
  const seen = new Set<string>();
  for (const { id } of allowlist.overrides) {
    if (seen.has(id)) {
      problems.push(`overrides lists "${id}" more than once`);
    }
    seen.add(id);
  }
  return problems;
}

/** The override entry for a suite, if any. */
export function overrideFor(allowlist: PublicAllowlist, suiteId: string): { excludeGuides: string[] } | undefined {
  return allowlist.overrides.find(entry => entry.id === suiteId);
}

/**
 * True when a suite is an explicit non-scheduled (baseline/curated) run admitted by the allowlist.
 */
export function isCuratedSuite(suiteId: string, allowlist?: PublicAllowlist): boolean {
  if (allowlist && !allowlist.include.includes(suiteId)) {
    return false;
  }
  return !/^(nightly|weekly)-/i.test(suiteId);
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
