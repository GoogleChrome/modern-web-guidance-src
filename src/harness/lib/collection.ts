import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import os from 'os';
import { stripVTControlCharacters } from 'util';
import { collectGuidesUsed, collectGuidanceToolsUsed, hasTrajectoryGuideLeak } from './guide-usage.ts';
import { type SuiteConfig } from '../config.ts';
import { getTaskMap, resolveTaskGraderPath } from '../../core/guide-validation.ts';
import { createIsolatedHome, cleanupIsolatedHome, getGraderScriptContent, isEnoent } from './agent-shared.ts';
import { baseAppsDir, ensureDiskNodeCompileCache, rootDir } from '../../core/paths.ts';
import { applyPatchSync } from '../../core/patch-utils.ts';
import { extractTestTitles } from '../../core/grader-coverage.ts';
import { isSpecSkipped } from '../../grading/run-grader.ts';
import { type PageLoadResult, type ScenarioCheck } from './metrics.ts';

function isTargetAppPresent(targetFile: string, targetPkgJson: string, targetPatchFile?: string): boolean {
  return fs.existsSync(targetFile) || fs.existsSync(targetPkgJson) || (targetPatchFile ? fs.existsSync(targetPatchFile) : false);
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

export function parseResultPath(relPath: string): { guide: string, taskName: string, runType: string } | null {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  let guide: string, taskName: string, runType: string;
  
  if (parts.length === 2) {
    // [Legacy Fallback] Old structure: {taskName}/{runType}
    taskName = 'task';
    runType = parts[1];
    guide = parts[0].replace(/-task(-negative)?$/, '');
  } else if (parts.length >= 3) {
    [guide, taskName, runType] = parts.slice(-3);
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
  const graderPath = resolveTaskGraderPath(taskInfo, taskName);
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
  if (!fs.existsSync(ctx.graderPath) || fs.existsSync(failureFile) || !ctx.targetAppExists || fs.existsSync(ctx.graderResults)) {
    return null;
  }

  const gradeScript = getGraderScriptContent(dir, ctx.graderPath, ctx.guide, ctx.taskInfo.baselineTarget);
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
      name: "evaluation-suite-workspace",
      private: true
    }, null, 2));
    wroteRootPkgJson = true;
  }

  const pnpmWorkspacePath = path.join(resultsDir, 'pnpm-workspace.yaml');
  // List only the tasks prepared above. A '**' glob would also re-run every task that was graded before
  // (their run-grader scripts linger), using whatever checkout their grade.mjs points at.
  fs.writeFileSync(pnpmWorkspacePath, ['packages:', ...pnpmWorkspacePackages.map(pkg => `  - '${pkg}'`)].join('\n') + '\n');

  try {
    const childEnv = { ...process.env, NODE_COMPILE_CACHE: ensureDiskNodeCompileCache(process.env, 'harness') };
    console.log(`\n>>> Bootstrapping dependencies inside results workspace with pnpm install...`);
    spawnSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: resultsDir, env: childEnv, stdio: 'inherit', shell: process.platform === 'win32' });

    console.log(`\n>>> Discovered ${pnpmWorkspacePackages.length} un-graded tasks. Running parallel grading with pnpm -r run-grader...`);
    spawnSync('pnpm', ['-r', 'run-grader'], { cwd: resultsDir, env: childEnv, stdio: 'inherit', shell: process.platform === 'win32' });
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

async function collectGuideUsage(dir: string, runType: string, guideName: string) {
  let guidesUsedResult: string[] = [];
  let retrievedGuides: string[] = [];
  let fileReadGuides: string[] = [];
  let guidanceToolsUsedResult: string[] = [];

  if (runType === 'guided') {
    const usage = await collectGuidesUsed(dir);
    retrievedGuides = usage.retrievedGuides;
    fileReadGuides = usage.fileReadGuides;
    guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides])];
    guidanceToolsUsedResult = await collectGuidanceToolsUsed(dir);
  } else if (runType === 'unguided' && hasTrajectoryGuideLeak(dir, guideName)) {
    const usage = await collectGuidesUsed(dir);
    retrievedGuides = usage.retrievedGuides;
    fileReadGuides = usage.fileReadGuides;
    guidesUsedResult = [...new Set([...retrievedGuides, ...fileReadGuides, guideName])];
    const tools = await collectGuidanceToolsUsed(dir);
    guidanceToolsUsedResult = [...new Set([...tools, 'modern-web-guidance'])];
  }

  return { guidesUsedResult, retrievedGuides, fileReadGuides, guidanceToolsUsedResult };
}

