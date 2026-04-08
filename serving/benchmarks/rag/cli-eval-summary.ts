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

function run() {
    // --- 1. Accuracy Summary ---
    if (!fs.existsSync(RESULTS_FILE)) {
        console.error(`Results file not found: ${RESULTS_FILE}`);
    } else {
        const history: EvalRun[] = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
        
        // Group by model
        const groups: Record<string, EvalRun[]> = {};
        for (const entry of history) {
            if (!groups[entry.model]) {
                groups[entry.model] = [];
            }
            groups[entry.model].push(entry);
        }

        console.log("\n=== Model Performance Summary (Accuracy) ===");
        
        const summaryData = Object.entries(groups).map(([model, runs]) => {
            const top1Rates = runs.map(r => r.top1HitRate);
            const mrrRates = runs.map(r => r.meanReciprocalRank);
            
            const avgTop1 = top1Rates.reduce((a, b) => a + b, 0) / runs.length;
            const maxTop1 = Math.max(...top1Rates);
            const minTop1 = Math.min(...top1Rates);
            
            const avgMrr = mrrRates.reduce((a, b) => a + b, 0) / runs.length;
            
            return {
                Model: model,
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
        
        const latencyData = Object.entries(latestRuns).map(([model, run]) => {
            const coldStart = run.runs.length > 0 ? `${run.runs[0]} ms` : "N/A";
            
            let warmAvg = "N/A";
            if (run.runs.length > 1) {
                const warmRuns = run.runs.slice(1);
                const avg = warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length;
                warmAvg = `${avg.toFixed(1)} ms`;
            }
            
            return {
                Model: model,
                "Cold Start (Run 1)": coldStart,
                "Warm Avg (Runs 2+)": warmAvg,
                "E2E Average": `${run.avgLatencyMs.toFixed(1)} ms`
            };
        });

        console.table(latencyData);
    }
}

run();
