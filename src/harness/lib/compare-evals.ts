import fs from 'node:fs';
import path from 'node:path';
import { cGreen, cRed, cCyan, cBold } from '../../core/colors.ts';
import { downloadTrialFromGcsIfMissing } from './gcs-downloader.ts';
import { baseAppsDir, guidesDir, resultsDir, suitesDir } from '../../core/paths.ts';
import { getComparisonPrompts } from './compare-prompts.ts';
import { generateUnifiedDiff, extractTargetFilesFromPatch } from '../../core/patch-utils.ts';
import {
  categorizeAction,
  ensureFreshTrajectorySummarySync,
  type CanonicalCategory,
  type TrajectorySummary
} from './trajectory-normalizer.ts';
import { parseResultPath } from './collection.ts';
import { cleanupIsolatedHome, isEnoent } from './agent-shared.ts';
import { getDefaultSolutionAgent, getGuidesMap, getTaskMap, GUIDE_FILE, EXPECTATIONS_FILE, GRADER_FILE, TASK_FILE } from '../../core/guide-validation.ts';
import { runAgent, setupGuideDevWorkDir } from './utils.ts';

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
 * Strips leading conversational narration before the first Markdown report heading.
 */
export function stripAgentNarration(rawOutput: string): string {
  if (!rawOutput) return '';
  const trimmed = rawOutput.trim();
  const primaryHeading = '### 1. First Meaningful Divergence';
  const primaryIdx = trimmed.indexOf(primaryHeading);
  if (primaryIdx !== -1) {
    return trimmed.slice(primaryIdx).trim();
  }

  const fallbackMatch = trimmed.match(/^#{1,6}\s+/m);
  if (fallbackMatch && fallbackMatch.index !== undefined) {
    return trimmed.slice(fallbackMatch.index).trim();
  }

  return trimmed;
}

export type AgentCaller = (
  systemInstruction: string,
  prompt: string,
  label?: string,
  workDir?: string,
  homeDir?: string
) => Promise<string>;

/**
 * Calls the local agent CLI (Antigravity or Jetski CLI based on repository config) inside an isolated workspace.
 */
async function callAgentCli(
  systemInstruction: string,
  prompt: string,
  label = 'Compare Agent',
  workDir?: string,
  homeDir?: string
): Promise<string> {
  const combinedPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
  const agent = getDefaultSolutionAgent();

  console.log(`[${label}] Executing via ${agent}...`);

  const rawOutput = await runAgent(agent, combinedPrompt, workDir, {
    captureOutput: true,
    homeDir: homeDir ?? (workDir ? path.dirname(workDir) : undefined)
  });
  if (!rawOutput) {
    throw new Error(`[${label}] Empty response received from ${agent}`);
  }
  return rawOutput;
}

export interface TaggedStep {
  stepNumber: number;
  category: Exclude<CanonicalCategory, 'other'>;
  thought?: string;
  actionName?: string;
  detail?: string;
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

export interface PlaywrightCheck {
  message: string;
  passed: boolean;
  errors?: string[];
  location?: { file?: string; line?: number; column?: number };
}

/** @deprecated Use PlaywrightCheck */
export type PlaywrightAssertion = PlaywrightCheck;

export interface TrialContext {
  dir: string;
  score: number;
  resultsJson: PlaywrightCheck[];
  codeOutput: string;
  patchContent?: string;
  preprocessed: PreprocessedTrajectory;
  initialPrompt: string;
}

/** @deprecated Use TrialContext */
export type RunContext = TrialContext;

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
 * Recursively parses Playwright's JSON report and extracts checks with detailed error traces and locations.
 */
function parsePlaywrightResults(report: any): PlaywrightCheck[] {
  const checks: PlaywrightCheck[] = [];
  if (!report || !Array.isArray(report.suites)) {
    return checks;
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

        checks.push({
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
  return checks;
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
      actionName,
      detail: String(actionParams?.command ?? actionParams?.path ?? '') || undefined
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

function extractTargetFileFromEvalsJson(trialDir: string): string | undefined {
  let curr = trialDir;
  const parsed = parseResultPath(trialDir);
  const guideName = parsed?.guide;
  const taskName = parsed?.taskName;

  while (curr && curr !== path.dirname(curr)) {
    const data = tryReadJson(path.join(curr, 'evals.json'));
    if (data && data.results) {
      for (const testName in data.results) {
        const trials = data.results[testName];
        if (Array.isArray(trials)) {
          for (const trial of trials) {
            const matchesGuide = !guideName || trial.guideName === guideName || trial.taskPath?.includes(guideName);
            const matchesTask = !taskName || trial.taskName === taskName;
            if (matchesGuide && matchesTask && trial.targetFile) {
              return trial.targetFile;
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
 * Loads all relevant context for a single trial including preprocessed trajectory.
 */
export function loadTrialContext(trialDir: string): TrialContext {
  let absoluteDir = path.resolve(trialDir);
  if (!fs.existsSync(absoluteDir)) {
    const stripped = trialDir.replace(/^(\.\/)?(harness\/)?results\/(suites\/)?/, '');
    const jobCandidate = path.resolve(suitesDir, stripped);
    const resultsCandidate = path.resolve(resultsDir, stripped);
    if (fs.existsSync(jobCandidate)) {
      absoluteDir = jobCandidate;
    } else if (fs.existsSync(resultsCandidate)) {
      absoluteDir = resultsCandidate;
    }
  }

  try {
    fs.statSync(absoluteDir);
  } catch (err: unknown) {
    if (isEnoent(err)) {
      throw new Error(`Trial directory not found: ${absoluteDir}`);
    }
    throw err;
  }

  const parsed = parseResultPath(absoluteDir);
  const guideName = parsed?.guide || '';

  let resultsJson: PlaywrightCheck[] = [];
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

  const trajectorySummary = ensureFreshTrajectorySummarySync(absoluteDir);
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

/** @deprecated Use loadTrialContext */
export const loadRunContext = loadTrialContext;

function computeInterTrialDiff(ctxA: TrialContext, ctxB: TrialContext): string {
  if (ctxA.patchContent && ctxB.patchContent) {
    return generateUnifiedDiff(ctxA.patchContent.trim(), ctxB.patchContent.trim(), 'Trial A Patch', 'Trial B Patch');
  }
  if (ctxA.patchContent || ctxB.patchContent) {
    const patchTrial = ctxA.patchContent ? 'Trial A' : 'Trial B';
    const fileTrial = ctxA.patchContent ? 'Trial B' : 'Trial A';
    return `Direct diff unavailable: ${patchTrial} is patch-based while ${fileTrial} produced standalone file output.`;
  }
  return generateUnifiedDiff(ctxA.codeOutput || '', ctxB.codeOutput || '', 'Trial A Output', 'Trial B Output');
}

function sanitizeLabelSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'trial';
}

function inferJobDir(trialDir: string): string | null {
  const resultsMatch = trialDir.match(/(.*[/\\]results[/\\](?:suites[/\\])?(?!suites(?:[/\\]|$))[^/\\]+)/);
  if (resultsMatch) return resultsMatch[1];

  const normalized = trialDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  // Standard eval structure: .../<job>/<trialIndex>/<guide>/<task>/<condition>
  if (segments.length >= 5 && /^\d+$/.test(segments[segments.length - 4])) {
    const prefix = normalized.startsWith('/') ? '/' : '';
    return prefix + segments.slice(0, -4).join('/');
  }
  return null;
}

function extractTrialLabel(trialDir: string, guideName: string, taskName: string, includeJob: boolean): string {
  const normalized = trialDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const jobDir = inferJobDir(trialDir);

  if (jobDir) {
    const normalizedJob = jobDir.replace(/\\/g, '/').replace(/\/+$/, '');
    const jobName = path.basename(normalizedJob);
    const remainder = normalized.startsWith(normalizedJob + '/')
      ? normalized.slice(normalizedJob.length + 1)
      : '';
    const relSegments = remainder
      .split('/')
      .filter((seg) => Boolean(seg) && seg !== guideName && seg !== taskName);
    const baseLabel = relSegments.join('-') || path.basename(normalized);
    return sanitizeLabelSegment(includeJob ? `${jobName}-${baseLabel}` : baseLabel);
  }

  const segments = normalized.split('/').filter(Boolean);
  const filtered = segments.filter((seg) => seg !== guideName && seg !== taskName);
  const tail = filtered.slice(-2).join('-') || path.basename(normalized);
  return sanitizeLabelSegment(tail);
}

/**
 * Resolves a deterministic, symmetric output file path for a variance diagnosis report.
 * Always derives the output directory from Trial A (falling back to Trial B, then resultsDir)
 * regardless of which trial scored higher, and disambiguates filenames using both trial labels.
 */
export function buildComparisonReportPath(
  dirA: string,
  dirB: string,
  guideName: string,
  taskName: string
): string {
  const jobDirA = inferJobDir(dirA);
  const jobDirB = inferJobDir(dirB);

  const baseOutputDir = jobDirA || jobDirB || resultsDir;
  const diagnosesDir = path.join(baseOutputDir, 'variance_diagnoses');

  const jobNameA = jobDirA ? path.basename(jobDirA) : '';
  const jobNameB = jobDirB ? path.basename(jobDirB) : '';
  const includeJob = Boolean((jobNameA || jobNameB) && jobNameA !== jobNameB);

  let labelA = extractTrialLabel(dirA, guideName, taskName, includeJob);
  let labelB = extractTrialLabel(dirB, guideName, taskName, includeJob);
  if (labelA === labelB) {
    labelA = `${labelA}-A`;
    labelB = `${labelB}-B`;
  }

  const fileName = `${sanitizeLabelSegment(guideName)}-${sanitizeLabelSegment(taskName)}-${labelA}-vs-${labelB}.md`;
  return path.join(diagnosesDir, fileName);
}

/**
 * Writes uncapped reference guides, expectations, graders, unified diffs, and trajectories into
 * the isolated comparison workspace so the diagnostic agent and its subagents can inspect full context.
 */
function writeComparisonWorkspaceFiles(
  workDir: string,
  guideCtx: GuideContext,
  ctxA: TrialContext,
  ctxB: TrialContext,
  diffBaseVsA: string,
  diffBaseVsB: string,
  diffAvsB: string
): void {
  fs.writeFileSync(path.join(workDir, 'guide.md'), guideCtx.guideContent, 'utf8');
  fs.writeFileSync(path.join(workDir, 'expectations.md'), guideCtx.expectationsContent, 'utf8');
  fs.writeFileSync(path.join(workDir, 'grader.ts'), guideCtx.graderContent, 'utf8');
  fs.writeFileSync(path.join(workDir, 'diff_base_vs_a.patch'), diffBaseVsA, 'utf8');
  fs.writeFileSync(path.join(workDir, 'diff_base_vs_b.patch'), diffBaseVsB, 'utf8');
  fs.writeFileSync(path.join(workDir, 'diff_a_vs_b.patch'), diffAvsB, 'utf8');
  fs.writeFileSync(path.join(workDir, 'trial_a_trajectory.json'), JSON.stringify(ctxA.preprocessed, null, 2), 'utf8');
  fs.writeFileSync(path.join(workDir, 'trial_b_trajectory.json'), JSON.stringify(ctxB.preprocessed, null, 2), 'utf8');

  const fullContextMd = `# Full Uncapped Comparison Context (${guideCtx.guideName} / ${guideCtx.taskName})

## Task Prompt
\`\`\`markdown
${guideCtx.taskPrompt}
\`\`\`

## Reference Guidance (guide.md)
\`\`\`markdown
${guideCtx.guideContent}
\`\`\`

## Expected Outcomes (expectations.md)
\`\`\`markdown
${guideCtx.expectationsContent}
\`\`\`

## Grader (grader.ts)
\`\`\`typescript
${guideCtx.graderContent}
\`\`\`

## Diff 1: Base App vs Trial A Output
\`\`\`diff
${diffBaseVsA}
\`\`\`

## Diff 2: Base App vs Trial B Output
\`\`\`diff
${diffBaseVsB}
\`\`\`

## Diff 3: Trial A Output vs Trial B Output
\`\`\`diff
${diffAvsB}
\`\`\`

## Trial A Full Tagged Trajectory Steps (Score: ${ctxA.score}%)
\`\`\`json
${JSON.stringify(ctxA.preprocessed.taggedSteps, null, 2)}
\`\`\`

## Trial B Full Tagged Trajectory Steps (Score: ${ctxB.score}%)
\`\`\`json
${JSON.stringify(ctxB.preprocessed.taggedSteps, null, 2)}
\`\`\`
`;

  fs.writeFileSync(path.join(workDir, 'comparison_context.md'), fullContextMd, 'utf8');
}

/**
 * Runs the diagnostic agent comparison in an isolated workspace using a single unified prompt.
 */
export async function runComparison(
  trialDirA: string,
  trialDirB: string,
  agentCaller: AgentCaller = callAgentCli
): Promise<string> {
  console.log(cCyan(`\n=== Starting Trial Comparison (Unified Subagent-Orchestrated Pipeline) ===`));
  console.log(`Trial A: ${trialDirA}`);
  console.log(`Trial B: ${trialDirB}\n`);

  await Promise.all([
    downloadTrialFromGcsIfMissing(trialDirA),
    downloadTrialFromGcsIfMissing(trialDirB)
  ]);

  const ctxA = loadTrialContext(trialDirA);
  const ctxB = loadTrialContext(trialDirB);

  console.log(`Comparing Trial A (Score: ${ctxA.score}%) vs Trial B (Score: ${ctxB.score}%)...`);

  const parsedPath = parseResultPath(ctxA.dir) || parseResultPath(ctxB.dir);
  if (!parsedPath) {
    throw new Error(
      `Invalid trial directory structure: cannot parse guide, task, and condition from "${ctxA.dir}". ` +
        `Expected path format ending in: <guide>/<task>/<condition>`
    );
  }
  const { guide: guideName, taskName } = parsedPath;

  const guideCtx = findGuideContext(guideName, taskName);
  const diffBaseVsA = ctxA.patchContent
    ? ctxA.patchContent.trim()
    : generateUnifiedDiff(guideCtx.baseAppContent || '', ctxA.codeOutput || '', 'Base App', 'Trial A Output');
  const diffBaseVsB = ctxB.patchContent
    ? ctxB.patchContent.trim()
    : generateUnifiedDiff(guideCtx.baseAppContent || '', ctxB.codeOutput || '', 'Base App', 'Trial B Output');
  const diffAvsB = computeInterTrialDiff(ctxA, ctxB);

  const statusA = ctxA.score > ctxB.score ? 'SUCCESSFUL' : ctxA.score < ctxB.score ? 'FAILED/POORER' : 'COMPARED TRIAL';
  const statusB = ctxB.score > ctxA.score ? 'SUCCESSFUL' : ctxB.score < ctxA.score ? 'FAILED/POORER' : 'COMPARED TRIAL';

  const { workDir, tempHome } = setupGuideDevWorkDir('compare');

  try {
    console.log(cBold(`[Compare Agent] Phase 1: Pre-processed trajectories into tagged milestones.`));
    console.log(`  Trial A: ${ctxA.preprocessed.taggedSteps.length} steps (${ctxA.preprocessed.noiseCount} noise, ${ctxA.preprocessed.errorLoopCount} retries)`);
    console.log(`  Trial B: ${ctxB.preprocessed.taggedSteps.length} steps (${ctxB.preprocessed.noiseCount} noise, ${ctxB.preprocessed.errorLoopCount} retries)`);

    writeComparisonWorkspaceFiles(workDir, guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB);

    console.log(cBold(`[Compare Agent] Phase 2: Executing unified diagnostic prompt in isolated workspace...`));
    const { systemInstruction, prompt } = getComparisonPrompts(
      guideCtx,
      ctxA,
      ctxB,
      diffBaseVsA,
      diffBaseVsB,
      diffAvsB,
      statusA,
      statusB
    );

    const rawReport = await agentCaller(systemInstruction, prompt, 'Compare Agent', workDir, tempHome);
    const markdownReport = stripAgentNarration(rawReport);

    const savedPath = buildComparisonReportPath(ctxA.dir, ctxB.dir, guideName, taskName);
    fs.mkdirSync(path.dirname(savedPath), { recursive: true });
    fs.writeFileSync(savedPath, markdownReport, 'utf8');
    console.log(cGreen(`\n✅ Saved diagnostic report to: ${savedPath}`));

    console.log(cBold(cCyan('--- DIAGNOSTIC REPORT ---')));
    console.log(markdownReport);
    console.log(cCyan('-------------------------'));

    return markdownReport;
  } catch (err: any) {
    console.error(cRed(`❌ Diagnosis failed: ${err.message}`));
    throw err;
  } finally {
    cleanupIsolatedHome(tempHome);
  }
}
