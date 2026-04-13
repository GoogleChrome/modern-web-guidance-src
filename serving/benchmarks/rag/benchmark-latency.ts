import { Embedder } from "../../lib/transformers-embedder.ts";
import { TfjsEmbedder } from "../../lib/tfjs-embedder.ts";
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



    // --- 2. Native ONNX (Transformers.js / Native) ---
    console.log("\n=== Benchmarking Native ONNX (Transformers.js / Native) ===");
    const nativeRuns: number[] = [];
    let nativeTotal = 0;
    let nativeFailed = false;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        Embedder.clearInstance();

        const start = Date.now();
        try {
            const embedder = Embedder.getInstance();
            await embedder.init();
            await embedder.embed(query, true);
            const duration = Date.now() - start;
            nativeTotal += duration;
            nativeRuns.push(duration);
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
    const tfjsRuns: number[] = [];
    let tfjsTotal = 0;
    for (let i = 0; i < RUNS; i++) {
        console.log(`Run ${i + 1}/${RUNS}...`);
        TfjsEmbedder.clearInstance();

        const start = Date.now();
        const embedder = TfjsEmbedder.getInstance();
        await embedder.init();
        await embedder.embed(query);
        const duration = Date.now() - start;
        tfjsTotal += duration;
        tfjsRuns.push(duration);
        console.log(`  Duration: ${duration}ms`);
    }
    const tfjsAvg = tfjsTotal / RUNS;
    console.log(`TFJS Avg E2E Latency: ${tfjsAvg.toFixed(2)}ms`);

    console.log("\n=== Summary (End-to-End Latency for 1 Query) ===");
    if (nativeAvg !== null) {
        console.log(`Native Avg E2E Latency: ${nativeAvg.toFixed(2)}ms`);
    } else {
        console.log(`Native Avg E2E Latency: FAILED`);
    }
    console.log(`TFJS Avg E2E Latency: ${tfjsAvg.toFixed(2)}ms`);

    // Record results
    const resultsFile = path.resolve(currentDir, "../../benchmarks/data/eval-results-latency.json");
    if (fs.existsSync(resultsFile)) {
        console.log(`\nRecording results to ${resultsFile}...`);
        const results = JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
        const timestamp = new Date().toISOString();

        if (nativeAvg !== null) {
            results.push({
                timestamp,
                model: "minilm q8 - trjs onnx native - maxsim",
                type: "e2e-latency-1-query",
                avgLatencyMs: parseFloat(nativeAvg.toFixed(2)),
                runs: nativeRuns
            });
        }

        results.push({
            timestamp,
            model: "minilm fp32 - TFJS - maxsim",
            type: "e2e-latency-1-query",
            avgLatencyMs: parseFloat(tfjsAvg.toFixed(2)),
            runs: tfjsRuns
        });

        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log("Results recorded.");
    } else {
        console.log(`\nResults file not found: ${resultsFile}. Skipping recording.`);
    }
}

run().catch(console.error);
