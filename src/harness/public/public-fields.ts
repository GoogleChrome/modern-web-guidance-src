import { Agents } from '../config.ts';

/**
 * Allowlists that decide what the public builder may publish. Everything not
 * listed here is left behind. Prefer adding to these lists over adding
 * denylists elsewhere, so new fields default to private.
 */

/** Agents whose runs may appear on the public dashboard. */
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

/** Thrown when a suite must not be published at all (wrong agent or unreleased model). */
export class NotPublishableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'NotPublishableError';
  }
}

/**
 * Throws `NotPublishableError` unless the suite ran with a public agent and a
 * released model. `releasedModels` is supplied by the caller (it lives in the
 * allowlist file, not in code, so a release can be added without a deploy).
 */
export function assertPublishable(
  suite: { agent?: string; model?: string },
  releasedModels: readonly string[],
): void {
  if (suite.agent === undefined || !PUBLIC_AGENTS.has(suite.agent)) {
    throw new NotPublishableError(`agent ${JSON.stringify(suite.agent)} is not public`);
  }
  if (suite.model === undefined || !releasedModels.includes(suite.model)) {
    throw new NotPublishableError(`model ${JSON.stringify(suite.model)} is not on the released-models list`);
  }
}
