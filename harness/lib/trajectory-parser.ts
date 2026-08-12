import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { parseJsonlFile, type GuideUsage } from './agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents } from '../config.ts';

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}

function getSessionFiles(dir: string, globPattern: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.globSync(globPattern, { cwd: dir });
}

/**
 * Represents a single normalized action step in an agent's execution trajectory.
 * 
 * Note: Tool outputs (`outcome.message`) and large parameter payloads are intentionally
 * truncated during normalization to keep `trajectory_summary.json` lightweight for fast
 * UI timeline rendering and prompt budgeting in downstream comparison tools.
 */
export interface StandardizedStep {
  stepNumber: number;
  timestamp?: string;
  subagentId?: string;
  thought?: string;
  action?: {
    type: 'tool_call' | 'api_call' | 'web_search' | 'read_file' | 'write_file' | 'run_command' | 'other';
    canonicalCategory?: 'guide_retrieval' | 'skill_search' | 'code_mutation' | 'mandatory_rule_thought' | 'incidental_noise' | 'other';
    name: string;
    params?: Record<string, any>;
  };
  outcome?: {
    status: 'success' | 'error';
    message?: string;
    output?: any;
    exitCode?: number;
  };
}

export interface SubagentMetadata {
  id: string;
  agent?: string;
  purpose?: string;
  totalSteps?: number;
}

export interface TrajectorySummary {
  agent: string;
  steps: StandardizedStep[];
  subagents?: Record<string, SubagentMetadata>;
  tokenUsage?: { total: number; cached: number };
  initialPrompt?: string;
  model?: string;
  retrievedGuides?: string[];
  fileReadGuides?: string[];
  toolsUsed?: string[];
}

export function extractTimestamp(entry: any): string | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const raw = entry.timestamp || entry.created_at || entry.time || entry.clientTimestamp || entry.message?.created_at || entry.payload?.created_at;
  if (!raw) return undefined;
  if (typeof raw === 'number') {
    const ms = raw < 1e11 ? raw * 1000 : raw;
    const d = new Date(ms);
    return !isNaN(d.getTime()) ? d.toISOString() : undefined;
  }
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return !isNaN(d.getTime()) ? d.toISOString() : undefined;
  }
  return undefined;
}

export function categorizeAction(name: string, params?: Record<string, any>, thought?: string): NonNullable<StandardizedStep['action']>['canonicalCategory'] {
  const actionName = (name || '').toLowerCase();
  const actionParamsStr = JSON.stringify(params || {}).toLowerCase();
  const thoughtStr = (thought || '').toLowerCase();

  if (actionName === 'respond_to_user') {
    return 'other';
  }

  if (actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
    return 'guide_retrieval';
  }

  if (actionName.includes('search') || actionName.includes('get_best_practices') || actionName.includes('query_guidance') || actionParamsStr.includes('search')) {
    return 'skill_search';
  }

  if (
    actionName.includes('write') || actionName.includes('replace') || actionName.includes('edit') || actionName.includes('touch') ||
    actionParamsStr.includes('write_to_file') || actionParamsStr.includes('replace_file_content') ||
    actionParamsStr.includes('index.html') || actionParamsStr.includes('app.jsx') || actionParamsStr.includes('style.css')
  ) {
    return 'code_mutation';
  }

  if (
    thoughtStr.includes('mandatory') || thoughtStr.includes('fallback') ||
    thoughtStr.includes('css') || thoughtStr.includes('baseline') ||
    thoughtStr.includes('guidance')
  ) {
    return 'mandatory_rule_thought';
  }

  return 'incidental_noise';
}

export function finalizeTrajectorySummary(summary: TrajectorySummary): TrajectorySummary {
  if (Array.isArray(summary.steps)) {
    let missingTimestampCount = 0;
    for (const step of summary.steps) {
      if (!step.timestamp) missingTimestampCount++;
    }
    if (missingTimestampCount > 0 && missingTimestampCount < summary.steps.length) {
      console.warn(`[TrajectoryParser] Warning: ${missingTimestampCount} of ${summary.steps.length} steps in ${summary.agent} trajectory are missing timestamps. Sequence ordering will fallback to insertion order for untimestamped steps.`);
    }

    // Sort steps monotonically by timestamp when available, preserving stable order otherwise
    summary.steps.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
      }
      if (a.timestamp && !b.timestamp) return -1;
      if (!a.timestamp && b.timestamp) return 1;
      return 0;
    });

    // Re-index step numbers strictly 1..N and populate canonicalCategory
    for (let i = 0; i < summary.steps.length; i++) {
      const step = summary.steps[i];
      step.stepNumber = i + 1;
      if (step.action && !step.action.canonicalCategory) {
        step.action.canonicalCategory = categorizeAction(step.action.name, step.action.params, step.thought);
      }
    }
  }
  return summary;
}

/**
 * Maps a tool name to a standardized action type.
 */
function mapToolType(toolName: string): NonNullable<StandardizedStep['action']>['type'] {
  const name = toolName.toLowerCase();
  if (['read', 'read_file', 'view_file', 'view'].some(k => name.includes(k))) {
    return 'read_file';
  }
  if (['write', 'write_file', 'replace', 'str_replace_editor', 'edit', 'edit_file', 'save'].some(k => name.includes(k))) {
    return 'write_file';
  }
  if (['bash', 'execute_bash', 'run_command', 'run_shell_command', 'terminal', 'shell'].some(k => name.includes(k))) {
    return 'run_command';
  }
  if (['search', 'get_best_practices', 'retrieve', 'query_guidance'].some(k => name.includes(k))) {
    return 'web_search';
  }
  return 'other';
}

