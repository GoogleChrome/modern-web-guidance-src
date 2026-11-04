import { pathToFileURL } from "node:url";
import { TfjsEmbedder } from "../tfjs-embedder.ts";
import { loadPublicDataset } from "./dataset.ts";
import { mean, median } from "./metrics.ts";

export async function runLatencyBenchmark(): Promise<void> {
  const harness = loadPublicDataset("harness");
  const sampleIndices = [0, 30, 60, 90, 120].filter((i) => i < harness.queries.length);
  const queries = sampleIndices.map((i) => harness.queries[i].query);
  console.log(`Selected ${queries.length} queries from harness-queries.jsonl for latency benchmarking:`);
  queries.forEach((q, i) => console.log(`  [${i + 1}] "${q.slice(0, 60)}"`));

  const WARM_RUNS = 10;

  console.log("\n=== Benchmarking TensorFlow.js (Pure JS) ===");
  TfjsEmbedder.clearInstance();

  const tfjsColdStart = performance.now();
  const tfjsEmbedder = TfjsEmbedder.getInstance();
  await tfjsEmbedder.init();
  await tfjsEmbedder.embed(queries[0]);
  const tfjsColdDuration = performance.now() - tfjsColdStart;
  console.log(`TFJS Cold Start Latency (init + first embed): ${tfjsColdDuration.toFixed(2)}ms`);

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
  const tfjsWarmMean = mean(tfjsWarmDurations);
  console.log(
    `TFJS Warm Median Latency: ${tfjsWarmMedian.toFixed(2)}ms (mean: ${tfjsWarmMean.toFixed(2)}ms, samples: ${tfjsWarmDurations.length})`
  );

  console.log("\n=== Latency Summary ===");
  console.log(`TFJS Cold Start:  ${tfjsColdDuration.toFixed(2)}ms`);
  console.log(`TFJS Warm Median: ${tfjsWarmMedian.toFixed(2)}ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runLatencyBenchmark().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
