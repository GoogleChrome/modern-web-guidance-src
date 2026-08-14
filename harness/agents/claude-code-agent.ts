import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, copyFileIfExists, setupIsolatedWorkDir } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateClaudeTrajectoryHtml } from '../lib/claude-trajectory-viewer.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';

export function setupClaudeCodeCredentials(tempHome: string): void {
  const gcloudConfigDest = path.join(tempHome, '.config', 'gcloud');
  fs.mkdirSync(gcloudConfigDest, { recursive: true });
  copyFileIfExists(config.environment.gcpCredentials, path.join(gcloudConfigDest, 'application_default_credentials.json'));
}

export function getClaudeCodeCommandAndArgs(prompt: string, extraArgs: string[] = []): { command: string; commandArgs: string[] } {
  const command = config.environment.claudeCodeCliBin;
  const model = process.env.ANTHROPIC_MODEL;
  const commandArgs = [
    '-p', prompt,
    '--dangerously-skip-permissions',
    ...extraArgs,
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}

function exportClaudeCodeTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const claudeLogDir = path.join(tempHome, '.claude', 'projects');
  
  if (!fs.existsSync(claudeLogDir)) {
    return;
  }

  // Find all jsonl files in the Claude projects directory
  const files = fs.globSync('**/*.jsonl', { cwd: claudeLogDir });
  const parsedSessions: { relativePath: string; baseName: string; logData: any[] }[] = [];
  const subagentsMap: Record<string, any[]> = {};

  // Step 1: Read all JSONL files and populate subagentsMap
  for (const relativePath of files as string[]) {
    const src = path.join(claudeLogDir, relativePath);
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    const isSubagent = relativePath.includes('subagents/');
    const rawDestName = isSubagent ? `subagent-${baseName}.jsonl` : `session-${baseName}.jsonl`;
    fs.copyFileSync(src, path.join(targetDir, rawDestName));

    const logContent = fs.readFileSync(src, 'utf8');
    const jsonLines = logContent.split(/\r?\n/).filter(Boolean);
    const logData = jsonLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.error("Failed to parse JSONL line:", e);
        return { error: "Failed to parse line", raw: line };
      }
    });

    parsedSessions.push({ relativePath, baseName, logData });

    // Match subagent ID if this is a subagent file
    const match = relativePath.match(/subagents[/\\]agent-([a-zA-Z0-9_-]+)\.jsonl$/);
    if (match && match[1]) {
      subagentsMap[match[1]] = logData;
    }
  }

  // Step 2: Generate HTML viewers embedding subagent trajectories where referenced (main sessions only)
  for (const session of parsedSessions) {
    if (!session.relativePath.includes('subagents/')) {
      const htmlContent = generateClaudeTrajectoryHtml(session.logData, subagentsMap);
      const destName = `session-${session.baseName}.html`;
      const dest = path.join(targetDir, destName);
      fs.writeFileSync(dest, htmlContent, 'utf8');
    }
  }
}

/**
 * Executes the Claude CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('claude-code-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.CLAUDE_CODE, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Claude Code agent in: ${workDir}`);

    const { command, commandArgs } = getClaudeCodeCommandAndArgs(userPrompt, ['--verbose', '--output-format', 'stream-json']);

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
        'Claude Code'
      );
    } finally {
      stopWatchingMcpLog();
      exportClaudeCodeTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.CLAUDE_CODE, userPrompt);
    }

    console.log("Claude Code agent finished successfully.");

  } catch (err) {
    console.error("Error during Claude Code execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}



const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
