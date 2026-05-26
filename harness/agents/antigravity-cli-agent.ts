import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

// Usage: node antigravity-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string): string {
  const tempHome = createIsolatedHome('ghh-antigravity');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const geminiSource = path.join(os.homedir(), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');

  const antigravitySource = path.join(geminiSource, 'antigravity-cli');
  const antigravityDest = path.join(geminiDest, 'antigravity-cli');

  fs.mkdirSync(antigravityDest, { recursive: true });

  // Copy necessary auth and identification files
  const filesToCopy = [
    'oauth_creds.json',
    'google_accounts.json',
    'installation_id'
  ];

  for (const file of filesToCopy) {
    const src = path.join(geminiSource, file);
    copyFileIfExists(src, path.join(geminiDest, file));
    copyFileIfExists(src, path.join(antigravityDest, file));
  }

  // Copy local internal state parameters if present
  const internalFiles = [
    'installation_id',
    'user_settings.pb'
  ];

  for (const file of internalFiles) {
    const src = path.join(geminiSource, 'jetski', file);
    const destJetskiDir = path.join(geminiDest, 'jetski');
    fs.mkdirSync(destJetskiDir, { recursive: true });
    copyFileIfExists(src, path.join(destJetskiDir, file));

    // Fallback for antigravity-cli custom settings
    const antigravitySrc = path.join(antigravitySource, file);
    copyFileIfExists(antigravitySrc, path.join(antigravityDest, file));
  }

  // Symlink Keychains to bypass authentication prompt by allowing secure credential lookup (keytar)
  const keychainsSource = path.join(os.homedir(), 'Library/Keychains');
  const keychainsDest = path.join(tempHome, 'Library/Keychains');
  fs.mkdirSync(path.dirname(keychainsDest), { recursive: true });
  try {
    fs.symlinkSync(keychainsSource, keychainsDest);
  } catch (err: any) {
    console.warn('Warning: Failed to symlink Keychains:', err.message);
  }

  // Create a clean, uncomplicated sandboxed settings.json to disable the terminal sandbox restrictions
  // so the agent can write project files natively inside the active project workspace directory.
  const settingsPath = path.join(antigravityDest, 'settings.json');
  try {
    const settings = {
      enableTerminalSandbox: false
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Created clean sandboxed settings.json: ${settingsPath}`);
  } catch (err: any) {
    console.warn('Warning: Failed to write sandboxed settings.json:', err.message);
  }

  // Set environment variables
  process.env.HOME = tempHome;
  process.env.ANTIGRAVITY_DIR = antigravityDest;

  // Add SKILL context and MCP servers for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      // By default under agent-shared.ts copySkills falls into the `else` block mapping to `.gemini/skills` 
      // which agy natively scans and supports as a shared global backward-compatible directory.
      copySkills(tempHome, Agents.ANTIGRAVITY_CLI, approach === Serving.SKILLS_CLI, suiteConfig.skillsToEnable);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(antigravityDest, 'settings.json'),
        suiteConfig.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.ANTIGRAVITY_CLI
      );
    }
  }

  return workDir;
}

/**
 * Executes the Antigravity CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('antigravity-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  const tempHome = path.dirname(workDir);

  try {
    console.log(`Starting Antigravity CLI agent in ${workDir}`);

    const command = config.environment.antigravityCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--dangerously-skip-permissions'
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
        'Antigravity CLI'
      );
    } finally {
      stopWatchingMcpLog();
    }

    // Capture trajectory databases and protos
    const conversationsDir = path.join(tempHome, '.gemini', 'antigravity-cli', 'conversations');
    exportTrajectories(conversationsDir, '*.pb', targetDir);
    exportTrajectories(conversationsDir, '*.db', targetDir);
    exportTrajectories(conversationsDir, '*.json', targetDir);
    exportTrajectories(conversationsDir, '*.jsonl', targetDir);

    console.log("Antigravity CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Antigravity CLI execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(tempHome);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
