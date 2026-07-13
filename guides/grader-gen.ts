import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseAppsDir } from '../lib/paths.ts';
import { environmentConfig } from '../harness/config.ts';
import { spawnAsync } from '../harness/lib/agent-shared.ts';
import { setupIsolatedWorkDir } from './lib/utils.ts';
import { buildTargetGraderPrompt } from './gd-dev-prompts.ts';
import {
  GUIDE_FILE,
  EXPECTATIONS_FILE,
  SOLUTION_PATCH_FILE,
  BROKEN_PATCH_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  SUPPORTED_BASE_APPS
} from '../lib/guide-validation.ts';
import { cCyan, cGreen } from '../lib/colors.ts';
import type { CalibrationResult } from './run-grader.ts';

export async function generateTargetGrader(guideDirAbs: string, baseApp: string, failureContext?: string): Promise<void> {
  const workDir = setupIsolatedWorkDir(`gd-gen-${baseApp}-grader`);
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), workDir, { recursive: true });
    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));

    const solutionPatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, SOLUTION_PATCH_FILE);
    const brokenPatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, BROKEN_PATCH_FILE);
    if (fs.existsSync(solutionPatch)) fs.copyFileSync(solutionPatch, path.join(workDir, SOLUTION_PATCH_FILE));
    if (fs.existsSync(brokenPatch)) fs.copyFileSync(brokenPatch, path.join(workDir, BROKEN_PATCH_FILE));

    const prompt = buildTargetGraderPrompt({
      guideFile: GUIDE_FILE,
      expectationsFile: EXPECTATIONS_FILE,
      solutionPatchFile: SOLUTION_PATCH_FILE,
      brokenPatchFile: BROKEN_PATCH_FILE,
      graderFile: GRADER_FILE,
      baseApp,
      failureContext,
    });

    const model = process.env.JETSKI_MODEL;
    const commandArgs = ['-p', prompt];
    if (model) commandArgs.push('--model', model);

    const exitCode = await spawnAsync(environmentConfig.jetskiCliBin, commandArgs, {
      cwd: workDir,
      env: { ...process.env },
      stdio: 'inherit',
    });

    if (exitCode !== 0) {
      throw new Error(`Jetski CLI exited with code ${exitCode}`);
    }

    const generatedGrader = path.join(workDir, GRADER_FILE);
    if (fs.existsSync(generatedGrader)) {
      const destGrader = path.join(guideDirAbs, TARGETS_DIR, baseApp, GRADER_FILE);
      fs.mkdirSync(path.dirname(destGrader), { recursive: true });
      fs.copyFileSync(generatedGrader, destGrader);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export async function generateGrader(targetDirRaw: string, baseApp?: string): Promise<void> {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRaw);
  if (!fs.existsSync(targetDirAbs)) {
    throw new Error(`Directory not found: ${targetDirAbs}`);
  }

  const apps = baseApp ? [baseApp] : SUPPORTED_BASE_APPS;
  for (const app of apps) {
    console.log(cCyan(`\n--- Generating ${GRADER_FILE} for target base app: ${app} ---`));
    await generateTargetGrader(targetDirAbs, app);
    console.log(cGreen(`✅ ${GRADER_FILE} generated for ${app}`));
  }
}

export async function generateGraderWithContext(targetDirRaw: string, failureContextStrOrRes: string | CalibrationResult, baseApp?: string): Promise<void> {
  const targetDirAbs = path.resolve(process.cwd(), targetDirRaw);
  if (!fs.existsSync(targetDirAbs)) {
    throw new Error(`Directory not found: ${targetDirAbs}`);
  }

  let failureContextStr: string;
  if (typeof failureContextStrOrRes === 'string') {
    failureContextStr = failureContextStrOrRes;
  } else {
    const lines: string[] = [];
    if (failureContextStrOrRes.errorDetails) lines.push(failureContextStrOrRes.errorDetails);
    if (failureContextStrOrRes.demo.failingTests.length > 0) lines.push(`Golden tests failed: ${failureContextStrOrRes.demo.failingTests.join(', ')}`);
    if (failureContextStrOrRes.negative.passingTests.length > 0) lines.push(`Negative tests passed: ${failureContextStrOrRes.negative.passingTests.join(', ')}`);
    failureContextStr = lines.join('\n');
  }

  const apps = baseApp ? [baseApp] : SUPPORTED_BASE_APPS;
  for (const app of apps) {
    console.log(cCyan(`\n--- Regenerating ${GRADER_FILE} with context for target: ${app} ---`));
    await generateTargetGrader(targetDirAbs, app, failureContextStr);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: gd dev <path/to/guide> --gen-grader');
    process.exit(1);
  }
  generateGrader(args[0]).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
