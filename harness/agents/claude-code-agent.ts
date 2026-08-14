import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, copyFileIfExists, setupIsolatedWorkDir, parseJsonlFile, type GuideUsage } from '../lib/agent-shared.ts';
import config, { Agents } from '../config.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateClaudeTrajectoryHtml } from '../lib/claude-trajectory-viewer.ts';
import {
  type StandardizedStep,
  type SubagentMetadata,
  type TrajectorySummary,
  extractTimestamp,
  mapToolType,
  truncateMessage,
  finalizeTrajectorySummary,
  getSessionFiles,
  generateNormalizedTrajectory
} from '../lib/trajectory-parser.ts';

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
 * Helper to parse a list of Claude JSONL entries into StandardizedSteps.
 */
function parseClaudeLogEntries(
  logData: any[],
  subagentId?: string,
  subagentsMap: Record<string, any[]> = {},
  consumedSubagents: Set<string> = new Set()
): StandardizedStep[] {
  const steps: StandardizedStep[] = [];
  const toolUseToStepMap = new Map<string, number>();

  for (const entry of logData) {
    const timestamp = extractTimestamp(entry);
    let role = entry.role || entry.type || 'unknown';
    let content = entry.message?.content || entry.content || entry;
    if (entry.message) {
      role = entry.message.role || role;
    }

    if (role === 'assistant' && Array.isArray(content)) {
      let thought = '';
      const thinkingBlock = content.find((b: any) => b.type === 'thinking');
      const textBlock = content.find((b: any) => b.type === 'text');
      
      if (thinkingBlock?.thinking) {
        thought = thinkingBlock.thinking;
      } else if (textBlock?.text) {
        const match = textBlock.text.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (match) {
          thought = match[1];
        } else {
          thought = textBlock.text;
        }
      }

      const toolUses = content.filter((b: any) => b.type === 'tool_use');
      
      if (toolUses.length === 0) {
        steps.push({
          stepNumber: 0,
          timestamp,
          subagentId,
          thought,
          action: {
            type: 'other',
            name: 'respond_to_user',
            params: textBlock?.text ? { response: truncateMessage(textBlock.text, 150) } : undefined
          },
          outcome: { status: 'success' }
        });
      } else {
        for (const tool of toolUses) {
          const isSubagentCall = ['task', 'agent', 'stitch', 'dispatch'].includes((tool.name || '').toLowerCase());
          const stepIdx = steps.push({
            stepNumber: 0,
            timestamp,
            subagentId,
            thought,
            action: {
              type: mapToolType(tool.name || ''),
              name: tool.name || 'unknown',
              params: tool.input
            }
          }) - 1;

          if (tool.id) {
            toolUseToStepMap.set(tool.id, stepIdx);
          }

          if (isSubagentCall && subagentsMap) {
            const subId = tool.input?.subagent_id || tool.input?.agent_id || tool.id;
            for (const [key, subLogs] of Object.entries(subagentsMap)) {
              if (!consumedSubagents.has(key) && (key === subId || key.includes(tool.id) || JSON.stringify(tool.input || {}).includes(key))) {
                consumedSubagents.add(key);
                const subSteps = parseClaudeLogEntries(subLogs, key, subagentsMap, consumedSubagents);
                steps.push(...subSteps);
                break;
              }
            }
          }
        }
      }
    } else if (role === 'user' || role === 'system') {
      const contentList = Array.isArray(content) ? content : [content];
      for (const block of contentList) {
        if (block && block.type === 'tool_result' && block.tool_use_id) {
          const stepIdx = toolUseToStepMap.get(block.tool_use_id);
          if (stepIdx !== undefined && steps[stepIdx]) {
            const outText = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
            steps[stepIdx].outcome = {
              status: block.is_error ? 'error' : 'success',
              message: truncateMessage(outText)
            };

            const match = outText.match(/agentId:\s*([a-zA-Z0-9_-]+)/);
            if (match && match[1] && subagentsMap[match[1]] && !consumedSubagents.has(match[1])) {
              const matchedId = match[1];
              consumedSubagents.add(matchedId);
              const subSteps = parseClaudeLogEntries(subagentsMap[matchedId], matchedId, subagentsMap, consumedSubagents);
              steps.push(...subSteps);
            }
          }
        }
      }
    }
  }
  return steps;
}

