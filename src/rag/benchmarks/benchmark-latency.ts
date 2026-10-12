import { TfjsEmbedder } from "../tfjs-embedder.ts";
import fs from "fs";
import path from "path";
import { rootDir } from "../../core/paths.ts";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function run() {
  const queriesFile = path.join(rootDir, "src/rag/benchmarks/data/eval-queries-pool.json");
  console.log(`Loading queries from ${queriesFile}...`);

  const allQueries: Array<{ query: string }> = JSON.parse(fs.readFileSync(queriesFile, "utf-8"));
  // Pick 5 diverse representative queries
  const sampleIndices = [0, 50, 100, 200, 300].filter(i => i < allQueries.length);
  const queries = sampleIndices.map(i => allQueries[i].query);
  console.log(`Selected ${queries.length} queries for benchmarking:`);
  queries.forEach((q, i) => console.log(`  [${i + 1}] "${q.slice(0, 60)}..."`));

  const WARM_RUNS = 10;

  // --- 1. TensorFlow.js (Pure JS) ---
  console.log("\n=== Benchmarking TensorFlow.js (Pure JS) ===");
  TfjsEmbedder.clearInstance();

  // Cold start
  const tfjsColdStart = Date.now();
  const tfjsEmbedder = TfjsEmbedder.getInstance();
  await tfjsEmbedder.init();
  await tfjsEmbedder.embed(queries[0]);
  const tfjsColdDuration = Date.now() - tfjsColdStart;
  console.log(`TFJS Cold Start Latency (init + first embed): ${tfjsColdDuration}ms`);

  // Warm runs
  console.log(`Running ${WARM_RUNS} warm runs across ${queries.length} queries...`);
  const tfjsWarmDurations: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    for (const q of queries) {
      const t0 = performance.now();
      await tfjsEmbedder.embed(q);
      tfjsWarmDurations.push(performance.now() - t0);
    }
  }
  const tfjsWarmMedian = median(tfjsWarmDurations);
  const tfjsWarmMean = tfjsWarmDurations.reduce((a, b) => a + b, 0) / tfjsWarmDurations.length;
  console.log(`TFJS Warm Median Latency: ${tfjsWarmMedian.toFixed(2)}ms (mean: ${tfjsWarmMean.toFixed(2)}ms, samples: ${tfjsWarmDurations.length})`);

  console.log("\n=== Latency Summary ===");
  console.log(`TFJS Cold Start:  ${tfjsColdDuration}ms`);
  console.log(`TFJS Warm Median: ${tfjsWarmMedian.toFixed(2)}ms`);

  // Record results
  const resultsFile = path.join(rootDir, "src/rag/benchmarks/data/eval-results-latency.json");
  if (fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
    const timestamp = new Date().toISOString();
    results.push({
      timestamp,
      model: "minilm q8 - TFJS - maxsim",
      type: "latency-cold-and-warm",
      coldStartMs: tfjsColdDuration,
      warmMedianMs: parseFloat(tfjsWarmMedian.toFixed(2)),
      warmMeanMs: parseFloat(tfjsWarmMean.toFixed(2)),
      warmSamples: tfjsWarmDurations.length,
    });
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`Results recorded to ${resultsFile}`);
  }
}

run().catch(console.error);
