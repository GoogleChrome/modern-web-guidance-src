import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import os from 'os';
import { stripVTControlCharacters } from 'util';
import { collectGuidesUsed, collectGuidanceToolsUsed, hasTrajectoryGuideLeak } from './guide-usage.ts';
import { type JobConfig } from '../config.ts';
import { getTaskMap, resolveTaskGraderPath } from '../../core/guide-validation.ts';
import { getGraderScriptContent, isEnoent } from './agent-shared.ts';
import { rootDir } from '../../core/paths.ts';
import { extractTestTitles } from '../../core/grader-coverage.ts';
import { isSpecSkipped } from '../../grading/run-grader.ts';
import { type PageLoadResult, type TrialCheck } from './metrics.ts';
import {
  pickHigherPrecedenceEffort,
  resolveReasoningEffort,
  sanitizeReasoningEffort,
  type ReasoningEffort,
} from './reasoning-effort.ts';
import {
  ensureFreshTrajectorySummarySync,
  hasRawSessionLogs,
  NORMALIZER_VERSION,
} from './trajectory-normalizer.ts';

function isSolutionPresent(solutionFile: string, solutionPkgJson: string, solutionPatchFile?: string): boolean {
  return fs.existsSync(solutionFile) || fs.existsSync(solutionPkgJson) || (solutionPatchFile ? fs.existsSync(solutionPatchFile) : false);
}

export function extractModelFromResults(resultsDir: string): string {
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

export function extractReasoningEffortFromResults(resultsDir: string): ReasoningEffort | undefined {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  let parsedVersion: number | undefined;
  let existingEffort: ReasoningEffort | undefined;
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    parsedVersion = summary?.normalizerVersion;
    existingEffort = sanitizeReasoningEffort(summary?.reasoningEffort);
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }

  if (existingEffort && parsedVersion === NORMALIZER_VERSION) {
    return existingEffort;
  }
  const rawLogsPresent = hasRawSessionLogs(resultsDir);
  if (existingEffort && !rawLogsPresent) {
    return existingEffort;
  }
  if (rawLogsPresent) {
    const refreshed = ensureFreshTrajectorySummarySync(resultsDir);
    const refreshedEffort = sanitizeReasoningEffort(refreshed?.reasoningEffort);
    if (refreshedEffort) {
      return refreshedEffort;
    }
  }
  return existingEffort;
}

