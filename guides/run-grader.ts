import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { guidesDir, rootDir } from '../lib/paths.ts';
import { cRed, cYellow, cCyan } from '../lib/colors.ts';
import { TARGETS_DIR, SOLUTION_PATCH_FILE, ZERO_PASSRATE_PATCH_FILE, GRADER_FILE, getSupportedBaseApps } from '../lib/guide-validation.ts';
import { stageBaseAppWorkspace } from './lib/utils.ts';

export interface PlaywrightOptions {
  targetPathAbs: string;
  graderPath: string;
  reporters: string[];
  htmlOutputDir?: string;
  jsonOutputName?: string;
  patchFile?: string;
  stdio?: 'inherit' | 'ignore' | 'pipe';
}

export function executePlaywright(opts: PlaywrightOptions): ChildProcess {
  const playwrightConfig = path.join(guidesDir, 'playwright.config.ts');
  const reporterArgs = opts.reporters.length > 0 ? ['--reporter=' + opts.reporters.join(',')] : [];

  const isDir = fs.existsSync(opts.targetPathAbs) && fs.statSync(opts.targetPathAbs).isDirectory();
  const appDir = isDir ? opts.targetPathAbs : path.dirname(opts.targetPathAbs);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TARGET_FILE: opts.targetPathAbs,
    PLAYWRIGHT_HTML_OPEN: 'never',
  };

  if (opts.patchFile) {
    env.PATCH_FILE = path.resolve(opts.patchFile);
  }

  if (opts.htmlOutputDir) {
    env.PLAYWRIGHT_HTML_OUTPUT_DIR = opts.htmlOutputDir;
    env.PLAYWRIGHT_OUTPUT_DIR = path.join(appDir, 'test-results');
  }

  if (opts.jsonOutputName) {
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = opts.jsonOutputName;
  }

  const playwrightBin = path.join(rootDir, 'node_modules', '.bin', 'playwright');

  return spawn(playwrightBin, ['test', '-c', playwrightConfig, opts.graderPath, ...reporterArgs], {
    cwd: appDir,
    stdio: opts.stdio || 'inherit',
    env
  });
}

export async function runPlaywright(
  targetPathAbs: string,
  graderPath: string,
  htmlOutputDir: string,
  stdio: 'inherit' | 'ignore' | 'pipe' = 'inherit'
): Promise<any> {
  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);

  const isDir = fs.existsSync(targetPathAbs) && fs.statSync(targetPathAbs).isDirectory();
  const appDir = isDir ? targetPathAbs : path.dirname(targetPathAbs);
  const agentPatch = path.join(appDir, 'agent.patch');
  let effectiveTargetPath = targetPathAbs;
  let cleanupGradingDir: (() => void) | null = null;

  const hasPatch = fs.existsSync(agentPatch);
  if (hasPatch) {
    const targetsMatch = graderPath.match(/targets[/\\]([^/\\]+)/);
    if (!targetsMatch) {
      throw new Error(`Could not determine target baseApp from grader path: ${graderPath}`);
    }
    const baseApp = targetsMatch[1];
    const { workDir: tempGradingDir, cleanup } = stageBaseAppWorkspace(baseApp, agentPatch);
    cleanupGradingDir = cleanup;
    effectiveTargetPath = isDir ? tempGradingDir : path.join(tempGradingDir, path.basename(targetPathAbs));
  }

  try {
    const child = executePlaywright({
      targetPathAbs: effectiveTargetPath,
      graderPath,
      reporters: ['json', 'html'],
      htmlOutputDir,
      jsonOutputName: tmpJson,
      patchFile: hasPatch ? agentPatch : undefined,
      stdio
    });

    await once(child, 'close');

    const effectiveAppDir = fs.existsSync(effectiveTargetPath) && fs.statSync(effectiveTargetPath).isDirectory() ? effectiveTargetPath : path.dirname(effectiveTargetPath);
    const testResultsDir = path.join(effectiveAppDir, 'test-results');
    await fs.promises.rm(testResultsDir, { recursive: true, force: true }).catch(() => {});

    const content = await fs.promises.readFile(tmpJson, 'utf-8').catch(() => null);
    if (!content) {
      throw new Error(`Playwright did not produce a JSON report at ${tmpJson}`);
    }

    await fs.promises.unlink(tmpJson).catch(() => {});
    return JSON.parse(content);
  } finally {
    if (cleanupGradingDir) {
      cleanupGradingDir();
    }
  }
}

async function runPlaywrightCalibration(
  targetPathAbs: string,
  graderPath: string,
  outDir: string,
  patchFile: string,
  result: CalibrationResult
): Promise<any> {
  process.env.PATCH_FILE = patchFile;
  const results = await runPlaywright(targetPathAbs, graderPath, outDir, 'ignore')
    .catch(err => {
      result.errorDetails = `Dev server crashed or failed to run against ${path.basename(patchFile)}: ${err.message}`;
      return null;
    });
  delete process.env.PATCH_FILE;

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
  specs?: Array<{ title: string; ok: boolean }>;
  suites?: PlaywrightSuite[];
}

