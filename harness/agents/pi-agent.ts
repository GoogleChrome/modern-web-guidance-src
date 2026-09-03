import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents } from '../config.ts';
import { parseBooleanEnv } from '../../lib/env.ts';
import {
  cleanupIsolatedHome,
  copyFileIfExists,
  parseAgentArgs,
  watchLogFile,
  runCliAgentCommand,
  parseJsonlFile,
  setupIsolatedWorkDir,
  type GuideUsage
} from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
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

const MAX_RESPONSE_PREVIEW_LENGTH = 150;

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

  // By default, sessions should be preserved so trajectories can be captured and graded.
  // Allow running in ephemeral mode only if explicitly enabled via PI_NO_SESSION=true/1/yes.
  const noSession = parseBooleanEnv(process.env.PI_NO_SESSION, false);
  const sessionArgs = noSession ? ['--no-session'] : [];

  const commandArgs = [
    '-p', // print mode: non-interactive, process and exit
    ...sessionArgs, // ephemeral mode: only if explicitly requested
    '--offline', // disable network operations for update checks
    ...modelArg,
    ...extraArgs,
    prompt
  ];
  return { command, commandArgs };
}

export function exportPiTrajectories(workDir: string, targetDir: string): void {
  const sessionsDir = path.join(path.dirname(workDir), '.pi', 'agent', 'sessions');
  if (!fs.existsSync(sessionsDir)) return;

  const files = fs.globSync('**/*.jsonl', { cwd: sessionsDir });
  for (const relativePath of files) {
    const src = path.join(sessionsDir, relativePath);
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    const isSubagent = relativePath.includes('subagent');
    const destName = isSubagent
      ? (baseName.startsWith('subagent-') ? `${baseName}.jsonl` : `subagent-${baseName}.jsonl`)
      : (baseName.startsWith('session-') ? `${baseName}.jsonl` : `session-${baseName}.jsonl`);
    fs.copyFileSync(src, path.join(targetDir, destName));
  }
}

