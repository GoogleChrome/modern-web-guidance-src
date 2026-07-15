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
    output?: any;
    exitCode?: number;
  };
}

export interface TrajectorySummary {
  agent: string;
  serving: string;
  steps: StandardizedStep[];
  tokenUsage?: { total: number; cached: number };
  initialPrompt?: string;
}

export function extractInitialPromptFromLogs(logData?: any[], chatLogText?: string): string {
  if (logData && Array.isArray(logData)) {
    for (const entry of logData) {
      let role = entry.role || entry.type || 'unknown';
      let content = entry.message?.content || entry.content || entry.payload?.message || entry;
      if (entry.message) role = entry.message.role || role;
      
      if (role === 'user' || role === 'USER_INPUT' || (entry.type === 'event_msg' && entry.payload?.type === 'user_message')) {
        const text = Array.isArray(content)
          ? content.find((c: any) => c.type === 'text')?.text || content[0]?.text || ''
          : (typeof content === 'string' ? content : (content?.text || ''));
        const cleanText = String(text).trim();
        if (cleanText && !cleanText.includes('Base directory for this skill') && !cleanText.includes('Launching skill')) {
          if (cleanText.includes('ARGUMENTS:')) {
            const idx = cleanText.indexOf('ARGUMENTS:');
            return cleanText.slice(idx).trim();
          }
          return cleanText;
        }
      }
    }
  }

  if (chatLogText) {
    const lines = chatLogText.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const obj = JSON.parse(line);
          const role = obj.role || obj.type || obj.message?.role || 'unknown';
          if (role === 'user' || role === 'USER_INPUT') {
            const content = obj.message?.content || obj.content;
            const text = Array.isArray(content)
              ? content.find((c: any) => c.type === 'text')?.text || content[0]?.text || ''
              : (typeof content === 'string' ? content : (content?.text || ''));
            const cleanText = String(text).trim();
            if (cleanText && !cleanText.includes('Base directory for this skill') && !cleanText.includes('Launching skill')) {
              if (cleanText.includes('ARGUMENTS:')) {
                const idx = cleanText.indexOf('ARGUMENTS:');
                return cleanText.slice(idx).trim();
              }
              return cleanText;
            }
          }
        } catch {}
      }
    }
    const firstChunk = chatLogText.slice(0, 2000).trim();
    if (firstChunk && !firstChunk.startsWith('{')) {
      return firstChunk.split('\n')[0].trim();
    }
  }

  return '';
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
 * Helper to extract valid JSON objects from a raw string where binary protobuf bytes may surround the braces.
 */
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

/**
 * Synthesizes a normalized TrajectorySummary for Jetski/MCP using .db files, modern-web.log, and chat_log.txt.
 */
