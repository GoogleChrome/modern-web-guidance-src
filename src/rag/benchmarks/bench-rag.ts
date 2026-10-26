import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { guidesDir, outDir, rootDir } from "../../core/paths.ts";
import {
  ensureWildDataset,
  filterDatasetBySplit,
  isRecord,
  loadPublicDataset,
  type LoadedDataset,
} from "./dataset.ts";
import {
  compareDatasetSummaries,
  summarizeDataset,
  type BootstrapDelta,
  type DatasetComparison,
  type DatasetSummary,
} from "./metrics.ts";
import type { EmbedderLike, UseCaseResult } from "../search.ts";

const HARNESS_SANITY_NDCG_FLOOR = 0.80;

interface TargetSpec {
  ref: string;
  label?: string;
}

function removeWorktree(dir: string): void {
  try {
    git(["worktree", "remove", "-f", dir]);
  } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}

interface EvaluateTargetOptions {
  limit: number;
  useCurrentGuides: boolean;
}

interface SearchModule {
  searchUseCases: (
    query: string,
    limit?: number,
    minSimilarity?: number,
    embedder?: EmbedderLike
  ) => Promise<UseCaseResult[]>;
}

function getSafeGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") {
      delete env[key];
    }
  }
  delete env.GIT_EXTERNAL_DIFF;
  delete env.GIT_PAGER;
  return env;
}

