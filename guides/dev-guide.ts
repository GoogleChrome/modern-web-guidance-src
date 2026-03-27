import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { rootDir } from '../lib/root.ts';

import { generateNegative } from './negative-gen.ts';
import { generateGrader, generateGraderWithContext } from './grader-gen.ts';
import { testGrader, findGrader, runPlaywright, type CalibrationResult } from './run-grader.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
  spawnAsync
} from '../harness/lib/agent-shared.ts';
import { environmentConfig } from '../harness/config.ts';
import { cRed, cGreen, cYellow, cCyan, cBold, cDim } from '../lib/colors.ts';
import {
  type GuideInventory,
  type TaskInfo,
  type GuideStatus,
  GUIDE_FILE,
  DEMO_FILE,
  EXPECTATIONS_FILE,
  NEGATIVE_DEMO_FILE,
  GRADER_FILE,
  PROMPTS_FILE,
  getTaskMap,
  inventoryGuide,
  readFileSafe,
  classifyGuide,
  scanAllGuides
} from '../harness/lib/utils.ts';

const TASKS_DIR = path.join(rootDir, 'harness', 'tasks');

export interface DevGuideOptions {
  maxRetries?: number;   // default: 2
  test?: boolean;        // default: true — run agent test after calibration
  guidedOnly?: boolean;  // skip calibration and only run the guided agent test
  verbose?: boolean;
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
  console.log(`   ${PROMPTS_FILE.padEnd(18)} ${inv.hasPrompts ? icon(true) : icon(false, true) + ' will generate'}`);
  console.log(`   ${'task'.padEnd(18)} ${inv.hasTask ? icon(true) : icon(false, true) + ' will generate'}`);
}

