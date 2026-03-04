import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import { generateNegative } from './negative-gen.ts';
import { generateGrader, generateGraderWithContext } from './grader-gen.ts';
import { testGrader, findGrader, runPlaywright, type CalibrationResult } from './run-grader.ts';
import { createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../harness/lib/agent-shared.ts';
import { Agents, environmentConfig } from '../harness/config.ts';
import { cRed, cGreen, cYellow, cCyan, cBold, cDim } from '../lib/colors.ts';

export interface DevGuideOptions {
  maxRetries?: number;   // default: 2
  test?: boolean;        // default: false — run agent test after calibration
  verbose?: boolean;
}

interface GuideInventory {
  dir: string;
  name: string;
  hasGuide: boolean;
  hasDemo: boolean;
  hasExpectations: boolean;
  expectationsEmpty: boolean;
  hasNegativeDemo: boolean;
  hasGrader: boolean;
}

function inventoryGuide(dir: string): GuideInventory {
  const name = path.basename(dir);
  const expectationsPath = path.join(dir, 'expectations.md');
  const hasExpectations = fs.existsSync(expectationsPath);
  let expectationsEmpty = false;
  if (hasExpectations) {
    expectationsEmpty = fs.readFileSync(expectationsPath, 'utf-8').trim().length === 0;
  }

  return {
    dir,
    name,
    hasGuide: fs.existsSync(path.join(dir, 'guide.md')),
    hasDemo: fs.existsSync(path.join(dir, 'demo.html')),
    hasExpectations,
    expectationsEmpty,
    hasNegativeDemo: fs.existsSync(path.join(dir, 'negative-demo.html')),
    hasGrader: fs.existsSync(path.join(dir, 'grader.ts')),
  };
}

function printInventory(inv: GuideInventory): void {
  const icon = (exists: boolean, willGenerate = false, warn = false) => {
    if (exists && !warn) return '\u2705';
    if (warn) return '\u26a0\ufe0f ';
    if (willGenerate) return '\u2b1c';
    return '\u274c';
  };

  console.log(`\n\ud83d\udccb Guide: ${cBold(inv.name)}`);
  console.log(`   guide.md           ${icon(inv.hasGuide)}`);
  console.log(`   demo.html          ${icon(inv.hasDemo)}`);

  if (!inv.hasExpectations) {
    console.log(`   expectations.md    ${icon(false)} ${cDim('missing')}`);
  } else if (inv.expectationsEmpty) {
    console.log(`   expectations.md    ${icon(true, false, true)} ${cDim('empty')}`);
  } else {
    console.log(`   expectations.md    ${icon(true)}`);
  }

  console.log(`   negative-demo.html ${inv.hasNegativeDemo ? icon(true) : icon(false, true) + ' will generate'}`);
  console.log(`   grader.ts          ${inv.hasGrader ? icon(true) : icon(false, true) + ' will generate'}`);
}

export async function devGuide(targetDirRaw: string, options: DevGuideOptions = {}): Promise<boolean> {
  const maxRetries = options.maxRetries ?? 2;
  const targetDir = path.resolve(process.cwd(), targetDirRaw);

  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    return false;
  }

  // Step 1: Inventory
  const inv = inventoryGuide(targetDir);
  printInventory(inv);

  if (!inv.hasGuide) {
    console.error(cRed(`\nError: guide.md is required but missing in ${targetDir}`));
    return false;
  }
  if (!inv.hasDemo) {
    console.error(cRed(`\nError: demo.html is required but missing in ${targetDir}`));
    return false;
  }

  const needsGeneration = !inv.hasNegativeDemo || !inv.hasGrader;

  // Generators require expectations.md — check before attempting generation
  if (needsGeneration && !inv.hasExpectations) {
    console.error(cRed(`\nError: expectations.md is required for generating artifacts but is missing.`));
    console.error(`Create expectations.md in ${targetDir} before running dev.`);
    return false;
  }

  // Step 2: Generate negative-demo.html if missing
  if (!inv.hasNegativeDemo) {
    console.log(cCyan(`\n--- Generating negative-demo.html ---`));
    try {
      await generateNegative(targetDirRaw);
      if (!fs.existsSync(path.join(targetDir, 'negative-demo.html'))) {
        console.error(cRed(`Failed: negative-demo.html was not created`));
        return false;
      }
      console.log(cGreen(`\u2705 negative-demo.html generated`));
    } catch (err) {
      console.error(cRed(`Failed to generate negative-demo.html: ${err}`));
      return false;
    }
  } else {
    console.log(cDim(`\nSkipping negative-demo.html generation (already exists)`));
  }

  // Step 3: Generate grader.ts if missing
  if (!inv.hasGrader) {
    console.log(cCyan(`\n--- Generating grader.ts ---`));
    try {
      await generateGrader(targetDirRaw);
      if (!fs.existsSync(path.join(targetDir, 'grader.ts'))) {
        console.error(cRed(`Failed: grader.ts was not created`));
        return false;
      }
      console.log(cGreen(`\u2705 grader.ts generated`));
    } catch (err) {
      console.error(cRed(`Failed to generate grader.ts: ${err}`));
      return false;
    }
  } else {
    console.log(cDim(`\nSkipping grader.ts generation (already exists)`));
  }

  // Step 4: Calibration retry loop
  console.log(cCyan(`\n--- Calibrating grader ---`));

  let calibrationResult: CalibrationResult | null = null;
  let calibrationAttempt = 0;

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

      const graderPath = path.join(targetDir, 'grader.ts');
      if (fs.existsSync(graderPath)) {
        fs.unlinkSync(graderPath);
      }

      try {
        await generateGraderWithContext(targetDirRaw, calibrationResult);
        if (!fs.existsSync(graderPath)) {
          console.error(cRed(`Failed: grader.ts was not regenerated`));
          break;
        }
      } catch (err) {
        console.error(cRed(`Failed to regenerate grader.ts: ${err}`));
        break;
      }
    } else {
      console.log(cRed(`\u274c Grader failed to calibrate after ${maxRetries + 1} attempts.`));
    }
  }

  // Step 5: Optional agent test
  if (options.test && calibrationResult?.success) {
    await runAgentTest(targetDir, inv.name);
  }

  // Step 6: Summary
  printSummary(targetDir, inv, calibrationResult, calibrationAttempt);

  return calibrationResult?.success ?? false;
}

