import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';
import type { GuideUsage } from './agent-shared.ts';
import {
  collectGeminiGuidesFromTrajectory,
  collectGeminiToolsFromTrajectory,
  collectJetskiCliGuidesFromTrajectory,
  collectJetskiCliToolsFromTrajectory,
  collectClaudeGuidesFromTrajectory,
  collectClaudeToolsFromTrajectory,
  collectCodexGuidesFromTrajectory,
  collectCodexToolsFromTrajectory,
  collectPiGuidesFromTrajectory,
  collectPiToolsFromTrajectory
} from './trajectory-parser.ts';

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function isEnoent(err: unknown): boolean {
  return isNodeError(err) && err.code === 'ENOENT';
}

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string): Promise<GuideUsage> {
  const summaryPath = path.join(dirPath, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (Array.isArray(summary.retrievedGuides) || Array.isArray(summary.fileReadGuides)) {
      return {
        retrievedGuides: summary.retrievedGuides || [],
        fileReadGuides: summary.fileReadGuides || []
      };
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }

  // Legacy Fallback (when summary is missing or old format)
  if (serving === Serving.MCP || agent === Agents.JETSKI) {
    const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
    let logContent = '';
    try {
      logContent = fs.readFileSync(logPath, 'utf8').trim();
    } catch (err) {
      if (isEnoent(err)) {
        return { retrievedGuides: [], fileReadGuides: [] };
      }
      throw err;
    }

    const toolCalls: any[] = [];
    if (logContent) {
      const lines = logContent.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            toolCalls.push(JSON.parse(line));
          } catch (e) {
            console.error(`Failed to parse line in ${logPath}:`, e);
          }
        }
      }
    }

    const guidesFromLog = toolCalls
      .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
      .flatMap(call => call.result.map((r: any) => r.id || ''))
      .filter(Boolean);

    return {
      retrievedGuides: [...new Set(guidesFromLog)],
      fileReadGuides: []
    };
  }

  if (agent === Agents.GEMINI_CLI) {
    return collectGeminiGuidesFromTrajectory(dirPath, serving);
  }

  if (agent === Agents.JETSKI_CLI) {
    return collectJetskiCliGuidesFromTrajectory(dirPath, serving);
  }

  if (agent === Agents.CLAUDE_CODE) {
    return collectClaudeGuidesFromTrajectory(dirPath, serving);
  } else if (agent === Agents.CODEX_CLI) {
    return collectCodexGuidesFromTrajectory(dirPath, serving);
  } else if (agent === Agents.PI) {
    return collectPiGuidesFromTrajectory(dirPath, serving);
  }

  console.warn(`Unknown agent ${agent} for skills collection`);
  return { retrievedGuides: [], fileReadGuides: [] };
}

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string): Promise<string[]> {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (Array.isArray(summary.toolsUsed)) {
      return summary.toolsUsed;
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }

  // Legacy Fallback
  if (serving === Serving.MCP || agent === Agents.JETSKI) {
    try {
      fs.accessSync(path.join(dir, MODERN_WEB_LOG_FILE));
      return ['modern-web-guidance'];
    } catch {
      return [];
    }
  }

  if (agent === Agents.GEMINI_CLI) {
    return collectGeminiToolsFromTrajectory(dir);
  }

  if (agent === Agents.JETSKI_CLI) {
    return collectJetskiCliToolsFromTrajectory(dir);
  }

  if (agent === Agents.CLAUDE_CODE) {
    return collectClaudeToolsFromTrajectory(dir);
  }

  if (agent === Agents.CODEX_CLI) {
    return collectCodexToolsFromTrajectory(dir);
  } else if (agent === Agents.PI) {
    return collectPiToolsFromTrajectory(dir);
  }

  console.warn(`Unknown agent ${agent} for guidance tools collection`);
  return [];
}
