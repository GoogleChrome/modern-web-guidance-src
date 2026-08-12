import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, setupIsolatedWorkDir } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';

const TRAJECTORY_GLOB = '*.jsonl';

function getSessionFiles(dir: string, recursive = false): string[] {
  if (!fs.existsSync(dir)) return [];
  const pattern = recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB;
  return fs.globSync(pattern, { cwd: dir });
}

export function setupPiCredentials(tempHome: string): void {
  const piSource = path.join(os.homedir(), '.pi');
  const piDest = path.join(tempHome, '.pi');
  const piDestAgent = path.join(piDest, 'agent');

  fs.mkdirSync(piDestAgent, { recursive: true });

  // Copy necessary auth and configuration files
  const filesToCopy = [
    'settings.json',
    'trust.json',
    'auth.json',  // Copy auth.json to provide API credentials in isolated env
    'models-store.json'  // Copy models store so Pi knows about available models
  ];

  for (const file of filesToCopy) {
    const src = path.join(piSource, 'agent', file);
    copyFileIfExists(src, path.join(piDestAgent, file));
  }

  process.env.PI_CODING_AGENT_DIR = piDestAgent;
}

export function getPiCommandAndArgs(prompt: string, extraArgs: string[] = []): { command: string; commandArgs: string[] } {
  const command = config.environment.piBin || 'pi';
  const piModel = process.env.PI_MODEL || process.env.PROMPT_MODEL;
  const modelArg = piModel ? ['--model', piModel] : [];

  // Allow overriding --no-session via env var for trajectory testing
  const noSession = process.env.PI_NO_SESSION !== 'false';
  const sessionArgs = noSession ? ['--no-session'] : [];

  const commandArgs = [
    '-p', // print mode: non-interactive, process and exit
    ...sessionArgs, // ephemeral mode: don't save session (unless disabled)
    '--offline', // disable network operations for update checks
    ...modelArg,
    ...extraArgs,
    prompt
  ];
  return { command, commandArgs };
}

/**
 * Executes the Pi CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('pi-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.PI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Pi agent in ${workDir}`);

    const { command, commandArgs } = getPiCommandAndArgs(userPrompt);

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    process.env.PI_CODING_AGENT = 'true';
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Pi'
      );
    } finally {
      stopWatchingMcpLog();
    }

    // Capture trajectory from pi session directory
    const sessionsDir = path.join(path.dirname(workDir), '.pi', 'agent', 'sessions');
    exportTrajectories(sessionsDir, '*.jsonl', targetDir);

    console.log("Pi agent finished successfully.");

    await generateNormalizedTrajectory(targetDir, Agents.PI, userPrompt);

  } catch (err) {
    console.error("Error during Pi execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}



const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
