import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  getTaskMap,
  resolveTaskGraderPath,
  TARGETS_DIR,
  ZERO_PASSRATE_PATCH_FILE,
  type TaskInfo,
} from '../../../../src/core/guide-validation.ts';
import { rootDir, suitesDir } from '../../../../src/core/paths.ts';
import {
  isSpecSkipped,
  PatchApplyError,
  runPlaywright,
  type PlaywrightSuite,
} from '../../../../src/grading/run-grader.ts';
import { Agents } from '../../../../src/harness/config.ts';

interface CliOptions {
  guides: string[];
  all: boolean;
  suites: string[];
  limit?: number;
  concurrency: number;
  json: boolean;
}

interface TargetEntry {
  taskKey: string;
  slug: string;
  taskName: string;
  taskInfo: TaskInfo;
  graderPath: string;
  zeroPassratePath?: string;
}

interface SuiteInfo {
  name: string;
  dir: string;
  agent: string;
}

interface SpecDiff {
  title: string;
  saved: string;
  now: string;
}

interface SpecCounts {
  passed: number;
  failed: number;
  timedOut: number;
  skipped: number;
}

interface ReplayEntry {
  status: 'MATCH' | 'DIFF' | 'PATCH_CONFLICT' | 'ERROR';
  suite: string;
  agent: string;
  runIndex: string;
  taskKey: string;
  condition: 'guided' | 'unguided';
  mode: 'patch' | 'single-file';
  graderPath: string;
  solutionPath: string;
  savedResultsPath: string;
  savedCounts?: SpecCounts;
  nowCounts?: SpecCounts;
  diffs?: SpecDiff[];
  error?: string;
}

