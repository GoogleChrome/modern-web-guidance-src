import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { rootDir, guidesDir, getGuideResultsDir } from '../core/paths.ts';
import { testGrader, runPlaywright, type CalibrationResult } from '../grading/run-grader.ts';
import { generateTargetGrader } from '../grading/generate-grader.ts';
import { spawnAsync } from '../harness/lib/agent-shared.ts';
import { Agents, type SuiteConfig } from '../harness/config.ts';
import { collectGuidesUsed } from '../harness/lib/guide-usage.ts';
import { setupGuideDevWorkDir, runAgent, copyBaseAppToWorkspace } from '../harness/lib/utils.ts';
import {
  buildSolutionPrompt,
  buildZeroPassratePrompt,
  buildTargetTaskPrompt,
} from './dev-prompts.ts';
import { cRed, cGreen, cYellow, cCyan, cBold, cDim } from '../core/colors.ts';
import { capturePatchFromGit, initGitRepo } from '../core/patch-utils.ts';
import {
  type GuideInventory,
  GUIDE_FILE,
  DEMO_FILE,
  EXPECTATIONS_FILE,
  NEGATIVE_DEMO_FILE,
  GRADER_FILE,
  TASK_FILE,
  REPORT_FILE,
  TARGETS_DIR,
  SUPPORTED_BASE_APPS,
  getDefaultSolutionAgent,
  getActiveSolutionAgents,
  SOLUTION_PATCH_FILES,
  type SolutionAgent,
  ZERO_PASSRATE_PATCH_FILE,
  getTaskMap,
  resetGuidesMap,
  inventoryGuide,
  classifyGuide,
  scanAllGuides,
  isDisciplineGuide,
} from '../core/guide-validation.ts';
import { runDevReport, applyPrReviewFeedback } from './dev-report.ts';

export interface DevGuideOptions {
  maxRetries?: number;   // default: 2
  test?: boolean;        // default: true — run agent test after calibration
  guidedOnly?: boolean;  // skip calibration and only run the guided agent test
  verbose?: boolean;
  suiteConfig?: SuiteConfig;
  targets?: readonly string[];
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
    rerunMode?: string;
  };
}

