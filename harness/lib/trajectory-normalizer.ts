import fs from 'fs';
import path from 'path';
import { parseJsonlFile } from './agent-shared.ts';
import { Agents } from '../config.ts';

// Colocated agent parsers
import { parseClaudeTrajectory } from '../agents/claude-code-agent.ts';
import { parseGeminiTrajectory } from '../agents/gemini-cli-agent.ts';
import { parseCodexTrajectory } from '../agents/codex-cli-agent.ts';
import { parseJetskiTrajectory, parseJetskiCliSession } from '../agents/jetski-cli-agent.ts';
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
  findProtoTimestamp,
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
export const NORMALIZER_VERSION = 2;

const TRAJECTORY_GLOB = 'session-*.{json,jsonl}';

export function getSessionFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.globSync(TRAJECTORY_GLOB, { cwd: dir });
}

export function hasRawSessionLogs(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    const files = fs.readdirSync(dir);
    return files.some(
      (f) =>
        (f.endsWith('.db') && !f.endsWith('-shm') && !f.endsWith('-wal')) ||
        ((f.startsWith('session-') || f.startsWith('subagent-')) &&
          (f.endsWith('.json') || f.endsWith('.jsonl'))) ||
        f === 'trajectory.jsonl'
    );
  } catch {
    return false;
  }
}

export type CanonicalCategory =
  | 'guide_retrieval'
  | 'skill_search'
  | 'skill_activation'
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
  | OtherAction;

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
  normalizerVersion?: number;
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

  if (actionName === 'skill' || actionName === 'activate_skill' || actionName === 'load_skill') {
    return 'skill_activation';
  }

  if (actionType !== 'run_command') {
    const mutationParamKeys = ['targetfile', 'replacementcontent', 'replacementchunks', 'codecontent', 'write_to_file', 'replace_file_content', 'new_string', 'newtext'];
    const paramKeys = params && typeof params === 'object' ? Object.keys(params).map(k => k.toLowerCase()) : [];
    const hasMutationParam = paramKeys.some(k => mutationParamKeys.includes(k));
    if (hasMutationParam) {
      return 'code_mutation';
    }
  }

  const cmd = typeof params?.command === 'string' ? params.command : (typeof params?.cmd === 'string' ? params.cmd : '');
  const cmdLower = cmd.toLowerCase();

  // Only a literal `modern-web-guidance` invocation counts. Bare `search`/`retrieve`/`gd` match
  // unrelated tools (code_search, git cat-file, ripgrep) and produced false positives.
  if (cmdLower.includes('modern-web-guidance')) {
    if (cmdLower.includes('retrieve')) {
      return 'guide_retrieval';
    }
    if (cmdLower.includes('search')) {
      return 'skill_search';
    }
  }

  if ((thought || '').toLowerCase().includes('mandatory')) {
    return 'mandatory_rule_thought';
  }

  return 'incidental_noise';
}

export function finalizeTrajectorySummary(summary: TrajectorySummary): TrajectorySummary {
  summary.normalizerVersion = NORMALIZER_VERSION;
  if (Array.isArray(summary.steps)) {
    summary.steps.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeA - timeB;
        }
      }
      return (a.stepNumber || 0) - (b.stepNumber || 0);
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

function normalizeAgentName(rawAgent: string | undefined): string | undefined {
  if (!rawAgent) return undefined;
  const normalized = String(rawAgent).trim().toLowerCase().replace(/-/g, '_');
  const match = Object.values(Agents).find((a) => a === normalized || a === rawAgent);
  return match || normalized;
}

