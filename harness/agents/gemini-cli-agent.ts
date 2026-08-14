import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, watchLogFile, exportTrajectories, runCliAgentCommand, setupIsolatedWorkDir } from '../lib/agent-shared.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';
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
      const tmpDir = path.join(path.dirname(workDir), '.gemini', 'tmp');
      exportTrajectories(tmpDir, '*/chats/*.json', targetDir);
      exportTrajectories(tmpDir, '*/chats/*.jsonl', targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.GEMINI_CLI, userPrompt);
    }

    console.log("Gemini CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Gemini CLI execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
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