export async function devGuide(targetDirRaw: string, options: DevGuideOptions = {}, inv?: GuideInventory): Promise<boolean> {
  const maxRetries = options.maxRetries ?? 2;
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    return false;
  }

  // Step 1: Inventory (use provided inventory or scan)
  const taskMap = getTaskMap();
  const currentInv = inv || inventoryGuide(targetDir, taskMap);
  printInventory(currentInv);

  if (!currentInv.hasGuide) {
    if (currentInv.isStub) {
      console.error(cRed(`\nError: ${GUIDE_FILE} is just a stub (missing content) in ${targetDir}`));
    } else {
      console.error(cRed(`\nError: ${GUIDE_FILE} is required but missing or empty in ${targetDir}`));
    }
    return false;
  }
  if (!currentInv.hasDemo) {
    console.error(cRed(`\nError: ${DEMO_FILE} is required but missing in ${targetDir}`));
    return false;
  }

  const needsGeneration = !currentInv.hasNegativeDemo || !currentInv.hasGrader;

  // Generators require expectations.md — check before attempting generation
  if (needsGeneration && !currentInv.hasExpectations) {
    console.error(cRed(`\nError: ${EXPECTATIONS_FILE} is required for generating artifacts but is missing.`));
    console.error(`Create ${EXPECTATIONS_FILE} in ${targetDir} before running dev.`);
    return false;
  }

  // Step 2: Generate missing artifacts
  if (!currentInv.hasNegativeDemo) {
    await generateArtifact('negative-demo.html', () => generateNegative(targetDirRaw), path.join(targetDir, NEGATIVE_DEMO_FILE));
  } else {
    console.log(cDim(`\nSkipping ${NEGATIVE_DEMO_FILE} generation (already exists)`));
  }

  if (!currentInv.hasGrader) {
    await generateArtifact('grader.ts', () => generateGrader(targetDirRaw), path.join(targetDir, GRADER_FILE));
  } else {
    console.log(cDim(`\nSkipping ${GRADER_FILE} generation (already exists)`));
  }

  // Step 4: Calibration retry loop (skipped when guidedOnly)
  let calibrationResult: CalibrationResult | null = null;
  let calibrationAttempt = 0;

  if (options.guidedOnly) {
    console.log(cDim(`\nSkipping calibration (--guided)`));
    calibrationResult = { success: true, demo: { passed: 0, failed: 0, failingTests: [] }, negative: { passed: 0, failed: 0, passingTests: [] } };
  } else {
    console.log(cCyan(`\n--- Calibrating grader ---`));
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      calibrationAttempt = attempt;
      console.log(cYellow(`\nCalibration attempt ${attempt}...`));

      try {
        calibrationResult = await testGrader(targetDirRaw);
      } catch (err) {
        console.error(cRed(`Calibration error: ${err}`));
        calibrationResult = {
          success: false,
          demo: { passed: 0, failed: 0, failingTests: [] },
          negative: { passed: 0, failed: 0, passingTests: [] },
        };
      }

      if (calibrationResult.success) {
        console.log(cGreen(`\u2705 Grader calibrated on attempt ${attempt}!`));
        break;
      }

      if (attempt <= maxRetries) {
        console.log(cYellow(`Attempt ${attempt} failed. Regenerating grader with failure context...`));

        const graderPath = path.join(targetDir, GRADER_FILE);
        if (fs.existsSync(graderPath)) {
          fs.unlinkSync(graderPath);
        }

        try {
          await generateGraderWithContext(targetDirRaw, calibrationResult);
          if (!fs.existsSync(graderPath)) {
            console.error(cRed(`Failed: ${GRADER_FILE} was not regenerated`));
            break;
          }
        } catch (err) {
          console.error(cRed(`Failed to regenerate ${GRADER_FILE}: ${err}`));
          break;
        }
      } else {
        console.log(cRed(`\u274c Grader failed to calibrate after ${maxRetries + 1} attempts.`));
      }
    }
  }

  // Step 5: Test task and prompt generation
  if (calibrationResult?.success) {
    console.log(cCyan(`\n--- Setting up test task ---`));
    const existingTask = taskMap.get(currentInv.name);
    const baseApp = existingTask?.baseApp ?? 'daily-grind';

    const promptsPath = path.join(targetDir, PROMPTS_FILE);
    if (!fs.existsSync(promptsPath)) {
      console.log(`${PROMPTS_FILE} not found, generating...`);
      try {
        await generatePrompts(targetDir, baseApp);
      } catch (err) {
        console.error(cRed(`Failed to generate ${PROMPTS_FILE}: ${err}`));
      }
    }

    if (!existingTask && fs.existsSync(promptsPath)) {
      const taskInfo = createTask(targetDir, currentInv.name);
      taskMap.set(currentInv.name, taskInfo);
    }
  }

  // Step 6: Optional agent test
  if (options.test !== false && calibrationResult?.success) {
    await runAgentTest(targetDir, currentInv.name, taskMap, options.guidedOnly);
  }

  // Step 7: Summary
  printSummary(targetDir, currentInv, calibrationResult, calibrationAttempt);

  return calibrationResult?.success ?? false;
}

async function generateArtifact(name: string, generator: () => Promise<void>, checkPath: string): Promise<void> {
  console.log(cCyan(`\n--- Generating ${name} ---`));
  try {
    await generator();
    if (!fs.existsSync(checkPath)) {
      throw new Error(`${name} was not created`);
    }
    console.log(cGreen(`\u2705 ${name} generated`));
  } catch (err) {
    throw new Error(`Failed to generate ${name}: ${err}`);
  }
}

