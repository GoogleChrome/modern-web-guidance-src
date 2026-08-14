import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import { collectGuidesUsed, collectGuidanceToolsUsed } from './guidance_validation.ts';
import { type SuiteConfig } from '../config.ts';
import { getTaskMap, isDisciplineSkillDir } from '../../lib/guide-validation.ts';
import { getGraderScriptContent, isEnoent } from './agent-shared.ts';

function isTargetAppPresent(targetFile: string, targetPkgJson: string, targetPatchFile?: string): boolean {
  return fs.existsSync(targetFile) || fs.existsSync(targetPkgJson) || (targetPatchFile ? fs.existsSync(targetPatchFile) : false);
}

export function extractModelFromResults(resultsDir: string, _agent: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (summary.model && summary.model !== 'unknown') {
      return summary.model;
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }
  return 'unknown';
}

export function extractTokenUsageFromResults(resultsDir: string, _agent: string): { total: number; cached: number } | null {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (summary.tokenUsage) {
      return summary.tokenUsage;
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }
  return null;
}

function extractErrorMessage(dir: string, targetFile: string): string {
  const failureFile = path.join(dir, 'generation_failed.json');
  if (fs.existsSync(failureFile)) {
    try {
      const failureInfo = JSON.parse(fs.readFileSync(failureFile, 'utf-8'));
      return `Generation failed: ${failureInfo.agentName} exited with ${failureInfo.exitCode}`;
    } catch (e) {
      return 'Generation failed (could not parse failure info)';
    }
  }

  const stderrPath = path.join(dir, 'agent_stderr.log');
  
  if (!fs.existsSync(stderrPath)) {
    const fileName = path.relative(dir, targetFile) || path.basename(targetFile) || 'index.html';
    return fs.existsSync(targetFile) ? 'Generation failed' : `${fileName} not found`;
  }

  return fs.readFileSync(stderrPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.includes('YOLO mode'))
    .pop()?.slice(0, 100) || 'Generation mysteriously failed';
}

export function parseResultPath(relPath: string): { guide: string, taskName: string, runType: string } | null {
  const parts = relPath.split(path.sep);
  let guide: string, taskName: string, runType: string;
  
  if (parts.length === 2) {
    // [Legacy Fallback] Old structure: {taskName}/{runType}
    taskName = 'task';
    runType = parts[1];
    guide = parts[0].replace(/-task(-negative)?$/, '');
  } else if (parts.length >= 3) {
    [guide, taskName, runType] = parts;
  } else {
    return null;
  }
  
  return { guide, taskName, runType };
}

