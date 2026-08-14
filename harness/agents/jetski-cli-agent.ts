import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, createTrustedFolders, copyFileIfExists, setupIsolatedWorkDir } from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';

export function setupJetskiCliCredentials(tempHome: string): string {
  const originalHome = process.env.HOME || process.cwd();
  const jetskiSource = path.join(originalHome, '.gemini', 'jetski');
  const jetskiDest = path.join(tempHome, '.gemini', 'jetski');
  const geminiDest = path.join(tempHome, '.gemini');

  fs.mkdirSync(jetskiDest, { recursive: true });

  const filesToCopy = [
    'installation_id',
    'user_settings.pb',
  ];

  for (const file of filesToCopy) {
    copyFileIfExists(path.join(jetskiSource, file), path.join(jetskiDest, file));
  }

  process.env.JETSKI_DIR = jetskiDest;
  createTrustedFolders(geminiDest, [tempHome]);
  return jetskiDest;
}

export function getJetskiCliCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.jetskiCliBin;
  const model = process.env.JETSKI_MODEL;
  const commandArgs = [
    '-p', prompt,
    '--dangerously-skip-permissions',
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}



/**
 * Executes the Jetski CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.JETSKI_CLI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Jetski CLI agent in ${workDir}`);

    const { command, commandArgs } = getJetskiCliCommandAndArgs(userPrompt);

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
      // Capture trajectory
      const conversationsDir = path.join(path.dirname(workDir), '.gemini', 'jetski', 'conversations');
      exportTrajectories(conversationsDir, '*.pb', targetDir);
      exportTrajectories(conversationsDir, '*.db', targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.JETSKI_CLI, userPrompt);
    }

    console.log("Jetski CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Jetski CLI execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}



const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