/**
 * Truncates long tool outputs or messages to keep the summary lightweight.
 */
function truncateMessage(msg: any, maxLen = 300): string {
  if (!msg) return '';
  const str = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + '... [truncated]';
  }
  return str;
}

/**
 * Parses Claude Code session JSONL files into a normalized TrajectorySummary.
 */
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

            const match = typeof block.content === 'string' ? block.content.match(/agentId:\s*([a-zA-Z0-9_-]+)/) : null;
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

export function parseGeminiTrajectory(session: any, subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  const messages = Array.isArray(session) ? session : (session.messages || []);
  let lastAssistantStepIndices: number[] = [];

  const processMessages = (msgList: any[], subagentId?: string) => {
    for (const msg of msgList) {
      const timestamp = extractTimestamp(msg) || extractTimestamp(session);
      const role = msg.type || msg.role || 'unknown';

      if (role === 'gemini') {
        lastAssistantStepIndices = [];
        const thought = msg.thought || msg.text || '';
        const toolCalls = msg.toolCalls || [];
        if (toolCalls.length === 0) {
          steps.push({
            stepNumber: 0,
            timestamp,
            subagentId,
            thought,
            action: msg.text ? {
              type: 'other',
              name: 'respond_to_user',
              params: { response: truncateMessage(msg.text, 150) }
            } : undefined,
            outcome: { status: 'success' }
          });
        } else {
          for (const tc of toolCalls) {
            const stepIdx = steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: mapToolType(tc.name || ''),
                name: tc.name || 'unknown',
                params: tc.args
              }
            }) - 1;
            lastAssistantStepIndices.push(stepIdx);
          }
        }
      } else if (role === 'user' && lastAssistantStepIndices.length > 0) {
        const toolResults = msg.toolResults || [];
        toolResults.forEach((tr: any, idx: number) => {
          const stepIdx = lastAssistantStepIndices[idx];
          if (stepIdx !== undefined && steps[stepIdx]) {
            steps[stepIdx].outcome = {
              status: tr.error || tr.status === 'error' ? 'error' : 'success',
              message: truncateMessage(tr.output || tr.content || tr.error || '')
            };
          }
        });
        lastAssistantStepIndices = [];
      }
    }
  };

  processMessages(messages);
  for (const [subId, subSession] of Object.entries(subagentsMap)) {
    const subList = Array.isArray(subSession) ? subSession : ((subSession as any)?.messages || []);
    processMessages(subList, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    subagentsMeta[subId] = { id: subId, agent: Agents.GEMINI_CLI, totalSteps: subStepsCount };
  }

  return finalizeTrajectorySummary({
    agent: Agents.GEMINI_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
  });
}

export function extractGeminiMetadata(session: any, subagentsMap: Record<string, any[]> = {}): {
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

  const messages = Array.isArray(session) ? session : (session.messages || []);
  const processMessages = (msgList: any[]) => {
    const messagesWithTokens = msgList.filter(m => m && typeof m === 'object' && 'tokens' in m);
    const lastMsg = messagesWithTokens[messagesWithTokens.length - 1];
    if (lastMsg) {
      totalTokens += lastMsg.tokens.total || 0;
      cachedTokens += lastMsg.tokens.cached || 0;
      hasTokenData = true;
    }

    for (const msg of msgList) {
      if (msg.type === 'gemini' && msg.model) {
        modelCounts[msg.model] = (modelCounts[msg.model] || 0) + 1;
      }
      if (msg.type === 'gemini' && Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          if (tc.name && tc.name.includes('get_best_practices')) {
            toolsUsed.add('modern-web-guidance');
            if (tc.args?.use_case_id) {
              retrievedGuides.add(tc.args.use_case_id);
            }
          } else if (tc.name === 'activate_skill' && tc.args?.name) {
            toolsUsed.add(tc.args.name);
          } else if (tc.name === 'read_file' && tc.args?.file_path) {
            const filePath = tc.args.file_path;
            if (filePath.includes('/skills/')) {
              const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/) ||
                            filePath.match(/\/skills\/[^/]+\/(?:references\/)?(?:[^/]+\/)*([^/]+)\.md$/);
              if (match) {
                fileReadGuides.add(match[1]);
              }
            }
          } else if (tc.name === 'run_shell_command' && tc.args?.command) {
            const command = tc.args.command;
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
            }
          }
        }
      }
    }
  };

  processMessages(messages);
  for (const subSession of Object.values(subagentsMap)) {
    const subList = Array.isArray(subSession) ? subSession : ((subSession as any).messages || []);
    processMessages(subList);
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

function loadGeminiLogs(dirPath: string): { session: any; subagentsMap: Record<string, any[]> } {
  const sessionFiles = getSessionFiles(dirPath, 'session-*.{json,jsonl}');
  const session: any = { messages: [] };
  const subagentsMap: Record<string, any[]> = {};

  for (const file of sessionFiles) {
    const sessionPath = path.join(dirPath, file);
    let logData: any[] = [];
    try {
      logData = file.endsWith('.jsonl') ? parseJsonlFile(sessionPath) : JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch {}

    const parts = file.replace(/\.jsonl?$/, '').split(/agent[-_]/);
    const key = parts.length > 1 ? parts[parts.length - 1] : file.replace(/\.jsonl?$/, '').replace(/^(?:subagent-|session-)/, '');
    const isSubagent = file.startsWith('subagent-') || file.includes('-subagents-');

    if (isSubagent) {
      subagentsMap[key] = Array.isArray(logData) ? logData : ((logData as any)?.messages || []);
    } else {
      if (Array.isArray(logData)) {
        session.messages.push(...logData);
      } else if (logData?.messages) {
        session.messages.push(...logData.messages);
      }
    }
  }

  return { session, subagentsMap };
}

export async function collectGeminiGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
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
  const { session, subagentsMap } = loadGeminiLogs(dirPath);
  const meta = extractGeminiMetadata(session, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractGeminiCliModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { session, subagentsMap } = loadGeminiLogs(resultsDir);
  return extractGeminiMetadata(session, subagentsMap).model;
}

export function extractGeminiCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { session, subagentsMap } = loadGeminiLogs(dir);
  return extractGeminiMetadata(session, subagentsMap).tokenUsage;
}

export function collectGeminiToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { session, subagentsMap } = loadGeminiLogs(dir);
  return extractGeminiMetadata(session, subagentsMap).toolsUsed;
}