export async function parseJetskiTrajectory(dirPath: string, serving: string): Promise<TrajectorySummary> {
  const steps: StandardizedStep[] = [];
  let stepCounter = 1;
  const seenJsonHashes = new Set<string>();

  // 1. Check for Jetski SQLite .db database files to extract real tool calls and step mutations
  const dbFiles = fs.existsSync(dirPath) ? fs.readdirSync(dirPath).filter(f => f.endsWith('.db')) : [];
  if (dbFiles.length > 0) {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const dbPath = path.join(dirPath, dbFiles[0]);
      const db = new DatabaseSync(dbPath);
      const rows = db.prepare('SELECT idx, step_type, status, step_payload FROM steps ORDER BY idx').all() as any[];
      
      for (const r of rows) {
        if (!r.step_payload) continue;
        const str = Buffer.from(r.step_payload).toString('utf8');
        const objs = findJsonObjectsInString(str);
        const isErr = r.status === 4 || r.status === 5 || r.status === 2;

        for (const obj of objs) {
          if (!obj.toolAction && !obj.toolSummary && !obj.CommandLine && !obj.AbsolutePath && !obj.DirectoryPath && !obj.TargetFile) {
            continue;
          }

          const key = JSON.stringify({
            cmd: obj.CommandLine,
            file: obj.AbsolutePath || obj.TargetFile || obj.DirectoryPath,
            act: obj.toolAction || obj.toolSummary
          });
          if (seenJsonHashes.has(key)) continue;
          seenJsonHashes.add(key);

          if (obj.TargetFile || (obj.toolAction && (obj.toolAction.includes('Modifying') || obj.toolAction.includes('Updating') || obj.toolAction.includes('Writing')))) {
            const targetFile = obj.TargetFile || 'target_file';
            const toolName = obj.ReplacementChunks ? 'multi_replace_file_content' : (obj.CodeContent ? 'write_to_file' : 'replace_file_content');
            steps.push({
              stepNumber: stepCounter++,
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
            if (obj.CommandLine.includes('modern-web-guidance') && (obj.CommandLine.includes('search') || obj.CommandLine.includes('retrieve'))) {
              actType = 'web_search';
              actName = 'get_best_practices';
              const qMatch = obj.CommandLine.match(/(?:search|retrieve)\s+["']?([^"'\n]+)["']?/i);
              params = { query: qMatch ? truncateMessage(qMatch[1], 150) : truncateMessage(obj.CommandLine, 150), command: truncateMessage(obj.CommandLine, 150) };
            }
            steps.push({
              stepNumber: stepCounter++,
              thought: obj.toolSummary || obj.toolAction || 'Running terminal command',
              action: {
                type: actType,
                name: actName,
                params
              },
              outcome: {
                status: isErr ? 'error' : 'success'
              }
            });
          } else if (obj.AbsolutePath) {
            steps.push({
              stepNumber: stepCounter++,
              thought: obj.toolSummary || obj.toolAction || 'Reading file contents',
              action: {
                type: 'read_file',
                name: 'view_file',
                params: { targetFile: truncateMessage(obj.AbsolutePath, 150) }
              },
              outcome: {
                status: isErr ? 'error' : 'success'
              }
            });
          } else if (obj.DirectoryPath) {
            steps.push({
              stepNumber: stepCounter++,
              thought: obj.toolSummary || obj.toolAction || 'Listing directory',
              action: {
                type: 'read_file',
                name: 'list_dir',
                params: { directoryPath: truncateMessage(obj.DirectoryPath, 150) }
              },
              outcome: {
                status: isErr ? 'error' : 'success'
              }
            });
          }
        }
      }
    } catch (e: any) {
      console.warn(`[TrajectoryParser] Note: Could not parse Jetski .db file with node:sqlite (${e.message}). Falling back to log files.`);
    }
  }

  // 2. Process modern-web.log for guide searches/retrievals and attach actual results
  const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
  if (fs.existsSync(logPath)) {
    try {
      const logContent = fs.readFileSync(logPath, 'utf8').trim();
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
                stepNumber: stepCounter++,
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
    } catch (e) {
      console.error(`[TrajectoryParser] Error reading modern-web.log:`, e);
    }
  }

  // 3. Process chat_log.txt for final response / high-level actions
  const chatLogPath = path.join(dirPath, 'chat_log.txt');
  if (fs.existsSync(chatLogPath)) {
    try {
      const chatText = fs.readFileSync(chatLogPath, 'utf8').trim();
      if (chatText && (steps.length === 0 || steps[steps.length - 1].action?.name !== 'respond_to_user')) {
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
 * Parses Codex / OpenAI CLI session JSONL files into a normalized TrajectorySummary.
 */
export function parseCodexTrajectory(logData: any[], serving: string): TrajectorySummary {
  const steps: StandardizedStep[] = [];
  let stepCounter = 1;
  let currentThought = '';
  const callMap = new Map<string, StandardizedStep>();

  for (const entry of logData) {
    if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message') {
      const msg = entry.payload;
      if (msg.phase === 'commentary') {
        currentThought = currentThought ? `${currentThought}\n${msg.message}` : msg.message;
      }
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
        stepNumber: stepCounter++,
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
        stepNumber: stepCounter++,
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

  return {
    agent: 'Codex',
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

    const sessionFiles = fs.existsSync(targetDir) ? fs.readdirSync(targetDir).filter(f => f.startsWith('session-') && (f.endsWith('.json') || f.endsWith('.jsonl'))) : [];

    // To add another agent in the future, check agentName or session files here and invoke the corresponding parser.
    if (agentName.toLowerCase().includes('jetski') || (!sessionFiles[0] && fs.existsSync(targetDir) && fs.readdirSync(targetDir).some(f => f.endsWith('.db')))) {
      summary = await parseJetskiTrajectory(targetDir, serving);
    } else if (sessionFiles[0]) {
      const filePath = path.join(targetDir, sessionFiles[0]);
      const isJsonl = filePath.endsWith('.jsonl');
      const logData = isJsonl ? parseJsonlFile(filePath) : JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (agentName.toLowerCase().includes('claude')) {
        summary = parseClaudeTrajectory(logData, serving);
      } else if (agentName.toLowerCase().includes('gemini')) {
        summary = parseGeminiTrajectory(logData, serving);
      } else if (agentName.toLowerCase().includes('codex')) {
        summary = parseCodexTrajectory(logData, serving);
      } else {
        console.warn(`[TrajectoryParser] Warning: Unknown agent "${agentName}". Attempting generic Codex/standard trajectory parsing. To add another agent, register a parser in generateNormalizedTrajectory.`);
        summary = parseCodexTrajectory(logData, serving);
      }
    } else {
      summary = await parseJetskiTrajectory(targetDir, serving);
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

        if (!summary.initialPrompt) {
          const chatLogPath = path.join(targetDir, 'chat_log.txt');
          const chatText = fs.existsSync(chatLogPath) ? fs.readFileSync(chatLogPath, 'utf8') : '';
          const filePath = sessionFiles[0] ? path.join(targetDir, sessionFiles[0]) : '';
          let logData: any[] = [];
          if (filePath && fs.existsSync(filePath)) {
            try {
              logData = filePath.endsWith('.jsonl') ? parseJsonlFile(filePath) : JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch {}
          }
          const promptFound = extractInitialPromptFromLogs(Array.isArray(logData) ? logData : [], chatText);
          if (promptFound) summary.initialPrompt = truncateMessage(promptFound, 1000);
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
