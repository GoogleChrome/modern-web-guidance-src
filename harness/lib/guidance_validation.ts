import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';
import { collectGeminiCliGuides, collectGeminiCliGuidanceToolsUsed } from '../agents/gemini-cli-agent.ts';
import { collectClaudeCodeGuides, collectClaudeCodeGuidanceToolsUsed } from '../agents/claude-code-agent.ts';
import { collectCodexCliGuides, collectCodexCliGuidanceToolsUsed } from '../agents/codex-cli-agent.ts';

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string): Promise<string[]> {
  if (serving === Serving.MCP || agent === Agents.JETSKI) { // Jetski impl does not support trajectory pb parsing
    const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);

    if (!fs.existsSync(logPath)) {
      return [];
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

    return [...new Set(guidesFromLog)];
  } else {
    if (agent === Agents.GEMINI_CLI) {
      return collectGeminiCliGuides(dirPath, serving);
    } else if (agent === Agents.CLAUDE_CODE) {
      return collectClaudeCodeGuides(dirPath, serving);
    } else if (agent === Agents.CODEX_CLI) {
      return collectCodexCliGuides(dirPath, serving);
    }
    console.warn(`Unknown agent ${agent} for skills collection`);
    return [];
  }
}

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string): Promise<string[]> {
  if (serving === Serving.MCP || agent === Agents.JETSKI) { // Jetski impl does not support trajectory pb parsing
    if (fs.existsSync(path.join(dir, MODERN_WEB_LOG_FILE))) {
      return ['modern-web'];
    }
    return [];
  }

  if (agent === Agents.GEMINI_CLI) {
    return collectGeminiCliGuidanceToolsUsed(dir);
  } else if (agent === Agents.CLAUDE_CODE) {
    return collectClaudeCodeGuidanceToolsUsed(dir);
  } else if (agent === Agents.CODEX_CLI) {
    return collectCodexCliGuidanceToolsUsed(dir);
  }

  console.warn(`Unknown agent ${agent} for guidance tools collection`);
  return [];
}