function findJsonObjectsInString(str: string): any[] {
  const results: any[] = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      let balance = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < str.length; j++) {
        const c = str[j];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (!inString) {
          if (c === '{') balance++;
          else if (c === '}') {
            balance--;
            if (balance === 0) {
              const candidate = str.slice(i, j + 1);
              try {
                const obj = JSON.parse(candidate);
                if (obj && typeof obj === 'object') results.push(obj);
              } catch (e) {}
              break;
            }
          }
        }
      }
    }
  }
  return results;
}

function parseProtobuf(buffer: Buffer): Record<number, any[]> {
  let pos = 0;
  const fields: Record<number, any[]> = {};

  while (pos < buffer.length) {
    let tagHeader = 0;
    let shift = 0;
    while (pos < buffer.length) {
      const b = buffer[pos++];
      tagHeader |= (b & 0x7f) << shift;
      shift += 7;
      if ((b & 0x80) === 0) break;
    }
    const wireType = tagHeader & 0x07;
    const fieldNum = tagHeader >> 3;
    if (fieldNum === 0) break;

    let value: any;
    if (wireType === 0) { // Varint
      let val = 0;
      let valShift = 0;
      while (pos < buffer.length) {
        const b = buffer[pos++];
        val += (b & 0x7f) * Math.pow(2, valShift);
        valShift += 7;
        if ((b & 0x80) === 0) break;
      }
      value = val;
    } else if (wireType === 2) { // Length-delimited
      let len = 0;
      let lenShift = 0;
      while (pos < buffer.length) {
        const b = buffer[pos++];
        len += (b & 0x7f) * Math.pow(2, lenShift);
        lenShift += 7;
        if ((b & 0x80) === 0) break;
      }
      const data = buffer.subarray(pos, pos + len);
      pos += len;

      let nested: Record<number, any[]> | null = null;
      try {
        nested = parseProtobuf(data);
        if (Object.keys(nested).length === 0) nested = null;
      } catch {}

      const str = data.toString('utf8');
      const isClean = /^[\x20-\x7E\t\r\n]+$/.test(str) && str.length > 0;
      value = nested || (isClean ? str : data);
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }

    if (!fields[fieldNum]) fields[fieldNum] = [];
    fields[fieldNum].push(value);
  }
  return fields;
}

function getProtoStrings(node: any, results: string[] = []): string[] {
  if (!node) return results;
  if (typeof node === 'string') {
    results.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) getProtoStrings(item, results);
  } else if (typeof node === 'object' && !(node instanceof Uint8Array)) {
    for (const k of Object.keys(node)) {
      getProtoStrings(node[k], results);
    }
  }
  return results;
}

export function parseJetskiCliSession(dirPath: string): {
  retrievedGuides: string[];
  fileReadGuides: string[];
  toolsUsed: string[];
  model?: string;
  tokenUsage?: { total: number; cached: number };
} {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  const toolsUsed: string[] = [];
  let modelName = 'unknown';
  let totalTokens = 0;
  let totalCached = 0;
  let hasTokens = false;

  const files = getSessionFiles(dirPath, '*.db').filter(f => !f.endsWith('-shm') && !f.endsWith('-wal'));
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const db = new DatabaseSync(fullPath, { readOnly: true });
      const rows = db.prepare('SELECT step_type, metadata, step_payload FROM steps').all() as Array<{ step_type?: number; metadata?: Uint8Array; step_payload?: Uint8Array }>;
      let fileInput = 0;
      let fileLastCached = 0;
      let fileOutput = 0;
      let fileHasTokens = false;

      for (const row of rows) {
        if (row.step_payload) {
          const proto = parseProtobuf(Buffer.from(row.step_payload));
          const strings = getProtoStrings(proto);

          for (const text of strings) {
            if (text.includes('retrieve')) {
              const match = text.match(/(?:--)?retrieve\s+["'\\]*([^"'\s\\]+)["'\\]*/i);
              if (match && match[1]) {
                const parts = match[1].split(',').map(s => s.trim().replace(/^["'\\]+|["'\\]+$/g, '')).filter(s => Boolean(s) && /^[a-zA-Z0-9_-]+$/.test(s) && s.toLowerCase() !== 'id');
                retrievedGuides.push(...parts);
              }
            }

            if (text.includes('/skills/') && text.endsWith('/guide.md')) {
              const match = text.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
              if (match) {
                fileReadGuides.push(match[1]);
              }
            }
            if (text.includes('/skills/') && text.endsWith('/SKILL.md')) {
              const match = text.match(/\/skills\/([^/]+)\/SKILL\.md$/);
              if (match) {
                toolsUsed.push(match[1]);
              }
            }
          }
        }

        if (row.metadata) {
          const proto = parseProtobuf(Buffer.from(row.metadata));
          const usageNode = proto[9]?.[0];
          if (usageNode && typeof usageNode === 'object') {
            const input = (usageNode[2] && typeof usageNode[2][0] === 'number') ? usageNode[2][0] : 0;
            const output = (usageNode[3] && typeof usageNode[3][0] === 'number') ? usageNode[3][0] : 0;
            const cached = (usageNode[5] && typeof usageNode[5][0] === 'number') ? usageNode[5][0] : 0;
            if (input > 0 || output > 0 || cached > 0) {
              fileInput += input;
              fileLastCached = Math.max(fileLastCached, cached);
              fileOutput += output;
              fileHasTokens = true;
            }
          }
        }
      }

      if (fileHasTokens) {
        totalTokens += (fileInput + fileLastCached + fileOutput);
        totalCached += fileLastCached;
        hasTokens = true;
      }

      try {
        const genRows = db.prepare('SELECT data FROM gen_metadata').all() as Array<{ data?: Uint8Array }>;
        for (const row of genRows) {
          if (!row.data) continue;
          const proto = parseProtobuf(Buffer.from(row.data));
          const strings = getProtoStrings(proto);
          const modelCandidate = strings.find(s => /^gemini/i.test(s));
          if (modelCandidate) {
            modelName = modelCandidate;
            break;
          }
        }
      } catch {}

      db.close();
    } catch {}
  }

  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)],
    toolsUsed: [...new Set(toolsUsed)],
    model: modelName,
    tokenUsage: hasTokens ? { total: totalTokens, cached: totalCached } : undefined
  };
}

