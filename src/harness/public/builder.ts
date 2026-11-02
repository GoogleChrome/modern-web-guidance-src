import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { mapWithConcurrency } from '../../core/concurrency.ts';
import { baseAppsDir as defaultBaseAppsDir } from '../../core/paths.ts';
import { extractSuiteSummary } from '../../dashboard/summary-extractor.js';
import type { SuiteSummary } from '../../dashboard/summary-extractor.js';
import type { EvalsReport, RunResult } from '../lib/metrics.ts';
import {
  applyPendingChanges,
  newestFirst,
  overrideFor,
  PENDING_CHANGE_TTL_MS,
  selectSuites,
  suiteCreatedAt,
  withinMaxAge,
} from './allowlist.ts';
import type { PendingChange, PublicAllowlist } from './allowlist.ts';
import { OverrideError } from './overrides.ts';
import { EXCLUDED_PATH_RE, MAX_PATCH_BYTES, patchFromFiles, preparePatch } from './patch.ts';
import type { PreparedPatch } from './patch.ts';
import {
  assertPublishable,
  NotPublishableError,
  PUBLIC_AGENTS,
  PUBLIC_ASSERTION_FIELDS,
  PUBLIC_RUN_FIELDS,
  PUBLIC_SUITE_FIELDS,
} from './public-fields.ts';
import type { SkipCode } from './public-fields.ts';
import { rebuildEvals } from './rebuild-evals.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { assertClean, harvestUserSegments, harvestUserSegmentsIn, LEAK_PATTERNS, LeakError, scrubString } from './scrub.ts';
import type { SuiteRef, SuiteStore } from './suite-store.ts';

/**
 * Builds the public copy of eval suites: `public-evals/<suiteId>/evals.json`
 * plus, per run, `agent.patch` and `modern-web.log`, and a `suites.gen.json`
 * manifest over everything built. Each suite is independent; one failing suite
 * is reported and skipped without affecting the others.
 *
 * Builds are incremental: `build-state.json` records which raw generation and
 * overrides each published suite was built from, and unchanged suites are left
 * alone. Raw nightlies are immutable once uploaded, so in steady state an
 * incremental run costs one listing call plus whatever is new.
 *
 * `build-state.json` is published along with everything else, so it holds
 * only suite ids, generations, guide names, reason *codes*, the released
 * model list, and pending allowlist changes; never error messages, which can
 * quote what they rejected.
 */

/** Directory name under the output root. Served at the same path on GitHub Pages. */
export const PUBLIC_EVALS_DIR = 'public-evals';

/**
 * Bump when output-shaping *logic* changes (scrubbing replacements, patch
 * preparation, summary extraction) in a way that should rebuild every suite.
 * Field lists and patterns are hashed in automatically below.
 */
const OUTPUT_REVISION = 1;

/**
 * Identifies the public output contract. Derived from the rules that shape the
 * output, so changing any of them rebuilds every suite once without anyone
 * remembering to bump a number.
 */
const BUILDER_VERSION = crypto
  .createHash('sha1')
  .update(JSON.stringify({
    revision: OUTPUT_REVISION,
    suite: PUBLIC_SUITE_FIELDS,
    run: PUBLIC_RUN_FIELDS,
    assertion: PUBLIC_ASSERTION_FIELDS,
    agents: [...PUBLIC_AGENTS].sort(),
    leaks: LEAK_PATTERNS.map(pattern => pattern.re.source),
    excludedPaths: EXCLUDED_PATH_RE.source,
    maxPatchBytes: MAX_PATCH_BYTES,
  }))
  .digest('hex')
  .slice(0, 12);

/** How many suites are built at once, and how many of one suite's runs are fetched at once. */
const SUITE_CONCURRENCY = 4;
const RUN_CONCURRENCY = 32;

const STATE_FILE = 'build-state.json';
const MANIFEST_FILE = 'suites.gen.json';
/** Sibling of `public-evals/` where a suite is assembled before being swapped in. Never published. */
const STAGING_DIR = 'public-evals-staging';