function getAppFiles(currentDir: string, base = ''): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'test-results' ||
      entry.name === 'grade-report' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...getAppFiles(path.join(currentDir, entry.name), relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

export function extractTargetModifiedFile(dir: string, prompt?: string): string | undefined {
  if (fs.existsSync(path.join(dir, 'agent.patch'))) {
    return 'agent.patch';
  }
  try {
    const appFiles = getAppFiles(dir).filter(f => {
      if (
        f === 'npx' ||
        f === 'node_modules' ||
        f.startsWith('.') ||
        f.endsWith('.log') ||
        f.endsWith('.txt') ||
        f.endsWith('.mjs') ||
        f.endsWith('.json') ||
        f.endsWith('.jsonl') ||
        f.endsWith('.yaml') ||
        f.endsWith('.svg')
      ) {
        return false;
      }
      return true;
    });

    if (prompt) {
      const promptTarget = appFiles.find(
        f => prompt.includes(f) || prompt.includes(f.split('/').pop()!)
      );
      if (promptTarget) return promptTarget;
    }

    const chatLogPath = path.join(dir, 'chat_log.txt');
    if (fs.existsSync(chatLogPath)) {
      try {
        const chatLog = fs.readFileSync(chatLogPath, 'utf-8');
        const modifiedFile = appFiles.find(
          f => chatLog.includes(f) || chatLog.includes(f.split('/').pop()!)
        );
        if (modifiedFile) return modifiedFile;
      } catch (e) {}
    }

    const standardCandidates = ['src/App.jsx', 'src/App.js', 'src/main.jsx', 'src/main.js', 'index.html'];
    for (const candidate of standardCandidates) {
      if (appFiles.includes(candidate)) {
        return candidate;
      }
    }
  } catch (e) {
    console.error(`Error calculating targetModifiedFile for ${dir}:`, e);
  }
  return undefined;
}

function getRunNumberDirs(resultsDir: string): string[] {
  const runDirs = fs.readdirSync(resultsDir)
    .filter(name => {
      const fullPath = path.join(resultsDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (runDirs.length === 0) {
    throw new Error('No test runs found!');
  }
  return runDirs;
}

function getTaskRunDirs(runPath: string): string[] {
  // Support both legacy (*/guided) and new (*/*/guided) structures.
  // Avoid greedy **/guided to prevent matching nested folders generated by agents.
  return [
    ...glob.sync('*/guided', { cwd: runPath, absolute: true }),
    ...glob.sync('*/*/guided', { cwd: runPath, absolute: true }),
    ...glob.sync('*/unguided', { cwd: runPath, absolute: true }),
    ...glob.sync('*/*/unguided', { cwd: runPath, absolute: true })
  ];
}

interface TaskRunContext {
  guide: string;
  taskName: string;
  runType: string;
  taskInfo: any;
  targetModifiedFile: string | undefined;
  targetFile: string;
  targetPkgJson: string;
  graderPath: string;
  graderResults: string;
  targetAppExists: boolean;
}

function getTaskRunContext(
  dir: string,
  runPath: string,
  taskMap: Map<string, any>,
  warnIfMissing = false
): TaskRunContext | null {
  const relPath = path.relative(runPath, dir);
  const parsed = parseResultPath(relPath);
  if (!parsed) return null;
  const { guide, taskName, runType } = parsed;
  if (runType === 'base_app') return null; // Skip the base app setup folder

  const taskInfo = taskMap.get(`${guide}/${taskName}`);
  if (!taskInfo) {
    if (warnIfMissing) {
      console.warn(`Skipping grading: Task ${guide} not found in task map`);
    }
    return null;
  }

  const targetModifiedFile = extractTargetModifiedFile(dir, taskInfo.prompt);
  const targetFile = path.join(dir, targetModifiedFile || 'index.html');
  const targetPkgJson = path.join(dir, 'package.json');
  const targetPatchFile = path.join(dir, 'agent.patch');
  let graderPath = path.join(taskInfo.guideDir, 'grader.ts');
  const targetGraderPath = path.join(taskInfo.guideDir, 'targets', taskName, 'grader.ts');
  if (fs.existsSync(targetGraderPath)) {
    graderPath = targetGraderPath;
  }
  const graderResults = path.join(dir, `${guide}_results.json`);
  const targetAppExists = isTargetAppPresent(targetFile, targetPkgJson, targetPatchFile);

  return {
    guide,
    taskName,
    runType,
    taskInfo,
    targetModifiedFile,
    targetFile,
    targetPkgJson,
    graderPath,
    graderResults,
    targetAppExists,
  };
}

function getTaskDirsForRuns(resultsDir: string, runDirs: string[]): { dir: string; runPath: string; runDir: string }[] {
  const items: { dir: string; runPath: string; runDir: string }[] = [];
  for (const runDir of runDirs) {
    const runPath = path.join(resultsDir, runDir);
    for (const dir of getTaskRunDirs(runPath)) {
      items.push({ dir, runPath, runDir });
    }
  }
  return items;
}

function setupGraderForTask(
  dir: string,
  runPath: string,
  resultsDir: string,
  taskMap: Map<string, any>
): string | null {
  const ctx = getTaskRunContext(dir, runPath, taskMap);
  if (!ctx) return null;

  const failureFile = path.join(dir, 'generation_failed.json');

  // If grader is missing, generation failed, target file is missing, or results already exist, skip generating a runner.
  if (!fs.existsSync(ctx.graderPath) || fs.existsSync(failureFile) || !ctx.targetAppExists || fs.existsSync(ctx.graderResults)) {
    return null;
  }

  // Generate a runner script to be picked up by pnpm -r run-grader
  const gradeScript = getGraderScriptContent(dir, ctx.graderPath, ctx.guide);
  const relativeId = path.relative(resultsDir, dir); // e.g. "1/guideName/guided"
  fs.writeFileSync(path.join(dir, 'grade.mjs'), gradeScript);

  let pkgJsonObj: any = {
    name: `${ctx.guide.substring(0, 30)}-${ctx.runType}-grader`,
    type: "module",
    scripts: {}
  };
  if (fs.existsSync(ctx.targetPkgJson)) {
    try {
      pkgJsonObj = JSON.parse(fs.readFileSync(ctx.targetPkgJson, 'utf-8'));
      if (!pkgJsonObj.scripts) pkgJsonObj.scripts = {};
    } catch (e) {
      console.warn("Failed to parse existing package.json, overwriting...");
    }
  }
  pkgJsonObj.scripts["run-grader"] = `node --experimental-strip-types grade.mjs --id ${relativeId}`;
  fs.writeFileSync(ctx.targetPkgJson, JSON.stringify(pkgJsonObj, null, 2));

  return relativeId;
}

async function executeParallelGrading(resultsDir: string, pnpmWorkspacePackages: string[]): Promise<void> {
  if (pnpmWorkspacePackages.length === 0) return;

  const { spawnSync } = await import('child_process');
  const rootPkgJsonPath = path.join(resultsDir, 'package.json');
  let wroteRootPkgJson = false;
  if (!fs.existsSync(rootPkgJsonPath)) {
    fs.writeFileSync(rootPkgJsonPath, JSON.stringify({
      name: "evaluation-suite-workspace",
      private: true
    }, null, 2));
    wroteRootPkgJson = true;
  }

  const pnpmWorkspacePath = path.join(resultsDir, 'pnpm-workspace.yaml');
  fs.writeFileSync(pnpmWorkspacePath, 'packages:\n  - \'**\'\n');

  try {
    console.log(`\n>>> Bootstrapping dependencies inside results workspace with pnpm install...`);
    spawnSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: resultsDir, stdio: 'inherit', shell: process.platform === 'win32' });

    console.log(`\n>>> Discovered ${pnpmWorkspacePackages.length} un-graded tasks. Running parallel grading with pnpm -r run-grader...`);
    spawnSync('pnpm', ['-r', 'run-grader'], { cwd: resultsDir, stdio: 'inherit', shell: process.platform === 'win32' });
  } finally {
    if (fs.existsSync(pnpmWorkspacePath)) {
      fs.unlinkSync(pnpmWorkspacePath);
    }
    if (wroteRootPkgJson && fs.existsSync(rootPkgJsonPath)) {
      fs.unlinkSync(rootPkgJsonPath);
    }
  }
  console.log(`✅ Completed parallel grading pass\n`);
}

async function collectGuideUsage(dir: string, runType: string, suiteConfig: SuiteConfig) {
  let guidesUsedResult: string[] = [];
  let retrievedGuides: string[] = [];
  let fileReadGuides: string[] = [];
  let guidanceToolsUsedResult: string[] = [];

  if (runType === 'guided') {
    const serving = suiteConfig.serving;
    const usage = await collectGuidesUsed(dir, serving, suiteConfig.agent);
    retrievedGuides = usage.retrievedGuides;
    fileReadGuides = usage.fileReadGuides;
    guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides])];
    guidanceToolsUsedResult = await collectGuidanceToolsUsed(dir, serving, suiteConfig.agent);
  }

  return { guidesUsedResult, retrievedGuides, fileReadGuides, guidanceToolsUsedResult };
}

