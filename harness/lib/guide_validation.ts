import fs from 'fs';
import path from 'path';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { Agents } from '../config.ts';

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

async function collectGeminiCliGuides(dirPath: string): Promise<string[]> {
  const guidesFromSkills: string[] = [];
  try {
    const files = fs.readdirSync(dirPath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(sessionContent);

      if (session.messages) {
        for (const msg of session.messages) {
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              if (tc.name === 'read_file' && tc.args && tc.args.file_path) { // megaskill path
                const filePath = tc.args.file_path;
                if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                  const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              } else if (tc.name === 'run_shell_command' && tc.args && tc.args.command) { // skill + cli path
                const command = tc.args.command;
                if (command.includes('serving/scripts/retrieve.ts')) {
                  const match = command.match(/retrieve\.ts\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error reading session files in ${dirPath}:`, e);
  }
  return [...new Set(guidesFromSkills)];
}

async function collectJetskiGuides(dirPath: string): Promise<string[]> {
  // TODO: Implement skills guide collection for Jetski
  console.log(`Jetski skills collection for ${dirPath} still needs to be populated.`);
  return [];
}

async function collectClaudeCodeGuides(dirPath: string): Promise<string[]> {
  const guidesFromSkills: string[] = [];
  try {
    const files = fs.readdirSync(dirPath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.jsonl'));

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      const lines = sessionContent.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message && obj.message.content) {
            for (const contentItem of obj.message.content) {
              if (contentItem.type === 'tool_use' && contentItem.name === 'Bash' && contentItem.input && contentItem.input.command) { // skill + cli path
                const command = contentItem.input.command;
                if (command.includes('serving/scripts/retrieve.ts')) {
                  const match = command.match(/retrieve\.ts\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              } else if (contentItem.type === 'tool_use' && contentItem.name === 'Read' && contentItem.input && contentItem.input.file_path) { // megaskill path
                const filePath = contentItem.input.file_path;
                if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                  const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                  if (match) {
                    guidesFromSkills.push(match[1]);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Failed to parse jsonl line in ${sessionPath}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`Error reading session files in ${dirPath}:`, e);
  }
  return [...new Set(guidesFromSkills)];
}
