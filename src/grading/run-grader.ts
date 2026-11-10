import { spawn, type ChildProcess, type StdioOptions } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rootDir, outDir, guidesDir, ensureDiskNodeCompileCache } from '../core/paths.ts';
import { cRed, cYellow, cCyan } from '../core/colors.ts';
import { TARGETS_DIR, getActiveSolutionAgents, SOLUTION_PATCH_FILES, type SolutionAgent, ZERO_PASSRATE_PATCH_FILE, GRADER_FILE, getSupportedBaseApps } from '../core/guide-validation.ts';
import { copyBaseAppToWorkspace } from '../harness/lib/utils.ts';
import { createIsolatedHome, cleanupIsolatedHome } from '../harness/lib/agent-shared.ts';
import { applyPatchSync } from '../core/patch-utils.ts';
import { startTargetServer, killServerProcessTree } from './target-server.ts';
import { checkTargetPageLoad, type PageLoadResult } from './test-fixture.ts';

export type { PageLoadResult } from './test-fixture.ts';

export interface PlaywrightOptions {
  targetPathAbs: string;
  graderPath: string;
  reporters: string[];
  testResultsDir?: string;
  jsonOutputName?: string;
  pageLoadOutputName?: string;
  serverPidsOutputName?: string;
  patchFile?: string;
  stdio?: StdioOptions;
  baselineTarget?: string;
  prebuiltTargetUrl?: string;
  prebuiltTargetError?: string;
}

export class PatchApplyError extends Error {
  patchPath: string;
  constructor(patchPath: string, details?: string) {
    super(`Failed to apply ${path.basename(patchPath)}: ${details || 'unknown patch error'}`);
    this.name = 'PatchApplyError';
    this.patchPath = patchPath;
  }
}

