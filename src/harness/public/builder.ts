import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapWithConcurrency } from '../../core/concurrency.ts';
import { baseAppsDir as defaultBaseAppsDir } from '../../core/paths.ts';
import { extractJobSummary } from '../../dashboard/summary-extractor.js';
import type { JobSummary } from '../../dashboard/summary-extractor.js';
import type { EvalsReport, TrialResult } from '../lib/metrics.ts';
import { isCuratedJob, jobCreatedAt, newestFirst, overrideFor, selectJobs, withinJobCaps, withinMaxAge } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { EXCLUDED_PATH_RE, MAX_PATCH_BYTES, patchFromFiles, preparePatch } from './patch.ts';
import type { PreparedPatch } from './patch.ts';
import {
  assertPublishable,
  NotPublishableError,
  OverrideError,
  PUBLIC_AGENTS,
  PUBLIC_CHECK_FIELDS,
  PUBLIC_JOB_FIELDS,
  PUBLIC_TRIAL_FIELDS,
  rebuildEvals,
} from './rebuild-evals.ts';
import type { PublicEvals, SkipCode } from './rebuild-evals.ts';
import { assertClean, GENERIC_USERS, harvestUserSegments, harvestUserSegmentsIn, LEAK_PATTERNS, LeakError, scrubString } from './scrub.ts';
import type { JobRef, JobStore } from './suite-store.ts';

/**
 * Builds the public copy of eval jobs: `public-evals/<jobId>/evals.json`
 * plus `artifacts.json`, which holds every trial's `agent.patch` and
 * `modern-web.log`, and a `suites.gen.json` manifest over everything built.
 * Each job is independent; one failing job is reported and skipped without
 * affecting the others.
 *
 * Builds are incremental: `build-state.json` records which raw generation and
 * overrides each published job was built from, and unchanged jobs are left
 * alone. Raw nightlies are immutable once uploaded, so in steady state an
 * incremental run costs one listing call plus whatever is new.
 *
 * `build-state.json` is published along with everything else, so it holds
 * only job ids, generations, guide names, reason *codes*, and the released
 * model list; never error messages, which can quote what they rejected.
 */

/** Directory name under the output root. Served at the same path on GitHub Pages. */
export const PUBLIC_EVALS_DIR = 'public-evals';

/**
 * Per-job file mapping each trial artifact's job-relative path
 * (`<trialIndex>/<guide>/<task>/<condition>/agent.patch`) to its text. One file rather than
 * one per artifact: a job has ~600 of them, and the Pages deploy handles
 * every published file on every deploy. The dashboard reads it as
 * `PUBLIC_ARTIFACTS_FILE` in `src/dashboard/data-source.js`.
 */
export const ARTIFACTS_FILE = 'artifacts.json';

/**
 * Bump when output-shaping *logic* changes (scrubbing replacements, patch
 * preparation, the file layout) in a way that should rebuild every job.
 * Field lists and patterns are hashed in automatically below.
 */
const OUTPUT_REVISION = 2;

/**
 * Identifies the per-job public output contract. Derived from the rules that
 * shape `<jobId>/evals.json`, `agent.patch`, and `modern-web.log`, so
 * changing any of them rebuilds every job once without anyone remembering to
 * bump a number.
 */
const BUILDER_VERSION = crypto
  .createHash('sha1')
  .update(JSON.stringify({
    revision: OUTPUT_REVISION,
    suite: PUBLIC_JOB_FIELDS,
    run: PUBLIC_TRIAL_FIELDS,
    assertion: PUBLIC_CHECK_FIELDS,
    agents: [...PUBLIC_AGENTS].sort(),
    leaks: LEAK_PATTERNS.map(pattern => pattern.re.source),
    genericUsers: [...GENERIC_USERS].sort(),
    excludedPaths: EXCLUDED_PATH_RE.source,
    maxPatchBytes: MAX_PATCH_BYTES,
  }))
  .digest('hex')
  .slice(0, 12);

