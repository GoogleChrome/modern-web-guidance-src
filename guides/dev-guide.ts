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

const cRed = (str: string) => `\x1b[31m${str}\x1b[0m`;
const cGreen = (str: string) => `\x1b[32m${str}\x1b[0m`;
const cYellow = (str: string) => `\x1b[33m${str}\x1b[0m`;
const cCyan = (str: string) => `\x1b[36m${str}\x1b[0m`;
const cBold = (str: string) => `\x1b[1m${str}\x1b[0m`;
const cDim = (str: string) => `\x1b[2m${str}\x1b[0m`;

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

async function runAgentTest(targetDir: string, guideName: string): Promise<void> {
  console.log(cCyan(`\n--- Running agent test ---`));

  // Build MCP index
  console.log(`Building MCP index...`);
  const buildCode = await spawnAsync('pnpm', ['build:mcp'], { cwd: rootDir, stdio: 'inherit' });
  if (buildCode !== 0) {
    console.error(cRed(`Failed to build MCP index (exit code ${buildCode})`));
    return;
  }

  // Find or create test prompt.
  // TODO: do i want it to do this?
  const promptsPath = path.join(targetDir, 'prompts.md');
  const guidePath = path.join(targetDir, 'guide.md');
  let prompt: string;

  if (fs.existsSync(promptsPath)) {
    prompt = fs.readFileSync(promptsPath, 'utf-8').trim();
    // Use the first prompt line if multiple are listed (bullet list)
    if (prompt.startsWith('-')) {
      prompt = prompt.split('\n')[0].replace(/^-\s*/, '').trim();
    }
  } else {
    const guideContent = fs.readFileSync(guidePath, 'utf-8');
    const frontmatter = guideContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter) {
      const descMatch = frontmatter[1].match(/^description:\s*(.+)$/m);
      prompt = descMatch ? descMatch[1].trim() : `Implement the guidance from ${guideName}`;
    } else {
      prompt = `Implement the guidance from ${guideName}`;
    }
  }

  console.log(`Test prompt: ${cDim(prompt.substring(0, 120))}${prompt.length > 120 ? '...' : ''}`);

  // Create test-app/ if needed
  const testAppDir = path.join(targetDir, 'test-app');
  if (!fs.existsSync(testAppDir)) {
    fs.mkdirSync(testAppDir, { recursive: true });
  }

  const { Agents } = await import('../harness/config.ts');
  const config = (await import('../harness/config.ts')).default;
  const agent = config.suite.agent;

  const agentScript = path.join(rootDir, 'harness', 'agents',
    agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
      agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
        'jetski-agent.ts'
  );

  const results: Record<string, { passed: number; total: number }> = {};

  for (const runType of ['unguided', 'guided']) {
    const resultDir = path.join(targetDir, 'test-app-results', runType);
    fs.mkdirSync(resultDir, { recursive: true });

    console.log(cYellow(`\nRunning ${runType} agent test...`));

    try {
      const code = await spawnAsync('node', [
        '--experimental-strip-types',
        agentScript,
        JSON.stringify(prompt),
        runType,
        resultDir,
        testAppDir
      ], { stdio: 'inherit' });

      if (code !== 0) {
        console.error(cRed(`Agent test (${runType}) failed with code ${code}`));
        continue;
      }

      // Grade the output — find HTML files in result directory
      const htmlFiles = fs.readdirSync(resultDir).filter(f => f.endsWith('.html'));
      if (htmlFiles.length === 0) {
        console.log(cYellow(`No HTML output found in ${runType} results`));
        continue;
      }

      const outputFile = htmlFiles.find(f => f === 'index.html') || htmlFiles[0];
      const outputPath = path.join(resultDir, outputFile);
      const graderPath = findGrader(targetDir);
      if (!graderPath) {
        console.error(cRed(`Could not find grader.ts for grading agent output`));
        continue;
      }

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
    } catch (err) {
      console.error(cRed(`Agent test (${runType}) error: ${err}`));
    }
  }

  // Print comparison
  if (results.guided && results.unguided && results.guided.total > 0 && results.unguided.total > 0) {
    const guidedPct = Math.round(results.guided.passed / results.guided.total * 100);
    const unguidedPct = Math.round(results.unguided.passed / results.unguided.total * 100);
    const impact = guidedPct - unguidedPct;

    console.log(cBold(`\nAgent test results:`));
    console.log(`  Unguided: ${results.unguided.passed}/${results.unguided.total} checks passed (${unguidedPct}%)`);
    console.log(`  Guided:   ${results.guided.passed}/${results.guided.total} checks passed (${guidedPct}%)`);
    console.log(`  Guide impact: ${impact >= 0 ? '+' : ''}${impact}%`);
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
