/**
 * Pre-release script to embed guide chunks with gemini-embedding-001 at build time.
 *
 * Chunks are embedded with taskType "RETRIEVAL_DOCUMENT", 768 dimensions,
 * MRL-truncated to 256 dimensions and L2-normalized.
 * Results are stored in an Int8 + scale cache in `src/rag/static-model/`.
 *
 * Usage:
 *   node src/rag/embed-chunks.ts [--check] [--force] [--seed-from path/to/gemini-emb.json]
 */

import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { rootDir } from "../core/paths.ts";
import {
  scanCorpusChunks,
  loadChunkCache,
  saveChunkCache,
  truncateAndNormalize256,
  TEACHER_MODEL,
  TASK_TYPE,
  TEACHER_DIM,
  STATIC_DIMS,
  DEFAULT_CACHE_DIR,
  type GuideChunk,
} from "./chunk-cache.ts";

interface BatchEmbeddingResponse {
  embeddings: Array<{ values: number[] }>;
}

function isBatchEmbeddingResponse(val: unknown): val is BatchEmbeddingResponse {
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

export interface EmbedChunksOptions {
  check?: boolean;
  force?: boolean;
  cacheDir?: string;
}

export async function embedGuideChunks(options: EmbedChunksOptions = {}): Promise<{
  totalChunks: number;
  cachedCount: number;
  newEmbeds: number;
  prunedCount: number;
  missing: GuideChunk[];
}> {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const allChunks = scanCorpusChunks("skills-cli");

  const existingCache = options.force ? new Map<string, Float32Array>() : loadChunkCache(cacheDir);

  // If check mode requested: verify that 100% of chunks are in cache without calling API
  if (options.check) {
    const missing = allChunks.filter((c) => !existingCache.has(c.hash));
    return {
      totalChunks: allChunks.length,
      cachedCount: allChunks.length - missing.length,
      newEmbeds: 0,
      prunedCount: 0,
      missing,
    };
  }

  const workingCache = new Map<string, Float32Array>(existingCache);

  // Identify missing chunks
  const missingChunks = allChunks.filter((c) => !workingCache.has(c.hash));

  let newEmbeds = 0;
  if (missingChunks.length > 0) {
    try {
      process.loadEnvFile(path.join(rootDir, ".env"));
    } catch {
      // .env is optional if key is already in process.env
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        `GEMINI_API_KEY is required in .env or environment to embed ${missingChunks.length} missing guide chunks.`
      );
    }

    console.log(
      `Embedding ${missingChunks.length} missing chunks using ${TEACHER_MODEL} (${TASK_TYPE}, ${TEACHER_DIM}-d -> ${STATIC_DIMS}-d)...`
    );

    const BATCH_SIZE = 100;
    const batches: GuideChunk[][] = [];
    for (let i = 0; i < missingChunks.length; i += BATCH_SIZE) {
      batches.push(missingChunks.slice(i, i + BATCH_SIZE));
    }

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEACHER_MODEL}:batchEmbedContents?key=${apiKey}`;
      const body = {
        requests: batch.map((c) => ({
          model: `models/${TEACHER_MODEL}`,
          content: { parts: [{ text: c.embeddedText.slice(0, 8000) }] },
          taskType: TASK_TYPE,
          outputDimensionality: TEACHER_DIM,
        })),
      };

      const res = await postWithRetry(url, body);
      if (!isBatchEmbeddingResponse(res)) {
        throw new Error(`Invalid batchEmbedContents response shape from ${TEACHER_MODEL}`);
      }

      res.embeddings.forEach((e, i) => {
        const chunk = batch[i];
        const v768 = Float32Array.from(e.values);
        let sumSq = 0;
        for (let k = 0; k < TEACHER_DIM; k++) sumSq += v768[k] * v768[k];
        const norm = Math.sqrt(sumSq) || 1;
        for (let k = 0; k < TEACHER_DIM; k++) v768[k] /= norm;

        const v256 = truncateAndNormalize256(v768);
        workingCache.set(chunk.hash, v256);
        newEmbeds++;
      });

      console.log(`  Batch ${bIdx + 1}/${batches.length} completed (+${batch.length} chunks)`);
    }
  }

  // Prune unused entries from older guide versions or deleted guides
  const activeCache = new Map<string, Float32Array>();
  for (const chunk of allChunks) {
    const vec = workingCache.get(chunk.hash);
    if (vec) activeCache.set(chunk.hash, vec);
  }

  const prunedCount = existingCache.size + newEmbeds - activeCache.size;

  const saveStats = saveChunkCache(activeCache, cacheDir);
  console.log(
    `Saved chunk cache to ${cacheDir}: ${saveStats.count} chunks (${(saveStats.bytes / 1024).toFixed(1)} KB)`
  );
  if (prunedCount > 0) {
    console.log(`Pruned ${prunedCount} stale chunk entries.`);
  }

  return {
    totalChunks: allChunks.length,
    cachedCount: activeCache.size,
    newEmbeds,
    prunedCount,
    missing: [],
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      "cache-dir": { type: "string" },
    },
  });

  const res = await embedGuideChunks({
    check: values.check,
    force: values.force,
    cacheDir: values["cache-dir"],
  });

  if (values.check) {
    if (res.missing.length > 0) {
      const missingGuides = [...new Set(res.missing.map((c) => c.guideId))];
      console.error(
        `❌ Release check failed: ${res.missing.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors:`
      );
      for (const g of missingGuides) {
        console.error(`   - ${g}`);
      }
      console.error(`\nRun 'node src/rag/embed-chunks.ts' to embed them before publishing.`);
      process.exit(1);
    } else {
      console.log(
        `✅ All ${res.totalChunks} guide chunks have valid cached teacher vectors (${TEACHER_MODEL}).`
      );
      process.exit(0);
    }
  }

  console.log(
    `Done! Total chunks: ${res.totalChunks}, newly embedded: ${res.newEmbeds}, active cached: ${res.cachedCount}.`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error("Error in embed-chunks:", err);
    process.exit(1);
  });
}
