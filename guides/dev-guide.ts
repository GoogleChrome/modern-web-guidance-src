import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rootDir, baseAppsDir } from '../lib/paths.ts';
import { testGrader, runPlaywright, type CalibrationResult } from './run-grader.ts';
import { generateTargetGrader } from './grader-gen.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  spawnAsync
} from '../harness/lib/agent-shared.ts';
import { defaultSuiteConfig, Serving, Agents, type SuiteConfig } from '../harness/config.ts';
import { collectGuidesUsed } from '../harness/lib/guidance_validation.ts';
import { setupIsolatedWorkDir, runAgent } from './lib/utils.ts';
import {
  buildSolutionPrompt,
  buildBrokenPrompt,
  buildTargetTaskPrompt,
} from './gd-dev-prompts.ts';
import { cRed, cGreen, cYellow, cCyan, cBold, cDim } from '../lib/colors.ts';
import { execSync } from 'node:child_process';
import { capturePatchFromGit } from '../lib/patch-utils.ts';
import {
  type GuideInventory,
  type GuideStatus,
  GUIDE_FILE,
  DEMO_FILE,
  EXPECTATIONS_FILE,
  NEGATIVE_DEMO_FILE,
  GRADER_FILE,
  TASK_FILE,
  TARGETS_DIR,
  SUPPORTED_BASE_APPS,
  SOLUTION_PATCH_FILE,
  BROKEN_PATCH_FILE,
  getTaskMap,
  inventoryGuide,
  classifyGuide,
  scanAllGuides
} from '../lib/guide-validation.ts';

export interface DevGuideOptions {
  maxRetries?: number;   // default: 2
  test?: boolean;        // default: true — run agent test after calibration
  guidedOnly?: boolean;  // skip calibration and only run the guided agent test
  verbose?: boolean;
  suiteConfig?: SuiteConfig;
}