export function extractTokenUsageFromResults(resultsDir: string): { total: number; cached: number } | null {
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

export function parseResultPath(relPath: string): { guide: string; taskName: string; condition: string } | null {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  let guide: string, taskName: string, condition: string;

  if (parts.length === 2) {
    // [Legacy Fallback] Old structure: {taskName}/{condition}
    taskName = 'task';
    condition = parts[1];
    guide = parts[0].replace(/-task(-negative)?$/, '');
  } else if (parts.length >= 3) {
    [guide, taskName, condition] = parts.slice(-3);
  } else {
    return null;
  }

  return { guide, taskName, condition };
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
      entry.name === 'traces' ||
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

function getTrialIndexDirs(resultsDir: string): string[] {
  const trialIndexDirs = fs.readdirSync(resultsDir)
    .filter(name => {
      const fullPath = path.join(resultsDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (trialIndexDirs.length === 0) {
    throw new Error('No trial repetitions found!');
  }
  return trialIndexDirs;
}

function getTrialDirs(trialIndexPath: string): string[] {
  // Support both legacy (*/guided) and new (*/*/guided) structures.
  // Avoid greedy **/guided to prevent matching nested folders generated by agents.
  return [
    ...glob.sync('*/guided', { cwd: trialIndexPath, absolute: true }),
    ...glob.sync('*/*/guided', { cwd: trialIndexPath, absolute: true }),
    ...glob.sync('*/unguided', { cwd: trialIndexPath, absolute: true }),
    ...glob.sync('*/*/unguided', { cwd: trialIndexPath, absolute: true })
  ];
}

interface TrialContext {
  guide: string;
  taskName: string;
  condition: string;
  taskInfo: any;
  targetModifiedFile: string | undefined;
  targetFile: string;
  targetPkgJson: string;
  graderPath: string;
  graderResults: string;
  solutionPresent: boolean;
}

function getTrialContext(
  dir: string,
  trialIndexPath: string,
  taskMap: Map<string, any>,
  warnIfMissing = false
): TrialContext | null {
  const relPath = path.relative(trialIndexPath, dir);
  const parsed = parseResultPath(relPath);
  if (!parsed) return null;
  const { guide, taskName, condition } = parsed;
  if (condition === 'base_app') return null; // Skip the base app setup folder

  const taskInfo = taskMap.get(`${guide}/${taskName}`);
  if (!taskInfo) {
    if (warnIfMissing) {
      console.warn(`Skipping grading: Task ${guide} not found in task map`);
    }
    return null;
  }

  // run-suite pre-creates every trial dir (with run.mjs and package.json) before any agent executes.
  // In a stopped or partial job, a dir that has no runtime.json, generation_failed.json, or grader results
  // never had an agent run. Grading it would score the untouched base app.
  const graderResults = path.join(dir, `${guide}_results.json`);
  const agentRan = ['runtime.json', 'generation_failed.json'].some(f => fs.existsSync(path.join(dir, f)));
  if (!agentRan && !fs.existsSync(graderResults)) {
    if (warnIfMissing) {
      console.warn(`Skipping ${relPath}: agent never ran`);
    }
    return null;
  }

  const targetModifiedFile = extractTargetModifiedFile(dir, taskInfo.prompt);
  const targetFile = path.join(dir, targetModifiedFile || 'index.html');
  const targetPkgJson = path.join(dir, 'package.json');
  const targetPatchFile = path.join(dir, 'agent.patch');
  const graderPath = resolveTaskGraderPath(taskInfo, taskName);
  const solutionPresent = isSolutionPresent(targetFile, targetPkgJson, targetPatchFile);

  return {
    guide,
    taskName,
    condition,
    taskInfo,
    targetModifiedFile,
    targetFile,
    targetPkgJson,
    graderPath,
    graderResults,
    solutionPresent,
  };
}

function getTrialDirsForRepetitions(resultsDir: string, trialIndexDirs: string[]): { dir: string; trialIndexPath: string; trialIndexDir: string }[] {
  const items: { dir: string; trialIndexPath: string; trialIndexDir: string }[] = [];
  for (const trialIndexDir of trialIndexDirs) {
    const trialIndexPath = path.join(resultsDir, trialIndexDir);
    for (const dir of getTrialDirs(trialIndexPath)) {
      items.push({ dir, trialIndexPath, trialIndexDir });
    }
  }
  return items;
}

function setupGraderForTrial(
  dir: string,
  trialIndexPath: string,
  resultsDir: string,
  taskMap: Map<string, any>
): string | null {
  const ctx = getTrialContext(dir, trialIndexPath, taskMap);
  if (!ctx) return null;

  const failureFile = path.join(dir, 'generation_failed.json');
  if (!fs.existsSync(ctx.graderPath) || fs.existsSync(failureFile) || !ctx.solutionPresent || fs.existsSync(ctx.graderResults)) {
    return null;
  }

  const gradeScript = getGraderScriptContent(dir, ctx.graderPath, ctx.guide, ctx.taskInfo.baselineTarget);
  const relativeId = path.relative(resultsDir, dir); // e.g. "1/guideName/guided"
  fs.writeFileSync(path.join(dir, 'grade.mjs'), gradeScript);

  let pkgJsonObj: any = {
    name: `${ctx.guide.substring(0, 30)}-${ctx.condition}-grader`,
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
  pkgJsonObj.scripts["run-grader"] = `node grade.mjs --id ${relativeId}`;
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
      name: "evaluation-job-workspace",
      private: true
    }, null, 2));
    wroteRootPkgJson = true;
  }

  const pnpmWorkspacePath = path.join(resultsDir, 'pnpm-workspace.yaml');
  // List only the trials prepared above. A '**' glob would also re-run every trial that was graded before
  // (their run-grader scripts linger), using whatever checkout their grade.mjs points at.
  fs.writeFileSync(pnpmWorkspacePath, ['packages:', ...pnpmWorkspacePackages.map(pkg => `  - '${pkg}'`)].join('\n') + '\n');

  try {
    console.log(`\n>>> Bootstrapping dependencies inside results workspace with pnpm install...`);
    spawnSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: resultsDir, stdio: 'inherit', shell: process.platform === 'win32' });

    console.log(`\n>>> Discovered ${pnpmWorkspacePackages.length} un-graded trials. Running parallel grading with pnpm -r run-grader...`);
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

async function collectGuideUsage(dir: string, condition: string, guideName: string) {
  let guidesUsedResult: string[] = [];
  let retrievedGuides: string[] = [];
  let fileReadGuides: string[] = [];
  let guidanceToolsUsedResult: string[] = [];

  if (condition === 'guided') {
    const usage = await collectGuidesUsed(dir);
    retrievedGuides = usage.retrievedGuides;
    fileReadGuides = usage.fileReadGuides;
    guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides])];
    guidanceToolsUsedResult = await collectGuidanceToolsUsed(dir);
  } else if (condition === 'unguided' && hasTrajectoryGuideLeak(dir, guideName)) {
    const usage = await collectGuidesUsed(dir);
    retrievedGuides = usage.retrievedGuides;
    fileReadGuides = usage.fileReadGuides;
    guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides, guideName])];
    const tools = await collectGuidanceToolsUsed(dir);
    guidanceToolsUsedResult = [...new Set([...tools, 'modern-web-guidance'])];
  }

  return { guidesUsedResult, retrievedGuides, fileReadGuides, guidanceToolsUsedResult };
}

