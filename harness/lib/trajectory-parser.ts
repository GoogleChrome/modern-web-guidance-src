import fs from 'fs';
import path from 'path';
import { parseJsonlFile } from './agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

export interface StandardizedStep {
  stepNumber: number;
  timestamp?: string;
  thought?: string;
  action?: {
    type: 'tool_call' | 'api_call' | 'web_search' | 'read_file' | 'write_file' | 'run_command' | 'other';
    name: string;
    params?: Record<string, any>;
  };
  outcome?: {
    status: 'success' | 'error';
    message?: string;
    exitCode?: number;
  };
}

export interface TrajectorySummary {
  agent: string;
  serving: string;
  steps: StandardizedStep[];
  tokenUsage?: { total: number; cached: number };
}

/**
 * Maps a tool name to a standardized action type.
 */
function mapToolType(toolName: string): StandardizedStep['action']['type'] {
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
export function parseClaudeTrajectory(logData: any[], serving: string): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let stepCounter = 1;
  const toolUseToStepMap = new Map<string, number>(); // tool_use_id -> step index in 'steps' array

  for (const entry of logData) {
    let role = entry.role || entry.type || 'unknown';
    let content = entry.message?.content || entry.content || entry;
    if (entry.message) {
      role = entry.message.role || role;
    }

    if (role === 'assistant' && Array.isArray(content)) {
      // 1. Extract thought from this assistant turn
      let thought = '';
      const thinkingBlock = content.find(b => b.type === 'thinking');
      const textBlock = content.find(b => b.type === 'text');
      
      if (thinkingBlock?.thinking) {
        thought = thinkingBlock.thinking;
      } else if (textBlock?.text) {
        // Try extracting <thinking>...</thinking>
        const match = textBlock.text.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (match) {
          thought = match[1];
        } else {
          thought = textBlock.text; // fallback
        }
      }

      // 2. Process all tool calls in this turn
      const toolUses = content.filter(b => b.type === 'tool_use');
      
      if (toolUses.length === 0) {
        // Just a final text response / thought step
        steps.push({
          stepNumber: stepCounter++,
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
          const stepIdx = steps.push({
            stepNumber: stepCounter++,
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
        }
      }
    } else if (role === 'user' || role === 'system') {
      // Process tool results which are returned by the user/system environment
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
          }
        }
      }
    }
  }

  return {
    agent: 'Claude Code',
    serving,
    steps
  };
}

/**
 * Parses Gemini CLI session JSON/JSONL files into a normalized TrajectorySummary.
 */