export function writeTrajectorySummary(targetDir: string, summary: any): void {
  fs.writeFileSync(path.join(targetDir, 'trajectory_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
}

export function readTrajectorySummary(dir: string): any | null {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch {}
  }
  return null;
}

export async function collectJetskiCliGuidesFromTrajectory(dirPath: string, _serving: string): Promise<GuideUsage> {
  const summary = readTrajectorySummary(dirPath);
  if (summary?.retrievedGuides || summary?.fileReadGuides) {
    return {
      retrievedGuides: summary.retrievedGuides || [],
      fileReadGuides: summary.fileReadGuides || []
    };
  }
  const legacy = parseJetskiCliSession(dirPath);
  return {
    retrievedGuides: legacy.retrievedGuides,
    fileReadGuides: legacy.fileReadGuides
  };
}

export function extractJetskiCliModel(resultsDir: string): string {
  const summary = readTrajectorySummary(resultsDir);
  if (summary?.model && summary.model !== 'unknown') return summary.model;
  const legacy = parseJetskiCliSession(resultsDir);
  return legacy.model || 'unknown';
}

export function extractJetskiCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summary = readTrajectorySummary(dir);
  if (summary?.tokenUsage) return summary.tokenUsage;
  const legacy = parseJetskiCliSession(dir);
  return legacy.tokenUsage;
}

export function collectJetskiCliToolsFromTrajectory(dir: string): string[] {
  const summary = readTrajectorySummary(dir);
  if (summary?.toolsUsed) return summary.toolsUsed;
  const legacy = parseJetskiCliSession(dir);
  return legacy.toolsUsed;
}

