import fs from 'fs';
import path from 'path';
import { parseJsonlFile } from './agent-shared.ts';
import { Agents } from '../config.ts';

// Colocated agent parsers
import { parseClaudeTrajectory } from '../agents/claude-code-agent.ts';
import { parseGeminiTrajectory } from '../agents/gemini-cli-agent.ts';
import { parseCodexTrajectory } from '../agents/codex-cli-agent.ts';
import { parseJetskiTrajectory } from '../agents/jetski-cli-agent.ts';
import { parsePiTrajectory } from '../agents/pi-agent.ts';

// Re-export for test compatibility and legacy callers
export {
  parseClaudeTrajectory,
  collectClaudeGuidesFromTrajectory,
  collectClaudeToolsFromTrajectory,
  extractClaudeCodeModel,
  extractClaudeCodeTokenUsage,
  loadClaudeLogs,
  extractClaudeMetadata
} from '../agents/claude-code-agent.ts';

export {
  parseGeminiTrajectory,
  collectGeminiGuidesFromTrajectory,
  collectGeminiToolsFromTrajectory,
  extractGeminiCliModel,
  extractGeminiCliTokenUsage,
  loadGeminiLogs,
  extractGeminiMetadata
} from '../agents/gemini-cli-agent.ts';

export {
  parseCodexTrajectory,
  collectCodexGuidesFromTrajectory,
  collectCodexToolsFromTrajectory,
  extractCodexCliModel,
  extractCodexCliTokenUsage,
  loadCodexLogs,
  extractCodexMetadata
} from '../agents/codex-cli-agent.ts';

export {
  parseJetskiTrajectory,
  parseJetskiCliSession,
  collectJetskiCliGuidesFromTrajectory,
  collectJetskiCliToolsFromTrajectory,
  extractJetskiCliModel,
  extractJetskiCliTokenUsage
} from '../agents/jetski-cli-agent.ts';

export {
  parsePiTrajectory,
  collectPiGuidesFromTrajectory,
  collectPiToolsFromTrajectory,
  extractPiModel,
  extractPiTokenUsage,
  loadPiLogs,
  extractPiMetadata
} from '../agents/pi-agent.ts';


export const TRAJECTORY_SUMMARY_FILE = 'trajectory_summary.json';

const TRAJECTORY_GLOB = 'session-*.{json,jsonl}';

export function getSessionFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.globSync(TRAJECTORY_GLOB, { cwd: dir });
}

export type CanonicalCategory =
  | 'guide_retrieval'
  | 'skill_search'
  | 'code_mutation'
  | 'mandatory_rule_thought'
  | 'incidental_noise'
  | 'other';

export interface RunCommandAction {
  type: 'run_command';
  canonicalCategory?: CanonicalCategory;
  name: string;
  params: { command: string; [key: string]: unknown };
}

export interface ReadFileAction {
  type: 'read_file';
  canonicalCategory?: CanonicalCategory;
  name: string;
  params: { path: string; [key: string]: unknown };
}

export interface WriteFileAction {
  type: 'write_file';
  canonicalCategory?: CanonicalCategory;
  name: string;
  params: { path: string; content?: string; [key: string]: unknown };
}

export interface WebSearchAction {
  type: 'web_search';
  canonicalCategory?: CanonicalCategory;
  name: string;
  params: { query: string; [key: string]: unknown };
}

export interface OtherAction {
  type: 'other';
  canonicalCategory?: CanonicalCategory;
  name: string;
  params?: Record<string, unknown>;
}

export type StandardizedAction =
  | RunCommandAction
  | ReadFileAction
  | WriteFileAction
  | WebSearchAction
  | OtherAction;

export interface RunCommandRawParams {
  command?: string;
  cmd?: string;
  [key: string]: unknown;
}

export interface ReadFileRawParams {
  path?: string;
  file_path?: string;
  [key: string]: unknown;
}

export interface WriteFileRawParams {
  path?: string;
  file_path?: string;
  content?: string;
  new_string?: string;
  newText?: string;
  [key: string]: unknown;
}

