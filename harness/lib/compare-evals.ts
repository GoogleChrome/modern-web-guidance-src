import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';

import config from '../config.ts';
import { cGreen, cRed, cCyan, cBold } from '../../lib/colors.ts';
import { downloadRunFromGcsIfMissing } from './gcs-downloader.ts';
import { rootDir, baseAppsDir } from '../../lib/paths.ts';
import { parseJsonlFile } from './agent-shared.ts';
import { extractInitialPromptFromLogs } from './trajectory-parser.ts';
import { getCompliancePrompts, getCodeAndFrictionPrompts, getSynthesizerPrompts } from './compare-prompts.ts';

/**
 * Calls the local agent CLI (Jetski or Gemini CLI based on GD_DEV_USE_JETSKI) to generate diagnostic text.
 */
async function callAgentCli(systemInstruction: string, prompt: string, label: string = 'Compare Agent'): Promise<string> {
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
      stdio: ['ignore', 'pipe', 'pipe'],
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
            const debugDir = path.resolve('./harness/results/compare_work');
            if (!fs.existsSync(debugDir)) {
              fs.mkdirSync(debugDir, { recursive: true });
            }
            const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            fs.writeFileSync(path.join(debugDir, `response_debug_${slug}.txt`), cleanOutput, 'utf8');
          } catch {}

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
  raw: any;
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

export interface RunContext {
  dir: string;
  runNumber: number;
  score: number;
  resultsJson: any;
  trajectorySummary: any;
  chatLog: string;
  codeOutput: string;
  codePath: string;
  preprocessed: PreprocessedTrajectory;
  initialPrompt: string;
}

/**
 * Helper to find guide.md, expectations.md, task.md, grader.ts, and base app content for a given guide/task name.
 */
