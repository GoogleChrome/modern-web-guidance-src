import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';
import { collectGeminiGuidesFromTrajectory, collectGeminiToolsFromTrajectory } from '../agents/gemini-cli-agent.ts';
import type { GuidedUsage } from '../agents/gemini-cli-agent.ts';
import { collectClaudeGuidesFromTrajectory, collectClaudeToolsFromTrajectory } from '../agents/claude-code-agent.ts';
import { collectCodexGuidesFromTrajectory, collectCodexToolsFromTrajectory } from '../agents/codex-cli-agent.ts';

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string): Promise<GuidedUsage> {
  // For GEMINI_CLI, ALWAYS collect guide usage from trajectory files if present
  if (agent === Agents.GEMINI_CLI) {
    return collectGeminiGuidesFromTrajectory(dirPath, serving);
  }

  // For MCP and Jetski runs, collect guide usage from modern-web log if present
  // Jetski impl does not support trajectory pb parsing, so we rely on modern-web log (will not be present in Skills runs)
  if (serving === Serving.MCP || agent === Agents.JETSKI || agent === Agents.JETSKI_CLI) {
    const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);

    if (!fs.existsSync(logPath)) {
      return { retrievedGuides: ['unknown'], fileReadGuides: ['unknown'] };
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
      fileReadGuides: ['unknown']
    };
  }

  // For SKILLS and SKILLS_CLI approaches, collect guide usage from trajectory files
  if (agent === Agents.CLAUDE_CODE) {
    return collectClaudeGuidesFromTrajectory(dirPath, serving);
  } else if (agent === Agents.CODEX_CLI) {
    const guides = await collectCodexGuidesFromTrajectory(dirPath, serving);
    return {
      retrievedGuides: guides,
      fileReadGuides: ['unknown']
    };
  }
  
  console.warn(`Unknown agent ${agent} for skills collection`);
  return { retrievedGuides: ['unknown'], fileReadGuides: ['unknown'] };
}

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string): Promise<string[]> {
  
  // For GEMINI_CLI, ALWAYS collect tool usage from trajectory files if present
  if (agent === Agents.GEMINI_CLI) {
    return collectGeminiToolsFromTrajectory(dir);
  }

  // For MCP and JETSKI runs, collect tool usage from modern-web log presence
  // JETSKI impl does not support trajectory pb parsing, so we rely on modern-web log (will not be present in SKILLS runs)
  if (serving === Serving.MCP || agent === Agents.JETSKI || agent === Agents.JETSKI_CLI) {
    if (fs.existsSync(path.join(dir, MODERN_WEB_LOG_FILE))) {
      return ['modern-web'];
    }
    return [];
  }

  // For SKILLS and SKILLS_CLI approaches, collect tool usage from trajectory files
  if (agent === Agents.CLAUDE_CODE) {
    return collectClaudeToolsFromTrajectory(dir);
  } else if (agent === Agents.CODEX_CLI) {
    return collectCodexToolsFromTrajectory(dir);
  }

  console.warn(`Unknown agent ${agent} for guidance tools collection`);
  return [];
}
