import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents, Serving } from '../config.ts';
import { collectGeminiCliGuides } from '../agents/gemini-cli-agent.ts';
import { collectClaudeCodeGuides } from '../agents/claude-code-agent.ts';
import { collectJetskiGuides } from '../agents/jetski-agent.ts';
import { collectCodexCliGuides } from '../agents/codex-cli-agent.ts';

export async function collectGuidesUsed(dirPath: string, serving: Serving, agent: string): Promise<string[]> {
  if (serving === Serving.SKILLS_CLI || serving === Serving.SKILLS) { // Skills path
    if (agent === Agents.GEMINI_CLI) {
      return collectGeminiCliGuides(dirPath, serving);
    } else if (agent === Agents.JETSKI) {
      return collectJetskiGuides(dirPath, serving);
    } else if (agent === Agents.CLAUDE_CODE) {
      return collectClaudeCodeGuides(dirPath, serving);
    } else if (agent === Agents.CODEX_CLI) {
      return collectCodexCliGuides(dirPath, serving);
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

export async function collectGuidanceToolsUsed(dir: string, serving: Serving, agent: string): Promise<string[]> {
  const toolsUsed: string[] = [];
  
  if (serving === Serving.MCP) {
    if (fs.existsSync(path.join(dir, MODERN_WEB_LOG_FILE))) {
      toolsUsed.push('modern-web');
    }
    return toolsUsed;
  }

  const sessionFiles = glob.sync('session-*.{json,jsonl}', { cwd: dir, absolute: true });
  const firstSession = sessionFiles[0];
  if (!firstSession) return toolsUsed;

  try {
    const isJsonl = firstSession.endsWith('.jsonl');
    const content = fs.readFileSync(firstSession, 'utf8');

    if (isJsonl) {
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (agent === Agents.CLAUDE_CODE) {
            if (obj.message && Array.isArray(obj.message.content)) {
              for (const item of obj.message.content) {
                if (item.type === 'tool_use' && item.name === 'Skill' && item.input?.skill) {
                  toolsUsed.push(item.input.skill);
                }
              }
            }
          } else if (agent === Agents.CODEX_CLI) {
            let functionCall = null;
            if (obj.type === 'function_call') {
              functionCall = obj;
            } else if (obj.type === 'response_item' && obj.payload && obj.payload.type === 'function_call') {
              functionCall = obj.payload;
            }

            if (functionCall && functionCall.name === 'exec_command' && functionCall.arguments) {
              const args = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
              const command = args.cmd || '';
              if (command.includes('/skills/') && command.includes('SKILL.md')) {
                const match = command.match(/\.agents\/skills\/([^/]+)\/SKILL\.md/);
                if (match) {
                  toolsUsed.push(match[1]);
                }
              }
            }
          }
        } catch (e) {
          console.error(`Failed to parse jsonl line in ${firstSession}:`, e);
        }
      }
    } else { // Gemini CLI
      const session = JSON.parse(content);
      if (Array.isArray(session.messages)) {
        for (const msg of session.messages) {
          if (Array.isArray(msg.toolCalls)) {
            for (const tc of msg.toolCalls) {
              if (tc.name === 'activate_skill' && tc.args?.name) {
                toolsUsed.push(tc.args.name);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Failed to collect guidance tools used in ${firstSession}:`, e);
  }

  return Array.from(new Set(toolsUsed));
}