const SETUP_TIMEOUT_RE = /Fixture\b[^\n]*exceeded during setup\.?/i;
const NODE_ENOSPC_RE = /\bENOSPC:\s*no space left on device(?:,\s*[a-z0-9_]+)?\b|\[Errno 28\]\s*No space left on device/i;
const SHELL_ENOSPC_LINE_RE =
  /^[ \t]*(?:(?:mkdir|cp|mv|rm|tar|git|pnpm|npm|node|sh|bash|zsh|dd|tee|cat|touch|mktemp|install|ld|cc|gcc|clang|rustc|cargo|python3?|pip|sqlite3|bwrap|fatal|error)\b[^\n]*:\s*No space left on device\b|[a-zA-Z0-9_./-]+:\s+(?:[^\n]*:\s+)?(?:cannot|failed|unable|error|write error|close error|copy_file_range|fwrite)\b[^\n]*:\s*No space left on device\b)/im;
const LOST_SKILL_LOG_RE = /Failed to copy standalone skills-cli/i;
const PATCH_CAPTURE_FAIL_LOG_RE = /Failed to capture (?:agent )?patch/i;
const TMP_CRITICAL_USAGE_RATIO = 0.98;

export function isEnospcErrorText(text: string): boolean {
  if (!text) return false;
  return NODE_ENOSPC_RE.test(text) || SHELL_ENOSPC_LINE_RE.test(text);
}

function checkHarnessLogText(content: string, fileName: string): string | null {
  if (isEnospcErrorText(content)) {
    return `Infra error in ${fileName}: ENOSPC (No space left on device)`;
  }
  if (LOST_SKILL_LOG_RE.test(content)) {
    return `Infra error in ${fileName}: Failed to copy standalone skills-cli`;
  }
  if (PATCH_CAPTURE_FAIL_LOG_RE.test(content)) {
    return `Infra error in ${fileName}: Failed to capture patch`;
  }
  return null;
}

function isGuideOrFileReadCommand(cmd: string): boolean {
  if (!cmd) return false;
  if (/\bmodern-web-guidance\b|\bSKILL\.md\b|\bguide\.md\b/.test(cmd)) return true;
  const trimmed = cmd.trim();
  return /^(?:cat|head|tail|sed|awk|less|more|bat|rg|grep)\s+/.test(trimmed) && !/[|>;]|&&|\b(?:mkdir|cp|mv|rm|npm|pnpm|node|git\s+(?:add|commit|apply|checkout))\b/.test(trimmed);
}

function extractTextFromToolContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string') {
          return (item as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function scanAgentJsonlForEnospc(content: string, fileName: string): string | null {
  const ignoredToolUseIds = new Set<string>();
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('{')) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    // Track tool calls that read files or retrieve skills/guides so their tool_result is never scanned.
    if (obj?.type === 'assistant' && Array.isArray(obj.message?.content)) {
      for (const block of obj.message.content) {
        if (block?.type === 'tool_use' && typeof block.id === 'string') {
          const name = String(block.name ?? '');
          const cmd = String(block.input?.command ?? block.input?.cmd ?? '');
          if (
            name === 'Read' ||
            name === 'Skill' ||
            name === 'Glob' ||
            name === 'Grep' ||
            name === 'read_file' ||
            name === 'view_file' ||
            isGuideOrFileReadCommand(cmd)
          ) {
            ignoredToolUseIds.add(block.id);
          }
        }
      }
      continue;
    }

    if (obj?.type === 'response_item' && (obj.payload?.type === 'custom_tool_call' || obj.payload?.type === 'function_call')) {
      const callId = obj.payload?.call_id ?? obj.payload?.id;
      const name = String(obj.payload?.name ?? '');
      const argsStr = typeof obj.payload?.arguments === 'string' ? obj.payload.arguments : JSON.stringify(obj.payload?.input ?? '');
      if (
        typeof callId === 'string' &&
        (name === 'read_file' || name === 'view_file' || isGuideOrFileReadCommand(argsStr))
      ) {
        ignoredToolUseIds.add(callId);
      }
      continue;
    }

    // Claude Code tool_result records
    if (obj?.type === 'user' && Array.isArray(obj.message?.content)) {
      for (const block of obj.message.content) {
        if (block?.type === 'tool_result') {
          if (typeof block.tool_use_id === 'string' && ignoredToolUseIds.has(block.tool_use_id)) {
            continue;
          }
          const text = extractTextFromToolContent(block.content);
          if (isEnospcErrorText(text)) {
            return `Infra error in ${fileName}: ENOSPC (No space left on device)`;
          }
        }
      }
      continue;
    }

    // Claude Code top-level error result
    if (obj?.type === 'result' && obj?.is_error === true) {
      const text = String(obj.result ?? obj.error ?? '');
      if (isEnospcErrorText(text)) {
        return `Infra error in ${fileName}: ENOSPC (No space left on device)`;
      }
      continue;
    }

    // Codex CLI tool output records
    if (
      obj?.type === 'response_item' &&
      (obj.payload?.type === 'custom_tool_call_output' || obj.payload?.type === 'function_call_output')
    ) {
      const callId = obj.payload?.call_id ?? obj.payload?.id;
      if (typeof callId === 'string' && ignoredToolUseIds.has(callId)) {
        continue;
      }
      const text = extractTextFromToolContent(obj.payload?.output);
      if (isEnospcErrorText(text)) {
        return `Infra error in ${fileName}: ENOSPC (No space left on device)`;
      }
      continue;
    }

    // Generic error / tool_result JSONL line
    if (obj?.type === 'error' || obj?.type === 'tool_result') {
      const text = extractTextFromToolContent(obj.content ?? obj.error ?? obj.stderr ?? obj.message);
      if (isEnospcErrorText(text)) {
        return `Infra error in ${fileName}: ENOSPC (No space left on device)`;
      }
    }
  }
  return null;
}

