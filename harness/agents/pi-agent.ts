import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, parseJsonlFile, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import {
  type StandardizedStep,
  type SubagentMetadata,
  type TrajectorySummary,
  extractTimestamp,
  mapToolType,
  truncateMessage,
  finalizeTrajectorySummary,
  generateNormalizedTrajectory
} from '../lib/trajectory-parser.ts';

const TRAJECTORY_GLOB = '*.jsonl';

function getSessionFiles(dir: string, recursive = false): string[] {
  if (!fs.existsSync(dir)) return [];
  const pattern = recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB;
  return fs.globSync(pattern, { cwd: dir });
}

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

export function parsePiTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  const toolUseToStepMap = new Map<string, number>();

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
      const assistantMsg = entry.type === 'message' ? entry.message : entry;

      if (assistantMsg?.role === 'assistant' && Array.isArray(assistantMsg.content)) {
        const textBlock = assistantMsg.content.find((b: any) => b.type === 'text');
        const thought = textBlock?.text || '';

        const toolCalls = assistantMsg.content.filter((c: any) => c.type === 'toolCall' || c.type === 'tool_use');
        if (assistantMsg.tool_calls) {
          toolCalls.push(...assistantMsg.tool_calls);
        }

        if (toolCalls.length === 0) {
          if (textBlock?.text) {
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: 'other',
                name: 'respond_to_user',
                params: { response: truncateMessage(textBlock.text, 150) }
              },
              outcome: { status: 'success' }
            });
          }
        } else {
          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name || 'unknown';
            const params = tc.arguments || tc.function?.arguments || tc.input || {};

            let actionType: NonNullable<StandardizedStep['action']>['type'] = mapToolType(toolName);
            if (toolName === 'bash') {
              actionType = 'run_command';
            } else if (toolName === 'write' || toolName === 'edit') {
              actionType = 'write_file';
            } else if (toolName === 'read') {
              actionType = 'read_file';
            }

            const stepIdx = steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: actionType,
                name: toolName,
                params
              }
            }) - 1;

            if (tc.id) {
              toolUseToStepMap.set(tc.id, stepIdx);
            }
          }
        }
      } else if (entry.role === 'user' || entry.type === 'tool_result') {
        const content = entry.content || entry.output || '';
        const toolUseId = entry.tool_use_id || entry.call_id;
        if (toolUseId) {
          const stepIdx = toolUseToStepMap.get(toolUseId);
          if (stepIdx !== undefined && steps[stepIdx]) {
            steps[stepIdx].outcome = {
              status: entry.is_error ? 'error' : 'success',
              message: truncateMessage(content)
            };
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

  const meta = extractPiMetadata(logData, subagentsMap);

  return finalizeTrajectorySummary({
    agent: Agents.PI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: meta.model,
    tokenUsage: meta.tokenUsage,
    toolsUsed: meta.toolsUsed,
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
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
      } else if (msg.metadata?.model) {
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
        const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall' || c.type === 'tool_use') || [];
        if (assistantMsg.tool_calls) {
          toolCalls.push(...assistantMsg.tool_calls);
        }

        for (const contentItem of toolCalls) {
          const args = contentItem.arguments || contentItem.function?.arguments || contentItem.input || {};
          const toolName = contentItem.function?.name || contentItem.name;

          if (toolName === 'modern-web-guidance' || toolName?.includes('get_best_practices')) {
            toolsUsed.add('modern-web-guidance');
          } else if (toolName && toolName !== 'read' && toolName !== 'write' && toolName !== 'edit' && toolName !== 'bash') {
            toolsUsed.add(toolName);
          }

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
              for (const g of match[1].split(',').map((s: string) => s.trim())) {
                retrievedGuides.add(g);
              }
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
    toolsUsed: Array.from(toolsUsed),
    retrievedGuides: Array.from(retrievedGuides),
    fileReadGuides: Array.from(fileReadGuides)
  };
}

export function extractPiModel(resultsDir: string): string {
  const sessionFiles = getSessionFiles(resultsDir, true);
  if (sessionFiles.length === 0) return 'unknown';

  const counts: Record<string, number> = {};
  for (const file of sessionFiles) {
    const sessionPath = path.join(resultsDir, file);
    try {
      const items = parseJsonlFile(sessionPath);
      for (const msg of items) {
        let model: string | undefined;
        if (msg.type === 'message' && msg.message?.model) {
          model = msg.message.model;
        } else if (msg.type === 'model_change' && msg.modelId) {
          model = msg.modelId;
        }
        // Fallback for older formats
        if (!model && msg.metadata?.model) {
          model = msg.metadata.model;
        }

        if (model) {
          counts[model] = (counts[model] || 0) + 1;
        }
      }
    } catch (e) {
      console.warn(`Failed to extract model from ${sessionPath}:`, e);
    }
  }

  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topModel) return topModel[0];

  return 'unknown';
}

export function extractPiTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;
  try {
    const sessionFiles = getSessionFiles(dir, true);
    for (const file of sessionFiles) {
      try {
        const sessionPath = path.join(dir, file);
        const items = parseJsonlFile(sessionPath);
        for (const msg of items) {
          const usage = msg.message?.usage || msg.metadata?.usage || msg.usage;
          if (usage) {
            total += usage.totalTokens || 0;
            if (usage.cacheRead !== undefined) {
              cached += usage.cacheRead;
            }
            hasData = true;
          }
        }
      } catch {
        // Ignore file read errors
      }
    }
  } catch {
    // Ignore
  }
  return hasData ? { total, cached } : undefined;
}

export function collectPiToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  if (sessionFiles.length === 0) return toolsUsed;

  for (const file of sessionFiles) {
    try {
      const sessionPath = path.join(dir, file);
      const items = parseJsonlFile(sessionPath);
      for (const msg of items) {
        const assistantMsg = msg.type === 'message' ? msg.message : msg;
        
        if (assistantMsg?.role === 'assistant') {
          // New format: content array contains toolCall objects
          const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
          // Legacy format fallback: root tool_calls array
          if (assistantMsg.tool_calls) {
            toolCalls.push(...assistantMsg.tool_calls);
          }

          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name;
            if (toolName === 'read' || toolName === 'write' || toolName === 'edit' || toolName === 'bash') {
              // Built-in Pi tools
              continue;
            } else if (toolName === 'modern-web-guidance' || toolName?.includes('get_best_practices')) {
              toolsUsed.push('modern-web-guidance');
            } else if (toolName) {
              toolsUsed.push(toolName);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Failed to collect tools used for Pi:`, e);
    }
  }

  return Array.from(new Set(toolsUsed));
}

export async function collectPiGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  try {
    const sessionFiles = getSessionFiles(dirPath);

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const items = parseJsonlFile(sessionPath);

      for (const entry of items) {
        const assistantMsg = entry.type === 'message' ? entry.message : entry;

        if (assistantMsg?.role === 'assistant') {
          const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
          if (assistantMsg.tool_calls) {
            toolCalls.push(...assistantMsg.tool_calls);
          }

          for (const contentItem of toolCalls) {
            const args = contentItem.arguments || {};
            const toolName = contentItem.function?.name || contentItem.name;

            // Check for read tool accessing skill files
            if (toolName === 'read' && (args.path || args.file_path)) {
              const filePath = (args.path || args.file_path) as string;
              if (filePath.includes('/skills/') || filePath.includes('.agents/skills/')) {
                // Match guide.md files in guides/{category}/{guide-name}/guide.md structure
                const match = filePath.match(/\/skills\/[^/]+\/guides\/[^/]+\/([^/]+)\/guide\.md$/) ||
                              // Match .md files in references/{category}/{guide-name}.md structure  
                              filePath.match(/\/skills\/[^/]+\/references\/[^/]+\/([^/]+)\.md$/) ||
                              // Fallback: match {guide-name}.md in any skills subdirectory (but not guide.md itself)
                              filePath.match(/\/skills\/[^/]+\/(?:[^/]+\/)*([^/]+)\.md$/);
                if (match && match[1] !== 'guide') {
                  fileReadGuides.push(match[1]);
                }
              }
            } else if (toolName === 'bash' && args.command) {
              const command = args.command as string;
              const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
              if (match) {
                retrievedGuides.push(...match[1].split(',').map((s: string) => s.trim()));
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error reading session files in ${dirPath}:`, e);
  }
  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)]
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
