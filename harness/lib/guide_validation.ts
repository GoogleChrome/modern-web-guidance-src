import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function guideUsed(dirPath: string, taskName: string): Promise<boolean> {
  const logPath = path.join(dirPath, 'mcp_tool_calls.log');
  
  if (!fs.existsSync(logPath)) {
    return false;
  }

  const logContent = fs.readFileSync(logPath, 'utf8').trim();
  let toolCalls: any[] = [];

  if (logContent) {
    try {
      const jsonString = '[' + logContent.replace(/}\s*\{/g, '},{') + ']';
      toolCalls = JSON.parse(jsonString);
    } catch (e) {
      console.error(`Failed to parse ${logPath}:`, e);
    }
  }

  const taskPath = path.resolve(__dirname, `../tasks/${taskName}.md`);
  if (!fs.existsSync(taskPath)) {
    console.error(`Task ${taskName} not found at ${taskPath}`);
    return false;
  }

  const fileContent = fs.readFileSync(taskPath, 'utf8');
  const frontmatterMatch = fileContent.match(/^---\n(?:[\s\S]*?)grader:\s*(.+)\n(?:[\s\S]*?)---\n([\s\S]*)$/m);

  if (!frontmatterMatch) {
    console.error(`No 'grader:' found in frontmatter for task ${taskName}`);
    return false;
  }

  const guide = frontmatterMatch[1].trim();

  // Extract all use case IDs requested via get_best_practices
  const requestedGuides = toolCalls
    .filter(call => call.tool === 'get_best_practices' && Array.isArray(call.result))
    .flatMap(call => call.result.map((r: any) => r.id || ''))
    .filter(Boolean);

  return requestedGuides.some(id => id === guide);
}
