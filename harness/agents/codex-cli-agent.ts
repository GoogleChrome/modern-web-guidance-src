import fs from 'fs';
import os from 'os';
import path from 'path';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, setupIsolatedWorkDir, parseJsonlFile, type GuideUsage } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';
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
  getSessionFiles,
  generateNormalizedTrajectory
} from '../lib/trajectory-parser.ts';
import { fileURLToPath } from 'url';

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
    const logContent = fs.readFileSync(src, 'utf8');
    const jsonLines = logContent.split(/\r?\n/).filter(Boolean);

    const logData = jsonLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error("Failed to parse JSONL line:", e);
        return { error: "Failed to parse line", raw: line };
      }
    });

    // 3. Generate and save the HTML viewer
    const htmlContent = generateCodexTrajectoryHtml(logData);

    // 4. Save HTML viewer to target directory
    const destName = `session-${baseName}.html`;
    const dest = path.join(targetDir, destName);
    fs.writeFileSync(dest, htmlContent, 'utf8');
  }
}

export function parseCodexTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let currentThought = '';
  const callMap = new Map<string, StandardizedStep>();

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
      if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'commentary') {
        const msg = entry.payload;
        currentThought = currentThought ? `${currentThought}\n${msg.message}` : msg.message;
      } else if (entry.type === 'response_item' && (entry.payload?.type === 'function_call' || entry.payload?.type === 'custom_tool_call')) {
        const fc = entry.payload;
        let cmdName = fc.name;
        let params: Record<string, any> = {};
        try {
          params = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {});
        } catch {}

        if (cmdName === 'exec_command' && params.cmd) {
          cmdName = params.cmd.split(' ')[0] || 'exec_command';
        }

        const step: StandardizedStep = {
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || `Executing ${cmdName}`,
          action: {
            type: mapToolType(fc.name),
            name: fc.name === 'exec_command' ? (params.cmd || 'exec_command') : fc.name,
            params
          }
        };
        steps.push(step);
        currentThought = '';
        if (fc.call_id) {
          callMap.set(fc.call_id, step);
        }
      } else if (entry.type === 'response_item' && (entry.payload?.type === 'function_call_output' || entry.payload?.type === 'custom_tool_call_output')) {
        const fco = entry.payload;
        const step = callMap.get(fco.call_id);
        if (step) {
          const out = typeof fco.output === 'string' ? fco.output : JSON.stringify(fco.output || '');
          const isErr = out.includes('Process exited with code') && !out.includes('code 0');
          step.outcome = {
            status: isErr ? 'error' : 'success',
            message: truncateMessage(out, 500)
          };
        }
      } else if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'final_answer') {
        steps.push({
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || 'Finalizing response to user',
          action: {
            type: 'other',
            name: 'respond_to_user',
            params: { response: entry.payload.message }
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

  return finalizeTrajectorySummary({
    agent: Agents.CODEX_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
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

      const functionCall = obj.type === 'function_call' ? obj : (obj.payload?.type === 'function_call' ? obj.payload : null);
      if (functionCall?.name === 'exec_command' && functionCall.arguments) {
        try {
          const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
          const command = args.cmd || '';
          if (command.includes('/skills/') && command.includes('SKILL.md')) {
            const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
            if (match) {
              toolsUsed.add(match[1]);
            }
          }
          if (command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
            }
          } else if (command.includes('.agents/skills/') && command.includes('guide.md')) {
            const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
            if (match) {
              retrievedGuides.add(match[1]);
            }
          }
        } catch {}
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
    toolsUsed: [...toolsUsed],
    retrievedGuides: [...retrievedGuides],
    fileReadGuides: [...fileReadGuides]
  };
}

function loadCodexLogs(dirPath: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const sessionFiles = getSessionFiles(dirPath, '*.jsonl');
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};

  for (const file of sessionFiles) {
    const sessionPath = path.join(dirPath, file);
    let parsedLines: any[] = [];
    try {
      parsedLines = parseJsonlFile(sessionPath);
    } catch {}

    const key = file.replace(/\.jsonl$/, '').replace(/^(?:subagent-|session-)+(?:subagents-)*(?:agent[-_])?/, '');
    const isSubagent = file.startsWith('subagent-') || file.includes('-subagents-');

    if (isSubagent) {
      subagentsMap[key] = parsedLines;
    } else {
      logData.push(...parsedLines);
    }
  }

  return { logData, subagentsMap };
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
  const summaryPath = path.join(dirPath, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.retrievedGuides || summary.fileReadGuides) {
        return {
          retrievedGuides: summary.retrievedGuides || [],
          fileReadGuides: summary.fileReadGuides || []
        };
      }
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(dirPath);
  const meta = extractCodexMetadata(logData, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractCodexCliModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(resultsDir);
  return extractCodexMetadata(logData, subagentsMap).model;
}

export function extractCodexCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(dir);
  return extractCodexMetadata(logData, subagentsMap).tokenUsage;
}

export function collectCodexToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(dir);
  return extractCodexMetadata(logData, subagentsMap).toolsUsed;
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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}