export interface BuildOptions {
  store: SuiteStore;
  /** Output root; suites are written under `<outDir>/public-evals/`. */
  outDir: string;
  allowlist: PublicAllowlist;
  /** Where to find base apps for legacy-layout diffs. Defaults to the repo's. */
  baseAppsDir?: string;
  /** Tokens (e.g. operator LDAPs) that must not appear anywhere in the output. */
  forbiddenTokens?: readonly string[];
  /**
   * Bump (via `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION`) when the token list
   * changes, so already-built suites are rescanned. The tokens themselves are
   * never written to state.
   */
  forbiddenTokensVersion?: number;
  /** Rebuild every selected suite even if its recorded state matches. */
  force?: boolean;
  /** Reference clock for retention and pending-change expiry (tests). */
  now?: Date;
  /** Called with pending changes dropped because their TTL elapsed. */
  onExpiredPending?: (expired: PendingChange[]) => void;
}

export interface SuiteBuildResult {
  suiteId: string;
  status: 'built' | 'skipped' | 'failed' | 'unchanged' | 'removed';
  /** Machine-readable reason for `skipped`; the only reason that is persisted. */
  code?: SkipCode;
  /** Human-readable reason for `skipped` or `failed`. May quote rejected data; console only. */
  reason?: string;
  files: number;
  bytes: number;
  truncatedPatches: number;
  /** Manifest entry, for built suites. */
  summary?: SuiteSummary;
}

/** What each selected suite was last built (or skipped) from. */
interface BuildState {
  builderVersion: string;
  forbiddenTokensVersion: number;
  suites: Record<string, SuiteState>;
  /** Allowlist changes applied directly to the site whose PR has not merged yet; see `PendingChange`. */
  pending: PendingChange[];
}

/** The allowlist inputs a suite's outcome depends on, so a change to any of them rebuilds it. */
interface SuiteState {
  generation: string;
  excludeGuides: string[];
  /** Releasing a model lets a skipped suite publish; un-releasing one must take a published suite down. */
  releasedModels: string[];
  /** Present when the suite was skipped. */
  skipped?: { code: SkipCode };
  /** Publishable, but outside `retention.maxSuites`; remembered so it is not re-fetched to find that out. */
  deferred?: true;
}

/**
 * Builds every suite the allowlist selects (minus retention), removes suites
 * that are no longer selected, and rewrites the manifest. Pending allowlist
 * changes recorded in the output's state are layered over the allowlist first.
 * Throws only if nothing at all could be done; per-suite problems come back
 * as `skipped` or `failed` results.
 */
export async function buildSelectedSuites(options: BuildOptions): Promise<SuiteBuildResult[]> {
  const now = options.now ?? new Date();
  const refs = await options.store.listSuites();
  const refById = new Map(refs.map(ref => [ref.id, ref]));
  const state = readState(options.outDir);
  const { allowlist, pending, expired } = applyPendingChanges(options.allowlist, state.pending, now);
  if (expired.length > 0) {
    options.onExpiredPending?.(expired);
  }
  const effective: BuildOptions = { ...options, allowlist };

  const eligible = selectSuites(allowlist, refs.map(ref => ref.id))
    .map(id => ({ id, createdAt: suiteCreatedAt(id, refById.get(id)!.createdAt) }));
  const candidates = newestFirst(withinMaxAge(allowlist, eligible, now)).map(suite => suite.id);

  // `maxSuites` counts suites that can actually be published, so gate first (from state when
  // nothing changed, otherwise by reading evals.json), then take the newest N. A suite that
  // already has a published copy on disk and hit a transient gate error keeps its slot so an
  // older suite is not built for one run only to be deleted on the next.
  const gated = await mapWithConcurrency(candidates, SUITE_CONCURRENCY, suiteId =>
    publishability(suiteId, refById.get(suiteId)!, state, effective));
  const results: SuiteBuildResult[] = [];
  const slotHolders: Array<{ suiteId: string; report: EvalsReport | undefined; failed: boolean }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const suiteId = candidates[i];
    const outcome = gated[i];
    if (outcome.publishable) {
      slotHolders.push({ suiteId, report: outcome.report, failed: false });
    } else {
      results.push(outcome.result);
      if (outcome.result.status === 'failed' && hasEvals(options.outDir, suiteId)) {
        slotHolders.push({ suiteId, report: undefined, failed: true });
      }
    }
  }

  const maxSuites = allowlist.retention?.maxSuites;
  const selected = maxSuites === undefined ? slotHolders : slotHolders.slice(0, maxSuites);
  const deferred = slotHolders
    .slice(selected.length)
    .filter(slot => !slot.failed)
    .map(slot => slot.suiteId);
  const toBuild = selected.filter(slot => !slot.failed);

  results.push(...await mapWithConcurrency(toBuild, SUITE_CONCURRENCY, async ({ suiteId, report }) => {
    const ref = refById.get(suiteId)!;
    const previous = options.force ? undefined : unchangedOutcome(state, ref, effective);
    return previous ?? buildSuite(suiteId, effective, report);
  }));

  // Anything on disk outside `selected` goes; a selected suite whose build failed this run
  // keeps its previously published copy (and manifest entry) until a later run replaces it.
  const resultFor = new Map(results.map(result => [result.suiteId, result]));
  const keep = new Set(selected.map(suite => suite.suiteId));
  for (const suiteId of presentSuiteDirs(options.outDir)) {
    const existing = resultFor.get(suiteId);
    if (keep.has(suiteId)) {
      continue;
    }
    const wasPublished = hasEvals(options.outDir, suiteId);
    fs.rmSync(path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId), { recursive: true, force: true });
    if (wasPublished && !existing) {
      results.push({ suiteId, status: 'removed', files: 0, bytes: 0, truncatedPatches: 0 });
    }
  }

  // Manifest first: if it trips the leak check the state is not advanced, so the run is redone.
  writeManifest(options.outDir, results, effective.forbiddenTokens);
  writeState(options.outDir, results, deferred, refById, effective, pending);
  fs.rmSync(path.join(options.outDir, STAGING_DIR), { recursive: true, force: true });
  return results;
}

