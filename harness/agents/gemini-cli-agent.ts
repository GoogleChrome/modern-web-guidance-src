import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, parseJsonlFile, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';
import type { ConversationRecord } from '@google/gemini-cli-core';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

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
    }

    const tmpDir = path.join(path.dirname(workDir), '.gemini', 'tmp');
    exportTrajectories(tmpDir, '*/chats/*.json', targetDir);
    exportTrajectories(tmpDir, '*/chats/*.jsonl', targetDir);

    try {
      await generateNormalizedTrajectory(targetDir, Agents.GEMINI_CLI, getSuiteConfig().serving);
    } catch (e: any) {
      console.error("Failed to generate normalized trajectory:", e.message);
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

export async function collectGeminiGuidesFromTrajectory(dirPath: string, _serving: string): Promise<GuideUsage> {
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
                  // Prioritize guide.md folder name, fallback to reference filename
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
