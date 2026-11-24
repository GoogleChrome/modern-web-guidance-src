import { pathToFileURL } from "node:url";
import { StaticEmbedder } from "../static-embedder.ts";
import { loadPublicDataset } from "./dataset.ts";
import { mean, median } from "./metrics.ts";

export async function runLatencyBenchmark(): Promise<void> {
  const harness = loadPublicDataset("harness");
  const sampleIndices = [0, 30, 60, 90, 120].filter((i) => i < harness.queries.length);
  const queries = sampleIndices.map((i) => harness.queries[i].query);
  console.log(`Selected ${queries.length} queries from harness-queries.jsonl for latency benchmarking:`);
  queries.forEach((q, i) => console.log(`  [${i + 1}] "${q.slice(0, 60)}"`));

  const WARM_RUNS = 10;

  console.log("\n=== Benchmarking StaticEmbedder (256-d Int8) ===");
  const coldStart = performance.now();
  const embedder = StaticEmbedder.getInstance();
  embedder.init();
  await embedder.embed(queries[0]);
  const coldDuration = performance.now() - coldStart;
  console.log(`StaticEmbedder Cold Start Latency (init + first embed): ${coldDuration.toFixed(2)}ms`);

  console.log(`Running ${WARM_RUNS} warm runs across ${queries.length} queries...`);
  const warmDurations: number[] = [];
  for (let r = 0; r < WARM_RUNS; r++) {
    for (const q of queries) {
      const t0 = performance.now();
      await embedder.embed(q);
      warmDurations.push(performance.now() - t0);
    }
  }
  const warmMedian = median(warmDurations);
  const warmMean = mean(warmDurations);
  console.log(
    `StaticEmbedder Warm Median Latency: ${warmMedian.toFixed(2)}ms (mean: ${warmMean.toFixed(2)}ms, samples: ${warmDurations.length})`
  );

  console.log("\n=== Latency Summary ===");
  console.log(`Cold Start:  ${coldDuration.toFixed(2)}ms`);
  console.log(`Warm Median: ${warmMedian.toFixed(2)}ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runLatencyBenchmark().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
