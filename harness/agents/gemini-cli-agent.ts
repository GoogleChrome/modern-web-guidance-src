import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand } from '../lib/agent-shared.ts';

import type { ConversationRecord } from '@google/gemini-cli-core';

export interface GuidedUsage {
  retrievedGuides: string[];
  fileReadGuides: string[];
}

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

// Usage: node gemini-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string): string {
  const tempHome = createIsolatedHome('ghh-gemini');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const geminiSource = path.join(os.homedir(), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');

  fs.mkdirSync(geminiDest, { recursive: true });

  // Copy necessary auth and identification files
  const filesToCopy = [
    'oauth_creds.json',
    'google_accounts.json',
    'installation_id'
  ];

  for (const file of filesToCopy) {
    const src = path.join(geminiSource, file);
    copyFileIfExists(src, path.join(geminiDest, file));
  }

  // Set environment variables
  process.env.HOME = tempHome;

  // Add GEMINI context and MCP servers for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.GEMINI_CLI, approach === Serving.SKILLS_CLI);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(geminiDest, 'settings.json'),
        suiteConfig.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.GEMINI_CLI
      );
    }
  }

  return workDir;
}

/**
 * Executes the Gemini CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('gemini-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Gemini CLI agent in ${workDir}`);

    const command = config.environment.geminiCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '-o', 'stream-json',
      '--yolo'
    ];

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

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

function readTrajectory(filePath: string): ConversationRecord {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as ConversationRecord;
}

export async function collectGeminiGuidesFromTrajectory(dirPath: string, _serving: string): Promise<GuidedUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  try {
    const files = fs.readdirSync(dirPath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

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
  const sessionFiles = fs.globSync('**/session-*.json', { cwd: resultsDir });
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

export function collectGeminiToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const files = fs.readdirSync(dir);
  const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));
  const firstSession = sessionFiles[0];
  if (!firstSession) return toolsUsed;

  try {
    const sessionPath = path.join(dir, firstSession);
    const session = readTrajectory(sessionPath);
    if (Array.isArray(session.messages)) {
      for (const msg of session.messages) {
        if (msg.type === 'gemini' && Array.isArray(msg.toolCalls)) {
          for (const tc of msg.toolCalls) {
            if (tc.name.includes('get_best_practices')) {
              toolsUsed.push('modern-web');
            } else if (tc.name === 'activate_skill' && tc.args && tc.args.name) {
              toolsUsed.push(tc.args.name as string);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Failed to collect guidance tools used for Gemini CLI:`, e);
  }

  return Array.from(new Set(toolsUsed));
}

export function parseGeminiStreamOutput(outputStr: string, skillName: string = 'modern-web'): {
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
                if (event.tool_name === 'activate_skill' && event.parameters?.name === skillName) {
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