function detectRunLogInfraError(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;

  // 1. Check /tmp usage samples in runtime.json (>= 98% byte or inode usage is an infra error).
  const runtimePath = path.join(dir, 'runtime.json');
  if (fs.existsSync(runtimePath)) {
    try {
      const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
      const samples = [
        runtime?.tmpUsageStart,
        runtime?.tmpUsageEnd,
        runtime?.tmpUsagePeak,
        ...(Array.isArray(runtime?.tmpUsageSamples) ? runtime.tmpUsageSamples : []),
      ].filter((s) => s && typeof s === 'object');
      for (const sample of samples) {
        const byteRatio = Number(sample.byteRatio ?? 0);
        const inodeRatio = Number(sample.inodeRatio ?? 0);
        if (byteRatio >= TMP_CRITICAL_USAGE_RATIO || inodeRatio >= TMP_CRITICAL_USAGE_RATIO) {
          return `Infra error in runtime.json: /tmp usage reached critical level (bytes: ${(byteRatio * 100).toFixed(1)}%, inodes: ${(inodeRatio * 100).toFixed(1)}%)`;
        }
      }
    } catch {
      // Ignore malformed runtime.json
    }
  }

  // 2. Check generation_failed.json stderr/stdout.
  const failurePath = path.join(dir, 'generation_failed.json');
  if (fs.existsSync(failurePath)) {
    try {
      const raw = fs.readFileSync(failurePath, 'utf8');
      let combined = raw;
      try {
        const parsed = JSON.parse(raw);
        combined = `${parsed?.stderr ?? ''}\n${parsed?.stdout ?? ''}`;
      } catch {}
      const hit = checkHarnessLogText(combined, 'generation_failed.json');
      if (hit) return hit;
    } catch {}
  }

  // 3. Check explicit harness-written log files (never arbitrary app files).
  for (const logName of ['agent_stderr.log', 'grader_error.log', 'modern-web.log']) {
    const logPath = path.join(dir, logName);
    if (!fs.existsSync(logPath)) continue;
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const hit = checkHarnessLogText(content, logName);
      if (hit) return hit;
    } catch {}
  }

  // 4. Check chat_log.txt: if JSONL, scan only tool_result/error records; for non-JSON lines, strip markdown code fences/blockquotes and check harness/error patterns.
  const chatLogPath = path.join(dir, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    try {
      const content = fs.readFileSync(chatLogPath, 'utf8');
      const jsonlHit = scanAgentJsonlForEnospc(content, 'chat_log.txt');
      if (jsonlHit) return jsonlHit;

      const withoutCodeFences = content.replace(/```[\s\S]*?```/g, '');
      const nonJsonLines = withoutCodeFences
        .split('\n')
        .filter((l) => {
          const t = l.trim();
          return t.length > 0 && !t.startsWith('{') && !t.startsWith('>');
        })
        .join('\n');
      const plainHit = checkHarnessLogText(nonJsonLines, 'chat_log.txt');
      if (plainHit) return plainHit;
    } catch {}
  }

  // 5. Check trajectory_summary.json: inspect only command/error step outcomes, never thoughts or guide/file reads.
  const trajSummaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(trajSummaryPath)) {
    try {
      const traj = JSON.parse(fs.readFileSync(trajSummaryPath, 'utf8'));
      if (Array.isArray(traj?.steps)) {
        for (const step of traj.steps) {
          const actionType = String(step?.action?.type ?? '');
          const category = String(step?.action?.canonicalCategory ?? '');
          const actionName = String(step?.action?.name ?? '');
          const cmd = String(step?.action?.params?.command ?? '');
          if (
            actionType === 'read_file' ||
            category === 'guide_read' ||
            category === 'skill_activation' ||
            category === 'skill_search' ||
            actionName === 'Read' ||
            actionName === 'Skill' ||
            isGuideOrFileReadCommand(cmd)
          ) {
            continue;
          }
          const status = String(step?.outcome?.status ?? '');
          if (actionType === 'run_command' || status === 'error' || status === 'failure') {
            const msg = String(step?.outcome?.message ?? '');
            if (isEnospcErrorText(msg)) {
              return 'Infra error in trajectory_summary.json: ENOSPC (No space left on device)';
            }
          }
        }
      }
    } catch {}
  }

  // 6. Check session-*.jsonl files: inspect only non-read tool_result/error records.
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/^session-.*\.jsonl$/i.test(entry.name)) continue;
      try {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const hit = scanAgentJsonlForEnospc(content, entry.name);
        if (hit) return hit;
      } catch {}
    }
  } catch {}

  return null;
}

