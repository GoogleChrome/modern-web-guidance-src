import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Embedder } from "../../mcp-server/lib/embedder.ts";
import { Store } from "../../mcp-server/lib/store.ts";
import { Gpt4AllEmbedder } from "./gpt4all-embedder.ts";
import type { EvalQuery } from "./generate-eval-queries.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const EVAL_FILE = path.join(ROOT_DIR, "benchmarks/data/eval-queries.json");
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

// Simple CLI arg parser for --model=X
function getModelArg(): string | undefined {
  const modelArg = process.argv.find((arg) => arg.startsWith("--model="));
  return modelArg ? modelArg.split("=")[1] : undefined;
}

async function main() {
  if (!fs.existsSync(EVAL_FILE)) {
    console.error(`Evaluation file not found: ${EVAL_FILE}`);
    console.error(`Please run 'node ./benchmarks/rag/generate-eval-queries.ts' first.`);
    process.exit(1);
  }

  const queries: EvalQuery[] = JSON.parse(fs.readFileSync(EVAL_FILE, "utf-8"));
  
  if (queries.length === 0) {
    console.error("Evaluation file is empty.");
    return;
  }

  const modelArg = getModelArg();
  console.log(`Initializing Embedder with model: ${modelArg || "default"}`);
  
  let embedder: any;
  if (modelArg && (modelArg.includes(".gguf") || modelArg.includes("nomic"))) {
    embedder = Gpt4AllEmbedder.getInstance(modelArg);
  } else {
    embedder = Embedder.getInstance(modelArg);
  }
  
  await embedder.init();

  const store = new Store();

  let hitsTop1 = 0;
  let hitsTop3 = 0;
  let hitsTop5 = 0;
  let mrrSum = 0;

  console.log(`Running evaluation on ${queries.length} queries...\n`);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const vector = await embedder.embed(q.query);
    // Ask for top 5 so we can calculate MRR and top-k effectively
    const results = await store.search(vector, 5, 2.0); // maxDistance slightly higher to capture top 5

    // Find the rank (1-indexed) of the correct guideId
    const rankIndex = results.findIndex((r) => r.id === q.guideId);
    let rank = rankIndex !== -1 ? rankIndex + 1 : 0;

    if (rank === 1) hitsTop1++;
    if (rank > 0 && rank <= 3) hitsTop3++;
    if (rank > 0 && rank <= 5) hitsTop5++;
    if (rank > 0) mrrSum += 1.0 / rank;
  }

  const total = queries.length;
  const metrics: EvalRun = {
    timestamp: new Date().toISOString(),
    model: modelArg || "Xenova/all-MiniLM-L6-v2", // Fallback default name
    totalQueries: total,
    top1HitRate: +(hitsTop1 / total).toFixed(4),
    top3HitRate: +(hitsTop3 / total).toFixed(4),
    top5HitRate: +(hitsTop5 / total).toFixed(4),
    meanReciprocalRank: +(mrrSum / total).toFixed(4),
  };

  console.table([{
    Model: metrics.model,
    "Top-1 Hit %": (metrics.top1HitRate * 100).toFixed(1) + "%",
    "Top-3 Hit %": (metrics.top3HitRate * 100).toFixed(1) + "%",
    "MRR": metrics.meanReciprocalRank.toFixed(3)
  }]);

  // Load old results and append
  let history: EvalRun[] = [];
  if (fs.existsSync(RESULTS_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
    } catch {}
  }

  history.push(metrics);
  if (!fs.existsSync(path.dirname(RESULTS_FILE))) {
    fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  }
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(history, null, 2));

  console.log(`\nEvaluation complete. Results appended to ${RESULTS_FILE}`);
}

if (process.argv[1] === __filename) {
  main().catch(console.error);
}