type GateOutcome =
  | { publishable: true; report: EvalsReport | undefined }
  | { publishable: false; result: SuiteBuildResult };

function notBuiltResult(suiteId: string, status: 'skipped' | 'failed', reason: string, code?: SkipCode): SuiteBuildResult {
  return { suiteId, status, code, reason, files: 0, bytes: 0, truncatedPatches: 0 };
}

/**
 * Whether a suite passes the suite-id and agent/model gates, or the
 * `skipped`/`failed` result to report instead. The id is checked before
 * anything else so a leaking id is never recorded, deferred, or fetched.
 * The model gate is answered from state when the suite's inputs have not
 * changed, otherwise by reading its `evals.json`.
 */
async function publishability(
  suiteId: string,
  ref: SuiteRef,
  state: BuildState,
  options: BuildOptions,
): Promise<GateOutcome> {
  const leakyId = suiteIdRejection(suiteId, options);
  if (leakyId) {
    return { publishable: false, result: leakyId };
  }
  const recorded = state.suites[suiteId];
  if (recorded && !options.force && !stale(recorded, state, ref, options)) {
    if (!recorded.skipped) {
      return { publishable: true, report: undefined };
    }
    return {
      publishable: false,
      result: notBuiltResult(suiteId, 'skipped', `remembered: ${recorded.skipped.code}`, recorded.skipped.code),
    };
  }
  try {
    const report = await readReport(suiteId, options.store);
    if (report === undefined) {
      return { publishable: false, result: notBuiltResult(suiteId, 'skipped', 'no evals.json', 'no-evals') };
    }
    assertPublishable(report, options.allowlist.releasedModels);
    return { publishable: true, report };
  } catch (err) {
    if (err instanceof NotPublishableError) {
      return { publishable: false, result: notBuiltResult(suiteId, 'skipped', err.message, err.code) };
    }
    return { publishable: false, result: notBuiltResult(suiteId, 'failed', err instanceof Error ? err.message : String(err)) };
  }
}

/** The `skipped` result for a suite whose id itself would leak, or undefined when the id is clean. */
function suiteIdRejection(suiteId: string, options: BuildOptions): SuiteBuildResult | undefined {
  try {
    assertClean(suiteId, `suite id ${suiteId}`, { forbiddenTokens: options.forbiddenTokens });
    return undefined;
  } catch (err) {
    if (err instanceof LeakError) {
      return notBuiltResult(suiteId, 'skipped', err.message, 'suite-id');
    }
    throw err;
  }
}

async function readReport(suiteId: string, store: SuiteStore): Promise<EvalsReport | undefined> {
  const rawText = await store.readFile(`${suiteId}/evals.json`);
  return rawText === undefined ? undefined : JSON.parse(rawText.toString('utf8')) as EvalsReport;
}

