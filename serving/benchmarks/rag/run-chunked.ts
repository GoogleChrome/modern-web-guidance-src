import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.join(process.cwd());

function run(cmd: string) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch (e: any) {
    console.warn(`Command failed but continuing: ${cmd}`);
  }
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const poolPath = path.join(ROOT, 'benchmarks/data/eval-queries-pool.json');
  const targetEvalsPath = path.join(ROOT, 'benchmarks/data/eval-queries.json');
  const resultsPath = path.join(ROOT, 'benchmarks/data', 'eval-results.json');
  
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));
  const groupedQueries: Record<string, any[]> = {};
  for (const q of pool) {
     if (!groupedQueries[q.guideId]) groupedQueries[q.guideId] = [];
     groupedQueries[q.guideId].push(q);
  }

  const chunkedModelId = 'Xenova/all-MiniLM-L6-v2@q8';
  const label = 'all-MiniLM-L6-v2@q8 (Chunked)';

  for (let iter = 1; iter <= 10; iter++) {
    const subset = [];
    for (const guideId in groupedQueries) {
        const queries = groupedQueries[guideId];
        const shuffled = shuffle(queries);
        subset.push(...shuffled.slice(0, 5));
    }
    fs.writeFileSync(targetEvalsPath, JSON.stringify(subset, null, 2));
    
    // Build WITH chunking (no --no-chunking flag)
    run(`node --experimental-strip-types scripts/build-guides.ts --model=${chunkedModelId}`);
    
    // Eval 
    run(`node --experimental-strip-types benchmarks/rag/eval-search.ts --model=${chunkedModelId}`);
    
    // Rewrite the last entry in eval-results.json to have the "(Chunked)" label
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    results[results.length - 1].model = label;
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  }
  
  // Re-generate plot
  run(`node --experimental-strip-types benchmarks/rag/plot-evals.ts`);
}

main().catch(console.error);
