import fs from 'fs';
import os from 'os';
import path from 'path';
import { createIsolatedHome, cleanupIsolatedHome, parseAgentArgs, createWorkDir, copySkills, updateMcpConfig, watchLogFile, copyFileIfExists, runCliAgentCommand } from '../lib/agent-shared.ts';
import config, { Agents, Serving } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateCodexTrajectoryHtml } from '../lib/codex-trajectory-viewer.ts';

import { fileURLToPath } from 'url';

// Usage: node codex-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
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

function exportCodexTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const codexLogDir = path.join(tempHome, '.codex', 'sessions');
  
  if (!fs.existsSync(codexLogDir)) {
    return;
  }

  // Find all jsonl files in the Codex sessions directory
  const files = fs.globSync('**/*.jsonl', { cwd: codexLogDir });

  for (const relativePath of files as string[]) {
    const src = path.join(codexLogDir, relativePath);

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
    const htmlContent = generateCodexTrajectoryHtml(logData);

    // 4. Save HTML viewer to target directory
    const destName = `session-${baseName}.html`;
    const dest = path.join(targetDir, destName);
    fs.writeFileSync(dest, htmlContent, 'utf8');
  }
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
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Codex CLI'
      );
    } finally {
      stopWatchingMcpLog();
    }

    exportCodexTrajectories(workDir, targetDir);

    console.log("Codex agent finished successfully.");
  } catch (err) {
    console.error("Error during Codex execution:", err);
    process.exit(1);
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, serving: string): Promise<string[]> {
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

export function extractCodexCliModel(resultsDir: string): string {
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
          if (obj.payload && typeof obj.payload.model === 'string') {
            const m = obj.payload.model;
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

export function collectCodexToolsFromTrajectory(dir: string): string[] {
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
        let functionCall = null;
        if (obj.type === 'function_call') {
          functionCall = obj;
        } else if (obj.type === 'response_item' && obj.payload && obj.payload.type === 'function_call') {
          functionCall = obj.payload;
        }

        if (functionCall && functionCall.name === 'exec_command' && functionCall.arguments) {
          const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
          const command = args.cmd || '';
          if (command.includes('/skills/') && command.includes('SKILL.md')) {
            const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
            if (match) {
              toolsUsed.push(match[1]);
            }
          }
        }
      } catch (e) {
        console.error(`Failed to parse jsonl line in ${sessionPath}:`, e);
      }
    }
  } catch (e) {
    console.error(`Failed to collect guidance tools used for Codex:`, e);
  }

  return Array.from(new Set(toolsUsed));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
