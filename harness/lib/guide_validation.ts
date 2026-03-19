import fs from 'fs';
import path from 'path';
import { MCP_LOG_FILE } from '../../constants.ts';

export async function collectGuidesUsed(dirPath: string, enableSkills: boolean): Promise<string[]> {
  if (enableSkills) {
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
                if (tc.name === 'read_file' && tc.args && tc.args.file_path) {
                  const filePath = tc.args.file_path;
                  if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                    const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
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
  } else {
    const logPath = path.join(dirPath, MCP_LOG_FILE);
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
