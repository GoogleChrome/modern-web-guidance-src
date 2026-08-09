import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSuiteConfig, cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, parseJsonlFile, copyFileIfExists, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';
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

// NOTE: Native Claude Code logs in ~/.claude/projects are stored without a prefix.
// However, exportClaudeCodeTrajectories() explicitly prepends 'session-' when copying them
// into the test output directory to ensure uniform matching across the dashboard and metrics engine.
const TRAJECTORY_GLOB = '*.jsonl';

function getSessionFiles(dir: string, recursive = false): string[] {
  return fs.globSync(recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB, { cwd: dir });
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
    }

    exportClaudeCodeTrajectories(workDir, targetDir);
    
    try {
      await generateNormalizedTrajectory(targetDir, Agents.CLAUDE_CODE, getSuiteConfig().serving);
    } catch (e: any) {
      console.error("Failed to generate normalized trajectory:", e.message);
    }

    console.log("Claude Code agent finished successfully.");

  } catch (err) {
    console.error("Error during Claude Code execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectClaudeGuidesFromTrajectory(dirPath: string, _serving: string): Promise<GuideUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];

  for (const file of getSessionFiles(dirPath)) {
    const items = parseJsonlFile(path.join(dirPath, file));
    for (const obj of items) {
      const content = obj.message?.content;
      for (const contentItem of Array.isArray(content) ? content : []) {
        if (contentItem.type === 'tool_use' && contentItem.name === 'Bash' && contentItem.input?.command) {
          const command = contentItem.input.command;
          if (command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              retrievedGuides.push(...match[1].split(',').map((s: string) => s.trim()));
            }
          }
        } else if (contentItem.type === 'tool_use' && contentItem.name === 'Read' && contentItem.input?.file_path) {
          const filePath = contentItem.input.file_path;
          if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
            const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
            if (match) {
              fileReadGuides.push(match[1]);
            }
          }
        }
      }
    }
  }
  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)]
  };
}

export function extractClaudeCodeModel(resultsDir: string): string {
  const counts: Record<string, number> = {};
  for (const file of getSessionFiles(resultsDir, true)) {
    const items = parseJsonlFile(path.join(resultsDir, file));
    for (const obj of items) {
      if (obj.message?.model) {
        counts[obj.message.model] = (counts[obj.message.model] || 0) + 1;
      }
    }
  }
  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return topModel ? topModel[0] : 'unknown';
}

export function extractClaudeCodeTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;

  for (const file of getSessionFiles(dir)) {
    const items = parseJsonlFile(path.join(dir, file));
    for (const obj of items) {
      if (obj.message?.usage) {
        const u = obj.message.usage;
        total += (u.output_tokens || 0) + (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
        cached += u.cache_read_input_tokens || 0;
        hasData = true;
      }
    }
  }
  return hasData ? { total, cached } : undefined;
}

export function collectClaudeToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  if (sessionFiles.length === 0) return toolsUsed;

  for (const file of sessionFiles) {
    const items = parseJsonlFile(path.join(dir, file));
    for (const obj of items) {
      const content = obj.message?.content;
      for (const item of Array.isArray(content) ? content : []) {
        if (item.type === 'tool_use') {
          if (item.name === 'Skill' && item.input?.skill) {
            toolsUsed.push(item.input.skill);
          } else if (item.name === 'activate_skill' && item.input?.name) {
            toolsUsed.push(item.input.name);
          }
        }
      }
    }
  }
  return Array.from(new Set(toolsUsed));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