/**
 * Builds one suite into `<outDir>/public-evals/<suiteId>/`. Never throws:
 * expected rejections come back as `skipped` (with a code), anything else as
 * `failed` (not remembered, so it is retried). Output is assembled in a
 * staging directory and swapped in only once complete, so a failure leaves
 * whatever was published before in place. Pass `preloaded` when the raw
 * report has already been read (the gate does) to skip a second download.
 *
 * Usernames embedded in raw paths across `evals.json`, `agent.patch`, and
 * `modern-web.log` are harvested before scrubbing and added to this suite's
 * forbidden tokens so a bare occurrence of the same name elsewhere in the
 * suite cannot slip through.
 */
export async function buildSuite(suiteId: string, options: BuildOptions, preloaded?: EvalsReport): Promise<SuiteBuildResult> {
  const suiteDir = path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId);
  const stagingDir = path.join(options.outDir, STAGING_DIR, suiteId);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  try {
    const leakyId = suiteIdRejection(suiteId, options);
    if (leakyId) {
      return leakyId;
    }

    const raw = preloaded ?? await readReport(suiteId, options.store);
    if (raw === undefined) {
      return notBuiltResult(suiteId, 'skipped', 'no evals.json', 'no-evals');
    }

    const suiteTokens = new Set<string>(options.forbiddenTokens ?? []);
    for (const user of harvestUserSegmentsIn(raw)) {
      suiteTokens.add(user);
    }
    const extraArtifactTokens = new Set<string>();
    const harvestArtifact = (text: string): void => {
      for (const user of harvestUserSegments(text)) {
        if (!suiteTokens.has(user)) {
          suiteTokens.add(user);
          extraArtifactTokens.add(user);
        }
      }
    };
    const currentTokens = (): string[] => [...suiteTokens];

    const override = overrideFor(options.allowlist, suiteId);
    const evals = rebuildEvals(raw, {
      releasedModels: options.allowlist.releasedModels,
      excludeGuides: override?.excludeGuides,
      forbiddenTokens: currentTokens(),
    });

    const writer = new SuiteWriter(stagingDir, currentTokens);

    const runs = Object.entries(evals.results).flatMap(([key, publicRuns]) =>
      publicRuns.map((publicRun, i) => ({ publicRun, rawRun: raw.results[key][i], runPath: runRelativePath(key, raw.results[key][i].runNumber) })),
    );
    await mapWithConcurrency(runs, RUN_CONCURRENCY, async ({ publicRun, rawRun, runPath }) => {
      publicRun.files = await writeRunArtifacts(suiteId, runPath, rawRun, options, harvestArtifact, writer);
    });

    if (extraArtifactTokens.size > 0) {
      writer.recheck([...extraArtifactTokens]);
    }
    writer.writeJson('evals.json', evals);
    fs.rmSync(suiteDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(suiteDir), { recursive: true });
    fs.renameSync(stagingDir, suiteDir);
    const summary = extractSuiteSummary(suiteId, evals) ?? undefined;
    return { suiteId, status: 'built', ...writer.totals(), summary };
  } catch (err) {
    if (err instanceof NotPublishableError || err instanceof LeakError || err instanceof OverrideError) {
      // A policy rejection is not transient: whatever was published before must go too.
      fs.rmSync(suiteDir, { recursive: true, force: true });
    }
    if (err instanceof NotPublishableError) {
      return notBuiltResult(suiteId, 'skipped', err.message, err.code);
    }
    if (err instanceof LeakError) {
      return notBuiltResult(suiteId, 'skipped', err.message, 'leak');
    }
    if (err instanceof OverrideError) {
      return notBuiltResult(suiteId, 'skipped', err.message, 'override');
    }
    return notBuiltResult(suiteId, 'failed', err instanceof Error ? err.message : String(err));
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

/**
 * Rewrites `<outDir>/public-evals/suites.gen.json` so it lists exactly the
 * complete suite directories present. Entries come from this run's results
 * when available, then from the previous manifest, and only as a last resort
 * from re-reading a suite's `evals.json`. Throws `LeakError` rather than
 * writing a manifest that still identifies someone.
 */
export function writeManifest(outDir: string, results: readonly SuiteBuildResult[], forbiddenTokens?: readonly string[]): number {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.mkdirSync(root, { recursive: true });

  const fresh = new Map(results.filter(r => r.summary).map(r => [r.suiteId, r.summary!]));
  const previous = readManifest(outDir);

  const entries = presentSuiteDirs(outDir)
    .filter(id => hasEvals(outDir, id))
    .map(id => fresh.get(id) ?? previous.get(id) ?? summarizeFromDisk(root, id))
    .filter((summary): summary is SuiteSummary => summary !== null)
    .sort((a, b) => a.testId.localeCompare(b.testId));
  assertClean(entries, MANIFEST_FILE, { forbiddenTokens });

  // Compact: at hundreds of suites the manifest is the largest thing the landing page fetches.
  fs.writeFileSync(path.join(root, MANIFEST_FILE), JSON.stringify(entries) + '\n');
  return entries.length;
}

/**
 * Layers any active pending changes recorded in `<outDir>/public-evals/build-state.json`
 * over `allowlist`, returning the effective allowlist plus active and expired entries.
 */
export function effectiveAllowlist(
  allowlist: PublicAllowlist,
  outDir: string,
  now = new Date(),
): { allowlist: PublicAllowlist; pending: PendingChange[]; expired: PendingChange[] } {
  return applyPendingChanges(allowlist, readStateFile(outDir).pending, now);
}

/**
 * Records a pending allowlist change in the output's build state so later
 * builds keep applying it until the checked-in allowlist reflects it (or its
 * TTL expires). A `promote` or whole-suite `unpublish` replaces earlier
 * entries for that suite; guide-level `unpublish` entries for the same suite
 * merge their guide lists instead of overwriting each other, while an existing
 * whole-suite `unpublish` continues to hide the entire suite.
 */
export function addPendingChange(outDir: string, change: PendingChange, now = new Date()): void {
  const state = readStateFile(outDir);
  const active = state.pending.filter(entry => now.getTime() - Date.parse(entry.createdAt) <= PENDING_CHANGE_TTL_MS);
  const others = active.filter(entry => entry.suiteId !== change.suiteId);
  const sameSuite = active.filter(entry => entry.suiteId === change.suiteId);

  let updatedForSuite: PendingChange[];
  if (change.command === 'promote' || change.guides.length === 0) {
    updatedForSuite = [change];
  } else if (sameSuite.some(entry => entry.command === 'unpublish' && entry.guides.length === 0)) {
    updatedForSuite = sameSuite;
  } else {
    const priorPromote = sameSuite.find(entry => entry.command === 'promote');
    const priorGuides = sameSuite.filter(entry => entry.command === 'unpublish').flatMap(entry => entry.guides);
    const merged: PendingChange = {
      command: 'unpublish',
      suiteId: change.suiteId,
      guides: [...new Set([...priorGuides, ...change.guides])],
      createdAt: change.createdAt,
    };
    updatedForSuite = priorPromote ? [priorPromote, merged] : [merged];
  }

  state.pending = [...others, ...updatedForSuite];
  writeStateFile(outDir, state);
}

/** Active pending changes a build in `outDir` would still apply on top of the allowlist. */
export function pendingChanges(outDir: string, now = new Date()): PendingChange[] {
  return readStateFile(outDir).pending.filter(
    entry => now.getTime() - Date.parse(entry.createdAt) <= PENDING_CHANGE_TTL_MS,
  );
}

/**
 * The `forbiddenTokensVersion` recorded in `outDir`'s build state, or
 * `undefined` when no suites have been recorded yet. Callers updating an
 * existing published site check this before running so they do not rescrub
 * already-published suites under a mismatched version.
 */
export function publishedForbiddenTokensVersion(outDir: string): number | undefined {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const state = readStateFile(outDir);
  return Object.keys(state.suites).length === 0 ? undefined : state.forbiddenTokensVersion;
}

/**
 * `<run>/<guide>/<task>/<guided|unguided>`, the layout both the harness and the
 * dashboard use. Throws if any segment could escape the suite directory or
 * is not a plain name, since the key comes from data in the bucket.
 */
export function runRelativePath(resultKey: string, runNumber: number): string {
  const [task, guide, runType] = resultKey.split(' - ');
  const segments = [String(runNumber), guide, task, runType];
  for (const segment of segments) {
    if (segment === undefined || segment === '.' || segment === '..' || !/^[\w.-]+$/.test(segment)) {
      throw new Error(`Unsafe path segment ${JSON.stringify(segment)} in result key ${JSON.stringify(resultKey)}, run ${runNumber}`);
    }
  }
  return segments.join('/');
}

// --- Incremental state ---

/** The recorded `unchanged` outcome for a publishable suite when nothing that feeds it has changed; otherwise undefined. */
function unchangedOutcome(state: BuildState, ref: SuiteRef, options: BuildOptions): SuiteBuildResult | undefined {
  const recorded = state.suites[ref.id];
  if (!recorded || recorded.deferred || recorded.skipped || stale(recorded, state, ref, options)) {
    return undefined;
  }
  return { suiteId: ref.id, status: 'unchanged', files: 0, bytes: 0, truncatedPatches: 0 };
}

/** True when any input that fed the recorded outcome has changed since. */
function stale(recorded: SuiteState, state: BuildState, ref: SuiteRef, options: BuildOptions): boolean {
  return (
    state.builderVersion !== BUILDER_VERSION ||
    state.forbiddenTokensVersion !== (options.forbiddenTokensVersion ?? 0) ||
    recorded.generation !== ref.generation ||
    !sameSet(recorded.excludeGuides, overrideFor(options.allowlist, ref.id)?.excludeGuides ?? []) ||
    !sameSet(recorded.releasedModels, options.allowlist.releasedModels)
  );
}

function emptyState(): BuildState {
  return { builderVersion: BUILDER_VERSION, forbiddenTokensVersion: 0, suites: {}, pending: [] };
}

function readStateFile(outDir: string): BuildState {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE);
  if (!fs.existsSync(file)) {
    return emptyState();
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<BuildState>;
  return { ...emptyState(), ...parsed, pending: parsed.pending ?? [], suites: parsed.suites ?? {} };
}

function writeStateFile(outDir: string, state: BuildState): void {
  fs.mkdirSync(path.join(outDir, PUBLIC_EVALS_DIR), { recursive: true });
  fs.writeFileSync(path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE), JSON.stringify(state, null, 2) + '\n');
}

