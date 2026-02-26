import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function guideUsed(dirPath: string, appName: string): Promise<boolean> {
  const resourcesPath = path.join(dirPath, 'resources_used.json');
  
  if (!fs.existsSync(resourcesPath)) {
    return false;
  }

  let resources: { name?: string }[];
  try {
    resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
  } catch {
    return false;
  }

  const taskPath = path.resolve(__dirname, `../tasks/${appName}.md`);
  if (!fs.existsSync(taskPath)) {
    console.error(`Task ${appName} not found at ${taskPath}`);
    return false;
  }

  const fileContent = fs.readFileSync(taskPath, 'utf8');
  const frontmatterMatch = fileContent.match(/^---\n(?:[\s\S]*?)grader:\s*(.+)\n(?:[\s\S]*?)---\n([\s\S]*)$/m);

  if (!frontmatterMatch) {
    console.error(`No 'grader:' found in frontmatter for task ${appName}`);
    return false;
  }

  const guide = frontmatterMatch[1].trim();

  // Extract all resource names for easier searching
  const resourceNames = resources.map(r => r.name || '').filter(Boolean);

  const found = resourceNames.some(name => name.includes(guide));
  const isOnlyOne = resourceNames.length === 1;

  return found && isOnlyOne;
}
