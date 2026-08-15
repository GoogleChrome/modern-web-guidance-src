import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import config from '../config.ts';
import { cGreen, cRed, cCyan, cBold } from '../../lib/colors.ts';
import { downloadRunFromGcsIfMissing } from './gcs-downloader.ts';
import { baseAppsDir, guidesDir, resultsDir } from '../../lib/paths.ts';
import { getCompliancePrompts, getCodeAndFrictionPrompts, getSynthesizerPrompts } from './compare-prompts.ts';
import { generateUnifiedDiff } from '../../lib/patch-utils.ts';
import { categorizeAction, type StandardizedStep, type TrajectorySummary } from './trajectory-normalizer.ts';
import { parseResultPath } from './collection.ts';
import { GUIDE_FILE, EXPECTATIONS_FILE, GRADER_FILE } from '../../lib/guide-validation.ts';

const ERROR_LOOP_THRESHOLD = 2;
const MAX_THOUGHT_SNIPPET_LEN = 120;
const MAX_ACTION_PARAMS_SNIPPET_LEN = 200;

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}

function tryReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

function tryReadJson<T = any>(filePath: string): T | null {
  const content = tryReadFile(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    console.warn(`Warning: Failed to parse JSON from ${filePath}`);
    return null;
  }
}

/**
 * Calls the local agent CLI (Jetski or Gemini CLI based on GD_DEV_USE_JETSKI) to generate diagnostic text.
 */
async function callAgentCli(systemInstruction: string, prompt: string, label = 'Compare Agent'): Promise<string> {
  const useJetski = process.env.GD_DEV_USE_JETSKI === '1';
  const command = useJetski ? config.environment.jetskiCliBin : config.environment.geminiCliBin;
  const combinedPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
  const commandArgs = ['-p', combinedPrompt];

  if (useJetski) {
    const model = process.env.JETSKI_MODEL;
    if (model) commandArgs.push('--model', model);
    commandArgs.push('--dangerously-skip-permissions');
  } else {
    const model = process.env.GEMINI_MODEL;
    if (model) commandArgs.push('--model', model);
  }

  console.log(`[${label}] Executing via ${useJetski ? 'Jetski CLI' : 'Gemini CLI'}...`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`[${label}] Failed to start ${useJetski ? 'Jetski' : 'Gemini'} CLI (${command}): ${err.message}`));
    });

    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(`[${label}] ${useJetski ? 'Jetski' : 'Gemini'} CLI failed with exit code ${exitCode}:\n${stderrData || stdoutData}`));
      } else {
        const cleanOutput = stdoutData.trim();
        if (!cleanOutput) {
          reject(new Error(`[${label}] Empty response received from ${useJetski ? 'Jetski' : 'Gemini'} CLI`));
        } else {
          try {
            const debugDir = path.join(resultsDir, 'compare_work');
            fs.mkdirSync(debugDir, { recursive: true });
            const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            fs.writeFileSync(path.join(debugDir, `response_debug_${slug}.txt`), cleanOutput, 'utf8');
          } catch (e) {
            console.warn(`[${label}] Failed to save debug response:`, e);
          }

          resolve(cleanOutput);
        }
      }
    });
  });
}

export interface TaggedStep {
  stepNumber: number;
  category: 'skill_search' | 'guide_retrieval' | 'mandatory_rule_thought' | 'code_mutation' | 'incidental_noise';
  thought?: string;
  actionName?: string;
  actionDetails?: string;
  isError?: boolean;
  raw: StandardizedStep;
}

export interface PreprocessedTrajectory {
  taggedSteps: TaggedStep[];
  searchQueries: string[];
  retrievedGuideIds: string[];
  mandatoryRulesAdopted: string[];
  codeMutationCount: number;
  noiseCount: number;
  errorLoopCount: number;
}

export interface GuideContext {
  guideName: string;
  taskName: string;
  guideContent: string;
  expectationsContent: string;
  taskPrompt: string;
  graderContent: string;
  baseAppContent: string;
}

export interface PlaywrightAssertion {
  message: string;
  passed: boolean;
  errors?: string[];
  location?: { file?: string; line?: number; column?: number };
}

