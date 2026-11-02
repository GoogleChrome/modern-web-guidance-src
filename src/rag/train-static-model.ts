/**
 * Distills and trains the 256-d static word-embedding model (`src/rag/static-model/`)
 * from `gemini-embedding-001` using a Model2Vec + Tokenlearn recipe:
 *
 * 1. Vocabulary construction: unions existing `src/rag/static-model/words.json` (which
 *    includes general-English whole words and domain aliases) with all tokens found across
 *    current `guides/` markdown chunks.
 * 2. Teacher word distillation: embeds each vocabulary word with `gemini-embedding-001`
 *    (`RETRIEVAL_QUERY`, 768-d, cached incrementally in `out/static-model-cache/`) and
 *    MRL-truncates + L2-normalizes to 256 dimensions (`E0`).
 * 3. Corpus IDF weighting (`idfcap`): weights words by corpus chunk document frequency
 *    `log(1 + (N - df + 0.5) / (df + 0.5))`, capping non-corpus general-English words at
 *    the median corpus IDF (`W0`).
 * 4. Tokenlearn refinement: fits `(E, W)` via 12 epochs of Adagrad on cosine loss against
 *    `gemini-embedding-001` embeddings of training queries (guide titles/headings/descriptions
 *    plus optional `--extra-queries <jsonl>`), with L2 regularization (`MU = 0.05`) pulling
 *    toward `(E0, W0)`. All evaluation queries (`harness`, `oos`, `wild`) are strictly excluded.
 * 5. Quantization: symmetric per-row `Int8` quantization of `E` (`words.i8`) with row scales
 *    folded into `W` (`words.scale.f32`).
 *
 * Usage:
 *   node src/rag/train-static-model.ts [--extra-queries path/to/train-queries.jsonl] [--skip-tokenlearn]
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import matter from "@11ty/gray-matter";
import { marked, type Tokens } from "marked";
import {
  extractH1Heading,
  getGuideMarkdownPath,
  isDraftStub,
  scanAllGuides,
  stripAllComments,
} from "../core/guide-validation.ts";
import { replaceMacros } from "../core/macros.ts";
import { outDir, rootDir } from "../core/paths.ts";
import { config } from "../core/skills-config.ts";
import { chunkMarkdown } from "../build/build-guides.ts";
import { tokenize } from "./bm25.ts";
import { dotProduct } from "./search.ts";
import {
  accumulateNormalizedVector,
  encodeTokens,
  STATIC_EMBEDDING_DIMS,
} from "./static-embedder.ts";

const TEACHER_DIM = 768;
const DEFAULT_TEACHER_MODEL = "gemini-embedding-001";
const DEFAULT_OUT_DIR = path.join(rootDir, "src/rag/static-model");
const DEFAULT_CACHE_DIR = path.join(outDir, "static-model-cache");

export interface QuantizeExportResult {
  vocabSize: number;
  dims: number;
  minCosine: number;
  maxAbsDiff: number;
}

/**
 * Quantizes Float32 word vectors `E` (V × 256) to symmetric per-row `Int8` (`words.i8`)
 * and folds each row's `maxAbs / 127` scale factor into the per-word weight `W` (`words.scale.f32`).
 */
