import fs from 'node:fs';
import path from 'node:path';
import { baseAppsDir as defaultBaseAppsDir } from '../../core/paths.ts';
import { extractSuiteSummary } from '../../dashboard/summary-extractor.js';
import type { EvalsReport, RunResult } from '../lib/metrics.ts';
import { overrideFor, selectSuites } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { NotPublishableError } from './allowlists.ts';
import { OverrideError } from './overrides.ts';
import { patchFromFiles, preparePatch } from './patch.ts';
import type { PreparedPatch } from './patch.ts';
import { rebuildEvals } from './rebuild-evals.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { assertClean, LeakError, scrubString } from './scrub.ts';
import type { SuiteStore } from './suite-store.ts';

/**
 * Builds the public copy of eval suites: `public-evals/<suiteId>/evals.json`
 * plus, per run, `agent.patch` and `modern-web.log`, and a `suites.gen.json`
 * manifest over everything built. Each suite is independent; one failing suite
 * is reported and skipped without affecting the others.
 */

/** Directory name under the output root. Served at the same path on GitHub Pages. */
export const PUBLIC_EVALS_DIR = 'public-evals';

/** How many runs' artifacts are fetched at once. Each run is 2–3 small object reads. */
const RUN_CONCURRENCY = 16;

export interface BuildOptions {
  store: SuiteStore;
  /** Output root; suites are written under `<outDir>/public-evals/`. */
  outDir: string;
  allowlist: PublicAllowlist;
  /** Where to find base apps for legacy-layout diffs. Defaults to the repo's. */
  baseAppsDir?: string;
  /** Tokens (e.g. operator LDAPs) that must not appear anywhere in the output. */
  forbiddenTokens?: readonly string[];
}

export interface SuiteBuildResult {
  suiteId: string;
  status: 'built' | 'skipped';
  /** Why the suite was skipped. */
  reason?: string;
  files: number;
  bytes: number;
  truncatedPatches: number;
}

/** Builds every suite the allowlist selects, then rewrites the manifest. */
export async function buildSelectedSuites(options: BuildOptions): Promise<SuiteBuildResult[]> {
  const candidates = await options.store.listSuiteIds();
  const selected = selectSuites(options.allowlist, candidates);
  const results: SuiteBuildResult[] = [];
  for (const suiteId of selected) {
    results.push(await buildSuite(suiteId, options));
  }
  writeManifest(options.outDir);
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
    for (const chunk of chunked(runs, RUN_CONCURRENCY)) {
      await Promise.all(chunk.map(async ({ publicRun, rawRun, runPath }) => {
        publicRun.files = await writeRunArtifacts(suiteId, runPath, rawRun, options, writer);
      }));
    }

    writer.writeJson('evals.json', evals);
    return { suiteId, status: 'built', reason: undefined, ...writer.totals() };
  } catch (err) {
    fs.rmSync(suiteDir, { recursive: true, force: true });
    if (err instanceof NotPublishableError || err instanceof LeakError || err instanceof OverrideError) {
      return skipped(err.message);
    }
    throw err;
  }
}

/**
 * Rewrites `<outDir>/public-evals/suites.gen.json` from every suite directory
 * present, so the manifest always reflects exactly what is published.
 */
export function writeManifest(outDir: string): number {
  const root = path.join(outDir, PUBLIC_EVALS_DIR);
  fs.mkdirSync(root, { recursive: true });
  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'evals.json')))
    .map(entry => {
      const evals = JSON.parse(fs.readFileSync(path.join(root, entry.name, 'evals.json'), 'utf8')) as PublicEvals;
      return extractSuiteSummary(entry.name, evals);
    })
    .filter(summary => summary !== null)
    .sort((a, b) => a.testId.localeCompare(b.testId));
  fs.writeFileSync(path.join(root, 'suites.gen.json'), JSON.stringify(entries, null, 2) + '\n');
  return entries.length;
}

/** `<run>/<guide>/<task>/<guided|unguided>`, the layout both the harness and the dashboard use. */
export function runRelativePath(resultKey: string, runNumber: number): string {
  const [task, guide, runType] = resultKey.split(' - ');
  return `${runNumber}/${guide}/${task}/${runType}`;
}

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
  const baseText = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf8') : undefined;
  return patchFromFiles(rawRun.targetFile, baseText, agentFile.toString('utf8'));
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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
    this.write(relPath, JSON.stringify(value, null, 2) + '\n');
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
