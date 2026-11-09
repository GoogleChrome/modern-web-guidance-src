import { Agents } from '../config.ts';
import { calculateMetrics } from '../lib/metrics.ts';
import type { EvalsReport, RunResult, ScenarioCheck } from '../lib/metrics.ts';
import { sanitizeReasoningEffort } from '../lib/reasoning-effort.ts';
import type { ReasoningEffort } from '../lib/reasoning-effort.ts';
import { assertClean, scrubValue } from './scrub.ts';
import type { LeakOptions } from './scrub.ts';

/**
 * What of a suite is public, and how its public `evals.json` is built.
 *
 * The field allowlists below decide what may be copied out of a raw report;
 * everything not listed stays private, so a field added to the harness later
 * defaults to private until it is listed here. `assertPublishable` gates the
 * suite on agent and released model, `withoutGuides` applies an
 * `excludeGuides` override, and `rebuildEvals` assembles the result with
 * `summary` and `stats` recomputed from the published runs only, so they can
 * never carry data from runs that were left out.
 *
 * `rebuildEvals` throws rather than returning anything that must not be published:
 *  - `NotPublishableError` for a non-public agent or unreleased model
 *  - `LeakError` if any identifying string survives scrubbing
 *  - `OverrideError` if a result key is malformed or `excludeGuides` names a
 *    guide the suite does not contain
 */

// --- Field allowlists and the agent/model gate ---

/** Agents whose runs may appear publicly. */
export const PUBLIC_AGENTS: ReadonlySet<string> = new Set<string>([
  Agents.CLAUDE_CODE,
  Agents.CODEX_CLI,
  Agents.ANTIGRAVITY_CLI,
]);

/** Suite-level fields copied from `evals.json`. `summary` and `stats` are recomputed, not copied. */
export const PUBLIC_SUITE_FIELDS = [
  'timestamp',
  'agent',
  'model',
  'totalRuntime',
] as const;

/** Per-run fields copied from each entry in `evals.json#results`. `runtime` and `tokenUsage` are picked field-by-field. */
export const PUBLIC_RUN_FIELDS = [
  'runNumber',
  'baseApp',
  'taskName',
  'guideName',
  'discipline',
  'prompt',
  'guidesUsed',
  'guidanceToolsUsed',
  'retrievedGuides',
  'fileReadGuides',
  'expectedToolPrefixes',
] as const;

/** Per-assertion fields copied from each run's `results` array. */
export const PUBLIC_ASSERTION_FIELDS = [
  'id',
  'passed',
  'message',
  'isEarlyFailure',
  'failureReason',
  'error',
  'errorLocation',
  'pageSnapshot',
  'browserErrors',
] as const;

/**
 * Why a suite was not published. Safe to persist and publish; the message is
 * not. `suite-id` means the id itself failed the leak check, so it must not be
 * recorded anywhere either.
 */
export type SkipCode = 'non-public-agent' | 'unreleased-model' | 'leak' | 'suite-id' | 'override' | 'no-evals';

/** Thrown when a suite must not be published at all (wrong agent or unreleased model). */
export class NotPublishableError extends Error {
  readonly code: SkipCode;

  constructor(code: SkipCode, reason: string) {
    super(reason);
    this.name = 'NotPublishableError';
    this.code = code;
  }
}

/**
 * Throws `NotPublishableError` unless the suite ran with a public agent and a
 * released model. `releasedModels` is supplied by the caller rather than fixed
 * in code so a model can be released through configuration.
 */
export function assertPublishable(
  suite: { agent?: string; model?: string },
  releasedModels: readonly string[],
): void {
  if (suite.agent === undefined || !PUBLIC_AGENTS.has(suite.agent)) {
    throw new NotPublishableError('non-public-agent', `agent ${JSON.stringify(suite.agent)} is not public`);
  }
  if (suite.model === undefined || !releasedModels.includes(suite.model)) {
    throw new NotPublishableError('unreleased-model', `model ${JSON.stringify(suite.model)} is not on the released-models list`);
  }
}

// --- Guide-level overrides ---

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
 * The guide a result key belongs to. Prefers the structured `guideName` the
 * harness records on each run; falls back to the key, which the harness writes
 * as `${task} - ${guide} - ${runType}` (see `collection.ts`), so the guide is
 * the middle part. Throws on any other shape rather than guessing, so a
 * malformed entry cannot slip past an exclusion.
 */
