import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  cleanupIsolatedHome,
  parseAgentArgs,
  watchLogFile,
  runCliAgentCommand,
  setupIsolatedWorkDir,
  parseJsonlFile,
  isEnoent,
  type GuideUsage
} from '../lib/agent-shared.ts';
import config, { Agents, Serving } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateCodexTrajectoryHtml } from '../lib/codex-trajectory-viewer.ts';
import {
  type StandardizedStep,
  type SubagentMetadata,
  type TrajectorySummary,
  extractTimestamp,
  mapToolType,
  truncateMessage,
  finalizeTrajectorySummary,
  generateNormalizedTrajectory,
  readTrajectorySummary,
  getSessionFiles
} from '../lib/trajectory-normalizer.ts';
import type { CodexRolloutLine } from './codex.d.ts';

const MAX_RESPONSE_PREVIEW_LENGTH = 150;

export function setupCodexCliCredentials(tempHome: string): void {
  const codexGlobalDir = path.join(os.homedir(), '.codex');
  const codexDestDir = path.join(tempHome, '.codex');
  try {
    fs.cpSync(codexGlobalDir, codexDestDir, {
      recursive: true,
      filter: (src) => !src.includes('sessions') && !src.includes('log')
    });
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }
}

export function getCodexCliCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.codexCliBin;
  const model = process.env.CODEX_MODEL;
  const commandArgs = [
    'exec',
    prompt,
    '--yolo',
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}

function exportCodexTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const codexLogDir = path.join(tempHome, '.codex', 'sessions');
  let files: string[] = [];
  try {
    files = fs.globSync('**/*.jsonl', { cwd: codexLogDir });
  } catch (err) {
    if (!isEnoent(err)) throw err;
    return;
  }

  for (const relativePath of files) {
    const src = path.join(codexLogDir, relativePath);
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    fs.copyFileSync(src, path.join(targetDir, `session-${baseName}.jsonl`));
    const logData = parseJsonlFile(src);
    const htmlContent = generateCodexTrajectoryHtml(logData);
    fs.writeFileSync(path.join(targetDir, `session-${baseName}.html`), htmlContent, 'utf8');
  }
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('codex-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.CODEX_CLI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Codex agent in: ${workDir}`);

    const { command, commandArgs } = getCodexCliCommandAndArgs(userPrompt);

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Codex CLI'
      );
    } finally {
      stopWatchingMcpLog();
      exportCodexTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.CODEX_CLI, userPrompt);
    }

    console.log("Codex agent finished successfully.");
  } catch (err) {
    console.error("Error during Codex execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

function unescapeString(raw: string, quote: string): string {
  if (quote === '"') {
    try {
      return JSON.parse(`"${raw}"`);
    } catch {
      return raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  } else if (quote === "'") {
    return raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  } else if (quote === '`') {
    return raw.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
  }
  return raw;
}

export function extractCommandsFromCodexItem(obj: any): string[] {
  const commands: string[] = [];
  const payload = obj?.payload || obj;
  if (!payload) return commands;

  const itemType = payload.type || obj?.type;

  // 1. local_shell_call response items
  if (itemType === 'local_shell_call') {
    const action = payload.action || obj?.action;
    if (action?.type === 'exec' && Array.isArray(action.command)) {
      const cmdArr = action.command;
      const cIdx = cmdArr.indexOf('-c');
      if (cIdx !== -1 && cmdArr[cIdx + 1]) {
        commands.push(cmdArr[cIdx + 1]);
      } else {
        commands.push(cmdArr.join(' '));
      }
      return commands;
    }
  }

  // 2. exec_command_begin / exec_command_end event_msg
  if (itemType === 'exec_command_begin' || itemType === 'exec_command_end') {
    if (Array.isArray(payload.command)) {
      const cmdArr = payload.command;
      const cIdx = cmdArr.indexOf('-c');
      if (cIdx !== -1 && cmdArr[cIdx + 1]) {
        commands.push(cmdArr[cIdx + 1]);
      } else {
        commands.push(cmdArr.join(' '));
      }
      return commands;
    }
  }

  // 3. function_call or custom_tool_call
  if (itemType !== 'function_call' && itemType !== 'custom_tool_call') {
    return commands;
  }

  // apply_patch is a file mutation, not a shell command
  const toolName = (payload.name || obj.name || '').toLowerCase();
  if (toolName === 'apply_patch' || toolName === 'patch') {
    return commands;
  }

  const raw = payload.input ?? payload.arguments ?? obj.input ?? obj.arguments;
  if (!raw) return commands;

  if (typeof raw === 'object') {
    if (typeof raw.cmd === 'string') commands.push(raw.cmd);
    else if (typeof raw.command === 'string') commands.push(raw.command);
    return commands;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.cmd === 'string') return [parsed.cmd];
        if (typeof parsed.command === 'string') return [parsed.command];
      }
    } catch {
      // Not direct JSON
    }

    // Match code-mode direct string calls: tools.exec_command("...")
    const directCallRegex = /tools\.(?:exec_command|shell_command|bash)\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
    for (const match of raw.matchAll(directCallRegex)) {
      commands.push(unescapeString(match[2], match[1]));
    }

    // Match { cmd: "..." } or { command: "..." } in code mode or function_call arguments
    const cmdRegex = /["']?(?:cmd|command)["']?\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
    for (const match of raw.matchAll(cmdRegex)) {
      commands.push(unescapeString(match[2], match[1]));
    }

    const isExecTool = !toolName || ['exec', 'exec_command', 'bash', 'shell', 'run_command', 'terminal'].some(t => toolName.includes(t));
    if (commands.length === 0 && itemType === 'function_call' && isExecTool && raw.trim()) {
      commands.push(raw);
    }
  }

  return commands;
}

export function parseCodexTrajectory(logData: CodexRolloutLine[] | any[], subagentsMap: Record<string, CodexRolloutLine[] | any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let currentThought = '';
  const callMap = new Map<string, StandardizedStep>();

  const modelCounts: Record<string, number> = {};
  let totalTokens = 0;
  let cachedTokens = 0;
  let hasTokenData = false;
  const toolsUsed = new Set<string>();
  const retrievedGuides = new Set<string>();
  const fileReadGuides = new Set<string>();
  const subagentStepCounts: Record<string, number> = {};

  const processEntries = (entries: any[], subagentId?: string) => {
    let lastTotal = 0;
    let lastCached = 0;
    let fileHasTokens = false;

    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);

      if (typeof entry.payload?.model === 'string') {
        modelCounts[entry.payload.model] = (modelCounts[entry.payload.model] || 0) + 1;
      }
      const info = (entry.type === 'token_count' ? entry : entry.payload)?.info?.total_token_usage;
      if (info) {
        lastTotal = info.total_tokens || 0;
        lastCached = info.cached_input_tokens || 0;
        fileHasTokens = true;
      }

      if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'commentary') {
        currentThought = entry.payload.message || '';
      }

      const isFunctionCall = entry.type === 'response_item' && entry.payload?.type === 'function_call';
      const isCustomToolCall = entry.type === 'response_item' && entry.payload?.type === 'custom_tool_call';

      if (isFunctionCall || isCustomToolCall) {
        const p = entry.payload;
        const callId = p.call_id;
        const cmdName = p.name || 'unknown';
        const commands = extractCommandsFromCodexItem(entry);

        let actionType: NonNullable<StandardizedStep['action']>['type'] = mapToolType(cmdName);
        let actionName = cmdName;
        let params: any = undefined;

        if (commands.length > 0) {
          actionType = 'run_command';
          actionName = commands[0];
          params = { cmd: commands[0] };
        } else {
          try {
            params = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : (p.arguments || p.input);
          } catch {
            params = p.arguments || p.input;
          }
        }

        const step: StandardizedStep = {
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || `Executing ${cmdName}`,
          action: {
            type: actionType,
            name: actionName,
            params
          }
        };
        steps.push(step);
        if (subagentId) {
          subagentStepCounts[subagentId] = (subagentStepCounts[subagentId] || 0) + 1;
        }
        if (callId) {
          callMap.set(callId, step);
        }
        currentThought = '';
      }

      if (entry.type === 'response_item' && (entry.payload?.type === 'function_call_output' || entry.payload?.type === 'custom_tool_call_output')) {
        const p = entry.payload;
        const callId = p.call_id;
        const out = p.output || '';
        const step = callId ? callMap.get(callId) : undefined;
        if (step) {
          step.outcome = {
            status: out.toLowerCase().includes('error:') ? 'error' : 'success',
            message: truncateMessage(out)
          };
        }
      }

      if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'final_answer') {
        steps.push({
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || 'Finalizing response to user',
          action: {
            type: 'other',
            name: 'respond_to_user',
            params: { response: truncateMessage(entry.payload.message, MAX_RESPONSE_PREVIEW_LENGTH) }
          },
          outcome: { status: 'success' }
        });
        if (subagentId) {
          subagentStepCounts[subagentId] = (subagentStepCounts[subagentId] || 0) + 1;
        }
        currentThought = '';
      }

      const commands = extractCommandsFromCodexItem(entry);
      for (const command of commands) {
        if (command.includes('.agents/skills/') && command.includes('SKILL.md')) {
          const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
          if (match) {
            toolsUsed.add(match[1]);
          }
        }
        if (command.includes('modern-web-guidance') && command.includes('retrieve')) {
          const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
          if (match) {
            for (const g of match[1].split(',').map((s: string) => s.trim())) {
              retrievedGuides.add(g);
            }
          }
        } else if (command.includes('.agents/skills/') && command.includes('guide.md')) {
          const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
          if (match) {
            fileReadGuides.add(match[1]);
          }
        }
      }
    }

    if (fileHasTokens) {
      totalTokens += lastTotal;
      cachedTokens += lastCached;
      hasTokenData = true;
    }
  };

  processEntries(logData);

  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    processEntries(subLogs, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = subagentStepCounts[subId] || 0;
    if (subStepsCount > 0) {
      subagentsMeta[subId] = {
        id: subId,
        agent: Agents.CODEX_CLI,
        totalSteps: subStepsCount
      };
    }
  }

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  return finalizeTrajectorySummary({
    agent: Agents.CODEX_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: topModel ? topModel[0] : 'unknown',
    tokenUsage: hasTokenData ? { total: totalTokens, cached: cachedTokens } : undefined,
    toolsUsed: Array.from(toolsUsed),
    retrievedGuides: Array.from(retrievedGuides),
    fileReadGuides: Array.from(fileReadGuides)
  });
}