const COMMON_APPEND_PROMPT = `\n\nDon't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

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

    const userPrompt = `Read guide.md to understand what web development guidance is being provided.
Read base-app.html to understand the existing web app that the developer is working on.

Generate a set of prompts that a web developer might give to an AI coding assistant
to accomplish the goal described in this guide. Write these to a file called prompts.md.

The prompts should:
- Be grounded in the base app: reference the kind of app it is (e.g. its content, purpose, or UI) rather than describing a generic or unrelated app
- Vary in specificity: include vague developer requests and specific technical asks
- Be phrased as a developer asking an AI for help with their existing web app
- Not reference the guide itself or indicate that guidance exists
- Each be on its own line, prefixed with "- "

Only create the prompts.md file. Do not modify any other files.`;

    console.log(`Generating prompts.md via Gemini CLI...`);

    const child = spawn(environmentConfig.geminiCliBin, ['-p', userPrompt, '--yolo'], {
      cwd: workDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    // Copy prompts.md back
    const generatedFile = path.join(workDir, 'prompts.md');
    if (fs.existsSync(generatedFile)) {
      fs.copyFileSync(generatedFile, path.join(targetDir, 'prompts.md'));
      console.log(cGreen(`✅ prompts.md generated`));
    } else {
      throw new Error(`prompts.md was not created by Gemini CLI`);
    }
  } finally {
    process.env.HOME = originalHome;
    cleanupIsolatedHome(tempHome);
  }
}

interface TaskInfo {
  taskName: string;
  baseApp: string;
  prompt: string;
}

function findExistingTask(guideName: string): TaskInfo | null {
  const tasksDir = path.join(rootDir, 'harness', 'tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
  for (const file of taskFiles) {
    const content = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) continue;

    const graderMatch = frontmatterMatch[1].match(/^grader:\s*(.+)$/m);
    if (graderMatch && graderMatch[1].trim() === guideName) {
      const baseAppMatch = frontmatterMatch[1].match(/^base_app:\s*(.+)$/m);
      const baseApp = baseAppMatch ? baseAppMatch[1].trim() : 'daily-grind';
      const prompt = frontmatterMatch[2].trim();
      const taskName = file.replace(/\.md$/, '');
      console.log(`Found existing task: ${file}`);
      return { taskName, baseApp, prompt };
    }
  }
  return null;
}

function createTask(targetDir: string, guideName: string): TaskInfo {
  const tasksDir = path.join(rootDir, 'harness', 'tasks');
  const promptsPath = path.join(targetDir, 'prompts.md');
  const promptsContent = fs.readFileSync(promptsPath, 'utf-8').trim();
  const firstLine = promptsContent.split('\n').find(l => l.trim().startsWith('- '));
  const prompt = firstLine ? firstLine.replace(/^-\s*/, '').trim() : `Implement the guidance from ${guideName}`;

  const taskName = `${guideName}-task`;
  const taskContent = `---
