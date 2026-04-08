import { Embedder } from "../../mcp-server/lib/embedder.ts";
import { TfjsEmbedder } from "./tfjs-embedder.ts";
import fs from "fs";
import path from "path";

async function run() {
    const currentDir = import.meta.dirname;
    const queriesFile = path.resolve(currentDir, "../../benchmarks/data/eval-queries-pool.json");
    console.log(`Loading queries from ${queriesFile}...`);
    
    const allQueries = JSON.parse(fs.readFileSync(queriesFile, "utf-8"));
    const query = allQueries[0].query;
    
    console.log(`Using query: "${query}" for end-to-end benchmark.`);
    
    const RUNS = 3;
    
    // --- 1. Baseline (Transformers.js / WASM) ---
    console.log("\n=== Benchmarking Baseline (Transformers.js / WASM) ===");
    let wasmTotal = 0;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        Embedder.configureRuntime('wasm');
        Embedder.clearInstance();
        
        const start = Date.now();
        const embedder = Embedder.getInstance();
        await embedder.init();
        await embedder.embed(query, true);
        const duration = Date.now() - start;
        wasmTotal += duration;
        console.log(`  Duration: ${duration}ms`);
    }
    const wasmAvg = wasmTotal / RUNS;
    console.log(`WASM Avg E2E Latency: ${wasmAvg.toFixed(2)}ms`);
    
    // --- 2. Native ONNX (Transformers.js / Native) ---
    console.log("\n=== Benchmarking Native ONNX (Transformers.js / Native) ===");
    let nativeTotal = 0;
    let nativeFailed = false;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        Embedder.configureRuntime('native');
        Embedder.clearInstance();
        
        const start = Date.now();
        try {
            const embedder = Embedder.getInstance();
            await embedder.init();
            await embedder.embed(query, true);
            const duration = Date.now() - start;
            nativeTotal += duration;
            console.log(`  Duration: ${duration}ms`);
        } catch (e) {
            console.error("  Failed to run Native ONNX:", e);
            nativeFailed = true;
            break;
        }
    }
    const nativeAvg = nativeFailed ? null : nativeTotal / RUNS;
    if (nativeAvg !== null) {
        console.log(`Native Avg E2E Latency: ${nativeAvg.toFixed(2)}ms`);
    }
    
    // --- 3. TensorFlow.js (Pure JS) ---
    console.log("\n=== Benchmarking TensorFlow.js (Pure JS) ===");
    let tfjsTotal = 0;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        TfjsEmbedder.clearInstance();
        
        const start = Date.now();
        const embedder = TfjsEmbedder.getInstance();
        await embedder.init();
        await embedder.embed(query, true);
        const duration = Date.now() - start;
        tfjsTotal += duration;
        console.log(`  Duration: ${duration}ms`);
    }
    const tfjsAvg = tfjsTotal / RUNS;
    console.log(`TFJS Avg E2E Latency: ${tfjsAvg.toFixed(2)}ms`);
    
    console.log("\n=== Summary (End-to-End Latency for 1 Query) ===");
    console.log(`WASM Avg E2E Latency: ${wasmAvg.toFixed(2)}ms`);
    if (nativeAvg !== null) {
        console.log(`Native Avg E2E Latency: ${nativeAvg.toFixed(2)}ms`);
    } else {
        console.log(`Native Avg E2E Latency: FAILED`);
    }
    console.log(`TFJS Avg E2E Latency: ${tfjsAvg.toFixed(2)}ms`);
}

run().catch(console.error);