interface ReplayJob {
  suite: SuiteInfo;
  runIndex: string;
  entry: TargetEntry;
  condition: 'guided' | 'unguided';
  mode: 'patch' | 'single-file';
  targetDirOrFile: string;
  solutionPath: string;
  savedResultsPath: string;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function printUsage(): void {
  console.log(`Usage: node .agents/skills/grader-replay/scripts/replay.ts [options]

Options:
  --guides <list>   Comma-separated guide slugs, paths, or task keys (default: changed graders vs origin/main)
  --all             Replay all tasks in getTaskMap() (required for shared test-fixture.ts / parser changes)
  --suites <list>   Comma-separated suite paths or folder names (default: latest nightly per agent)
  --limit <n>       Maximum replay runs to execute
  --concurrency <n> Parallel Playwright workers (default: 4)
  --json            Output machine-readable JSON only
  -h, --help        Show this help`);
}

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid ${flag} value: ${raw}`);
  }
  return n;
}

function parseCliArgs(argv: string[]): CliOptions {
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      guides: { type: 'string' },
      all: { type: 'boolean', default: false },
      suites: { type: 'string' },
      limit: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const guides = [...(values.guides ? values.guides.split(',') : []), ...positionals]
    .map((s) => s.trim())
    .filter(Boolean);

  if (values.all && guides.length > 0) {
    throw new Error('Cannot combine --all with --guides.');
  }

  return {
    guides,
    all: values.all,
    suites: values.suites ? values.suites.split(',').map((s) => s.trim()).filter(Boolean) : [],
    limit: values.limit !== undefined ? parsePositiveInt(values.limit, '--limit') : undefined,
    concurrency: parsePositiveInt(values.concurrency, '--concurrency'),
    json: values.json,
  };
}

function gitLines(args: string[]): string[] {
  const out = execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

function resolveZeroPassratePath(taskInfo: TaskInfo, taskName: string): string | undefined {
  const candidates = [
    path.join(taskInfo.guideDir, TARGETS_DIR, taskName, ZERO_PASSRATE_PATCH_FILE),
    path.join(taskInfo.guideDir, TARGETS_DIR, taskInfo.baseApp, ZERO_PASSRATE_PATCH_FILE),
    path.join(taskInfo.guideDir, ZERO_PASSRATE_PATCH_FILE),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.readFileSync(candidate, 'utf8').trim().length > 0) {
      return path.resolve(candidate);
    }
  }
  return undefined;
}

function selectTargetEntries(opts: CliOptions): TargetEntry[] {
  const allEntries: TargetEntry[] = [];

  for (const [taskKey, taskInfo] of getTaskMap().entries()) {
    const slug = path.basename(taskInfo.guideDir);
    const taskName = taskKey.startsWith(`${slug}/`) ? taskKey.slice(slug.length + 1) : taskKey;
    const graderPath = path.resolve(resolveTaskGraderPath(taskInfo, taskName));
    if (!fs.existsSync(graderPath)) continue;
    allEntries.push({
      taskKey,
      slug,
      taskName,
      taskInfo,
      graderPath,
      zeroPassratePath: resolveZeroPassratePath(taskInfo, taskName),
    });
  }

  if (opts.all) {
    return allEntries;
  }

  if (opts.guides.length > 0) {
    const matched: TargetEntry[] = [];
    const seen = new Set<string>();

    for (const token of opts.guides) {
      const normalized = token.replace(/\/+$/, '');
      const resolvedToken = path.resolve(rootDir, normalized);
      const hits = allEntries.filter((entry) => {
        const relGuide = path.relative(rootDir, entry.taskInfo.guideDir);
        const relGrader = path.relative(rootDir, entry.graderPath);
        return (
          entry.slug === normalized ||
          entry.taskKey === normalized ||
          relGuide === normalized ||
          relGrader === normalized ||
          entry.taskInfo.guideDir === resolvedToken ||
          entry.graderPath === resolvedToken
        );
      });

      if (hits.length === 0) {
        throw new Error(`No grader tasks matched --guides selector "${token}".`);
      }
      for (const hit of hits) {
        if (!seen.has(hit.taskKey)) {
          seen.add(hit.taskKey);
          matched.push(hit);
        }
      }
    }
    return matched;
  }

  const changedFiles = Array.from(
    new Set([
      ...gitLines(['diff', '--name-only', 'origin/main...HEAD']),
      ...gitLines(['diff', '--name-only', '--cached']),
      ...gitLines(['diff', '--name-only']),
      ...gitLines(['ls-files', '--others', '--exclude-standard']),
    ])
  );
  const changedGraders = new Set(
    changedFiles
      .filter((f) => f.endsWith('/grader.ts') || f === 'grader.ts')
      .map((f) => path.resolve(rootDir, f))
  );

  if (changedGraders.size === 0) {
    const gradingInfra = changedFiles.filter((f) => f.startsWith('src/grading/'));
    if (gradingInfra.length > 0) {
      throw new Error(
        `Shared grading files changed (${gradingInfra.join(', ')}), ` +
          `but no grader.ts files were edited. Re-run with --all (or --guides <slug,...>).`
      );
    }
    throw new Error('No grader.ts changes found against origin/main. Pass --guides <slug,...> or --all.');
  }

  return allEntries.filter((entry) => changedGraders.has(entry.graderPath));
}

function readSuiteAgent(suiteDir: string, folderName: string): string {
  const configPath = path.join(suiteDir, 'suite_config.json');
  if (fs.existsSync(configPath)) {
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (isRecord(parsed) && typeof parsed.agent === 'string' && parsed.agent.trim()) {
      return parsed.agent.trim();
    }
  }
  const matched = Object.values(Agents).find((a) => folderName === a || folderName.endsWith(`-${a}`));
  return matched ?? folderName;
}

function listRunIndices(suiteDir: string): string[] {
  return fs
    .readdirSync(suiteDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => Number(a) - Number(b));
}

function suiteTimestampMs(suite: SuiteInfo): number {
  const match = suite.name.match(/(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})(?:-(\d{2}))?/);
  if (match) {
    const parsed = Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4] ?? '00'}Z`);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fs.statSync(suite.dir).mtimeMs;
}

function discoverSuites(opts: CliOptions): SuiteInfo[] {
  const searchDirs = [suitesDir, path.join(os.homedir(), 'guidance-evals')];

  if (opts.suites.length > 0) {
    return opts.suites.map((raw) => {
      let suiteDir: string | undefined;
      if (fs.existsSync(raw) && fs.statSync(raw).isDirectory()) {
        suiteDir = path.resolve(raw);
      } else {
        for (const baseDir of searchDirs) {
          const candidate = path.join(baseDir, raw);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            suiteDir = path.resolve(candidate);
            break;
          }
        }
      }
      if (!suiteDir) {
        throw new Error(`Eval suite not found: "${raw}" (checked CWD and ${searchDirs.join(', ')})`);
      }
      if (listRunIndices(suiteDir).length === 0) {
        throw new Error(`Eval suite has no numeric run directory (e.g. 1/): ${suiteDir}`);
      }
      const name = path.basename(suiteDir);
      return { name, dir: suiteDir, agent: readSuiteAgent(suiteDir, name) };
    });
  }

  const byName = new Map<string, SuiteInfo>();
  for (const baseDir of searchDirs) {
    if (!fs.existsSync(baseDir)) continue;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const suiteDir = path.join(baseDir, entry.name);
      if (listRunIndices(suiteDir).length === 0 || byName.has(entry.name)) continue;
      byName.set(entry.name, {
        name: entry.name,
        dir: suiteDir,
        agent: readSuiteAgent(suiteDir, entry.name),
      });
    }
  }

  if (byName.size === 0) {
    throw new Error(`No eval suites found in ${searchDirs.join(', ')}. Pull suites from gs://guidance-evals/ or pass --suites.`);
  }

  const allSuites = Array.from(byName.values());
  const nightlySuites = allSuites.filter((s) => s.name.startsWith('nightly-'));
  const candidates = (nightlySuites.length > 0 ? nightlySuites : allSuites).sort(
    (a, b) => suiteTimestampMs(b) - suiteTimestampMs(a)
  );
  const latestByAgent = new Map<string, SuiteInfo>();
  for (const suite of candidates) {
    if (!latestByAgent.has(suite.agent)) {
      latestByAgent.set(suite.agent, suite);
    }
  }
  return Array.from(latestByAgent.values());
}

