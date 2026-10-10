import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { Agents } from '../config.ts';
import { cleanupIsolatedHome, parseAgentArgs, watchLogFile, runCliAgentCommand, parseJsonlFile, copyFileIfExists, setupIsolatedWorkDir, type GuideUsage } from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../core/constants.ts';
import { generateClaudeTrajectoryHtml } from '../lib/claude-trajectory-viewer.ts';
import {
  type StandardizedStep,
  type SubagentMetadata,
  type TrajectorySummary,
  extractTimestamp,
  mapToolType,
  truncateMessage,
  finalizeTrajectorySummary,
  generateNormalizedTrajectory,
  readTrajectorySummary
} from '../lib/trajectory-normalizer.ts';
import type { ClaudeLogEntry } from './claude.d.ts';

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

function getSessionFiles(dir: string): string[] {
  return fs.globSync(TRAJECTORY_GLOB, { cwd: dir });
}

export function coalesceClaudeEntries(entries: any[]): any[] {
  const result: any[] = [];
  const entriesById = new Map<string, any>();

  for (const entry of entries) {
    const messageId = entry?.message ? (entry.message.id || entry.messageId) : undefined;
    if (!messageId) {
      result.push(entry);
      continue;
    }

    const prev = entriesById.get(messageId);
    if (!prev) {
      const cloned = {
        ...entry,
        message: entry.message && {
          ...entry.message,
          content: Array.isArray(entry.message.content) ? [...entry.message.content] : entry.message.content
        }
      };
      entriesById.set(messageId, cloned);
      result.push(cloned);
    } else if (prev.message && entry.message) {
      if (Array.isArray(entry.message.content)) {
        prev.message.content = Array.isArray(prev.message.content)
          ? [...prev.message.content, ...entry.message.content]
          : [...entry.message.content];
      }
      if (entry.message.usage) prev.message.usage = entry.message.usage;
      if (entry.message.model && !prev.message.model) prev.message.model = entry.message.model;
    }
  }

  return result;
}

function exportClaudeCodeTrajectories(workDir: string, targetDir: string): void {
  const tempHome = path.dirname(workDir);
  const claudeLogDir = path.join(tempHome, '.claude', 'projects');
  
  if (!fs.existsSync(claudeLogDir)) {
    return;
  }

  // Find all jsonl files in the Claude projects directory
  const files = fs.globSync('**/*.jsonl', { cwd: claudeLogDir });
  const parsedSessions: { relativePath: string; baseName: string; logData: ClaudeLogEntry[] }[] = [];
  const subagentsMap: Record<string, ClaudeLogEntry[]> = {};

  // Step 1: Read all JSONL files and populate subagentsMap
  for (const relativePath of files as string[]) {
    const src = path.join(claudeLogDir, relativePath);
    const baseName = relativePath.replace(/[\\/]/g, '-').replace(/\.jsonl$/, '');
    const isSubagent = relativePath.includes('subagents/');
    const rawDestName = isSubagent ? `subagent-${baseName}.jsonl` : `session-${baseName}.jsonl`;
    fs.copyFileSync(src, path.join(targetDir, rawDestName));

    const logData = coalesceClaudeEntries(parseJsonlFile(src));

    parsedSessions.push({ relativePath, baseName, logData });

    // Match subagent ID if this is a subagent file
    const match = relativePath.match(/subagents[\\/]agent-([a-zA-Z0-9_-]+)\.jsonl$/);
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
        'Claude Code',
        runType
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

export function parseClaudeTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const modelCounts: Record<string, number> = {};
  let totalTokens = 0;
  let cachedTokens = 0;
  let hasTokenData = false;
  const toolsUsed = new Set<string>();
  const retrievedGuides = new Set<string>();
  const fileReadGuides = new Set<string>();
  const consumedSubagents = new Set<string>();

  const parseEntries = (entries: ClaudeLogEntry[], subagentId?: string): StandardizedStep[] => {
    const steps: StandardizedStep[] = [];
    const toolUseToStepMap = new Map<string, number>();

    for (const entry of coalesceClaudeEntries(entries)) {
      const rawEntry = entry as Record<string, any>;
      const timestamp = extractTimestamp(rawEntry);

      if (rawEntry.message?.model) {
        modelCounts[rawEntry.message.model] = (modelCounts[rawEntry.message.model] || 0) + 1;
      }
      if (rawEntry.message?.usage) {
        const u = rawEntry.message.usage;
        totalTokens += (u.output_tokens || 0) + (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        cachedTokens += u.cache_read_input_tokens || 0;
        hasTokenData = true;
      }

      let role = rawEntry.role || rawEntry.type || rawEntry.message?.role;
      const content = rawEntry.message?.content || rawEntry.content || rawEntry;
      if (!role && (rawEntry.message || Array.isArray(content))) {
        role = 'assistant';
      }

      if (role === 'assistant' && Array.isArray(content)) {
        let thought = '';
        const thinkingBlock = content.find((b: any) => b.type === 'thinking');
        const textBlock = content.find((b: any) => b.type === 'text');

        if (thinkingBlock?.thinking) {
          thought = thinkingBlock.thinking;
        } else if (textBlock?.text) {
          const match = textBlock.text.match(/<thinking>([\s\S]*?)<\/thinking>/);
          thought = match ? match[1] : textBlock.text;
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
            const toolNameLower = (tool.name || '').toLowerCase();
            if (tool.name === 'Skill' && tool.input?.skill) {
              toolsUsed.add(tool.input.skill);
            } else if (tool.name === 'activate_skill' && tool.input?.name) {
              toolsUsed.add(tool.input.name);
            } else if (toolNameLower === 'bash' && tool.input?.command) {
              const command = tool.input.command;
              if (command.includes('modern-web-guidance') && command.includes('retrieve')) {
                const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
                if (match) {
                  for (const g of match[1].split(',').map((s: string) => s.trim())) {
                    retrievedGuides.add(g);
                  }
                }
              }
            } else if (toolNameLower === 'read' && tool.input?.file_path) {
              const filePath = tool.input.file_path;
              if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                if (match) {
                  fileReadGuides.add(match[1]);
                }
              }
            }

            const isSubagentCall = ['task', 'agent', 'stitch', 'dispatch'].includes(toolNameLower);
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
                  steps.push(...parseEntries(subLogs, key));
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
              const outText = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
              steps[stepIdx].outcome = {
                status: block.is_error ? 'error' : 'success',
                message: truncateMessage(outText)
              };

              const match = outText.match(/agentId:\s*([a-zA-Z0-9_-]+)/);
              if (match && match[1] && subagentsMap[match[1]] && !consumedSubagents.has(match[1])) {
                const matchedId = match[1];
                consumedSubagents.add(matchedId);
                steps.push(...parseEntries(subagentsMap[matchedId], matchedId));
              }
            }
          }
        }
      }
    }
    return steps;
  };

  const steps = parseEntries(logData);

  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    if (!consumedSubagents.has(subId)) {
      consumedSubagents.add(subId);
      steps.push(...parseEntries(subLogs, subId));
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

  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  return finalizeTrajectorySummary({
    agent: Agents.CLAUDE_CODE,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined,
    model: topModel ? topModel[0] : 'unknown',
    tokenUsage: hasTokenData ? { total: totalTokens, cached: cachedTokens } : undefined,
    toolsUsed: Array.from(toolsUsed),
    retrievedGuides: Array.from(retrievedGuides),
    fileReadGuides: Array.from(fileReadGuides)
  });
}

