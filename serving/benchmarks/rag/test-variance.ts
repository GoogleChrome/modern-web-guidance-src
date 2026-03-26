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

// Randomly shuffles an array safely
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const modelsDir = path.join(ROOT, 'models');
  const models = [
    'Xenova/all-MiniLM-L6-v2@q8',
    'onnx-community/embeddinggemma-300m-ONNX@q8',
    'onnx-community/embeddinggemma-300m-ONNX@q4'
  ];
  const runs = 10;
  
  const poolPath = path.join(ROOT, 'benchmarks/data/eval-queries-pool.json');
  const targetEvalsPath = path.join(ROOT, 'benchmarks/data/eval-queries.json');
  const resultsPath = path.join(ROOT, 'benchmarks/data', 'eval-results.json');

  // Generate the pool once if it doesn't exist
  if (!fs.existsSync(poolPath)) {
     console.log('Generating master query pool (50 queries per guide)...');
     run('node --experimental-strip-types benchmarks/rag/generate-eval-queries.ts');
  }

  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));

  // Clean history
  if (fs.existsSync(resultsPath)) fs.unlinkSync(resultsPath);

  // Group queries by guide ID up-front
  const groupedQueries: Record<string, any[]> = {};
  for (const q of pool) {
     if (!groupedQueries[q.guideId]) groupedQueries[q.guideId] = [];
     groupedQueries[q.guideId].push(q);
  }

  for (let iter = 1; iter <= runs; iter++) {
    console.log(`\n\n=== VARIANCE ITERATION ${iter} of ${runs} ===`);
    
    // Sample exactly 5 random queries per guide for this specific test run iteration
    const subset = [];
    for (const guideId in groupedQueries) {
        const queries = groupedQueries[guideId];
        const shuffled = shuffle(queries);
        subset.push(...shuffled.slice(0, 5));
    }

    fs.writeFileSync(targetEvalsPath, JSON.stringify(subset, null, 2));
    console.log(`Sampled ${subset.length} randomized queries to test against.`);

    for (const model of models) {
      console.log(`\nEvaluating ${model} (Iter ${iter})...`);
      // Rebuild the vector database table for the specific model before querying
      run(`node --experimental-strip-types scripts/build-guides.ts --model=${model} --no-chunking`);
      run(`node --experimental-strip-types benchmarks/rag/eval-search.ts --model=${model}`);
    }
  }

  // Parse results
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  
  console.log('\n\n=== FINAL VARIANCE ANALYSIS ===');
  for (const model of models) {
    const modelRuns = results.filter((r: any) => r.model === model);
    const mrrValues = modelRuns.map((r: any) => r.meanReciprocalRank);
    const top1Values = modelRuns.map((r: any) => r.top1HitRate);

    const mrrAvg = mrrValues.reduce((a:number, b:number) => a + b, 0) / mrrValues.length;
    const top1Avg = top1Values.reduce((a:number, b:number) => a + b, 0) / top1Values.length;

    const mrrVar = mrrValues.reduce((a:number, b:number) => a + Math.pow(b - mrrAvg, 2), 0) / mrrValues.length;
    const top1Var = top1Values.reduce((a:number, b:number) => a + Math.pow(b - top1Avg, 2), 0) / top1Values.length;

    console.log(`\nModel: ${model}`);
    console.log(`Sample size: ${modelRuns.length} runs`);
    console.log(`Top-1 Hit Rate:  ${(top1Avg * 100).toFixed(2)}% (StdDev: ±${(Math.sqrt(top1Var) * 100).toFixed(2)}%)`);
    console.log(`MRR:             ${mrrAvg.toFixed(4)} (StdDev: ±${Math.sqrt(mrrVar).toFixed(4)})`);
  }
}

main().catch(console.error);