export function evaluateTrialChecks(
  dir: string,
  guide: string,
  graderPath: string,
  graderResults: string,
  solutionPresent: boolean,
  _targetFile?: string
): TrialCheck[] {
  const makeInfraError = (reason: string): TrialCheck[] => [{
    id: 'early-failure-1',
    passed: false,
    message: reason,
    isEarlyFailure: true,
  }];

  const makeAgentFailures = (reason: string): TrialCheck[] => {
    const titles = extractTestTitles(graderPath);
    if (titles.length === 0) {
      return [{
        id: 'agent-failure-1',
        passed: false,
        message: reason,
        failureReason: reason,
      }];
    }
    return titles.map((title, idx) => ({
      id: `agent-failure-${idx + 1}`,
      passed: false,
      message: title,
      failureReason: reason,
    }));
  };

  if (!fs.existsSync(graderPath)) {
    console.warn(`Grader not found for ${guide} at ${graderPath}`);
    return makeInfraError('Grader not found');
  }
  const failureFile = path.join(dir, 'generation_failed.json');
  try {
    const failureInfo = JSON.parse(fs.readFileSync(failureFile, 'utf-8'));
    return makeInfraError(`Generation failed: ${failureInfo.agentName} exited with ${failureInfo.exitCode}`);
  } catch (err) {
    if (!isEnoent(err)) {
      return makeInfraError('Generation failed (could not parse failure info)');
    }
  }
  if (!solutionPresent) {
    return makeAgentFailures('Target app missing');
  }

  try {
    const json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));

    if (Array.isArray(json?.suites) && json.suites.length > 0) {
      const specs: any[] = [];
      const traverse = (suite: any) => {
        if (suite.specs) specs.push(...suite.specs);
        if (suite.suites) suite.suites.forEach(traverse);
      };
      json.suites.forEach(traverse);

      if (specs.length > 0) {
        const trialChecks: TrialCheck[] = [];
        for (const spec of specs) {
          if (isSpecSkipped(spec)) {
            continue;
          }
          const lastResult = spec.tests?.[0]?.results?.at(-1);
          if (lastResult?.status === 'passed') {
            trialChecks.push({ id: spec.id, passed: true, message: spec.title });
            continue;
          }

          // Strip ANSI colors and local paths (repo root, temp grading dir, agent homes, home) so diagnostics are portable and shareable.
          const clean = sanitizeDiagnosticText;
          // A timeout reports "Test timeout exceeded" first (no location) and the action that was cut off second.
          const errors: { message?: string; location?: { file: string; line: number } }[] = lastResult?.errors ?? [];
          const rawError = errors.map(e => e.message).filter(Boolean).join('\n\n');
          const errorMsg = rawError ? clean(rawError) : undefined;

          const loc = lastResult?.errorLocation ?? errors.find(e => e.location)?.location;
          const errorLocation = loc ? `${path.relative(rootDir, loc.file)}:${loc.line}` : undefined;

          const snapshotAtt = lastResult?.attachments?.find((a: any) => a.name === 'page-snapshot');
          const pageSnapshot = snapshotAtt?.body ? Buffer.from(snapshotAtt.body, 'base64').toString('utf8') : undefined;

          const browserErrorsAtt = lastResult?.attachments?.find((a: any) => a.name === 'browser-errors');
          const browserErrors = browserErrorsAtt?.body ? clean(Buffer.from(browserErrorsAtt.body, 'base64').toString('utf8')) : undefined;

          trialChecks.push({
            id: spec.id,
            passed: false,
            message: spec.title,
            ...(errorMsg ? { error: errorMsg } : {}),
            ...(errorLocation ? { errorLocation } : {}),
            ...(pageSnapshot ? { pageSnapshot } : {}),
            ...(browserErrors ? { browserErrors } : {}),
          });
        }
        return trialChecks;
      }
    }

    return makeAgentFailures('Playwright test runner failed or produced no test results');
  } catch (err: any) {
    if (isEnoent(err)) {
      return makeAgentFailures('Playwright test runner failed to produce a results file');
    }
    console.error(`Error processing results for ${dir}:`, err);
    return makeAgentFailures(err.message || 'System Error');
  }
}