export interface WebSearchRawParams {
  query?: string;
  Query?: string;
  use_case_id?: string;
  [key: string]: unknown;
}

export function standardizeAction(type: 'run_command', name: string, rawParams?: string | RunCommandRawParams): RunCommandAction;
export function standardizeAction(type: 'read_file', name: string, rawParams?: string | ReadFileRawParams): ReadFileAction;
export function standardizeAction(type: 'write_file', name: string, rawParams?: string | WriteFileRawParams): WriteFileAction;
export function standardizeAction(type: 'web_search', name: string, rawParams?: string | WebSearchRawParams): WebSearchAction;
export function standardizeAction(type: 'other', name: string, rawParams?: unknown): OtherAction;
export function standardizeAction(type: StandardizedAction['type'], name: string, rawParams?: unknown): StandardizedAction;
export function standardizeAction(
  type: StandardizedAction['type'],
  name: string,
  rawParams?: unknown
): StandardizedAction {
  const p = rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : {};
  switch (type) {
    case 'run_command': {
      const command = (p.command as string) || (p.cmd as string) || (typeof rawParams === 'string' ? rawParams : '') || '';
      return {
        type: 'run_command',
        name,
        params: { ...p, command: String(command) }
      };
    }
    case 'read_file': {
      const filePath = (p.path as string) || (p.file_path as string) || (typeof rawParams === 'string' ? rawParams : '') || '';
      return {
        type: 'read_file',
        name,
        params: { ...p, path: String(filePath) }
      };
    }
    case 'write_file': {
      const filePath = (p.path as string) || (p.file_path as string) || '';
      const rawContent = p.content ?? p.new_string ?? p.newText ?? undefined;
      const content = rawContent !== undefined ? String(rawContent) : undefined;
      return {
        type: 'write_file',
        name,
        params: {
          ...p,
          path: String(filePath),
          ...(content !== undefined ? { content } : {})
        }
      };
    }
    case 'web_search': {
      const query = (p.query as string) || (p.Query as string) || (p.use_case_id as string) || (typeof rawParams === 'string' ? rawParams : '') || '';
      return {
        type: 'web_search',
        name,
        params: { ...p, query: String(query) }
      };
    }
    case 'other':
    default: {
      return {
        type: 'other',
        name,
        params: rawParams && typeof rawParams === 'object' ? (rawParams as Record<string, unknown>) : rawParams !== undefined ? { value: rawParams } : undefined
      };
    }
  }
}

export interface StandardizedStep {
  stepNumber: number;
  timestamp?: string;
  subagentId?: string;
  thought?: string;
  action?: StandardizedAction;
  outcome?: {
    status: 'success' | 'error';
    message?: string;
    output?: unknown;
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

export function categorizeAction(
  name: string,
  params?: Record<string, any>,
  thought?: string,
  actionType?: StandardizedAction['type']
): NonNullable<StandardizedStep['action']>['canonicalCategory'] {
  if (actionType === 'write_file') {
    return 'code_mutation';
  }

  const actionName = (name || '').toLowerCase();
  if (actionName === 'respond_to_user') {
    return 'other';
  }

  const isMutationName = ['write', 'replace', 'edit', 'touch'].some(k => actionName.includes(k));
  if (isMutationName) {
    return 'code_mutation';
  }

  const mutationParamKeys = ['targetfile', 'replacementcontent', 'replacementchunks', 'codecontent', 'write_to_file', 'replace_file_content', 'new_string', 'newtext'];
  const paramKeys = params && typeof params === 'object' ? Object.keys(params).map(k => k.toLowerCase()) : [];
  const hasMutationParam = paramKeys.some(k => mutationParamKeys.includes(k));
  if (hasMutationParam) {
    return 'code_mutation';
  }

  const actionParamsStr = JSON.stringify(params || {}).toLowerCase();
  const thoughtStr = (thought || '').toLowerCase();

  // 2. Guide retrieval
  if (actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
    return 'guide_retrieval';
  }

  // 3. Skill search
  if (actionName.includes('search') || actionName.includes('get_best_practices') || actionName.includes('query_guidance') || actionParamsStr.includes('search')) {
    return 'skill_search';
  }

  // 4. Mandatory rule thought
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
    summary.steps.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
      }
      return 0;
    });

    for (let i = 0; i < summary.steps.length; i++) {
      const step = summary.steps[i];
      step.stepNumber = i + 1;
      if (step.action && !step.action.canonicalCategory) {
        step.action.canonicalCategory = categorizeAction(
          step.action.name,
          step.action.params,
          step.thought,
          step.action.type
        );
      }
    }
  }
  return summary;
}

