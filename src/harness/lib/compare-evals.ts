import fs from 'node:fs';
import path from 'node:path';
import { cGreen, cRed, cCyan, cBold } from '../../lib/colors.ts';
import { downloadRunFromGcsIfMissing } from './gcs-downloader.ts';
import { baseAppsDir, guidesDir, resultsDir } from '../../lib/paths.ts';
import { getCompliancePrompts, getCodeAndFrictionPrompts, getSynthesizerPrompts } from './compare-prompts.ts';
import { generateUnifiedDiff, extractTargetFilesFromPatch } from '../../lib/patch-utils.ts';
import { categorizeAction, type CanonicalCategory, type TrajectorySummary } from './trajectory-normalizer.ts';
import { parseResultPath } from './collection.ts';
import { isEnoent } from './agent-shared.ts';
import { getDefaultSolutionAgent, getGuidesMap, getTaskMap, GUIDE_FILE, EXPECTATIONS_FILE, GRADER_FILE, TASK_FILE } from '../../lib/guide-validation.ts';
import { runAgent } from '../../guides/lib/utils.ts';

const ERROR_LOOP_THRESHOLD = 2;
const MAX_THOUGHT_SNIPPET_LEN = 120;

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
 * Calls the local agent CLI (Jetski or Gemini CLI based on repository config) to generate diagnostic text.
 */
async function callAgentCli(systemInstruction: string, prompt: string, label = 'Compare Agent'): Promise<string> {
  const combinedPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
  const agent = getDefaultSolutionAgent();

  console.log(`[${label}] Executing via ${agent}...`);

  const cleanOutput = await runAgent(agent, combinedPrompt, undefined, { captureOutput: true });
  if (!cleanOutput) {
    throw new Error(`[${label}] Empty response received from ${agent}`);
  }

  return cleanOutput;
}

export interface TaggedStep {
  stepNumber: number;
  category: Exclude<CanonicalCategory, 'other'>;
  thought?: string;
  actionName?: string;
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
  score: number;
  resultsJson: PlaywrightAssertion[];
  codeOutput: string;
  patchContent?: string;
  preprocessed: PreprocessedTrajectory;
  initialPrompt: string;
}

/**
 * Finds guide.md, expectations.md, task.md, grader.ts, and base app content for a given guide/task name.
 */
function findGuideContext(guideName: string, taskName: string): GuideContext {
  const guideInfo = getGuidesMap().get(guideName);
  const taskKey = `${guideName}/${taskName}`;
  const taskInfo = getTaskMap().get(taskKey);

  const guideDir = taskInfo?.guideDir || guideInfo?.dir || (fs.existsSync(path.join(guidesDir, guideName)) ? path.join(guidesDir, guideName) : '');

  let guideContent = '';
  let expectationsContent = '';
  let graderContent = '';
  let taskPrompt = taskInfo?.prompt || '';
  let baseAppContent = '';

  if (guideDir) {
    guideContent = tryReadFile(path.join(guideDir, GUIDE_FILE)) || '';
    expectationsContent = tryReadFile(path.join(guideDir, EXPECTATIONS_FILE)) || '';

    // Check target-specific grader first (targets/<taskName>/grader.ts), then root grader.ts
    const targetGrader = path.join(guideDir, 'targets', taskName, GRADER_FILE);
    graderContent = tryReadFile(targetGrader) || tryReadFile(path.join(guideDir, GRADER_FILE)) || '';

    // If prompt wasn't populated from task map, check candidate file locations
    if (!taskPrompt) {
      const taskCandidates = [
        path.join(guideDir, 'targets', taskName, TASK_FILE),
        path.join(guideDir, 'tasks', `${taskName}.md`),
        path.join(guideDir, 'tasks', TASK_FILE),
        path.join(guideDir, TASK_FILE)
      ];

      for (const candidate of taskCandidates) {
        const content = tryReadFile(candidate);
        if (content) {
          taskPrompt = content;
          break;
        }
      }
    }

    const baseAppName = taskInfo?.baseApp || taskPrompt.match(/base_app:\s*([^\s\r\n]+)/i)?.[1]?.trim();
    if (baseAppName) {
      const baseAppDir = path.join(baseAppsDir, baseAppName);
      let targetRelFile: string | undefined;
      const targetDir = guideDir ? path.join(guideDir, 'targets', taskName) : undefined;
      if (targetDir) {
        const solPatch = path.join(targetDir, 'patches', 'solution.patch');
        const [extracted] = extractTargetFilesFromPatch(solPatch);
        targetRelFile = extracted;
      }
      const baseCode = findCodeOutput(baseAppDir, targetRelFile);
      baseAppContent = baseCode.content;
    }
  }

  return {
    guideName,
    taskName,
    guideContent: guideContent || 'No guide.md content found.',
    expectationsContent: expectationsContent || 'No expectations.md content found.',
    taskPrompt: taskPrompt || 'No task.md prompt found.',
    graderContent: graderContent || 'No grader.ts content found.',
    baseAppContent: baseAppContent || ''
  };
}

