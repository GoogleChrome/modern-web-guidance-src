import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @ts-ignore - dev-guide.ts might not have types in this setup but node handles it
import { scanAllGuides, classifyGuide, getTaskMap, createTask } from './dev-guide.ts';


export async function generateTaskSuite() {
  console.log('Scanning guides...');
  const taskMap = getTaskMap();
  const allGuides = scanAllGuides(taskMap);

  const evalReadyGuides = allGuides.filter(inv => classifyGuide(inv) === 'eval-ready');

  if (evalReadyGuides.length === 0) {
    console.log('No eval-ready guides found.');
    return;
  }

  console.log(`Found ${evalReadyGuides.length} eval-ready guides.`);

  let updatedCount = 0;

  for (const inv of evalReadyGuides) {
    createTask(inv.dir, inv.name);
    updatedCount++;
  }

  console.log(`\nTask suite generation complete! Updated/Synced ${updatedCount} tasks.`);
}
