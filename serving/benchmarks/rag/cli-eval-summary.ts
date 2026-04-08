import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const RESULTS_FILE = path.join(ROOT_DIR, "benchmarks/data/eval-results.json");
const LATENCY_FILE = path.join(ROOT_DIR, "benchmarks/data/eval-results-latency.json");

interface EvalRun {
  timestamp: string;
  model: string | { name: string; quantization: string; runtime: string; chunking: string; };
  totalQueries: number;
  top1HitRate: number;
  top3HitRate: number;
  top5HitRate: number;
  meanReciprocalRank: number;
}

interface LatencyRun {
  timestamp: string;
  model: string;
  type: string;
  avgLatencyMs: number;
  runs: number[];
}

// Helper to align hyphens in model strings
function alignModelString(model: string, colWidths: number[]): string {
    const parts = model.split(" - ");
    const paddedParts = parts.map((p, i) => p.padEnd(colWidths[i] || 0));
    return paddedParts.join(" - ");
}

// Helper to calculate max widths for each part of the model string
function calculateColWidths(models: string[]): number[] {
    const maxParts = Math.max(...models.map(m => m.split(" - ").length));
    const colWidths = Array(maxParts).fill(0);
    
    for (const model of models) {
        const parts = model.split(" - ");
        parts.forEach((p, i) => {
            colWidths[i] = Math.max(colWidths[i], p.length);
        });
    }
    return colWidths;
}

function run() {
    console.log("\n=== Glossary ===");
    const glossary = [
        ["trjs", "Transformers.js"],
        ["onnx", "ONNX Runtime"],
        ["TFJS", "TensorFlow.js"],
        ["wasm", "WebAssembly (onnxruntime-web)"],
        ["native", "Native OS bindings (onnxruntime-node)"],
        ["maxsim", "Max-similarity chunk aggregation"],
        ["singlechunk", "Early deduplication (evaluates only one chunk per guide)"],
        ["server", "Used local HTTP server to load model files"],
        ["parsefloat", "Keep float precision in search (see commit c910113)"],
        ["q8", "8-bit Quantized"],
        ["fp32", "32-bit Float precision"]
    ];
    const maxTermLen = Math.max(...glossary.map(([term]) => term.length));
    glossary.forEach(([term, desc]) => {
        console.log(`${term.padEnd(maxTermLen)} : ${desc}`);
    });
    console.log("================\n");

    // --- 1. Accuracy Summary ---
    if (!fs.existsSync(RESULTS_FILE)) {
        console.error(`Results file not found: ${RESULTS_FILE}`);
    } else {
        const history: EvalRun[] = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
        
        // Group by model
        const groups: Record<string, EvalRun[]> = {};
        for (const entry of history) {
            let modelStr = "";
            if (typeof entry.model === "object") {
                const m = entry.model as any;
                modelStr = `${m.name} ${m.quantization} - trjs onnx ${m.runtime} - ${m.chunking}`;
            } else {
                modelStr = entry.model;
            }
            
            if (!groups[modelStr]) {
                groups[modelStr] = [];
            }
            groups[modelStr].push(entry);
        }

        console.log("\n=== Model Performance Summary (Accuracy) ===");
        
        const allModels = Object.keys(groups);
        const colWidths = calculateColWidths(allModels);
        
        const summaryData = Object.entries(groups).map(([model, runs]) => {
            const top1Rates = runs.map(r => r.top1HitRate);
            const mrrRates = runs.map(r => r.meanReciprocalRank);
            
            const avgTop1 = top1Rates.reduce((a, b) => a + b, 0) / runs.length;
            const maxTop1 = Math.max(...top1Rates);
            const minTop1 = Math.min(...top1Rates);
            
            const avgMrr = mrrRates.reduce((a, b) => a + b, 0) / runs.length;
            
            const formattedModel = alignModelString(model, colWidths);
            
            return {
                Model: formattedModel,
                Runs: runs.length,
                "Avg Top-1": (avgTop1 * 100).toFixed(1) + "%",
                "Max Top-1": (maxTop1 * 100).toFixed(1) + "%",
                "Min Top-1": (minTop1 * 100).toFixed(1) + "%",
                "Avg MRR": avgMrr.toFixed(3)
            };
        });

        console.table(summaryData);
    }

    // --- 2. Latency Summary ---
    if (!fs.existsSync(LATENCY_FILE)) {
        console.log(`\nLatency results file not found: ${LATENCY_FILE}`);
    } else {
        const latencyHistory: LatencyRun[] = JSON.parse(fs.readFileSync(LATENCY_FILE, "utf-8"));
        
        // Group by model, take the LATEST run for each model
        const latestRuns: Record<string, LatencyRun> = {};
        for (const entry of latencyHistory) {
            latestRuns[entry.model] = entry; // Overwrites older runs, keeping the latest
        }

        console.log("\n=== Model Latency Summary (E2E for 1 Query) ===");
        
        const allLatencyModels = Object.keys(latestRuns);
        const latencyColWidths = calculateColWidths(allLatencyModels);
        
        const latencyData = Object.entries(latestRuns).map(([model, run]) => {
            const coldStart = run.runs.length > 0 ? `${run.runs[0]} ms` : "N/A";
            
            let warmAvg = "N/A";
            if (run.runs.length > 1) {
                const warmRuns = run.runs.slice(1);
                const avg = warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length;
                warmAvg = `${avg.toFixed(1)} ms`;
            }
            
            const formattedModel = alignModelString(model, latencyColWidths);
            
            return {
                Model: formattedModel,
                "Cold Start (Run 1)": coldStart,
                "Warm Avg (Runs 2+)": warmAvg,
                "E2E Average": `${run.avgLatencyMs.toFixed(1)} ms`
            };
        });

        console.table(latencyData);
    }
}

run();
