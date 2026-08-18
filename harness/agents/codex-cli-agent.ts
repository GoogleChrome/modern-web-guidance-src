import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, setupIsolatedWorkDir, parseJsonlFile, type GuideUsage } from '../lib/agent-shared.ts';
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
  generateNormalizedTrajectory
} from '../lib/trajectory-normalizer.ts';

export function setupCodexCliCredentials(tempHome: string): void {
  const codexGlobalDir = path.join(os.homedir(), '.codex');
  const codexDestDir = path.join(tempHome, '.codex');
  if (fs.existsSync(codexGlobalDir)) {
    fs.cpSync(codexGlobalDir, codexDestDir, {
      recursive: true,
      filter: (src) => !src.includes('sessions') && !src.includes('log')
    });
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

const TRAJECTORY_GLOB = 'session-*.jsonl';

function getSessionFiles(dir: string, recursive = false): string[] {
  return fs.globSync(recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB, { cwd: dir });
}

function exportCodexTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const codexLogDir = path.join(tempHome, '.codex', 'sessions');
  
  if (!fs.existsSync(codexLogDir)) {
    return;
  }

  // Find all jsonl files in the Codex sessions directory
  const files = fs.globSync('**/*.jsonl', { cwd: codexLogDir });

  for (const relativePath of files as string[]) {
    const src = path.join(codexLogDir, relativePath);

    // 1. Determine base name and copy original JSONL file to targetDir
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    const rawDestName = `session-${baseName}.jsonl`;
    fs.copyFileSync(src, path.join(targetDir, rawDestName));

    // 2. Read and parse JSONL
    const logData = parseJsonlFile(src);

    // 3. Generate and save the HTML viewer
    const htmlContent = generateCodexTrajectoryHtml(logData);

    // 4. Save HTML viewer to target directory
    const destName = `session-${baseName}.html`;
    const dest = path.join(targetDir, destName);
    fs.writeFileSync(dest, htmlContent, 'utf8');
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
  if (itemType !== 'function_call' && itemType !== 'custom_tool_call') {
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

    const cmdRegex = /["']?(?:cmd|command)["']?\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
    let found = false;
    for (const match of raw.matchAll(cmdRegex)) {
      commands.push(unescapeString(match[2], match[1]));
      found = true;
    }

    if (!found && itemType === 'function_call' && raw.trim()) {
      commands.push(raw);
    }
  }

  return commands;
}

export function parseCodexTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let currentThought = '';
  const callMap = new Map<string, StandardizedStep>();

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
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
            params: { response: truncateMessage(entry.payload.message, 150) }
          },
          outcome: { status: 'success' }
        });
        currentThought = '';
      }
    }
  };

  processEntries(logData);

  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    processEntries(subLogs, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    subagentsMeta[subId] = {
      id: subId,
      agent: Agents.CODEX_CLI,
      totalSteps: subStepsCount
    };
  }

  const meta = extractCodexMetadata(logData, subagentsMap);

  return finalizeTrajectorySummary({
    agent: Agents.CODEX_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: meta.model,
    tokenUsage: meta.tokenUsage,
    toolsUsed: meta.toolsUsed,
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
  });
}