export async function stageGradingWorkspace(
  baseApp: string,
  patchFile: string,
  zeroPassrateFile?: string
): Promise<{ workDir: string; cleanup: () => void }> {
  const tempHome = createIsolatedHome('grade-run');
  const workDir = path.join(tempHome, baseApp);
  const cleanup = () => { try { cleanupIsolatedHome(tempHome); } catch {} };

  try {
    await copyBaseAppToWorkspace(baseApp, workDir);

    for (const file of [zeroPassrateFile, patchFile]) {
      if (file && fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim()) {
        const res = applyPatchSync(workDir, file);
        if (!res.success) {
          throw new PatchApplyError(file, res.error);
        }
      }
    }

    return { workDir, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

export function executePlaywright(opts: PlaywrightOptions): ChildProcess {
  const playwrightConfig = path.join(import.meta.dirname, 'playwright.config.ts');
  const reporterArgs = opts.reporters.length > 0 ? ['--reporter=' + opts.reporters.join(',')] : [];

  const isDir = fs.existsSync(opts.targetPathAbs) && fs.statSync(opts.targetPathAbs).isDirectory();
  const appDir = isDir ? opts.targetPathAbs : path.dirname(opts.targetPathAbs);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TARGET_FILE: opts.targetPathAbs,
    BASELINE_TARGET: opts.baselineTarget || process.env.BASELINE_TARGET || 'widely',
  };
  ensureDiskNodeCompileCache(env, 'harness');
  delete env.TARGET_URL;

  if (opts.prebuiltTargetUrl) {
    env.GD_PREBUILT_TARGET_URL = opts.prebuiltTargetUrl;
  } else {
    delete env.GD_PREBUILT_TARGET_URL;
  }

  if (opts.prebuiltTargetError) {
    env.GD_PREBUILT_TARGET_ERROR = opts.prebuiltTargetError;
  } else {
    delete env.GD_PREBUILT_TARGET_ERROR;
  }

  if (opts.patchFile) {
    env.PATCH_FILE = path.resolve(opts.patchFile);
  } else {
    delete env.PATCH_FILE;
  }

  if (opts.testResultsDir) {
    env.PLAYWRIGHT_OUTPUT_DIR = opts.testResultsDir;
  }

  if (opts.jsonOutputName) {
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = opts.jsonOutputName;
    env.PWTEST_CACHE_DIR = `${opts.jsonOutputName}-cache`;
  }

  if (opts.pageLoadOutputName) {
    env.PAGE_LOAD_OUTPUT = opts.pageLoadOutputName;
  } else {
    delete env.PAGE_LOAD_OUTPUT;
  }

  if (opts.serverPidsOutputName) {
    env.SERVER_PIDS_FILE = opts.serverPidsOutputName;
  } else {
    delete env.SERVER_PIDS_FILE;
  }

  const resolvedGraderPath = path.resolve(opts.graderPath);
  if (!resolvedGraderPath.startsWith(guidesDir + path.sep)) {
    env.PLAYWRIGHT_TEST_DIR = path.dirname(resolvedGraderPath);
  }

  const playwrightBin = path.join(rootDir, 'node_modules', '.bin', 'playwright');

  return spawn(playwrightBin, ['test', '-c', playwrightConfig, opts.graderPath, ...reporterArgs], {
    cwd: appDir,
    stdio: opts.stdio || 'inherit',
    env
  });
}

export interface RunPlaywrightOptions {
  stdio?: StdioOptions;
  patchFile?: string;
  zeroPassrateFile?: string;
  testResultsDir?: string;
  baselineTarget?: string;
}

function graderUsesTargetServer(graderPath: string): boolean {
  if (!fs.existsSync(graderPath)) return false;
  const content = fs.readFileSync(graderPath, 'utf8').replace(/\bprocess\.env\.TARGET_URL\b/g, '');
  return /\bTARGET_URL\b/.test(content);
}

export async function runPlaywright(
  targetPathAbs: string,
  graderPath: string,
  optionsOrStdio: RunPlaywrightOptions | StdioOptions = 'inherit',
  maybePatchFile?: string,
  maybeTestResultsDir?: string,
): Promise<any> {
  const options: RunPlaywrightOptions =
    typeof optionsOrStdio === 'object' && optionsOrStdio !== null && !Array.isArray(optionsOrStdio)
      ? optionsOrStdio
      : {
          stdio: optionsOrStdio,
          patchFile: maybePatchFile,
          testResultsDir: maybeTestResultsDir,
        };

  const stdio = options.stdio ?? 'inherit';
  const patchFile = options.patchFile;
  const zeroPassrateFile = options.zeroPassrateFile;
  const testResultsDir = options.testResultsDir;
  const baselineTarget = options.baselineTarget;

  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  const tmpPageLoadJson = `${tmpJson}-pageload.json`;
  const tmpServerPidsFile = `${tmpJson}-servers.pids`;

  const isDir = fs.existsSync(targetPathAbs) && fs.statSync(targetPathAbs).isDirectory();
  let effectiveTargetPath = targetPathAbs;
  let cleanupGradingDir: (() => void) | null = null;

  if (patchFile) {
    const baseApp = path.basename(path.dirname(graderPath));
    const { workDir: tempGradingDir, cleanup } = await stageGradingWorkspace(baseApp, patchFile, zeroPassrateFile);
    cleanupGradingDir = cleanup;
    effectiveTargetPath = isDir ? tempGradingDir : path.join(tempGradingDir, path.basename(targetPathAbs));
  }

  // Give each grading run its own output dir. The config's fallback (out/test-results) is shared
  // across parallel runs, and Playwright wipes it at startup, so parallel runs clobber each other.
  const effectiveAppDir = isDir ? effectiveTargetPath : path.dirname(effectiveTargetPath);
  const resolvedTestResultsDir = testResultsDir || path.join(effectiveAppDir, 'test-results');
  let stopTargetServer: (() => Promise<void>) | null = null;

  try {
    let prebuiltTargetUrl: string | undefined;
    let prebuiltTargetError: string | undefined;
    let prebuiltBuildWarning: string | undefined;

    if (graderUsesTargetServer(graderPath) && fs.existsSync(path.join(effectiveAppDir, 'package.json'))) {
      try {
        const server = await startTargetServer(effectiveAppDir, {
          targetFile: effectiveTargetPath,
          quiet: stdio === 'ignore',
        });
        prebuiltTargetUrl = server.url;
        stopTargetServer = server.stop;
      } catch (err: any) {
        prebuiltTargetError = err.message || String(err);
        if (prebuiltTargetError?.includes('Failed to build target app')) {
          prebuiltBuildWarning = prebuiltTargetError;
        }
      }
    }

    let stderrData = '';
    const child = executePlaywright({
      targetPathAbs: effectiveTargetPath,
      graderPath,
      reporters: ['json'],
      testResultsDir: resolvedTestResultsDir,
      jsonOutputName: tmpJson,
      pageLoadOutputName: tmpPageLoadJson,
      serverPidsOutputName: tmpServerPidsFile,
      patchFile: patchFile,
      stdio: stdio === 'ignore' || stdio === 'pipe' ? ['ignore', 'ignore', 'pipe'] : stdio,
      baselineTarget,
      prebuiltTargetUrl,
      prebuiltTargetError,
    });

    child.stdout?.resume();

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
    }

    await once(child, 'close');

    await fs.promises.rm(resolvedTestResultsDir, { recursive: true, force: true }).catch(() => {});

    const content = await fs.promises.readFile(tmpJson, 'utf-8').catch(() => null);
    if (!content) {
      throw new Error(`Playwright did not produce a JSON report at ${tmpJson}.\nStderr: ${stderrData}`);
    }

    await fs.promises.unlink(tmpJson).catch(() => {});
    const parsed = JSON.parse(content);

    let pageLoad: PageLoadResult | undefined;
    try {
      if (stopTargetServer && prebuiltTargetUrl) {
        pageLoad = await checkTargetPageLoad(effectiveAppDir, undefined, { serverUrl: prebuiltTargetUrl });
      } else {
        pageLoad = await checkTargetPageLoad(effectiveAppDir, undefined, { buildWarning: prebuiltBuildWarning });
      }
    } catch (err) {
      pageLoad = {
        ok: false,
        errors: [`[browser] ${err instanceof Error ? err.message : String(err)}`],
      };
    }

    const pageLoadOutputPayload: PageLoadResult = pageLoad ?? { ok: true, errors: [], noPage: true };
    await fs.promises.writeFile(tmpPageLoadJson, JSON.stringify(pageLoadOutputPayload)).catch(() => {});
    if (process.env.PAGE_LOAD_OUTPUT) {
      await fs.promises.writeFile(process.env.PAGE_LOAD_OUTPUT, JSON.stringify(pageLoadOutputPayload)).catch(() => {});
    }

    if (pageLoad && !pageLoad.noPage) {
      parsed.pageLoad = pageLoad;
    }
    return parsed;
  } finally {
    if (stopTargetServer) {
      await stopTargetServer().catch(() => {});
    }
    try {
      if (fs.existsSync(tmpServerPidsFile)) {
        const pidLines = fs.readFileSync(tmpServerPidsFile, 'utf8').split('\n');
        for (const line of pidLines) {
          const pid = Number(line.trim());
          if (Number.isInteger(pid) && pid > 1) {
            killServerProcessTree(pid);
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
    await fs.promises.unlink(tmpServerPidsFile).catch(() => {});
    await fs.promises.unlink(tmpPageLoadJson).catch(() => {});
    await fs.promises.rm(`${tmpJson}-cache`, { recursive: true, force: true }).catch(() => {});
    if (cleanupGradingDir) {
      cleanupGradingDir();
    }
  }
}

async function runPlaywrightCalibration(
  targetPathAbs: string,
  graderPath: string,
  patchFile: string,
  result: CalibrationResult,
  zeroPassrateFile?: string,
  testResultsDir?: string
): Promise<any> {
  const results = await runPlaywright(targetPathAbs, graderPath, {
    stdio: 'ignore',
    patchFile,
    zeroPassrateFile,
    testResultsDir,
    baselineTarget: 'widely',
  })
    .catch(err => {
      result.errorDetails = `Dev server crashed or failed to run against ${path.basename(patchFile)}: ${err.message}`;
      return null;
    });

  if (!results) {
    return null;
  }

  if (results.errors && results.errors.length > 0) {
    result.errorDetails = `Playwright global/compilation errors:\n` +
      results.errors.map((e: any) => e.message).join('\n');
    return null;
  }

  return results;
}

export interface PlaywrightSuite {
  title: string;
  specs?: Array<{
    title: string;
    ok: boolean;
    tests?: Array<{ status?: string; results?: Array<{ status?: string }> }>;
  }>;
  suites?: PlaywrightSuite[];
}

export function isSpecSkipped(spec: {
  tests?: Array<{ status?: string; results?: Array<{ status?: string }> }>;
}): boolean {
  if (!spec.tests || spec.tests.length === 0) return false;
  return spec.tests.every(
    t => t.status === 'skipped' || (t.results && t.results.length > 0 && t.results.every(r => r.status === 'skipped'))
  );
}

export function collectSpecs(suite: PlaywrightSuite, ok: boolean, prefix = ''): string[] {
  const results: string[] = [];
  for (const spec of suite.specs || []) {
    if (isSpecSkipped(spec)) continue;
    if (spec.ok === ok) results.push(`${prefix}${spec.title}`);
  }
  for (const child of suite.suites || []) {
    results.push(...collectSpecs(child, ok, `${prefix}${child.title} > `));
  }
  return results;
}

export function printFailingSpecs(suite: PlaywrightSuite, prefix = ''): void {
  const specs = suite.specs || [];
  for (const spec of specs) {
    if (isSpecSkipped(spec)) continue;
    if (!spec.ok) {
      console.log(cRed(`  - Failed: ${prefix}${spec.title}`));
    }
  }

  const childSuites = suite.suites || [];
  for (const child of childSuites) {
    printFailingSpecs(child, `${prefix}${child.title} > `);
  }
}

export function printPassingSpecs(suite: PlaywrightSuite, prefix = ''): void {
  const specs = suite.specs || [];
  for (const spec of specs) {
    if (isSpecSkipped(spec)) continue;
    if (spec.ok) {
      console.log(cRed(`  - Passed (should have failed): ${prefix}${spec.title}`));
    }
  }

  const childSuites = suite.suites || [];
  for (const child of childSuites) {
    printPassingSpecs(child, `${prefix}${child.title} > `);
  }
}

export function collectPlaywrightErrors(resultsJson: any): string {
  const errors: string[] = [];
  const seen = new Set<string>();

  function traverseSuite(suite: any, prefix = '') {
    const title = prefix ? `${prefix} > ${suite.title}` : suite?.title || '';

    for (const spec of suite?.specs || []) {
      if (spec.ok) continue;

      for (const test of spec?.tests || []) {
        for (const res of test?.results || []) {
          const errorList = res?.errors?.length ? res.errors : (res?.error ? [res.error] : []);
          for (const err of errorList) {
            if (!err?.message) continue;
            const fullTitle = title ? `${title} > ${spec.title}` : spec.title;
            const errorStr = `Test: ${fullTitle}\nError: ${err.message}\nStack: ${err.stack || ''}`;
            if (!seen.has(errorStr)) {
              seen.add(errorStr);
              errors.push(errorStr);
            }
          }
        }
      }
    }

    for (const child of suite?.suites || []) {
      traverseSuite(child, title);
    }
  }

  for (const suite of resultsJson?.suites || []) {
    traverseSuite(suite);
  }

  return errors.join('\n\n');
}

export interface SolutionTestResult {
  passed: number;
  failed: number;
  failingTests: string[];
}

export interface CalibrationResult {
  success: boolean;
  errorDetails?: string;
  solutions: Partial<Record<SolutionAgent, SolutionTestResult>>;
  zeroPassrate: { passed: number; failed: number; passingTests: string[] };
  sharedFailingTests?: string[];
}

export function findSharedFailingTests(
  solutions: Partial<Record<SolutionAgent, SolutionTestResult>>,
  activeAgents: SolutionAgent[]
): string[] {
  if (activeAgents.length === 0) return [];
  const lists = activeAgents.map(a => solutions[a]?.failingTests ?? []);
  if (lists.some(l => l.length === 0)) return [];
  const [first, ...rest] = lists;
  return first.filter(testTitle => rest.every(l => l.includes(testTitle)));
}

export async function testTargetGrader(guideDirAbs: string, baseApp: string): Promise<CalibrationResult> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const zeroPassratePatch = path.join(targetDir, ZERO_PASSRATE_PATCH_FILE);
  const graderPath = path.join(targetDir, GRADER_FILE);

  const activeAgents = getActiveSolutionAgents(targetDir);
  const solutions: Partial<Record<SolutionAgent, SolutionTestResult>> = {};
  for (const agent of activeAgents) {
    solutions[agent] = { passed: 0, failed: 0, failingTests: [] };
  }

  const result: CalibrationResult = {
    success: false,
    solutions,
    zeroPassrate: { passed: 0, failed: 0, passingTests: [] }
  };

  const missingSolutions = activeAgents.filter(agent => !fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[agent])));
  if (missingSolutions.length > 0 || !fs.existsSync(zeroPassratePatch) || !fs.existsSync(graderPath)) {
    result.errorDetails = `Missing patch or grader files in ${targetDir}`;
    return result;
  }

  const resolvedGuideDir = path.resolve(guideDirAbs);
  const slug = path.basename(resolvedGuideDir);
  const parentDir = path.basename(path.dirname(resolvedGuideDir));
  const category = parentDir === 'guides' ? slug : parentDir;
  const testResultsBaseDir = path.join(outDir, 'guides', category, slug, baseApp, 'test-results');

  // Golden calibration across active AI solution diffs + zero-passrate calibration in parallel
  const solutionStatus: Record<string, string> = {};
  const solutionErrors: string[] = [];
  let allSolutionsPassed = true;

  const solutionCalibrationTasks = activeAgents.map(async (agent) => {
    const solPatchFile = SOLUTION_PATCH_FILES[agent];
    const solutionPatch = path.join(targetDir, solPatchFile);
    const solutionTestResultsDir = path.join(testResultsBaseDir, `solution-${agent}`);
    let unexpected = 0;
    console.log(cYellow(`\nRunning against ${baseApp} with ${solPatchFile} (${agent})... (Expecting 100% pass)`));
    const solutionResults = await runPlaywrightCalibration(targetDir, graderPath, solutionPatch, result, undefined, solutionTestResultsDir);

    if (!solutionResults) {
      allSolutionsPassed = false;
      solutionStatus[agent] = `❌ FAILED (Dev server crashed or compile error)`;
      solutionErrors.push(`[${solPatchFile}] Dev server crashed or compile error: ${result.errorDetails || 'Unknown error'}`);
      return;
    }

    unexpected = solutionResults.stats?.unexpected || 0;
    const expected = solutionResults.stats?.expected || 0;
    if (!result.solutions[agent]) {
      result.solutions[agent] = { passed: 0, failed: 0, failingTests: [] };
    }
    result.solutions[agent]!.passed = expected;
    result.solutions[agent]!.failed = unexpected;

    if (expected === 0 && unexpected === 0) {
      allSolutionsPassed = false;
      solutionStatus[agent] = `❌ FAILED (No tests were run)`;
      solutionErrors.push(`[${solPatchFile}] No tests were run.`);
    } else if (unexpected > 0) {
      allSolutionsPassed = false;
      solutionStatus[agent] = `❌ FAILED (${expected} passed, ${unexpected} failed)`;
      result.solutions[agent]!.failingTests = solutionResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, false)) || [];
      const pwErrors = collectPlaywrightErrors(solutionResults);
      solutionErrors.push(`[${solPatchFile}] failed ${unexpected} tests:\n\n${pwErrors}`);
      solutionResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
    } else {
      solutionStatus[agent] = `✅ PASSED (${expected}/${expected} passed)`;
    }
  });

  let zeroPassrateStatus = '';
  let zeroPassrateFailed = false;
  const zeroPassrateTask = (async () => {
    let passed = 0;
    const zeroPassrateTestResultsDir = path.join(testResultsBaseDir, 'zero-passrate');
    console.log(cYellow(`Running against ${baseApp} with ${ZERO_PASSRATE_PATCH_FILE}... (Expecting 100% fail)`));
    const zeroPassrateResults = await runPlaywrightCalibration(targetDir, graderPath, zeroPassratePatch, result, undefined, zeroPassrateTestResultsDir);

    if (!zeroPassrateResults) {
      zeroPassrateFailed = true;
      zeroPassrateStatus = `❌ FAILED (Dev server crashed or compile error)`;
      return;
    }

    passed = zeroPassrateResults.stats?.expected || 0;
    const failed = zeroPassrateResults.stats?.unexpected || 0;
    result.zeroPassrate.passed = passed;
    result.zeroPassrate.failed = failed;

    if (passed === 0 && failed === 0) {
      zeroPassrateFailed = true;
      zeroPassrateStatus = `❌ FAILED (No tests were run for ${ZERO_PASSRATE_PATCH_FILE})`;
    } else if (passed > 0) {
      zeroPassrateFailed = true;
      result.zeroPassrate.passingTests = zeroPassrateResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, true)) || [];
      zeroPassrateStatus = `❌ FAILED ([${ZERO_PASSRATE_PATCH_FILE}] incorrectly passed ${passed} tests:\n\n${collectPlaywrightErrors(zeroPassrateResults)})`;
      zeroPassrateResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
    } else {
      zeroPassrateStatus = `✅ PASSED (0 tests passed, as expected for anti-pattern)`;
    }
  })();

  await Promise.all([...solutionCalibrationTasks, zeroPassrateTask]);

  if (!allSolutionsPassed || zeroPassrateFailed) {
    const sharedFailingTests = findSharedFailingTests(result.solutions, activeAgents);
    if (sharedFailingTests.length > 0) {
      result.sharedFailingTests = sharedFailingTests;
    }
    const sharedBanner = sharedFailingTests.length > 0
      ? `\n\n⚠️  SHARED FAILING TESTS ACROSS ALL ${activeAgents.length} GOLDEN SOLUTIONS (fail-fast calibration abort):\n` +
        sharedFailingTests.map(t => `   - ${t}`).join('\n')
      : '';
    const statusSummary = activeAgents.map(a => `   - ${a}: ${solutionStatus[a] || 'Unknown'}`).join('\n') +
      `\n   - zero-passrate: ${zeroPassrateStatus}`;
    result.errorDetails = `Calibration results summary:\n${statusSummary}\n\n` +
      sharedBanner +
      (solutionErrors.length > 0 ? `\n\nSolution failure details:\n\n` + solutionErrors.join('\n\n---\n\n') : '') +
      (zeroPassrateFailed && result.zeroPassrate.passed > 0 ? `\n\nZero-passrate details:\n${zeroPassrateStatus}` : '');
    return result;
  }

  result.success = true;
  return result;
}

