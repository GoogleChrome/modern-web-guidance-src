import fs from 'fs';
import path from 'path';
import { parseJsonlFile } from './agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';

// Import agent-specific extractors (accepting circular dependency for runtime execution)
import { parseJetskiCliSession } from '../agents/jetski-cli-agent.ts';
import { collectGeminiGuidesFromTrajectory, collectGeminiToolsFromTrajectory, extractGeminiCliModel, extractGeminiCliTokenUsage } from '../agents/gemini-cli-agent.ts';
import { collectClaudeGuidesFromTrajectory, collectClaudeToolsFromTrajectory, extractClaudeCodeModel, extractClaudeCodeTokenUsage } from '../agents/claude-code-agent.ts';
import { collectCodexGuidesFromTrajectory, collectCodexToolsFromTrajectory, extractCodexCliModel, extractCodexCliTokenUsage } from '../agents/codex-cli-agent.ts';
import { collectPiGuidesFromTrajectory, collectPiToolsFromTrajectory, extractPiModel, extractPiTokenUsage } from '../agents/pi-agent.ts';

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}

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
  serving?: string;
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
    // Sort steps monotonically by timestamp when available, preserving stable order otherwise
    summary.steps.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
      }
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
          const timestamp = extractTimestamp(obj) || (r.timestamp ? new Date(r.timestamp).toISOString() : undefined);
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
        const [guides, tools, model, tokenUsage] = await Promise.all([
          collectClaudeGuidesFromTrajectory(targetDir),
          Promise.resolve(collectClaudeToolsFromTrajectory(targetDir)),
          Promise.resolve(extractClaudeCodeModel(targetDir)),
          Promise.resolve(extractClaudeCodeTokenUsage(targetDir))
        ]);
        summary.retrievedGuides = guides.retrievedGuides;
        summary.fileReadGuides = guides.fileReadGuides;
        summary.toolsUsed = tools;
        summary.model = model;
        summary.tokenUsage = tokenUsage;
      } else if (agentName === Agents.GEMINI_CLI) {
        summary = parseGeminiTrajectory(logData, subagentsMap);
        const [guides, tools, model, tokenUsage] = await Promise.all([
          collectGeminiGuidesFromTrajectory(targetDir),
          Promise.resolve(collectGeminiToolsFromTrajectory(targetDir)),
          Promise.resolve(extractGeminiCliModel(targetDir)),
          Promise.resolve(extractGeminiCliTokenUsage(targetDir))
        ]);
        summary.retrievedGuides = guides.retrievedGuides;
        summary.fileReadGuides = guides.fileReadGuides;
        summary.toolsUsed = tools;
        summary.model = model;
        summary.tokenUsage = tokenUsage;
      } else if (agentName === Agents.CODEX_CLI) {
        summary = parseCodexTrajectory(logData, subagentsMap);
        const [guides, tools, model, tokenUsage] = await Promise.all([
          collectCodexGuidesFromTrajectory(targetDir),
          Promise.resolve(collectCodexToolsFromTrajectory(targetDir)),
          Promise.resolve(extractCodexCliModel(targetDir)),
          Promise.resolve(extractCodexCliTokenUsage(targetDir))
        ]);
        summary.retrievedGuides = guides.retrievedGuides;
        summary.fileReadGuides = guides.fileReadGuides;
        summary.toolsUsed = tools;
        summary.model = model;
        summary.tokenUsage = tokenUsage;
      } else if (agentName === Agents.PI) {
        summary = parseCodexTrajectory(logData, subagentsMap);
        const [guides, tools, model, tokenUsage] = await Promise.all([
          collectPiGuidesFromTrajectory(targetDir),
          Promise.resolve(collectPiToolsFromTrajectory(targetDir)),
          Promise.resolve(extractPiModel(targetDir)),
          Promise.resolve(extractPiTokenUsage(targetDir))
        ]);
        summary.retrievedGuides = guides.retrievedGuides;
        summary.fileReadGuides = guides.fileReadGuides;
        summary.toolsUsed = tools;
        summary.model = model;
        summary.tokenUsage = tokenUsage;
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
