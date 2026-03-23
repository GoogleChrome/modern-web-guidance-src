import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, copyFileIfExists, updateMcpConfig, copyResultsToTarget, createWorkDir, copySkills, watchLogFile } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';
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
    if (config.suite.enableSkills) {
      copySkills(tempHome, Agents.CLAUDE_CODE);
    }

    updateMcpConfig(
      path.join(tempHome, '.claude.json'),
      config.suite.mcpServersToEnable,
      config.environment.modernWebServerPath,
      config.environment.mcpApiKey,
      Agents.CLAUDE_CODE
    );
  }

  return workDir;
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

    process.env.MCP_LOG_DIR = targetDir;
    const stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

    const child = spawn(command, commandArgs, {
      cwd: workDir, // Run in the isolated project directory
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

    stopWatchingMcpLog();

    if (exitCode !== 0) {
      throw new Error(`Claude Code exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    // Save output to chat_log.txt
    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    // Export Claude Code trajectory as an inline HTML viewer
    const tempHome = path.dirname(workDir);
    const claudeLogDir = path.join(tempHome, '.claude', 'projects');
    if (fs.existsSync(claudeLogDir)) {
      // Find all jsonl files in the Claude projects directory
      const files = fs.globSync('**/*.jsonl', { cwd: claudeLogDir });
      
      for (const relativePath of files as string[]) {
        const src = path.join(claudeLogDir, relativePath);
        
        // 1. Determine base name and copy original JSONL file to targetDir
        const baseName = relativePath.replace(/[\\\\/]/g, '-').replace(/\.jsonl$/, '');
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

    console.log("Claude Code agent finished successfully.");

  } catch (err) {
    console.error("Error during Claude Code execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectClaudeCodeGuides(dirPath: string): Promise<string[]> {
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
              if (contentItem.type === 'tool_use' && contentItem.name === 'Bash' && contentItem.input && contentItem.input.command) {
                const command = contentItem.input.command;
                if (command.includes('serving/scripts/retrieve.ts')) {
                  const match = command.match(/retrieve\.ts\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              } else if (contentItem.type === 'tool_use' && contentItem.name === 'Read' && contentItem.input && contentItem.input.file_path) {
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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