/**
 * Executes the Pi CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('pi-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.PI, templateDir, runType, targetDir);

  if (!workDir) {
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
      exportPiTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.PI, userPrompt);
    }

    console.log('Pi agent finished successfully.');
  } catch (err) {
    console.error('Error during Pi execution:', err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export function parsePiTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  const toolUseToStepMap = new Map<string, number>();

  const modelCounts: Record<string, number> = {};
  let totalTokens = 0;
  let cachedTokens = 0;
  let hasTokenData = false;
  const toolsUsed = new Set<string>();
  const retrievedGuides = new Set<string>();
  const fileReadGuides = new Set<string>();
  const subagentStepCounts: Record<string, number> = {};

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      let model: string | undefined;
      if (entry.type === 'message' && entry.message?.model) {
        model = entry.message.model;
      } else if (entry.type === 'model_change' && entry.modelId) {
        model = entry.modelId;
      } else if (entry.metadata?.model) {
        model = entry.metadata.model;
      }

      if (model) {
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      }

      const usage = entry.message?.usage || entry.metadata?.usage || entry.usage;
      if (usage) {
        totalTokens += usage.totalTokens || 0;
        if (usage.cacheRead !== undefined) {
          cachedTokens += usage.cacheRead;
        }
        hasTokenData = true;
      }

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
                params: { response: truncateMessage(textBlock.text, MAX_RESPONSE_PREVIEW_LENGTH) }
              },
              outcome: { status: 'success' }
            });
            if (subagentId) {
              subagentStepCounts[subagentId] = (subagentStepCounts[subagentId] || 0) + 1;
            }
          }
        } else {
          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name || 'unknown';
            const params = tc.arguments || tc.function?.arguments || tc.input || {};

            if (toolName === 'modern-web-guidance' || toolName.includes('get_best_practices')) {
              toolsUsed.add('modern-web-guidance');
            } else if (toolName !== 'unknown' && toolName !== 'read' && toolName !== 'write' && toolName !== 'edit' && toolName !== 'bash') {
              toolsUsed.add(toolName);
            }

            if (toolName === 'read' && (params.path || params.file_path)) {
              const filePath = (params.path || params.file_path) as string;
              if (filePath.includes('/skills/') || filePath.includes('.agents/skills/')) {
                const match = filePath.match(/\/skills\/[^/]+\/guides\/[^/]+\/([^/]+)\/guide\.md$/) ||
                              filePath.match(/\/skills\/[^/]+\/references\/[^/]+\/([^/]+)\.md$/) ||
                              filePath.match(/\/skills\/[^/]+\/(?:[^/]+\/)*([^/]+)\.md$/);
                if (match && match[1] !== 'guide') {
                  fileReadGuides.add(match[1]);
                }
              }
            } else if (toolName === 'bash' && params.command) {
              const command = params.command as string;
              if (command.includes('modern-web-guidance') && command.includes('retrieve')) {
                const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
                if (match) {
                  for (const g of match[1].split(',').map((s: string) => s.trim())) {
                    retrievedGuides.add(g);
                  }
                }
              }
            }

            const stepIdx = steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: mapToolType(toolName),
                name: toolName,
                params
              }
            }) - 1;

            if (subagentId) {
              subagentStepCounts[subagentId] = (subagentStepCounts[subagentId] || 0) + 1;
            }

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
    const subStepsCount = subagentStepCounts[subId] || 0;
    subagentsMeta[subId] = {
      id: subId,
      agent: Agents.PI,
      totalSteps: subStepsCount
    };
  }

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  return finalizeTrajectorySummary({
    agent: Agents.PI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: topModel ? topModel[0] : 'unknown',
    tokenUsage: hasTokenData ? { total: totalTokens, cached: cachedTokens } : undefined,
    toolsUsed: Array.from(toolsUsed),
    retrievedGuides: Array.from(retrievedGuides),
    fileReadGuides: Array.from(fileReadGuides)
  });
}

export function extractPiMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
  model: string;
  tokenUsage?: { total: number; cached: number };
  toolsUsed: string[];
  retrievedGuides: string[];
  fileReadGuides: string[];
} {
  const summary = parsePiTrajectory(logData, subagentsMap);
  return {
    model: summary.model || 'unknown',
    tokenUsage: summary.tokenUsage,
    toolsUsed: summary.toolsUsed || [],
    retrievedGuides: summary.retrievedGuides || [],
    fileReadGuides: summary.fileReadGuides || []
  };
}

export function loadPiLogs(dir: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};
  const files = getSessionFiles(dir);

  const mainFiles = files.filter(f => !f.startsWith('subagent-')).sort();
  const subFiles = files.filter(f => f.startsWith('subagent-')).sort();

  for (const file of mainFiles) {
    try {
      logData.push(...parseJsonlFile(path.join(dir, file)));
    } catch {}
  }

  for (const file of subFiles) {
    try {
      const subId = file.replace(/^subagent-(?:subagents-)?(?:agent-)?/, '').replace(/\.jsonl$/, '');
      subagentsMap[subId] = parseJsonlFile(path.join(dir, file));
    } catch {}
  }

  return { logData, subagentsMap };
}

function getPiMetadataForDir(dir: string): ReturnType<typeof extractPiMetadata> {
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
  const { logData, subagentsMap } = loadPiLogs(dir);
  return extractPiMetadata(logData, subagentsMap);
}

export async function collectPiGuidesFromTrajectory(dirPath: string): Promise<GuideUsage> {
  const meta = getPiMetadataForDir(dirPath);
  return {
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
  };
}

export function extractPiModel(resultsDir: string): string {
  return getPiMetadataForDir(resultsDir).model;
}

export function extractPiTokenUsage(dir: string): { total: number; cached: number } | undefined {
  return getPiMetadataForDir(dir).tokenUsage;
}

export function collectPiToolsFromTrajectory(dir: string): string[] {
  return getPiMetadataForDir(dir).toolsUsed;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}

