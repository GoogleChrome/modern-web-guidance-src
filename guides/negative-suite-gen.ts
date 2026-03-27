import fs from 'fs';
import path from 'path';

import { baseAppsDir, tasksDir } from '../lib/paths.ts';

import { scanAllGuides, classifyGuide } from '../harness/lib/utils.ts';

const negativeTasksDir = path.join(tasksDir, 'negative');
function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

export async function generateNegativeSuite() {
  console.log('Scanning guides...');
  const allGuides = scanAllGuides();

  const evalReadyGuides = allGuides.filter(inv => classifyGuide(inv) === 'eval-ready');

  if (evalReadyGuides.length === 0) {
    console.log('No eval-ready guides found.');
    return;
  }

  console.log(`Found ${evalReadyGuides.length} eval-ready guides.`);

  // Create tasks/negative directory if it doesn't exist
  if (!fs.existsSync(negativeTasksDir)) {
    fs.mkdirSync(negativeTasksDir, { recursive: true });
  }

  for (const inv of evalReadyGuides) {
    console.log(`\nProcessing ${inv.name}...`);

    const negativeDemoPath = path.join(inv.dir, 'negative-demo.html');
    if (!fs.existsSync(negativeDemoPath)) {
      console.warn(`  ⚠️  Missing negative-demo.html for ${inv.name}, skipping.`);
      continue;
    }

    // 1. Create base apps (with symlink to negative-demo.html)
    const baseAppDir = path.join(baseAppsDir, 'negative', `${inv.name}`);
    if (!fs.existsSync(baseAppDir)) {
      fs.mkdirSync(baseAppDir, { recursive: true });
    }

    const destIndexHtml = path.join(baseAppDir, 'index.html');

    // Remove any existing file/symlink
    try {
      if (fs.existsSync(destIndexHtml) || fs.lstatSync(destIndexHtml).isSymbolicLink()) {
        fs.unlinkSync(destIndexHtml);
      }
    } catch {
      // Ignore if it doesn't exist
    }

    const relPath = path.relative(baseAppDir, negativeDemoPath);
    fs.symlinkSync(relPath, destIndexHtml);
    console.log(`  ✅ Created symlink for base app: harness/base_apps/negative/${inv.name}`);

    // 2. Read prompt from prompts.md
    const promptsPath = path.join(inv.dir, 'prompts.md');
    let prompt = `Implement the guidance from ${inv.name}`;

    if (fs.existsSync(promptsPath)) {
      const promptsContent = readFileSafe(promptsPath);
      const firstLine = promptsContent.split('\n').find(l => l.trim().startsWith('- '));
      if (firstLine) {
        prompt = firstLine.replace(/^-\s*/, '').trim();
      }
    } else {
      console.warn(`  ⚠️  Missing prompts.md for ${inv.name}, using default prompt.`);
    }

    // 3. Create task
    const taskName = `${inv.name}-task-negative`;
    const taskContent = `---
base_app: negative/${inv.name}
grader: ${inv.name}
---
${prompt}
`;

    const taskFilePath = path.join(negativeTasksDir, `${taskName}.md`);
    fs.writeFileSync(taskFilePath, taskContent);
    console.log(`  ✅ Created task: harness/tasks/negative/${taskName}.md`);
  }

  console.log('\nNegative suite resources generation complete!');
}

