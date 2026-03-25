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

async function main() {
  const models = [
    'Xenova/all-MiniLM-L6-v2',
    'nomic-embed-text-v1.5.f16.gguf'
  ];
  const runs = 10;
  
  // Clean history
  const resultsPath = path.join(ROOT, '.modern-web-data', 'eval-results.json');
  if (fs.existsSync(resultsPath)) fs.unlinkSync(resultsPath);

  for (let iter = 1; iter <= runs; iter++) {
    console.log(`\n\n=== VARIANCE ITERATION ${iter} of ${runs} ===`);
    run('node --experimental-strip-types scripts/generate-eval-queries.ts');

    for (const model of models) {
      console.log(`\nEvaluating ${model} (Iter ${iter})...`);
      run(`node --experimental-strip-types scripts/build-guides.ts --model=${model}`);
      run(`node --experimental-strip-types scripts/eval-search.ts --model=${model}`);
    }
    
    // Slight sleep to protect against ratelimits in sequential loops
    run('sleep 5');
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