export function extractCodexMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
  model: string;
  tokenUsage?: { total: number; cached: number };
  toolsUsed: string[];
  retrievedGuides: string[];
  fileReadGuides: string[];
} {
  const modelCounts: Record<string, number> = {};
  let totalTokens = 0;
  let cachedTokens = 0;
  let hasTokenData = false;
  const toolsUsed = new Set<string>();
  const retrievedGuides = new Set<string>();
  const fileReadGuides = new Set<string>();

  const processEntries = (entries: any[]) => {
    let lastTotal = 0;
    let lastCached = 0;
    let fileHasTokens = false;

    for (const obj of entries) {
      if (typeof obj.payload?.model === 'string') {
        modelCounts[obj.payload.model] = (modelCounts[obj.payload.model] || 0) + 1;
      }
      const info = (obj.type === 'token_count' ? obj : obj.payload)?.info?.total_token_usage;
      if (info) {
        lastTotal = info.total_tokens || 0;
        lastCached = info.cached_input_tokens || 0;
        fileHasTokens = true;
      }

      const commands = extractCommandsFromCodexItem(obj);
      for (const command of commands) {
        if (command.includes('.agents/skills/') && command.includes('SKILL.md')) {
          const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
          if (match) {
            toolsUsed.add(match[1]);
          }
        }
        if (command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
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
  for (const subLogs of Object.values(subagentsMap)) {
    processEntries(subLogs);
  }

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    model: topModel ? topModel[0] : 'unknown',
    tokenUsage: hasTokenData ? { total: totalTokens, cached: cachedTokens } : undefined,
    toolsUsed: Array.from(toolsUsed),
    retrievedGuides: Array.from(retrievedGuides),
    fileReadGuides: Array.from(fileReadGuides)
  };
}

export function loadCodexLogs(dir: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  let logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};
  const files = getSessionFiles(dir);

  const mainFiles = files.filter(f => !f.startsWith('subagent-')).sort();
  const subFiles = files.filter(f => f.startsWith('subagent-')).sort();

  if (mainFiles.length > 0) {
    logData = parseJsonlFile(path.join(dir, mainFiles[0]));
  }

  for (const file of subFiles) {
    const subId = file.replace(/^subagent-(?:subagents-)?(?:agent-)?/, '').replace(/\.jsonl$/, '');
    subagentsMap[subId] = parseJsonlFile(path.join(dir, file));
  }

  return { logData, subagentsMap };
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, serving: string): Promise<GuideUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];

  for (const file of getSessionFiles(dirPath)) {
    const items = parseJsonlFile(path.join(dirPath, file));
    for (const obj of items) {
      const commands = extractCommandsFromCodexItem(obj);
      for (const command of commands) {
        if (serving === Serving.SKILLS_CLI && command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
          const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
          if (match) {
            retrievedGuides.push(...match[1].split(',').map((s: string) => s.trim()));
          }
        } else if (serving === Serving.SKILLS && command.includes('.agents/skills/') && command.includes('guide.md')) {
          const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
          if (match) {
            fileReadGuides.push(match[1]);
          }
        }
      }
    }
  }
  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)]
  };
}

export function extractCodexCliModel(resultsDir: string): string {
  const counts: Record<string, number> = {};
  for (const file of getSessionFiles(resultsDir, true)) {
    const items = parseJsonlFile(path.join(resultsDir, file));
    for (const obj of items) {
      if (typeof obj.payload?.model === 'string') {
        counts[obj.payload.model] = (counts[obj.payload.model] || 0) + 1;
      }
    }
  }
  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return topModel ? topModel[0] : 'unknown';
}

export function extractCodexCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;

  for (const file of getSessionFiles(dir)) {
    const items = parseJsonlFile(path.join(dir, file));
    let lastTotal = 0;
    let lastCached = 0;
    let fileHasTokens = false;

    for (const obj of items) {
      const info = (obj.type === 'token_count' ? obj : obj.payload)?.info?.total_token_usage;
      if (info) {
        lastTotal = info.total_tokens || 0;
        lastCached = info.cached_input_tokens || 0;
        fileHasTokens = true;
      }
    }
    if (fileHasTokens) {
      total += lastTotal;
      cached += lastCached;
      hasData = true;
    }
  }
  return hasData ? { total, cached } : undefined;
}

export function collectCodexToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  if (sessionFiles.length === 0) return toolsUsed;

  for (const file of sessionFiles) {
    const items = parseJsonlFile(path.join(dir, file));
    for (const obj of items) {
      const commands = extractCommandsFromCodexItem(obj);
      for (const command of commands) {
        if (command.includes('.agents/skills/') && command.includes('SKILL.md')) {
          const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
          if (match) {
            toolsUsed.push(match[1]);
          }
        }
      }
    }
  }
  return Array.from(new Set(toolsUsed));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