export function extractClaudeMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
  model: string;
  tokenUsage?: { total: number; cached: number };
  toolsUsed: string[];
  retrievedGuides: string[];
  fileReadGuides: string[];
} {
  const summary = parseClaudeTrajectory(logData, subagentsMap);
  return {
    model: summary.model || 'unknown',
    tokenUsage: summary.tokenUsage,
    toolsUsed: summary.toolsUsed || [],
    retrievedGuides: summary.retrievedGuides || [],
    fileReadGuides: summary.fileReadGuides || []
  };
}

export function loadClaudeLogs(dir: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};
  const files = getSessionFiles(dir);

  const mainFiles = files.filter(f => !f.startsWith('subagent-')).sort();
  const subFiles = files.filter(f => f.startsWith('subagent-')).sort();

  for (const file of mainFiles) {
    logData.push(...parseJsonlFile(path.join(dir, file)));
  }

  for (const file of subFiles) {
    const subId = file.replace(/^(?:subagent-.*subagents-agent-|subagent-(?:subagents-)?(?:agent-)?)/, '').replace(/\.jsonl$/, '');
    subagentsMap[subId] = parseJsonlFile(path.join(dir, file));
  }

  return { logData, subagentsMap };
}

function getClaudeMetadataForDir(dir: string): ReturnType<typeof extractClaudeMetadata> {
  const summary = readTrajectorySummary(dir);
  if (summary) {
    return {
      model: summary.model || 'unknown',
      tokenUsage: summary.tokenUsage,
      toolsUsed: summary.toolsUsed || [],
      retrievedGuides: summary.retrievedGuides || [],
      fileReadGuides: summary.fileReadGuides || []
    };
  }
  const { logData, subagentsMap } = loadClaudeLogs(dir);
  return extractClaudeMetadata(logData, subagentsMap);
}

export async function collectClaudeGuidesFromTrajectory(dirPath: string): Promise<GuideUsage> {
  const meta = getClaudeMetadataForDir(dirPath);
  return {
    retrievedGuides: meta.retrievedGuides,
    fileReadGuides: meta.fileReadGuides
  };
}

export function extractClaudeCodeModel(resultsDir: string): string {
  return getClaudeMetadataForDir(resultsDir).model;
}

export function extractClaudeCodeTokenUsage(dir: string): { total: number; cached: number } | undefined {
  return getClaudeMetadataForDir(dir).tokenUsage;
}

export function collectClaudeToolsFromTrajectory(dir: string): string[] {
  return getClaudeMetadataForDir(dir).toolsUsed;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
