import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rootDir, outDir, guidesDir, ensureDiskNodeCompileCache } from '../core/paths.ts';
import { cRed, cYellow, cCyan } from '../core/colors.ts';
import { TARGETS_DIR, getActiveSolutionAgents, SOLUTION_PATCH_FILES, type SolutionAgent, GRADER_FILE, getSupportedBaseApps } from '../core/guide-validation.ts';
import { copyBaseAppToWorkspace } from '../harness/lib/utils.ts';
import { createIsolatedHome, cleanupIsolatedHome } from '../harness/lib/agent-shared.ts';
import { applyPatchSync } from '../core/patch-utils.ts';
import { checkTargetPageLoad, killServerProcessTree, type PageLoadResult } from './test-fixture.ts';

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
  stdio?: 'inherit' | 'ignore' | 'pipe';
  baselineTarget?: string;
}

/** Copies the untouched base app to a temp dir and applies `patchFile` (when given and non-empty). */
async function stageGradingWorkspace(
  baseApp: string,
  patchFile?: string
): Promise<{ workDir: string; cleanup: () => void }> {
  const tempHome = createIsolatedHome('grade-run');
  const workDir = path.join(tempHome, baseApp);

  await copyBaseAppToWorkspace(baseApp, workDir);

  if (patchFile && fs.existsSync(patchFile) && fs.readFileSync(patchFile, 'utf8').trim()) {
    const patchResult = applyPatchSync(workDir, patchFile);
    if (!patchResult.success) {
      try { cleanupIsolatedHome(tempHome); } catch {}
      throw new Error(`Failed to apply patch ${patchFile} to ${baseApp}: ${patchResult.error}`);
    }
  }

  return {
    workDir,
    cleanup: () => { try { cleanupIsolatedHome(tempHome); } catch {} }
  };
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
    env,
    stdio: opts.stdio || 'inherit'
  });
}

export interface RunPlaywrightOptions {
  stdio?: 'inherit' | 'ignore' | 'pipe';
  patchFile?: string;
  zeroPassrateFile?: string;
  testResultsDir?: string;
  baselineTarget?: string;
  stage?: 'patch' | 'starting-app';
}

/**
 * Runs a grader. With `patchFile`, grades that patch applied to a fresh copy of the base app; with
 * `stage: 'starting-app'`, grades a fresh untouched copy of the base app (starting-app calibration);
 * otherwise grades `targetPathAbs` in place.
 */