function collectSpecs(suite: PlaywrightSuite, ok: boolean, prefix = ''): string[] {
  const results: string[] = [];
  for (const spec of suite.specs || []) {
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

export interface CalibrationResult {
  success: boolean;
  errorDetails?: string;
  solution: { passed: number; failed: number; failingTests: string[] };
  zeroPassrate: { passed: number; failed: number; passingTests: string[] };
}

export async function testTargetGrader(guideDirAbs: string, baseApp: string): Promise<CalibrationResult> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const solutionPatch = path.join(targetDir, SOLUTION_PATCH_FILE);
  const zeroPassratePatch = path.join(targetDir, ZERO_PASSRATE_PATCH_FILE);
  const graderPath = path.join(targetDir, GRADER_FILE);

  const result: CalibrationResult = {
    success: false,
    solution: { passed: 0, failed: 0, failingTests: [] },
    zeroPassrate: { passed: 0, failed: 0, passingTests: [] }
  };

  if (!fs.existsSync(solutionPatch) || !fs.existsSync(zeroPassratePatch) || !fs.existsSync(graderPath)) {
    result.errorDetails = `Missing ${SOLUTION_PATCH_FILE}, ${ZERO_PASSRATE_PATCH_FILE}, or ${GRADER_FILE} in ${targetDir}`;
    return result;
  }

  const solutionOutDir = path.join(targetDir, 'grade-report', 'solution');
  const zeroPassrateOutDir = path.join(targetDir, 'grade-report', 'zero-passrate');

  // Golden calibration
  const { workDir: goldenSandbox, cleanup: cleanupGolden } = stageBaseAppWorkspace(baseApp, solutionPatch, `gd-cal-${baseApp}-sol`);
  let unexpected = 0;
  try {
    console.log(cYellow(`\nRunning against ${baseApp} with ${SOLUTION_PATCH_FILE}... (Expecting 100% pass)`));
    const solutionResults = await runPlaywrightCalibration(goldenSandbox, graderPath, solutionOutDir, solutionPatch, result);

    if (!solutionResults) {
      return result;
    }

    unexpected = solutionResults.stats?.unexpected || 0;
    const expected = solutionResults.stats?.expected || 0;
    result.solution.passed = expected;
    result.solution.failed = unexpected;

    if (expected === 0 && unexpected === 0) {
      result.errorDetails = `No tests were run for ${SOLUTION_PATCH_FILE}`;
      return result;
    } else if (unexpected > 0) {
      result.solution.failingTests = solutionResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, false)) || [];
      result.errorDetails = `${SOLUTION_PATCH_FILE} failed ${unexpected} tests:\n\n${collectPlaywrightErrors(solutionResults)}`;
      solutionResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
      return result;
    }
  } finally {
    if (unexpected > 0) {
      console.log(cYellow(`⚠️  Calibration failed. Keeping golden sandbox directory for debugging: ${goldenSandbox}`));
    } else {
      cleanupGolden();
    }
  }

  // Zero-passrate calibration
  const { workDir: zeroPassrateSandbox, cleanup: cleanupZeroPassrate } = stageBaseAppWorkspace(baseApp, zeroPassratePatch, `gd-cal-${baseApp}-zp`);
  let passed = 0;
  try {
    console.log(cYellow(`Running against ${baseApp} with ${ZERO_PASSRATE_PATCH_FILE}... (Expecting 100% fail)`));
    const zeroPassrateResults = await runPlaywrightCalibration(zeroPassrateSandbox, graderPath, zeroPassrateOutDir, zeroPassratePatch, result);

    if (!zeroPassrateResults) {
      return result;
    }

    passed = zeroPassrateResults.stats?.expected || 0;
    const failed = zeroPassrateResults.stats?.unexpected || 0;
    result.zeroPassrate.passed = passed;
    result.zeroPassrate.failed = failed;

    if (passed === 0 && failed === 0) {
      result.errorDetails = `No tests were run for ${ZERO_PASSRATE_PATCH_FILE}`;
      return result;
    } else if (passed > 0) {
      result.zeroPassrate.passingTests = zeroPassrateResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, true)) || [];
      result.errorDetails = `${ZERO_PASSRATE_PATCH_FILE} incorrectly passed ${passed} tests:\n\n${collectPlaywrightErrors(zeroPassrateResults)}`;
      zeroPassrateResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
      return result;
    }
  } finally {
    if (passed > 0) {
      console.log(cYellow(`⚠️  Calibration failed. Keeping zero-passrate sandbox directory for debugging: ${zeroPassrateSandbox}`));
    } else {
      cleanupZeroPassrate();
    }
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
      let lastResult: CalibrationResult | null = null;
      for (const app of apps) {
        console.log(cCyan(`\n--- Calibrating target base app: ${app} ---`));
        const res = await testTargetGrader(targetDirAbs, app);
        lastResult = res;
        if (!res.success) {
          break;
        }
      }
      return lastResult || { success: false, solution: { passed: 0, failed: 0, failingTests: [] }, zeroPassrate: { passed: 0, failed: 0, passingTests: [] } };
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
  process.exit(res.success ? 0 : 1);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