export async function parseJetskiTrajectory(dirPath: string, agentName: string): Promise<TrajectorySummary> {
  const steps: StandardizedStep[] = [];
  const seenJsonHashes = new Set<string>();

  // 1. Check for Jetski SQLite .db database files to extract real tool calls and step mutations
  let dbFiles: string[] = [];
  try {
    dbFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.db'));
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }
  if (dbFiles.length > 0) {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(path.join(dirPath, dbFiles[0]));
      const rows = db.prepare('SELECT * FROM steps ORDER BY idx').all() as any[];
      for (const r of rows) {
        if (!r.step_payload) continue;
        const objs = findJsonObjectsInString(Buffer.from(r.step_payload).toString('utf8'));
        const isErr = [2, 4, 5].includes(r.status);
        for (const obj of objs) {
          if (!obj.toolAction && !obj.toolSummary && !obj.CommandLine && !obj.AbsolutePath && !obj.DirectoryPath && !obj.TargetFile) continue;
          const key = JSON.stringify({ cmd: obj.CommandLine, file: obj.AbsolutePath || obj.TargetFile || obj.DirectoryPath, act: obj.toolAction || obj.toolSummary });
          if (seenJsonHashes.has(key)) continue;
          seenJsonHashes.add(key);
          const timestamp = extractTimestamp(obj) || extractTimestamp(r);
          const subagentId = obj.Recipient || obj.recipient_id || obj.conversationId || undefined;

          if (obj.TargetFile || (obj.toolAction && (obj.toolAction.includes('Modifying') || obj.toolAction.includes('Updating') || obj.toolAction.includes('Writing')))) {
            const targetFile = obj.TargetFile || 'target_file';
            const toolName = obj.ReplacementChunks ? 'multi_replace_file_content' : (obj.CodeContent ? 'write_to_file' : 'replace_file_content');
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought: obj.toolSummary || obj.toolAction || 'Modifying target file',
              action: {
                type: 'write_file',
                name: toolName,
                params: { targetFile: truncateMessage(targetFile, 150) }
              },
              outcome: {
                status: isErr ? 'error' : 'success',
                message: isErr ? 'File modification failed' : 'File modified successfully'
              }
            });
          } else if (obj.CommandLine) {
            let actType: NonNullable<StandardizedStep['action']>['type'] = 'run_command';
            let actName = 'run_command';
            let params: any = { command: truncateMessage(obj.CommandLine, 150) };
            if (/(?:modern-web-guidance|modern-web|\bgd\b)/.test(obj.CommandLine) && (obj.CommandLine.includes('search') || obj.CommandLine.includes('retrieve'))) {
              actType = 'web_search';
              actName = 'get_best_practices';
              const qMatch = obj.CommandLine.match(/(?:search|retrieve)\s+["']?([^"'\n]+)["']?/i);
              params = { query: qMatch ? truncateMessage(qMatch[1], 150) : truncateMessage(obj.CommandLine, 150), command: truncateMessage(obj.CommandLine, 150) };
            }
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought: obj.toolSummary || obj.toolAction || 'Running terminal command',
              action: {
                type: actType,
                name: actName,
                params
              },
              outcome: {
                status: isErr ? 'error' : 'success',
                message: isErr ? 'Command failed' : 'Command completed successfully'
              }
            });
          } else if (obj.AbsolutePath || obj.DirectoryPath) {
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought: obj.toolSummary || obj.toolAction || 'Exploring workspace structure',
              action: {
                type: 'read_file',
                name: obj.DirectoryPath ? 'list_dir' : 'view_file',
                params: { path: truncateMessage(obj.AbsolutePath || obj.DirectoryPath, 150) }
              },
              outcome: {
                status: isErr ? 'error' : 'success',
                message: isErr ? 'Inspection failed' : 'Inspection completed'
              }
            });
          }
        }
      }
      db.close();
    } catch (e: any) {
      console.warn(`[TrajectoryParser] Note: Could not parse Jetski .db file (${e.message}).`);
    }
  }

  // 2. Process modern-web.log for guide searches/retrievals and attach actual results
  const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
  let logContent = '';
  try {
    logContent = fs.readFileSync(logPath, 'utf8').trim();
  } catch (err) {
    if (!isEnoent(err)) {
      console.error(`[TrajectoryParser] Error reading modern-web.log:`, err);
    }
  }
  if (logContent) {
    const lines = logContent.split('\n');
    const logCalls: any[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try { logCalls.push(JSON.parse(line)); } catch {}
      }
    }
    if (steps.length === 0) {
      for (const call of logCalls) {
        if (call.tool === 'get_best_practices' || call.tool === 'search_use_cases') {
          steps.push({
            stepNumber: 0,
            thought: call.tool === 'search_use_cases' ? 'Searching for relevant web guidance patterns' : 'Retrieving guidance best practices',
            action: {
              type: 'web_search',
              name: call.tool,
              params: { query: call.query }
            },
            outcome: {
              status: 'success',
              message: `Retrieved ${call.result?.length || 0} items`,
              output: call.result
            }
          });
        }
      }
    } else {
      let logIdx = 0;
      for (const step of steps) {
        if (step.action && (step.action.name === 'get_best_practices' || step.action.type === 'web_search' || step.action.name === 'search_use_cases')) {
          if (logCalls[logIdx]) {
            if (!step.outcome) step.outcome = { status: 'success' };
            step.outcome.output = logCalls[logIdx].result;
            if (!step.outcome.message) step.outcome.message = `Retrieved ${logCalls[logIdx].result?.length || 0} items`;
            logIdx++;
          }
        }
      }
    }
  }

  // 3. Process chat_log.txt for final response / high-level actions
  let chatText = '';
  const chatLogPath = path.join(dirPath, 'chat_log.txt');
  try {
    chatText = fs.readFileSync(chatLogPath, 'utf8').trim();
  } catch (err) {
    if (!isEnoent(err)) {
      console.error(`[TrajectoryParser] Error reading chat_log.txt:`, err);
    }
  }
  if (chatText && (steps.length === 0 || steps[steps.length - 1].action?.name !== 'respond_to_user')) {
    steps.push({
      stepNumber: 0,
      thought: 'Completed task implementation and summarized changes',
      action: {
        type: 'other',
        name: 'respond_to_user',
        params: { response: truncateMessage(chatText, 300) }
      },
      outcome: { status: 'success' }
    });
  }

  const legacy = parseJetskiCliSession(dirPath);
  return finalizeTrajectorySummary({
    agent: agentName,
    steps,
    model: legacy.model,
    tokenUsage: legacy.tokenUsage,
    retrievedGuides: legacy.retrievedGuides,
    fileReadGuides: legacy.fileReadGuides,
    toolsUsed: legacy.toolsUsed
  });
}

export function parseCodexTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let currentThought = '';
  const callMap = new Map<string, StandardizedStep>();

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
      if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'commentary') {
        const msg = entry.payload;
        currentThought = currentThought ? `${currentThought}\n${msg.message}` : msg.message;
      } else if (entry.type === 'response_item' && (entry.payload?.type === 'function_call' || entry.payload?.type === 'custom_tool_call')) {
        const fc = entry.payload;
        let cmdName = fc.name;
        let params: Record<string, any> = {};
        try {
          params = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {});
        } catch {}

        if (cmdName === 'exec_command' && params.cmd) {
          cmdName = params.cmd.split(' ')[0] || 'exec_command';
        }

        const step: StandardizedStep = {
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || `Executing ${cmdName}`,
          action: {
            type: mapToolType(cmdName),
            name: fc.name === 'exec_command' ? (params.cmd || 'exec_command') : fc.name,
            params
          }
        };
        steps.push(step);
        currentThought = '';
        if (fc.call_id) {
          callMap.set(fc.call_id, step);
        }
      } else if (entry.type === 'response_item' && (entry.payload?.type === 'function_call_output' || entry.payload?.type === 'custom_tool_call_output')) {
        const fco = entry.payload;
        const step = callMap.get(fco.call_id);
        if (step) {
          const out = typeof fco.output === 'string' ? fco.output : JSON.stringify(fco.output || '');
          const isErr = out.includes('Process exited with code') && !out.includes('code 0');
          step.outcome = {
            status: isErr ? 'error' : 'success',
            message: truncateMessage(out, 500)
          };
        }
      } else if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message' && entry.payload.phase === 'final_answer') {
        steps.push({
          stepNumber: 0,
          timestamp,
          subagentId,
          thought: currentThought || 'Finalizing response to user',
          action: {
            type: 'other',
            name: 'respond_to_user',
            params: { response: entry.payload.message }
          },
          outcome: { status: 'success' }
        });
        currentThought = '';
      }
    }
  };

  processEntries(logData);

  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    processEntries(subLogs, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    subagentsMeta[subId] = {
      id: subId,
      agent: Agents.CODEX_CLI,
      totalSteps: subStepsCount
    };
  }

  return finalizeTrajectorySummary({
    agent: Agents.CODEX_CLI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
  });
}