export interface RunContext {
  dir: string;
  runNumber: number;
  score: number;
  resultsJson: PlaywrightAssertion[];
  trajectorySummary: TrajectorySummary | null;
  codeOutput: string;
  codePath: string;
  preprocessed: PreprocessedTrajectory;
  initialPrompt: string;
}

/**
 * Finds guide.md, expectations.md, task.md, grader.ts, and base app content for a given guide/task name.
 */
function findGuideContext(guideName: string, taskName: string): GuideContext {
  let guideContent = '';
  let expectationsContent = '';
  let taskPrompt = '';
  let graderContent = '';
  let baseAppContent = '';
  let guideDir = '';

  // Direct check first
  const directPath = path.join(guidesDir, guideName);
  if (tryReadFile(path.join(directPath, GUIDE_FILE))) {
    guideDir = directPath;
  } else {
    try {
      const items = fs.readdirSync(guidesDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const nested = path.join(guidesDir, item.name, guideName);
          if (tryReadFile(path.join(nested, GUIDE_FILE))) {
            guideDir = nested;
            break;
          }
        }
      }
    } catch {
      // guides directory not readable
    }
  }

  if (guideDir) {
    guideContent = tryReadFile(path.join(guideDir, GUIDE_FILE)) || '';
    expectationsContent = tryReadFile(path.join(guideDir, EXPECTATIONS_FILE)) || '';
    graderContent = tryReadFile(path.join(guideDir, GRADER_FILE)) || '';

    // Task prompt lookup
    const taskCandidates = [
      path.join(guideDir, 'tasks', `${taskName}.md`),
      path.join(guideDir, 'tasks', 'task.md'),
      path.join(guideDir, 'task.md')
    ];

    for (const candidate of taskCandidates) {
      const content = tryReadFile(candidate);
      if (content) {
        taskPrompt = content;
        break;
      }
    }

    if (taskPrompt) {
      const baseAppMatch = taskPrompt.match(/base_app:\s*([^\s\r\n]+)/i);
      if (baseAppMatch) {
        const baseAppName = baseAppMatch[1].trim();
        const baseAppDir = path.join(baseAppsDir, baseAppName);
        const baseCode = findCodeOutput(baseAppDir);
        baseAppContent = baseCode.content;
      }
    }
  }

  return {
    guideName,
    taskName,
    guideContent: guideContent || 'No guide.md content found.',
    expectationsContent: expectationsContent || 'No expectations.md content found.',
    taskPrompt: taskPrompt || 'No task.md prompt found.',
    graderContent: graderContent || 'No grader.ts content found.',
    baseAppContent: baseAppContent || 'No base app content found.'
  };
}

/**
 * Finds the main generated code file in a run directory.
 */
