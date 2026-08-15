import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, parseJsonlFile, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';
import type { ConversationRecord } from '@google/gemini-cli-core';
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
} from '../lib/trajectory-normalizer.ts';

export function setupGeminiCliCredentials(tempHome: string): string {
  const originalHome = process.env.HOME || process.cwd();
  const geminiSource = path.join(originalHome, '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');

  fs.mkdirSync(geminiDest, { recursive: true });

  const filesToCopy = [
    'oauth_creds.json',
    'google_accounts.json',
    'installation_id',
    'settings.json',
  ];

  for (const file of filesToCopy) {
    copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
  }

  process.env.GEMINI_CLI_TRUST_WORKSPACE = 'true';
  return geminiDest;
}

export function getGeminiCliCommandAndArgs(prompt: string, extraArgs: string[] = []): { command: string; commandArgs: string[] } {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, ...extraArgs, '--yolo'];
  return { command, commandArgs };
}

const TRAJECTORY_GLOB = 'session-*.{json,jsonl}';

function getSessionFiles(dir: string, recursive = false): string[] {
  return fs.globSync(recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB, { cwd: dir });
}

/**
 * Executes the Gemini CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('gemini-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.GEMINI_CLI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Gemini CLI agent in ${workDir}`);

    const { command, commandArgs } = getGeminiCliCommandAndArgs(userPrompt, ['-o', 'stream-json']);

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
        'Gemini CLI'
      );
    } finally {
      stopWatchingMcpLog();
      const tmpDir = path.join(path.dirname(workDir), '.gemini', 'tmp');
      exportTrajectories(tmpDir, '*/chats/*.json', targetDir);
      exportTrajectories(tmpDir, '*/chats/*.jsonl', targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.GEMINI_CLI, userPrompt);
    }

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

function readTrajectory(filePath: string): ConversationRecord {
  if (filePath.endsWith('.jsonl')) {
    const messages = parseJsonlFile(filePath);
    return { messages } as unknown as ConversationRecord;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as ConversationRecord;
}

export function parseGeminiTrajectory(session: any, subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  const messages = Array.isArray(session) ? session : (session.messages || []);
  let lastAssistantStepIndices: number[] = [];

  const processMessages = (msgList: any[], subagentId?: string) => {
    for (const msg of msgList) {
      const timestamp = extractTimestamp(msg) || extractTimestamp(session);
      const role = msg.type || msg.role || 'unknown';

      if (role === 'gemini') {
        lastAssistantStepIndices = [];
        const thought = msg.thought || msg.text || '';
        const toolCalls = msg.toolCalls || [];
        if (toolCalls.length === 0) {
          steps.push({
            stepNumber: 0,
            timestamp,
            subagentId,
            thought,
            action: msg.text ? {
              type: 'other',
              name: 'respond_to_user',
              params: { response: truncateMessage(msg.text, 150) }
            } : undefined,
            outcome: { status: 'success' }
          });
        } else {
          for (const tc of toolCalls) {
            const stepIdx = steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: mapToolType(tc.name || ''),
                name: tc.name || 'unknown',
                params: tc.args
              }
            }) - 1;
            lastAssistantStepIndices.push(stepIdx);
          }
        }
      } else if (role === 'user' && lastAssistantStepIndices.length > 0) {
        const toolResults = msg.toolResults || [];
        toolResults.forEach((tr: any, idx: number) => {
          const stepIdx = lastAssistantStepIndices[idx];
          if (stepIdx !== undefined && steps[stepIdx]) {
            steps[stepIdx].outcome = {
              status: tr.error || tr.status === 'error' ? 'error' : 'success',
              message: truncateMessage(tr.output || tr.content || tr.error || '')
            };
          }
        });
        lastAssistantStepIndices = [];
      }
    }
  };

  processMessages(messages);
  for (const [subId, subSession] of Object.entries(subagentsMap)) {
    const subList = Array.isArray(subSession) ? subSession : ((subSession as any)?.messages || []);
    processMessages(subList, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    subagentsMeta[subId] = { id: subId, agent: Agents.GEMINI_CLI, totalSteps: subStepsCount };
  }

  const meta = extractGeminiMetadata(session, subagentsMap);

  return finalizeTrajectorySummary({
    agent: Agents.GEMINI_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: meta.model,
    tokenUsage: meta.tokenUsage,
    toolsUsed: meta.toolsUsed,
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
  });
}

export function extractGeminiMetadata(session: any, subagentsMap: Record<string, any[]> = {}): {
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

  const messages = Array.isArray(session) ? session : (session.messages || []);
  const processMessages = (msgList: any[]) => {
    const messagesWithTokens = msgList.filter(m => m && typeof m === 'object' && 'tokens' in m);
    const lastMsg = messagesWithTokens[messagesWithTokens.length - 1];
    if (lastMsg) {
      totalTokens += lastMsg.tokens.total || 0;
      cachedTokens += lastMsg.tokens.cached || 0;
      hasTokenData = true;
    }

    for (const msg of msgList) {
      if (msg.type === 'gemini') {
        if (msg.model) {
          modelCounts[msg.model] = (modelCounts[msg.model] || 0) + 1;
        }
        if (Array.isArray(msg.toolCalls)) {
          for (const tc of msg.toolCalls) {
            if (tc.name.includes('get_best_practices')) {
              toolsUsed.add('modern-web-guidance');
              if (tc.args?.use_case_id) {
                retrievedGuides.add(tc.args.use_case_id);
              }
            } else if (tc.name === 'activate_skill' && tc.args?.name) {
              toolsUsed.add(tc.args.name);
            } else if (tc.name === 'read_file' && tc.args?.file_path) {
              const filePath = tc.args.file_path;
              if (filePath.includes('/skills/')) {
                const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/) ||
                  filePath.match(/\/skills\/[^/]+\/(?:references\/)?(?:[^/]+\/)*([^/]+)\.md$/);
                if (match) {
                  fileReadGuides.add(match[1]);
                }
              }
            } else if (tc.name === 'run_shell_command' && tc.args?.command) {
              const command = tc.args.command;
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
    }
  };

  processMessages(messages);
  for (const subSession of Object.values(subagentsMap)) {
    const subList = Array.isArray(subSession) ? subSession : ((subSession as any)?.messages || []);
    processMessages(subList);
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

export function loadGeminiLogs(dir: string): { logData: any; subagentsMap: Record<string, any[]> } {
  let logData: any = null;
  const subagentsMap: Record<string, any[]> = {};
  const files = getSessionFiles(dir);

  const mainFiles = files.filter(f => !f.startsWith('subagent-')).sort();
  const subFiles = files.filter(f => f.startsWith('subagent-')).sort();

  if (mainFiles.length > 0) {
    logData = readTrajectory(path.join(dir, mainFiles[0]));
  }

  for (const file of subFiles) {
    const subId = file.replace(/^subagent-(?:subagents-)?(?:agent-)?/, '').replace(/\.(?:json|jsonl)$/, '');
    const content = readTrajectory(path.join(dir, file));
    subagentsMap[subId] = Array.isArray(content) ? content : (content.messages || []);
  }

  return { logData, subagentsMap };
}

export async function collectGeminiGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  try {
    const sessionFiles = getSessionFiles(dirPath);

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const session = readTrajectory(sessionPath);

      if (session.messages) {
        for (const msg of session.messages) {
          if (msg.type === 'gemini' && msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              if (tc.name.includes('get_best_practices') && tc.args?.use_case_id) {
                retrievedGuides.push(tc.args.use_case_id as string);
              } else if (tc.name === 'read_file' && tc.args?.file_path) {
                const filePath = tc.args.file_path as string;
                if (filePath.includes('/skills/')) {
                  const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/) ||
                                filePath.match(/\/skills\/[^/]+\/(?:references\/)?(?:[^/]+\/)*([^/]+)\.md$/);
                  if (match) {
                    fileReadGuides.push(match[1]);
                  }
                }
              } else if (tc.name === 'run_shell_command' && tc.args?.command) {
                const command = tc.args.command as string;
                const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
                if (match) {
                  retrievedGuides.push(...match[1].split(',').map(s => s.trim()));
                }
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

export function extractGeminiCliModel(resultsDir: string): string {
  const sessionFiles = getSessionFiles(resultsDir, true);
  if (sessionFiles.length === 0) return 'unknown';

  const counts: Record<string, number> = {};
  for (const relativePath of sessionFiles as string[]) {
    const sessionPath = path.join(resultsDir, relativePath);
    try {
      const session = readTrajectory(sessionPath);
      if (session.messages) {
        for (const m of session.messages) {
          if (m.type === 'gemini' && m.model) {
            counts[m.model] = (counts[m.model] || 0) + 1;
          }
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

export function extractGeminiCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;
  try {
    const sessionFiles = getSessionFiles(dir);
    for (const file of sessionFiles) {
      try {
        const session = readTrajectory(path.join(dir, file));
        if (session.messages) {
          const messagesWithTokens = (session.messages as any[]).filter(m => m && typeof m === 'object' && 'tokens' in m) as Array<{ tokens: { total?: number; cached?: number } }>;
          const lastMsg = messagesWithTokens[messagesWithTokens.length - 1];
          if (lastMsg) {
            total += lastMsg.tokens.total || 0;
            cached += lastMsg.tokens.cached || 0;
            hasData = true;
          }
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }
  return hasData ? { total, cached } : undefined;
}

export function collectGeminiToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  if (sessionFiles.length === 0) return toolsUsed;

  for (const sessionFile of sessionFiles) {
    try {
      const sessionPath = path.join(dir, sessionFile);
      const session = readTrajectory(sessionPath);
      if (Array.isArray(session.messages)) {
        for (const msg of session.messages) {
          if (msg.type === 'gemini' && Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
              if (tc.name.includes('get_best_practices')) {
                toolsUsed.push('modern-web-guidance');
              } else if (tc.name === 'activate_skill' && tc.args && tc.args.name) {
                toolsUsed.push(tc.args.name as string);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(`Failed to collect guidance tools used for Gemini CLI in ${sessionFile}:`, e);
    }
  }

  return Array.from(new Set(toolsUsed));
}

export function parseGeminiStreamOutput(outputStr: string, _skillName: string = 'modern-web-guidance'): {
    skillActivated: boolean;
    searchCalled: boolean;
    retrieveCalled: boolean;
} {
    const lines = outputStr.split('\n');
    let skillActivated = false;
    let searchCalled = false;
    let retrieveCalled = false;
    
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const event = JSON.parse(line);
            if (event.type === 'tool_use') {
                if (event.tool_name === 'activate_skill' && event.parameters?.name && event.parameters.name.startsWith('modern-web')) {
                    skillActivated = true;
                }
                if (event.tool_name === 'run_shell_command') {
                    const command = event.parameters?.command || '';
                    if (command.includes('search') || command.includes('--search')) {
                        searchCalled = true;
                    }
                    if (command.includes('retrieve') || command.includes('--retrieve')) {
                        retrieveCalled = true;
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    return { skillActivated, searchCalled, retrieveCalled };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
