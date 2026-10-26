import fs from 'node:fs';
import path from 'node:path';
import { mapWithConcurrency } from '../../core/concurrency.ts';
import { baseAppsDir as defaultBaseAppsDir } from '../../core/paths.ts';
import { extractSuiteSummary } from '../../dashboard/summary-extractor.js';
import type { SuiteSummary } from '../../dashboard/summary-extractor.js';
import type { EvalsReport, RunResult } from '../lib/metrics.ts';
import { applyRetention, overrideFor, selectSuites } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { OverrideError } from './overrides.ts';
import { patchFromFiles, preparePatch } from './patch.ts';
import type { PreparedPatch } from './patch.ts';
import { NotPublishableError } from './public-fields.ts';
import { rebuildEvals } from './rebuild-evals.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { assertClean, LeakError, scrubString } from './scrub.ts';
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
 */

/** Directory name under the output root. Served at the same path on GitHub Pages. */
export const PUBLIC_EVALS_DIR = 'public-evals';

/** Bump when the public output format changes, so every suite is rebuilt once. */
export const BUILDER_VERSION = 2;

/** How many suites are built at once, and how many of one suite's runs are fetched at once. */
const SUITE_CONCURRENCY = 4;
const RUN_CONCURRENCY = 32;

const STATE_FILE = 'build-state.json';
const MANIFEST_FILE = 'suites.gen.json';

export interface BuildOptions {
  store: SuiteStore;
  /** Output root; suites are written under `<outDir>/public-evals/`. */
  outDir: string;
  allowlist: PublicAllowlist;
  /** Where to find base apps for legacy-layout diffs. Defaults to the repo's. */
  baseAppsDir?: string;
  /** Tokens (e.g. operator LDAPs) that must not appear anywhere in the output. */
  forbiddenTokens?: readonly string[];
  /** Rebuild every selected suite even if its recorded state matches. */
  force?: boolean;
}

export interface SuiteBuildResult {
  suiteId: string;
  status: 'built' | 'skipped' | 'unchanged' | 'removed';
  /** Why the suite was skipped. */
  reason?: string;
  files: number;
  bytes: number;
  truncatedPatches: number;
  /** Manifest entry, for built suites. */
  summary?: SuiteSummary;
}

/**
 * What each selected suite was last built (or skipped) from. Lives at
 * `public-evals/build-state.json`. Skipped suites are remembered too, so a
 * suite with an unreleased model is not downloaded again every hour; it is
 * retried when its generation, overrides, or the released-model list change.
 */
interface BuildState {
  builderVersion: number;
  suites: Record<string, SuiteState>;
}

interface SuiteState {
  generation: string;
  excludeGuides: string[];
  /** Present when the suite was skipped; the inputs that could change the outcome are recorded alongside. */
  skipped?: { reason: string; releasedModels: string[] };
}

/**
 * Builds every suite the allowlist selects (minus retention), removes suites
 * that are no longer selected, and rewrites the manifest.
 */
export async function buildSelectedSuites(options: BuildOptions): Promise<SuiteBuildResult[]> {
  const refs = await options.store.listSuites();
  const refById = new Map(refs.map(ref => [ref.id, ref]));
  const eligible = selectSuites(options.allowlist, refs.map(ref => ref.id));
  const selected = applyRetention(options.allowlist, eligible.map(id => refById.get(id)!));

  const state = readState(options.outDir);
  const results = await mapWithConcurrency(selected, SUITE_CONCURRENCY, async suiteId => {
    const ref = refById.get(suiteId)!;
    const previous = options.force ? undefined : unchangedOutcome(state, ref, options.allowlist);
    if (previous) {
      return previous;
    }
    return buildSuite(suiteId, options);
  });

  for (const suiteId of publishedSuiteIds(options.outDir)) {
    if (!selected.includes(suiteId)) {
      fs.rmSync(path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId), { recursive: true, force: true });
      results.push({ suiteId, status: 'removed', files: 0, bytes: 0, truncatedPatches: 0 });
    }
  }

  writeState(options.outDir, results, refById, options.allowlist);
  writeManifest(options.outDir, results);
  return results;
}

/**
 * Builds one suite into `<outDir>/public-evals/<suiteId>/`. Never throws for a
 * per-suite problem; returns `status: 'skipped'` with the reason instead so a
 * scheduled job can report it and continue.
 */