export function parseGeminiTrajectory(session: any, serving: string): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let stepCounter = 1;

  const messages = Array.isArray(session) ? session : (session.messages || []);
  
  // Track consecutive steps to match tool calls and tool results
  let lastAssistantStepIndices: number[] = [];

  for (const msg of messages) {
    const role = msg.type || msg.role || 'unknown';

    if (role === 'gemini') {
      lastAssistantStepIndices = [];
      const thought = msg.thought || msg.text || '';
      
      const toolCalls = msg.toolCalls || [];
      if (toolCalls.length === 0) {
        steps.push({
          stepNumber: stepCounter++,
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
            stepNumber: stepCounter++,
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
      // Match tool results to the preceding assistant tool calls
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
      // Clear to avoid double-matching
      lastAssistantStepIndices = [];
    }
  }

  return {
    agent: 'Gemini CLI',
    serving,
    steps
  };
}

/**
 * Synthesizes a normalized TrajectorySummary for Jetski/MCP using modern-web.log and chat_log.txt.
 */
export function parseJetskiTrajectory(dirPath: string, serving: string): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let stepCounter = 1;

  // 1. Process modern-web.log for guide searches/retrievals
  const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
  if (fs.existsSync(logPath)) {
    try {
      const logContent = fs.readFileSync(logPath, 'utf8').trim();
      if (logContent) {
        const lines = logContent.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const call = JSON.parse(line);
            if (call.tool === 'get_best_practices') {
              steps.push({
                stepNumber: stepCounter++,
                thought: 'Searching for relevant web guidance patterns',
                action: {
                  type: 'web_search',
                  name: 'get_best_practices',
                  params: { query: call.query }
                },
                outcome: {
                  status: 'success',
                  message: `Retrieved ${call.result?.length || 0} guides`
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`[TrajectoryParser] Error reading modern-web.log:`, e);
    }
  }

  // 2. Process chat_log.txt for final response / high-level actions
  const chatLogPath = path.join(dirPath, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    try {
      const chatText = fs.readFileSync(chatLogPath, 'utf8').trim();
      if (chatText) {
        steps.push({
          stepNumber: stepCounter++,
          thought: 'Completed task implementation and summarized changes',
          action: {
            type: 'other',
            name: 'respond_to_user',
            params: { response: truncateMessage(chatText, 300) }
          },
          outcome: { status: 'success' }
        });
      }
    } catch (e) {
      console.error(`[TrajectoryParser] Error reading chat_log.txt:`, e);
    }
  }

  return {
    agent: 'Jetski',
    serving,
    steps
  };
}

/**
 * Generates and saves 'trajectory_summary.json' in the target directory.
 */
export async function generateNormalizedTrajectory(targetDir: string, agentName: string, serving: string): Promise<void> {
  try {
    let summary: TrajectorySummary | null = null;

    if (agentName.toLowerCase().includes('claude')) {
      // Find session-*.jsonl
      const sessionFiles = fs.readdirSync(targetDir).filter(f => f.startsWith('session-') && f.endsWith('.jsonl'));
      if (sessionFiles[0]) {
        const filePath = path.join(targetDir, sessionFiles[0]);
        const logData = parseJsonlFile(filePath);
        summary = parseClaudeTrajectory(logData, serving);
      }
    } else if (agentName.toLowerCase().includes('gemini')) {
      // Find session-*.json or session-*.jsonl
      const sessionFiles = fs.readdirSync(targetDir).filter(f => f.startsWith('session-') && (f.endsWith('.json') || f.endsWith('.jsonl')));
      if (sessionFiles[0]) {
        const filePath = path.join(targetDir, sessionFiles[0]);
        let sessionData: any = [];
        if (filePath.endsWith('.jsonl')) {
          sessionData = parseJsonlFile(filePath);
        } else {
          sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        summary = parseGeminiTrajectory(sessionData, serving);
      }
    } else {
      // Jetski / fallbacks
      summary = parseJetskiTrajectory(targetDir, serving);
    }

    if (summary) {
      // Inject token usage if available
      const runtimePath = path.join(targetDir, 'runtime.json');
      if (fs.existsSync(runtimePath)) {
        try {
          const runJson = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
          if (runJson.tokenUsage) {
            summary.tokenUsage = runJson.tokenUsage;
          }
        } catch {}
      }

      const outPath = path.join(targetDir, 'trajectory_summary.json');
      fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`[TrajectoryParser] Generated trajectory summary: ${outPath}`);
    } else {
      console.warn(`[TrajectoryParser] No trajectory files found in ${targetDir} to summarize.`);
    }
  } catch (err: any) {
    // Graceful failure constraint! Ensure it never crashes the run.
    console.error(`[TrajectoryParser] Robustness warning: Failed to generate trajectory summary: ${err.message}`);
    
    // Write a placeholder file so the UI knows it failed but remains robust
    try {
      const placeholder: TrajectorySummary = {
        agent: agentName,
        serving,
        steps: [{
          stepNumber: 1,
          thought: "Failed to parse trajectory logs during execution.",
          outcome: { status: 'error', message: `Telemetry unparseable: ${err.message}` }
        }]
      };
      fs.writeFileSync(path.join(targetDir, 'trajectory_summary.json'), JSON.stringify(placeholder, null, 2), 'utf8');
    } catch {}
  }
}
