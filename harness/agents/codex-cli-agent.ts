import fs from 'fs';
import os from 'os';
import path from 'path';
import { getSuiteConfig, cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, parseJsonlFile, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';
import config, { Agents, Serving } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateCodexTrajectoryHtml } from '../lib/codex-trajectory-viewer.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';
import { fileURLToPath } from 'url';

export function setupCodexCliCredentials(tempHome: string): void {
  const codexGlobalDir = path.join(os.homedir(), '.codex');
  const codexDestDir = path.join(tempHome, '.codex');
  if (fs.existsSync(codexGlobalDir)) {
    fs.cpSync(codexGlobalDir, codexDestDir, {
      recursive: true,
      filter: (src) => !src.includes('sessions') && !src.includes('log')
    });
  }
}

export function getCodexCliCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.codexCliBin;
  const model = process.env.CODEX_MODEL;
  const commandArgs = [
    'exec',
    prompt,
    '--yolo',
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}

const TRAJECTORY_GLOB = 'session-*.jsonl';

function getSessionFiles(dir: string, recursive = false): string[] {
  return fs.globSync(recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB, { cwd: dir });
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
  const workDir = setupIsolatedWorkDir(Agents.CODEX_CLI, templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Codex agent in: ${workDir}`);

    const { command, commandArgs } = getCodexCliCommandAndArgs(userPrompt);

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
    await generateNormalizedTrajectory(targetDir, Agents.CODEX_CLI, userPrompt);

    console.log("Codex agent finished successfully.");
  } catch (err) {
    console.error("Error during Codex execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, serving?: string): Promise<GuideUsage> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];

  for (const file of getSessionFiles(dirPath)) {
    const items = parseJsonlFile(path.join(dirPath, file));
    for (const obj of items) {
      const functionCall = obj.type === 'function_call' ? obj : (obj.payload?.type === 'function_call' ? obj.payload : null);
      if (functionCall?.name === 'exec_command' && functionCall.arguments) {
        try {
          const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
          const command = args.cmd || '';

          if (serving === Serving.SKILLS_CLI && command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              retrievedGuides.push(...match[1].split(',').map((s: string) => s.trim()));
            }
          } else if (serving === Serving.SKILLS && command.includes('.agents/skills/') && command.includes('guide.md')) {
            const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
            if (match) {
              retrievedGuides.push(match[1]);
            }
          }
        } catch {
          // Ignore
        }
      }
    }
  }
  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)]
  };
}

export function extractCodexCliModel(resultsDir: string): string {
  const counts: Record<string, number> = {};
  for (const file of getSessionFiles(resultsDir, true)) {
    const items = parseJsonlFile(path.join(resultsDir, file));
    for (const obj of items) {
      if (typeof obj.payload?.model === 'string') {
        counts[obj.payload.model] = (counts[obj.payload.model] || 0) + 1;
      }
    }
  }
  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return topModel ? topModel[0] : 'unknown';
}

export function extractCodexCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;

  for (const file of getSessionFiles(dir)) {
    const items = parseJsonlFile(path.join(dir, file));
    let lastTotal = 0;
    let lastCached = 0;
    let fileHasTokens = false;

    for (const obj of items) {
      const info = (obj.type === 'token_count' ? obj : obj.payload)?.info?.total_token_usage;
      if (info) {
        lastTotal = info.total_tokens || 0;
        lastCached = info.cached_input_tokens || 0;
        fileHasTokens = true;
      }
    }
    if (fileHasTokens) {
      total += lastTotal;
      cached += lastCached;
      hasData = true;
    }
  }
  return hasData ? { total, cached } : undefined;
}

export function collectCodexToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  if (sessionFiles.length === 0) return toolsUsed;

  for (const file of sessionFiles) {
    const items = parseJsonlFile(path.join(dir, file));
    for (const obj of items) {
      const functionCall = obj.type === 'function_call' ? obj : (obj.payload?.type === 'function_call' ? obj.payload : null);
      if (functionCall?.name === 'exec_command' && functionCall.arguments) {
        try {
          const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
          const command = args.cmd || '';
          if (command.includes('/skills/') && command.includes('SKILL.md')) {
            const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
            if (match) {
              toolsUsed.push(match[1]);
            }
          }
        } catch {
          // Ignore
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
