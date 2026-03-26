import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';

import { updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand } from '../lib/agent-shared.ts';
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
    const approach = config.suite.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.GEMINI_CLI, approach === Serving.SKILLS_CLI);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(geminiDest, 'settings.json'),
        config.suite.mcpServersToEnable,
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

export async function collectGeminiGuidesFromTrajectory(dirPath: string, serving: string): Promise<string[]> {
  const guidesFromSkills: string[] = [];
  try {
    const files = fs.readdirSync(dirPath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(sessionContent);

      if (session.messages) {
        for (const msg of session.messages) {
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              if (serving === Serving.SKILLS && tc.name === 'read_file' && tc.args && tc.args.file_path) {
                const filePath = tc.args.file_path;
                if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                  const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              } else if (serving === Serving.SKILLS_CLI && tc.name === 'run_shell_command' && tc.args && tc.args.command) {
                const command = tc.args.command;
                if (command.includes('modern-web.cjs') && command.includes('--retrieve')) {
                  const match = command.match(/--retrieve\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    const ids = match[1].split(',');
                    for (const id of ids) {
                      guidesFromSkills.push(id.trim());
                    }
                  }
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
  return [...new Set(guidesFromSkills)];
}

export function extractGeminiCliModel(resultsDir: string): string {
  const sessionFiles = fs.globSync('**/session-*.json', { cwd: resultsDir });
  if (sessionFiles.length === 0) return 'unknown';

  const counts: Record<string, number> = {};
  for (const relativePath of sessionFiles as string[]) {
    const sessionPath = path.join(resultsDir, relativePath);
    try {
      const content = fs.readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(content);
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
  const sessionFiles = fs.globSync('session-*.json', { cwd: dir });
  const firstSession = sessionFiles[0];
  if (!firstSession) return toolsUsed;

  try {
    const sessionPath = path.join(dir, firstSession);
    const content = fs.readFileSync(sessionPath, 'utf8');
    const session = JSON.parse(content);
    if (Array.isArray(session.messages)) {
      for (const msg of session.messages) {
        if (Array.isArray(msg.toolCalls)) {
          for (const tc of msg.toolCalls) {
            if (tc.name === 'activate_skill' && tc.args?.name) {
              toolsUsed.push(tc.args.name);
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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