export function guideOfResultKey(key: string, runs: readonly RunResult[] = []): string {
  const recorded = runs[0]?.guideName;
  if (recorded) {
    return recorded;
  }
  const parts = key.split(' - ');
  if (parts.length !== 3) {
    throw new OverrideError(`Malformed result key (expected "<task> - <guide> - <runType>"): ${JSON.stringify(key)}`);
  }
  return parts[1];
}

/**
 * Returns a copy of `results` without any scenario belonging to a guide in
 * `guides`. Throws `OverrideError` if a listed guide matches nothing, since
 * that almost always means a typo and silently publishing would defeat the point.
 */
export function withoutGuides(results: ResultsByKey, guides: readonly string[]): ResultsByKey {
  const excluded = new Set(guides);
  const matched = new Set<string>();
  const kept: ResultsByKey = {};

  for (const [key, runs] of Object.entries(results)) {
    const guide = guideOfResultKey(key, runs);
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

// --- Rebuilding evals.json ---

export interface RebuildOptions {
  /** Models that may be published. */
  releasedModels: readonly string[];
  /** Guides to leave out entirely. */
  excludeGuides?: readonly string[];
  /** Extra tokens (e.g. operator LDAPs) that must not appear anywhere in the output. */
  forbiddenTokens?: LeakOptions['forbiddenTokens'];
}

type SuiteField = (typeof PUBLIC_SUITE_FIELDS)[number];
type RunField = (typeof PUBLIC_RUN_FIELDS)[number];
type AssertionField = (typeof PUBLIC_ASSERTION_FIELDS)[number];

/** The shape of a published `evals.json`. */
export type PublicEvals = Pick<EvalsReport, SuiteField | 'summary' | 'stats'> & {
  reasoningEffort?: ReasoningEffort;
  results: Record<string, PublicRun[]>;
};

export type PublicRun = Pick<RunResult, RunField> & {
  results: PublicCheck[];
  runtime?: { agentRuntime?: number; graderRuntime?: number };
  tokenUsage?: { total: number; cached: number };
  /** Public artifact names written next to this run (never copied from the raw run). */
  files?: string[];
};

export type PublicCheck = Pick<ScenarioCheck, AssertionField>;

/** Returns a new, scrubbed, allowlist-only copy of `raw`. Never mutates its input. */
export function rebuildEvals(raw: EvalsReport, options: RebuildOptions): PublicEvals {
  assertPublishable(raw, options.releasedModels);

  const keptResults = withoutGuides(raw.results, options.excludeGuides ?? []);
  const runsPerTest = raw.summary?.runsPerTest ?? raw.runCount;
  const metrics = calculateMetrics(keptResults, runsPerTest);

  const results: Record<string, PublicRun[]> = {};
  for (const [key, runs] of Object.entries(keptResults)) {
    results[key] = runs.map(rebuildRun);
  }

  const reasoningEffort = sanitizeReasoningEffort(raw.reasoningEffort);

  const rebuilt = scrubValue<PublicEvals>({
    ...pickFields(raw, PUBLIC_SUITE_FIELDS),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    summary: metrics.summary,
    stats: metrics.testStats,
    results,
  });

  assertClean(rebuilt, `public evals for ${raw.agent}/${raw.model} @ ${raw.timestamp}`, {
    forbiddenTokens: options.forbiddenTokens,
  });
  return rebuilt;
}

function rebuildRun(run: RunResult): PublicRun {
  const publicRun: PublicRun = {
    ...pickFields(run, PUBLIC_RUN_FIELDS),
    results: run.results.map(check => pickFields(check, PUBLIC_ASSERTION_FIELDS)),
  };
  if (run.runtime) {
    publicRun.runtime = pickFields(run.runtime, ['agentRuntime', 'graderRuntime']);
  }
  if (run.tokenUsage) {
    publicRun.tokenUsage = pickFields(run.tokenUsage, ['total', 'cached']);
  }
  return publicRun;
}

/** Copies only `fields` from `source`, skipping fields that are `undefined` or `null` so the output stays compact. */
function pickFields<T extends object, K extends keyof T>(source: T, fields: readonly K[]): Pick<T, K> {
  const picked = {} as Pick<T, K>;
  for (const field of fields) {
    const value = source[field];
    if (value !== undefined && value !== null) {
      picked[field] = value;
    }
  }
  return picked;
}
