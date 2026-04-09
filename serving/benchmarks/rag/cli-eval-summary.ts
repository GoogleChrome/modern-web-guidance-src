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
  runId?: string;
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  let hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'
  return `${month} ${day} ${hour}:${minute}:${second}${ampm}`;
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
        ["no-maxsim", "Early deduplication (evaluates only one chunk per guide)"],
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
        
        // Compute col widths across ALL models for consistent alignment
        const allModelStrings: string[] = [];
        for (const entry of history) {
            let modelStr = "";
            if (typeof entry.model === "object") {
                const m = entry.model as any;
                const runtimeStr = m.runtime === "tfjs" ? "TFJS" : `trjs onnx ${m.runtime}`;
                modelStr = `${m.name} ${m.quantization} - ${runtimeStr} - ${m.search}${m.chunking === "nochunk" ? " nochunk" : ""}${m.variant ? ` (${m.variant})` : ""}`;
            } else {
                modelStr = entry.model as string;
            }
            allModelStrings.push(modelStr);
        }
        const colWidths = calculateColWidths(allModelStrings);

        // Group by runId
        const runGroups: Record<string, Record<string, EvalRun[]>> = {};
        for (const entry of history) {
            const runId = entry.runId || entry.timestamp;
            let modelStr = "";
            if (typeof entry.model === "object") {
                const m = entry.model as any;
                const runtimeStr = m.runtime === "tfjs" ? "TFJS" : `trjs onnx ${m.runtime}`;
                modelStr = `${m.name} ${m.quantization} - ${runtimeStr} - ${m.search}${m.chunking === "nochunk" ? " nochunk" : ""}${m.variant ? ` (${m.variant})` : ""}`;
            } else {
                modelStr = entry.model as string;
            }
            
            if (!runGroups[runId]) {
                runGroups[runId] = {};
            }
            if (!runGroups[runId][modelStr]) {
                runGroups[runId][modelStr] = [];
            }
            runGroups[runId][modelStr].push(entry);
        }

        console.log("\n=== Model Performance Summary (Accuracy) ===");
        
        // Sort runs chronologically
        const sortedRunIds = Object.keys(runGroups).sort();
        
        const allTableData: any[] = [];
        
        for (const runId of sortedRunIds) {
            const modelsInRun = runGroups[runId];
            const formattedRun = formatDate(runId);
            
            for (const [modelStr, runs] of Object.entries(modelsInRun)) {
                const top1 = runs.map(r => r.top1HitRate);
                const mrr = runs.map(r => r.meanReciprocalRank);
                
                const avgTop1 = top1.reduce((a, b) => a + b, 0) / runs.length;
                const maxTop1 = Math.max(...top1);
                const minTop1 = Math.min(...top1);
                const avgMrr = mrr.reduce((a, b) => a + b, 0) / runs.length;
                
                const formattedModel = alignModelString(modelStr, colWidths);
                
                allTableData.push({
                    "Run": formattedRun,
                    "Model": formattedModel,
                    "Runs": runs.length,
                    "Avg Top-1": `${(avgTop1 * 100).toFixed(1)}%`,
                    "Max Top-1": `${(maxTop1 * 100).toFixed(1)}%`,
                    "Min Top-1": `${(minTop1 * 100).toFixed(1)}%`,
                    "Avg MRR": avgMrr.toFixed(3)
                });
            }
        }
        
        console.table(allTableData);
    }

    // --- 2. Latency Summary ---
    if (!fs.existsSync(LATENCY_FILE)) {
        console.log(`\nLatency results file not found: ${LATENCY_FILE}`);
    } else {
        const latencyHistory: LatencyRun[] = JSON.parse(fs.readFileSync(LATENCY_FILE, "utf-8"));
        
        console.log("\n=== Model Latency Summary (E2E for 1 Query) ===");
        
        // Sort chronologically
        const sortedLatencyHistory = latencyHistory.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        
        const allModelStrings = sortedLatencyHistory.map(r => r.model);
        const latencyColWidths = calculateColWidths(allModelStrings);
        
        const latencyData = sortedLatencyHistory.map(run => {
            const coldStart = run.runs.length > 0 ? `${run.runs[0]} ms` : "N/A";
            
            let warmAvg = "N/A";
            if (run.runs.length > 1) {
                const warmRuns = run.runs.slice(1);
                const avg = warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length;
                warmAvg = `${avg.toFixed(1)} ms`;
            }
            
            const formattedModel = alignModelString(run.model, latencyColWidths);
            const formattedRun = formatDate(run.timestamp);
            
            return {
                "Run": formattedRun,
                "Model": formattedModel,
                "Cold Start": coldStart,
                "Warm Avg": warmAvg,
                "E2E Average": `${run.avgLatencyMs.toFixed(1)} ms`
            };
        });

        console.table(latencyData);
    }
}

run();
