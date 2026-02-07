import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import config from '../config.ts';

import { updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, createTrustedFolders } from '../lib/agent-shared.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Usage: node gemini-cli-agent.ts <directory> <prompt> [runType]
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node gemini-cli-agent.ts <directory> <prompt> [runType]");
  process.exit(1);
}
const [targetDirectory, userPrompt, runType] = args;
const absoluteTargetDir = path.resolve(targetDirectory);

/**
 * Sets up an isolated HOME directory to ensure test isolation while preserving authentication.
 * @returns {string} The path to the temporary HOME directory.
 */
function setupIsolatedHome(): string {
  const tempHome = createIsolatedHome('ghh-gemini');

  const geminiSource = path.join(os.homedir(), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');

  fs.mkdirSync(geminiDest, { recursive: true });

  // Copy necessary auth and identification files
  const filesToCopy = [
    'oauth_creds.json',
    'google_accounts.json',
    'installation_id',
    'settings.json'
  ];

  for (const file of filesToCopy) {
    const src = path.join(geminiSource, file);
    copyFileIfExists(src, path.join(geminiDest, file));
  }

  createTrustedFolders(geminiDest, [absoluteTargetDir, projectRoot]);

  // Set environment variables for the current process (and children)
  process.env.HOME = tempHome;

  // Point config to the isolated .gemini
  config.geminiDir = geminiDest;

  return tempHome;
}

/**
 * Executes the Gemini CLI command and captures output.
 */
async function run() {
  let tempHome: string | null = null;
  try {
    console.log(`Starting Gemini CLI agent in: ${absoluteTargetDir}`);
    console.log(`Included workspace: ${projectRoot}`);

    // Setup isolated environment
    tempHome = setupIsolatedHome();

    // Ensure the target directory exists
    if (!fs.existsSync(absoluteTargetDir)) {
      fs.mkdirSync(absoluteTargetDir, { recursive: true });
    }

    updateMcpConfig(path.join(config.geminiDir, 'settings.json'), runType, config.mcpApiKey, 'gemini_cli');

    const command = config.geminiCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--yolo',
      '--include-directories', projectRoot
    ];


    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    const child = spawn(command, commandArgs, {
      cwd: absoluteTargetDir,
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

    // Save output to chat_log.txt to mimic Jetski agent
    const chatLogPath = path.join(absoluteTargetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exit(1);
  } finally {
    if (tempHome) {
      cleanupIsolatedHome(tempHome);
    }
  }
}

run();