/**
 * Modules that shape `suites.gen.json` via `extractJobSummary`. Hashed by
 * full file contents into `MANIFEST_VERSION` so classifier or summary changes
 * re-extract `suites.gen.json` from local `public-evals/<jobId>/evals.json`
 * without re-downloading raw jobs from GCS.
 */
const MANIFEST_SOURCE_FILES = [
  '../../dashboard/summary-extractor.js',
  '../../dashboard/a11y-classifier.js',
  '../../dashboard/showcase-config.js',
  '../../dashboard/utils.js',
] as const;

export const MANIFEST_VERSION = crypto
  .createHash('sha1')
  .update(JSON.stringify(
    MANIFEST_SOURCE_FILES.map(rel => [
      rel,
      fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'),
    ]),
  ))
  .digest('hex')
  .slice(0, 12);

/** How many jobs are built at once, and how many of one job's trials are fetched at once. */
const JOB_CONCURRENCY = 4;
const TRIAL_CONCURRENCY = 32;

const STATE_FILE = 'build-state.json';
const MANIFEST_FILE = 'suites.gen.json';
/** Sibling of `public-evals/` where a job is assembled before being swapped in. Never published. */
const STAGING_DIR = 'public-evals-staging';

export interface BuildOptions {
  store: JobStore;
  /** Output root; jobs are written under `<outDir>/public-evals/`. */
  outDir: string;
  allowlist: PublicAllowlist;
  /** Where to find base apps for legacy-layout diffs. Defaults to the repo's. */
  baseAppsDir?: string;
  /** Tokens (e.g. operator LDAPs) that must not appear anywhere in the output. */
  forbiddenTokens?: readonly string[];
  /**
   * Bump (via `PUBLIC_EVALS_FORBIDDEN_TOKENS_VERSION`) when the token list
   * changes, so already-built jobs are rescanned. The tokens themselves are
   * never written to state.
   */
  forbiddenTokensVersion?: number;
  /** Rebuild every selected job even if its recorded state matches. */
  force?: boolean;
  /** Reference clock for retention (tests). */
  now?: Date;
}

export interface JobBuildResult {
  jobId: string;
  status: 'built' | 'skipped' | 'failed' | 'unchanged' | 'removed';
  /** Machine-readable reason for `skipped`; the only reason that is persisted. */
  code?: SkipCode;
  /** Human-readable reason for `skipped` or `failed`. May quote rejected data; console only. */
  reason?: string;
  files: number;
  bytes: number;
  truncatedPatches: number;
  /** Manifest entry, for built jobs. */
  summary?: JobSummary;
}

/** @deprecated Use JobBuildResult */
export type SuiteBuildResult = JobBuildResult;

/** What each selected job was last built (or skipped) from. */
interface BuildState {
  builderVersion: string;
  manifestVersion?: string;
  forbiddenTokensVersion: number;
  suites: Record<string, JobState>;
}

/** The allowlist inputs a job's outcome depends on, so a change to any of them rebuilds it. */
interface JobState {
  generation: string;
  excludeGuides: string[];
  /** Only for `unreleased-model` skips: the list the job was judged against, so a change to it is the cue to try again. */
  releasedModels?: string[];
  /**
   * For published and deferred jobs only (both are already public through
   * their `evals.json`): `model`, so a release-list change rebuilds a job only
   * when its own model's status changed, and `agent`, so per-agent retention
   * can be applied without re-reading `evals.json`. Never recorded for a
   * skipped job, whose model may be unreleased.
   */
  agent?: string;
  model?: string;
  /** Present when the job was skipped. */
  skipped?: { code: SkipCode };
  /** Publishable, but outside retention; remembered so it is not re-fetched to find that out. */
  deferred?: true;
}

/** Agent and model of a publishable job, from its raw report or from state. */
interface JobIdentity {
  agent?: string;
  model?: string;
}

/**
 * Builds every job the allowlist selects (minus retention), removes jobs
 * that are no longer selected, and rewrites the manifest. Throws only if nothing at all could be done; per-job problems come back
 * as `skipped` or `failed` results.
 */