function collectReplayJobs(entries: TargetEntry[], suites: SuiteInfo[], limit?: number): ReplayJob[] {
  const jobs: ReplayJob[] = [];

  for (const suite of suites) {
    for (const runIndex of listRunIndices(suite.dir)) {
      for (const entry of entries) {
        for (const condition of ['guided', 'unguided'] as const) {
          const condDir = path.join(suite.dir, runIndex, entry.slug, entry.taskName, condition);
          const savedResultsPath = path.join(condDir, `${entry.slug}_results.json`);
          if (!fs.existsSync(savedResultsPath)) continue;

          const patchPath = path.join(condDir, 'agent.patch');
          const indexHtmlPath = path.join(condDir, 'index.html');

          if (fs.existsSync(patchPath)) {
            jobs.push({
              suite,
              runIndex,
              entry,
              condition,
              mode: 'patch',
              targetDirOrFile: path.dirname(entry.graderPath),
              solutionPath: patchPath,
              savedResultsPath,
            });
          } else if (fs.existsSync(indexHtmlPath)) {
            jobs.push({
              suite,
              runIndex,
              entry,
              condition,
              mode: 'single-file',
              targetDirOrFile: indexHtmlPath,
              solutionPath: indexHtmlPath,
              savedResultsPath,
            });
          }
        }
      }
    }
  }

  return limit !== undefined ? jobs.slice(0, limit) : jobs;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker())
  );
  return results;
}

function isSpecTimedOut(spec: {
  tests?: Array<{ results?: Array<{ status?: string }> }>;
}): boolean {
  return Boolean(spec.tests?.some((t) => t.results?.at(-1)?.status === 'timedOut'));
}

function extractSpecMap(pwJson: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!isRecord(pwJson) || !Array.isArray(pwJson.suites)) return map;

  function visit(suite: PlaywrightSuite, prefix = ''): void {
    for (const spec of suite.specs || []) {
      const status = isSpecSkipped(spec)
        ? 'skipped'
        : spec.ok
          ? 'pass'
          : isSpecTimedOut(spec)
            ? 'timedOut'
            : 'fail';
      map.set(`${prefix}${spec.title}`, status);
    }
    for (const child of suite.suites || []) {
      visit(child, `${prefix}${child.title} > `);
    }
  }

  for (const s of pwJson.suites) {
    if (isRecord(s)) visit(s as unknown as PlaywrightSuite);
  }
  return map;
}

function summarizeCounts(specMap: Map<string, string>): SpecCounts {
  let passed = 0;
  let failed = 0;
  let timedOut = 0;
  let skipped = 0;
  for (const status of specMap.values()) {
    if (status === 'pass') passed++;
    else if (status === 'timedOut') timedOut++;
    else if (status === 'fail') failed++;
    else if (status === 'skipped') skipped++;
  }
  return { passed, failed, timedOut, skipped };
}

function formatCounts(counts: SpecCounts): string {
  const notes: string[] = [];
  if (counts.timedOut > 0) notes.push(`${counts.timedOut} timedOut`);
  if (counts.skipped > 0) notes.push(`${counts.skipped} skip`);
  const suffix = notes.length > 0 ? `, ${notes.join(', ')}` : '';
  return `${counts.passed}/${counts.passed + counts.failed + counts.timedOut} pass${suffix}`;
}

