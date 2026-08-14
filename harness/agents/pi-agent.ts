import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, setupIsolatedWorkDir, parseJsonlFile, type GuideUsage } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
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

export function setupPiCredentials(tempHome: string): void {
  const piSource = path.join(os.homedir(), '.pi');
  const piDest = path.join(tempHome, '.pi');
  const piDestAgent = path.join(piDest, 'agent');

  fs.mkdirSync(piDestAgent, { recursive: true });

  // Copy necessary auth and configuration files
  const filesToCopy = [
    'settings.json',
    'trust.json',
    'auth.json',  // Copy auth.json to provide API credentials in isolated env
    'models-store.json'  // Copy models store so Pi knows about available models
  ];

  for (const file of filesToCopy) {
    const src = path.join(piSource, 'agent', file);
    copyFileIfExists(src, path.join(piDestAgent, file));
  }

  process.env.PI_CODING_AGENT_DIR = piDestAgent;
}

export function getPiCommandAndArgs(prompt: string, extraArgs: string[] = []): { command: string; commandArgs: string[] } {
  const command = config.environment.piBin || 'pi';
  const piModel = process.env.PI_MODEL || process.env.PROMPT_MODEL;
  const modelArg = piModel ? ['--model', piModel] : [];

  // Allow overriding --no-session via env var for trajectory testing
  const noSession = process.env.PI_NO_SESSION !== 'false';
  const sessionArgs = noSession ? ['--no-session'] : [];

  const commandArgs = [
    '-p', // print mode: non-interactive, process and exit
    ...sessionArgs, // ephemeral mode: don't save session (unless disabled)
    '--offline', // disable network operations for update checks
    ...modelArg,
    ...extraArgs,
    prompt
  ];
  return { command, commandArgs };
}

export function parsePiTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
      const msg = entry.type === 'message' ? entry.message : entry;
      if (!msg) continue;

      if (msg.role === 'assistant') {
        let thought = '';
        if (typeof msg.content === 'string') {
          thought = msg.content;
        } else if (Array.isArray(msg.content)) {
          const textBlock = msg.content.find((c: any) => c.type === 'text');
          if (textBlock) thought = textBlock.text || '';
        }

        const toolCalls: any[] = [];
        if (Array.isArray(msg.content)) {
          toolCalls.push(...msg.content.filter((c: any) => c.type === 'toolCall'));
        }
        if (Array.isArray(msg.tool_calls)) {
          toolCalls.push(...msg.tool_calls);
        }

        if (toolCalls.length === 0) {
          if (thought) {
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: 'other',
                name: 'respond_to_user',
                params: { response: truncateMessage(thought, 150) }
              },
              outcome: { status: 'success' }
            });
          }
        } else {
          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name || 'tool_call';
            const args = tc.arguments || tc.function?.arguments || {};
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought: thought || `Executing ${toolName}`,
              action: {
                type: mapToolType(toolName),
                name: toolName,
                params: typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return { raw: args }; } })() : args
              },
              outcome: { status: 'success' }
            });
          }
        }
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
      agent: Agents.PI,
      totalSteps: subStepsCount
    };
  }

  return finalizeTrajectorySummary({
    agent: Agents.PI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
  });
}

export function extractPiMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
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
    for (const msg of entries) {
      let model: string | undefined;
      if (msg.type === 'message' && msg.message?.model) {
        model = msg.message.model;
      } else if (msg.type === 'model_change' && msg.modelId) {
        model = msg.modelId;
      }
      if (!model && msg.metadata?.model) {
        model = msg.metadata.model;
      }
      if (model) {
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      }

      const usage = msg.message?.usage || msg.metadata?.usage || msg.usage;
      if (usage) {
        totalTokens += usage.totalTokens || 0;
        if (usage.cacheRead !== undefined) {
          cachedTokens += usage.cacheRead;
        }
        hasTokenData = true;
      }

      const assistantMsg = msg.type === 'message' ? msg.message : msg;
      if (assistantMsg?.role === 'assistant') {
        const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
        if (assistantMsg.tool_calls) {
          toolCalls.push(...assistantMsg.tool_calls);
        }

        for (const tc of toolCalls) {
          const toolName = tc.function?.name || tc.name;
          if (toolName && toolName !== 'read' && toolName !== 'write' && toolName !== 'edit' && toolName !== 'bash') {
            if (toolName === 'modern-web-guidance' || toolName.includes('get_best_practices')) {
              toolsUsed.add('modern-web-guidance');
            } else {
              toolsUsed.add(toolName);
            }
          }

          const args = tc.arguments || {};
          if (toolName === 'read' && (args.path || args.file_path)) {
            const filePath = (args.path || args.file_path) as string;
            if (filePath.includes('/skills/') || filePath.includes('.agents/skills/')) {
              const match = filePath.match(/\/skills\/[^/]+\/guides\/[^/]+\/([^/]+)\/guide\.md$/) ||
                            filePath.match(/\/skills\/[^/]+\/references\/[^/]+\/([^/]+)\.md$/) ||
                            filePath.match(/\/skills\/[^/]+\/(?:[^/]+\/)*([^/]+)\.md$/);
              if (match && match[1] !== 'guide') {
                fileReadGuides.add(match[1]);
              }
            }
          } else if (toolName === 'bash' && args.command) {
            const command = args.command as string;
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
            }
          }
        }
      }
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

function loadPiLogs(dirPath: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
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

export async function collectPiGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
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
  const { logData, subagentsMap } = loadPiLogs(dirPath);
  const meta = extractPiMetadata(logData, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractPiModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(resultsDir);
  return extractPiMetadata(logData, subagentsMap).model;
}

export function extractPiTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(dir);
  return extractPiMetadata(logData, subagentsMap).tokenUsage;
}

export function collectPiToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(dir);
  return extractPiMetadata(logData, subagentsMap).toolsUsed;
}

/**
 * Executes the Pi CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('pi-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.PI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Pi agent in ${workDir}`);

    const { command, commandArgs } = getPiCommandAndArgs(userPrompt);

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    process.env.PI_CODING_AGENT = 'true';
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Pi'
      );
    } finally {
      stopWatchingMcpLog();
      // Capture trajectory from pi session directory
      const sessionsDir = path.join(path.dirname(workDir), '.pi', 'agent', 'sessions');
      exportTrajectories(sessionsDir, '*.jsonl', targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.PI, userPrompt);
    }

    console.log("Pi agent finished successfully.");

  } catch (err) {
    console.error("Error during Pi execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}

