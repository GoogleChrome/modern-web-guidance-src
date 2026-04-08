import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const RESULTS_FILE = path.join(ROOT_DIR, "benchmarks/data/eval-results.json");

interface EvalRun {
  timestamp: string;
  model: string;
  totalQueries: number;
  top1HitRate: number;
  top3HitRate: number;
  top5HitRate: number;
  meanReciprocalRank: number;
}

function run() {
    if (!fs.existsSync(RESULTS_FILE)) {
        console.error(`Results file not found: ${RESULTS_FILE}`);
        return;
    }

    const history: EvalRun[] = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
    
    // Group by model
    const groups: Record<string, EvalRun[]> = {};
    for (const entry of history) {
        if (!groups[entry.model]) {
            groups[entry.model] = [];
        }
        groups[entry.model].push(entry);
    }

    console.log("\n=== Model Performance Summary ===");
    
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

run();