function findGuideContext(guideName: string, taskName: string): GuideContext {
  const guidesBaseDir = path.join(rootDir, 'guides');
  let guideContent = '';
  let expectationsContent = '';
  let taskPrompt = '';
  let graderContent = '';
  let baseAppContent = '';
  let guideDir = '';

  if (fs.existsSync(guidesBaseDir)) {
    // 1. Search for guide directory
    const items = fs.readdirSync(guidesBaseDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const direct = path.join(guidesBaseDir, guideName);
        if (fs.existsSync(direct)) {
          guideDir = direct;
          break;
        }
        const nested = path.join(guidesBaseDir, item.name, guideName);
        if (fs.existsSync(nested)) {
          guideDir = nested;
          break;
        }
      }
    }

    if (guideDir) {
      const guidePath = path.join(guideDir, 'guide.md');
      if (fs.existsSync(guidePath)) {
        guideContent = fs.readFileSync(guidePath, 'utf8');
      }

      // Expectations
      const expPath = path.join(guideDir, 'expectations.md');
      if (fs.existsSync(expPath)) {
        expectationsContent = fs.readFileSync(expPath, 'utf8');
      }

      // Grader
      const graderPath = path.join(guideDir, 'grader.ts');
      if (fs.existsSync(graderPath)) {
        graderContent = fs.readFileSync(graderPath, 'utf8');
      }

      // Task prompt
      const taskPath1 = path.join(guideDir, 'tasks', `${taskName}.md`);
      const taskPath2 = path.join(guideDir, 'tasks', 'task.md');
      const taskPath3 = path.join(guideDir, 'task.md');
      let foundTaskPath = '';
      if (fs.existsSync(taskPath1)) {
        foundTaskPath = taskPath1;
      } else if (fs.existsSync(taskPath2)) {
        foundTaskPath = taskPath2;
      } else if (fs.existsSync(taskPath3)) {
        foundTaskPath = taskPath3;
      }

      if (foundTaskPath) {
        taskPrompt = fs.readFileSync(foundTaskPath, 'utf8');
        const baseAppMatch = taskPrompt.match(/base_app:\s*([^\s\r\n]+)/i);
        if (baseAppMatch) {
          const baseAppName = baseAppMatch[1].trim();
          const baseAppDir = path.join(baseAppsDir, baseAppName);
          if (fs.existsSync(baseAppDir)) {
            const baseCode = findCodeOutput(baseAppDir);
            baseAppContent = baseCode.content;
          }
        }
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
 * Helper to find the main generated code file in a run directory.
 */
function findCodeOutput(dir: string, targetFileFromEvals?: string): { path: string; content: string } {
  if (targetFileFromEvals) {
    const fullPath = path.join(dir, targetFileFromEvals);
    if (fs.existsSync(fullPath)) {
      return {
        path: targetFileFromEvals,
        content: fs.readFileSync(fullPath, 'utf8')
      };
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

  for (const c of candidates) {
    const fullPath = path.join(dir, c);
    if (fs.existsSync(fullPath)) {
      return {
        path: c,
        content: fs.readFileSync(fullPath, 'utf8')
      };
    }
  }
  return { path: 'unknown', content: '' };
}

/**
 * Recursively parses Playwright's JSON report and extracts assertions with detailed error traces and locations.
 */
function parsePlaywrightResults(report: any): { message: string; passed: boolean; errors?: string[]; location?: { file?: string; line?: number; column?: number } }[] {
  const assertions: { message: string; passed: boolean; errors?: string[]; location?: { file?: string; line?: number; column?: number } }[] = [];
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
                  const cleanMsg = res.error.message.replace(/\u001b\[[0-9;]*m/g, '');
                  if (!errors.includes(cleanMsg)) errors.push(cleanMsg);
                }
                if (Array.isArray(res.errors)) {
                  for (const err of res.errors) {
                    if (err.message) {
                      const cleanMsg = err.message.replace(/\u001b\[[0-9;]*m/g, '');
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
 * Phase 1 Pre-Processor: Categorizes trajectory steps into 5 milestone/noise types and computes metrics.
 */
function preprocessTrajectory(trajectorySummary: any, _chatLog: string, targetFileFromEvals?: string): PreprocessedTrajectory {
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
    const actionName = (rawStep.action?.name || rawStep.action?.type || '').toLowerCase();
    const actionParamsStr = JSON.stringify(rawStep.action?.params || rawStep.action || {}).toLowerCase();
    const isErr = rawStep.outcome?.status === 'error';

    if (isErr) {
      consecutiveErrors++;
      if (consecutiveErrors >= 2) {
        errorLoopCount++;
      }
    } else {
      consecutiveErrors = 0;
    }

    let category: TaggedStep['category'] = 'incidental_noise';
    if (rawStep.action?.canonicalCategory && rawStep.action.canonicalCategory !== 'other') {
      category = rawStep.action.canonicalCategory as TaggedStep['category'];
    }

    // 1. Guide Retrieval
    if (category === 'guide_retrieval' || actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
      category = 'guide_retrieval';
      const paramsObj = rawStep.action?.params || rawStep.action || {};
      let guideId = paramsObj.id || paramsObj.guideId;
      if (!guideId && typeof paramsObj.command === 'string' && paramsObj.command.includes('retrieve')) {
        guideId = paramsObj.query;
      }
      if (!guideId && typeof paramsObj.query === 'string' && actionParamsStr.includes('retrieve')) {
        guideId = paramsObj.query;
      }
      if (!guideId && typeof paramsObj.command === 'string') {
        const match = paramsObj.command.match(/retrieve\s+\\?["']([^"'\\]+)/i) || paramsObj.command.match(/retrieve\s+([^"'\s]+)/i);
        if (match) guideId = match[1];
      }
      if (!guideId) {
        const match = actionParamsStr.match(/id["\s:]+\\?["']?([^"'\\}]+)/i) || actionParamsStr.match(/retrieve\s+\\?["']([^"'\\]+)/i) || actionParamsStr.match(/retrieve\s+([^"'\s}]+)/i);
        if (match) guideId = match[1];
      }
      if (guideId) {
        retrievedGuideIds.push(String(guideId).trim());
      }
    }
    // 2. Skill Search
    else if (category === 'skill_search' || actionName.includes('search') || actionParamsStr.includes('search')) {
      category = 'skill_search';
      const paramsObj = rawStep.action?.params || rawStep.action || {};
      let query = paramsObj.query;
      if (!query && typeof paramsObj.command === 'string') {
        const match = paramsObj.command.match(/search\s+\\?["']([^"'\\]+)/i) || paramsObj.command.match(/search\s+([^"'\s]+)/i);
        if (match) query = match[1];
      }
      if (!query) {
        const match = actionParamsStr.match(/query["\s:]+\\?["']?([^"'\\}]+)/i) || actionParamsStr.match(/search\s+\\?["']([^"'\\]+)/i);
        if (match) query = match[1];
      }
      if (query) {
        searchQueries.push(String(query).trim());
      }
    }
    // 3. Code Mutation
    else if (
      category === 'code_mutation' ||
      actionName.includes('write') || actionName.includes('replace') || actionName.includes('touch') ||
      actionParamsStr.includes('write_to_file') || actionParamsStr.includes('replace_file_content') ||
      (targetFileFromEvals ? actionParamsStr.includes(path.basename(targetFileFromEvals).toLowerCase()) : (actionParamsStr.includes('index.html') || actionParamsStr.includes('app.jsx') || actionParamsStr.includes('style.css')))
    ) {
      category = 'code_mutation';
      codeMutationCount++;
    }
    // 4. Mandatory Rule Thought / Adoption
    else if (
      category === 'mandatory_rule_thought' ||
      thought.toLowerCase().includes('mandatory') || thought.toLowerCase().includes('fallback') ||
      thought.toLowerCase().includes('css') || thought.toLowerCase().includes('baseline') ||
      thought.toLowerCase().includes('guidance')
    ) {
      category = 'mandatory_rule_thought';
      mandatoryRulesAdopted.push(thought.slice(0, 120));
    }
    // 5. Incidental Noise (view_file, ls, list_dir, grep)
    else {
      category = 'incidental_noise';
      noiseCount++;
    }

    taggedSteps.push({
      stepNumber,
      category,
      thought,
      actionName: rawStep.action?.name,
      actionDetails: actionParamsStr.slice(0, 200),
      isError: isErr,
      raw: rawStep
    });
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
    const evalsPath = path.join(curr, 'evals.json');
    if (fs.existsSync(evalsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
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
      } catch (e) {}
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
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Run directory not found: ${absoluteDir}`);
  }

  const pathSegments = absoluteDir.split(/[/\\]/);
  const runNumberMatch = absoluteDir.match(/[/\\](\d+)[/\\]/);
  const runNumber = runNumberMatch ? parseInt(runNumberMatch[1]) : 0;
  const guideName = pathSegments[pathSegments.length - 3] || '';

  let resultsPath = path.join(absoluteDir, `${guideName}_results.json`);
  if (!fs.existsSync(resultsPath) && fs.existsSync(absoluteDir)) {
    const fallbackResultsFile = fs.readdirSync(absoluteDir).find(f => f.endsWith('_results.json'));
    if (fallbackResultsFile) {
      resultsPath = path.join(absoluteDir, fallbackResultsFile);
    }
  }

  let resultsJson: any = null;
  let score = 0;
  if (fs.existsSync(resultsPath)) {
    try {
      const rawReport = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      resultsJson = parsePlaywrightResults(rawReport);
      const passed = resultsJson.filter((c: any) => c.passed).length;
      score = resultsJson.length > 0 ? Math.round((passed / resultsJson.length) * 100) : 0;
    } catch (e) {
      console.warn(`Warning: Failed to parse results JSON in ${absoluteDir}`);
    }
  }

  let trajectorySummary: any = null;
  const trajPath = path.join(absoluteDir, 'trajectory_summary.json');
  if (fs.existsSync(trajPath)) {
    try {
      trajectorySummary = JSON.parse(fs.readFileSync(trajPath, 'utf8'));
    } catch (e) {
      console.warn(`Warning: Failed to parse trajectory summary in ${absoluteDir}`);
    }
  }

  let chatLog = '';
  const chatLogPath = path.join(absoluteDir, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    chatLog = fs.readFileSync(chatLogPath, 'utf8');
  }

  const targetFileFromEvals = extractTargetFileFromEvalsJson(absoluteDir);
  const code = findCodeOutput(absoluteDir, targetFileFromEvals);
  const preprocessed = preprocessTrajectory(trajectorySummary, chatLog, targetFileFromEvals);

  const allSessionFiles = fs.existsSync(absoluteDir) ? fs.readdirSync(absoluteDir).filter(f => f.startsWith('session-') && (f.endsWith('.json') || f.endsWith('.jsonl'))) : [];
  const sessionFiles = allSessionFiles.sort((a, b) => {
    const aSub = a.includes('-subagents-');
    const bSub = b.includes('-subagents-');
    if (aSub && !bSub) return 1;
    if (!aSub && bSub) return -1;
    return a.localeCompare(b);
  });
  const sessionPath = sessionFiles[0] ? path.join(absoluteDir, sessionFiles[0]) : '';
  let logData: any[] = [];
  if (sessionPath && fs.existsSync(sessionPath)) {
    try {
      logData = sessionPath.endsWith('.jsonl') ? parseJsonlFile(sessionPath) : JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {}
  }
  const initialPrompt = trajectorySummary?.initialPrompt || extractInitialPromptFromLogs(logData, chatLog) || 'Initial prompt not found in logs.';

  return {
    dir: absoluteDir,
    runNumber,
    score,
    resultsJson,
    trajectorySummary,
    chatLog,
    codeOutput: code.content,
    codePath: code.path,
    preprocessed,
    initialPrompt
  };
}

/**
 * Generates an aligned LCS unified diff of two strings for accurate LLM context.
 */
function generateUnifiedDiff(oldText: string, newText: string, oldLabel = 'Old', newLabel = 'New', contextLines = 3): string {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const m = oldLines.length;
  const n = newLines.length;
  
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  interface EditOp {
    type: 'equal' | 'add' | 'remove';
    oldIndex?: number;
    newIndex?: number;
    line: string;
  }
  const ops: EditOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'equal', oldIndex: i, newIndex: j, line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', newIndex: j, line: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      ops.push({ type: 'remove', oldIndex: i, line: oldLines[i - 1] });
      i--;
    }
  }
  ops.reverse();

  if (ops.every(op => op.type === 'equal')) {
    return 'No differences detected.';
  }

  const hunks: {
    oldStart: number;
    oldLinesCount: number;
    newStart: number;
    newLinesCount: number;
    lines: string[];
  }[] = [];

  let opIndex = 0;
  while (opIndex < ops.length) {
    while (opIndex < ops.length && ops[opIndex].type === 'equal') {
      opIndex++;
    }
    if (opIndex >= ops.length) break;

    const hunkStart = Math.max(0, opIndex - contextLines);
    let hunkEnd = opIndex;

    while (hunkEnd < ops.length) {
      if (ops[hunkEnd].type !== 'equal') {
        hunkEnd++;
      } else {
        let nextChange = hunkEnd;
        while (nextChange < ops.length && ops[nextChange].type === 'equal' && (nextChange - hunkEnd) < 2 * contextLines) {
          nextChange++;
        }
        if (nextChange < ops.length && ops[nextChange].type !== 'equal') {
          hunkEnd = nextChange;
        } else {
          break;
        }
      }
    }

    const actualEnd = Math.min(ops.length - 1, hunkEnd + contextLines - 1);
    const hunkOps = ops.slice(hunkStart, actualEnd + 1);
    const oldStarts = hunkOps.filter(op => op.oldIndex !== undefined).map(op => op.oldIndex!);
    const newStarts = hunkOps.filter(op => op.newIndex !== undefined).map(op => op.newIndex!);
    
    const oldStart = oldStarts.length > 0 ? oldStarts[0] : (hunkStart > 0 && ops[hunkStart - 1].oldIndex ? ops[hunkStart - 1].oldIndex! + 1 : 1);
    const newStart = newStarts.length > 0 ? newStarts[0] : (hunkStart > 0 && ops[hunkStart - 1].newIndex ? ops[hunkStart - 1].newIndex! + 1 : 1);
    const oldLinesCount = hunkOps.filter(op => op.type === 'equal' || op.type === 'remove').length;
    const newLinesCount = hunkOps.filter(op => op.type === 'equal' || op.type === 'add').length;

    const lines = hunkOps.map(op => {
      if (op.type === 'equal') return `  ${op.line}`;
      if (op.type === 'remove') return `- ${op.line}`;
      return `+ ${op.line}`;
    });

    hunks.push({ oldStart, oldLinesCount, newStart, newLinesCount, lines });
    opIndex = actualEnd + 1;
  }

  let result = `--- ${oldLabel}\n+++ ${newLabel}\n`;
  for (const hunk of hunks) {
    result += `@@ -${hunk.oldStart},${hunk.oldLinesCount} +${hunk.newStart},${hunk.newLinesCount} @@\n`;
    result += hunk.lines.join('\n') + '\n';
  }
  return result.trim();
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
  const { systemInstruction, prompt } = getCodeAndFrictionPrompts(guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB, statusA, statusB);
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
  const { systemInstruction, prompt } = getSynthesizerPrompts(guideCtx, ctxA, ctxB, complianceAnalysis, codeAndFrictionAnalysis, statusA, statusB);
  return callAgentCli(systemInstruction, prompt, 'Synthesizer Sub-Agent');
}

/**
 * Runs the diagnostic agent comparison using local CLI sub-agents.
 */
export async function runComparison(runDirA: string, runDirB: string): Promise<string> {
  console.log(cCyan(`\n=== Starting Run Comparison (Guide-Grounded 3-Phase Pipeline) ===`));
  console.log(`Run A: ${runDirA}`);
  console.log(`Run B: ${runDirB}\n`);

  await downloadRunFromGcsIfMissing(runDirA);
  await downloadRunFromGcsIfMissing(runDirB);

  const ctxA = loadRunContext(runDirA);
  const ctxB = loadRunContext(runDirB);

  const isAProblem = ctxA.score < ctxB.score;
  const successCtx = isAProblem ? ctxB : ctxA;

  console.log(`Comparing Run A (Score: ${ctxA.score}%) vs Run B (Score: ${ctxB.score}%)...`);

  const pathSegments = successCtx.dir.split(/[/\\]/);
  const runType = pathSegments.pop() || 'guided';
  const taskName = pathSegments.pop() || 'task';
  const guideName = pathSegments.pop() || 'guide';

  const guideCtx = findGuideContext(guideName, taskName);
  const diffBaseVsA = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxA.codeOutput || '', 'Base App', 'Run A Output');
  const diffBaseVsB = generateUnifiedDiff(guideCtx.baseAppContent || '', ctxB.codeOutput || '', 'Base App', 'Run B Output');
  const diffAvsB = generateUnifiedDiff(ctxA.codeOutput || '', ctxB.codeOutput || '', 'Run A Output', 'Run B Output');

  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED RUN';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED RUN';

  const suiteMatch = successCtx.dir.match(/(.*[/\\]results[/\\][^/\\]+)/);
  const suiteDir = suiteMatch ? suiteMatch[1] : successCtx.dir;
  const workDir = path.join(suiteDir, 'compare_work');
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

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

    let savedPath = '';
    if (suiteMatch) {
      const diagnosesDir = path.join(suiteDir, 'variance_diagnoses');
      if (!fs.existsSync(diagnosesDir)) {
        fs.mkdirSync(diagnosesDir, { recursive: true });
      }
      
      const fileName = `${guideName}-${taskName}-${runType}.md`;
      savedPath = path.join(diagnosesDir, fileName);
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