export function parseClaudeTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const consumedSubagents = new Set<string>();
  const steps = parseClaudeLogEntries(logData, undefined, subagentsMap, consumedSubagents);

  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    if (!consumedSubagents.has(subId)) {
      consumedSubagents.add(subId);
      const subSteps = parseClaudeLogEntries(subLogs, subId, subagentsMap, consumedSubagents);
      steps.push(...subSteps);
    }
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    if (subStepsCount > 0) {
      subagentsMeta[subId] = {
        id: subId,
        agent: Agents.CLAUDE_CODE,
        totalSteps: subStepsCount
      };
    }
  }

  return finalizeTrajectorySummary({
    agent: Agents.CLAUDE_CODE,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
  });
}

export function extractClaudeMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
  model: string;
  tokenUsage?: { total: number; cached: number };
  toolsUsed: string[];
  retrievedGuides: string[];
  fileReadGuides: string[];
} {
  const modelCounts: Record<string, number> = {};
  let totalTokens = 0;
  let cachedTokens = 0;
  let hasTokenData = false;
  const toolsUsed = new Set<string>();
  const retrievedGuides = new Set<string>();
  const fileReadGuides = new Set<string>();

  const processEntries = (entries: any[]) => {
    for (const entry of entries) {
      if (entry.message?.model) {
        modelCounts[entry.message.model] = (modelCounts[entry.message.model] || 0) + 1;
      }
      if (entry.message?.usage) {
        const u = entry.message.usage;
        totalTokens += (u.output_tokens || 0) + (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
        cachedTokens += u.cache_read_input_tokens || 0;
        hasTokenData = true;
      }

      const content = entry.message?.content || entry.content || entry;
      const contentList = Array.isArray(content) ? content : [content];
      for (const item of contentList) {
        if (item && typeof item === 'object' && item.type === 'tool_use') {
          if (item.name === 'Skill' && item.input?.skill) {
            toolsUsed.add(item.input.skill);
          } else if (item.name === 'activate_skill' && item.input?.name) {
            toolsUsed.add(item.input.name);
          } else if (item.name === 'Bash' && item.input?.command) {
            const command = item.input.command;
            if (command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
              const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
              if (match) {
                match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
              }
            }
          } else if (item.name === 'Read' && item.input?.file_path) {
            const filePath = item.input.file_path;
            if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
              const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
              if (match) {
                fileReadGuides.add(match[1]);
              }
            }
          }
        }
      }
    }
  };

  processEntries(logData);
  for (const subLogs of Object.values(subagentsMap)) {
    processEntries(subLogs);
  }

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    model: topModel ? topModel[0] : 'unknown',
    tokenUsage: hasTokenData ? { total: totalTokens, cached: cachedTokens } : undefined,
    toolsUsed: [...toolsUsed],
    retrievedGuides: [...retrievedGuides],
    fileReadGuides: [...fileReadGuides]
  };
}

function loadClaudeLogs(dirPath: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const allFiles = getSessionFiles(dirPath, '**/*.jsonl');
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};

  for (const relativePath of allFiles) {
    const src = path.join(dirPath, relativePath);
    let linesList: any[] = [];
    try {
      linesList = parseJsonlFile(src);
    } catch {}

    const isSubagent = relativePath.includes('subagents/');
    if (!isSubagent) {
      logData.push(...linesList);
    }

    const match = relativePath.match(/subagents[/\\]agent-([a-zA-Z0-9_-]+)\.jsonl$/);
    if (match && match[1]) {
      subagentsMap[match[1]] = linesList;
    }
  }

  return { logData, subagentsMap };
}

export async function collectClaudeGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
  const summaryPath = path.join(dirPath, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.retrievedGuides || summary.fileReadGuides) {
        return {
          retrievedGuides: summary.retrievedGuides || [],
          fileReadGuides: summary.fileReadGuides || []
        };
      }
    } catch {}
  }
  const { logData, subagentsMap } = loadClaudeLogs(dirPath);
  const meta = extractClaudeMetadata(logData, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractClaudeCodeModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { logData, subagentsMap } = loadClaudeLogs(resultsDir);
  return extractClaudeMetadata(logData, subagentsMap).model;
}

export function extractClaudeCodeTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { logData, subagentsMap } = loadClaudeLogs(dir);
  return extractClaudeMetadata(logData, subagentsMap).tokenUsage;
}

export function collectClaudeToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { logData, subagentsMap } = loadClaudeLogs(dir);
  return extractClaudeMetadata(logData, subagentsMap).toolsUsed;
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
