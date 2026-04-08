import { Embedder } from "../../mcp-server/lib/embedder.ts";
import { TfjsEmbedder } from "./tfjs-embedder.ts";
import fs from "fs";
import path from "path";

async function run() {
    const currentDir = import.meta.dirname;
    const queriesFile = path.resolve(currentDir, "../../benchmarks/data/eval-queries-pool.json");
    console.log(`Loading queries from ${queriesFile}...`);
    
    const allQueries = JSON.parse(fs.readFileSync(queriesFile, "utf-8"));
    const queries = allQueries.slice(0, 50).map((x: any) => x.query);
    
    console.log(`Loaded ${queries.length} queries for benchmark.`);
    
    // --- 1. Baseline (Transformers.js / WASM) ---
    console.log("\n=== Benchmarking Baseline (Transformers.js / WASM) ===");
    Embedder.configureRuntime('wasm');
    Embedder.clearInstance();
    const wasmEmbedder = Embedder.getInstance();
    
    // Warmup
    console.log("Warming up WASM...");
    await wasmEmbedder.embed(queries[0], true);
    
    console.log("Running latency benchmark...");
    const wasmStart = Date.now();
    for (const q of queries) {
        await wasmEmbedder.embed(q, true);
    }
    const wasmDuration = Date.now() - wasmStart;
    const wasmAvg = wasmDuration / queries.length;
    console.log(`WASM Total Time: ${wasmDuration}ms`);
    console.log(`WASM Avg Latency: ${wasmAvg.toFixed(2)}ms`);
    
    // --- 2. Native ONNX (Transformers.js / Native) ---
    console.log("\n=== Benchmarking Native ONNX (Transformers.js / Native) ===");
    Embedder.configureRuntime('native');
    Embedder.clearInstance();
    const nativeEmbedder = Embedder.getInstance();
    
    // Warmup
    console.log("Warming up Native...");
    try {
        await nativeEmbedder.embed(queries[0], true);
        
        console.log("Running latency benchmark...");
        const nativeStart = Date.now();
        for (const q of queries) {
            await nativeEmbedder.embed(q, true);
        }
        const nativeDuration = Date.now() - nativeStart;
        var nativeAvg: number | null = nativeDuration / queries.length;
        console.log(`Native Total Time: ${nativeDuration}ms`);
        console.log(`Native Avg Latency: ${nativeAvg.toFixed(2)}ms`);
    } catch (e) {
        console.error("Failed to run Native ONNX:", e);
        var nativeAvg: number | null = null;
    }
    
    // --- 3. TensorFlow.js (Pure JS) ---
    console.log("\n=== Benchmarking TensorFlow.js (Pure JS) ===");
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
    console.log(`WASM Avg Latency: ${wasmAvg.toFixed(2)}ms`);
    if (nativeAvg !== null) {
        console.log(`Native Avg Latency: ${nativeAvg.toFixed(2)}ms`);
    } else {
        console.log(`Native Avg Latency: FAILED`);
    }
    console.log(`TFJS Avg Latency: ${tfjsAvg.toFixed(2)}ms`);
    
    // Cleanup TFJS server
    tfjsEmbedder.shutdown();
}

run().catch(console.error);