export function mapToolType(toolName: string): NonNullable<StandardizedStep['action']>['type'] {
  const name = toolName.toLowerCase();
  if (name.includes('todo')) {
    return 'other';
  }
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

export function truncateMessage(msg: any, maxLen = 300): string {
  if (!msg) return '';
  const str = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + '... [truncated]';
  }
  return str;
}

export function writeTrajectorySummary(targetDir: string, summary: TrajectorySummary): void {
  fs.writeFileSync(path.join(targetDir, TRAJECTORY_SUMMARY_FILE), JSON.stringify(summary, null, 2), 'utf8');
}

export function readTrajectorySummary(targetDir: string): TrajectorySummary | null {
  const summaryPath = path.join(targetDir, TRAJECTORY_SUMMARY_FILE);
  if (!fs.existsSync(summaryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

export async function generateNormalizedTrajectory(targetDir: string, agentName: string, initialPrompt?: string): Promise<void> {
  try {
    let summary: TrajectorySummary | null = null;

    if (agentName === Agents.JETSKI || agentName === Agents.JETSKI_CLI) {
      summary = await parseJetskiTrajectory(targetDir);
    } else {
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
          let key = file.replace(/\.jsonl?$/, '');
          const agentMatch = key.match(/(?:^|[-_])agent[-_]([a-zA-Z0-9_-]+)$/);
          if (agentMatch) {
            key = agentMatch[1];
          } else {
            key = key.replace(/^(?:subagent-|session-)/, '');
          }
          subagentsMap[key] = Array.isArray(logData) ? logData : ((logData as any)?.messages || []);
        } catch (e) {
          console.warn(`[TrajectoryParser] Failed to parse subagent file ${file}:`, e);
        }
      }

      const allMainEntries: any[] = [];
      for (const file of mainSessionFiles) {
        const filePath = path.join(targetDir, file);
        try {
          const logData = file.endsWith('.jsonl') ? parseJsonlFile(filePath) : JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(logData)) {
            allMainEntries.push(...logData);
          } else if (logData && Array.isArray((logData as any).messages)) {
            allMainEntries.push(...(logData as any).messages);
          } else if (logData) {
            allMainEntries.push(logData);
          }
        } catch (e) {
          console.warn(`[TrajectoryParser] Failed to parse main session file ${file}:`, e);
        }
      }

      if (allMainEntries.length > 0 || Object.keys(subagentsMap).length > 0) {
        if (agentName === Agents.CLAUDE_CODE) {
          summary = parseClaudeTrajectory(allMainEntries, subagentsMap);
        } else if (agentName === Agents.GEMINI_CLI) {
          summary = parseGeminiTrajectory(allMainEntries, subagentsMap);
        } else if (agentName === Agents.CODEX_CLI) {
          summary = parseCodexTrajectory(allMainEntries, subagentsMap);
        } else if (agentName === Agents.PI) {
          summary = parsePiTrajectory(allMainEntries, subagentsMap);
        }
      }
    }

    if (summary) {
      summary.initialPrompt = initialPrompt;
      finalizeTrajectorySummary(summary);
      writeTrajectorySummary(targetDir, summary);
    }
  } catch (err) {
    console.error(`[TrajectoryParser] Failed to generate normalized trajectory for ${agentName}:`, err);
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}
