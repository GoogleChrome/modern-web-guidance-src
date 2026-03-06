import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCP_LOG_FILE } from '../../constants.ts';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function guideUsed(dirPath: string, taskName: string): Promise<boolean> {
  const logPath = path.join(dirPath, MCP_LOG_FILE);
  
  if (!fs.existsSync(logPath)) {
    return false;
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

  const taskPath = path.resolve(__dirname, `../tasks/${taskName}.md`);
  if (!fs.existsSync(taskPath)) {
    console.error(`Task ${taskName} not found at ${taskPath}`);
    return false;
  }

  const fileContent = fs.readFileSync(taskPath, 'utf8');
  const { data } = matter(fileContent);

  if (!data || !data.grader) {
    console.error(`No 'grader:' found in frontmatter for task ${taskName}`);
    return false;
  }

  const guide = data.grader.trim();

  // Extract all use case IDs requested via get_best_practices
  const requestedGuides = toolCalls
    .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
    .flatMap(call => call.result.map((r: any) => r.id || ''))
    .filter(Boolean);

  return requestedGuides.some(id => id === guide);
}
