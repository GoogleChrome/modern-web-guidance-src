import fs from 'fs';
import path from 'path';
import { parseJsonlFile, isEnoent } from './agent-shared.ts';
import { Agents } from '../config.ts';

import {
  parseClaudeTrajectory,
  extractClaudeMetadata,
  collectClaudeGuidesFromTrajectory,
  extractClaudeCodeModel,
  extractClaudeCodeTokenUsage,
  collectClaudeToolsFromTrajectory
} from '../agents/claude-code-agent.ts';

import {
  parseGeminiTrajectory,
  extractGeminiMetadata,
  collectGeminiGuidesFromTrajectory,
  extractGeminiCliModel,
  extractGeminiCliTokenUsage,
  collectGeminiToolsFromTrajectory
} from '../agents/gemini-cli-agent.ts';

import {
  parseCodexTrajectory,
  extractCodexMetadata,
  collectCodexGuidesFromTrajectory,
  extractCodexCliModel,
  extractCodexCliTokenUsage,
  collectCodexToolsFromTrajectory
} from '../agents/codex-cli-agent.ts';

import {
  parseJetskiTrajectory,
  parseJetskiCliSession,
  collectJetskiCliGuidesFromTrajectory,
  extractJetskiCliModel,
  extractJetskiCliTokenUsage,
  collectJetskiCliToolsFromTrajectory
} from '../agents/jetski-cli-agent.ts';

import {
  parsePiTrajectory,
  extractPiMetadata,
  collectPiGuidesFromTrajectory,
  extractPiModel,
  extractPiTokenUsage,
  collectPiToolsFromTrajectory
} from '../agents/pi-agent.ts';

export {
  parseClaudeTrajectory,
  extractClaudeMetadata,
  collectClaudeGuidesFromTrajectory,
  extractClaudeCodeModel,
  extractClaudeCodeTokenUsage,
  collectClaudeToolsFromTrajectory,
  parseGeminiTrajectory,
  extractGeminiMetadata,
  collectGeminiGuidesFromTrajectory,
  extractGeminiCliModel,
  extractGeminiCliTokenUsage,
  collectGeminiToolsFromTrajectory,
  parseCodexTrajectory,
  extractCodexMetadata,
  collectCodexGuidesFromTrajectory,
  extractCodexCliModel,
  extractCodexCliTokenUsage,
  collectCodexToolsFromTrajectory,
  parseJetskiTrajectory,
  parseJetskiCliSession,
  collectJetskiCliGuidesFromTrajectory,
  extractJetskiCliModel,
  extractJetskiCliTokenUsage,
  collectJetskiCliToolsFromTrajectory,
  parsePiTrajectory,
  extractPiMetadata,
  collectPiGuidesFromTrajectory,
  extractPiModel,
  extractPiTokenUsage,
  collectPiToolsFromTrajectory
};

export function getSessionFiles(dir: string, globPattern: string): string[] {
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
    type: 'web_search' | 'read_file' | 'write_file' | 'run_command' | 'other';
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

  if (
    actionName.includes('write') || actionName.includes('replace') || actionName.includes('edit') || actionName.includes('touch') ||
    actionParamsStr.includes('write_to_file') || actionParamsStr.includes('replace_file_content') ||
    actionParamsStr.includes('index.html') || actionParamsStr.includes('app.jsx') || actionParamsStr.includes('style.css')
  ) {
    return 'code_mutation';
  }

  if (actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
    return 'guide_retrieval';
  }

  if (actionName.includes('search') || actionName.includes('get_best_practices') || actionName.includes('query_guidance') || actionParamsStr.includes('search')) {
    return 'skill_search';
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
export function mapToolType(toolName: string): NonNullable<StandardizedStep['action']>['type'] {
  const name = toolName.toLowerCase();
  if (['read', 'read_file', 'view_file', 'view'].some(k => name.includes(k))) {
    return 'read_file';
  }
  if (['write', 'write_file', 'replace', 'str_replace_editor', 'edit', 'edit_file', 'save'].some(k => name.includes(k))) {
    return 'write_file';
  }
  if (['bash', 'execute_bash', 'run_command', 'run_shell_command', 'terminal', 'shell', 'exec_command', 'exec'].some(k => name.includes(k))) {
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
export function truncateMessage(msg: any, maxLen = 300): string {
  if (!msg) return '';
  const str = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + '... [truncated]';
  }
  return str;
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
        const key = stripped.replace(/^(?:subagent-|session-)+(?:subagents-)*(?:agent[-_])?/, '');
        subagentsMap[key] = Array.isArray(logData) ? logData : ((logData as any)?.messages || []);
      } catch (e) {
        console.warn(`[TrajectoryParser] Failed to parse subagent file ${file}:`, e);
      }
    }

    if (agentName === Agents.JETSKI || agentName === Agents.JETSKI_CLI) {
      summary = await parseJetskiTrajectory(targetDir);
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
        summary = parseCodexTrajectory(logData, subagentsMap);
      }
    }

    if (summary) {
      finalizeTrajectorySummary(summary);

      if (initialPrompt) {
        summary.initialPrompt = initialPrompt;
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

