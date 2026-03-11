import fs from 'fs';
import path from 'path';
import { MCP_LOG_FILE } from '../../constants.ts';

export async function collectGuidesUsed(dirPath: string): Promise<string[]> {
  const logPath = path.join(dirPath, MCP_LOG_FILE);

  if (!fs.existsSync(logPath)) {
    return [];
  }

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

  // Extract all use case IDs requested via get_best_practices
  const requestedGuides = toolCalls
    .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
    .flatMap(call => call.result.map((r: any) => r.id || ''))
    .filter(Boolean);

  const uniqueGuides = [...new Set(requestedGuides)];

  return uniqueGuides;
}
