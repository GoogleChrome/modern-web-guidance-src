import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { mapWithConcurrency } from '../../core/concurrency.ts';
import { baseAppsDir as defaultBaseAppsDir } from '../../core/paths.ts';
import { extractSuiteSummary } from '../../dashboard/summary-extractor.js';
import type { SuiteSummary } from '../../dashboard/summary-extractor.js';
import type { EvalsReport, RunResult } from '../lib/metrics.ts';
import { applyPendingChanges, applyRetention, overrideFor, selectSuites, suiteCreatedAt } from './allowlist.ts';
import type { PendingChange, PublicAllowlist } from './allowlist.ts';
import { OverrideError } from './overrides.ts';
import { EXCLUDED_PATH_RE, MAX_PATCH_BYTES, patchFromFiles, preparePatch } from './patch.ts';
import type { PreparedPatch } from './patch.ts';
import {
  NotPublishableError,
  PUBLIC_AGENTS,
  PUBLIC_ASSERTION_FIELDS,
  PUBLIC_RUN_FIELDS,
  PUBLIC_SUITE_FIELDS,
} from './public-fields.ts';
import type { SkipCode } from './public-fields.ts';
import { rebuildEvals } from './rebuild-evals.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { assertClean, LEAK_PATTERNS, LeakError, scrubString } from './scrub.ts';
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
 * hourly run costs one listing call plus whatever is new.
 *
 * `build-state.json` is published along with everything else, so it holds
 * only suite ids, generations, guide names, reason *codes*, the released
 * model list, and pending `--now` changes; never error messages, which can
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
export const BUILDER_VERSION = crypto
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
  /** `--now` changes whose allowlist PR has not merged; see `PendingChange`. */
  pending: PendingChange[];
}

interface SuiteState {
  generation: string;
  excludeGuides: string[];
  /** Present when the suite was skipped; the inputs that could change the outcome are recorded alongside. */
  skipped?: { code: SkipCode; releasedModels: string[] };
}

/**
 * Builds every suite the allowlist selects (minus retention), removes suites
 * that are no longer selected, and rewrites the manifest. Pending `--now`
 * changes recorded in the output's state are layered over the allowlist first.
 * Throws only if nothing at all could be done; per-suite problems come back
 * as `skipped` or `failed` results.
 */
export async function buildSelectedSuites(options: BuildOptions): Promise<SuiteBuildResult[]> {
  const refs = await options.store.listSuites();
  const refById = new Map(refs.map(ref => [ref.id, ref]));
  const state = readState(options.outDir);
  const { allowlist, pending } = applyPendingChanges(options.allowlist, state.pending);
  const effective = { ...options, allowlist };

  const eligible = selectSuites(allowlist, refs.map(ref => ref.id));
  const selected = applyRetention(
    allowlist,
    eligible.map(id => ({ id, createdAt: suiteCreatedAt(id, refById.get(id)!.createdAt) })),
  );

  const results = await mapWithConcurrency(selected, SUITE_CONCURRENCY, async suiteId => {
    const ref = refById.get(suiteId)!;
    const previous = options.force ? undefined : unchangedOutcome(state, ref, effective);
    return previous ?? buildSuite(suiteId, effective);
  });

  for (const suiteId of presentSuiteDirs(options.outDir)) {
    if (selected.includes(suiteId)) {
      continue;
    }
    const wasPublished = hasEvals(options.outDir, suiteId);
    fs.rmSync(path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId), { recursive: true, force: true });
    if (wasPublished) {
      results.push({ suiteId, status: 'removed', files: 0, bytes: 0, truncatedPatches: 0 });
    }
  }

  writeState(options.outDir, results, refById, effective, pending);
  writeManifest(options.outDir, results);
  fs.rmSync(path.join(options.outDir, STAGING_DIR), { recursive: true, force: true });
  return results;
}

/**
 * Builds one suite into `<outDir>/public-evals/<suiteId>/`. Never throws:
 * expected rejections come back as `skipped` (with a code), anything else as
 * `failed` (not remembered, so it is retried). Output is assembled in a
 * staging directory and swapped in only once complete, so a failure leaves
 * whatever was published before in place.
 */
