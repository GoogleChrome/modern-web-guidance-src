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
  model: string;
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

// Helper to format date
function formatDate(isoString: string): string {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
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
        ["q8", "8-bit Quantized"],
        ["fp32", "32-bit Float precision"]
    ];
    glossary.forEach(([term, desc]) => {
        console.log(`${term.padEnd(12)} : ${desc}`);
    });
    console.log("================\n");

    // --- 1. Accuracy Timeline ---
    if (!fs.existsSync(RESULTS_FILE)) {
        console.error(`Results file not found: ${RESULTS_FILE}`);
    } else {
        const history: EvalRun[] = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
        
        // Sort by timestamp
        history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        console.log("\n=== Model Performance Timeline (Accuracy) ===");
        
        const allModels = history.map(m => m.model);
        const colWidths = calculateColWidths(allModels);
        
        const summaryData = history.map((run, index) => {
            const formattedModel = alignModelString(run.model, colWidths);
            
            return {
                "#": index + 1,
                "Date/Time": formatDate(run.timestamp),
                Model: formattedModel,
                "Top-1": (run.top1HitRate * 100).toFixed(1) + "%",
                "Top-3": (run.top3HitRate * 100).toFixed(1) + "%",
                "MRR": run.meanReciprocalRank.toFixed(3)
            };
        });

        console.table(summaryData);
    }

    // --- 2. Latency Timeline ---
    if (!fs.existsSync(LATENCY_FILE)) {
        console.log(`\nLatency results file not found: ${LATENCY_FILE}`);
    } else {
        const latencyHistory: LatencyRun[] = JSON.parse(fs.readFileSync(LATENCY_FILE, "utf-8"));
        
        // Sort by timestamp
        latencyHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        console.log("\n=== Model Latency Timeline (E2E for 1 Query) ===");
        
        const allLatencyModels = latencyHistory.map(m => m.model);
        const latencyColWidths = calculateColWidths(allLatencyModels);
        
        const latencyData = latencyHistory.map((run, index) => {
            const coldStart = run.runs.length > 0 ? `${run.runs[0]} ms` : "N/A";
            
            let warmAvg = "N/A";
            if (run.runs.length > 1) {
                const warmRuns = run.runs.slice(1);
                const avg = warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length;
                warmAvg = `${avg.toFixed(1)} ms`;
            }
            
            const formattedModel = alignModelString(run.model, latencyColWidths);
            
            return {
                "#": index + 1,
                "Date/Time": formatDate(run.timestamp),
                Model: formattedModel,
                "Cold Start": coldStart,
                "Warm Avg": warmAvg,
                "E2E Avg": `${run.avgLatencyMs.toFixed(1)} ms`
            };
        });

        console.table(latencyData);
    }
}

run();