function printInventory(inv: GuideInventory): void {
  const icon = (exists: boolean, willGenerate = false, warn = false) => {
    if (exists && !warn) return '\u2705';
    if (warn) return '\u26a0\ufe0f ';
    if (willGenerate) return '\u2b1c';
    return '\u274c';
  };

  console.log(`\n\ud83d\udccb Guide: ${cBold(inv.name)}`);
  console.log(`   ${GUIDE_FILE.padEnd(18)} ${icon(inv.hasGuide)}`);
  console.log(`   ${DEMO_FILE.padEnd(18)} ${icon(inv.hasDemo)}`);

  if (!inv.hasExpectations) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(false)} ${cDim('missing')}`);
  } else if (inv.expectationsEmpty) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(true, false, true)} ${cDim('empty')}`);
  } else {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(18)} ${icon(true)}`);
  }

  console.log(`   ${NEGATIVE_DEMO_FILE.padEnd(18)} ${inv.hasNegativeDemo ? icon(true) : icon(false, true) + ' will generate'}`);
  console.log(`   ${GRADER_FILE.padEnd(18)} ${inv.hasGrader ? icon(true) : icon(false, true) + ' will generate'}`);
  console.log(`   ${TASK_FILE.padEnd(18)} ${inv.hasTask ? icon(true) : icon(false, true) + ' will generate'}`);
}

export async function devGuide(targetDirRaw: string, options: DevGuideOptions = {}, inv?: GuideInventory): Promise<boolean> {
  const maxRetries = options.maxRetries ?? 4;
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    return false;
  }

  // Step 1: Automatic clean-slate excision of legacy root files
  const legacyFiles = [DEMO_FILE, NEGATIVE_DEMO_FILE, GRADER_FILE, 'tasks'];
  for (const file of legacyFiles) {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      console.log(cCyan(`Excising legacy single-page artifact: ${file}`));
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  }

  const currentInv = inv || inventoryGuide(targetDir);
  printInventory(currentInv);

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

  // Step 2: Sequential target generation across SUPPORTED_BASE_APPS
  for (const baseApp of SUPPORTED_BASE_APPS) {
    const targetCapsuleDir = path.join(targetDir, TARGETS_DIR, baseApp);
    fs.mkdirSync(targetCapsuleDir, { recursive: true });

    const solutionPatch = path.join(targetCapsuleDir, SOLUTION_PATCH_FILE);
    if (!fs.existsSync(solutionPatch)) {
      console.log(cCyan(`\n--- Generating ${SOLUTION_PATCH_FILE} for ${baseApp} ---`));
      await generateTargetPatch(targetDir, baseApp, 'solution');
    }

    const brokenPatch = path.join(targetCapsuleDir, BROKEN_PATCH_FILE);
    if (!fs.existsSync(brokenPatch)) {
      console.log(cCyan(`\n--- Generating ${BROKEN_PATCH_FILE} for ${baseApp} ---`));
      await generateTargetPatch(targetDir, baseApp, 'broken');
    }

    const graderFile = path.join(targetCapsuleDir, GRADER_FILE);
    if (!fs.existsSync(graderFile)) {
      console.log(cCyan(`\n--- Generating ${GRADER_FILE} for ${baseApp} ---`));
      await generateTargetGrader(targetDir, baseApp);
    }

    const taskFile = path.join(targetCapsuleDir, TASK_FILE);
    if (!fs.existsSync(taskFile)) {
      console.log(cCyan(`\n--- Generating ${TASK_FILE} for ${baseApp} ---`));
      await generateTargetTask(targetDir, baseApp);
    }
  }

  // Step 3: Calibrate targets and retry grader if calibration fails
  let overallSuccess = true;
  for (const baseApp of SUPPORTED_BASE_APPS) {
    console.log(cCyan(`\n--- Calibrating target: ${baseApp} ---`));
    let success = false;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await testGrader(targetDirRaw, baseApp);
      if (res.success) {
        console.log(cGreen(`✅ ${baseApp} calibrated successfully on attempt ${attempt}!`));
        success = true;
        break;
      }

      if (res.stage === 'calibration' && attempt <= maxRetries) {
        console.log(cYellow(`Attempt ${attempt} calibration failed for ${baseApp}. Regenerating ${GRADER_FILE}...`));
        await generateTargetGrader(targetDir, baseApp, res.errorDetails);
      } else {
        console.error(cRed(`❌ ${baseApp} failed calibration after ${attempt} attempt(s): ${res.errorDetails || 'Unknown error'}`));
        break;
      }
    }
    if (!success) overallSuccess = false;
  }

  // Optional agent test
  if (options.test !== false && overallSuccess) {
    await runAgentTest(targetDir, currentInv.name, options.guidedOnly, options.suiteConfig);
  }

  // Summary
  printSummary(targetDir, currentInv, { success: overallSuccess, demo: { passed: 0, failed: 0, failingTests: [] }, negative: { passed: 0, failed: 0, passingTests: [] } }, 1);

  return overallSuccess;
}

async function generateTargetPatch(guideDirAbs: string, baseApp: string, patchType: 'solution' | 'broken'): Promise<void> {
  const workDir = setupIsolatedWorkDir(`gd-gen-${baseApp}-${patchType}`);
  try {
    fs.cpSync(path.join(baseAppsDir, baseApp), workDir, {
      recursive: true,
      filter: (src) => !src.includes('node_modules')
    });

    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));

    // Git init is required for capturePatchFromGit to extract git diffs
    execSync('git init && git config user.name "AI" && git config user.email "ai@example.com" && git add . && git commit -m "init"', { cwd: workDir, stdio: 'ignore' });

    const prompt = patchType === 'solution'
      ? buildSolutionPrompt({ guideFile: GUIDE_FILE, expectationsFile: EXPECTATIONS_FILE, workDir })
      : buildBrokenPrompt({ guideFile: GUIDE_FILE, expectationsFile: EXPECTATIONS_FILE, workDir });

    await runAgent(prompt, workDir);

    const destPatch = path.join(guideDirAbs, TARGETS_DIR, baseApp, patchType === 'solution' ? SOLUTION_PATCH_FILE : BROKEN_PATCH_FILE);
    fs.mkdirSync(path.dirname(destPatch), { recursive: true });
    capturePatchFromGit(workDir, destPatch);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function generateTargetTask(guideDirAbs: string, baseApp: string): Promise<void> {
  const workDir = setupIsolatedWorkDir(`gd-gen-${baseApp}-task`);
  try {
    fs.copyFileSync(path.join(guideDirAbs, GUIDE_FILE), path.join(workDir, GUIDE_FILE));
    fs.copyFileSync(path.join(guideDirAbs, EXPECTATIONS_FILE), path.join(workDir, EXPECTATIONS_FILE));
    const sourceBaseAppDir = path.join(baseAppsDir, baseApp);
    if (fs.existsSync(sourceBaseAppDir)) {
      await fs.promises.cp(sourceBaseAppDir, workDir, { recursive: true });
    }

    const prompt = buildTargetTaskPrompt({
      guideFile: GUIDE_FILE,
      taskFile: TASK_FILE,
      baseApp,
    });

    await runAgent(prompt, workDir);

    const generatedTask = path.join(workDir, TASK_FILE);
    if (fs.existsSync(generatedTask)) {
      const destTask = path.join(guideDirAbs, TARGETS_DIR, baseApp, TASK_FILE);
      fs.mkdirSync(path.dirname(destTask), { recursive: true });
      fs.copyFileSync(generatedTask, destTask);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function runAgentTest(targetDir: string, guideName: string, guidedOnly = false, suiteConfig?: SuiteConfig): Promise<void> {
  console.log(cCyan(`\n--- Running agent tests ---`));

  const targetsDir = path.join(targetDir, 'targets');
  if (!fs.existsSync(targetsDir) || !fs.statSync(targetsDir).isDirectory()) {
    console.log(cYellow(`No targets directory found in ${targetDir}. Skipping agent tests.`));
    return;
  }

  const baseApps = fs.readdirSync(targetsDir).filter(name => {
    return !name.startsWith('.') && fs.statSync(path.join(targetsDir, name)).isDirectory() && SUPPORTED_BASE_APPS.includes(name as any);
  });

  if (baseApps.length === 0) {
    console.log(cYellow(`No supported base apps found in ${targetsDir}. Skipping agent tests.`));
    return;
  }

  // Step d: Build workspace dependencies
  let buildCode = 0;
  const serving = suiteConfig ? suiteConfig.serving : defaultSuiteConfig.serving;
  if (serving === Serving.MCP) {
    console.log(`\nBuilding MCP index...`);
    buildCode = await spawnAsync('pnpm', ['build:mcp'], { cwd: rootDir, stdio: 'inherit' });
  } else if (serving === Serving.SKILLS_CLI) {
    console.log(`\nBuilding skills-cli dist...`);
    buildCode = await spawnAsync('pnpm', ['--filter', 'serving', 'build-dist'], { cwd: rootDir, stdio: 'inherit' });
  }

  if (buildCode !== 0) {
    console.error(cRed(`Failed to build workspace dependencies (exit code ${buildCode})`));
    return;
  }

  const taskMap = getTaskMap();

  for (const baseApp of baseApps) {
    console.log(cCyan(`\nRunning agent test for target: ${baseApp}`));
    const taskKey = `${guideName}/${baseApp}`;
    const taskInfo = taskMap.get(taskKey);
    if (!taskInfo) {
      console.error(cRed(`Task info not found for ${taskKey}, cannot run agent test.`));
      continue;
    }

    const targetGraderPath = path.join(targetsDir, baseApp, 'grader.ts');
    if (!fs.existsSync(targetGraderPath)) {
      console.error(cRed(`Could not find grader.ts for ${baseApp} at ${targetGraderPath}`));
      continue;
    }

    const results: Record<string, { passed: number; total: number }> = {};

    // 1. Grade base app
    const baseAppDir = path.join(baseAppsDir, baseApp);
    const baseAppHtml = path.join(baseAppDir, 'index.html');
    if (fs.existsSync(baseAppHtml)) {
      const tempHome = createIsolatedHome(`gd-pre-grade-${baseApp}`);
      try {
        const stagingDir = path.join(tempHome, baseApp);
        fs.cpSync(baseAppDir, stagingDir, { recursive: true });
        const stagedHtml = path.join(stagingDir, 'index.html');
        process.env.PATCH_FILE = path.join(targetsDir, baseApp, 'solution.patch');
        const preResults = await gradeOutput(stagedHtml, targetGraderPath, path.join(targetDir, 'test-app-results', baseApp, 'pre-grade-report'));
        delete process.env.PATCH_FILE;
        if (preResults) results['pre'] = preResults;
      } finally {
        cleanupIsolatedHome(tempHome);
      }
    }

    // 2. Run agent suite
    const { runSuite } = await import('../harness/run_suite.ts');
    const testOutputDir = path.join(targetDir, 'test-app-results', baseApp);
    const agentOverride = process.env.GD_DEV_USE_JETSKI === '1' ? Agents.JETSKI_CLI : undefined;
    await runSuite({
      name: `${guideName}-${baseApp}`,
      outputDir: testOutputDir,
      tasks: [taskKey],
      numRuns: 1,
      skipEval: true,
      guidedOnly,
      suiteConfig: agentOverride ? { agent: agentOverride } : undefined,
    });

    // 3. Grade agent output (unguided + guided)
    const runTypes = guidedOnly ? ['guided'] : ['unguided', 'guided'];
    for (const runType of runTypes) {
      const resultDir = path.join(testOutputDir, '1', guideName, baseApp, runType);
      if (!fs.existsSync(resultDir)) continue;

      const htmlFiles = fs.readdirSync(resultDir).filter(f => f.endsWith('.html'));
      const outputFile = htmlFiles.find(f => f === 'index.html') || htmlFiles[0];
      if (!outputFile) continue;

      process.env.PATCH_FILE = path.join(resultDir, 'agent.patch');
      const gradeResults = await gradeOutput(
        path.join(resultDir, outputFile),
        targetGraderPath,
        path.join(resultDir, 'grade-report')
      );
      delete process.env.PATCH_FILE;
      if (gradeResults) results[runType] = gradeResults;
    }

    let guidesConsumed: string[] = [];
    const guidedDir = path.join(testOutputDir, '1', guideName, baseApp, 'guided');
    if (fs.existsSync(guidedDir)) {
      const suiteConfig = defaultSuiteConfig;
      const servingMode = suiteConfig.serving as any;
      const activeAgent = agentOverride || suiteConfig.agent;
      const usage = await collectGuidesUsed(guidedDir, servingMode, activeAgent);
      guidesConsumed = [...new Set([...usage.retrievedGuides, ...usage.fileReadGuides])];
    }

    printTestComparison(results, guidesConsumed);
  }
}

async function gradeOutput(htmlPath: string, graderPath: string, outputDir: string): Promise<{ passed: number; total: number } | null> {
  const label = path.basename(path.dirname(outputDir));
  console.log(cYellow(`\nGrading ${label}...`));

  try {
    const gradeResults = await runPlaywright(htmlPath, graderPath, outputDir, 'pipe');
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
  guidesConsumed?: string[]
): void {
  const total = results.pre?.total || results.guided?.total || results.unguided?.total || 0;
  if (total === 0) return;

  const fmt = (label: string, r: { passed: number; total: number } | undefined, pad: number) => {
    if (!r) return `  ${label.padEnd(pad)} —`;
    const pct = Math.round(r.passed / r.total * 100);
    return `  ${label.padEnd(pad)} ${r.passed}/${r.total} checks passed (${pct}%)`;
  };

  console.log(cBold(`\nAgent test results:`));
  console.log(fmt('Base app (pre):', results.pre, 18));
  console.log(fmt('Unguided:', results.unguided, 18));
  console.log(fmt('Guided:', results.guided, 18));

  if (results.guided && results.unguided && results.guided.total > 0 && results.unguided.total > 0) {
    const guidedPct = Math.round(results.guided.passed / results.guided.total * 100);
    const unguidedPct = Math.round(results.unguided.passed / results.unguided.total * 100);
    const impact = guidedPct - unguidedPct;
    console.log(`  ${'Guide impact:'.padEnd(18)} ${impact >= 0 ? '+' : ''}${impact}% (vs unguided)`);
  }

  if (guidesConsumed && guidesConsumed.length > 0) {
    console.log(`  ${'Guides consumed:'.padEnd(18)} [${guidesConsumed.join(', ')}]`);
  }
}

function printSummary(targetDir: string, inv: GuideInventory, result: CalibrationResult | null, attempts: number): void {
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
      return !name.startsWith('.') && fs.statSync(path.join(targetsDir, name)).isDirectory() && SUPPORTED_BASE_APPS.includes(name as any);
    });

    for (const baseApp of baseApps) {
      console.log(`\n   ${cBold(`Target Base App: ${baseApp}`)}`);
      const appTargetDir = path.join(targetsDir, baseApp);
      
      const solutionPatchPath = path.join(appTargetDir, SOLUTION_PATCH_FILE);
      const brokenPatchPath = path.join(appTargetDir, BROKEN_PATCH_FILE);
      const graderPath = path.join(appTargetDir, GRADER_FILE);
      const taskPath = path.join(appTargetDir, TASK_FILE);

      const printFileStatus = (label: string, filepath: string, existsMsg = 'exists', missingMsg = 'missing') => {
        const exists = fs.existsSync(filepath);
        console.log(`     ${label.padEnd(28)} ${exists ? cGreen('✅') : cRed('❌')} ${exists ? existsMsg : missingMsg}`);
      };

      printFileStatus(SOLUTION_PATCH_FILE, solutionPatchPath, 'generated', 'not generated');
      printFileStatus(BROKEN_PATCH_FILE, brokenPatchPath, 'generated', 'not generated');
      
      if (result?.success) {
        printFileStatus(GRADER_FILE, graderPath, `calibrated (attempt ${attempts})`, 'calibration failed');
      } else {
        printFileStatus(GRADER_FILE, graderPath, 'exists', 'missing');
      }
      
      printFileStatus(TASK_FILE, taskPath, 'generated', 'not generated');
    }
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
    inv.hasGuide && inv.hasExpectations && !inv.expectationsEmpty && classifyGuide(inv) !== 'eval-ready'
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

const statusLabel: Record<GuideStatus, { label: string; color: (s: string) => string }> = {
  'incomplete': { label: 'Incomplete (missing guide.md or demo.html)', color: cRed },
  'stub': { label: 'Stub (yaml frontmatter only, no content)', color: cYellow },
  'needs-expectations': { label: 'Needs expectations.md', color: cYellow },
  'needs-calibration': { label: 'Needs calibration (run gd dev)', color: cYellow },
  'needs-test': { label: 'Needs agent test run (missing prompts/task)', color: cCyan },
  'eval-ready': { label: 'Ready for eval', color: cGreen },
};

export function auditGuides(options: { groupByUsecases?: boolean } = {}): void {
  const allGuides = scanAllGuides();

  if (allGuides.length === 0) {
    console.log('No guides found.');
    return;
  }

  const byStatus = new Map<GuideStatus, GuideInventory[]>();
  for (const inv of allGuides) {
    const status = classifyGuide(inv);
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status)!.push(inv);
  }

  // Summary counts
  console.log(cBold(`\nGuide Audit: ${allGuides.length} guides\n`));
  for (const status of ['incomplete', 'stub', 'needs-expectations', 'needs-calibration', 'needs-test', 'eval-ready'] as GuideStatus[]) {
    const guides = byStatus.get(status) || [];
    const { label, color } = statusLabel[status];
    console.log(`  ${color(`${String(guides.length).padStart(2)}`)}  ${label}`);
  }

  if (!options.groupByUsecases) {
    renderFeatureMatrix(allGuides);
  } else {
    // Per-category detail
    const byCategory = new Map<string, GuideInventory[]>();
    for (const inv of allGuides) {
      if (!byCategory.has(inv.category)) byCategory.set(inv.category, []);
      byCategory.get(inv.category)!.push(inv);
    }

    const dot = (has: boolean) => has ? '●' : cDim('○');
    const guideDot = (inv: GuideInventory) => {
      if (inv.hasGuide) return '●';
      if (inv.isStub) return '◐';
      return cDim('○');
    };
    // Pad a single visible character (possibly ANSI-wrapped) to a fixed column width
    const col = (s: string, w = 6) => s + ' '.repeat(w - 1);

    for (const [category, guides] of byCategory) {
      console.log(cBold(`\n${category}/`));

      const hdr = 'guide'.padEnd(6) + 'demo'.padEnd(6) + 'expct'.padEnd(6)
        + '│ ' + 'neg'.padEnd(6) + 'grdr'.padEnd(6) + 'task';
      console.log(cDim(`  ${'name'.padEnd(42)} ${hdr}`));

      for (const inv of guides.sort((a, b) => a.name.localeCompare(b.name))) {
        const status = classifyGuide(inv);
        const { color } = statusLabel[status];

        const name = inv.name.length > 40 ? inv.name.substring(0, 39) + '…' : inv.name;
        const expctDot = inv.expectationsEmpty ? cYellow('○') : dot(inv.hasExpectations);
        const row = col(guideDot(inv)) + col(dot(inv.hasDemo)) + col(expctDot)
          + cDim('│') + ' ' + col(dot(inv.hasNegativeDemo)) + col(dot(inv.hasGrader))
          + dot(inv.hasTask);
        console.log(`  ${color(name.padEnd(42))} ${row}`);
      }
    }
  }

  // Next action suggestions, ordered by pipeline stage
  const nextCalibrate = byStatus.get('needs-calibration')?.[0];
  const nextTest = byStatus.get('needs-test')?.[0];
  const nextExpectations = byStatus.get('needs-expectations')?.[0];
  const nextStub = byStatus.get('stub')?.[0];
  const nextIncomplete = byStatus.get('incomplete')?.[0];

  const actions: string[] = [];

  // Automatable: ready for `gd dev`
  const devTarget = nextCalibrate || nextTest;
  if (devTarget) {
    const rel = path.relative(process.cwd(), devTarget.dir);
    actions.push(`${cCyan('Run:')}    ${cCyan(`gd dev ${rel}`)}`);
  }

  // Needs human writing before `gd dev` can run
  if (nextExpectations) {
    const rel = path.relative(process.cwd(), nextExpectations.dir);
    actions.push(`${cYellow('Write:')}  add ${cBold('expectations.md')} to ${rel}`);
  }
  if (nextStub) {
    const rel = path.relative(process.cwd(), nextStub.dir);
    actions.push(`${cYellow('Write:')}  flesh out ${cBold('guide.md')}, ${cBold('demo.html')}, and ${cBold('expectations.md')} in ${rel}`);
  }
  if (nextIncomplete) {
    const rel = path.relative(process.cwd(), nextIncomplete.dir);
    actions.push(`${cYellow('Write:')}  add missing ${cBold('guide.md')} or ${cBold('demo.html')} in ${rel}`);
  }

  console.log('');
  if (actions.length > 0) {
    console.log(cBold('Next steps:'));
    for (const action of actions) {
      console.log(`  ${action}`);
    }
  } else {
    console.log(cGreen(`All guides are eval-ready!`));
  }
  console.log('');
}

function renderFeatureMatrix(allGuides: GuideInventory[]): void {
  const featureToGuides = new Map<string, GuideInventory[]>();
  for (const inv of allGuides) {
    const fIds = inv.featureIds.length > 0 ? inv.featureIds : ['(no-feature)'];
    for (const fId of fIds) {
      if (!featureToGuides.has(fId)) featureToGuides.set(fId, []);
      featureToGuides.get(fId)!.push(inv);
    }
  }

  const sortedFeatures = Array.from(featureToGuides.keys()).sort((a, b) => {
    if (a === '(no-feature)') return 1;
    if (b === '(no-feature)') return -1;
    return a.localeCompare(b);
  });

  const dot = (has: boolean) => (has ? '●' : cDim('○'));
  const guideDot = (inv: GuideInventory) => {
    if (inv.hasGuide) return '●';
    if (inv.isStub) return '◐';
    return cDim('○');
  };

  const hdr = 'guide'.padEnd(10) + 'demo'.padEnd(10) + 'expct'.padEnd(10) + '│ ' + 'neg'.padEnd(10) + 'grdr'.padEnd(10) + 'task';
  console.log(cDim(`\n  ${'feature'.padEnd(32)} count ${hdr}`));

  const statusRank: Record<GuideStatus, number> = {
    'incomplete': 0,
    'stub': 1,
    'needs-expectations': 2,
    'needs-calibration': 3,
    'needs-test': 4,
    'eval-ready': 5,
  };

  for (const fId of sortedFeatures) {
    const guides = featureToGuides.get(fId)!;
    const col = (s: string, w = 10) => s + ' '.repeat(Math.max(0, w - guides.length));

    // Determine overall status as the minimum status rank among all guides in this feature
    const statuses = guides.map(classifyGuide);
    const minRank = Math.min(...statuses.map(s => statusRank[s]));
    const overallStatus = (Object.keys(statusRank) as GuideStatus[]).find(s => statusRank[s] === minRank) || 'incomplete';
    const { color } = statusLabel[overallStatus];

    const name = fId.length > 30 ? fId.substring(0, 29) + '…' : fId;

    const renderDots = (fn: (inv: GuideInventory) => string) => {
      return guides.map(inv => fn(inv)).join('');
    };

    const expctDots = guides.map(inv => (inv.expectationsEmpty ? cYellow('○') : dot(inv.hasExpectations))).join('');

    const row = col(renderDots(guideDot)) +
      col(renderDots(inv => dot(inv.hasDemo))) +
      col(expctDots) +
      cDim('│') + ' ' +
      col(renderDots(inv => dot(inv.hasNegativeDemo))) +
      col(renderDots(inv => dot(inv.hasGrader))) +
      renderDots(inv => dot(inv.hasTask));

    console.log(`  ${color(name.padEnd(32))} ${String(guides.length).padStart(5)}  ${row}`);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const isTest = !args.includes('--no-test');
  const guidedOnly = args.includes('--guided-only');

  if (!dir) {
    console.error('Usage: node --experimental-strip-types guides/dev-guide.ts <path/to/guide> [--no-test] [--guided-only]');
    process.exit(1);
  }

  devGuide(dir, { test: isTest, guidedOnly }).then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