export function detectAgentForRun(runDir: string, existingSummary?: TrajectorySummary | null): string | undefined {
  // 1. Check suite evals.json in parent directories
  let curr = path.resolve(runDir);
  while (curr && curr !== path.dirname(curr)) {
    const evalsPath = path.join(curr, 'evals.json');
    if (fs.existsSync(evalsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
        if (data.agent) {
          return normalizeAgentName(String(data.agent));
        }
      } catch {
        // ignore invalid json
      }
    }
    curr = path.dirname(curr);
  }

  // 2. Check existing summary.agent field
  if (existingSummary?.agent) {
    return normalizeAgentName(existingSummary.agent);
  }

  // 3. Check directory path tokens (e.g. -claude_code, -codex_cli, -jetski_cli, -gemini_cli)
  const dirLower = runDir.toLowerCase().replace(/-/g, '_');
  if (dirLower.includes('claude_code')) return Agents.CLAUDE_CODE;
  if (dirLower.includes('codex_cli')) return Agents.CODEX_CLI;
  if (dirLower.includes('jetski_cli') || dirLower.includes('jetski')) return Agents.JETSKI_CLI;
  if (dirLower.includes('gemini_cli')) return Agents.GEMINI_CLI;
  if (/(?:^|[/\\_])pi(?:$|[/\\_])/.test(dirLower)) return Agents.PI;

  // 4. Inspect raw files as final fallback
  try {
    const files = fs.readdirSync(runDir);
    if (files.some((f) => f.endsWith('.db') && !f.endsWith('-shm') && !f.endsWith('-wal'))) {
      return Agents.JETSKI_CLI;
    }
  } catch {
    // ignore
  }

  return undefined;
}

export function generateNormalizedTrajectorySync(
  targetDir: string,
  agentName: string,
  initialPrompt?: string
): TrajectorySummary | null {
  try {
    let summary: TrajectorySummary | null = null;
    const normalizedAgent = normalizeAgentName(agentName) || agentName;

    if (normalizedAgent === Agents.JETSKI_CLI) {
      summary = finalizeTrajectorySummary(parseJetskiCliSession(targetDir));
    } else {
      let allFiles: string[] = [];
      try {
        allFiles = fs.readdirSync(targetDir);
      } catch (err) {
        if (!isEnoent(err)) throw err;
      }

      const mainSessionFiles = allFiles
        .filter(
          (f) =>
            (f.startsWith('session-') && !f.includes('-subagents-') && (f.endsWith('.json') || f.endsWith('.jsonl'))) ||
            f === 'trajectory.jsonl'
        )
        .sort((a, b) => a.localeCompare(b));

      const subagentFiles = allFiles
        .filter((f) => (f.startsWith('subagent-') || f.includes('-subagents-')) && (f.endsWith('.json') || f.endsWith('.jsonl')))
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
        if (normalizedAgent === Agents.CLAUDE_CODE) {
          summary = parseClaudeTrajectory(allMainEntries, subagentsMap);
        } else if (normalizedAgent === Agents.GEMINI_CLI) {
          summary = parseGeminiTrajectory(allMainEntries, subagentsMap);
        } else if (normalizedAgent === Agents.CODEX_CLI) {
          summary = parseCodexTrajectory(allMainEntries, subagentsMap);
        } else if (normalizedAgent === Agents.PI) {
          summary = parsePiTrajectory(allMainEntries, subagentsMap);
        }
      }
    }

    if (summary) {
      if (initialPrompt !== undefined) {
        summary.initialPrompt = initialPrompt;
      }
      finalizeTrajectorySummary(summary);
      writeTrajectorySummary(targetDir, summary);
      return summary;
    }
  } catch (err) {
    console.error(`[TrajectoryParser] Failed to generate normalized trajectory for ${agentName}:`, err);
  }
  return null;
}

export async function generateNormalizedTrajectory(targetDir: string, agentName: string, initialPrompt?: string): Promise<void> {
  generateNormalizedTrajectorySync(targetDir, agentName, initialPrompt);
}

export function ensureFreshTrajectorySummarySync(runDir: string): TrajectorySummary | null {
  const existing = readTrajectorySummary(runDir);
  const isFresh =
    existing !== null &&
    Array.isArray(existing.steps) &&
    existing.steps.length > 0 &&
    existing.normalizerVersion === NORMALIZER_VERSION;

  if (isFresh) {
    return existing;
  }

  if (hasRawSessionLogs(runDir)) {
    const detectedAgent = detectAgentForRun(runDir, existing);
    if (detectedAgent) {
      const regenerated = generateNormalizedTrajectorySync(runDir, detectedAgent, existing?.initialPrompt);
      if (regenerated) {
        return regenerated;
      }
    }
  }

  return existing;
}

export async function ensureFreshTrajectorySummary(runDir: string): Promise<TrajectorySummary | null> {
  return ensureFreshTrajectorySummarySync(runDir);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}