export async function buildSelectedJobs(options: BuildOptions): Promise<JobBuildResult[]> {
  const now = options.now ?? new Date();
  const refs = await options.store.listJobs();
  const refById = new Map(refs.map(ref => [ref.id, ref]));
  const state = readState(options.outDir);
  const { allowlist } = options;

  const eligible = selectJobs(allowlist, refs.map(ref => ref.id))
    .map(id => ({ id, createdAt: jobCreatedAt(id, refById.get(id)!.createdAt) }));
  const candidates = newestFirst(withinMaxAge(allowlist, eligible, now)).map(job => job.id);

  // Retention counts jobs that can actually be published, so gate first (from state when
  // nothing changed, otherwise by reading evals.json), then take the newest N per agent and
  // overall. A job that already has a published copy on disk and hit a transient gate error
  // keeps its slot so an older job is not built for one run only to be deleted on the next.
  const gated = await mapWithConcurrency(candidates, JOB_CONCURRENCY, jobId =>
    publishability(jobId, refById.get(jobId)!, state, options));
  const results: JobBuildResult[] = [];
  const identities = new Map<string, JobIdentity>();
  const slotHolders: Array<{ jobId: string; agent?: string; report: EvalsReport | undefined; failed: boolean }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const jobId = candidates[i];
    const outcome = gated[i];
    if (outcome.publishable) {
      identities.set(jobId, outcome.identity);
      slotHolders.push({ jobId, agent: outcome.identity.agent, report: outcome.report, failed: false });
    } else {
      results.push(outcome.result);
      if (outcome.result.status === 'failed' && hasEvals(options.outDir, jobId)) {
        const recorded = state.suites[jobId];
        slotHolders.push({ jobId, agent: recorded?.agent, report: undefined, failed: true });
      }
    }
  }

  const selected = withinJobCaps(allowlist, slotHolders);
  const keepIds = new Set(selected.map(slot => slot.jobId));
  const deferred = slotHolders
    .filter(slot => !keepIds.has(slot.jobId) && !slot.failed)
    .map(slot => slot.jobId);
  const toBuild = selected.filter(slot => !slot.failed);

  results.push(...await mapWithConcurrency(toBuild, JOB_CONCURRENCY, async ({ jobId, report }) => {
    const ref = refById.get(jobId)!;
    const previous = options.force ? undefined : unchangedOutcome(state, ref, options);
    return previous ?? buildJob(jobId, options, report);
  }));

  // Anything on disk outside `selected` goes; a selected job whose build failed this run
  // keeps its previously published copy (and manifest entry) until a later run replaces it.
  const resultFor = new Map(results.map(result => [result.jobId, result]));
  const keep = keepIds;
  for (const jobId of presentJobDirs(options.outDir)) {
    const existing = resultFor.get(jobId);
    if (keep.has(jobId)) {
      continue;
    }
    const wasPublished = hasEvals(options.outDir, jobId);
    fs.rmSync(path.join(options.outDir, PUBLIC_EVALS_DIR, jobId), { recursive: true, force: true });
    if (wasPublished && !existing) {
      results.push({ jobId, status: 'removed', files: 0, bytes: 0, truncatedPatches: 0 });
    }
  }

  // Manifest first: if it trips the leak check the state is not advanced, so the build is redone.
  const refreshSummaries = Boolean(options.force) || state.manifestVersion !== MANIFEST_VERSION;
  writeManifest(options.outDir, results, options.forbiddenTokens, { refreshSummaries });
  writeState(options.outDir, results, deferred, refById, identities, options);
  fs.rmSync(path.join(options.outDir, STAGING_DIR), { recursive: true, force: true });
  return results;
}

/** @deprecated Use buildSelectedJobs */
export const buildSelectedSuites = buildSelectedJobs;

type GateOutcome =
  | { publishable: true; report: EvalsReport | undefined; identity: JobIdentity }
  | { publishable: false; result: JobBuildResult };

function notBuiltResult(jobId: string, status: 'skipped' | 'failed', reason: string, code?: SkipCode): JobBuildResult {
  return { jobId, status, code, reason, files: 0, bytes: 0, truncatedPatches: 0 };
}