export function quantizeAndExportStaticModel(
  words: string[],
  E: Float32Array,
  W: Float32Array,
  targetDir = DEFAULT_OUT_DIR
): QuantizeExportResult {
  const V = words.length;
  const D = STATIC_EMBEDDING_DIMS;
  if (E.length !== V * D) {
    throw new Error(`Expected E of length ${V * D}, got ${E.length}`);
  }
  if (W.length !== V) {
    throw new Error(`Expected W of length ${V}, got ${W.length}`);
  }

  const qTable = new Int8Array(V * D);
  const foldedScales = new Float32Array(V);

  for (let i = 0; i < V; i++) {
    let maxAbs = 0;
    const rowOffset = i * D;
    for (let k = 0; k < D; k++) {
      const abs = Math.abs(E[rowOffset + k]);
      if (abs > maxAbs) maxAbs = abs;
    }
    const rowScale = maxAbs > 0 ? maxAbs / 127 : 1;
    foldedScales[i] = W[i] * rowScale;

    for (let k = 0; k < D; k++) {
      const q = Math.round(E[rowOffset + k] / rowScale);
      qTable[rowOffset + k] = Math.max(-127, Math.min(127, q));
    }
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "words.json"), JSON.stringify(words));
  fs.writeFileSync(
    path.join(targetDir, "words.i8"),
    Buffer.from(qTable.buffer, qTable.byteOffset, qTable.byteLength)
  );
  fs.writeFileSync(
    path.join(targetDir, "words.scale.f32"),
    Buffer.from(foldedScales.buffer, foldedScales.byteOffset, foldedScales.byteLength)
  );

  const wordIndex = new Map(words.map((w, i) => [w, i]));
  let minCosine = 1;
  let maxAbsDiff = 0;

  const sampleCount = Math.min(25, Math.floor(V / 4));
  for (let sIdx = 0; sIdx < sampleCount; sIdx++) {
    const indices = [
      (sIdx * 97) % V,
      (sIdx * 97 + 1) % V,
      (sIdx * 97 + 2) % V,
    ].filter((idx) => W[idx] > 0);
    if (indices.length === 0) continue;

    const queryText = indices.map((idx) => words[idx]).join(" ");
    const enc = encodeTokens(queryText, wordIndex);
    if (enc.length === 0) continue;

    const fVec = accumulateNormalizedVector(enc, E, W);
    const qVec = accumulateNormalizedVector(enc, qTable, foldedScales);
    const cos = dotProduct(fVec, qVec);
    if (cos < minCosine) minCosine = cos;

    for (let k = 0; k < D; k++) {
      const diff = Math.abs(fVec[k] - qVec[k]);
      if (diff > maxAbsDiff) maxAbsDiff = diff;
    }
  }

  return { vocabSize: V, dims: D, minCosine, maxAbsDiff };
}

function normQuery(q: string): string {
  return q.trim().toLowerCase().split(/\s+/).join(" ");
}

function loadExcludedEvalQueries(): Set<string> {
  const excluded = new Set<string>();
  const candidateFiles = [
    path.join(rootDir, "src/rag/benchmarks/data/harness-queries.jsonl"),
    path.join(rootDir, "src/rag/benchmarks/data/oos-queries.jsonl"),
    path.join(outDir, "benchmarks/wild/v1/wild-queries.jsonl"),
  ];
  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { query?: string };
        if (typeof parsed.query === "string") {
          excluded.add(normQuery(parsed.query));
        }
      } catch {
        // Ignore malformed lines
      }
    }
  }
  return excluded;
}

interface CorpusScan {
  chunkTexts: string[];
  syntheticQueries: string[];
}

function scanCorpusAndSyntheticQueries(): CorpusScan {
  const excludedGuides = config.monoskill.excludeFromBundling || [];
  const readyGuides = scanAllGuides().filter(
    (inv) => inv.isPublished && !excludedGuides.includes(inv.category) && !excludedGuides.includes(inv.name)
  );

  const chunkTexts: string[] = [];
  const syntheticQueries: string[] = [];

  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    const raw = fs.readFileSync(guidePath, "utf8");
    const { data, content: markdownBody } = matter(raw);
    if (stripAllComments(markdownBody).trim().length === 0 || isDraftStub(data.draft)) {
      continue;
    }
    const description = typeof data.description === "string" ? data.description.trim() : "";
    const processed = replaceMacros(markdownBody, guidePath, { target: "skills-cli" });
    const title = extractH1Heading(processed) || inv.name.replace(/-/g, " ");
    const summaryChunk = `# ${title}\n\n${description}`;
    const chunks = [...chunkMarkdown(processed), summaryChunk];

    for (const chunk of chunks) {
      chunkTexts.push(`${description}\n\n${chunk}`);
    }

    syntheticQueries.push(inv.name.replace(/-/g, " "));
    syntheticQueries.push(title);
    if (description) syntheticQueries.push(description);

    const headings = marked
      .lexer(processed)
      .filter((t): t is Tokens.Heading => t.type === "heading" && (t.depth === 2 || t.depth === 3))
      .map((t) => t.text.trim());
    for (const h of headings) {
      syntheticQueries.push(h);
      syntheticQueries.push(`${title} ${h}`);
    }
  }

  return { chunkTexts, syntheticQueries };
}

