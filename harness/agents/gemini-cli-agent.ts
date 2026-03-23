import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';

import { updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copyResultsToTarget, copySkills, watchLogFile, exportTrajectories } from '../lib/agent-shared.ts';
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

    process.env.MCP_LOG_DIR = targetDir;
    const stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

    const child = spawn(command, commandArgs, {
      cwd: workDir,
      env: { ...process.env }, // Pass through environment variables (including new HOME)
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout/stderr
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      process.stdout.write(chunk); // Mirror to console
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      process.stderr.write(chunk); // Mirror to console
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    stopWatchingMcpLog();

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    // Save output to chat_log.txt
    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    // Save stderr to agent_stderr.log to surface unexpected problems
    if (stderrData.length > 0) {
      const stderrLogPath = path.join(targetDir, 'agent_stderr.log');
      fs.writeFileSync(stderrLogPath, stderrData, 'utf8');
      console.log(`Saved stderr to: ${stderrLogPath}`);
    }

    // Extract trajectory JSON from isolated home
    const tmpDir = path.join(path.dirname(workDir), '.gemini', 'tmp');
    exportTrajectories(tmpDir, '*/chats/*.json', targetDir);

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exit(1);
  } finally {
    // Comment out if you need to inspect trajectories.
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectGeminiCliGuides(dirPath: string, serving: string): Promise<string[]> {
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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