/**
 * Whether a job passes the job-id and agent/model gates, or the
 * `skipped`/`failed` result to report instead. The id is checked before
 * anything else so a leaking id is never recorded, deferred, or fetched.
 * The model gate is answered from state when the job's inputs have not
 * changed, otherwise by reading its `evals.json`.
 */
async function publishability(
  jobId: string,
  ref: JobRef,
  state: BuildState,
  options: BuildOptions,
): Promise<GateOutcome> {
  const leakyId = jobIdRejection(jobId, options);
  if (leakyId) {
    return { publishable: false, result: leakyId };
  }
  const recorded = state.suites[jobId];
  if (recorded && !options.force && !stale(recorded, state, ref, options)) {
    if (!recorded.skipped) {
      return { publishable: true, report: undefined, identity: { agent: recorded.agent, model: recorded.model } };
    }
    return {
      publishable: false,
      result: notBuiltResult(jobId, 'skipped', `remembered: ${recorded.skipped.code}`, recorded.skipped.code),
    };
  }
  try {
    const report = await readReport(jobId, options.store);
    if (report === undefined) {
      return { publishable: false, result: notBuiltResult(jobId, 'skipped', 'no evals.json', 'no-evals') };
    }
    assertPublishable(report, options.allowlist.releasedModels);
    return { publishable: true, report, identity: { agent: report.agent, model: report.model } };
  } catch (err) {
    if (err instanceof NotPublishableError) {
      return { publishable: false, result: notBuiltResult(jobId, 'skipped', err.message, err.code) };
    }
    return { publishable: false, result: notBuiltResult(jobId, 'failed', err instanceof Error ? err.message : String(err)) };
  }
}

/** The `skipped` result for a job whose id itself would leak, or undefined when the id is clean. */
function jobIdRejection(jobId: string, options: BuildOptions): JobBuildResult | undefined {
  try {
    assertClean(jobId, `job id ${jobId}`, { forbiddenTokens: options.forbiddenTokens });
    return undefined;
  } catch (err) {
    if (err instanceof LeakError) {
      return notBuiltResult(jobId, 'skipped', err.message, 'suite-id');
    }
    throw err;
  }
}

async function readReport(jobId: string, store: JobStore): Promise<EvalsReport | undefined> {
  const rawText = await store.readFile(`${jobId}/evals.json`);
  return rawText === undefined ? undefined : JSON.parse(rawText.toString('utf8')) as EvalsReport;
}

/**
 * Builds one job into `<outDir>/public-evals/<jobId>/`. Never throws:
 * expected rejections come back as `skipped` (with a code), anything else as
 * `failed` (not remembered, so it is retried). Output is assembled in a
 * staging directory and swapped in only once complete, so a failure leaves
 * whatever was published before in place. Pass `preloaded` when the raw
 * report has already been read (the gate does) to skip a second download.
 *
 * Usernames embedded in raw paths across `evals.json`, `agent.patch`, and
 * `modern-web.log` are harvested before scrubbing and added to this job's
 * forbidden tokens so a bare occurrence of the same name elsewhere in the
 * job cannot slip through.
 */
