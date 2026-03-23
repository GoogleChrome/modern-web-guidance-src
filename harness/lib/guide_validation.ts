import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents } from '../config.ts';
import { collectGeminiCliGuides } from '../agents/gemini-cli-agent.ts';
import { collectClaudeCodeGuides } from '../agents/claude-code-agent.ts';
import { collectJetskiGuides } from '../agents/jetski-agent.ts';

export async function collectGuidesUsed(dirPath: string, enableSkills: boolean, agent: string): Promise<string[]> {
  if (enableSkills) { // Skills path
    if (agent === Agents.GEMINI_CLI) {
      return collectGeminiCliGuides(dirPath);
    } else if (agent === Agents.JETSKI) {
      return collectJetskiGuides(dirPath);
    } else if (agent === Agents.CLAUDE_CODE) {
      return collectClaudeCodeGuides(dirPath);
    } else {
      console.warn(`Unknown agent ${agent} for skills collection`);
      return [];
    }
  } else { // MCP path
    const logPath = path.join(dirPath, MODERN_WEB_LOG_FILE);
    let guidesFromLog: string[] = [];

    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8').trim();
      let toolCalls: any[] = [];

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

      guidesFromLog = toolCalls
        .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
        .flatMap(call => call.result.map((r: any) => r.id || ''))
        .filter(Boolean);
    }

    return [...new Set(guidesFromLog)];
  }
}

