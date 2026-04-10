import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.join(process.cwd());

function run(cmd: string) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch {
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

function getModelObj(modelStr: string, isNoChunking: boolean, variant: string) {
  let name = "minilm";
  let quantization = "q8";
  let runtime = "wasm";
  
  if (modelStr === "tfjs") {
    runtime = "tfjs";
    // Detect quantization by file size
    const modelDir = path.join(ROOT, 'lib/tfjs_model_minilm');
    const shardPath = path.join(modelDir, 'group1-shard1of1.bin');
    if (fs.existsSync(shardPath)) {
      const stats = fs.statSync(shardPath);
      const sizeMB = stats.size / (1024 * 1024);
      if (sizeMB < 30) {
        quantization = "q8";
      } else if (sizeMB < 60) {
        quantization = "fp16";
      } else {
        quantization = "fp32";
      }
    } else {
      quantization = "fp32"; // default fallback
    }
  }
  
  if (modelStr.includes("@q4")) {
    quantization = "q4";
  }
  
  return {
    name,
    quantization,
    runtime,
    search: "maxsim",
    chunking: isNoChunking ? "nochunk" : "chunked",
    variant
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runId = new Date().toISOString();
  
  const idArg = args.find(a => a.startsWith('--id='));
  if (!idArg) {
    console.error("Error: --id flag is required to identify this experiment variant!");
    process.exit(1);
  }
  const variant = idArg.split('=')[1];
  
  const isNoChunking = args.includes('--no-chunking');

  const modelsArg = args.find(a => a.startsWith('--models='));
  const models = modelsArg 
    ? modelsArg.split('=')[1].split(',') 
    : [
        'Xenova/all-MiniLM-L6-v2@q8'
      ];
      
  const runsArg = args.find(a => a.startsWith('--runs='));
  // AI-First Safety: Optimize to a single evaluation run by default since deterministic full-pool mode guarantees 0% variance
  const runs = runsArg ? parseInt(runsArg.split('=')[1], 10) : 1;
  
  const poolPath = path.join(ROOT, 'benchmarks/data/eval-queries-pool.json');
  const targetEvalsPath = path.join(ROOT, 'benchmarks/data/eval-queries.gen.json');
  const resultsPath = path.join(ROOT, 'benchmarks/data', 'eval-results.json');

  // Generate the pool once if it doesn't exist
  if (!fs.existsSync(poolPath)) {
     console.log('Generating master query pool (50 queries per guide)...');
     run('node --experimental-strip-types benchmarks/rag/generate-eval-queries.ts');
  }

  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));

  // Group queries by guide ID up-front
  const groupedQueries: Record<string, any[]> = {};
  for (const q of pool) {
     if (!groupedQueries[q.guideId]) groupedQueries[q.guideId] = [];
     groupedQueries[q.guideId].push(q);
  }

  // AI-First Safety: Default to full pool deterministic evaluations to guarantee strict mathematical comparability
  const isFullPool = !args.includes('--random-subset');

  for (let iter = 1; iter <= runs; iter++) {
    console.log(`\n\n=== VARIANCE ITERATION ${iter} of ${runs} ===`);
    
    const subset = [];
    if (isFullPool) {
      // Consume ALL 50 master pool queries per guide directly to guarantee 100% static comparability
      for (const guideId in groupedQueries) {
         subset.push(...groupedQueries[guideId]);
      }
      // Sort them stably by guide ID and query to prevent any chronological jitter
      subset.sort((a, b) => a.guideId.localeCompare(b.guideId) || a.query.localeCompare(b.query));
    } else {
      // Sample exactly 5 random queries per guide for standard variance testing
      for (const guideId in groupedQueries) {
          const queries = groupedQueries[guideId];
          const shuffled = shuffle(queries);
          subset.push(...shuffled.slice(0, 5));
      }
    }

    fs.writeFileSync(targetEvalsPath, JSON.stringify(subset, null, 2));
    if (isFullPool) {
      console.log(`Loaded ALL ${subset.length} master queries sequentially for testing.`);
    } else {
      console.log(`Sampled ${subset.length} randomized queries to test against.`);
    }

    for (const model of models) {
      console.log(`\nEvaluating ${model} (Iter ${iter})...`);
      // Rebuild the vector database table for the specific model before querying
      const buildCmd = `node --experimental-strip-types scripts/build-guides.ts --model=${model}${isNoChunking ? ' --no-chunking' : ''}`;
      run(buildCmd);
      run(`node --experimental-strip-types benchmarks/rag/eval-rag-search.ts --model=${model}`);
      
      if (fs.existsSync(resultsPath)) {
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
        
        results[results.length - 1].model = getModelObj(model, isNoChunking, variant);
        results[results.length - 1].runId = runId;
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      }
    }
  }

  // Parse results
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  
  console.log('\n\n=== FINAL VARIANCE ANALYSIS ===');
  for (const model of models) {
    const targetModelObj = getModelObj(model, isNoChunking, variant);
    const targetRuntimeStr = targetModelObj.runtime === "tfjs" ? "TFJS" : `trjs onnx ${targetModelObj.runtime}`;
    const targetModelStr = `${targetModelObj.name} ${targetModelObj.quantization} - ${targetRuntimeStr} - ${targetModelObj.search}${targetModelObj.chunking === "nochunk" ? " nochunk" : ""}`;
    
    const modelRuns = results.filter((r: any) => {
      let modelStr = "";
      if (typeof r.model === "object") {
        const m = r.model as any;
        const runtimeStr = m.runtime === "tfjs" ? "TFJS" : `trjs onnx ${m.runtime}`;
        modelStr = `${m.name} ${m.quantization} - ${runtimeStr} - ${m.search}${m.chunking === "nochunk" ? " nochunk" : ""}`;
      } else {
        modelStr = r.model;
      }
      return modelStr === targetModelStr;
    });
    
    if (modelRuns.length === 0) {
      console.log(`\nModel: ${targetModelStr}\nNo data found.`);
      continue;
    }

    const mrrValues = modelRuns.map((r: any) => r.meanReciprocalRank);
    const top1Values = modelRuns.map((r: any) => r.top1HitRate);

    const mrrAvg = mrrValues.reduce((a:number, b:number) => a + b, 0) / mrrValues.length;
    const top1Avg = top1Values.reduce((a:number, b:number) => a + b, 0) / top1Values.length;

    const mrrVar = mrrValues.reduce((a:number, b:number) => a + Math.pow(b - mrrAvg, 2), 0) / mrrValues.length;
    const top1Var = top1Values.reduce((a:number, b:number) => a + Math.pow(b - top1Avg, 2), 0) / top1Values.length;

    console.log(`\nModel: ${targetModelStr}`);
    console.log(`Sample size: ${modelRuns.length} runs`);
    console.log(`Top-1 Hit Rate:  ${(top1Avg * 100).toFixed(2)}% (StdDev: ±${(Math.sqrt(top1Var) * 100).toFixed(2)}%)`);
    console.log(`MRR:             ${mrrAvg.toFixed(4)} (StdDev: ±${Math.sqrt(mrrVar).toFixed(4)})`);
  }
}

main().catch(console.error);