export function extractCodexMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
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
    let lastTotal = 0;
    let lastCached = 0;
    let fileHasTokens = false;

    for (const obj of entries) {
      if (typeof obj.payload?.model === 'string') {
        modelCounts[obj.payload.model] = (modelCounts[obj.payload.model] || 0) + 1;
      }

      const info = (obj.type === 'token_count' ? obj : obj.payload)?.info?.total_token_usage;
      if (info) {
        lastTotal = info.total_tokens || 0;
        lastCached = info.cached_input_tokens || 0;
        fileHasTokens = true;
      }

      const functionCall = obj.type === 'function_call' ? obj : (obj.payload?.type === 'function_call' ? obj.payload : null);
      if (functionCall?.name === 'exec_command' && functionCall.arguments) {
        try {
          const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
          const command = args.cmd || '';
          if (command.includes('/skills/') && command.includes('SKILL.md')) {
            const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
            if (match) {
              toolsUsed.add(match[1]);
            }
          }
          if (command.includes('modern-web') && (command.includes('retrieve') || command.includes('--retrieve'))) {
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
            }
          } else if (command.includes('.agents/skills/') && command.includes('guide.md')) {
            const match = command.match(/\.agents\/skills\/[^/]+\/([^/]+)\/guide\.md/);
            if (match) {
              retrievedGuides.add(match[1]);
            }
          }
        } catch {}
      }
    }

    if (fileHasTokens) {
      totalTokens += lastTotal;
      cachedTokens += lastCached;
      hasTokenData = true;
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

function loadCodexLogs(dirPath: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const sessionFiles = getSessionFiles(dirPath, 'session-*.jsonl');
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};

  for (const file of sessionFiles) {
    const sessionPath = path.join(dirPath, file);
    let parsedLines: any[] = [];
    try {
      parsedLines = parseJsonlFile(sessionPath);
    } catch {}

    const parts = file.replace(/\.jsonl$/, '').split(/agent[-_]/);
    const key = parts.length > 1 ? parts[parts.length - 1] : file.replace(/\.jsonl$/, '').replace(/^(?:subagent-|session-)/, '');
    const isSubagent = file.startsWith('subagent-') || file.includes('-subagents-');

    if (isSubagent) {
      subagentsMap[key] = parsedLines;
    } else {
      logData.push(...parsedLines);
    }
  }

  return { logData, subagentsMap };
}

export async function collectCodexGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
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
  const { logData, subagentsMap } = loadCodexLogs(dirPath);
  const meta = extractCodexMetadata(logData, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractCodexCliModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(resultsDir);
  return extractCodexMetadata(logData, subagentsMap).model;
}

export function extractCodexCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(dir);
  return extractCodexMetadata(logData, subagentsMap).tokenUsage;
}

export function collectCodexToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { logData, subagentsMap } = loadCodexLogs(dir);
  return extractCodexMetadata(logData, subagentsMap).toolsUsed;
}

/**
 * Parses Pi CLI session JSONL files into a normalized TrajectorySummary.
 */
export function parsePiTrajectory(logData: any[], subagentsMap: Record<string, any[]> = {}): TrajectorySummary {
  const steps: StandardizedStep[] = [];

  const processEntries = (entries: any[], subagentId?: string) => {
    for (const entry of entries) {
      const timestamp = extractTimestamp(entry);
      const msg = entry.type === 'message' ? entry.message : entry;
      if (!msg) continue;

      if (msg.role === 'assistant') {
        let thought = '';
        if (typeof msg.content === 'string') {
          thought = msg.content;
        } else if (Array.isArray(msg.content)) {
          const textBlock = msg.content.find((c: any) => c.type === 'text');
          if (textBlock) thought = textBlock.text || '';
        }

        const toolCalls: any[] = [];
        if (Array.isArray(msg.content)) {
          toolCalls.push(...msg.content.filter((c: any) => c.type === 'toolCall'));
        }
        if (Array.isArray(msg.tool_calls)) {
          toolCalls.push(...msg.tool_calls);
        }

        if (toolCalls.length === 0) {
          if (thought) {
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought,
              action: {
                type: 'other',
                name: 'respond_to_user',
                params: { response: truncateMessage(thought, 150) }
              },
              outcome: { status: 'success' }
            });
          }
        } else {
          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name || 'tool_call';
            const args = tc.arguments || tc.function?.arguments || {};
            steps.push({
              stepNumber: 0,
              timestamp,
              subagentId,
              thought: thought || `Executing ${toolName}`,
              action: {
                type: mapToolType(toolName),
                name: toolName,
                params: typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return { raw: args }; } })() : args
              },
              outcome: { status: 'success' }
            });
          }
        }
      }
    }
  };

  processEntries(logData);
  for (const [subId, subLogs] of Object.entries(subagentsMap)) {
    processEntries(subLogs, subId);
  }

  const subagentsMeta: Record<string, SubagentMetadata> = {};
  for (const subId of Object.keys(subagentsMap)) {
    const subStepsCount = steps.filter(s => s.subagentId === subId).length;
    subagentsMeta[subId] = {
      id: subId,
      agent: Agents.PI,
      totalSteps: subStepsCount
    };
  }

  return finalizeTrajectorySummary({
    agent: Agents.PI,
    steps,
    subagents: Object.keys(subagentsMeta).length > 0 ? subagentsMeta : undefined
  });
}