async function generatePrompts(targetDir: string, baseApp: string): Promise<void> {
  const originalHome = process.env.HOME;
  const tempHome = createIsolatedHome('ghh-prompt-gen');

  try {
    // Copy guide dir contents into a work directory
    const workDir = path.join(tempHome, 'work');
    fs.mkdirSync(workDir, { recursive: true });
    fs.cpSync(targetDir, workDir, { recursive: true });

    // Copy the base app so Gemini can see what app the prompts target
    const baseAppHtml = path.join(rootDir, 'harness', 'base_apps', baseApp, 'index.html');
    if (fs.existsSync(baseAppHtml)) {
      fs.copyFileSync(baseAppHtml, path.join(workDir, 'base-app.html'));
    }

    // Copy Gemini auth files
    const geminiSource = path.join(originalHome || process.cwd(), '.gemini');
    const geminiDest = path.join(tempHome, '.gemini');
    fs.mkdirSync(geminiDest, { recursive: true });

    for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id']) {
      copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
    }

    createTrustedFolders(geminiDest, [workDir]);

    process.env.HOME = tempHome;

    const userPrompt = `Read ${GUIDE_FILE} to understand what web development guidance is being provided.
Read base-app.html to understand the existing web app (the "${baseApp}" app) that the developer is working on.

Generate 1–4 realistic test prompts that a web developer would send to an AI coding assistant to accomplish the goal described in this guide. Write these to a file called ${PROMPTS_FILE}.

Rules:
- Write prompts as a developer talking to an AI coding assistant — casual, lowercase, sometimes vague.
- Phrase prompts as ACTION REQUESTS or directives (e.g. "add X", "can you build Y", "implement Z"). NEVER phrase them as advisory questions (e.g. "how can I?", "what's the best way to?", "can you explain?") — the agent must implement, not just explain.
- The first prompt is the most important: it must be specific enough that an agent implementing it would produce a grader-testable result.
- Vary specificity: include at least one vague/intent-based prompt and one specific/technical ask.
- Assume the developer is working on the existing app seen in base-app.html. Reference its real assets and content where relevant.
- Do NOT mention the guide itself or indicate that guidance exists.
- Do NOT name the base app (e.g. "${baseApp}") — a real developer wouldn't refer to it that way.
- Do NOT tell the agent which web API or CSS property to use unless a real developer would naturally do so.
- Each prompt must be on its own line, prefixed with "- ".

Only create the ${PROMPTS_FILE} file. Do not modify any other files.`;

    console.log(`Generating ${PROMPTS_FILE} via Gemini CLI...`);

    const exitCode = await spawnAsync(environmentConfig.geminiCliBin, ['-p', userPrompt, '--yolo'], {
      cwd: workDir,
      env: { ...process.env },
      stdio: 'inherit',
    });

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    // Copy prompts.md back
    const generatedFile = path.join(workDir, PROMPTS_FILE);
    if (fs.existsSync(generatedFile)) {
      fs.copyFileSync(generatedFile, path.join(targetDir, PROMPTS_FILE));
      console.log(cGreen(`✅ ${PROMPTS_FILE} generated`));
    } else {
      throw new Error(`${PROMPTS_FILE} was not created by Gemini CLI`);
    }
  } finally {
    process.env.HOME = originalHome;
    cleanupIsolatedHome(tempHome);
  }
}

function createTask(targetDir: string, guideName: string): TaskInfo {
  const promptsContent = readFileSafe(path.join(targetDir, PROMPTS_FILE));
  const firstLine = promptsContent.split('\n').find(l => l.trim().startsWith('- '));
  const prompt = firstLine ? firstLine.replace(/^-\s*/, '').trim() : `Implement the guidance from ${guideName}`;

  const taskName = `${guideName}-task`;
  const taskContent = `---
base_app: daily-grind
grader: ${guideName}
---
${prompt}
`;

  fs.mkdirSync(TASKS_DIR, { recursive: true });
  fs.writeFileSync(path.join(TASKS_DIR, `${taskName}.md`), taskContent);
  console.log(cGreen(`✅ Created task: harness/tasks/${taskName}.md`));

  return { taskName, baseApp: 'daily-grind', prompt };
}

