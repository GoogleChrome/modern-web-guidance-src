import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';
import type { GuidedUsage } from './agent-shared.ts';
import { collectGeminiGuidesFromTrajectory, collectGeminiToolsFromTrajectory } from '../agents/gemini-cli-agent.ts';
import { collectJetskiCliGuidesFromTrajectory, collectJetskiCliToolsFromTrajectory } from '../agents/jetski-cli-agent.ts';
import { collectClaudeGuidesFromTrajectory, collectClaudeToolsFromTrajectory } from '../agents/claude-code-agent.ts';
import { collectCodexGuidesFromTrajectory, collectCodexToolsFromTrajectory } from '../agents/codex-cli-agent.ts';

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string): Promise<GuidedUsage> {
  if (serving === Serving.MCP || agent === Agents.JETSKI) {
    const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
    if (!fs.existsSync(logPath)) {
      return { retrievedGuides: [], fileReadGuides: [] };
    }

    const logContent = fs.readFileSync(logPath, 'utf8').trim();
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
  }

  if (agent === Agents.CODEX_CLI) {
    return collectCodexGuidesFromTrajectory(dirPath, serving);
  }

  console.warn(`Unknown agent ${agent} for skills collection`);
  return { retrievedGuides: [], fileReadGuides: [] };
}

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string): Promise<string[]> {
  if (serving === Serving.MCP || agent === Agents.JETSKI) {
    if (fs.existsSync(path.join(dir, MODERN_WEB_LOG_FILE))) {
      return ['modern-web-guidance'];
    }
    return [];
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
  }

  console.warn(`Unknown agent ${agent} for guidance tools collection`);
  return [];
}
