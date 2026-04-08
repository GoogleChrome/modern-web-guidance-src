import { Embedder } from "../../mcp-server/lib/embedder.ts";
import { TfjsEmbedder } from "./tfjs-embedder.ts";
import fs from "fs";
import path from "path";

async function run() {
    // In ESM, __dirname is not available, use import.meta.dirname
    const currentDir = import.meta.dirname;
    const queriesFile = path.resolve(currentDir, "../../benchmarks/data/eval-queries-pool.json");
    console.log(`Loading queries from ${queriesFile}...`);
    
    const allQueries = JSON.parse(fs.readFileSync(queriesFile, "utf-8"));
    const queries = allQueries.slice(0, 50).map((x: any) => x.query);
    
    console.log(`Loaded ${queries.length} queries for benchmark.`);
    
    // --- Baseline (Transformers.js) ---
    console.log("\n=== Benchmarking Baseline (Transformers.js) ===");
    const baselineEmbedder = Embedder.getInstance();
    
    // Warmup
    console.log("Warming up baseline...");
    await baselineEmbedder.embed(queries[0], true);
    
    console.log("Running latency benchmark...");
    const baselineStart = Date.now();
    for (const q of queries) {
        await baselineEmbedder.embed(q, true);
    }
    const baselineDuration = Date.now() - baselineStart;
    const baselineAvg = baselineDuration / queries.length;
    console.log(`Baseline Total Time: ${baselineDuration}ms`);
    console.log(`Baseline Avg Latency: ${baselineAvg.toFixed(2)}ms`);
    
    // --- TensorFlow.js ---
    console.log("\n=== Benchmarking TensorFlow.js ===");
    const tfjsEmbedder = TfjsEmbedder.getInstance();
    
    // Warmup
    console.log("Warming up TFJS...");
    await tfjsEmbedder.embed(queries[0], true);
    
    console.log("Running latency benchmark...");
    const tfjsStart = Date.now();
    for (const q of queries) {
        await tfjsEmbedder.embed(q, true);
    }
    const tfjsDuration = Date.now() - tfjsStart;
    const tfjsAvg = tfjsDuration / queries.length;
    console.log(`TFJS Total Time: ${tfjsDuration}ms`);
    console.log(`TFJS Avg Latency: ${tfjsAvg.toFixed(2)}ms`);
    
    console.log("\n=== Summary ===");
    console.log(`Baseline Avg Latency: ${baselineAvg.toFixed(2)}ms`);
    console.log(`TFJS Avg Latency: ${tfjsAvg.toFixed(2)}ms`);
    console.log(`Ratio (TFJS / Baseline): ${(tfjsAvg / baselineAvg).toFixed(2)}x`);
    
    // Cleanup TFJS server
    tfjsEmbedder.shutdown();
}

run().catch(console.error);