function findCodeOutput(dir: string, targetFileFromEvals?: string): { path: string; content: string } {
  if (targetFileFromEvals) {
    const content = tryReadFile(path.join(dir, targetFileFromEvals));
    if (content !== null) {
      return { path: targetFileFromEvals, content };
    }
  }

  const candidates = [
    'dist/index.html',
    'src/App.jsx',
    'src/App.js',
    'src/main.jsx',
    'src/main.js',
    'src/index.jsx',
    'src/index.js',
    'index.html'
  ];

  for (const candidate of candidates) {
    const content = tryReadFile(path.join(dir, candidate));
    if (content !== null) {
      return { path: candidate, content };
    }
  }

  return { path: 'unknown', content: '' };
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Recursively parses Playwright's JSON report and extracts assertions with detailed error traces and locations.
 */
function parsePlaywrightResults(report: any): PlaywrightAssertion[] {
  const assertions: PlaywrightAssertion[] = [];
  if (!report || !Array.isArray(report.suites)) {
    return assertions;
  }

  function collectSpecs(suite: any) {
    if (Array.isArray(suite.specs)) {
      suite.specs.forEach((spec: any) => {
        const passed = !!spec.ok;
        const errors: string[] = [];
        let location: { file?: string; line?: number; column?: number } | undefined;

        if (!passed && Array.isArray(spec.tests)) {
          for (const test of spec.tests) {
            if (Array.isArray(test.results)) {
              for (const res of test.results) {
                if (res.error?.message) {
                  const cleanMsg = stripAnsi(res.error.message);
                  if (!errors.includes(cleanMsg)) errors.push(cleanMsg);
                }
                if (Array.isArray(res.errors)) {
                  for (const err of res.errors) {
                    if (err.message) {
                      const cleanMsg = stripAnsi(err.message);
                      if (!errors.includes(cleanMsg)) errors.push(cleanMsg);
                    }
                    if (err.location && !location) {
                      location = err.location;
                    }
                  }
                }
              }
            }
          }
        }

        assertions.push({
          message: spec.title,
          passed,
          errors: errors.length > 0 ? errors : undefined,
          location
        });
      });
    }
    if (Array.isArray(suite.suites)) {
      suite.suites.forEach(collectSpecs);
    }
  }

  report.suites.forEach(collectSpecs);
  return assertions;
}

/**
 * Categorizes trajectory steps into milestone/noise types and computes metrics.
 */
function preprocessTrajectory(trajectorySummary: TrajectorySummary | null): PreprocessedTrajectory {
  const steps = trajectorySummary?.steps || [];
  const taggedSteps: TaggedStep[] = [];
  const searchQueries: string[] = [];
  const retrievedGuideIds: string[] = [];
  const mandatoryRulesAdopted: string[] = [];
  let codeMutationCount = 0;
  let noiseCount = 0;
  let errorLoopCount = 0;
  let consecutiveErrors = 0;

  for (let i = 0; i < steps.length; i++) {
    const rawStep = steps[i];
    const stepNumber = rawStep.stepNumber || i + 1;
    const thought = rawStep.thought || '';
    const actionName = rawStep.action?.name || '';
    const actionParams = rawStep.action?.params;
    const actionParamsStr = JSON.stringify(actionParams || {}).toLowerCase();
    const isErr = rawStep.outcome?.status === 'error';

    if (isErr) {
      consecutiveErrors++;
      if (consecutiveErrors >= ERROR_LOOP_THRESHOLD) {
        errorLoopCount++;
      }
    } else {
      consecutiveErrors = 0;
    }

    const rawCat = rawStep.action?.canonicalCategory || categorizeAction(actionName, actionParams, thought);
    const category: TaggedStep['category'] = rawCat && rawCat !== 'other' ? rawCat : 'incidental_noise';

    if (category === 'guide_retrieval') {
      const guideId = actionParams?.id || actionParams?.guideId || actionParams?.query || actionParams?.command;
      if (guideId) retrievedGuideIds.push(String(guideId).trim());
    } else if (category === 'skill_search') {
      const query = actionParams?.query || actionParams?.command || actionParams?.search;
      if (query) searchQueries.push(String(query).trim());
    } else if (category === 'code_mutation') {
      codeMutationCount++;
    } else if (category === 'mandatory_rule_thought') {
      mandatoryRulesAdopted.push(thought.slice(0, MAX_THOUGHT_SNIPPET_LEN));
    } else {
      noiseCount++;
    }

    taggedSteps.push({
      stepNumber,
      category,
      thought,
      actionName,
      actionDetails: actionParamsStr.slice(0, MAX_ACTION_PARAMS_SNIPPET_LEN),
      isError: isErr,
      raw: rawStep
    });
  }

  // Backfill top-level retrievedGuides if present
  if (trajectorySummary?.retrievedGuides) {
    retrievedGuideIds.push(...trajectorySummary.retrievedGuides);
  }

  return {
    taggedSteps,
    searchQueries: Array.from(new Set(searchQueries)),
    retrievedGuideIds: Array.from(new Set(retrievedGuideIds)),
    mandatoryRulesAdopted,
    codeMutationCount,
    noiseCount,
    errorLoopCount
  };
}

function extractTargetFileFromEvalsJson(runDir: string): string | undefined {
  let curr = runDir;
  while (curr && curr !== path.dirname(curr)) {
    const data = tryReadJson(path.join(curr, 'evals.json'));
    if (data && data.results) {
      const pathSegments = runDir.split(/[/\\]/);
      const taskName = pathSegments[pathSegments.length - 2];
      for (const testName in data.results) {
        const runs = data.results[testName];
        if (Array.isArray(runs)) {
          for (const run of runs) {
            if (run.targetFile && (run.taskName === taskName || testName.includes(taskName || ''))) {
              return run.targetFile;
            }
          }
        }
      }
    }
    curr = path.dirname(curr);
  }
  return undefined;
}

/**
 * Loads all relevant context for a single run including preprocessed trajectory.
 */
function loadRunContext(runDir: string): RunContext {
  const absoluteDir = path.resolve(runDir);
  try {
    fs.statSync(absoluteDir);
  } catch (err: unknown) {
    if (isEnoent(err)) {
      throw new Error(`Run directory not found: ${absoluteDir}`);
    }
    throw err;
  }

  const pathSegments = absoluteDir.split(/[/\\]/);
  const runNumberMatch = absoluteDir.match(/[/\\](\d+)[/\\]/);
  const runNumber = runNumberMatch ? parseInt(runNumberMatch[1], 10) : 0;
  const guideName = pathSegments[pathSegments.length - 3] || '';

  let resultsJson: PlaywrightAssertion[] = [];
  let score = 0;

  let rawReport = tryReadJson(path.join(absoluteDir, `${guideName}_results.json`));
  if (!rawReport) {
    try {
      const fallbackFile = fs.readdirSync(absoluteDir).find((f) => f.endsWith('_results.json'));
      if (fallbackFile) {
        rawReport = tryReadJson(path.join(absoluteDir, fallbackFile));
      }
    } catch {
      // directory listing failed
    }
  }

  if (rawReport) {
    resultsJson = parsePlaywrightResults(rawReport);
    const passed = resultsJson.filter((c) => c.passed).length;
    score = resultsJson.length > 0 ? Math.round((passed / resultsJson.length) * 100) : 0;
  }

  const trajectorySummary = tryReadJson<TrajectorySummary>(path.join(absoluteDir, 'trajectory_summary.json'));
  const targetFileFromEvals = extractTargetFileFromEvalsJson(absoluteDir);
  const code = findCodeOutput(absoluteDir, targetFileFromEvals);
  const preprocessed = preprocessTrajectory(trajectorySummary);
  const initialPrompt = trajectorySummary?.initialPrompt || 'Initial prompt not found in trajectory summary.';

  return {
    dir: absoluteDir,
    runNumber,
    score,
    resultsJson,
    trajectorySummary,
    codeOutput: code.content,
    codePath: code.path,
    preprocessed,
    initialPrompt
  };
}

/**
 * Phase 2: Sub-agent 1 - Guide Compliance & Requirement Auditor.
 */
async function runSubAgent1_GuideCompliance(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  statusA: string,
  statusB: string
): Promise<string> {
  const { systemInstruction, prompt } = getCompliancePrompts(guideCtx, ctxA, ctxB, statusA, statusB);
  return callAgentCli(systemInstruction, prompt, 'Sub-Agent 1 (Guide Compliance)');
}

/**
 * Phase 2: Sub-agent 2 - Code-to-Trajectory Backtracking & Friction Diagnostic.
 */
async function runSubAgent2_CodeAndFriction(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  diffBaseVsA: string,
  diffBaseVsB: string,
  diffAvsB: string,
  statusA: string,
  statusB: string
): Promise<string> {
  const { systemInstruction, prompt } = getCodeAndFrictionPrompts(
    guideCtx,
    ctxA,
    ctxB,
    diffBaseVsA,
    diffBaseVsB,
    diffAvsB,
    statusA,
    statusB
  );
  return callAgentCli(systemInstruction, prompt, 'Sub-Agent 2 (Code & Friction)');
}

/**
 * Phase 3: Synthesizer - Combines sub-agent outputs into the 4-section diagnostic report.
 */
async function synthesizeDiagnosis(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  complianceAnalysis: string,
  codeAndFrictionAnalysis: string,
  statusA: string,
  statusB: string
): Promise<string> {
  const { systemInstruction, prompt } = getSynthesizerPrompts(
    guideCtx,
    ctxA,
    ctxB,
    complianceAnalysis,
    codeAndFrictionAnalysis,
    statusA,
    statusB
  );
  return callAgentCli(systemInstruction, prompt, 'Synthesizer Sub-Agent');
}

/**
 * Runs the diagnostic agent comparison using local CLI sub-agents.
 */
export async function runComparison(runDirA: string, runDirB: string): Promise<string> {
  console.log(cCyan(`\n=== Starting Run Comparison (Guide-Grounded 3-Phase Pipeline) ===`));
  console.log(`Run A: ${runDirA}`);
  console.log(`Run B: ${runDirB}\n`);

  await Promise.all([
    downloadRunFromGcsIfMissing(runDirA),
    downloadRunFromGcsIfMissing(runDirB)
  ]);

  const ctxA = loadRunContext(runDirA);
  const ctxB = loadRunContext(runDirB);

  console.log(`Comparing Run A (Score: ${ctxA.score}%) vs Run B (Score: ${ctxB.score}%)...`);

  const isAProblem = ctxA.score < ctxB.score;
  const successCtx = isAProblem ? ctxB : ctxA;

  const parsedPath = parseResultPath(path.relative(resultsDir, successCtx.dir));
  const guideName = parsedPath?.guide || successCtx.dir.split(/[/\\]/).slice(-3, -2)[0] || 'guide';
  const taskName = parsedPath?.taskName || successCtx.dir.split(/[/\\]/).slice(-2, -1)[0] || 'task';
  const runType = parsedPath?.runType || successCtx.dir.split(/[/\\]/).slice(-1)[0] || 'guided';

  const guideCtx = findGuideContext(guideName, taskName);
  const diffBaseVsA = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxA.codeOutput || '', 'Base App', 'Run A Output');
  const diffBaseVsB = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxB.codeOutput || '', 'Base App', 'Run B Output');
  const diffAvsB = generateUnifiedDiff(ctxA.codeOutput || '', ctxB.codeOutput || '', 'Run A Output', 'Run B Output');

  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED RUN';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED RUN';

  const suiteMatch = successCtx.dir.match(/(.*[/\\]results[/\\][^/\\]+)/);
  const suiteDir = suiteMatch ? suiteMatch[1] : successCtx.dir;
  const workDir = path.join(suiteDir, 'compare_work');
  fs.mkdirSync(workDir, { recursive: true });

  try {
    console.log(cBold(`[Compare Agent] Phase 1: Pre-processed trajectories into tagged milestones.`));
    console.log(`  Run A: ${ctxA.preprocessed.taggedSteps.length} steps (${ctxA.preprocessed.noiseCount} noise, ${ctxA.preprocessed.errorLoopCount} retries)`);
    console.log(`  Run B: ${ctxB.preprocessed.taggedSteps.length} steps (${ctxB.preprocessed.noiseCount} noise, ${ctxB.preprocessed.errorLoopCount} retries)`);

    console.log(cBold(`[Compare Agent] Phase 2: Dispatching parallel sub-agents (Guide Compliance & Code/Friction)...`));
    const [complianceAnalysis, codeAndFrictionAnalysis] = await Promise.all([
      runSubAgent1_GuideCompliance(guideCtx, ctxA, ctxB, statusA, statusB),
      runSubAgent2_CodeAndFriction(guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB, statusA, statusB)
    ]);

    console.log(cBold(`[Compare Agent] Phase 3: Synthesizing final 4-section diagnostic report...`));
    const markdownReport = await synthesizeDiagnosis(
      guideCtx,
      ctxA,
      ctxB,
      complianceAnalysis,
      codeAndFrictionAnalysis,
      statusA,
      statusB
    );

    if (suiteMatch) {
      const diagnosesDir = path.join(suiteDir, 'variance_diagnoses');
      fs.mkdirSync(diagnosesDir, { recursive: true });
      const fileName = `${guideName}-${taskName}-${runType}.md`;
      const savedPath = path.join(diagnosesDir, fileName);
      fs.writeFileSync(savedPath, markdownReport, 'utf8');
      console.log(cGreen(`\n✅ Saved diagnostic report to: ${savedPath}`));
    }

    const localSavedPath = path.resolve('./variance_diagnosis.md');
    fs.writeFileSync(localSavedPath, markdownReport, 'utf8');
    console.log(cGreen(`✅ Saved local copy to: ${localSavedPath}\n`));

    console.log(cBold(cCyan('--- DIAGNOSTIC REPORT ---')));
    console.log(markdownReport);
    console.log(cCyan('-------------------------'));

    return markdownReport;
  } catch (err: any) {
    console.error(cRed(`❌ Diagnosis failed: ${err.message}`));
    throw err;
  }
}