export async function buildSuite(suiteId: string, options: BuildOptions): Promise<SuiteBuildResult> {
  const notBuilt = (status: 'skipped' | 'failed', reason: string, code?: SkipCode): SuiteBuildResult => ({
    suiteId, status, code, reason, files: 0, bytes: 0, truncatedPatches: 0,
  });
  const suiteDir = path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId);
  const stagingDir = path.join(options.outDir, STAGING_DIR, suiteId);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  try {
    try {
      assertClean(suiteId, `suite id ${suiteId}`, { forbiddenTokens: options.forbiddenTokens });
    } catch (err) {
      if (err instanceof LeakError) {
        return notBuilt('skipped', err.message, 'suite-id');
      }
      throw err;
    }

    const rawText = await options.store.readFile(`${suiteId}/evals.json`);
    if (rawText === undefined) {
      return notBuilt('skipped', 'no evals.json', 'no-evals');
    }
    const raw = JSON.parse(rawText.toString('utf8')) as EvalsReport;
    const override = overrideFor(options.allowlist, suiteId);
    const evals = rebuildEvals(raw, {
      releasedModels: options.allowlist.releasedModels,
      excludeGuides: override?.excludeGuides,
      forbiddenTokens: options.forbiddenTokens,
    });

    const writer = new SuiteWriter(stagingDir, options.forbiddenTokens);

    const runs = Object.entries(evals.results).flatMap(([key, publicRuns]) =>
      publicRuns.map((publicRun, i) => ({ publicRun, rawRun: raw.results[key][i], runPath: runRelativePath(key, raw.results[key][i].runNumber) })),
    );
    await mapWithConcurrency(runs, RUN_CONCURRENCY, async ({ publicRun, rawRun, runPath }) => {
      publicRun.files = await writeRunArtifacts(suiteId, runPath, rawRun, options, writer);
    });

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
      return notBuilt('skipped', err.message, err.code);
    }
    if (err instanceof LeakError) {
      return notBuilt('skipped', err.message, 'leak');
    }
    if (err instanceof OverrideError) {
      return notBuilt('skipped', err.message, 'override');
    }
    return notBuilt('failed', err instanceof Error ? err.message : String(err));
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

/**
 * Rewrites `<outDir>/public-evals/suites.gen.json` so it lists exactly the
 * complete suite directories present. Entries come from this run's results
 * when available, then from the previous manifest, and only as a last resort
 * from re-reading a suite's `evals.json`.
 */
export function writeManifest(outDir: string, results: readonly SuiteBuildResult[] = []): number {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.mkdirSync(root, { recursive: true });

  const fresh = new Map(results.filter(r => r.summary).map(r => [r.suiteId, r.summary!]));
  const previous = readManifest(outDir);

  const entries = presentSuiteDirs(outDir)
    .filter(id => hasEvals(outDir, id))
    .map(id => fresh.get(id) ?? previous.get(id) ?? summarizeFromDisk(root, id))
    .filter((summary): summary is SuiteSummary => summary !== null)
    .sort((a, b) => a.testId.localeCompare(b.testId));

  // Compact: at hundreds of suites the manifest is the largest thing the landing page fetches.
  fs.writeFileSync(path.join(root, MANIFEST_FILE), JSON.stringify(entries) + '\n');
  return entries.length;
}

/**
 * Records a `--now` change in the output's build state so later builds keep
 * applying it until the allowlist does. Replaces any earlier pending change
 * for the same suite, so `promote --now` undoes an `unpublish --now`.
 */
export function addPendingChange(outDir: string, change: PendingChange): void {
  const state = readStateFile(outDir);
  state.pending = [...state.pending.filter(pending => pending.suiteId !== change.suiteId), change];
  writeStateFile(outDir, state);
}

/** The `--now` changes a build in `outDir` would still apply on top of the allowlist. */
export function pendingChanges(outDir: string): PendingChange[] {
  return readStateFile(outDir).pending;
}

/** `<run>/<guide>/<task>/<guided|unguided>`, the layout both the harness and the dashboard use. */
export function runRelativePath(resultKey: string, runNumber: number): string {
  const [task, guide, runType] = resultKey.split(' - ');
  return `${runNumber}/${guide}/${task}/${runType}`;
}

// --- Incremental state ---

