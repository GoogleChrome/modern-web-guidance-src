import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, copyFileIfExists, updateMcpConfig, copyAgentContext, copyResultsToTarget, createWorkDir, copySkills } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';

// Usage: node claude-code-agent.ts <prompt> <runType> <targetDir> <templateDir>
const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('claude-code-agent.ts');

/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(): string {
  const tempHome = createIsolatedHome('ghh-claude');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  // Copy GCP credentials (for Vertex auth)
  const gcloudConfigDest = path.join(tempHome, '.config/gcloud');
  fs.mkdirSync(gcloudConfigDest, { recursive: true });
  copyFileIfExists(config.gcpCredentials, path.join(gcloudConfigDest, 'application_default_credentials.json'));

  // Set environment variables
  process.env.HOME = tempHome;

  // Add CLAUDE context and MCP servers for guided runs
  if (runType === 'guided') {
    copyAgentContext(tempHome, Agents.CLAUDE_CODE);

    if (config.enableSkills) {
      copySkills(tempHome, Agents.CLAUDE_CODE);
    }

    updateMcpConfig(
      path.join(tempHome, '.claude.json'),
      config.mcpServersToEnable,
      config.modernWebServerPath,
      config.mcpApiKey,
      Agents.CLAUDE_CODE
    );
  }

  return workDir;
}

/**
 * Executes the Claude CLI command and captures output.
 */
async function run() {
  const workDir = setupIsolatedWorkDir();

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Claude Code agent in: ${workDir}`);

    const command = config.claudeCodeCliBin;
    const commandArgs = [
      '-p', userPrompt,
      '--dangerously-skip-permissions',
      '--verbose'
    ];

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

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

    if (exitCode !== 0) {
      throw new Error(`Claude Code exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    // Save output to chat_log.txt
    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    console.log("Claude Code agent finished successfully.");

  } catch (err) {
    console.error("Error during Claude Code execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

run();
