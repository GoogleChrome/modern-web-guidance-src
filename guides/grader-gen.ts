import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { baseAppsDir } from '../lib/paths.ts';
import { setupGuideDevWorkDir, runAgent } from './lib/utils.ts';
import { buildTargetGraderPrompt } from './gd-dev-prompts.ts';
import {
  GUIDE_FILE,
  EXPECTATIONS_FILE,
  getDefaultSolutionAgent,
  getActiveSolutionAgents,
  SOLUTION_PATCH_FILES,
  type SolutionAgent,
  ZERO_PASSRATE_PATCH_FILE,
  GRADER_FILE,
  TARGETS_DIR,
  PATCHES_DIR,
  SUPPORTED_BASE_APPS
} from '../lib/guide-validation.ts';
import { cCyan, cGreen } from '../lib/colors.ts';

export async function generateTargetGrader(guideDirAbs: string, baseApp: string, failureContext?: string): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const relativeGuidePath = path.relative(repoRoot, guideDirAbs);
  const relativeWorkSubdir = path.join(relativeGuidePath, 'targets', baseApp);

  const workDir = setupGuideDevWorkDir(`${baseApp}-grader`, relativeWorkSubdir);
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), workDir, {
      recursive: true,
      filter: (src) => !src.includes('node_modules')
    });
    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));

    const tempHome = path.resolve(workDir, '../../../../..'); // workDir is tempHome/guides/cat/guide/targets/app
    
    // =========================================================================
    // 1. RUNTIME EXECUTION DEPENDENCIES (in tempHome)
    // Required so grader.ts runtime import `../../../../test-fixture.ts` and
    // test-fixture.ts import `../lib/patch-utils.ts` resolve during Playwright execution.
    // =========================================================================
    fs.mkdirSync(path.join(tempHome, 'lib'), { recursive: true });
    fs.copyFileSync(
      path.resolve(repoRoot, 'lib', 'patch-utils.ts'),
      path.join(tempHome, 'lib', 'patch-utils.ts')
    );
    fs.mkdirSync(path.join(tempHome, 'guides'), { recursive: true });
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'test-fixture.ts'),
      path.join(tempHome, 'guides', 'test-fixture.ts')
    );

    // =========================================================================
    // 2. AGENT SANDBOX VIEWING & EDITING DEPENDENCIES (in workDir)
    // All reference files, pattern libraries, API definitions, and patches must live
    // directly inside `workDir` so the CLI agent's `read_file` tool can access them
    // without triggering sandbox "Path not in workspace" security errors.
    // =========================================================================
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'template.grader.ts'),
      path.join(workDir, 'template.grader.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'test-fixture.ts'),
      path.join(workDir, 'test-fixture.reference.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'parser-pattern-library.test.ts'),
      path.join(workDir, 'parser-pattern-library.test.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'playwright-pattern-library.grader.ts'),
      path.join(workDir, 'playwright-pattern-library.grader.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'node_modules', 'ts-morph', 'lib', 'ts-morph.d.ts'),
      path.join(workDir, 'ts-morph.d.ts')
    );
    fs.copyFileSync(
      path.resolve(repoRoot, 'guides', 'node_modules', 'linkedom', 'types', 'index.d.ts'),
      path.join(workDir, 'linkedom.d.ts')
    );

    const sourcePatches = path.join(guideDirAbs, TARGETS_DIR, baseApp, PATCHES_DIR);
    if (fs.existsSync(sourcePatches)) {
      fs.cpSync(sourcePatches, path.join(workDir, PATCHES_DIR), { recursive: true });
    }

    const targetDir = path.join(guideDirAbs, TARGETS_DIR, baseApp);
    const activeAgents = getActiveSolutionAgents(targetDir);
    const solutionPatchFiles: Partial<Record<SolutionAgent, string>> = {};
    for (const agent of activeAgents) {
      solutionPatchFiles[agent] = SOLUTION_PATCH_FILES[agent];
    }

    const prompt = buildTargetGraderPrompt({
      guideFile: GUIDE_FILE,
      expectationsFile: EXPECTATIONS_FILE,
      solutionPatchFiles,
      zeroPassratePatchFile: ZERO_PASSRATE_PATCH_FILE,
      graderFile: GRADER_FILE,
      baseApp,
      templateFile: 'template.grader.ts',
      testFixtureReferencePath: path.join(workDir, 'test-fixture.reference.ts'),
      parserPatternLibraryPath: path.join(workDir, 'parser-pattern-library.test.ts'),
      playwrightPatternLibraryPath: path.join(workDir, 'playwright-pattern-library.grader.ts'),
      tsMorphDtsPath: path.join(workDir, 'ts-morph.d.ts'),
      linkedomDtsPath: path.join(workDir, 'linkedom.d.ts'),
      failureContext,
    });

    await runAgent(getDefaultSolutionAgent(), prompt, workDir);

    const generatedGrader = path.join(workDir, GRADER_FILE);
    if (fs.existsSync(generatedGrader)) {
      const destGrader = path.join(guideDirAbs, TARGETS_DIR, baseApp, GRADER_FILE);
      fs.mkdirSync(path.dirname(destGrader), { recursive: true });
      fs.copyFileSync(generatedGrader, destGrader);
    }

    const generatedPatches = path.join(workDir, PATCHES_DIR);
    if (fs.existsSync(generatedPatches)) {
      const destPatches = path.join(guideDirAbs, TARGETS_DIR, baseApp, PATCHES_DIR);
      fs.mkdirSync(destPatches, { recursive: true });
      fs.cpSync(generatedPatches, destPatches, { recursive: true });
    }
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (e) {
      console.warn(`Warning: failed to remove workDir ${workDir}: ${(e as Error).message}`);
    }
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