/** The recorded outcome for a suite if nothing that feeds the build has changed since; otherwise undefined. */
function unchangedOutcome(state: BuildState, ref: SuiteRef, options: BuildOptions): SuiteBuildResult | undefined {
  const recorded = state.suites[ref.id];
  if (
    !recorded ||
    state.builderVersion !== BUILDER_VERSION ||
    state.forbiddenTokensVersion !== (options.forbiddenTokensVersion ?? 0) ||
    recorded.generation !== ref.generation ||
    !sameSet(recorded.excludeGuides, overrideFor(options.allowlist, ref.id)?.excludeGuides ?? [])
  ) {
    return undefined;
  }
  if (recorded.skipped) {
    if (!sameSet(recorded.skipped.releasedModels, options.allowlist.releasedModels)) {
      return undefined;
    }
    return { suiteId: ref.id, status: 'skipped', code: recorded.skipped.code, reason: `remembered: ${recorded.skipped.code}`, files: 0, bytes: 0, truncatedPatches: 0 };
  }
  return { suiteId: ref.id, status: 'unchanged', files: 0, bytes: 0, truncatedPatches: 0 };
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
    Object.entries(state.suites).filter(([id, suite]) => suite.skipped || present.has(id)),
  );
  return state;
}

/** Written once at the end; a crash mid-run only means the unfinished suites rebuild next time. */
function writeState(
  outDir: string,
  results: readonly SuiteBuildResult[],
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
  for (const result of results) {
    const ref = refById.get(result.suiteId);
    if (!ref || result.status === 'removed' || result.status === 'failed') {
      continue;
    }
    // A suite whose own id tripped the leak check is not recorded: the key would be the leak.
    if (result.status === 'skipped' && (!result.code || result.code === 'suite-id')) {
      continue;
    }
    const entry: SuiteState = {
      generation: ref.generation,
      excludeGuides: overrideFor(options.allowlist, result.suiteId)?.excludeGuides ?? [],
    };
    if (result.status === 'skipped' && result.code) {
      entry.skipped = { code: result.code, releasedModels: [...options.allowlist.releasedModels].sort() };
    }
    next.suites[result.suiteId] = entry;
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
  writer: SuiteWriter,
): Promise<string[]> {
  const files: string[] = [];

  const patch = await publicPatchFor(suiteId, runPath, rawRun, options);
  if (patch && patch.text.length > 0) {
    writer.writeText(`${runPath}/agent.patch`, patch.text, patch.truncated);
    files.push('agent.patch');
  }

  const log = await options.store.readFile(`${suiteId}/${runPath}/modern-web.log`);
  if (log !== undefined) {
    writer.writeText(`${runPath}/modern-web.log`, log.toString('utf8'), false);
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
): Promise<PreparedPatch | undefined> {
  const captured = await options.store.readFile(`${suiteId}/${runPath}/agent.patch`);
  if (captured !== undefined) {
    return preparePatch(captured.toString('utf8'));
  }
  if (!rawRun.targetFile || !rawRun.baseApp) {
    return undefined;
  }
  const agentFile = await options.store.readFile(`${suiteId}/${runPath}/${rawRun.targetFile}`);
  if (agentFile === undefined) {
    return undefined;
  }
  const basePath = path.join(options.baseAppsDir ?? defaultBaseAppsDir, rawRun.baseApp, rawRun.targetFile);
  const base = fs.existsSync(basePath) ? fs.readFileSync(basePath) : undefined;
  return patchFromFiles(rawRun.targetFile, base, agentFile);
}

/** Writes files under one suite's output directory, scrubbing text and counting totals. */
class SuiteWriter {
  private readonly suiteDir: string;
  private readonly forbiddenTokens: readonly string[] | undefined;
  private files = 0;
  private bytes = 0;
  private truncatedPatches = 0;

  constructor(suiteDir: string, forbiddenTokens: readonly string[] | undefined) {
    this.suiteDir = suiteDir;
    this.forbiddenTokens = forbiddenTokens;
  }

  writeText(relPath: string, text: string, truncated: boolean): void {
    const clean = scrubString(text);
    assertClean(clean, `${path.basename(this.suiteDir)}/${relPath}`, { forbiddenTokens: this.forbiddenTokens });
    this.write(relPath, clean);
    if (truncated) {
      this.truncatedPatches++;
    }
  }

  writeJson(relPath: string, value: unknown): void {
    assertClean(value, `${path.basename(this.suiteDir)}/${relPath}`, { forbiddenTokens: this.forbiddenTokens });
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
