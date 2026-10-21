import { calculateMetrics } from '../lib/metrics.ts';
import type { EvalsReport, RunResult, ScenarioCheck } from '../lib/metrics.ts';
import {
  assertPublishable,
  PUBLIC_ASSERTION_FIELDS,
  PUBLIC_RUN_FIELDS,
  PUBLIC_SUITE_FIELDS,
} from './allowlists.ts';
import { withoutGuides } from './overrides.ts';
import { assertClean, scrubValue } from './scrub.ts';
import type { LeakOptions } from './scrub.ts';

/**
 * Builds the public `evals.json` for a suite.
 *
 * The output is constructed from allowlisted fields rather than by deleting
 * keys from the raw report, so any field added to the harness later stays
 * private until it is listed in `allowlists.ts`. `summary` and `stats` are
 * always recomputed from the published runs with the harness's own metrics
 * code, so they can never carry data from runs that were left out.
 *
 * Throws rather than returning anything that must not be published:
 *  - `NotPublishableError` for a non-public agent or unreleased model
 *  - `LeakError` if any identifying string survives scrubbing
 *  - `Error` if `excludeGuides` names a guide the suite does not contain
 */

export interface RebuildOptions {
  /** Models that may be published. Comes from the allowlist file. */
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
  results: Record<string, PublicRun[]>;
};

export type PublicRun = Pick<RunResult, RunField> & {
  results: PublicCheck[];
  runtime?: { agentRuntime?: number; graderRuntime?: number };
  tokenUsage?: { total: number; cached: number };
  /** Public artifact names written next to this run (set by the builder, never copied from the raw run). */
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

  const rebuilt = scrubValue<PublicEvals>({
    ...pickFields(raw, PUBLIC_SUITE_FIELDS),
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
    results: (run.results ?? []).map(check => pickFields(check, PUBLIC_ASSERTION_FIELDS)),
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
