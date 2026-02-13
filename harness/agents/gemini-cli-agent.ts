import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

import config, { Agents } from '../config.ts';

import { updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, copyAgentContext, parseAgentArgs, createWorkDir, copyResultsToTarget, copySkills } from '../lib/agent-shared.ts';

// Usage: node gemini-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('gemini-cli-agent.ts');

/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(): string {
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
    copyAgentContext(tempHome, Agents.GEMINI_CLI);

    if (config.enableSkills) {
      copySkills(tempHome, Agents.GEMINI_CLI)
    }

    // Update MCP config in isolated home
    updateMcpConfig(
      path.join(geminiDest, 'settings.json'),
      config.mcpServersToEnable,
      config.modernWebServerPath,
      config.mcpApiKey,
      Agents.GEMINI_CLI
    );
  }

  return workDir;
}

/**
 * Executes the Gemini CLI command and captures output.
 */
async function run() {
  const workDir = setupIsolatedWorkDir();

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Gemini CLI agent in ${workDir}`);

    const command = config.geminiCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--yolo'
    ];

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

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

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    // Save output to chat_log.txt
    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

run();