export function sanitizeDiagnosticText(text: string): string {
  return stripVTControlCharacters(String(text))
    .replaceAll(`file://${rootDir}${path.sep}`, '')
    .replaceAll(`file://${rootDir}`, '')
    .replaceAll(rootDir + path.sep, '')
    .replace(/file:\/\/\/tmp\/(?:grade-run|ghh)-[^/]+\//g, '')
    .replace(/\/tmp\/(?:grade-run|ghh)-[^/]+\//g, '')
    .replaceAll(`file://${os.homedir()}`, '~')
    .replaceAll(os.homedir(), '~')
    .trim();
}

function extractPageLoadFromResults(graderResults: string): PageLoadResult | undefined {
  if (!fs.existsSync(graderResults)) return undefined;
  try {
    const json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));
    const raw = json?.pageLoad;
    if (raw && typeof raw === 'object' && typeof raw.ok === 'boolean' && Array.isArray(raw.errors)) {
      if (raw.noPage) return undefined;
      return {
        ok: raw.ok,
        errors: raw.errors.map((e: unknown) => sanitizeDiagnosticText(String(e))),
        ...(typeof raw.buildWarning === 'string' && raw.buildWarning
          ? { buildWarning: sanitizeDiagnosticText(raw.buildWarning) }
          : {}),
      };
    }
  } catch {
    // ignore malformed or unreadable results file
  }
  return undefined;
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

function prepareGradersForTrials(
  resultsDir: string,
  trialIndexDirs: string[],
  taskMap: Map<string, any>
): string[] {
  const pnpmWorkspacePackages: string[] = [];
  for (const { dir, trialIndexPath } of getTrialDirsForRepetitions(resultsDir, trialIndexDirs)) {
    const pkgId = setupGraderForTrial(dir, trialIndexPath, resultsDir, taskMap);
    if (pkgId) {
      pnpmWorkspacePackages.push(pkgId);
    }
  }
  return pnpmWorkspacePackages;
}

async function collectTrialEntry(
  dir: string,
  ctx: TrialContext,
  trialIndex: number
): Promise<{ resultKey: string; payload: any }> {
  const usage = await collectGuideUsage(dir, ctx.condition, ctx.guide);

  const taskCategory = path.basename(path.dirname(ctx.taskInfo.guideDir));
  const expectedToolPrefixes = ['modern-web'];

  const trialResults = evaluateTrialChecks(
    dir,
    ctx.guide,
    ctx.graderPath,
    ctx.graderResults,
    ctx.solutionPresent,
    ctx.targetFile
  );

  const resultKey = `${ctx.taskName} - ${ctx.guide} - ${ctx.condition}`;
  const tokenUsage = extractTokenUsageFromResults(dir);
  const runtimeData = readRuntimeData(dir);
  const pageLoad = extractPageLoadFromResults(ctx.graderResults);

  const payload = {
    runNumber: trialIndex,
    results: trialResults,
    guidesUsed: usage.guidesUsedResult,
    retrievedGuides: usage.retrievedGuides,
    fileReadGuides: usage.fileReadGuides,
    guidanceToolsUsed: usage.guidanceToolsUsedResult,
    discipline: taskCategory,
    expectedToolPrefixes,
    guideName: ctx.guide,
    baseApp: ctx.taskInfo.baseApp,
    taskName: ctx.taskName,
    prompt: ctx.taskInfo.prompt,
    targetFile: ctx.targetModifiedFile,
    files: fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory()),
    runtime: runtimeData,
    tokenUsage,
    ...(pageLoad ? { pageLoad } : {}),
  };

  return { resultKey, payload };
}