function evaluateScenarioResults(
  dir: string,
  guide: string,
  graderPath: string,
  graderResults: string,
  targetAppExists: boolean,
  targetFile: string
): any[] {
  const scenarioResults: any[] = [];

  if (!fs.existsSync(graderPath)) {
    console.warn(`Grader not found for ${guide} at ${graderPath}`);
    scenarioResults.push({ name: 'Configuration', status: 'fail', message: 'Grader not found' });
  } else if (!targetAppExists) {
    scenarioResults.push({ name: 'File Check', status: 'fail', message: 'Target app missing' });
  } else if (!fs.existsSync(graderResults)) {
    const errorMessage = extractErrorMessage(dir, targetFile);
    scenarioResults.push({ passed: false, message: errorMessage, isEarlyFailure: true });
  } else {
    try {
      let json: any = null;

      if (fs.existsSync(graderResults)) {
        try {
          json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));
        } catch (e) {
          console.error(`Error parsing JSON results for ${guide} in ${dir}`, e);
        }
      } else {
        console.error(`Missing grader results JSON for ${guide} in ${dir}`);
      }

      if (json && json.suites && json.suites.length > 0) {
        const specs: any[] = [];
        const traverse = (suite: any) => {
          if (suite.specs) specs.push(...suite.specs);
          if (suite.suites) suite.suites.forEach(traverse);
        };
        json.suites.forEach(traverse);

        return specs.map((spec: any) => {
          const lastResult = spec.tests[0].results[spec.tests[0].results.length - 1];
          return {
            passed: lastResult.status === 'passed',
            message: spec.title,
            testId: spec.id
          };
        });
      }
    } catch (err: any) {
      console.error(`Error processing results for ${dir}:`, err);
      scenarioResults.push({ name: 'System Error', status: 'fail', message: err.message });
    }
  }

  return scenarioResults;
}