async function runAgentTest(targetDir: string, guideName: string, taskMap: Map<string, TaskInfo>, guidedOnly = false): Promise<void> {
  console.log(cCyan(`\n--- Running agent test ---`));

  const taskInfo = taskMap.get(guideName);
  if (!taskInfo) {
    console.error(cRed(`Task info not found for ${guideName}, cannot run agent test.`));
    return;
  }

  console.log(`Task: ${taskInfo.taskName} (base_app: ${taskInfo.baseApp})`);
  console.log(`Prompt: ${cDim(taskInfo.prompt.substring(0, 120))}${taskInfo.prompt.length > 120 ? '...' : ''}`);

  // Step d: Build MCP index
  console.log(`\nBuilding MCP index...`);
  const buildCode = await spawnAsync('pnpm', ['build:mcp'], { cwd: rootDir, stdio: 'inherit' });
  if (buildCode !== 0) {
    console.error(cRed(`Failed to build MCP index (exit code ${buildCode})`));
    return;
  }

  // Step e: Grade runs
  const graderPath = findGrader(targetDir);
  if (!graderPath) {
    console.error(cRed(`Could not find ${GRADER_FILE} for grading`));
    return;
  }

  const results: Record<string, { passed: number; total: number }> = {};

  // 1. Grade base app
  const baseAppHtml = path.join(rootDir, 'harness', 'base_apps', taskInfo.baseApp, 'index.html');
  if (fs.existsSync(baseAppHtml)) {
    const preResults = await gradeOutput(baseAppHtml, graderPath, path.join(targetDir, 'test-app-results', 'pre-grade-report'));
    if (preResults) results['pre'] = preResults;
  }

  // 2. Run agent suite
  const { runSuite } = await import('../harness/run_suite.ts');
  const testOutputDir = path.join(targetDir, 'test-app-results');
  await runSuite({
    name: taskInfo.taskName,
    outputDir: testOutputDir,
    tasks: [taskInfo.taskName],
    numRuns: 1,
    skipEval: true,
    guidedOnly,
  });

  // 3. Grade agent output (unguided + guided)
  const runTypes = guidedOnly ? ['guided'] : ['unguided', 'guided'];
  for (const runType of runTypes) {
    const resultDir = path.join(testOutputDir, '1', taskInfo.taskName, runType);
    if (!fs.existsSync(resultDir)) continue;

    const htmlFiles = fs.readdirSync(resultDir).filter(f => f.endsWith('.html'));
    const outputFile = htmlFiles.find(f => f === 'index.html') || htmlFiles[0];
    if (!outputFile) continue;

    const gradeResults = await gradeOutput(
      path.join(resultDir, outputFile),
      graderPath,
      path.join(resultDir, 'grade-report')
    );
    if (gradeResults) results[runType] = gradeResults;
  }

  printTestComparison(results);
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

function printTestComparison(results: Record<string, { passed: number; total: number }>): void {
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
}

function printSummary(targetDir: string, inv: GuideInventory, result: CalibrationResult | null, attempts: number): void {
  const relDir = path.relative(process.cwd(), targetDir);

  console.log(`\n${'='.repeat(60)}`);
  if (result?.success) {
    console.log(cBold(cGreen(`\u2705 Guide: ${inv.name}`)));
  } else {
    console.log(cBold(cRed(`\u274c Guide: ${inv.name}`)));
  }

  console.log(`   ${GUIDE_FILE.padEnd(21)} \u2705 exists`);
  console.log(`   ${DEMO_FILE.padEnd(21)} \u2705 exists`);

  if (!inv.hasExpectations || inv.expectationsEmpty) {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(21)} \u26a0\ufe0f  ${inv.hasExpectations ? 'empty' : 'missing'} (consider adding assertions)`);
  } else {
    console.log(`   ${EXPECTATIONS_FILE.padEnd(21)} \u2705 exists`);
  }

  const negStatus = inv.hasNegativeDemo ? 'exists' : 'generated';
  console.log(`   ${NEGATIVE_DEMO_FILE.padEnd(21)} \u2705 ${negStatus}`);

  if (result?.success) {
    console.log(`   ${GRADER_FILE.padEnd(21)} \u2705 calibrated (attempt ${attempts})`);
  } else if (result) {
    console.log(`   ${GRADER_FILE.padEnd(21)} \u274c calibration failed`);
  } else {
    console.log(`   ${GRADER_FILE.padEnd(21)} \u274c not generated`);
  }

  const promptsStatus = inv.hasPrompts ? 'exists' : (result?.success ? 'generated' : 'not generated');
  console.log(`   ${PROMPTS_FILE.padEnd(21)} ${inv.hasPrompts || result?.success ? '\u2705' : '\u274c'} ${promptsStatus}`);

  const taskStatus = inv.hasTask ? 'exists' : (result?.success ? 'generated' : 'not generated');
  console.log(`   ${'task'.padEnd(21)} ${inv.hasTask || result?.success ? '\u2705' : '\u274c'} ${taskStatus}`);

  console.log(`\nAll generated files are in ${relDir}/`);
  if (result?.success) {
    console.log(`Ready to review and commit.`);
  }
  console.log('');
}

// Batch mode: process all incomplete guides
export async function devAll(options: DevGuideOptions = {}): Promise<void> {
  const incompleteGuides = scanAllGuides().filter(inv =>
    inv.hasGuide && inv.hasDemo && (!inv.hasNegativeDemo || !inv.hasGrader || !inv.hasPrompts || !inv.hasTask)
  );

  if (incompleteGuides.length === 0) {
    console.log(cGreen(`All guides are complete!`));
    return;
  }

  console.log(cBold(`Found ${incompleteGuides.length} incomplete guide(s):\n`));
  for (const inv of incompleteGuides) {
    const missing = [];
    if (!inv.hasNegativeDemo) missing.push(NEGATIVE_DEMO_FILE);
    if (!inv.hasGrader) missing.push(GRADER_FILE);
    if (!inv.hasPrompts) missing.push(PROMPTS_FILE);
    if (!inv.hasTask) missing.push('task');
    console.log(`  ${inv.name} ${cDim(`(missing: ${missing.join(', ')})`)}`);
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
  'incomplete':         { label: 'Incomplete (missing guide.md or demo.html)', color: cRed },
  'stub':               { label: 'Stub (yaml frontmatter only, no content)', color: cYellow },
  'needs-expectations': { label: 'Needs expectations.md', color: cYellow },
  'needs-calibration':  { label: 'Needs calibration (run gd dev)', color: cYellow },
  'needs-test':         { label: 'Needs agent test run (missing prompts/task)', color: cCyan },
  'eval-ready':         { label: 'Ready for eval', color: cGreen },
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
        + '│ ' + 'neg'.padEnd(6) + 'grdr'.padEnd(6) + 'prmpt'.padEnd(6) + 'task';
      console.log(cDim(`  ${'name'.padEnd(42)} ${hdr}`));

      for (const inv of guides.sort((a, b) => a.name.localeCompare(b.name))) {
        const status = classifyGuide(inv);
        const { color } = statusLabel[status];

        const name = inv.name.length > 40 ? inv.name.substring(0, 39) + '…' : inv.name;
        const expctDot = inv.expectationsEmpty ? cYellow('○') : dot(inv.hasExpectations);
        const row = col(guideDot(inv)) + col(dot(inv.hasDemo)) + col(expctDot)
          + cDim('│') + ' ' + col(dot(inv.hasNegativeDemo)) + col(dot(inv.hasGrader))
          + col(dot(inv.hasPrompts)) + dot(inv.hasTask);

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

  const hdr = 'guide'.padEnd(10) + 'demo'.padEnd(10) + 'expct'.padEnd(10) + '│ ' + 'neg'.padEnd(10) + 'grdr'.padEnd(10) + 'prmpt'.padEnd(10) + 'task';
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
                col(renderDots(inv => dot(inv.hasPrompts))) +
                renderDots(inv => dot(inv.hasTask));

    console.log(`  ${color(name.padEnd(32))} ${String(guides.length).padStart(5)}  ${row}`);
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const isTest = !args.includes('--no-test');

  if (!dir) {
    console.error('Usage: node --experimental-strip-types guides/dev-guide.ts <path/to/guide> [--no-test]');
    process.exit(1);
  }

  devGuide(dir, { test: isTest }).then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