/** State for this run: built entries whose directory is gone are dropped so a manual delete forces a rebuild. */
function readState(outDir: string): BuildState {
  const state = readStateFile(outDir);
  const present = new Set(presentSuiteDirs(outDir).filter(id => hasEvals(outDir, id)));
  state.suites = Object.fromEntries(
    Object.entries(state.suites).filter(([id, suite]) => suite.skipped || suite.deferred || present.has(id)),
  );
  return state;
}

/** Written once at the end; a crash mid-run only means the unfinished suites rebuild next time. */
function writeState(
  outDir: string,
  results: readonly SuiteBuildResult[],
  deferred: readonly string[],
  refById: Map<string, SuiteRef>,
  options: BuildOptions,
  pending: PendingChange[],
): void {
  const next: BuildState = {
    builderVersion: BUILDER_VERSION,
    forbiddenTokensVersion: options.forbiddenTokensVersion ?? 0,
    suites: {},
    pending,
  };
  const entryFor = (suiteId: string, ref: SuiteRef): SuiteState => ({
    generation: ref.generation,
    excludeGuides: overrideFor(options.allowlist, suiteId)?.excludeGuides ?? [],
    releasedModels: [...options.allowlist.releasedModels].sort(),
  });
  for (const result of results) {
    const ref = refById.get(result.suiteId);
    if (!ref || result.status === 'removed' || result.status === 'failed') {
      continue;
    }
    // A suite whose own id tripped the leak check is not recorded: the key would be the leak.
    if (result.status === 'skipped' && (!result.code || result.code === 'suite-id')) {
      continue;
    }
    const entry = entryFor(result.suiteId, ref);
    if (result.status === 'skipped' && result.code) {
      entry.skipped = { code: result.code };
    }
    next.suites[result.suiteId] = entry;
  }
  for (const suiteId of deferred) {
    next.suites[suiteId] = { ...entryFor(suiteId, refById.get(suiteId)!), deferred: true };
  }
  writeStateFile(outDir, next);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedB = [...b].sort();
  return [...a].sort().every((value, i) => value === sortedB[i]);
}