export async function buildJob(jobId: string, options: BuildOptions, preloaded?: EvalsReport): Promise<JobBuildResult> {
  const jobDir = path.join(options.outDir, PUBLIC_EVALS_DIR, jobId);
  const stagingDir = path.join(options.outDir, STAGING_DIR, jobId);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  try {
    const leakyId = jobIdRejection(jobId, options);
    if (leakyId) {
      return leakyId;
    }

    const raw = preloaded ?? await readReport(jobId, options.store);
    if (raw === undefined) {
      return notBuiltResult(jobId, 'skipped', 'no evals.json', 'no-evals');
    }

    const jobTokens = new Set<string>(options.forbiddenTokens ?? []);
    for (const user of harvestUserSegmentsIn(raw)) {
      jobTokens.add(user);
    }
    const harvestArtifact = (text: string): void => {
      for (const user of harvestUserSegments(text)) {
        jobTokens.add(user);
      }
    };
    const currentTokens = (): string[] => [...jobTokens];

    const curated = isCuratedJob(jobId, options.allowlist);
    const override = overrideFor(options.allowlist, jobId);
    const evals = rebuildEvals(raw, {
      releasedModels: options.allowlist.releasedModels,
      excludeGuides: override?.excludeGuides,
      forbiddenTokens: currentTokens(),
      curated,
    });

    const writer = new JobWriter(stagingDir, currentTokens);

    const trials = Object.entries(evals.results).flatMap(([key, publicTrials]) =>
      publicTrials.map((publicTrial, i) => ({ publicTrial, rawTrial: raw.results[key][i], trialPath: trialRelativePath(key, raw.results[key][i].runNumber) })),
    );
    await mapWithConcurrency(trials, TRIAL_CONCURRENCY, async ({ publicTrial, rawTrial, trialPath }) => {
      publicTrial.files = await collectTrialArtifacts(jobId, trialPath, rawTrial, options, harvestArtifact, writer);
    });

    writer.writeArtifacts();
    writer.writeJson('evals.json', evals);
    fs.rmSync(jobDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(jobDir), { recursive: true });
    fs.renameSync(stagingDir, jobDir);
    const summary = extractJobSummary(jobId, evals) ?? undefined;
    return { jobId, status: 'built', ...writer.totals(), summary };
  } catch (err) {
    if (err instanceof NotPublishableError || err instanceof LeakError || err instanceof OverrideError) {
      // A policy rejection is not transient: whatever was published before must go too.
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
    if (err instanceof NotPublishableError) {
      return notBuiltResult(jobId, 'skipped', err.message, err.code);
    }
    if (err instanceof LeakError) {
      return notBuiltResult(jobId, 'skipped', err.message, 'leak');
    }
    if (err instanceof OverrideError) {
      return notBuiltResult(jobId, 'skipped', err.message, 'override');
    }
    return notBuiltResult(jobId, 'failed', err instanceof Error ? err.message : String(err));
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

/** @deprecated Use buildJob */
export const buildSuite = buildJob;

/**
 * Rewrites `<outDir>/public-evals/suites.gen.json` so it lists exactly the
 * complete job directories present. Entries come from this build's results
 * when available, then from the previous manifest (unless `refreshSummaries`
 * is set), and otherwise from re-reading a job's `evals.json`. Throws
 * `LeakError` rather than writing a manifest that still identifies someone.
 */
export function writeManifest(
  outDir: string,
  results: readonly JobBuildResult[],
  forbiddenTokens?: readonly string[],
  manifestOptions?: { refreshSummaries?: boolean },
): number {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.mkdirSync(root, { recursive: true });

  const fresh = new Map(results.filter(r => r.summary).map(r => [r.jobId, r.summary!]));
  const previous = manifestOptions?.refreshSummaries ? new Map<string, JobSummary>() : readManifest(outDir);

  const entries = presentJobDirs(outDir)
    .filter(id => hasEvals(outDir, id))
    .map(id => fresh.get(id) ?? previous.get(id) ?? summarizeFromDisk(root, id))
    .filter((summary): summary is JobSummary => summary !== null)
    .sort((a, b) => a.testId.localeCompare(b.testId));
  assertClean(entries, MANIFEST_FILE, { forbiddenTokens });

  // Compact: at hundreds of jobs the manifest is the largest thing the landing page fetches.
  fs.writeFileSync(path.join(root, MANIFEST_FILE), JSON.stringify(entries) + '\n');
  return entries.length;
}

/**
 * `<trialIndex>/<guide>/<task>/<guided|unguided>`, the layout both the harness and the
 * dashboard use. Throws if any segment could escape the job directory or
 * is not a plain name, since the key comes from data in the bucket.
 */
export function trialRelativePath(resultKey: string, trialIndex: number): string {
  const [task, guide, condition] = resultKey.split(' - ');
  const segments = [String(trialIndex), guide, task, condition];
  for (const segment of segments) {
    if (segment === undefined || segment === '.' || segment === '..' || !/^[\w.-]+$/.test(segment)) {
      throw new Error(`Unsafe path segment ${JSON.stringify(segment)} in result key ${JSON.stringify(resultKey)}, trial ${trialIndex}`);
    }
  }
  return segments.join('/');
}

/** @deprecated Use trialRelativePath */
export const runRelativePath = trialRelativePath;

// --- Incremental state ---

/** The recorded `unchanged` outcome for a publishable job when nothing that feeds it has changed; otherwise undefined. */
function unchangedOutcome(state: BuildState, ref: JobRef, options: BuildOptions): JobBuildResult | undefined {
  const recorded = state.suites[ref.id];
  if (!recorded || recorded.deferred || recorded.skipped || stale(recorded, state, ref, options)) {
    return undefined;
  }
  return { jobId: ref.id, status: 'unchanged', files: 0, bytes: 0, truncatedPatches: 0 };
}

/** True when any input that fed the recorded outcome has changed since. */
function stale(recorded: JobState, state: BuildState, ref: JobRef, options: BuildOptions): boolean {
  return (
    state.builderVersion !== BUILDER_VERSION ||
    state.forbiddenTokensVersion !== (options.forbiddenTokensVersion ?? 0) ||
    recorded.generation !== ref.generation ||
    !sameSet(recorded.excludeGuides, overrideFor(options.allowlist, ref.id)?.excludeGuides ?? []) ||
    releaseStatusChanged(recorded, options.allowlist.releasedModels)
  );
}

/**
 * Whether the released-model list changed in a way that affects this job.
 * A published or deferred job cares only about its own model (so releasing
 * a new model does not rebuild every job); a job skipped as
 * `unreleased-model` is retried whenever the list changes, since its model is
 * deliberately not recorded; other skips do not depend on the list at all.
 */
function releaseStatusChanged(recorded: JobState, releasedModels: readonly string[]): boolean {
  if (recorded.skipped) {
    return recorded.skipped.code === 'unreleased-model' && !sameSet(recorded.releasedModels ?? [], releasedModels);
  }
  return recorded.model === undefined || !releasedModels.includes(recorded.model);
}

function emptyState(): BuildState {
  return { builderVersion: BUILDER_VERSION, manifestVersion: undefined, forbiddenTokensVersion: 0, suites: {} };
}

function readStateFile(outDir: string): BuildState {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE);
  if (!fs.existsSync(file)) {
    return emptyState();
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<BuildState>;
  return {
    builderVersion: parsed.builderVersion ?? BUILDER_VERSION,
    manifestVersion: parsed.manifestVersion,
    forbiddenTokensVersion: parsed.forbiddenTokensVersion ?? 0,
    suites: parsed.suites ?? {},
  };
}

function writeStateFile(outDir: string, state: BuildState): void {
  fs.mkdirSync(path.join(outDir, PUBLIC_EVALS_DIR), { recursive: true });
  fs.writeFileSync(path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE), JSON.stringify(state, null, 2) + '\n');
}

/** State for this build: built entries whose directory is gone are dropped so a manual delete forces a rebuild. */
function readState(outDir: string): BuildState {
  const state = readStateFile(outDir);
  const present = new Set(presentJobDirs(outDir).filter(id => hasEvals(outDir, id)));
  state.suites = Object.fromEntries(
    Object.entries(state.suites).filter(([id, job]) => job.skipped || job.deferred || present.has(id)),
  );
  return state;
}

/** Written once at the end; a crash mid-build only means the unfinished jobs rebuild next time. */
function writeState(
  outDir: string,
  results: readonly JobBuildResult[],
  deferred: readonly string[],
  refById: Map<string, JobRef>,
  identities: ReadonlyMap<string, JobIdentity>,
  options: BuildOptions,
): void {
  const next: BuildState = {
    builderVersion: BUILDER_VERSION,
    manifestVersion: MANIFEST_VERSION,
    forbiddenTokensVersion: options.forbiddenTokensVersion ?? 0,
    suites: {},
  };
  const entryFor = (jobId: string, ref: JobRef): JobState => ({
    generation: ref.generation,
    excludeGuides: overrideFor(options.allowlist, jobId)?.excludeGuides ?? [],
  });
  // Only publishable jobs get an identity: a skipped job's model may be unreleased.
  const withIdentity = (jobId: string, entry: JobState): JobState => {
    const identity = identities.get(jobId);
    return identity ? { ...entry, agent: identity.agent, model: identity.model } : entry;
  };
  for (const result of results) {
    const ref = refById.get(result.jobId);
    if (!ref || result.status === 'removed' || result.status === 'failed') {
      continue;
    }
    // A job whose own id tripped the leak check is not recorded: the key would be the leak.
    if (result.status === 'skipped' && (!result.code || result.code === 'suite-id')) {
      continue;
    }
    const entry = entryFor(result.jobId, ref);
    if (result.status === 'skipped' && result.code) {
      entry.skipped = { code: result.code };
      if (result.code === 'unreleased-model') {
        entry.releasedModels = [...options.allowlist.releasedModels].sort();
      }
      next.suites[result.jobId] = entry;
    } else {
      next.suites[result.jobId] = withIdentity(result.jobId, entry);
    }
  }
  for (const jobId of deferred) {
    next.suites[jobId] = { ...withIdentity(jobId, entryFor(jobId, refById.get(jobId)!)), deferred: true };
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
function presentJobDirs(outDir: string): string[] {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
}

/** `evals.json` is written last, so its presence marks a complete job directory. */
function hasEvals(outDir: string, jobId: string): boolean {
  return fs.existsSync(path.join(outDir, PUBLIC_EVALS_DIR, jobId, 'evals.json'));
}

function readManifest(outDir: string): Map<string, JobSummary> {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, MANIFEST_FILE);
  if (!fs.existsSync(file)) {
    return new Map();
  }
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as JobSummary[];
  return new Map(entries.map(entry => [entry.testId, entry]));
}

function summarizeFromDisk(root: string, jobId: string): JobSummary | null {
  const evals = JSON.parse(fs.readFileSync(path.join(root, jobId, 'evals.json'), 'utf8')) as PublicEvals;
  return extractJobSummary(jobId, evals);
}

// --- Per-trial artifacts ---

/** Hands a trial's public artifacts to the writer and returns their names. */
async function collectTrialArtifacts(
  jobId: string,
  trialPath: string,
  rawTrial: TrialResult,
  options: BuildOptions,
  harvestArtifact: (text: string) => void,
  writer: JobWriter,
): Promise<string[]> {
  const files: string[] = [];

  const patch = await publicPatchFor(jobId, trialPath, rawTrial, options, harvestArtifact);
  if (patch && patch.text.length > 0) {
    writer.addArtifact(`${trialPath}/agent.patch`, patch.text, patch.truncated);
    files.push('agent.patch');
  }

  const log = await options.store.readFile(`${jobId}/${trialPath}/modern-web.log`);
  if (log !== undefined) {
    const rawLog = log.toString('utf8');
    harvestArtifact(rawLog);
    writer.addArtifact(`${trialPath}/modern-web.log`, rawLog, false);
    files.push('modern-web.log');
  }
  return files;
}

/** The agent's patch if the harness captured one, otherwise a diff of the legacy trial's target file against the base app. */
async function publicPatchFor(
  jobId: string,
  trialPath: string,
  rawTrial: TrialResult,
  options: BuildOptions,
  harvestArtifact: (text: string) => void,
): Promise<PreparedPatch | undefined> {
  const captured = await options.store.readFile(`${jobId}/${trialPath}/agent.patch`);
  if (captured !== undefined) {
    const rawPatch = captured.toString('utf8');
    harvestArtifact(rawPatch);
    return preparePatch(rawPatch);
  }
  if (!rawTrial.targetFile || !rawTrial.baseApp) {
    return undefined;
  }
  // Both fields come from the raw evals.json, so they are checked before touching the store
  // or the base-app checkout: a trial naming a target outside its directory gets no patch.
  const targetFile = cleanRelativePath(rawTrial.targetFile);
  if (targetFile === undefined || !PLAIN_SEGMENT_RE.test(rawTrial.baseApp)) {
    return undefined;
  }
  const agentFile = await options.store.readFile(`${jobId}/${trialPath}/${targetFile}`);
  if (agentFile === undefined) {
    return undefined;
  }
  harvestArtifact(agentFile.toString('utf8'));
  const base = readBaseAppFile(options.baseAppsDir ?? defaultBaseAppsDir, rawTrial.baseApp, targetFile);
  return patchFromFiles(targetFile, base, agentFile);
}

/** One directory or file name: not empty, not `.` or `..`, no separators. Anything else (spaces, `[id]`, `+page`) is a legitimate file name. */
const PLAIN_SEGMENT_RE = /^(?!\.{1,2}$)[^/\\]+$/;

/**
 * `relPath` as a forward-slash relative path of plain segments, or undefined
 * when it is absolute, uses backslashes or NUL, or contains `.`/`..`/empty segments.
 */
export function cleanRelativePath(relPath: string): string | undefined {
  if (relPath === '' || relPath.startsWith('/') || relPath.includes('\\') || relPath.includes('\u0000')) {
    return undefined;
  }
  const segments = relPath.split('/');
  return segments.every(segment => PLAIN_SEGMENT_RE.test(segment)) ? segments.join('/') : undefined;
}

/**
 * The base app's copy of `targetFile`, if it is a regular file inside
 * `baseAppsDir`. The prefix check is the containment guard; the segment rules
 * above only keep obviously malformed names out of store keys.
 */
function readBaseAppFile(baseAppsDir: string, baseApp: string, targetFile: string): Buffer | undefined {
  const root = path.resolve(baseAppsDir);
  const basePath = path.resolve(root, baseApp, targetFile);
  if (!basePath.startsWith(root + path.sep)) {
    return undefined;
  }
  return fs.statSync(basePath, { throwIfNoEntry: false })?.isFile() ? fs.readFileSync(basePath) : undefined;
}

/** Writes files under one job's output directory, scrubbing text and counting totals. */
class JobWriter {
  private readonly jobDir: string;
  private readonly forbiddenTokens: () => readonly string[];
  /** Scrubbed trial artifacts by job-relative path, checked and written together by `writeArtifacts`. */
  private readonly artifacts = new Map<string, string>();
  private files = 0;
  private bytes = 0;
  private truncatedPatches = 0;

  constructor(jobDir: string, forbiddenTokens: () => readonly string[]) {
    this.jobDir = jobDir;
    this.forbiddenTokens = forbiddenTokens;
  }

  addArtifact(relPath: string, text: string, truncated: boolean): void {
    this.artifacts.set(relPath, scrubString(text));
    if (truncated) {
      this.truncatedPatches++;
    }
  }

  /**
   * Writes the collected artifacts as `ARTIFACTS_FILE`, keys sorted so the same inputs give the
   * same bytes. The leak check runs here, over all of them at once, rather than as each is added:
   * a username can be harvested from one artifact after another that names it was collected.
   */
  writeArtifacts(): void {
    this.writeJson(ARTIFACTS_FILE, Object.fromEntries([...this.artifacts].sort(([a], [b]) => (a < b ? -1 : 1))));
  }

  writeJson(relPath: string, value: unknown): void {
    assertClean(value, `${path.basename(this.jobDir)}/${relPath}`, { forbiddenTokens: this.forbiddenTokens() });
    this.write(relPath, JSON.stringify(value) + '\n');
  }

  totals(): { files: number; bytes: number; truncatedPatches: number } {
    return { files: this.files, bytes: this.bytes, truncatedPatches: this.truncatedPatches };
  }

  private write(relPath: string, text: string): void {
    const absolute = path.join(this.jobDir, relPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text);
    this.files++;
    this.bytes += Buffer.byteLength(text, 'utf8');
  }
}