function readRuntimeData(dir: string): any | undefined {
  const runtimeJsonPath = path.join(dir, 'runtime.json');
  if (fs.existsSync(runtimeJsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(runtimeJsonPath, 'utf-8'));
    } catch (e) {
      console.error(`Error parsing runtime.json for ${dir}:`, e);
    }
  }
  return undefined;
}

function estimateTotalRuntime(resultsDir: string): number | undefined {
  const evalsJsonPath = path.join(resultsDir, 'evals.json');
  if (!fs.existsSync(evalsJsonPath)) {
    return undefined;
  }

  try {
    const evalsContent = fs.readFileSync(evalsJsonPath, 'utf-8');
    const timestampMatch = evalsContent.match(/"timestamp":\s*"([^"]+)"/);

    let startTimestamp: Date | null = null;
    if (timestampMatch) {
      startTimestamp = new Date(timestampMatch[1]);
    } else {
      const logPath = path.join(resultsDir, 'test_suite.log');
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const firstLineMatch = logContent.match(/\[LOG\s([^\]]+)\]/);
        if (firstLineMatch) {
          startTimestamp = new Date(firstLineMatch[1]);
        }
      }
    }

    if (startTimestamp) {
      const endTimestamp = fs.statSync(evalsJsonPath).mtime;
      return endTimestamp.getTime() - startTimestamp.getTime();
    }
  } catch (e) {
    console.error('Failed to estimate runtime during collection:', e);
  }

  return undefined;
}

function prepareGradersForRuns(
  resultsDir: string,
  runDirs: string[],
  taskMap: Map<string, any>
): string[] {
  const pnpmWorkspacePackages: string[] = [];
  for (const { dir, runPath } of getTaskDirsForRuns(resultsDir, runDirs)) {
    const pkgId = setupGraderForTask(dir, runPath, resultsDir, taskMap);
    if (pkgId) {
      pnpmWorkspacePackages.push(pkgId);
    }
  }
  return pnpmWorkspacePackages;
}