base_app: daily-grind
grader: ${guideName}
---
${prompt}
`;

  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${taskName}.md`), taskContent);
  console.log(cGreen(`✅ Created task: harness/tasks/${taskName}.md`));

  return { taskName, baseApp: 'daily-grind', prompt };
}

async function runAgentTest(targetDir: string, guideName: string): Promise<void> {
  console.log(cCyan(`\n--- Running agent test ---`));

  // Step a: Determine base app — check for an existing task first
  const existingTask = findExistingTask(guideName);
  const baseApp = existingTask?.baseApp ?? 'daily-grind';

  // Step b: Ensure prompts.md exists
  const promptsPath = path.join(targetDir, 'prompts.md');
  if (!fs.existsSync(promptsPath)) {
    console.log(`prompts.md not found, generating...`);
    try {
      await generatePrompts(targetDir, baseApp);
    } catch (err) {
      console.error(cRed(`Failed to generate prompts.md: ${err}`));
      return;
    }
    if (!fs.existsSync(promptsPath)) {
      console.error(cRed(`prompts.md was not created`));
      return;
    }
  } else {
    console.log(cDim(`prompts.md already exists, skipping generation`));
  }

  // Step c: Find or create task file
  const taskInfo = existingTask ?? createTask(targetDir, guideName);
  const prompt = taskInfo.prompt + COMMON_APPEND_PROMPT;
  console.log(`Task: ${taskInfo.taskName} (base_app: ${taskInfo.baseApp})`);
  console.log(`Prompt: ${cDim(taskInfo.prompt.substring(0, 120))}${taskInfo.prompt.length > 120 ? '...' : ''}`);

  // Step d: Build MCP index
  console.log(`\nBuilding MCP index...`);
  const buildCode = await spawnAsync('pnpm', ['build:mcp'], { cwd: rootDir, stdio: 'inherit' });
  if (buildCode !== 0) {
    console.error(cRed(`Failed to build MCP index (exit code ${buildCode})`));
    return;
  }

  // Step e: Grade base_app as-is (pre-score)
  const baseAppDir = path.join(rootDir, 'harness', 'base_apps', taskInfo.baseApp);
  const baseAppHtml = path.join(baseAppDir, 'index.html');
  const graderPath = findGrader(targetDir);
  if (!graderPath) {
    console.error(cRed(`Could not find grader.ts for grading`));
    return;
  }

  const results: Record<string, { passed: number; total: number }> = {};

  console.log(cYellow(`\nGrading base app (pre-score)...`));
  if (fs.existsSync(baseAppHtml)) {
    const preGradeDir = path.join(targetDir, 'test-app-results', 'pre-grade-report');
    const preResults = await runPlaywright(baseAppHtml, graderPath, preGradeDir, 'pipe')
      .catch(err => {
        console.error(cRed(`Failed to grade base app: ${err}`));
        return null;
      });

    if (preResults) {
      const passed = preResults.stats?.expected || 0;
      const failed = preResults.stats?.unexpected || 0;
      const total = passed + failed;
      results['pre'] = { passed, total };
      if (total > 0) {
        console.log(`  Base app (pre): ${passed}/${total} checks passed (${Math.round(passed / total * 100)}%)`);
      }
    }
  } else {
    console.log(cYellow(`Base app index.html not found at ${baseAppHtml}, skipping pre-score`));
  }

  // Step f: Run agent for guided + unguided
  const config = (await import('../harness/config.ts')).default;
  const agent = config.suite.agent;

  const agentScript = path.join(rootDir, 'harness', 'agents',
    agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
      agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
        'jetski-agent.ts'
  );

  for (const runType of ['unguided', 'guided']) {
    const resultDir = path.join(targetDir, 'test-app-results', runType);
    fs.mkdirSync(resultDir, { recursive: true });

    console.log(cYellow(`\nRunning ${runType} agent...`));

    try {
      const code = await spawnAsync('node', [
        '--experimental-strip-types',
        agentScript,
        JSON.stringify(prompt),
        runType,
        resultDir,
        baseAppDir,
      ], { stdio: 'inherit' });

      if (code !== 0) {
        console.error(cRed(`Agent (${runType}) failed with code ${code}`));
        continue;
      }
    } catch (err) {
      console.error(cRed(`Agent (${runType}) error: ${err}`));
      continue;
    }

    // Step g: Grade agent output
    console.log(cYellow(`Grading ${runType} output...`));
    const htmlFiles = fs.readdirSync(resultDir).filter(f => f.endsWith('.html'));
    if (htmlFiles.length === 0) {
      console.log(cYellow(`No HTML output found in ${runType} results`));
      continue;
    }

    const outputFile = htmlFiles.find(f => f === 'index.html') || htmlFiles[0];
    const outputPath = path.join(resultDir, outputFile);
    const gradeOutDir = path.join(resultDir, 'grade-report');
    const gradeResults = await runPlaywright(outputPath, graderPath, gradeOutDir, 'pipe')
      .catch(err => {
        console.error(cRed(`Failed to grade ${runType} output: ${err}`));
        return null;
      });

    if (gradeResults) {
      const passed = gradeResults.stats?.expected || 0;
      const failed = gradeResults.stats?.unexpected || 0;
      const total = passed + failed;
      results[runType] = { passed, total };
      if (total > 0) {
        console.log(`  ${runType}: ${passed}/${total} checks passed (${Math.round(passed / total * 100)}%)`);
      }
    }
  }

  // Step h: Print comparison
  const total = results.pre?.total || results.guided?.total || results.unguided?.total || 0;
  if (total > 0) {
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
}

function printSummary(targetDir: string, inv: GuideInventory, result: CalibrationResult | null, attempts: number): void {
  const relDir = path.relative(process.cwd(), targetDir);

  console.log(`\n${'='.repeat(60)}`);
  if (result?.success) {
    console.log(cBold(cGreen(`\u2705 Guide: ${inv.name}`)));
  } else {
    console.log(cBold(cRed(`\u274c Guide: ${inv.name}`)));
  }

  console.log(`   guide.md              \u2705 exists`);
  console.log(`   demo.html             \u2705 exists`);

  if (!inv.hasExpectations || inv.expectationsEmpty) {
    console.log(`   expectations.md       \u26a0\ufe0f  ${inv.hasExpectations ? 'empty' : 'missing'} (consider adding assertions)`);
  } else {
    console.log(`   expectations.md       \u2705 exists`);
  }

  const negStatus = inv.hasNegativeDemo ? 'exists' : 'generated';
  console.log(`   negative-demo.html    \u2705 ${negStatus}`);

  if (result?.success) {
    console.log(`   grader.ts             \u2705 calibrated (attempt ${attempts})`);
  } else if (result) {
    console.log(`   grader.ts             \u274c calibration failed`);
  } else {
    console.log(`   grader.ts             \u274c not generated`);
  }

  console.log(`\nAll generated files are in ${relDir}/`);
  if (result?.success) {
    console.log(`Ready to review and commit.`);
  }
  console.log('');
}

function spawnAsync(command: string, args: string[], options: import('child_process').SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, ...options });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
}