async function runReplayJob(job: ReplayJob, testResultsDir: string): Promise<ReplayEntry> {
  const base: Omit<ReplayEntry, 'status'> = {
    suite: job.suite.name,
    agent: job.suite.agent,
    runIndex: job.runIndex,
    taskKey: job.entry.taskKey,
    condition: job.condition,
    mode: job.mode,
    graderPath: path.relative(rootDir, job.entry.graderPath),
    solutionPath: job.solutionPath,
    savedResultsPath: job.savedResultsPath,
  };

  try {
    const savedMap = extractSpecMap(JSON.parse(fs.readFileSync(job.savedResultsPath, 'utf8')));
    const savedCounts = summarizeCounts(savedMap);

    const currentJson: unknown = await runPlaywright(job.targetDirOrFile, job.entry.graderPath, {
      stdio: 'ignore',
      patchFile: job.mode === 'patch' ? job.solutionPath : undefined,
      zeroPassrateFile: job.mode === 'patch' ? job.entry.zeroPassratePath : undefined,
      testResultsDir,
      baselineTarget: job.entry.taskInfo.baselineTarget,
    });

    if (isRecord(currentJson) && Array.isArray(currentJson.errors) && currentJson.errors.length > 0) {
      const msgs = currentJson.errors
        .map((e) => (isRecord(e) && typeof e.message === 'string' ? e.message : String(e)))
        .join('; ');
      return { ...base, status: 'ERROR', savedCounts, error: msgs };
    }

    const currentMap = extractSpecMap(currentJson);
    const nowCounts = summarizeCounts(currentMap);
    const diffs: SpecDiff[] = [];

    for (const title of new Set([...savedMap.keys(), ...currentMap.keys()])) {
      const saved = savedMap.get(title) ?? '<missing>';
      const now = currentMap.get(title) ?? '<missing>';
      if (saved !== now) {
        diffs.push({ title, saved, now });
      }
    }

    return {
      ...base,
      status: diffs.length === 0 ? 'MATCH' : 'DIFF',
      savedCounts,
      nowCounts,
      diffs: diffs.length > 0 ? diffs : undefined,
    };
  } catch (err) {
    if (err instanceof PatchApplyError) {
      return { ...base, status: 'PATCH_CONFLICT', error: err.message };
    }
    return {
      ...base,
      status: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  const entries = selectTargetEntries(opts);
  const suites = discoverSuites(opts);
  const jobs = collectReplayJobs(entries, suites, opts.limit);

  if (jobs.length === 0) {
    const errMsg = 'No replayable tasks with saved *_results.json matched in the selected suites.';
    if (opts.json) {
      console.log(JSON.stringify({ suites, results: [], error: errMsg }, null, 2));
    } else {
      console.error(errMsg);
    }
    process.exit(1);
  }

  if (!opts.json) {
    console.log(`Replaying ${jobs.length} saved run(s) for ${entries.length} target(s) across ${suites.length} suite(s):`);
    for (const s of suites) console.log(`  - ${s.name} (${s.agent})`);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-replay-'));
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};

  let replayResults: ReplayEntry[];
  try {
    replayResults = await mapPool(jobs, opts.concurrency, (job, idx) =>
      runReplayJob(job, path.join(tmpRoot, `task-${idx}`))
    );
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  const matches = replayResults.filter((r) => r.status === 'MATCH').length;
  const diffs = replayResults.filter((r) => r.status === 'DIFF');
  const conflicts = replayResults.filter((r) => r.status === 'PATCH_CONFLICT');
  const errors = replayResults.filter((r) => r.status === 'ERROR');

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          suites: suites.map((s) => ({ name: s.name, agent: s.agent, dir: s.dir })),
          summary: {
            total: replayResults.length,
            matches,
            diffs: diffs.length,
            patchConflicts: conflicts.length,
            errors: errors.length,
          },
          results: replayResults,
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `\nReplay summary: total=${replayResults.length}, matches=${matches}, diffs=${diffs.length}, patch_conflicts=${conflicts.length}, errors=${errors.length}\n`
    );
    for (const item of diffs) {
      const savedStr = item.savedCounts ? formatCounts(item.savedCounts) : '?';
      const nowStr = item.nowCounts ? formatCounts(item.nowCounts) : '?';
      console.log(`DIFF ${item.suite} [${item.agent}] ${item.taskKey}/${item.condition} (${savedStr} -> ${nowStr})`);
      console.log(`  solution: ${item.solutionPath}`);
      console.log(`  grader:   ${item.graderPath}`);
      for (const d of item.diffs || []) {
        console.log(`  - "${d.title}": saved=${d.saved} -> now=${d.now}`);
      }
    }
    for (const item of conflicts) {
      console.log(`PATCH_CONFLICT ${item.suite} [${item.agent}] ${item.taskKey}/${item.condition}: ${item.error}`);
    }
    for (const item of errors) {
      console.log(`ERROR ${item.suite} [${item.agent}] ${item.taskKey}/${item.condition}: ${item.error}`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
