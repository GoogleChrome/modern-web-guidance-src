import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { guidesDir, baseAppsDir } from '../lib/paths.ts';
import { cRed, cGreen, cYellow, cCyan, cBold } from '../lib/colors.ts';
import { TARGETS_DIR, SOLUTION_PATCH_FILE, ZERO_PASSRATE_PATCH_FILE, GRADER_FILE, getSupportedBaseApps } from '../lib/guide-validation.ts';
import { applyPatchSync } from '../lib/patch-utils.ts';
import { setupIsolatedWorkDir } from './lib/utils.ts';

export function findGrader(startDir: string): string | null {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const graderPath = path.join(currentDir, 'grader.ts');
    if (fs.existsSync(graderPath)) {
      return graderPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

export interface PlaywrightOptions {
  targetPathAbs: string;
  graderPath: string;
  reporters: string[];
  htmlOutputDir?: string;
  jsonOutputName?: string;
  stdio?: 'inherit' | 'ignore' | 'pipe';
}

export function executePlaywright(opts: PlaywrightOptions): ChildProcess {
  const playwrightConfig = path.join(guidesDir, 'playwright.config.ts');
  const reporterArgs = opts.reporters.length > 0 ? ['--reporter=' + opts.reporters.join(',')] : [];

  const isDir = fs.existsSync(opts.targetPathAbs) && fs.statSync(opts.targetPathAbs).isDirectory();
  const appDir = isDir ? opts.targetPathAbs : path.dirname(opts.targetPathAbs);
  const targetFile = isDir ? path.join(opts.targetPathAbs, 'index.html') : opts.targetPathAbs;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TARGET_FILE: targetFile,
    PLAYWRIGHT_HTML_OPEN: 'never',
  };

  if (opts.htmlOutputDir) {
    env.PLAYWRIGHT_HTML_OUTPUT_DIR = opts.htmlOutputDir;
    env.PLAYWRIGHT_OUTPUT_DIR = path.join(appDir, 'test-results');
  }

  if (opts.jsonOutputName) {
    env.PLAYWRIGHT_JSON_OUTPUT_NAME = opts.jsonOutputName;
  }

  const playwrightBin = path.join(guidesDir, 'node_modules', '.bin', 'playwright');

  return spawn(playwrightBin, ['test', '-c', playwrightConfig, opts.graderPath, ...reporterArgs], {
    cwd: appDir,
    stdio: opts.stdio || 'inherit',
    env
  });
}

export async function gradeFile(targetPathAbs: string): Promise<void> {
  const appDir = fs.existsSync(targetPathAbs) && fs.statSync(targetPathAbs).isDirectory() ? targetPathAbs : path.dirname(targetPathAbs);
  const graderPath = findGrader(appDir);
  if (!graderPath) {
    console.error('Error: Could not find grader.ts in any parent directory.');
    process.exit(1);
  }

  console.log(`Target Path: ${targetPathAbs}`);
  console.log(`Grader: ${graderPath}`);

  const outputDirPath = path.join(appDir, 'grade-report');

  const child = executePlaywright({
    targetPathAbs,
    graderPath,
    reporters: ['html'],
    htmlOutputDir: outputDirPath,
    stdio: 'inherit'
  });

  const [code] = await once(child, 'close');

  console.log(`\nTests finished with code ${code}. Opening HTML report...`);
  const playwrightBin = path.join(guidesDir, 'node_modules', '.bin', 'playwright');
  const showReportChild = spawn(playwrightBin, ['show-report', outputDirPath], {
    stdio: 'inherit'
  });

  await once(showReportChild, 'close');
  process.exit((code as number) || 0);
}

export async function runPlaywright(
  targetPathAbs: string,
  graderPath: string,
  htmlOutputDir: string,
  stdio: 'inherit' | 'ignore' | 'pipe' = 'inherit'
): Promise<any> {
  const tmpJson = path.join(os.tmpdir(), `pw-results-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);

  const child = executePlaywright({
    targetPathAbs,
    graderPath,
    reporters: ['json', 'html'],
    htmlOutputDir,
    jsonOutputName: tmpJson,
    stdio
  });

  await once(child, 'close');

  const appDir = fs.existsSync(targetPathAbs) && fs.statSync(targetPathAbs).isDirectory() ? targetPathAbs : path.dirname(targetPathAbs);
  const testResultsDir = path.join(appDir, 'test-results');
  await fs.promises.rm(testResultsDir, { recursive: true, force: true }).catch(() => {});

  const content = await fs.promises.readFile(tmpJson, 'utf-8').catch(() => null);
  if (!content) {
    throw new Error(`Playwright did not produce a JSON report at ${tmpJson}`);
  }

  await fs.promises.unlink(tmpJson).catch(() => {});
  return JSON.parse(content);
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
      result.stage = 'server-boot';
      result.errorDetails = `Dev server crashed or failed to run against ${path.basename(patchFile)}: ${err.message}`;
      return null;
    });
  delete process.env.PATCH_FILE;

  if (!results) {
    return null;
  }

  if (results.errors && results.errors.length > 0) {
    result.stage = 'calibration';
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
  stage?: 'patch-apply' | 'server-boot' | 'calibration' | 'unknown';
  errorDetails?: string;
  demo: { passed: number; failed: number; failingTests: string[] };
  negative: { passed: number; failed: number; passingTests: string[] };
}

function validateCalibrationPaths(targetDirAbs: string): { demoPath: string; negativePath: string; graderPath: string; } {
  const demoPath = path.join(targetDirAbs, 'demo.html');
  const negativePath = path.join(targetDirAbs, 'negative-demo.html');
  const graderPath = findGrader(targetDirAbs);

  if (!graderPath) {
    throw new Error('Could not find grader.ts in the directory or any parents.');
  }
  if (!fs.existsSync(demoPath)) {
    throw new Error(`Missing demo.html in ${targetDirAbs}`);
  }
  if (!fs.existsSync(negativePath)) {
    throw new Error(`Missing negative-demo.html in ${targetDirAbs}`);
  }

  return { demoPath, negativePath, graderPath };
}

async function runDemoCalibration(demoPath: string, graderPath: string, demoOutDir: string, result: CalibrationResult): Promise<boolean> {
  console.log(cYellow(`\nRunning against demo.html... (Expecting 100% pass)`));
  let demoFailed = false;

  const solutionPatch = path.join(path.dirname(graderPath), 'solution.patch');
  const demoResults = await runPlaywrightCalibration(demoPath, graderPath, demoOutDir, solutionPatch, result);

  if (!demoResults) {
    demoFailed = true;
  } else {
    const unexpected = demoResults.stats?.unexpected || 0;
    const expected = demoResults.stats?.expected || 0;
    result.demo.passed = expected;
    result.demo.failed = unexpected;

    if (expected === 0 && unexpected === 0) {
      console.log(cYellow(`\u26a0\ufe0f  Warning: No tests were run for demo.html`));
      demoFailed = true;
    } else if (unexpected > 0) {
      result.demo.failingTests = demoResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, false)) || [];
      console.log(cRed(`\u274c demo.html failed ${unexpected} tests!`));
      demoResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
      demoFailed = true;
    } else {
      console.log(cGreen(`\u2705 demo.html passed all ${expected} tests.`));
    }
  }

  console.log('');
  return demoFailed;
}

async function runNegativeCalibration(negativePath: string, graderPath: string, negativeOutDir: string, result: CalibrationResult): Promise<void> {
  console.log(cYellow(`Running against negative-demo.html... (Expecting 100% fail)`));

  const zeroPassratePatch = path.join(path.dirname(graderPath), ZERO_PASSRATE_PATCH_FILE);
  const negativeResults = await runPlaywrightCalibration(negativePath, graderPath, negativeOutDir, zeroPassratePatch, result);

  if (!negativeResults) {
    // Failed to run — result.success stays false
  } else {
    const passed = negativeResults.stats?.expected || 0;
    const failed = negativeResults.stats?.unexpected || 0;
    result.negative.passed = passed;
    result.negative.failed = failed;

    if (passed === 0 && failed === 0) {
      console.log(cYellow(`\u26a0\ufe0f  Warning: No tests were run for negative-demo.html`));
    } else if (passed > 0) {
      result.negative.passingTests = negativeResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, true)) || [];
      console.log(cRed(`\u274c negative-demo.html incorrectly passed ${passed} tests!`));
      negativeResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
    } else {
      console.log(cGreen(`\u2705 negative-demo.html failed all ${failed} tests correctly.`));
      result.success = true;
    }
  }

  console.log('');
}

function printFinalCalibrationSummary(result: CalibrationResult, demoFailed: boolean, demoOutDir: string, negativeOutDir: string): void {
  if (result.success) {
    console.log(cBold(cGreen(`Success! The grader is perfectly calibrated.`)));
  } else {
    console.log(cBold(cRed(`Failed! The grader needs calibration.`)));
    if (demoFailed) {
      console.log(`\nView demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), demoOutDir)}`);
    }
    console.log(`\nView negative-demo.html report:\n  pnpm --filter guides exec playwright show-report ${path.relative(process.cwd(), negativeOutDir)}`);
  }
}

export async function testTargetGrader(guideDirAbs: string, baseApp: string): Promise<CalibrationResult> {
  const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
  const solutionPatch = path.join(targetDir, SOLUTION_PATCH_FILE);
  const zeroPassratePatch = path.join(targetDir, ZERO_PASSRATE_PATCH_FILE);
  const graderPath = path.join(targetDir, GRADER_FILE);

  const result: CalibrationResult = {
    success: false,
    demo: { passed: 0, failed: 0, failingTests: [] },
    negative: { passed: 0, failed: 0, passingTests: [] }
  };

  if (!fs.existsSync(solutionPatch) || !fs.existsSync(zeroPassratePatch) || !fs.existsSync(graderPath)) {
    result.stage = 'unknown';
    result.errorDetails = `Missing ${SOLUTION_PATCH_FILE}, ${ZERO_PASSRATE_PATCH_FILE}, or ${GRADER_FILE} in ${targetDir}`;
    return result;
  }

  const demoOutDir = path.join(targetDir, 'grade-report', 'solution');
  const negativeOutDir = path.join(targetDir, 'grade-report', 'zero-passrate');

  // Golden calibration
  const goldenSandbox = setupIsolatedWorkDir(`gd-cal-${baseApp}-sol`);
  let unexpected = 0;
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), goldenSandbox, { recursive: true });
    const applyRes = applyPatchSync(goldenSandbox, solutionPatch);
    if (!applyRes.success) {
      result.stage = 'patch-apply';
      result.errorDetails = `Failed to apply ${SOLUTION_PATCH_FILE}: ${applyRes.error}`;
      return result;
    }

    console.log(cYellow(`\nRunning against ${baseApp} with ${SOLUTION_PATCH_FILE}... (Expecting 100% pass)`));
    const demoResults = await runPlaywrightCalibration(goldenSandbox, graderPath, demoOutDir, solutionPatch, result);

    if (!demoResults) {
      return result;
    }

    unexpected = demoResults.stats?.unexpected || 0;
    const expected = demoResults.stats?.expected || 0;
    result.demo.passed = expected;
    result.demo.failed = unexpected;

    if (expected === 0 && unexpected === 0) {
      result.stage = 'calibration';
      result.errorDetails = `No tests were run for ${SOLUTION_PATCH_FILE}`;
      return result;
    } else if (unexpected > 0) {
      result.demo.failingTests = demoResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, false)) || [];
      result.stage = 'calibration';
      result.errorDetails = `${SOLUTION_PATCH_FILE} failed ${unexpected} tests:\n\n${collectPlaywrightErrors(demoResults)}`;
      demoResults.suites?.forEach((suite: PlaywrightSuite) => printFailingSpecs(suite));
      return result;
    }
  } finally {
    if (unexpected > 0) {
      console.log(cYellow(`\u26a0\ufe0f  Calibration failed. Keeping golden sandbox directory for debugging: ${goldenSandbox}`));
    } else {
      fs.rmSync(goldenSandbox, { recursive: true, force: true });
    }
  }

  // Zero-passrate calibration
  const zeroPassrateSandbox = setupIsolatedWorkDir(`gd-cal-${baseApp}-zp`);
  let passed = 0;
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), zeroPassrateSandbox, { recursive: true });
    const applyRes = applyPatchSync(zeroPassrateSandbox, zeroPassratePatch);
    if (!applyRes.success) {
      result.stage = 'patch-apply';
      result.errorDetails = `Failed to apply ${ZERO_PASSRATE_PATCH_FILE}: ${applyRes.error}`;
      return result;
    }

    console.log(cYellow(`Running against ${baseApp} with ${ZERO_PASSRATE_PATCH_FILE}... (Expecting 100% fail)`));
    const negativeResults = await runPlaywrightCalibration(zeroPassrateSandbox, graderPath, negativeOutDir, zeroPassratePatch, result);

    if (!negativeResults) {
      return result;
    }

    passed = negativeResults.stats?.expected || 0;
    const failed = negativeResults.stats?.unexpected || 0;
    result.negative.passed = passed;
    result.negative.failed = failed;

    if (passed === 0 && failed === 0) {
      result.stage = 'calibration';
      result.errorDetails = `No tests were run for ${ZERO_PASSRATE_PATCH_FILE}`;
      return result;
    } else if (passed > 0) {
      result.negative.passingTests = negativeResults.suites?.flatMap((s: PlaywrightSuite) => collectSpecs(s, true)) || [];
      result.stage = 'calibration';
      result.errorDetails = `${ZERO_PASSRATE_PATCH_FILE} incorrectly passed ${passed} tests:\n\n${collectPlaywrightErrors(negativeResults)}`;
      negativeResults.suites?.forEach((suite: PlaywrightSuite) => printPassingSpecs(suite));
      return result;
    }
  } finally {
    if (passed > 0) {
      console.log(cYellow(`\u26a0\ufe0f  Calibration failed. Keeping zero-passrate sandbox directory for debugging: ${zeroPassrateSandbox}`));
    } else {
      fs.rmSync(zeroPassrateSandbox, { recursive: true, force: true });
    }
  }

  result.success = true;
  return result;
}

export async function testGrader(targetDirRaw: string, baseApp?: string): Promise<CalibrationResult> {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRaw);
  if (baseApp) {
    return testTargetGrader(targetDirAbs, baseApp);
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
      return lastResult || { success: false, stage: 'unknown', demo: { passed: 0, failed: 0, failingTests: [] }, negative: { passed: 0, failed: 0, passingTests: [] } };
    }
  }

  const { demoPath, negativePath, graderPath } = validateCalibrationPaths(targetDirAbs);

  const result: CalibrationResult = {
    success: false,
    demo: { passed: 0, failed: 0, failingTests: [] },
    negative: { passed: 0, failed: 0, passingTests: [] },
  };

  const demoOutDir = path.join(targetDirAbs, 'grade-report', 'demo');
  const negativeOutDir = path.join(targetDirAbs, 'grade-report', 'negative');

  const demoFailed = await runDemoCalibration(demoPath, graderPath, demoOutDir, result);

  if (demoFailed) {
    console.log(cYellow(`Skipping negative-demo.html run due to failures in demo.html`));
    return result;
  }

  await runNegativeCalibration(negativePath, graderPath, negativeOutDir, result);

  printFinalCalibrationSummary(result, demoFailed, demoOutDir, negativeOutDir);

  return result;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: pnpm grade <path-to-html-file-or-guide-directory>');
    process.exit(1);
  }

  const targetPathRel = args[0];
  const targetPathAbs = path.resolve(process.cwd(), targetPathRel);

  if (!fs.existsSync(targetPathAbs)) {
    console.error(`Error: Path not found: ${targetPathAbs}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPathAbs);
  if (stat.isDirectory()) {
    console.log(cCyan(`\ud83e\uddea Directory detected. Running calibration suite on the grader (demo.html & negative-demo.html)...`));
    const result = await testGrader(targetPathAbs);
    process.exit(result.success ? 0 : 1);
  } else if (targetPathAbs.endsWith('.html')) {
    console.log(cCyan(`\ud83d\udcc4 HTML file detected. Grading artifact and opening visual report...`));
    await gradeFile(targetPathAbs);
  } else {
    console.error(`Error: Expected a directory or an .html file.`);
    process.exit(1);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
