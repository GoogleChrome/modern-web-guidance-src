import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSuiteConfig, createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, copyFileIfExists, updateMcpConfig, createWorkDir, copySkills, watchLogFile, runCliAgentCommand } from '../lib/agent-shared.ts';
import config, { Agents, Serving } from '../config.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateClaudeTrajectoryHtml } from '../lib/claude-trajectory-viewer.ts';


// Usage: node claude-code-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string): string {
  const tempHome = createIsolatedHome('ghh-claude');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  // Copy GCP credentials (for Vertex auth)
  const gcloudConfigDest = path.join(tempHome, '.config/gcloud');
  fs.mkdirSync(gcloudConfigDest, { recursive: true });
  copyFileIfExists(config.environment.gcpCredentials, path.join(gcloudConfigDest, 'application_default_credentials.json'));

  // Set environment variables
  process.env.HOME = tempHome;

  // Add CLAUDE context and MCP servers for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.CLAUDE_CODE, approach === Serving.SKILLS_CLI);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(tempHome, '.claude.json'),
        suiteConfig.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.CLAUDE_CODE
      );
    }
  }

  return workDir;
}

function exportClaudeCodeTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const claudeLogDir = path.join(tempHome, '.claude', 'projects');
  
  if (!fs.existsSync(claudeLogDir)) {
    return;
  }

  // Find all jsonl files in the Claude projects directory
  const files = fs.globSync('**/*.jsonl', { cwd: claudeLogDir });
  
  for (const relativePath of files as string[]) {
    const src = path.join(claudeLogDir, relativePath);
    
    // 1. Determine base name and copy original JSONL file to targetDir
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    const rawDestName = `session-${baseName}.jsonl`;
    fs.copyFileSync(src, path.join(targetDir, rawDestName));

    // 2. Read and parse JSONL
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

    // 3. Generate and save the HTML viewer
    const htmlContent = generateClaudeTrajectoryHtml(logData);

    // 4. Save HTML viewer to target directory
    const destName = `session-${baseName}.html`;
    const dest = path.join(targetDir, destName);
    fs.writeFileSync(dest, htmlContent, 'utf8');
  }
}

/**
 * Executes the Claude CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('claude-code-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Claude Code agent in: ${workDir}`);

    const command = config.environment.claudeCodeCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--dangerously-skip-permissions',
      '--verbose'
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
        'Claude Code'
      );
    } finally {
      stopWatchingMcpLog();
    }

    exportClaudeCodeTrajectories(workDir, targetDir);

    console.log("Claude Code agent finished successfully.");

  } catch (err) {
    console.error("Error during Claude Code execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectClaudeGuidesFromTrajectory(dirPath: string, serving: string): Promise<string[]> {
  const guidesFromSkills: string[] = [];
  try {
    const files = fs.readdirSync(dirPath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.jsonl'));

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      const lines = sessionContent.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message && obj.message.content) {
            for (const contentItem of obj.message.content) {
              if (serving === Serving.SKILLS_CLI && contentItem.type === 'tool_use' && contentItem.name === 'Bash' && contentItem.input && contentItem.input.command) {
                const command = contentItem.input.command;
                if (command.includes('modern-web') && command.includes('--retrieve')) {
                  const match = command.match(/--retrieve\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    const ids = match[1].split(',');
                    for (const id of ids) {
                      guidesFromSkills.push(id.trim());
                    }
                  }
                }
              } else if (serving === Serving.SKILLS && contentItem.type === 'tool_use' && contentItem.name === 'Read' && contentItem.input && contentItem.input.file_path) {
                const filePath = contentItem.input.file_path;
                if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                  const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Failed to parse jsonl line in ${sessionPath}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`Error reading session files in ${dirPath}:`, e);
  }
  return [...new Set(guidesFromSkills)];
}

export function extractClaudeCodeModel(resultsDir: string): string {
  const sessionFiles = fs.globSync('**/session-*.jsonl', { cwd: resultsDir });
  if (sessionFiles.length === 0) return 'unknown';

  const counts: Record<string, number> = {};
  for (const relativePath of sessionFiles as string[]) {
    const sessionPath = path.join(resultsDir, relativePath);
    try {
      const content = fs.readFileSync(sessionPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim() || !line.includes('"model"')) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message && obj.message.model) {
            const m = obj.message.model;
            counts[m] = (counts[m] || 0) + 1;
          }
        } catch (e) {
          console.warn(`Malformed JSONL line in ${sessionPath}:`, e);
        }
      }
    } catch (e) {
      console.warn(`Failed to extract model from ${sessionPath}:`, e);
    }
  }

  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topModel) return topModel[0];

  return 'unknown';
}

export function collectClaudeToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = fs.globSync('session-*.jsonl', { cwd: dir });
  const firstSession = sessionFiles[0];
  if (!firstSession) return toolsUsed;

  try {
    const sessionPath = path.join(dir, firstSession);
    const content = fs.readFileSync(sessionPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message && Array.isArray(obj.message.content)) {
          for (const item of obj.message.content) {
            if (item.type === 'tool_use' && item.name === 'Skill' && item.input?.skill) {
              toolsUsed.push(item.input.skill);
            }
          }
        }
      } catch (e) {
        console.error(`Failed to parse jsonl line in ${sessionPath}:`, e);
      }
    }
  } catch (e) {
    console.error(`Failed to collect guidance tools used for Claude Code:`, e);
  }

  return Array.from(new Set(toolsUsed));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