// Batch mode: process all incomplete guides
export async function devAll(options: DevGuideOptions = {}): Promise<void> {
  const guideCategories = ['performance', 'user-experience', 'accessibility', 'security'];
  const incompleteGuides: GuideInventory[] = [];

  for (const category of guideCategories) {
    const categoryDir = path.join(__dirname, category);
    if (!fs.existsSync(categoryDir)) continue;

    const entries = fs.readdirSync(categoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const guideDir = path.join(categoryDir, entry.name);
      const inv = inventoryGuide(guideDir);

      // Must have guide.md + demo.html, but missing negative-demo.html or grader.ts
      if (inv.hasGuide && inv.hasDemo && (!inv.hasNegativeDemo || !inv.hasGrader)) {
        incompleteGuides.push(inv);
      }
    }
  }

  if (incompleteGuides.length === 0) {
    console.log(cGreen(`All guides are complete!`));
    return;
  }

  console.log(cBold(`Found ${incompleteGuides.length} incomplete guide(s):\n`));
  for (const inv of incompleteGuides) {
    const missing = [];
    if (!inv.hasNegativeDemo) missing.push('negative-demo.html');
    if (!inv.hasGrader) missing.push('grader.ts');
    console.log(`  ${inv.name} ${cDim(`(missing: ${missing.join(', ')})`)}`);
  }
  console.log('');

  const results: { name: string; success: boolean }[] = [];

  for (const inv of incompleteGuides) {
    console.log(cBold(`\n${'='.repeat(60)}`));
    console.log(cBold(`Processing: ${inv.name}`));
    console.log(`${'='.repeat(60)}`);

    try {
      const success = await devGuide(inv.dir, { ...options, test: false });
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

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find(a => !a.startsWith('--'));
  const isTest = args.includes('--test');

  if (!dir) {
    console.error('Usage: node --experimental-strip-types guides/dev-guide.ts <path/to/guide> [--test]');
    process.exit(1);
  }

  devGuide(dir, { test: isTest }).then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
