import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, copyResultsToTarget, createWorkDir, copySkills, updateMcpConfig, watchLogFile, copyFileIfExists } from '../lib/agent-shared.ts';
import config, { Agents, Serving } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateCodexTrajectoryHtml } from '../lib/codex-trajectory-viewer.ts';

import { fileURLToPath } from 'url';

// Usage: node codex-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>

function setupIsolatedWorkDir(templateDir: string, runType: string): string {
  const tempHome = createIsolatedHome('ghh-codex');
  const workDir = createWorkDir(templateDir, tempHome, runType);

  // Copy Codex auth file
  const codexGlobalDir = path.join(os.homedir(), '.codex');
  const codexDestDir = path.join(tempHome, '.codex');
  fs.mkdirSync(codexDestDir, { recursive: true });
  copyFileIfExists(path.join(codexGlobalDir, 'auth.json'), path.join(codexDestDir, 'auth.json'));

  process.env.HOME = tempHome;

  if (runType === 'guided') {
    const approach = config.suite.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.CODEX_CLI, approach === Serving.SKILLS_CLI);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(tempHome, '.codex', 'config.toml'),
        config.suite.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.CODEX_CLI
      );
    }
  }

  return workDir;
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('codex-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType);

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

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    const stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

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

    stopWatchingMcpLog();

    if (exitCode !== 0) {
      throw new Error(`Codex exited with code ${exitCode}`);
    }

    copyResultsToTarget(workDir, targetDir);

    const chatLogPath = path.join(targetDir, 'chat_log.txt');
    fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
    console.log(`Saved output to: ${chatLogPath}`);

    // Export Codex trajectory as an inline HTML viewer
    const tempHome = path.dirname(workDir);
    const codexLogDir = path.join(tempHome, '.codex', 'sessions');
    if (fs.existsSync(codexLogDir)) {
      // Find all jsonl files in the Codex sessions directory
      const files = fs.globSync('**/*.jsonl', { cwd: codexLogDir });

      for (const relativePath of files as string[]) {
        const src = path.join(codexLogDir, relativePath);

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
        const htmlContent = generateCodexTrajectoryHtml(logData);

        // 4. Save HTML viewer to target directory
        const destName = `session-${baseName}.html`;
        const dest = path.join(targetDir, destName);
        fs.writeFileSync(dest, htmlContent, 'utf8');
      }
    }

    console.log("Codex agent finished successfully.");

  } catch (err) {
    console.error("Error during Codex execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectCodexCliGuides(dirPath: string, serving: string): Promise<string[]> {
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
          let functionCall = null;

          if (obj.type === 'function_call') {
            functionCall = obj;
          } else if (obj.type === 'response_item' && obj.payload && obj.payload.type === 'function_call') {
            functionCall = obj.payload;
          }

          if (functionCall && functionCall.name === 'exec_command' && functionCall.arguments) {
            const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
            const command = args.cmd || '';

            if (serving === Serving.SKILLS_CLI && command.includes('modern-web.cjs') && command.includes('--retrieve')) {
              const match = command.match(/--retrieve\s+["']?([^"'\s]+)["']?/);
              if (match) {
                const ids = match[1].split(',');
                for (const id of ids) {
                  guidesFromSkills.push(id.trim());
                }
              }
            } else if (serving === Serving.SKILLS && command.includes('.agents/skills/') && command.includes('guide.md')) {
              const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
              if (match) {
                guidesFromSkills.push(match[1]);
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