export const devCli = {
  commitStepArtifacts(guideDir: string, commitMessage: string): boolean {
    try {
      const branch = execSync('git branch --show-current', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (!branch.startsWith('gd-dev/')) return false;

      const status = execSync(`git status --porcelain "${guideDir}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      if (!status) return false;

      execSync(`git add "${guideDir}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      execSync(`git commit -m "${commitMessage}"`, { stdio: ['pipe', 'pipe', 'ignore'] });
      return true;
    } catch {
      return false;
    }
  },
};

function printInventory(inv: GuideInventory, targets: readonly string[] = SUPPORTED_BASE_APPS): void {
  const icon = (exists: boolean, willGenerate = false, warn = false) => {
    if (exists && !warn) return '\u2705';
    if (warn) return '\u26a0\ufe0f ';
    if (willGenerate) return '\u2b1c';
    return '\u274c';
  };

  console.log(`\n\ud83d\udccb Guide: ${cBold(inv.name)}`);
  console.log(`   ${GUIDE_FILE.padEnd(18)} ${icon(inv.hasGuide)}`);
  if (!inv.hasExpectations) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(false)} ${cDim('missing')}`);
  } else if (inv.expectationsEmpty) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(true, false, true)} ${cDim('empty')}`);
  } else {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(true)}`);
  }

  if (inv.targets) {
    console.log(`\n   ${cDim('Targets:')}`);
    for (const target of inv.targets.filter(t => targets.includes(t.name))) {
      console.log(`     ${cBold(target.name)}`);
      console.log(`       ${'solutions/*.patch'.padEnd(18)} ${target.hasSolution ? icon(true) : icon(false, true) + ' will generate'}`);
      console.log(`       ${'zero-passrate.patch'.padEnd(18)} ${target.hasZeroPassrate ? icon(true) : icon(false, true) + ' will generate'}`);
      console.log(`       ${'grader.ts'.padEnd(18)} ${target.hasGrader ? icon(true) : icon(false, true) + ' will generate'}`);
      console.log(`       ${'task.md'.padEnd(18)} ${target.hasTask ? icon(true) : icon(false, true) + ' will generate'}`);
    }
  } else {
    console.log(`   ${DEMO_FILE.padEnd(18)} ${icon(inv.hasDemo)}`);
    console.log(`   ${NEGATIVE_DEMO_FILE.padEnd(18)} ${inv.hasNegativeDemo ? icon(true) : icon(false, true) + ' will generate'}`);
    console.log(`   ${GRADER_FILE.padEnd(18)} ${inv.hasGrader ? icon(true) : icon(false, true) + ' will generate'}`);
    console.log(`   ${TASK_FILE.padEnd(18)} ${inv.hasTask ? icon(true) : icon(false, true) + ' will generate'}`);
  }
}

export function exciseOldEvalArtifacts(guideDir: string): void {
  const oldArtifacts = [
    path.join(guideDir, 'tasks'),
    path.join(guideDir, GRADER_FILE),
    path.join(guideDir, NEGATIVE_DEMO_FILE),
  ];

  for (const artifactPath of oldArtifacts) {
    if (fs.existsSync(artifactPath)) {
      fs.rmSync(artifactPath, { recursive: true, force: true });
    }
  }
}

export async function devGuide(targetDirRaw: string, options: DevGuideOptions = {}, inv?: GuideInventory): Promise<boolean> {
  const maxRetries = options.maxRetries ?? 4;
  const targetDir = path.resolve(process.cwd(), targetDirRaw);
  const targets = options.targets ?? SUPPORTED_BASE_APPS;

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    return false;
  }

  // Step 0: If rerun has reviewer comments, apply feedback to guide/expectations/targets first
  if (options.prContext?.comments) {
    await applyPrReviewFeedback(targetDir, options.prContext);
  }

  // Under needs-eval-gen, wipe targets after Step 0 so Step 2 regenerates all target artifacts from source guidance
  if (options.prContext?.rerunMode === 'needs-eval-gen') {
    for (const t of targets) {
      const targetCapsuleDir = path.join(targetDir, TARGETS_DIR, t);
      if (fs.existsSync(targetCapsuleDir)) {
        fs.rmSync(targetCapsuleDir, { recursive: true, force: true });
      }
    }
  }

  // Step 0.5: Excise old eval artifacts if they exist
  exciseOldEvalArtifacts(targetDir);

  // Step 1: Validate guide inventory
  const currentInv = inv?.targets ? inv : inventoryGuide(targetDir, { useTargetEvals: true });
  printInventory(currentInv, targets);

  if (!currentInv.hasGuide) {
    if (currentInv.isStub) {
      console.error(cRed(`\nError: ${GUIDE_FILE} is just a stub (missing content) in ${targetDir}`));
    } else {
      console.error(cRed(`\nError: ${GUIDE_FILE} is required but missing or empty in ${targetDir}`));
    }
    return false;
  }
  if (!currentInv.hasExpectations) {
    console.error(cRed(`\nError: ${EXPECTATIONS_FILE} is required for generating target artifacts.`));
    return false;
  }

  // Step 2: Parallel target generation across targets
  await Promise.all(
    targets.map(async (baseApp) => {
      const targetCapsuleDir = path.join(targetDir, TARGETS_DIR, baseApp);
      fs.mkdirSync(targetCapsuleDir, { recursive: true });

      const solutionAgents = getActiveSolutionAgents(targetCapsuleDir);
      const patchTasks = solutionAgents.map(async (agent) => {
        const solPatchFile = SOLUTION_PATCH_FILES[agent];
        const solutionPatch = path.join(targetCapsuleDir, solPatchFile);
        if (!fs.existsSync(solutionPatch)) {
          console.log(cCyan(`\n--- Generating ${solPatchFile} for ${baseApp} (${agent}) ---`));
          await generateTargetPatch(targetDir, baseApp, agent);
        }
      });

      const zeroPassrateTask = (async () => {
        const zeroPassratePatch = path.join(targetCapsuleDir, ZERO_PASSRATE_PATCH_FILE);
        if (!fs.existsSync(zeroPassratePatch)) {
          console.log(cCyan(`\n--- Generating ${ZERO_PASSRATE_PATCH_FILE} for ${baseApp} ---`));
          await generateTargetPatch(targetDir, baseApp, 'zero-passrate');
        }
      })();

      const taskTask = (async () => {
        const taskFile = path.join(targetCapsuleDir, TASK_FILE);
        if (!fs.existsSync(taskFile)) {
          console.log(cCyan(`\n--- Generating ${TASK_FILE} for ${baseApp} ---`));
          await generateTargetTask(targetDir, baseApp, options.prContext);
        }
      })();

      // Wait for solution patches, zero-passrate patch, and task.md to finish
      await Promise.all([...patchTasks, zeroPassrateTask, taskTask]);

      // Grader generation depends on the generated solution patches in patches/
      const graderFile = path.join(targetCapsuleDir, GRADER_FILE);
      if (!fs.existsSync(graderFile)) {
        console.log(cCyan(`\n--- Generating ${GRADER_FILE} for ${baseApp} ---`));
        await generateTargetGrader(targetDir, baseApp, undefined, options.prContext);
      }
    })
  );

  // Step 3: Calibrate targets in parallel and retry grader if calibration fails
  const calibrationResults = await Promise.all(
    targets.map(async (baseApp) => {
      console.log(cCyan(`\n--- Calibrating target: ${baseApp} ---`));
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const res = await testGrader(path.join(targetDirRaw, TARGETS_DIR, baseApp));
        if (res.success) {
          console.log(cGreen(`✅ ${baseApp} calibrated successfully on attempt ${attempt}!`));
          return true;
        }

        if (attempt <= maxRetries) {
          console.log(cYellow(`Attempt ${attempt} calibration failed for ${baseApp}. Regenerating ${GRADER_FILE}...`));
          await generateTargetGrader(targetDir, baseApp, res.errorDetails, options.prContext);
        } else {
          console.error(cRed(`❌ ${baseApp} failed calibration after ${attempt} attempt(s): ${res.errorDetails || 'Unknown error'}`));
          return false;
        }
      }
      return false;
    })
  );
  const overallSuccess = calibrationResults.every(Boolean);

  // Step 4: Run agent evaluation test (runs by default unless --no-test is passed or calibration failed)
  if (options.test !== false && overallSuccess) {
    await runAgentTest(targetDir, currentInv.name, options.guidedOnly, options.suiteConfig, targets);
  }

  // Summary
  const defaultAgent = getDefaultSolutionAgent();
  printSummary(targetDir, currentInv, { success: overallSuccess, solutions: { [defaultAgent]: { passed: 0, failed: 0, failingTests: [] }, [Agents.CLAUDE_CODE]: { passed: 0, failed: 0, failingTests: [] }, [Agents.CODEX_CLI]: { passed: 0, failed: 0, failingTests: [] } }, zeroPassrate: { passed: 0, failed: 0, passingTests: [] } }, 1, targets);

  // Commit generated evals and artifacts before Step 5 report modifications
  devCli.commitStepArtifacts(targetDir, `feat(guide): generate ${currentInv.name} evaluations and artifacts`);

  // Step 5: Run evaluation report (printed last)
  if (options.test !== false && overallSuccess) {
    await runDevReport(targetDir, currentInv, targets, options.prContext);
  }

  // Commit post-report modifications if any files were updated by the report agent
  devCli.commitStepArtifacts(targetDir, `fix(guide): apply post-evaluation report recommendations for ${currentInv.name}`);

  return overallSuccess;
}

async function generateTargetPatch(guideDirAbs: string, baseApp: string, patchType: SolutionAgent | 'zero-passrate'): Promise<void> {
  const agent = patchType === 'zero-passrate' ? getDefaultSolutionAgent() : patchType;
  const { workDir, tempHome } = setupGuideDevWorkDir(`${baseApp}-${patchType}`, undefined, agent);
  try {
    await copyBaseAppToWorkspace(baseApp, workDir);

    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));

    // Git init is required for capturePatchFromGit to extract git diffs
    initGitRepo(workDir);

    const promptOpts = {
      guideFile: GUIDE_FILE,
      expectationsFile: EXPECTATIONS_FILE,
      workDir,
      isDisciplineGuide: isDisciplineGuide(path.basename(guideDirAbs), path.basename(path.dirname(guideDirAbs))),
    };
    const prompt = patchType === 'zero-passrate'
      ? buildZeroPassratePrompt(promptOpts)
      : buildSolutionPrompt(promptOpts);

    await runAgent(agent, prompt, workDir, { homeDir: tempHome });

    const patchRelFile = patchType === 'zero-passrate' ? ZERO_PASSRATE_PATCH_FILE : SOLUTION_PATCH_FILES[patchType];
    const destPatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, patchRelFile);
    fs.mkdirSync(path.dirname(destPatch), { recursive: true });
    capturePatchFromGit(workDir, destPatch);
    if (!fs.existsSync(destPatch)) {
      fs.writeFileSync(destPatch, '');
    }
  } finally {
    try {
      fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (e) {
      console.warn(`Warning: failed to remove tempHome ${tempHome}: ${(e as Error).message}`);
    }
  }
}

async function generateTargetTask(
  guideDirAbs: string,
  baseApp: string,
  prContext?: DevGuideOptions['prContext']
): Promise<void> {
  const { workDir, tempHome } = setupGuideDevWorkDir(`${baseApp}-task`);
  try {
    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    await copyBaseAppToWorkspace(baseApp, workDir);

    const prompt = buildTargetTaskPrompt({
      guideFile: GUIDE_FILE,
      taskFile: TASK_FILE,
      baseApp,
      isDisciplineGuide: isDisciplineGuide(path.basename(guideDirAbs), path.basename(path.dirname(guideDirAbs))),
      prContext,
    });

    await runAgent(getDefaultSolutionAgent(), prompt, workDir, { homeDir: tempHome });

    const generatedTask = path.join(workDir, TASK_FILE);
    if (!fs.existsSync(generatedTask) || !fs.readFileSync(generatedTask, 'utf-8').trim()) {
      throw new Error(`Agent finished without generating a valid ${TASK_FILE} for ${baseApp}.`);
    }
    const destTask = path.join(guideDirAbs, TARGETS_DIR, baseApp, TASK_FILE);
    fs.mkdirSync(path.dirname(destTask), { recursive: true });
    fs.copyFileSync(generatedTask, destTask);
  } finally {
    try {
      fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (e) {
      console.warn(`Warning: failed to remove tempHome ${tempHome}: ${(e as Error).message}`);
    }
  }
}

async function runAgentTest(
  targetDir: string,
  guideName: string,
  guidedOnly = false,
  suiteConfig?: SuiteConfig,
  targets: readonly string[] = SUPPORTED_BASE_APPS
): Promise<void> {
  console.log(cCyan(`\n--- Running agent tests ---`));

  const targetsDir = path.join(targetDir, 'targets');
  if (!fs.existsSync(targetsDir) || !fs.statSync(targetsDir).isDirectory()) {
    console.log(cYellow(`No targets directory found in ${targetDir}. Skipping agent tests.`));
    return;
  }

  const baseApps = fs.readdirSync(targetsDir).filter(name => {
    return !name.startsWith('.') && fs.statSync(path.join(targetsDir, name)).isDirectory() && targets.includes(name);
  });

  if (baseApps.length === 0) {
    console.log(cYellow(`No supported base apps found in ${targetsDir}. Skipping agent tests.`));
    return;
  }

  // Build workspace dependencies
  console.log(`\nBuilding skills-cli dist...`);
  const buildCode = await spawnAsync('pnpm', ['run', 'build-dist'], { cwd: rootDir, stdio: 'inherit' });

  if (buildCode !== 0) {
    console.error(cRed(`Failed to build workspace dependencies (exit code ${buildCode})`));
    return;
  }

  resetGuidesMap();
  const taskMap = getTaskMap();

  await Promise.all(
    baseApps.map(async (baseApp) => {
      console.log(cCyan(`\nRunning agent test for target: ${baseApp}`));
      const taskKey = `${guideName}/${baseApp}`;
      const taskInfo = taskMap.get(taskKey);
      if (!taskInfo) {
        console.error(cRed(`Task info not found for ${taskKey}, cannot run agent test.`));
        return;
      }

      const targetGraderPath = path.join(targetsDir, baseApp, 'grader.ts');
      if (!fs.existsSync(targetGraderPath)) {
        console.error(cRed(`Could not find grader.ts for ${baseApp} at ${targetGraderPath}`));
        return;
      }

      const results: Record<string, { passed: number; total: number }> = {};

      // 1. Grade base app (with zero-passrate baseline applied)
      const relGuidePath = path.relative(guidesDir, targetDir);
      const [category, name] = relGuidePath.split(path.sep);
      const guideResultsDir = getGuideResultsDir({ category, name: name || guideName });
      const zeroPassratePatch = path.join(targetsDir, baseApp, ZERO_PASSRATE_PATCH_FILE);
      const preResults = await gradeOutput(
        baseApp,
        targetsDir,
        targetGraderPath,
        zeroPassratePatch
      );
      if (preResults) results['pre'] = preResults;

      // 2. Run agent suite
      const { runSuite } = await import('../harness/run-suite.ts');
      const testOutputDir = path.join(guideResultsDir, baseApp);
      const agent = getDefaultSolutionAgent();
      await runSuite({
        name: `${guideName}-${baseApp}`,
        outputDir: testOutputDir,
        tasks: [taskKey],
        numRuns: 1,
        guidedOnly,
        suiteConfig: {
          ...suiteConfig,
          agent,
        },
      });

      // 3. Grade agent output (unguided + guided)
      const runTypes = guidedOnly ? ['guided'] : ['unguided', 'guided'];
      for (const runType of runTypes) {
        const resultDir = path.join(testOutputDir, '1', guideName, baseApp, runType);
        if (!fs.existsSync(resultDir)) continue;
        const patchFile = path.join(resultDir, 'agent.patch');
        const gradeResults = await gradeOutput(
          runType,
          resultDir,
          targetGraderPath,
          patchFile,
          zeroPassratePatch
        );
        if (gradeResults) results[runType] = gradeResults;
      }

      let guidesConsumed: string[] = [];
      const guidedDir = path.join(testOutputDir, '1', guideName, baseApp, 'guided');
      if (fs.existsSync(guidedDir)) {
        const usage = await collectGuidesUsed(guidedDir);
        guidesConsumed = [...new Set([...usage.retrievedGuides, ...usage.fileReadGuides])];
      }

      printTestComparison(results, guidesConsumed, baseApp);
    })
  );
}

async function gradeOutput(
  label: string,
  appDir: string,
  graderPath: string,
  patchFile?: string,
  zeroPassrateFile?: string
): Promise<{ passed: number; total: number } | null> {
  console.log(cYellow(`\nGrading ${label}...`));

  try {
    const gradeResults = await runPlaywright(appDir, graderPath, 'pipe', patchFile, zeroPassrateFile);
    const passed = gradeResults.stats?.expected || 0;
    const failed = gradeResults.stats?.unexpected || 0;
    const total = passed + failed;

    if (total > 0) {
      console.log(`  ${label}: ${passed}/${total} checks passed (${Math.round(passed / total * 100)}%)`);
    }
    return { passed, total };
  } catch (err) {
    console.error(cRed(`Failed to grade ${label}: ${err}`));
    return null;
  }
}

export function printTestComparison(
  results: Record<string, { passed: number; total: number }>,
  guidesConsumed: string[] | undefined,
  baseApp: string
): void {
  const total = results.pre?.total || results.guided?.total || results.unguided?.total || 0;
  if (total === 0) return;

  const fmt = (label: string, r: { passed: number; total: number } | undefined, pad: number) => {
    if (!r) return `  ${label.padEnd(pad)} —`;
    const pct = Math.round(r.passed / r.total * 100);
    return `  ${label.padEnd(pad)} ${r.passed}/${r.total} checks passed (${pct}%)`;
  };

  console.log(cBold(`\nAgent test results (${baseApp}):`));
  console.log(fmt('Base app (zero-passrate):', results.pre, 25));
  console.log(fmt('Unguided:', results.unguided, 25));
  console.log(fmt('Guided:', results.guided, 25));

  if (results.guided && results.unguided && results.guided.total > 0 && results.unguided.total > 0) {
    const guidedPct = Math.round(results.guided.passed / results.guided.total * 100);
    const unguidedPct = Math.round(results.unguided.passed / results.unguided.total * 100);
    const impact = guidedPct - unguidedPct;
    console.log(`  ${'Guide impact:'.padEnd(25)} ${impact >= 0 ? '+' : ''}${impact}% (vs unguided)`);
  }

  if (guidesConsumed && guidesConsumed.length > 0) {
    console.log(`  ${'Guides consumed:'.padEnd(18)} [${guidesConsumed.join(', ')}]`);
  }
}

function printSummary(targetDir: string, inv: GuideInventory, result: CalibrationResult | null, attempts: number, targets: readonly string[] = SUPPORTED_BASE_APPS): void {
  const relDir = path.relative(process.cwd(), targetDir);

  console.log(`\n${'='.repeat(60)}`);
  if (result?.success) {
    console.log(cBold(cGreen(`\u2705 Guide: ${inv.name}`)));
  } else {
    console.log(cBold(cRed(`\u274c Guide: ${inv.name}`)));
  }

  console.log(`   ${GUIDE_FILE.padEnd(28)} \u2705 exists`);
  
  if (!inv.hasExpectations || inv.expectationsEmpty) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(28)} \u26a0\ufe0f  ${inv.hasExpectations ? 'empty' : 'missing'} (consider adding assertions)`);
  } else {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(28)} \u2705 exists`);
  }

  const targetsDir = path.join(targetDir, TARGETS_DIR);
  if (fs.existsSync(targetsDir) && fs.statSync(targetsDir).isDirectory()) {
    const baseApps = fs.readdirSync(targetsDir).filter(name => {
      return !name.startsWith('.') && fs.statSync(path.join(targetsDir, name)).isDirectory() && targets.includes(name);
    });

    for (const baseApp of baseApps) {
      console.log(`\n   ${cBold(`Target Base App: ${baseApp}`)}`);
      const appTargetDir = path.join(targetsDir, baseApp);
      
      const zeroPassratePatchPath = path.join(appTargetDir, ZERO_PASSRATE_PATCH_FILE);
      const graderPath = path.join(appTargetDir, GRADER_FILE);
      const taskPath = path.join(appTargetDir, TASK_FILE);

      const printFileStatus = (label: string, filepath: string, existsMsg = 'exists', missingMsg = 'missing') => {
        const exists = fs.existsSync(filepath);
        console.log(`     ${label.padEnd(28)} ${exists ? cGreen('✅') : cRed('❌')} ${exists ? existsMsg : missingMsg}`);
      };

      const activeAgents = getActiveSolutionAgents(appTargetDir);
      for (const agent of activeAgents) {
        const solPatchFile = SOLUTION_PATCH_FILES[agent];
        const solutionPatchPath = path.join(appTargetDir, solPatchFile);
        printFileStatus(solPatchFile, solutionPatchPath, 'generated', 'not generated');
      }

      printFileStatus(ZERO_PASSRATE_PATCH_FILE, zeroPassratePatchPath, 'generated', 'not generated');
      
      if (result?.success) {
        printFileStatus(GRADER_FILE, graderPath, `calibrated (attempt ${attempts})`, 'calibration failed');
      } else {
        printFileStatus(GRADER_FILE, graderPath, 'exists', 'missing');
      }
      
      printFileStatus(TASK_FILE, taskPath, 'generated', 'not generated');
    }
  }

  const evalReportPath = path.join(getGuideResultsDir(inv), REPORT_FILE);
  if (fs.existsSync(evalReportPath)) {
    console.log(`\n   ${cBold('Evaluation Report:')}`);
    console.log(`     ${REPORT_FILE.padEnd(28)} ${cGreen('✅')} generated`);
  }

  console.log(`\nAll generated files are in ${relDir}/`);
  if (result?.success) {
    console.log(`Ready to review and commit.`);
  }
  console.log('');
}

// Batch mode: process all incomplete guides
export async function devAll(options: DevGuideOptions = {}): Promise<void> {
  const incompleteGuides = scanAllGuides().filter(inv =>
    inv.hasGuide && inv.hasExpectations && !inv.expectationsEmpty && classifyGuide(inv) !== 'complete'
  );

  if (incompleteGuides.length === 0) {
    console.log(cGreen(`All guides are complete!`));
    return;
  }

  console.log(cBold(`Found ${incompleteGuides.length} incomplete/uncalibrated guide(s):\n`));
  for (const inv of incompleteGuides) {
    const status = classifyGuide(inv);
    console.log(`  ${inv.name} ${cDim(`(status: ${status})`)}`);
  }
  console.log('');

  const results: { name: string; success: boolean }[] = [];

  // Use sequential processing to avoid resource exhaustion
  for (const inv of incompleteGuides) {
    console.log(cBold(`\n${'='.repeat(60)}`));
    console.log(cBold(`Processing: ${inv.name}`));
    console.log(`${'='.repeat(60)}`);

    try {
      const success = await devGuide(inv.dir, { ...options, test: false }, inv);
      results.push({ name: inv.name, success });
    } catch (err) {
      console.error(cRed(`Failed to process ${inv.name}: ${err}`));
      results.push({ name: inv.name, success: false });
    }
  }

  // Aggregate results
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(cBold(`\n${'='.repeat(60)}`));
  console.log(cBold(`Batch complete: ${succeeded.length}/${results.length} guides calibrated`));
  if (failed.length > 0) {
    console.log(cRed(`Failed: ${failed.map(r => r.name).join(', ')}`));
  }
  console.log('');
}

if (import.meta.url.startsWith('file:') && process.argv[1] === import.meta.filename) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const isTest = !args.includes('--no-test');
  const guidedOnly = args.includes('--guided-only');

  if (!dir) {
    console.error('Usage: node src/authoring/dev.ts <path/to/guide> [--no-test] [--guided-only]');
    process.exit(1);
  }

  devGuide(dir, { test: isTest, guidedOnly }).then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