function findSetupTimeoutError(json: any): string | null {
  const candidates: string[] = [];
  if (Array.isArray(json?.errors)) {
    for (const err of json.errors) {
      if (typeof err?.message === 'string') candidates.push(err.message);
      if (typeof err?.stack === 'string') candidates.push(err.stack);
    }
  }
  const visitSuite = (suite: any) => {
    if (Array.isArray(suite?.specs)) {
      for (const spec of suite.specs) {
        for (const testObj of spec?.tests ?? []) {
          for (const res of testObj?.results ?? []) {
            if (typeof res?.error?.message === 'string') candidates.push(res.error.message);
            if (typeof res?.error?.stack === 'string') candidates.push(res.error.stack);
            for (const err of res?.errors ?? []) {
              if (typeof err?.message === 'string') candidates.push(err.message);
              if (typeof err?.stack === 'string') candidates.push(err.stack);
            }
          }
        }
      }
    }
    if (Array.isArray(suite?.suites)) {
      for (const child of suite.suites) visitSuite(child);
    }
  };
  if (Array.isArray(json?.suites)) {
    for (const suite of json.suites) visitSuite(suite);
  }
  for (const raw of candidates) {
    const cleaned = sanitizeDiagnosticText(raw);
    const match = cleaned.match(SETUP_TIMEOUT_RE);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function resolveBaseAppForGrading(dir: string, guide: string, graderPath: string): string | null {
  const parentDirName = path.basename(path.dirname(path.dirname(graderPath)));
  if (parentDirName === 'targets') {
    return path.basename(path.dirname(graderPath));
  }
  const taskName = path.basename(path.dirname(dir)) || 'task';
  const guideDir = path.dirname(graderPath);
  const candidateTaskPaths = [
    path.join(guideDir, 'tasks', `${taskName}.md`),
    path.join(guideDir, `${taskName}.md`),
    path.join(guideDir, 'task.md'),
  ];
  for (const taskPath of candidateTaskPaths) {
    if (!fs.existsSync(taskPath)) continue;
    try {
      const raw = fs.readFileSync(taskPath, 'utf8');
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const baseAppMatch = fmMatch[1].match(/^\s*base_app:\s*['"]?([a-zA-Z0-9_-]+)['"]?/m);
        if (baseAppMatch?.[1]) {
          return baseAppMatch[1];
        }
      }
    } catch {}
  }
  const taskMap = getTaskMap();
  const fromMap = taskMap.get(`${guide}/${taskName}`)?.baseApp ?? taskMap.get(`${guide}/task`)?.baseApp;
  if (fromMap) {
    return fromMap;
  }
  if (fs.existsSync(path.join(baseAppsDir, taskName))) {
    return taskName;
  }
  return null;
}

function checkPatchApplyFailureOnMissingResults(dir: string, guide: string, graderPath: string): string | null {
  const patchPath = path.join(dir, 'agent.patch');
  if (!fs.existsSync(patchPath)) return null;
  let patchContent: string;
  try {
    patchContent = fs.readFileSync(patchPath, 'utf8');
  } catch {
    return null;
  }
  if (!patchContent.trim()) return null;
  if (/^Binary files .+ and .+ differ$/m.test(patchContent)) {
    return `Failed to apply patch ${patchPath}: patch contains a binary diff ("Binary files ... differ") without binary content`;
  }
  const baseApp = resolveBaseAppForGrading(dir, guide, graderPath);
  if (!baseApp) return null;
  const refBaseAppDir = path.join(baseAppsDir, baseApp);
  if (!fs.existsSync(refBaseAppDir)) return null;

  const tempHome = createIsolatedHome('patch-check');
  const workDir = path.join(tempHome, baseApp);
  try {
    fs.cpSync(refBaseAppDir, workDir, {
      recursive: true,
      filter: (src) => {
        const b = path.basename(src);
        return b !== 'node_modules' && b !== 'dist' && b !== '.git';
      },
    });
    const res = applyPatchSync(workDir, patchPath);
    if (!res.success) {
      return sanitizeDiagnosticText(`Failed to apply patch ${patchPath} to ${baseApp}: ${res.error}`);
    }
  } catch {
    // Ignore unexpected fs errors during fallback check
  } finally {
    try {
      cleanupIsolatedHome(tempHome);
    } catch {
      // Ignore cleanup errors
    }
  }
  return null;
}

export function evaluateScenarioResults(
  dir: string,
  guide: string,
  graderPath: string,
  graderResults: string,
  targetAppExists: boolean,
  _targetFile?: string
): ScenarioCheck[] {
  const makeInfraError = (reason: string): ScenarioCheck[] => [{
    id: 'early-failure-1',
    passed: false,
    message: reason,
    isEarlyFailure: true,
  }];

  const makeAgentFailures = (reason: string): ScenarioCheck[] => {
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
  const logInfraError = detectRunLogInfraError(dir);
  if (logInfraError) {
    return makeInfraError(logInfraError);
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
  if (!targetAppExists) {
    return makeAgentFailures('Target app missing');
  }

  try {
    const json = JSON.parse(fs.readFileSync(graderResults, 'utf-8'));

    if (typeof json?.infraError === 'string' && json.infraError.trim()) {
      return makeInfraError(sanitizeDiagnosticText(json.infraError));
    }

    const setupTimeout = findSetupTimeoutError(json);
    if (setupTimeout) {
      return makeInfraError(`Grading setup timed out: ${setupTimeout}`);
    }

    if (Array.isArray(json?.suites) && json.suites.length > 0) {
      const specs: any[] = [];
      const traverse = (suite: any) => {
        if (suite.specs) specs.push(...suite.specs);
        if (suite.suites) suite.suites.forEach(traverse);
      };
      json.suites.forEach(traverse);

      if (specs.length > 0) {
        const scenarioChecks: ScenarioCheck[] = [];
        for (const spec of specs) {
          if (isSpecSkipped(spec)) {
            continue;
          }
          const lastResult = spec.tests?.[0]?.results?.at(-1);
          if (lastResult?.status === 'passed') {
            scenarioChecks.push({ id: spec.id, passed: true, message: spec.title });
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

          scenarioChecks.push({
            id: spec.id,
            passed: false,
            message: spec.title,
            ...(errorMsg ? { error: errorMsg } : {}),
            ...(errorLocation ? { errorLocation } : {}),
            ...(pageSnapshot ? { pageSnapshot } : {}),
            ...(browserErrors ? { browserErrors } : {}),
          });
        }
        return scenarioChecks;
      }
    }

    return makeAgentFailures('Playwright test runner failed or produced no test results');
  } catch (err: any) {
    if (isEnoent(err)) {
      const patchApplyError = checkPatchApplyFailureOnMissingResults(dir, guide, graderPath);
      if (patchApplyError) {
        return makeInfraError(patchApplyError);
      }
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
  taskMap: Map<string, any>
): Promise<{ testName: string; payload: any } | null> {
  const ctx = getTaskRunContext(dir, runPath, taskMap, true);
  if (!ctx) return null;

  const usage = await collectGuideUsage(dir, ctx.runType, ctx.guide);

  const taskCategory = path.basename(path.dirname(ctx.taskInfo.guideDir));
  const expectedToolPrefixes = ['modern-web'];

  const scenarioResults = evaluateScenarioResults(
    dir,
    ctx.guide,
    ctx.graderPath,
    ctx.graderResults,
    ctx.targetAppExists,
    ctx.targetFile
  );

  const testName = `${ctx.taskName} - ${ctx.guide} - ${ctx.runType}`;
  const tokenUsage = extractTokenUsageFromResults(dir);
  const runtimeData = readRuntimeData(dir);
  const pageLoad = extractPageLoadFromResults(ctx.graderResults);

  const payload = {
    runNumber,
    results: scenarioResults,
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

  return { testName, payload };
}

async function collectAllResults(
  resultsDir: string,
  runDirs: string[],
  taskMap: Map<string, any>
): Promise<{ allResults: Record<string, any[]>; model: string }> {
  const allResults: Record<string, any[]> = {};
  let model = 'unknown';

  for (const { dir, runPath, runDir } of getTaskDirsForRuns(resultsDir, runDirs)) {
    if (model === 'unknown') {
      const extracted = extractModelFromResults(dir);
      if (extracted !== 'unknown') {
        model = extracted;
      }
    }

    const entry = await collectTaskRunEntry(dir, runPath, parseInt(runDir), taskMap);
    if (!entry) continue;

    if (!allResults[entry.testName]) {
      allResults[entry.testName] = [];
    }
    allResults[entry.testName].push(entry.payload);
  }

  return { allResults, model };
}

export async function collectResults(resultsDir: string, _suiteConfig?: SuiteConfig) {
  const taskMap = getTaskMap();
  const runDirs = getRunNumberDirs(resultsDir);

  const graderPackages = prepareGradersForRuns(resultsDir, runDirs, taskMap);
  await executeParallelGrading(resultsDir, graderPackages);
  const { allResults, model } = await collectAllResults(resultsDir, runDirs, taskMap);

  const estimatedRuntime = estimateTotalRuntime(resultsDir);

  return { allResults, numRuns: runDirs.length, model, totalRuntime: estimatedRuntime };
}

