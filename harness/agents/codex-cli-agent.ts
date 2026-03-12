import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, copyResultsToTarget, createWorkDir, copySkills, updateMcpConfig } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';

// Usage: node codex-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('codex-cli-agent.ts');

function setupIsolatedWorkDir(): string {
  const tempHome = createIsolatedHome('ghh-codex');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  process.env.HOME = tempHome;

  if (runType === 'guided') {
    if (config.suite.enableSkills) {
      copySkills(tempHome, Agents.CODEX_CLI);
    }

    updateMcpConfig(
      path.join(tempHome, '.codex', 'config.toml'),
      config.suite.mcpServersToEnable,
      config.environment.modernWebServerPath,
      config.environment.mcpApiKey,
      Agents.CODEX_CLI
    );
  }

  return workDir;
}

async function run() {
  const workDir = setupIsolatedWorkDir();

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Codex agent in: ${workDir}`);

    const command = config.environment.codexCliBin;
    const commandArgs = [
      'exec', 
      userPrompt,
      '--yolo'
    ];

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    const child = spawn(command, commandArgs, {
      cwd: workDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      process.stderr.write(chunk);
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Codex exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    console.log("Codex agent finished successfully.");

  } catch (err) {
    console.error("Error during Codex execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

run();