export async function buildSuite(suiteId: string, options: BuildOptions): Promise<SuiteBuildResult> {
  const skipped = (reason: string): SuiteBuildResult => ({
    suiteId, status: 'skipped', reason, files: 0, bytes: 0, truncatedPatches: 0,
  });
  const suiteDir = path.join(options.outDir, PUBLIC_EVALS_DIR, suiteId);

  try {
    assertClean(suiteId, `suite id ${suiteId}`, { forbiddenTokens: options.forbiddenTokens });

    const rawText = await options.store.readFile(`${suiteId}/evals.json`);
    if (rawText === undefined) {
      return skipped('no evals.json');
    }
    const raw = JSON.parse(rawText.toString('utf8')) as EvalsReport;
    const override = overrideFor(options.allowlist, suiteId);
    const evals = rebuildEvals(raw, {
      releasedModels: options.allowlist.releasedModels,
      excludeGuides: override?.excludeGuides,
      forbiddenTokens: options.forbiddenTokens,
    });

    fs.rmSync(suiteDir, { recursive: true, force: true });
    const writer = new SuiteWriter(suiteDir, options.forbiddenTokens);

    const runs = Object.entries(evals.results).flatMap(([key, publicRuns]) =>
      publicRuns.map((publicRun, i) => ({ publicRun, rawRun: raw.results[key][i], runPath: runRelativePath(key, raw.results[key][i].runNumber) })),
    );
    await mapWithConcurrency(runs, RUN_CONCURRENCY, async ({ publicRun, rawRun, runPath }) => {
      publicRun.files = await writeRunArtifacts(suiteId, runPath, rawRun, options, writer);
    });

    writer.writeJson('evals.json', evals);
    const summary = extractSuiteSummary(suiteId, evals) ?? undefined;
    return { suiteId, status: 'built', ...writer.totals(), summary };
  } catch (err) {
    fs.rmSync(suiteDir, { recursive: true, force: true });
    if (err instanceof NotPublishableError || err instanceof LeakError || err instanceof OverrideError) {
      return skipped(err.message);
    }
    throw err;
  }
}

/**
 * Rewrites `<outDir>/public-evals/suites.gen.json` so it lists exactly the
 * suite directories present. Entries come from this run's results when
 * available, then from the previous manifest, and only as a last resort from
 * re-reading a suite's `evals.json`.
 */
export function writeManifest(outDir: string, results: readonly SuiteBuildResult[] = []): number {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.mkdirSync(root, { recursive: true });

  const fresh = new Map(results.filter(r => r.summary).map(r => [r.suiteId, r.summary!]));
  const previous = readManifest(outDir);

  const entries = publishedSuiteIds(outDir)
    .map(id => fresh.get(id) ?? previous.get(id) ?? summarizeFromDisk(root, id))
    .filter((summary): summary is SuiteSummary => summary !== null)
    .sort((a, b) => a.testId.localeCompare(b.testId));

  // Compact: at hundreds of suites the manifest is the largest thing the landing page fetches.
  fs.writeFileSync(path.join(root, MANIFEST_FILE), JSON.stringify(entries) + '\n');
  return entries.length;
}

/** `<run>/<guide>/<task>/<guided|unguided>`, the layout both the harness and the dashboard use. */
export function runRelativePath(resultKey: string, runNumber: number): string {
  const [task, guide, runType] = resultKey.split(' - ');
  return `${runNumber}/${guide}/${task}/${runType}`;
}

// --- Incremental state ---

/** The recorded outcome for a suite if nothing that feeds the build has changed since; otherwise undefined. */
function unchangedOutcome(state: BuildState, ref: SuiteRef, allowlist: PublicAllowlist): SuiteBuildResult | undefined {
  const recorded = state.suites[ref.id];
  if (!recorded || state.builderVersion !== BUILDER_VERSION || recorded.generation !== ref.generation) {
    return undefined;
  }
  if (!sameSet(recorded.excludeGuides, overrideFor(allowlist, ref.id)?.excludeGuides ?? [])) {
    return undefined;
  }
  if (recorded.skipped) {
    if (!sameSet(recorded.skipped.releasedModels, allowlist.releasedModels)) {
      return undefined;
    }
    return { suiteId: ref.id, status: 'skipped', reason: recorded.skipped.reason, files: 0, bytes: 0, truncatedPatches: 0 };
  }
  return { suiteId: ref.id, status: 'unchanged', files: 0, bytes: 0, truncatedPatches: 0 };
}

function readState(outDir: string): BuildState {
  const file = path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE);
  if (!fs.existsSync(file)) {
    return { builderVersion: BUILDER_VERSION, suites: {} };
  }
  const state = JSON.parse(fs.readFileSync(file, 'utf8')) as BuildState;
  // Drop state for built suites whose directory is gone, so a manual delete forces a rebuild.
  const present = new Set(publishedSuiteIds(outDir));
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
  allowlist: PublicAllowlist,
): void {
  const next: BuildState = { builderVersion: BUILDER_VERSION, suites: {} };
  for (const result of results) {
    const ref = refById.get(result.suiteId);
    if (!ref || result.status === 'removed') {
      continue;
    }
    const entry: SuiteState = {
      generation: ref.generation,
      excludeGuides: overrideFor(allowlist, result.suiteId)?.excludeGuides ?? [],
    };
    if (result.status === 'skipped') {
      entry.skipped = { reason: result.reason ?? '', releasedModels: [...allowlist.releasedModels] };
    }
    next.suites[result.suiteId] = entry;
  }
  fs.mkdirSync(path.join(outDir, PUBLIC_EVALS_DIR), { recursive: true });
  fs.writeFileSync(path.join(outDir, PUBLIC_EVALS_DIR, STATE_FILE), JSON.stringify(next, null, 2) + '\n');
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort()[i]);
}

// --- Manifest helpers ---

function publishedSuiteIds(outDir: string): string[] {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'evals.json')))
    .map(entry => entry.name);
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