function isBatchEmbeddingResponse(
  val: unknown
): val is { embeddings: Array<{ values: number[] }> } {
  if (typeof val !== "object" || val === null || !("embeddings" in val)) return false;
  const emb = (val as { embeddings: unknown }).embeddings;
  return (
    Array.isArray(emb) &&
    emb.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "values" in item &&
        Array.isArray((item as { values: unknown }).values)
    )
  );
}

async function postWithRetry(url: string, body: unknown): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));

    if (!(res instanceof Error) && res.ok) {
      return res.json();
    }
    const is429 = !(res instanceof Error) && res.status === 429;
    const status =
      res instanceof Error ? res.message : `${res.status} ${(await res.text()).slice(0, 300)}`;
    if (attempt >= 20) {
      throw new Error(`Gemini embedding HTTP failed after ${attempt} attempts: ${status}`);
    }
    await new Promise((r) => setTimeout(r, is429 ? 15_000 : 1_500 * attempt));
  }
}

async function embedWithTeacher(
  texts: string[],
  cacheName: string,
  apiKey: string,
  teacherModel: string,
  cacheDir: string
): Promise<Map<string, Float32Array>> {
  fs.mkdirSync(cacheDir, { recursive: true });
  const idxPath = path.join(cacheDir, `${cacheName}.json`);
  const binPath = path.join(cacheDir, `${cacheName}.f32`);

  const known: string[] = fs.existsSync(idxPath)
    ? (JSON.parse(fs.readFileSync(idxPath, "utf8")) as string[])
    : [];
  const raw = fs.existsSync(binPath) ? fs.readFileSync(binPath) : Buffer.alloc(0);
  if (raw.byteLength !== known.length * TEACHER_DIM * 4) {
    throw new Error(
      `${cacheName}: cache index (${known.length}) and binary (${raw.byteLength}B) mismatch; delete ${idxPath} and ${binPath}`
    );
  }
  const bin = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const out = new Map<string, Float32Array>();
  known.forEach((t, i) => out.set(t, bin.subarray(i * TEACHER_DIM, (i + 1) * TEACHER_DIM)));

  const todo = [...new Set(texts)].filter((t) => !out.has(t));
  if (todo.length === 0) {
    return out;
  }

  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += 100) {
    batches.push(todo.slice(i, i + 100));
  }

  const save = () => {
    const all = [...out.keys()];
    const buf = new Float32Array(all.length * TEACHER_DIM);
    all.forEach((t, i) => {
      const vec = out.get(t);
      if (vec) buf.set(vec, i * TEACHER_DIM);
    });
    fs.writeFileSync(`${binPath}.tmp`, Buffer.from(buf.buffer));
    fs.writeFileSync(`${idxPath}.tmp`, JSON.stringify(all));
    fs.renameSync(`${binPath}.tmp`, binPath);
    fs.renameSync(`${idxPath}.tmp`, idxPath);
  };

  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const res = await postWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${teacherModel}:batchEmbedContents?key=${apiKey}`,
          {
            requests: batch.map((t) => ({
              model: `models/${teacherModel}`,
              content: { parts: [{ text: t.slice(0, 6000) }] },
              taskType: "RETRIEVAL_QUERY",
              outputDimensionality: TEACHER_DIM,
            })),
          }
        );
        if (!isBatchEmbeddingResponse(res)) {
          throw new Error(`Invalid batchEmbedContents response shape from ${teacherModel}`);
        }

        res.embeddings.forEach((e, i) => {
          const v = Float32Array.from(e.values);
          const n = Math.hypot(...v) || 1;
          for (let k = 0; k < TEACHER_DIM; k++) v[k] /= n;
          out.set(batch[i], v);
        });
        done++;
        if (done % 10 === 0 || done === batches.length) {
          console.log(`  [${cacheName}] ${done}/${batches.length} batches embedded`);
        }
        if (done % 50 === 0) save();
      }
    })
  );

  save();
  return out;
}

function truncateAndNormalize256(v: Float32Array): Float32Array {
  const t = v.slice(0, STATIC_EMBEDDING_DIMS);
  const n = Math.hypot(...t) || 1;
  for (let k = 0; k < STATIC_EMBEDDING_DIMS; k++) t[k] /= n;
  return t;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "extra-queries": { type: "string" },
      "cache-dir": { type: "string" },
      "out-dir": { type: "string" },
      teacher: { type: "string", default: DEFAULT_TEACHER_MODEL },
      "skip-tokenlearn": { type: "boolean", default: false },
    },
  });

  try {
    process.loadEnvFile(path.join(rootDir, ".env"));
  } catch {
    // .env is optional if GEMINI_API_KEY is already in environment
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required in .env or environment to distill teacher embeddings.");
  }

  const teacherModel = values.teacher ?? DEFAULT_TEACHER_MODEL;
  const cacheDir = values["cache-dir"] ? path.resolve(values["cache-dir"]) : DEFAULT_CACHE_DIR;
  const targetDir = values["out-dir"] ? path.resolve(values["out-dir"]) : DEFAULT_OUT_DIR;

  console.log("Scanning guides corpus and existing vocabulary...");
  const { chunkTexts, syntheticQueries } = scanCorpusAndSyntheticQueries();

  const existingWordsPath = path.join(targetDir, "words.json");
  const existingWords: string[] = fs.existsSync(existingWordsPath)
    ? (JSON.parse(fs.readFileSync(existingWordsPath, "utf8")) as string[])
    : [];

  const df = new Map<string, number>();
  const vocabSet = new Set<string>(existingWords);
  for (const text of chunkTexts) {
    const toks = tokenize(text);
    for (const t of toks) vocabSet.add(t);
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const extraQueries: string[] = [];
  if (values["extra-queries"]) {
    const extraPath = path.resolve(values["extra-queries"]);
    const raw = fs.readFileSync(extraPath, "utf8").trim();
    if (extraPath.endsWith(".jsonl")) {
      for (const line of raw.split("\n").filter(Boolean)) {
        const row = JSON.parse(line) as { query?: string } | string;
        const q = typeof row === "string" ? row : row.query;
        if (q) extraQueries.push(q.trim());
      }
    } else {
      const parsed = JSON.parse(raw) as Record<string, string[]> | string[];
      const flat = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
      for (const q of flat) {
        if (typeof q === "string") extraQueries.push(q.trim());
      }
    }
  }

  const words = [...vocabSet].sort();
  const V = words.length;
  const wordIndex = new Map(words.map((w, i) => [w, i]));
  console.log(`Vocabulary: ${V} words (${df.size} present in current guide chunks).`);

  console.log(`Embedding vocabulary with teacher (${teacherModel})...`);
  const wordVecs = await embedWithTeacher(words, "teacher-words-q", apiKey, teacherModel, cacheDir);

  const D = STATIC_EMBEDDING_DIMS;
  const E0 = new Float32Array(V * D);
  for (let i = 0; i < V; i++) {
    const full = wordVecs.get(words[i]);
    if (!full) throw new Error(`Missing teacher word embedding for "${words[i]}"`);
    E0.set(truncateAndNormalize256(full), i * D);
  }

  const NC = chunkTexts.length;
  const idfOf = (d: number) => Math.log(1 + (NC - d + 0.5) / (d + 0.5));
  const corpusIdfs = [...df.values()].map(idfOf).sort((a, b) => a - b);
  const medianIdf = corpusIdfs[Math.floor(corpusIdfs.length / 2)] ?? 1;
  const W0 = Float32Array.from(words, (w) => {
    const docFreq = df.get(w);
    return docFreq !== undefined ? idfOf(docFreq) : medianIdf;
  });

  const E = E0.slice();
  const W = W0.slice();

  if (!values["skip-tokenlearn"]) {
    const excluded = loadExcludedEvalQueries();
    const allTrainCandidates = [...new Set([...syntheticQueries, ...extraQueries])].filter(
      (q) => q && !excluded.has(normQuery(q)) && q.split(/\s+/).length <= 40
    );
    console.log(
      `Embedding ${allTrainCandidates.length} training queries with ${teacherModel} (excluded ${excluded.size} eval queries)...`
    );
    const teacherTrain = await embedWithTeacher(
      allTrainCandidates,
      "tokenlearn-train-q",
      apiKey,
      teacherModel,
      cacheDir
    );

    let seed = 7;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

    const data: Array<{ enc: Array<[number, number]>; tgt: Float32Array }> = [];
    for (const t of allTrainCandidates) {
      const enc = encodeTokens(t, wordIndex);
      const rawVec = teacherTrain.get(t);
      if (enc.length > 0 && rawVec) {
        data.push({ enc, tgt: truncateAndNormalize256(rawVec) });
      }
    }

    const shuffled = data
      .map((x) => ({ x, r: rand() }))
      .sort((a, b) => a.r - b.r)
      .map(({ x }) => x);

    const valSize = Math.min(2000, Math.max(100, Math.floor(shuffled.length * 0.1)));
    const val = shuffled.slice(0, valSize);
    const train = shuffled.slice(valSize);

    const gE = new Float32Array(V * D).fill(1e-4);
    const gW = new Float32Array(V).fill(1e-4);
    const LR_E = 0.01;
    const LR_W = 0.01;
    const MU = 0.05;
    const scratchVec = new Float32Array(D);
    const gradVec = new Float32Array(D);

    const fidelity = (set: typeof val) =>
      set.reduce(
        (acc, x) => acc + dotProduct(accumulateNormalizedVector(x.enc, E, W, scratchVec), x.tgt),
        0
      ) / set.length;

    let bestVal = fidelity(val);
    let bestE = E.slice();
    let bestW = W.slice();
    console.log(
      `Tokenlearn fit (${train.length} train / ${val.length} val): initial val cosine = ${bestVal.toFixed(4)}`
    );

    for (let epoch = 1; epoch <= 12; epoch++) {
      const epochTrain = train
        .map((t) => ({ t, r: rand() }))
        .sort((a, b) => a.r - b.r)
        .map(({ t }) => t);

      for (const x of epochTrain) {
        scratchVec.fill(0);
        for (const [i, f] of x.enc) {
          const wt = W[i] * f;
          for (let k = 0; k < D; k++) scratchVec[k] += wt * E[i * D + k];
        }
        let n = 0;
        for (let k = 0; k < D; k++) n += scratchVec[k] * scratchVec[k];
        n = Math.sqrt(n) || 1;
        let c = 0;
        for (let k = 0; k < D; k++) c += (scratchVec[k] / n) * x.tgt[k];
        for (let k = 0; k < D; k++) gradVec[k] = -(x.tgt[k] - c * (scratchVec[k] / n)) / n;

        for (const [i, f] of x.enc) {
          let gw = 0;
          const wt = W[i] * f;
          for (let k = 0; k < D; k++) {
            const j = i * D + k;
            gw += gradVec[k] * E[j] * f;
            const ge = wt * gradVec[k] + MU * (E[j] - E0[j]);
            gE[j] += ge * ge;
            E[j] -= (LR_E * ge) / Math.sqrt(gE[j]);
          }
          gw += MU * (W[i] - W0[i]) * 0.01;
          gW[i] += gw * gw;
          W[i] = Math.max(0.01, W[i] - (LR_W * gw) / Math.sqrt(gW[i]));
        }
      }

      const v = fidelity(val);
      console.log(`  epoch ${epoch}: val cosine = ${v.toFixed(4)}`);
      if (v > bestVal + 1e-4) {
        bestVal = v;
        bestE = E.slice();
        bestW = W.slice();
      } else {
        break;
      }
    }

    E.set(bestE);
    W.set(bestW);
  }

  const stats = quantizeAndExportStaticModel(words, E, W, targetDir);
  console.log(
    `Exported static model to ${targetDir} (${stats.vocabSize} words × ${stats.dims}d, minCosine=${stats.minCosine.toFixed(6)}, maxAbsDiff=${stats.maxAbsDiff.toFixed(6)})`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