// --- Manifest helpers ---

/** Every directory under `public-evals/`, complete or not. */
function presentSuiteDirs(outDir: string): string[] {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
}

/** `evals.json` is written last, so its presence marks a complete suite directory. */
function hasEvals(outDir: string, suiteId: string): boolean {
  return fs.existsSync(path.join(outDir, PUBLIC_EVALS_DIR, suiteId, 'evals.json'));
}

function readManifest(outDir: string): Map<string, SuiteSummary> {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, MANIFEST_FILE);
  if (!fs.existsSync(file)) {
    return new Map();
  }
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as SuiteSummary[];
  return new Map(entries.map(entry => [entry.testId, entry]));
}

function summarizeFromDisk(root: string, suiteId: string): SuiteSummary | null {
  const evals = JSON.parse(fs.readFileSync(path.join(root, suiteId, 'evals.json'), 'utf8')) as PublicEvals;
  return extractSuiteSummary(suiteId, evals);
}

// --- Per-run artifacts ---

/** Writes the per-run public artifacts and returns their names. */
async function writeRunArtifacts(
  suiteId: string,
  runPath: string,
  rawRun: RunResult,
  options: BuildOptions,
  harvestArtifact: (text: string) => void,
  writer: SuiteWriter,
): Promise<string[]> {
  const files: string[] = [];

  const patch = await publicPatchFor(suiteId, runPath, rawRun, options, harvestArtifact);
  if (patch && patch.text.length > 0) {
    writer.writeText(`${runPath}/agent.patch`, patch.text, patch.truncated);
    files.push('agent.patch');
  }

  const log = await options.store.readFile(`${suiteId}/${runPath}/modern-web.log`);
  if (log !== undefined) {
    const rawLog = log.toString('utf8');
    harvestArtifact(rawLog);
    writer.writeText(`${runPath}/modern-web.log`, rawLog, false);
    files.push('modern-web.log');
  }
  return files;
}