export function extractPiMetadata(logData: any[], subagentsMap: Record<string, any[]> = {}): {
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
    for (const msg of entries) {
      let model: string | undefined;
      if (msg.type === 'message' && msg.message?.model) {
        model = msg.message.model;
      } else if (msg.type === 'model_change' && msg.modelId) {
        model = msg.modelId;
      }
      if (!model && msg.metadata?.model) {
        model = msg.metadata.model;
      }
      if (model) {
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      }

      const usage = msg.message?.usage || msg.metadata?.usage || msg.usage;
      if (usage) {
        totalTokens += usage.totalTokens || 0;
        if (usage.cacheRead !== undefined) {
          cachedTokens += usage.cacheRead;
        }
        hasTokenData = true;
      }

      const assistantMsg = msg.type === 'message' ? msg.message : msg;
      if (assistantMsg?.role === 'assistant') {
        const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
        if (assistantMsg.tool_calls) {
          toolCalls.push(...assistantMsg.tool_calls);
        }

        for (const tc of toolCalls) {
          const toolName = tc.function?.name || tc.name;
          if (toolName && toolName !== 'read' && toolName !== 'write' && toolName !== 'edit' && toolName !== 'bash') {
            if (toolName === 'modern-web-guidance' || toolName.includes('get_best_practices')) {
              toolsUsed.add('modern-web-guidance');
            } else {
              toolsUsed.add(toolName);
            }
          }

          const args = tc.arguments || {};
          if (toolName === 'read' && (args.path || args.file_path)) {
            const filePath = (args.path || args.file_path) as string;
            if (filePath.includes('/skills/') || filePath.includes('.agents/skills/')) {
              const match = filePath.match(/\/skills\/[^/]+\/guides\/[^/]+\/([^/]+)\/guide\.md$/) ||
                            filePath.match(/\/skills\/[^/]+\/references\/[^/]+\/([^/]+)\.md$/) ||
                            filePath.match(/\/skills\/[^/]+\/(?:[^/]+\/)*([^/]+)\.md$/);
              if (match && match[1] !== 'guide') {
                fileReadGuides.add(match[1]);
              }
            }
          } else if (toolName === 'bash' && args.command) {
            const command = args.command as string;
            const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
            if (match) {
              match[1].split(',').map((s: string) => s.trim()).forEach((g: string) => retrievedGuides.add(g));
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

function loadPiLogs(dirPath: string): { logData: any[]; subagentsMap: Record<string, any[]> } {
  const sessionFiles = getSessionFiles(dirPath, '*.jsonl');
  const logData: any[] = [];
  const subagentsMap: Record<string, any[]> = {};

  for (const file of sessionFiles) {
    const sessionPath = path.join(dirPath, file);
    let parsedLines: any[] = [];
    try {
      parsedLines = parseJsonlFile(sessionPath);
    } catch {}

    const parts = file.replace(/\.jsonl$/, '').split(/agent[-_]/);
    const key = parts.length > 1 ? parts[parts.length - 1] : file.replace(/\.jsonl$/, '').replace(/^(?:subagent-|session-)/, '');
    const isSubagent = file.startsWith('subagent-') || file.includes('-subagents-');

    if (isSubagent) {
      subagentsMap[key] = parsedLines;
    } else {
      logData.push(...parsedLines);
    }
  }

  return { logData, subagentsMap };
}

export async function collectPiGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
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
  const { logData, subagentsMap } = loadPiLogs(dirPath);
  const meta = extractPiMetadata(logData, subagentsMap);
  return { retrievedGuides: meta.retrievedGuides, fileReadGuides: meta.fileReadGuides };
}

export function extractPiModel(resultsDir: string): string {
  const summaryPath = path.join(resultsDir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.model && summary.model !== 'unknown') return summary.model;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(resultsDir);
  return extractPiMetadata(logData, subagentsMap).model;
}

export function extractPiTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.tokenUsage) return summary.tokenUsage;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(dir);
  return extractPiMetadata(logData, subagentsMap).tokenUsage;
}

export function collectPiToolsFromTrajectory(dir: string): string[] {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (summary.toolsUsed) return summary.toolsUsed;
    } catch {}
  }
  const { logData, subagentsMap } = loadPiLogs(dir);
  return extractPiMetadata(logData, subagentsMap).toolsUsed;
}

export async function generateNormalizedTrajectory(targetDir: string, agentName: string, initialPrompt?: string): Promise<void> {
  try {
    let summary: TrajectorySummary | null = null;

    let allFiles: string[] = [];
    try {
      allFiles = fs.readdirSync(targetDir);
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }

    const mainSessionFiles = allFiles
      .filter(f => f.startsWith('session-') && !f.includes('-subagents-') && (f.endsWith('.json') || f.endsWith('.jsonl')))
      .sort((a, b) => a.localeCompare(b));

    const subagentFiles = allFiles
      .filter(f => (f.startsWith('subagent-') || f.includes('-subagents-')) && (f.endsWith('.json') || f.endsWith('.jsonl')))
      .sort((a, b) => a.localeCompare(b));

    const subagentsMap: Record<string, any[]> = {};
    for (const file of subagentFiles) {
      const filePath = path.join(targetDir, file);
      try {
        const logData = file.endsWith('.jsonl') ? parseJsonlFile(filePath) : JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const stripped = file.replace(/\.jsonl?$/, '');
        const parts = stripped.split(/agent[-_]/);
        const key = parts.length > 1 ? parts[parts.length - 1] : stripped.replace(/^(?:subagent-|session-)/, '');
        subagentsMap[key] = Array.isArray(logData) ? logData : ((logData as any)?.messages || []);
      } catch (e) {
        console.warn(`[TrajectoryParser] Failed to parse subagent file ${file}:`, e);
      }
    }

    if (agentName === Agents.JETSKI || agentName === Agents.JETSKI_CLI) {
      summary = await parseJetskiTrajectory(targetDir, agentName);
    } else if (mainSessionFiles[0] || subagentFiles[0]) {
      const primaryFile = mainSessionFiles[0] || subagentFiles[0];
      const filePath = path.join(targetDir, primaryFile);
      const isJsonl = filePath.endsWith('.jsonl');
      const logData = isJsonl ? parseJsonlFile(filePath) : JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (agentName === Agents.CLAUDE_CODE) {
        summary = parseClaudeTrajectory(logData, subagentsMap);
        const meta = extractClaudeMetadata(logData, subagentsMap);
        summary.retrievedGuides = meta.retrievedGuides;
        summary.fileReadGuides = meta.fileReadGuides;
        summary.toolsUsed = meta.toolsUsed;
        summary.model = meta.model;
        summary.tokenUsage = meta.tokenUsage;
      } else if (agentName === Agents.GEMINI_CLI) {
        summary = parseGeminiTrajectory(logData, subagentsMap);
        const meta = extractGeminiMetadata(logData, subagentsMap);
        summary.retrievedGuides = meta.retrievedGuides;
        summary.fileReadGuides = meta.fileReadGuides;
        summary.toolsUsed = meta.toolsUsed;
        summary.model = meta.model;
        summary.tokenUsage = meta.tokenUsage;
      } else if (agentName === Agents.CODEX_CLI) {
        summary = parseCodexTrajectory(logData, subagentsMap);
        const meta = extractCodexMetadata(logData, subagentsMap);
        summary.retrievedGuides = meta.retrievedGuides;
        summary.fileReadGuides = meta.fileReadGuides;
        summary.toolsUsed = meta.toolsUsed;
        summary.model = meta.model;
        summary.tokenUsage = meta.tokenUsage;
      } else if (agentName === Agents.PI) {
        summary = parsePiTrajectory(logData, subagentsMap);
        const meta = extractPiMetadata(logData, subagentsMap);
        summary.retrievedGuides = meta.retrievedGuides;
        summary.fileReadGuides = meta.fileReadGuides;
        summary.toolsUsed = meta.toolsUsed;
        summary.model = meta.model;
        summary.tokenUsage = meta.tokenUsage;
      } else {
        console.warn(`[TrajectoryParser] Warning: Unknown agent "${agentName}". Attempting generic Codex/standard trajectory parsing. To add another agent, register a parser in generateNormalizedTrajectory.`);
        summary = parseCodexTrajectory(logData, subagentsMap);
      }
    } else {
      console.warn(`[TrajectoryParser] Warning: No session files found for non-Jetski agent "${agentName}". Cannot parse trajectory.`);
    }

    if (summary) {
      finalizeTrajectorySummary(summary);

      if (initialPrompt) {
        summary.initialPrompt = initialPrompt;
      }

      // Merge MCP logs if it is desktop Jetski
      if (agentName === Agents.JETSKI) {
        const mcpGuides = extractGuidesFromMcpLog(targetDir);
        summary.retrievedGuides = [...new Set([...(summary.retrievedGuides || []), ...mcpGuides])];
        if (!summary.toolsUsed) {
          summary.toolsUsed = ['modern-web-guidance'];
        } else if (!summary.toolsUsed.includes('modern-web-guidance')) {
          summary.toolsUsed.push('modern-web-guidance');
        }
      }

      const outPath = path.join(targetDir, 'trajectory_summary.json');
      fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`[TrajectoryParser] Generated trajectory summary: ${outPath}`);
    } else {
      console.warn(`[TrajectoryParser] No trajectory files found in ${targetDir} to summarize.`);
    }
  } catch (err: any) {
    console.error(`[TrajectoryParser] Robustness warning: Failed to generate trajectory summary: ${err.message}`);
    try {
      const placeholder: TrajectorySummary = finalizeTrajectorySummary({
        agent: agentName,
        steps: [{
          stepNumber: 1,
          thought: "Failed to parse trajectory logs during execution.",
          outcome: { status: 'error', message: `Telemetry unparseable: ${err.message}` }
        }]
      });
      fs.writeFileSync(path.join(targetDir, 'trajectory_summary.json'), JSON.stringify(placeholder, null, 2), 'utf8');
    } catch {}
  }
}

function extractGuidesFromMcpLog(dirPath: string): string[] {
  const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
  let logContent = '';
  try {
    logContent = fs.readFileSync(logPath, 'utf8').trim();
  } catch (err) {
    if (isEnoent(err)) return [];
    console.error(`Error reading MCP log:`, err);
    return [];
  }
  if (!logContent) return [];
  const lines = logContent.split('\n');
  const toolCalls: any[] = [];
  for (const line of lines) {
    if (line.trim().startsWith('{')) {
      try {
        toolCalls.push(JSON.parse(line));
      } catch {}
    }
  }
  return toolCalls
    .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
    .flatMap(call => call.result.map((r: any) => r.id || ''))
    .filter(Boolean);
}