export async function testGrader(targetDirRaw: string): Promise<CalibrationResult> {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRaw);

  // Direct target base app path (e.g. guides/css/size-aware-styling/targets/daily-grind)
  if (path.basename(path.dirname(targetDirAbs)) === TARGETS_DIR) {
    const guideDir = path.dirname(path.dirname(targetDirAbs));
    const appName = path.basename(targetDirAbs);
    return testTargetGrader(guideDir, appName);
  }

  const targetsDir = path.join(targetDirAbs, TARGETS_DIR);
  if (fs.existsSync(targetsDir) && fs.statSync(targetsDir).isDirectory()) {
    const apps = fs.readdirSync(targetsDir).filter(name => !name.startsWith('.') && getSupportedBaseApps().includes(name));
    if (apps.length > 0) {
      const results = await Promise.all(
        apps.map((app) => {
          console.log(cCyan(`\n--- Calibrating target base app: ${app} ---`));
          return testTargetGrader(targetDirAbs, app);
        })
      );
      return results.find((res) => !res.success) || results[results.length - 1];
    }
  }

  throw new Error(`No target base apps found in ${targetsDir}. Calibration requires target base apps in targets/.`);
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm grade <path-to-target-directory>');
    process.exit(1);
  }

  const targetPathRel = args[0];
  const targetPathAbs = path.resolve(process.cwd(), targetPathRel);

  if (!fs.existsSync(targetPathAbs)) {
    console.error(`Error: Path not found: ${targetPathAbs}`);
    process.exit(1);
  }

  const res = await testGrader(targetPathAbs);
  if (!res.success && res.errorDetails) {
    console.error(cRed(`\nCalibration Error:\n${res.errorDetails}`));
  }
  process.exit(res.success ? 0 : 1);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