export async function runPlaywright(
  targetPathAbs: string,
  graderPath: string,
  optionsOrStdio: RunPlaywrightOptions | 'inherit' | 'ignore' | 'pipe' = 'inherit',
  maybePatchFile?: string,
  maybeTestResultsDir?: string,
  maybeStage: 'patch' | 'starting-app' = 'patch'
): Promise<any> {
  const options: RunPlaywrightOptions = typeof optionsOrStdio === 'object' && optionsOrStdio !== null
    ? optionsOrStdio
    : {
        stdio: optionsOrStdio,
        patchFile: maybePatchFile,
        testResultsDir: maybeTestResultsDir,
        stage: maybeStage,
      };

  const stdio = options.stdio ?? 'inherit';
  const patchFile = options.patchFile;
  const testResultsDir = options.testResultsDir;
  const stage = options.stage ?? (patchFile ? 'patch' : 'starting-app');
  const baselineTarget = options.baselineTarget;

  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  const tmpPageLoadJson = `${tmpJson}-pageload.json`;
  const tmpServerPidsFile = `${tmpJson}-servers.pids`;

  const isDir = fs.existsSync(targetPathAbs) && fs.statSync(targetPathAbs).isDirectory();
  let effectiveTargetPath = targetPathAbs;
  let cleanupGradingDir: (() => void) | null = null;

  if (patchFile || stage === 'starting-app') {
    const baseApp = path.basename(path.dirname(graderPath));
    const { workDir: tempGradingDir, cleanup } = await stageGradingWorkspace(baseApp, patchFile);
    cleanupGradingDir = cleanup;
    effectiveTargetPath = isDir ? tempGradingDir : path.join(tempGradingDir, path.basename(targetPathAbs));
  }

  // Give each grading run its own output dir. The config's fallback (out/test-results) is shared
  // across parallel runs, and Playwright wipes it at startup, so parallel runs clobber each other.
  const effectiveAppDir = isDir ? effectiveTargetPath : path.dirname(effectiveTargetPath);
  const resolvedTestResultsDir = testResultsDir || path.join(effectiveAppDir, 'test-results');

  try {
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
      stdio: stdio === 'ignore' ? 'pipe' : stdio,
      baselineTarget,
    });

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
      pageLoad = await checkTargetPageLoad(effectiveAppDir);
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
  patchFile: string | undefined,
  result: CalibrationResult,
  testResultsDir?: string
): Promise<any> {
  const results = await runPlaywright(targetPathAbs, graderPath, 'ignore', patchFile, testResultsDir, patchFile ? 'patch' : 'starting-app')
    .catch(err => {
      result.errorDetails = `Dev server crashed or failed to run against ${patchFile ? path.basename(patchFile) : 'the untouched starting app'}: ${err.message}`;
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

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests?: Array<{ status?: string; results?: Array<{ status?: string; error?: { message?: string }; errors?: Array<{ message?: string }> }> }>;
}

export interface PlaywrightSuite {
  title: string;
  specs?: PlaywrightSpec[];
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

/**
 * Maps each failing test title (formatted like `collectSpecs`) to its error messages, so callers can
 * reason about one (solution, test) failure at a time instead of the combined `errorDetails` log.
 */
export function collectFailureMessages(suite: PlaywrightSuite, prefix = ''): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const spec of suite.specs || []) {
    if (isSpecSkipped(spec) || spec.ok) continue;
    const errors = (spec.tests || []).flatMap(t => (t.results || []).flatMap(r => r.errors?.length ? r.errors : (r.error ? [r.error] : [])));
    messages[`${prefix}${spec.title}`] = [...new Set(errors.map(e => e.message).filter((m): m is string => Boolean(m)))].join('\n');
  }
  for (const child of suite.suites || []) {
    Object.assign(messages, collectFailureMessages(child, `${prefix}${child.title} > `));
  }
  return messages;
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
      if (isSpecSkipped(spec) || spec.ok) continue;

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
  /** Error message per failing test title (same keys as `failingTests`). */
  failureMessages?: Record<string, string>;
  pageLoad?: PageLoadResult;
}

export interface CalibrationResult {
  success: boolean;
  errorDetails?: string;
  solutions: Partial<Record<SolutionAgent, SolutionTestResult>>;
  /** The grader run against the untouched base app: every test must fail, except exempt regression checks. */
  startingApp?: { passed: number; failed: number; passingTests: string[]; pageLoad?: PageLoadResult };
  zeroPassrate?: { passed: number; failed: number; passingTests: string[]; pageLoad?: PageLoadResult };
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

/**
 * Calibrates a target grader: every golden solution must pass 100%, and every test must fail on the
 * untouched starting app except `exemptTests` (regression checks the base app already satisfies).
 */
export async function testTargetGrader(guideDirAbs: string, baseApp: string, exemptTests: readonly string[] = []): Promise<CalibrationResult> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const graderPath = path.join(targetDir, GRADER_FILE);

  const activeAgents = getActiveSolutionAgents(targetDir);
  const solutions: Partial<Record<SolutionAgent, SolutionTestResult>> = {};
  for (const agent of activeAgents) {
    solutions[agent] = { passed: 0, failed: 0, failingTests: [] };
  }

  const result: CalibrationResult = {
    success: false,
    solutions,
    startingApp: { passed: 0, failed: 0, passingTests: [] },
    zeroPassrate: { passed: 0, failed: 0, passingTests: [] },
  };

  const missingSolutions = activeAgents.filter(agent => !fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[agent])));
  if (missingSolutions.length > 0 || !fs.existsSync(graderPath)) {
    result.errorDetails = `Missing patch or grader files in ${targetDir}`;
    return result;
  }

  const resolvedGuideDir = path.resolve(guideDirAbs);
  const slug = path.basename(resolvedGuideDir);
  const parentDir = path.basename(path.dirname(resolvedGuideDir));
  const category = parentDir === 'guides' ? slug : parentDir;
  const testResultsBaseDir = path.join(outDir, 'guides', category, slug, baseApp, 'test-results');

  // Golden calibration across active AI solution diffs + the untouched starting app, in parallel
  const solutionStatus: Record<string, string> = {};
  const solutionErrors: string[] = [];
  let allSolutionsPassed = true;

  const solutionCalibrationTasks = activeAgents.map(async (agent) => {
    const solPatchFile = SOLUTION_PATCH_FILES[agent];
    const solutionPatch = path.join(targetDir, solPatchFile);
    const solutionTestResultsDir = path.join(testResultsBaseDir, `solution-${agent}`);
    let unexpected = 0;
    console.log(cYellow(`\nRunning against ${baseApp} with ${solPatchFile} (${agent})... (Expecting 100% pass)`));
    const solutionResults = await runPlaywrightCalibration(targetDir, graderPath, solutionPatch, result, solutionTestResultsDir);

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
    if (solutionResults.pageLoad) {
      result.solutions[agent]!.pageLoad = solutionResults.pageLoad;
    }

    if (expected === 0 && unexpected === 0) {
      allSolutionsPassed = false;
      solutionStatus[agent] = `❌ FAILED (No tests were run)`;
      solutionErrors.push(`[${solPatchFile}] No tests were run.`);
    } else if (unexpected > 0) {
      allSolutionsPassed = false;
      solutionStatus[agent] = `❌ FAILED (${expected} passed, ${unexpected} failed)`;
      result.solutions[agent]!.failingTests = solutionResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, false)) || [];
      result.solutions[agent]!.failureMessages = Object.assign({}, ...(solutionResults.suites || []).map((s: PlaywrightSuite) => collectFailureMessages(s)));
      const pwErrors = collectPlaywrightErrors(solutionResults);
      solutionErrors.push(`[${solPatchFile}] failed ${unexpected} tests:\n\n${pwErrors}`);
      solutionResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
    } else {
      solutionStatus[agent] = `✅ PASSED (${expected}/${expected} passed)`;
    }
  });

  let startingAppStatus = '';
  let startingAppFailed = false;
  const startingAppTask = (async () => {
    console.log(cYellow(`Running against the untouched ${baseApp} starting app... (Expecting every test to fail, except ${exemptTests.length} exempt regression check(s))`));
    const startingResults = await runPlaywrightCalibration(targetDir, graderPath, undefined, result, path.join(testResultsBaseDir, 'starting-app'));

    if (!startingResults) {
      startingAppFailed = true;
      startingAppStatus = `❌ FAILED (Dev server crashed or compile error)`;
      return;
    }

    const passed = startingResults.stats?.expected || 0;
    const failed = startingResults.stats?.unexpected || 0;
    const startingApp = result.startingApp ?? (result.startingApp = { passed: 0, failed: 0, passingTests: [] });
    startingApp.passed = passed;
    startingApp.failed = failed;
    startingApp.passingTests = startingResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, true)) || [];
    if (startingResults.pageLoad) {
      startingApp.pageLoad = startingResults.pageLoad;
    }
    const unexpectedPasses = startingApp.passingTests.filter(t => !exemptTests.includes(t));

    if (passed === 0 && failed === 0) {
      startingAppFailed = true;
      startingAppStatus = `❌ FAILED (No tests were run on the starting app)`;
    } else if (unexpectedPasses.length > 0) {
      startingAppFailed = true;
      startingAppStatus = `❌ FAILED (the untouched starting app passed ${unexpectedPasses.length} test(s) not exempt as regression checks:\n${unexpectedPasses.map(t => `   - ${t}`).join('\n')})`;
      startingResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
    } else {
      startingAppStatus = `✅ PASSED (${passed - unexpectedPasses.length} exempt regression check(s) passed; every other test failed, as expected)`;
    }
  })();

  await Promise.all([...solutionCalibrationTasks, startingAppTask]);

  if (!allSolutionsPassed || startingAppFailed) {
    const sharedFailingTests = findSharedFailingTests(result.solutions, activeAgents);
    if (sharedFailingTests.length > 0) {
      result.sharedFailingTests = sharedFailingTests;
    }
    const sharedBanner = sharedFailingTests.length > 0
      ? `\n\n⚠️  SHARED FAILING TESTS ACROSS ALL ${activeAgents.length} GOLDEN SOLUTIONS (fail-fast calibration abort):\n` +
        sharedFailingTests.map(t => `   - ${t}`).join('\n')
      : '';
    const statusSummary = activeAgents.map(a => `   - ${a}: ${solutionStatus[a] || 'Unknown'}`).join('\n') +
      `\n   - starting app: ${startingAppStatus}`;
    result.errorDetails = `Calibration results summary:\n${statusSummary}\n\n` +
      sharedBanner +
      (solutionErrors.length > 0 ? `\n\nSolution failure details:\n\n` + solutionErrors.join('\n\n---\n\n') : '') +
      (startingAppFailed && (result.startingApp?.passed ?? 0) > 0 ? `\n\nStarting app details:\n${startingAppStatus}` : '');
    return result;
  }

  result.success = true;
  return result;
}