/** The agent's patch if the harness captured one, otherwise a diff of the legacy run's target file against the base app. */
async function publicPatchFor(
  suiteId: string,
  runPath: string,
  rawRun: RunResult,
  options: BuildOptions,
  harvestArtifact: (text: string) => void,
): Promise<PreparedPatch | undefined> {
  const captured = await options.store.readFile(`${suiteId}/${runPath}/agent.patch`);
  if (captured !== undefined) {
    const rawPatch = captured.toString('utf8');
    harvestArtifact(rawPatch);
    return preparePatch(rawPatch);
  }
  if (!rawRun.targetFile || !rawRun.baseApp) {
    return undefined;
  }
  const agentFile = await options.store.readFile(`${suiteId}/${runPath}/${rawRun.targetFile}`);
  if (agentFile === undefined) {
    return undefined;
  }
  harvestArtifact(agentFile.toString('utf8'));
  const basePath = path.join(options.baseAppsDir ?? defaultBaseAppsDir, rawRun.baseApp, rawRun.targetFile);
  const base = fs.existsSync(basePath) ? fs.readFileSync(basePath) : undefined;
  return patchFromFiles(rawRun.targetFile, base, agentFile);
}

/** Writes files under one suite's output directory, scrubbing text and counting totals. */
class SuiteWriter {
  private readonly suiteDir: string;
  private readonly forbiddenTokens: () => readonly string[];
  private readonly writtenTextPaths: string[] = [];
  private files = 0;
  private bytes = 0;
  private truncatedPatches = 0;

  constructor(suiteDir: string, forbiddenTokens: () => readonly string[]) {
    this.suiteDir = suiteDir;
    this.forbiddenTokens = forbiddenTokens;
  }

  writeText(relPath: string, text: string, truncated: boolean): void {
    const clean = scrubString(text);
    assertClean(clean, `${path.basename(this.suiteDir)}/${relPath}`, { forbiddenTokens: this.forbiddenTokens() });
    this.write(relPath, clean);
    this.writtenTextPaths.push(relPath);
    if (truncated) {
      this.truncatedPatches++;
    }
  }

  /** Re-checks already-written text artifacts against tokens harvested later in the same suite. */
  recheck(extraTokens: readonly string[]): void {
    for (const relPath of this.writtenTextPaths) {
      const clean = fs.readFileSync(path.join(this.suiteDir, relPath), 'utf8');
      assertClean(clean, `${path.basename(this.suiteDir)}/${relPath}`, { forbiddenTokens: extraTokens });
    }
  }

  writeJson(relPath: string, value: unknown): void {
    assertClean(value, `${path.basename(this.suiteDir)}/${relPath}`, { forbiddenTokens: this.forbiddenTokens() });
    this.write(relPath, JSON.stringify(value) + '\n');
  }

  totals(): { files: number; bytes: number; truncatedPatches: number } {
    return { files: this.files, bytes: this.bytes, truncatedPatches: this.truncatedPatches };
  }

  private write(relPath: string, text: string): void {
    const absolute = path.join(this.suiteDir, relPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text);
    this.files++;
    this.bytes += Buffer.byteLength(text, 'utf8');
  }
}