async function collectAllResults(
  resultsDir: string,
  trialIndexDirs: string[],
  taskMap: Map<string, any>
): Promise<{
  allResults: Record<string, any[]>;
  model: string;
  reasoningEffort?: ReasoningEffort;
  hasAnySummary: boolean;
}> {
  const allResults: Record<string, any[]> = {};
  let model = 'unknown';
  let bestEffort: ReasoningEffort | undefined;
  let hasAnySummary = false;

  for (const { dir, trialIndexPath, trialIndexDir } of getTrialDirsForRepetitions(resultsDir, trialIndexDirs)) {
    // Skip never-executed dirs before touching their trajectory summaries or job-level metadata.
    const ctx = getTrialContext(dir, trialIndexPath, taskMap, true);
    if (!ctx) continue;

    // Runs first: it may regenerate a stale trajectory_summary.json that collectTrialEntry reads.
    const extractedEffort = extractReasoningEffortFromResults(dir);
    if (extractedEffort) {
      bestEffort = pickHigherPrecedenceEffort(bestEffort, extractedEffort);
      hasAnySummary = true;
    } else if (!hasAnySummary && fs.existsSync(path.join(dir, 'trajectory_summary.json'))) {
      hasAnySummary = true;
    }

    if (model === 'unknown') {
      const extracted = extractModelFromResults(dir);
      if (extracted !== 'unknown') {
        model = extracted;
      }
    }

    const entry = await collectTrialEntry(dir, ctx, parseInt(trialIndexDir));

    if (!allResults[entry.resultKey]) {
      allResults[entry.resultKey] = [];
    }
    allResults[entry.resultKey].push(entry.payload);
  }

  return { allResults, model, reasoningEffort: bestEffort, hasAnySummary };
}

export async function collectResults(resultsDir: string, jobConfig?: JobConfig) {
  const taskMap = getTaskMap();
  const trialIndexDirs = getTrialIndexDirs(resultsDir);

  const graderPackages = prepareGradersForTrials(resultsDir, trialIndexDirs, taskMap);
  await executeParallelGrading(resultsDir, graderPackages);
  const { allResults, model, reasoningEffort: trialEffort, hasAnySummary } = await collectAllResults(
    resultsDir,
    trialIndexDirs,
    taskMap,
  );

  const reasoningEffort =
    trialEffort && trialEffort.source !== 'agent-default'
      ? trialEffort
      : resolveReasoningEffort({
          agent: jobConfig?.agent,
          model,
          fallback: trialEffort,
          ...(hasAnySummary ? { env: {} } : {}),
        });

  const estimatedRuntime = estimateTotalRuntime(resultsDir);

  return {
    allResults,
    trialsPerCondition: trialIndexDirs.length,
    model,
    reasoningEffort,
    totalRuntime: estimatedRuntime,
  };
}