export async function testGrader(targetDirRaw: string, exemptTests: readonly string[] = []): Promise<CalibrationResult> {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRaw);

  // Direct target base app path (e.g. guides/css/size-aware-styling/targets/daily-grind)
  if (path.basename(path.dirname(targetDirAbs)) === TARGETS_DIR) {
    const guideDir = path.dirname(path.dirname(targetDirAbs));
    const appName = path.basename(targetDirAbs);
    return testTargetGrader(guideDir, appName, exemptTests);
  }

  const targetsDir = path.join(targetDirAbs, TARGETS_DIR);
  if (fs.existsSync(targetsDir) && fs.statSync(targetsDir).isDirectory()) {
    const apps = fs.readdirSync(targetsDir).filter(name => !name.startsWith('.') && getSupportedBaseApps().includes(name));
    if (apps.length > 0) {
      let lastResult: CalibrationResult | null = null;
      for (const app of apps) {
        console.log(cCyan(`\n--- Calibrating target base app: ${app} ---`));
        const res = await testTargetGrader(targetDirAbs, app, exemptTests);
        lastResult = res;
        if (!res.success) {
          break;
        }
      }
      return lastResult || {
        success: false,
        solutions: {},
        startingApp: { passed: 0, failed: 0, passingTests: [] },
    zeroPassrate: { passed: 0, failed: 0, passingTests: [] },
      };
    }
  }

  throw new Error(`No target base apps found in ${targetsDir}. Calibration requires target base apps in targets/.`);
}

async function run(): Promise<void> {
  const targetDirRaw = process.argv[2];
  if (!targetDirRaw) {
    console.error('Usage: tsx run-grader.ts <path-to-target-or-guide-directory>');
    process.exit(1);
  }

  try {
    const res = await testGrader(targetDirRaw);
    if (!res.success) {
      if (res.errorDetails) {
        console.error(cRed(`\n${res.errorDetails}`));
      }
      process.exit(1);
    }
    console.log(cCyan('\nAll target calibrations passed!'));
    process.exit(0);
  } catch (err: any) {
    console.error(cRed(`\nError: ${err.message}`));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
