import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseAppsDir } from '../lib/paths.ts';
import { setupIsolatedWorkDir, runAgent } from './lib/utils.ts';
import { buildTargetGraderPrompt } from './gd-dev-prompts.ts';
import {
  GUIDE_FILE,
  EXPECTATIONS_FILE,
  SOLUTION_PATCH_FILE,
  ZERO_PASSRATE_PATCH_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  SUPPORTED_BASE_APPS
} from '../lib/guide-validation.ts';
import { cCyan, cGreen } from '../lib/colors.ts';
import type { CalibrationResult } from './run-grader.ts';

export async function generateTargetGrader(guideDirAbs: string, baseApp: string, failureContext?: string): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const relativeGuidePath = path.relative(repoRoot, guideDirAbs);
  const relativeWorkSubdir = path.join(relativeGuidePath, 'targets', baseApp);

  const sandbox = setupIsolatedWorkDir(`gd-gen-${baseApp}-grader`, relativeWorkSubdir);
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), sandbox.workDir, {
      recursive: true,
      filter: (src) => !src.includes('node_modules')
    });
    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(sandbox.workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(sandbox.workDir, EXPECTATIONS_FILE));

    const tempHome = sandbox.tempHome;
    
    // Copy patch-utils.ts to tempHome/lib/patch-utils.ts
    const srcLibDir = path.resolve(repoRoot, 'lib');
    fs.mkdirSync(path.join(tempHome, 'lib'), { recursive: true });
    fs.copyFileSync(
      path.join(srcLibDir, 'patch-utils.ts'),
      path.join(tempHome, 'lib', 'patch-utils.ts')
    );

    // Copy template.grader.ts, test-fixture.ts, and pattern libraries to tempHome/guides/
    fs.mkdirSync(path.join(tempHome, 'guides'), { recursive: true });
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'template.grader.ts'),
      path.join(sandbox.workDir, 'template.grader.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'test-fixture.ts'),
      path.join(tempHome, 'guides', 'test-fixture.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'parser-pattern-library.test.ts'),
      path.join(sandbox.workDir, 'parser-pattern-library.test.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'playwright-pattern-library.grader.ts'),
      path.join(sandbox.workDir, 'playwright-pattern-library.grader.ts')
    );

    const solutionPatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, SOLUTION_PATCH_FILE);
    const zeroPassratePatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, ZERO_PASSRATE_PATCH_FILE);
    if (fs.existsSync(solutionPatch)) fs.copyFileSync(solutionPatch, path.join(sandbox.workDir, SOLUTION_PATCH_FILE));
    if (fs.existsSync(zeroPassratePatch)) fs.copyFileSync(zeroPassratePatch, path.join(sandbox.workDir, ZERO_PASSRATE_PATCH_FILE));

    // Symlink host guides/node_modules to workDir/node_modules for local typechecking inside the sandbox
    const hostGuidesNodeModules = path.join(repoRoot, 'guides', 'node_modules');
    if (fs.existsSync(hostGuidesNodeModules)) {
      fs.symlinkSync(hostGuidesNodeModules, path.join(sandbox.workDir, 'node_modules'));
    }

    const parserPatternsPath = path.join(sandbox.workDir, 'parser-pattern-library.test.ts');
    const playwrightPatternsPath = path.join(sandbox.workDir, 'playwright-pattern-library.grader.ts');

    const tsMorphDts = path.join(repoRoot, 'guides', 'node_modules/ts-morph/lib/ts-morph.d.ts');
    const linkedomDts = path.join(repoRoot, 'guides', 'node_modules/linkedom/types/index.d.ts');

    const prompt = buildTargetGraderPrompt({
      guideFile: GUIDE_FILE,
      expectationsFile: EXPECTATIONS_FILE,
      solutionPatchFile: SOLUTION_PATCH_FILE,
      zeroPassratePatchFile: ZERO_PASSRATE_PATCH_FILE,
      graderFile: GRADER_FILE,
      baseApp,
      templateFile: 'template.grader.ts',
      parserPatternLibraryPath: parserPatternsPath,
      playwrightPatternLibraryPath: playwrightPatternsPath,
      tsMorphDtsPath: tsMorphDts,
      linkedomDtsPath: linkedomDts,
      failureContext,
    });

    await runAgent(prompt, sandbox.workDir);

    const generatedGrader = path.join(sandbox.workDir, GRADER_FILE);
    if (fs.existsSync(generatedGrader)) {
      const destGrader = path.join(guideDirAbs, TARGETS_DIR, baseApp, GRADER_FILE);
      fs.mkdirSync(path.dirname(destGrader), { recursive: true });
      fs.copyFileSync(generatedGrader, destGrader);
    }

    const generatedSolution = path.join(sandbox.workDir, SOLUTION_PATCH_FILE);
    if (fs.existsSync(generatedSolution)) {
      const destSolution = path.join(guideDirAbs, TARGETS_DIR, baseApp, SOLUTION_PATCH_FILE);
      fs.copyFileSync(generatedSolution, destSolution);
    }

    const generatedZeroPassrate = path.join(sandbox.workDir, ZERO_PASSRATE_PATCH_FILE);
    if (fs.existsSync(generatedZeroPassrate)) {
      const destZeroPassrate = path.join(guideDirAbs, TARGETS_DIR, baseApp, ZERO_PASSRATE_PATCH_FILE);
      fs.copyFileSync(generatedZeroPassrate, destZeroPassrate);
    }
  } finally {
    sandbox.cleanup();
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