function git(args: string[], cwd = rootDir): string {
  return execFileSync("git", args, {
    cwd,
    env: getSafeGitEnv(),
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveRagDir(targetDir: string): string {
  const modern = path.join(targetDir, "src/rag");
  if (fs.existsSync(modern)) return modern;
  const legacy = path.join(targetDir, "serving/lib");
  if (fs.existsSync(legacy)) return legacy;
  throw new Error(`Could not locate src/rag or serving/lib in ${targetDir}`);
}

export function computeEmbedderHash(worktreePath = rootDir): string {
  const ragDir = resolveRagDir(worktreePath);
  const hash = crypto.createHash("sha256");
  const candidateFiles = [
    path.join(ragDir, "tfjs-embedder.ts"),
    path.join(ragDir, "tfjs-kernels.ts"),
    path.join(ragDir, "tfjs-kernels-precise.ts"),
    path.join(ragDir, "tfjs-model-minilm/model.json"),
    path.join(ragDir, "tfjs-model-minilm/tokenizer_config.json"),
    path.join(ragDir, "tfjs-model-minilm/tokenizer.json.gz"),
    path.join(ragDir, "tfjs-model-minilm/group1-shard1of1.bin"),
    path.join(ragDir, "tfjs_model_minilm/model.json"),
    path.join(ragDir, "tfjs_model_minilm/tokenizer_config.json"),
    path.join(ragDir, "tfjs_model_minilm/tokenizer.json.gz"),
    path.join(ragDir, "tfjs_model_minilm/group1-shard1of1.bin"),
  ];
  for (const file of candidateFiles) {
    try {
      const content = fs.readFileSync(file);
      hash.update(path.basename(file));
      hash.update(content);
    } catch {
      // Optional file not present in this checkout
    }
  }
  return hash.digest("hex").slice(0, 12);
}

function runEmbeddingWorker(targetDir: string, queries: string[]): Record<string, number[]> {
  const ragDir = resolveRagDir(targetDir);
  const embedderPath = path.join(ragDir, "tfjs-embedder.ts");
  const tmpInput = path.join(os.tmpdir(), `rag-bench-queries-${process.pid}-${Date.now()}.json`);
  const tmpOutput = path.join(os.tmpdir(), `rag-bench-vectors-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmpInput, JSON.stringify(queries), "utf-8");

  const workerScript = `
    import fs from "node:fs";
    import { TfjsEmbedder } from ${JSON.stringify(pathToFileURL(embedderPath).href)};
    const queries = JSON.parse(fs.readFileSync(${JSON.stringify(tmpInput)}, "utf-8"));
    const embedder = TfjsEmbedder.getInstance();
    const out = {};
    for (const q of queries) {
      out[q] = await embedder.embed(q);
    }
    fs.writeFileSync(${JSON.stringify(tmpOutput)}, JSON.stringify(out));
  `;

  try {
    execFileSync(process.execPath, ["--input-type=module", "-e", workerScript], {
      cwd: targetDir,
      env: getSafeGitEnv(),
      stdio: ["ignore", "inherit", "inherit"],
    });
    const parsed: unknown = JSON.parse(fs.readFileSync(tmpOutput, "utf-8"));
    const out: Record<string, number[]> = {};
    if (isRecord(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) out[k] = v.map(Number);
      }
    }
    return out;
  } finally {
    fs.rmSync(tmpInput, { force: true });
    fs.rmSync(tmpOutput, { force: true });
  }
}

function ensureQueryEmbeddings(targetDir: string, queries: string[]): Map<string, number[]> {
  const embedHash = computeEmbedderHash(targetDir);
  const cacheDir = path.join(outDir, "benchmarks");
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, `embed-cache-${embedHash}.json`);

  const cached: Record<string, number[]> = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    if (isRecord(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) cached[k] = v.map(Number);
      }
    }
  } catch {
    // Cache miss or unreadable cache file
  }

  const uniqueMissing = [...new Set(queries)].filter((q) => !Array.isArray(cached[q]));
  if (uniqueMissing.length > 0) {
    console.log(`Embedding ${uniqueMissing.length} uncached queries (embedder ${embedHash})...`);
    Object.assign(cached, runEmbeddingWorker(targetDir, uniqueMissing));
    fs.writeFileSync(cacheFile, JSON.stringify(cached), "utf-8");
  }

  const map = new Map<string, number[]>();
  for (const q of queries) {
    const vec = cached[q];
    if (!vec) throw new Error(`Missing cached embedding for query: ${q}`);
    map.set(q, vec);
  }
  return map;
}

function ensureWorktreeBuilt(targetDir: string, seedFromRoot = true): void {
  const modernBuildScript = path.join(targetDir, "src/build/build-guides.ts");
  const legacyBuildScript = path.join(targetDir, "serving/scripts/build-guides.ts");

  if (fs.existsSync(modernBuildScript)) {
    const targetCacheDir = path.join(targetDir, "out/build/skills-cli");
    const rootCacheDir = path.join(rootDir, "out/build/skills-cli");
    if (seedFromRoot && targetDir !== rootDir && !fs.existsSync(targetCacheDir) && fs.existsSync(rootCacheDir)) {
      fs.mkdirSync(path.dirname(targetCacheDir), { recursive: true });
      fs.cpSync(rootCacheDir, targetCacheDir, { recursive: true });
    }
    execFileSync(process.execPath, [modernBuildScript, "--target=skills-cli"], {
      cwd: targetDir,
      env: getSafeGitEnv(),
      stdio: ["ignore", "pipe", "inherit"],
    });
    return;
  }

  if (fs.existsSync(legacyBuildScript)) {
    execFileSync(process.execPath, [legacyBuildScript, "--target=skills-cli"], {
      cwd: targetDir,
      env: getSafeGitEnv(),
      stdio: ["ignore", "pipe", "inherit"],
    });
    return;
  }

  throw new Error(`No build-guides.ts found in ${targetDir}`);
}

function linkNodeModules(targetDir: string): void {
  const rootNm = path.join(rootDir, "node_modules");
  if (!fs.existsSync(rootNm)) return;

  const candidates = [
    path.join(targetDir, "node_modules"),
    ...(fs.existsSync(path.join(targetDir, "serving")) ? [path.join(targetDir, "serving/node_modules")] : []),
    ...(fs.existsSync(path.join(targetDir, "lib")) ? [path.join(targetDir, "lib/node_modules")] : []),
  ];
  for (const dest of candidates) {
    try {
      fs.symlinkSync(rootNm, dest, "dir");
    } catch {
      // Destination already exists
    }
  }
}

async function evaluateTarget(
  spec: TargetSpec,
  datasets: LoadedDataset[],
  options: EvaluateTargetOptions
): Promise<{ label: string; commit: string; summaries: Map<string, DatasetSummary> }> {
  const allQueryStrings = datasets.flatMap((d) => d.queries.map((q) => q.query));

  const isWorktree = spec.ref === "WORKTREE";
  let targetDir = rootDir;
  let commit = "";
  let label = spec.label ?? spec.ref;
  let cleanup = () => {};

  if (isWorktree) {
    commit = git(["rev-parse", "--short", "HEAD"]);
    label = `${label} (${commit})`;
    ensureWorktreeBuilt(rootDir, false);
  } else {
    const fullSha = git(["rev-parse", `${spec.ref}^{commit}`]);
    commit = fullSha.slice(0, 9);
    label = `${spec.ref} (${commit})`;
    targetDir = path.join(os.tmpdir(), `rag-bench-wt-${commit}-${process.pid}`);

    removeWorktree(targetDir);
    git(["worktree", "add", "--detach", targetDir, fullSha]);
    linkNodeModules(targetDir);

    if (options.useCurrentGuides) {
      const wtGuides = path.join(targetDir, "guides");
      fs.rmSync(wtGuides, { recursive: true, force: true });
      fs.cpSync(guidesDir, wtGuides, { recursive: true });
    }

    ensureWorktreeBuilt(targetDir, true);
    cleanup = () => removeWorktree(targetDir);
  }

  try {
    const embeddings = ensureQueryEmbeddings(targetDir, allQueryStrings);
    const embedder: EmbedderLike = {
      embed: async (q: string) => {
        const v = embeddings.get(q);
        if (!v) throw new Error(`Missing embedding for "${q}"`);
        return v;
      },
    };

    const searchPath = path.join(resolveRagDir(targetDir), "search.ts");
    const mod = (await import(pathToFileURL(searchPath).href)) as SearchModule;
    const summaries = new Map<string, DatasetSummary>();
    for (const ds of datasets) {
      const resultsByQid = new Map<string, UseCaseResult[]>();
      for (const q of ds.queries) {
        resultsByQid.set(q.qid, await mod.searchUseCases(q.query, options.limit, undefined, embedder));
      }
      summaries.set(ds.name, summarizeDataset(ds, resultsByQid, options.limit));
    }
    return { label, commit, summaries };
  } finally {
    cleanup();
  }
}

function fmtPct(v: number | undefined): string {
  return v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number | undefined, digits = 3): string {
  return v === undefined ? "—" : v.toFixed(digits);
}

function fmtTok(v: number | undefined): string {
  return v === undefined ? "—" : `${Math.round(v).toLocaleString("en-US")}`;
}

function fmtSigned(diff: number, fmtAbs: (v: number) => string, suffix = ""): string {
  return `${diff >= 0 ? "+" : "-"}${fmtAbs(Math.abs(diff))}${suffix}`;
}

function fmtBootstrapDelta(d: BootstrapDelta, fmtVal: (v: number) => string, suffix = ""): string {
  const main = fmtSigned(d.delta, fmtVal, suffix);
  const low = fmtSigned(d.ciLow, fmtVal);
  const high = fmtSigned(d.ciHigh, fmtVal);
  return `${main} [${low}, ${high}]${d.significant ? " *" : ""}`;
}

export function renderSingleMarkdown(
  label: string,
  summaries: DatasetSummary[],
  datasets?: LoadedDataset[]
): string {
  const lines: string[] = [];
  lines.push(`### RAG Benchmark — \`${label}\``);
  if (datasets && datasets.length > 0) {
    const provLines = datasets
      .filter((d) => d.manifest)
      .map((d) => {
        const qrelsSha = d.manifest?.files["wild-qrels.jsonl"]?.sha256;
        return `- **${d.name}**: version \`${d.manifest?.version}\`${qrelsSha ? `, qrels SHA-256: \`${qrelsSha}\`` : ""}${d.manifest?.window ? `, window: \`${d.manifest?.window}\`` : ""}`;
      });
    if (provLines.length > 0) {
      lines.push("");
      lines.push(...provLines);
    }
  }
  lines.push("");
  lines.push(
    "| Dataset | Queries (Ans / OOS) | nDCG@5 | Success@1 | Hit@1 (g=2) | MRR@5 | Recall@5 | LeafRecall@5 | Disc@1 | Expected@1 | Avg Guides | Avg Tokens (Ans) | Empty% (Ans) | OOS Admit% (Near / Far) | Avg OOS Tokens | Unjudged% |"
  );
  lines.push(
    "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |"
  );

  for (const s of summaries) {
    const oosDetail =
      s.oosQueries > 0
        ? s.oosNearAdmitRate !== undefined || s.oosFarAdmitRate !== undefined
          ? `${fmtPct(s.oosAdmitRate)} (${fmtPct(s.oosNearAdmitRate)} / ${fmtPct(s.oosFarAdmitRate)})`
          : fmtPct(s.oosAdmitRate)
        : "—";
    lines.push(
      `| **${s.dataset}** | ${s.totalQueries} (${s.answerableQueries} / ${s.oosQueries}) | **${s.answerableQueries > 0 ? fmtNum(s.ndcg5) : "—"}** | ${s.answerableQueries > 0 ? fmtPct(s.success1) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.hit1) : "—"} | ${s.answerableQueries > 0 ? fmtNum(s.mrr5) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.recall5) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.leafRecall5) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.disciplineTop1Rate) : "—"} | ${fmtPct(s.expectedHit1)} | ${s.answerableQueries > 0 ? s.avgReturnedCount.toFixed(2) : "—"} | ${s.answerableQueries > 0 ? fmtTok(s.avgTokensAnswerable) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.answerableEmptyRate) : "—"} | ${oosDetail} | ${s.oosQueries > 0 ? fmtTok(s.avgOosTokens) : "—"} | ${s.answerableQueries > 0 ? fmtPct(s.unjudgedRate) : "—"} |`
    );
  }
  return lines.join("\n");
}

export function renderComparisonMarkdown(
  baseLabel: string,
  headLabel: string,
  comparisons: DatasetComparison[],
  datasets?: LoadedDataset[]
): string {
  const lines: string[] = [];
  lines.push(`### RAG Benchmark A/B — \`${baseLabel}\` → \`${headLabel}\``);
  if (datasets && datasets.length > 0) {
    const provLines = datasets
      .filter((d) => d.manifest)
      .map((d) => {
        const qrelsSha = d.manifest?.files["wild-qrels.jsonl"]?.sha256;
        return `- **${d.name}**: version \`${d.manifest?.version}\`${qrelsSha ? `, qrels SHA-256: \`${qrelsSha}\`` : ""}${d.manifest?.window ? `, window: \`${d.manifest?.window}\`` : ""}`;
      });
    if (provLines.length > 0) {
      lines.push("");
      lines.push(...provLines);
    }
  }
  lines.push("");

  const ppFmt = (v: number) => (v * 100).toFixed(1);
  const num3Fmt = (v: number) => v.toFixed(3);
  const num2Fmt = (v: number) => v.toFixed(2);
  const tokFmt = (v: number) => `${Math.round(v)}`;

  for (const c of comparisons) {
    const b = c.base;
    const h = c.head;
    lines.push(`#### Dataset: \`${c.dataset}\` (${b.totalQueries} queries: ${b.answerableQueries} answerable, ${b.oosQueries} OOS)`);
    lines.push("");
    lines.push(`| Metric | Base (\`${baseLabel}\`) | Head (\`${headLabel}\`) | Delta (95% Bootstrap CI) |`);
    lines.push("| :--- | :---: | :---: | :---: |");
    if (b.answerableQueries > 0) {
      lines.push(`| **nDCG@5** | ${fmtNum(b.ndcg5)} | **${fmtNum(h.ndcg5)}** | ${fmtBootstrapDelta(c.ndcg5Delta, num3Fmt)} |`);
      lines.push(`| **Success@1 (grade ≥ 1)** | ${fmtPct(b.success1)} | **${fmtPct(h.success1)}** | ${fmtBootstrapDelta(c.success1Delta, ppFmt, "pp")} |`);
      lines.push(`| **Hit@1 (grade = 2)** | ${fmtPct(b.hit1)} | **${fmtPct(h.hit1)}** | ${fmtSigned(h.hit1 - b.hit1, ppFmt, "pp")} |`);
      lines.push(`| **MRR@5** | ${fmtNum(b.mrr5)} | **${fmtNum(h.mrr5)}** | ${fmtSigned(h.mrr5 - b.mrr5, num3Fmt)} |`);
      lines.push(`| **Recall@5** | ${fmtPct(b.recall5)} | **${fmtPct(h.recall5)}** | ${fmtSigned(h.recall5 - b.recall5, ppFmt, "pp")} |`);
      if (c.leafRecall5Delta) {
        lines.push(`| **LeafRecall@5** | ${fmtPct(b.leafRecall5)} | **${fmtPct(h.leafRecall5)}** | ${fmtBootstrapDelta(c.leafRecall5Delta, ppFmt, "pp")} |`);
      } else if (b.leafRecall5 !== undefined && h.leafRecall5 !== undefined) {
        lines.push(`| **LeafRecall@5** | ${fmtPct(b.leafRecall5)} | **${fmtPct(h.leafRecall5)}** | ${fmtSigned(h.leafRecall5 - b.leafRecall5, ppFmt, "pp")} |`);
      }
      lines.push(`| **Disc@1** | ${fmtPct(b.disciplineTop1Rate)} | **${fmtPct(h.disciplineTop1Rate)}** | ${fmtBootstrapDelta(c.disciplineTop1Delta, ppFmt, "pp")} |`);
      if (b.expectedHit1 !== undefined && h.expectedHit1 !== undefined) {
        lines.push(`| **Expected Guide@1** | ${fmtPct(b.expectedHit1)} | **${fmtPct(h.expectedHit1)}** | ${fmtSigned(h.expectedHit1 - b.expectedHit1, ppFmt, "pp")} |`);
      }
      lines.push(`| **Avg Guides Returned (Ans)** | ${b.avgReturnedCount.toFixed(2)} | ${h.avgReturnedCount.toFixed(2)} | ${fmtSigned(h.avgReturnedCount - b.avgReturnedCount, num2Fmt)} |`);
      lines.push(`| **Avg Tokens / Query (Ans)** | ${fmtTok(b.avgTokensAnswerable)} | **${fmtTok(h.avgTokensAnswerable)}** | ${fmtBootstrapDelta(c.tokensAnswerableDelta, tokFmt)} |`);
      lines.push(`| **Answerable → Empty (\`[]\`)** | ${fmtPct(b.answerableEmptyRate)} | **${fmtPct(h.answerableEmptyRate)}** | ${fmtSigned(h.answerableEmptyRate - b.answerableEmptyRate, ppFmt, "pp")} |`);
      lines.push(`| **Unjudged Returned Rate** | ${fmtPct(b.unjudgedRate)} | ${fmtPct(h.unjudgedRate)} | ${fmtSigned(h.unjudgedRate - b.unjudgedRate, ppFmt, "pp")} |`);
      lines.push(`| **Query Wins / Losses / Ties** (ΔnDCG ≥ 0.05) | — | — | **+${c.wins}W / -${c.losses}L / ${c.ties}T** |`);
    }
    if (b.oosQueries > 0 && c.oosAdmitDelta) {
      lines.push(`| **OOS Admitted (False Positive %)** | ${fmtPct(b.oosAdmitRate)} | **${fmtPct(h.oosAdmitRate)}** | ${fmtBootstrapDelta(c.oosAdmitDelta, ppFmt, "pp")} |`);
      if (b.oosNearAdmitRate !== undefined && h.oosNearAdmitRate !== undefined) {
        lines.push(`| **OOS Near-Miss Admitted %** | ${fmtPct(b.oosNearAdmitRate)} | **${fmtPct(h.oosNearAdmitRate)}** | ${fmtSigned(h.oosNearAdmitRate - b.oosNearAdmitRate, ppFmt, "pp")} |`);
      }
      if (b.oosFarAdmitRate !== undefined && h.oosFarAdmitRate !== undefined) {
        lines.push(`| **OOS Far Admitted %** | ${fmtPct(b.oosFarAdmitRate)} | **${fmtPct(h.oosFarAdmitRate)}** | ${fmtSigned(h.oosFarAdmitRate - b.oosFarAdmitRate, ppFmt, "pp")} |`);
      }
      lines.push(`| **Avg Wasted Tokens / OOS Query** | ${fmtTok(b.avgOosTokens)} | **${fmtTok(h.avgOosTokens)}** | ${fmtSigned(h.avgOosTokens - b.avgOosTokens, tokFmt)} |`);
    }
    lines.push("");

    if (c.topWins.length > 0) {
      lines.push(`Top query improvements (\`${c.dataset}\`):`);
      for (const w of c.topWins) {
        lines.push(
          `- \`${w.qid}\` (${fmtNum(w.baseNdcg5)} → **${fmtNum(w.headNdcg5)}**, Δ+${fmtNum(w.deltaNdcg5)}): "${w.query}" — \`[${w.baseIds.slice(0, 3).join(", ")}]\` → \`[${w.headIds.slice(0, 3).join(", ")}]\``
        );
      }
      lines.push("");
    }
    if (c.topLosses.length > 0) {
      lines.push(`Top query regressions (\`${c.dataset}\`):`);
      for (const l of c.topLosses) {
        lines.push(
          `- \`${l.qid}\` (${fmtNum(l.baseNdcg5)} → **${fmtNum(l.headNdcg5)}**, Δ${fmtNum(l.deltaNdcg5)}): "${l.query}" — \`[${l.baseIds.slice(0, 3).join(", ")}]\` → \`[${l.headIds.slice(0, 3).join(", ")}]\``
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function loadRequestedDatasets(
  names: string[],
  explicitWild: boolean,
  options: { wildVersion?: string; split?: string } = {}
): Promise<LoadedDataset[]> {
  const loaded: LoadedDataset[] = [];
  for (const name of names) {
    if (name === "harness" || name === "oos") {
      loaded.push(loadPublicDataset(name));
    } else if (name === "wild") {
      try {
        let wild = await ensureWildDataset(options.wildVersion);
        if (options.split && options.split !== "all") {
          if (options.split !== "dev" && options.split !== "test") {
            throw new Error(`Invalid --split "${options.split}". Expected "dev", "test", or "all".`);
          }
          wild = filterDatasetBySplit(wild, options.split);
        }
        loaded.push(wild);
      } catch (err) {
        if (explicitWild) throw err;
        console.warn(
          `[benchmark:rag] Skipping private 'wild' dataset (${err instanceof Error ? err.message : String(err)}). Running public datasets only.`
        );
      }
    } else {
      throw new Error(`Unknown dataset "${name}". Expected one of: wild, harness, oos.`);
    }
  }
  return loaded;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      datasets: { type: "string" },
      "public-only": { type: "boolean", default: false },
      ci: { type: "boolean", default: false },
      base: { type: "string" },
      head: { type: "string" },
      limit: { type: "string", default: "5" },
      "max-unjudged": { type: "string", default: "0.10" },
      "use-current-guides": { type: "boolean", default: false },
      json: { type: "string" },
      markdown: { type: "string" },
      split: { type: "string", default: "all" },
      "wild-version": { type: "string" },
    },
  });

  const evalOpts: EvaluateTargetOptions = {
    limit: parseInt(values.limit ?? "5", 10),
    useCurrentGuides: Boolean(values["use-current-guides"]),
  };
  const maxUnjudged = parseFloat(values["max-unjudged"] ?? "0.10");
  const isPublicOnly = Boolean(values["public-only"] || values.ci);
  const explicitDatasets = values.datasets
    ? values.datasets.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const datasetNames = explicitDatasets ?? (isPublicOnly ? ["harness", "oos"] : ["wild", "harness", "oos"]);
  const explicitWild = Boolean(explicitDatasets?.includes("wild"));

  const datasets = await loadRequestedDatasets(datasetNames, explicitWild, {
    wildVersion: values["wild-version"],
    split: values.split,
  });
  if (datasets.length === 0) {
    throw new Error("No benchmark datasets loaded.");
  }

  const headRef = values.head ?? "WORKTREE";
  const headSpec: TargetSpec = { ref: headRef, label: headRef };

  if (!values.base) {
    await runSingleBenchmark(headSpec, datasets, evalOpts, values, maxUnjudged);
  } else {
    const baseSpec: TargetSpec = { ref: values.base, label: values.base };
    await runComparisonBenchmark(baseSpec, headSpec, datasets, evalOpts, values);
  }
}

function stripPerQuery(summary: DatasetSummary): Omit<DatasetSummary, "perQuery"> {
  const { perQuery: _pq, ...rest } = summary;
  return rest;
}

async function runSingleBenchmark(
  headSpec: TargetSpec,
  datasets: LoadedDataset[],
  evalOpts: EvaluateTargetOptions,
  values: { markdown?: string; json?: string; ci?: boolean },
  maxUnjudged: number
): Promise<void> {
  const headEval = await evaluateTarget(headSpec, datasets, evalOpts);
  const summaries = datasets.map((d) => {
    const s = headEval.summaries.get(d.name);
    if (!s) throw new Error(`Missing summary for ${d.name}`);
    return s;
  });

  const md = renderSingleMarkdown(headEval.label, summaries, datasets);
  console.log(`\n${md}\n`);

  if (values.markdown) {
    fs.writeFileSync(values.markdown, `${md}\n`, "utf-8");
  }
  if (values.json) {
    fs.writeFileSync(
      values.json,
      JSON.stringify({ target: headEval.label, summaries: summaries.map(stripPerQuery) }, null, 2),
      "utf-8"
    );
  }

  if (values.ci) {
    const failures: string[] = [];
    for (const s of summaries) {
      if (s.answerableQueries > 0 && s.unjudgedRate > maxUnjudged) {
        failures.push(
          `Dataset '${s.dataset}' unjudged rate ${(s.unjudgedRate * 100).toFixed(1)}% exceeds max ${(maxUnjudged * 100).toFixed(1)}%. Run 'node src/rag/benchmarks/judge-fill.ts' to grade newly surfaced guides.`
        );
      }
      if (s.dataset === "harness" && s.ndcg5 < HARNESS_SANITY_NDCG_FLOOR) {
        failures.push(
          `Dataset 'harness' nDCG@5 (${s.ndcg5.toFixed(3)}) fell below sanity floor ${HARNESS_SANITY_NDCG_FLOOR.toFixed(3)}.`
        );
      }
    }
    if (failures.length > 0) {
      for (const f of failures) console.error(`[benchmark:rag CI FAIL] ${f}`);
      process.exit(1);
    }
  }
}

async function runComparisonBenchmark(
  baseSpec: TargetSpec,
  headSpec: TargetSpec,
  datasets: LoadedDataset[],
  evalOpts: EvaluateTargetOptions,
  values: { markdown?: string; json?: string }
): Promise<void> {
  const baseEval = await evaluateTarget(baseSpec, datasets, evalOpts);
  const headEval = await evaluateTarget(headSpec, datasets, evalOpts);

  const comparisons: DatasetComparison[] = [];
  for (const ds of datasets) {
    const b = baseEval.summaries.get(ds.name);
    const h = headEval.summaries.get(ds.name);
    if (!b || !h) throw new Error(`Missing summary for ${ds.name}`);
    comparisons.push(compareDatasetSummaries(b, h));
  }

  const md = renderComparisonMarkdown(baseEval.label, headEval.label, comparisons, datasets);
  console.log(`\n${md}\n`);

  if (values.markdown) {
    fs.writeFileSync(values.markdown, `${md}\n`, "utf-8");
  }
  if (values.json) {
    fs.writeFileSync(
      values.json,
      JSON.stringify(
        {
          base: baseEval.label,
          head: headEval.label,
          comparisons: comparisons.map((c) => ({
            ...c,
            base: stripPerQuery(c.base),
            head: stripPerQuery(c.head),
          })),
        },
        null,
        2
      ),
      "utf-8"
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