export function extractCodexMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
  model: string;
  tokenUsage?: { total: number; cached: number };
  toolsUsed: string[];
  retrievedGuides: string[];
  fileReadGuides: string[];
} {
  const summary = parseCodexTrajectory(logData, subagentsMap);
  return {
    model: summary.model || 'unknown',
    tokenUsage: summary.tokenUsage,
    toolsUsed: summary.toolsUsed || [],
    retrievedGuides: summary.retrievedGuides || [],
    fileReadGuides: summary.fileReadGuides || []
  };
}

export function loadCodexLogs(dir: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};
  const files = getSessionFiles(dir);

  const mainFiles = files.filter(f => !f.startsWith('subagent-')).sort();
  const subFiles = files.filter(f => f.startsWith('subagent-')).sort();

  for (const file of mainFiles) {
    logData.push(...parseJsonlFile(path.join(dir, file)));
  }

  for (const file of subFiles) {
    const subId = file.replace(/^subagent-(?:subagents-)?(?:agent-)?/, '').replace(/\.jsonl$/, '');
    subagentsMap[subId] = parseJsonlFile(path.join(dir, file));
  }

  return { logData, subagentsMap };
}

function getCodexMetadataForDir(dir: string): ReturnType<typeof extractCodexMetadata> {
  const summary = readTrajectorySummary(dir);
  if (summary) {
    return {
      model: summary.model || 'unknown',
      tokenUsage: summary.tokenUsage,
      toolsUsed: summary.toolsUsed || [],
      retrievedGuides: summary.retrievedGuides || [],
      fileReadGuides: summary.fileReadGuides || []
    };
  }
  const { logData, subagentsMap } = loadCodexLogs(dir);
  return extractCodexMetadata(logData, subagentsMap);
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, serving?: string): Promise<GuideUsage> {
  const meta = getCodexMetadataForDir(dirPath);
  if (serving === Serving.SKILLS_CLI) {
    return {
      retrievedGuides: meta.retrievedGuides,
      fileReadGuides: []
    };
  }
  if (serving === Serving.SKILLS) {
    return {
      retrievedGuides: [],
      fileReadGuides: meta.fileReadGuides
    };
  }
  return {
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
  };
}

export function extractCodexCliModel(resultsDir: string): string {
  return getCodexMetadataForDir(resultsDir).model;
}

export function extractCodexCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  return getCodexMetadataForDir(dir).tokenUsage;
}

export function collectCodexToolsFromTrajectory(dir: string): string[] {
  return getCodexMetadataForDir(dir).toolsUsed;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}