async function collectTaskRunEntry(
  dir: string,
  runPath: string,
  runNumber: number,
  taskMap: Map<string, any>,
  suiteConfig: SuiteConfig
): Promise<{ testName: string; payload: any } | null> {
  const ctx = getTaskRunContext(dir, runPath, taskMap, true);
  if (!ctx) return null;

  const usage = await collectGuideUsage(dir, ctx.runType, suiteConfig);

  const isDisciplineSkill = isDisciplineSkillDir(ctx.taskInfo.guideDir);
  const taskCategory = isDisciplineSkill
    ? path.basename(ctx.taskInfo.guideDir)
    : path.basename(path.dirname(ctx.taskInfo.guideDir));
  const expectedToolPrefixes = isDisciplineSkill
    ? [taskCategory].filter(Boolean)
    : ['modern-web'].filter(Boolean);

  const scenarioResults = evaluateScenarioResults(
    dir,
    ctx.guide,
    ctx.graderPath,
    ctx.graderResults,
    ctx.targetAppExists,
    ctx.targetFile
  );

  // For skills, placing the discipline name (`guide`) first ensures it is correctly identified 
  // and displayed as the main category in the dashboard's transposed layout.
  const testName = isDisciplineSkill ? `${ctx.guide} - ${ctx.taskName} - ${ctx.runType}` : `${ctx.taskName} - ${ctx.guide} - ${ctx.runType}`;
  const tokenUsage = extractTokenUsageFromResults(dir, suiteConfig.agent);
  const runtimeData = readRuntimeData(dir);

  const payload = {
    runNumber,
    results: scenarioResults,
    guidesUsed: usage.guidesUsedResult,
    retrievedGuides: usage.retrievedGuides,
    fileReadGuides: usage.fileReadGuides,
    guidanceToolsUsed: usage.guidanceToolsUsedResult,
    discipline: taskCategory,
    isDisciplineSkill,
    expectedToolPrefixes,
    guideName: ctx.guide,
    baseApp: ctx.taskInfo.baseApp,
    taskName: ctx.taskName,
    prompt: ctx.taskInfo.prompt,
    targetFile: ctx.targetModifiedFile,
    files: fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory()),
    runtime: runtimeData,
    tokenUsage,
  };

  return { testName, payload };
}

async function collectAllResults(
  resultsDir: string,
  runDirs: string[],
  taskMap: Map<string, any>,
  suiteConfig: SuiteConfig
): Promise<Record<string, any[]>> {
  const allResults: Record<string, any[]> = {};

  for (const { dir, runPath, runDir } of getTaskDirsForRuns(resultsDir, runDirs)) {
    const entry = await collectTaskRunEntry(dir, runPath, parseInt(runDir), taskMap, suiteConfig);
    if (!entry) continue;

    if (!allResults[entry.testName]) {
      allResults[entry.testName] = [];
    }
    allResults[entry.testName].push(entry.payload);
  }

  return allResults;
}

export async function collectResults(resultsDir: string, suiteConfig: SuiteConfig) {
  const taskMap = getTaskMap();
  const runDirs = getRunNumberDirs(resultsDir);

  // PASS 1: Generate parallel grader scripts for missing results
  const graderPackages = prepareGradersForRuns(resultsDir, runDirs, taskMap);

  // PASS 1.5: Execute parallel grading runs
  await executeParallelGrading(resultsDir, graderPackages);

  // PASS 2: Collect all results and formulate report
  const allResults = await collectAllResults(resultsDir, runDirs, taskMap, suiteConfig);

  const estimatedRuntime = estimateTotalRuntime(resultsDir);

  return { allResults, numRuns: runDirs.length, totalRuntime: estimatedRuntime };
}
