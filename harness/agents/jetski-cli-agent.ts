import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

// Usage: node jetski-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string): string {
  const tempHome = createIsolatedHome('ghh-jetski-cli');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const jetskiSource = path.join(os.homedir(), '.gemini', 'jetski');
  const jetskiDest = path.join(tempHome, '.gemini', 'jetski');

  fs.mkdirSync(jetskiDest, { recursive: true });

  // Copy necessary auth and identification files
  const filesToCopy = [
    'installation_id',
    'user_settings.pb'
  ];

  for (const file of filesToCopy) {
    const src = path.join(jetskiSource, file);
    copyFileIfExists(src, path.join(jetskiDest, file));
  }

  // Set environment variables
  process.env.HOME = tempHome;
  process.env.JETSKI_DIR = jetskiDest;

  // Add GEMINI context and MCP servers for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.JETSKI_CLI, approach === Serving.SKILLS_CLI);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(jetskiDest, 'mcp_config.json'),
        suiteConfig.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.JETSKI_CLI
      );
    }
  }

  return workDir;
}

/**
 * Executes the Jetski CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Jetski CLI agent in ${workDir}`);

    const command = config.environment.jetskiCliBin;
    const commandArgs = [
      '-p', userPrompt
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
        'Jetski CLI'
      );
    } finally {
      stopWatchingMcpLog();
    }

    // Capture trajectory
    const conversationsDir = path.join(path.dirname(workDir), '.gemini', 'jetski', 'conversations');
    exportTrajectories(conversationsDir, '*.pb', targetDir);

    console.log("Jetski CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Jetski CLI execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