/**
 * Finds the main generated code file in a run directory.
 */
function findCodeOutput(dir: string, targetFileFromEvals?: string): { path: string; content: string } {
  if (targetFileFromEvals && targetFileFromEvals !== 'agent.patch') {
    const content = tryReadFile(path.join(dir, targetFileFromEvals));
    if (content !== null) {
      return { path: targetFileFromEvals, content };
    }
  }

  const candidates = [
    'dist/index.html',
    'src/App.tsx',
    'src/App.jsx',
    'src/App.ts',
    'src/App.js',
    'src/main.tsx',
    'src/main.jsx',
    'src/main.ts',
    'src/main.js',
    'src/index.tsx',
    'src/index.jsx',
    'src/index.ts',
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
 * Pulls the query out of a guidance search command, e.g. `gd search "form validation"` -> `form validation`.
 */
export function extractSearchQuery(cmd: string): string | undefined {
  if (!cmd) return undefined;

  const normalized = cmd.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
  const searchIdx = normalized.toLowerCase().indexOf('search');
  if (searchIdx === -1) return undefined;

  const afterSearch = normalized.slice(searchIdx + 6).trim();
  if (!afterSearch) return undefined;

  // 1. Quoted string anywhere after search
  const quotedMatch = afterSearch.match(/(?:"([^"]+)"|'([^']+)')/);
  if (quotedMatch) {
    const q = (quotedMatch[1] || quotedMatch[2]).trim();
    return q || undefined;
  }

  // 2. Unquoted arguments: strip flags (e.g. --limit 5, --skill-version ..., -v) and trailing backslashes
  const tokens = afterSearch.split(/\s+/);
  const queryTokens: string[] = [];
  let skipNext = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (token.startsWith('--') || token.startsWith('-')) {
      if (!token.includes('=') && i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        skipNext = true;
      }
      continue;
    }
    if (token === '\\') continue;
    queryTokens.push(token);
  }

  const query = queryTokens.join(' ').trim();
  return query || undefined;
}

/**
 * Categorizes trajectory steps into milestone/noise types and computes metrics.
 */
export function preprocessTrajectory(trajectorySummary: TrajectorySummary | null): PreprocessedTrajectory {
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
    const isErr = rawStep.outcome?.status === 'error';

    if (isErr) {
      consecutiveErrors++;
      if (consecutiveErrors >= ERROR_LOOP_THRESHOLD) {
        errorLoopCount++;
      }
    } else {
      consecutiveErrors = 0;
    }

    const rawCat = categorizeAction(actionName, actionParams, thought, rawStep.action?.type);
    const category: TaggedStep['category'] = rawCat && rawCat !== 'other' ? rawCat : 'incidental_noise';

    switch (category) {
      case 'guide_retrieval':
        // Retrieved guide ids come from trajectorySummary.retrievedGuides below.
        break;
      case 'skill_search': {
        const cmd = typeof actionParams?.command === 'string' ? actionParams.command : '';
        const query = extractSearchQuery(cmd);
        if (query) searchQueries.push(query);
        break;
      }
      case 'skill_activation':
        // Kept out of the noise bucket so it stays visible in the milestone timeline.
        break;
      case 'code_mutation':
        codeMutationCount++;
        break;
      case 'mandatory_rule_thought':
        mandatoryRulesAdopted.push(thought.slice(0, MAX_THOUGHT_SNIPPET_LEN));
        break;
      case 'incidental_noise':
        noiseCount++;
        break;
      default: {
        const unhandled: never = category;
        throw new Error(`Unhandled canonical category: ${String(unhandled)}`);
      }
    }

    taggedSteps.push({
      stepNumber,
      category,
      thought,
      actionName
    });
  }

  // Trajectory summary retrievedGuides is the primary source of truth
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
  const parsed = parseResultPath(runDir);
  const guideName = parsed?.guide;
  const taskName = parsed?.taskName;

  while (curr && curr !== path.dirname(curr)) {
    const data = tryReadJson(path.join(curr, 'evals.json'));
    if (data && data.results) {
      for (const testName in data.results) {
        const runs = data.results[testName];
        if (Array.isArray(runs)) {
          for (const run of runs) {
            const matchesGuide = !guideName || run.guideName === guideName || run.taskPath?.includes(guideName);
            const matchesTask = !taskName || run.taskName === taskName;
            if (matchesGuide && matchesTask && run.targetFile) {
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
export function loadRunContext(runDir: string): RunContext {
  let absoluteDir = path.resolve(runDir);
  if (!fs.existsSync(absoluteDir)) {
    const stripped = runDir.replace(/^(\.\/)?(harness\/)?results\/?/, '');
    const candidate = path.resolve(resultsDir, stripped);
    if (fs.existsSync(candidate)) {
      absoluteDir = candidate;
    }
  }

  try {
    fs.statSync(absoluteDir);
  } catch (err: unknown) {
    if (isEnoent(err)) {
      throw new Error(`Run directory not found: ${absoluteDir}`);
    }
    throw err;
  }

  const parsed = parseResultPath(absoluteDir);
  const guideName = parsed?.guide || '';

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
  const patchContent = tryReadFile(path.join(absoluteDir, 'agent.patch')) || undefined;
  const preprocessed = preprocessTrajectory(trajectorySummary);
  const initialPrompt = trajectorySummary?.initialPrompt || 'Initial prompt not found in trajectory summary.';

  return {
    dir: absoluteDir,
    score,
    resultsJson,
    codeOutput: code.content,
    patchContent,
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
  statusB: string,
  agentCaller = callAgentCli
): Promise<string> {
  const { systemInstruction, prompt } = getCompliancePrompts(guideCtx, ctxA, ctxB, statusA, statusB);
  return agentCaller(systemInstruction, prompt, 'Sub-Agent 1 (Guide Compliance)');
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
  statusB: string,
  agentCaller = callAgentCli
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
  return agentCaller(systemInstruction, prompt, 'Sub-Agent 2 (Code & Friction)');
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
  statusB: string,
  agentCaller = callAgentCli
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
  return agentCaller(systemInstruction, prompt, 'Synthesizer Sub-Agent');
}

function computeInterRunDiff(ctxA: RunContext, ctxB: RunContext): string {
  if (ctxA.patchContent && ctxB.patchContent) {
    return generateUnifiedDiff(ctxA.patchContent.trim(), ctxB.patchContent.trim(), 'Run A Patch', 'Run B Patch');
  }
  if (ctxA.patchContent || ctxB.patchContent) {
    const patchRun = ctxA.patchContent ? 'Run A' : 'Run B';
    const fileRun = ctxA.patchContent ? 'Run B' : 'Run A';
    return `Direct diff unavailable: ${patchRun} is patch-based while ${fileRun} produced standalone file output.`;
  }
  return generateUnifiedDiff(ctxA.codeOutput || '', ctxB.codeOutput || '', 'Run A Output', 'Run B Output');
}

/**
 * Runs the diagnostic agent comparison using local CLI sub-agents.
 */
export async function runComparison(
  runDirA: string,
  runDirB: string,
  agentCaller: (sys: string, prompt: string, label?: string) => Promise<string> = callAgentCli
): Promise<string> {
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
  const isBProblem = ctxB.score < ctxA.score;
  let successCtx = isAProblem ? ctxB : ctxA;
  if (!isAProblem && !isBProblem) {
    const isAGuided = parseResultPath(ctxA.dir)?.runType === 'guided';
    const isBGuided = parseResultPath(ctxB.dir)?.runType === 'guided';
    if (!isAGuided && isBGuided) {
      successCtx = ctxB;
    }
  }

  const parsedPath = parseResultPath(successCtx.dir);
  if (!parsedPath) {
    throw new Error(
      `Invalid run directory structure: cannot parse guide, task, and runType from "${successCtx.dir}". ` +
      `Expected path format ending in: <guide>/<task>/<runType>`
    );
  }
  const { guide: guideName, taskName, runType } = parsedPath;

  const guideCtx = findGuideContext(guideName, taskName);
  const diffBaseVsA = ctxA.patchContent
    ? ctxA.patchContent.trim()
    : generateUnifiedDiff(guideCtx.baseAppContent || '', ctxA.codeOutput || '', 'Base App', 'Run A Output');
  const diffBaseVsB = ctxB.patchContent
    ? ctxB.patchContent.trim()
    : generateUnifiedDiff(guideCtx.baseAppContent || '', ctxB.codeOutput || '', 'Base App', 'Run B Output');
  const diffAvsB = computeInterRunDiff(ctxA, ctxB);

  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED RUN';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED RUN';

  const suiteMatch = successCtx.dir.match(/(.*[/\\]results[/\\][^/\\]+)/);
  const suiteDir = suiteMatch ? suiteMatch[1] : successCtx.dir;

  try {
    console.log(cBold(`[Compare Agent] Phase 1: Pre-processed trajectories into tagged milestones.`));
    console.log(`  Run A: ${ctxA.preprocessed.taggedSteps.length} steps (${ctxA.preprocessed.noiseCount} noise, ${ctxA.preprocessed.errorLoopCount} retries)`);
    console.log(`  Run B: ${ctxB.preprocessed.taggedSteps.length} steps (${ctxB.preprocessed.noiseCount} noise, ${ctxB.preprocessed.errorLoopCount} retries)`);

    console.log(cBold(`[Compare Agent] Phase 2: Dispatching parallel sub-agents (Guide Compliance & Code/Friction)...`));
    const [complianceAnalysis, codeAndFrictionAnalysis] = await Promise.all([
      runSubAgent1_GuideCompliance(guideCtx, ctxA, ctxB, statusA, statusB, agentCaller),
      runSubAgent2_CodeAndFriction(guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB, statusA, statusB, agentCaller)
    ]);

    console.log(cBold(`[Compare Agent] Phase 3: Synthesizing final 4-section diagnostic report...`));
    const markdownReport = await synthesizeDiagnosis(
      guideCtx,
      ctxA,
      ctxB,
      complianceAnalysis,
      codeAndFrictionAnalysis,
      statusA,
      statusB,
      agentCaller
    );

    if (suiteMatch) {
      const diagnosesDir = path.join(suiteDir, 'variance_diagnoses');
      fs.mkdirSync(diagnosesDir, { recursive: true });
      const fileName = `${guideName}-${taskName}-${runType}.md`;
      const savedPath = path.join(diagnosesDir, fileName);
      fs.writeFileSync(savedPath, markdownReport, 'utf8');
      console.log(cGreen(`\n✅ Saved diagnostic report to: ${savedPath}`));
    }

    console.log(cBold(cCyan('--- DIAGNOSTIC REPORT ---')));
    console.log(markdownReport);
    console.log(cCyan('-------------------------'));

    return markdownReport;
  } catch (err: any) {
    console.error(cRed(`❌ Diagnosis failed: ${err.message}`));
    throw err;
  }
}
