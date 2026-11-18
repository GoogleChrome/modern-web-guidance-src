/**
 * Pre-release script to embed guide chunks with gemini-embedding-001 at build time.
 *
 * Chunks are embedded with taskType "RETRIEVAL_DOCUMENT", 768 dimensions,
 * MRL-truncated to 256 dimensions and L2-normalized.
 * Results are stored in an Int8 + scale cache in `src/rag/gen/`.
 *
 * Usage:
 *   node src/rag/embed-guide-chunks.ts [--check] [--force] [--prune]
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { rootDir } from "../core/paths.ts";
import {
  truncateAndNormalize256,
  TEACHER_MODEL,
  TASK_TYPE,
  TEACHER_DIM,
  STATIC_DIMS,
  DEFAULT_CACHE_DIR,
  loadChunkCache,
  saveChunkCache,
} from "./guide-chunk-cache.ts";
import {
  scanCorpusChunks,
  type GuideChunk,
} from "../core/guide-chunks.ts";
import {
  postWithRetry,
  isBatchEmbeddingResponse,
  isVertexPredictionResponse,
} from "./gemini-api.ts";

export interface VertexEmbedAuth {
  projectId: string;
  location?: string;
  headers: Record<string, string>;
}

export interface EmbedChunksOptions {
  check?: boolean;
  force?: boolean;
  prune?: boolean;
  cacheDir?: string;
  seedCacheDir?: string;
  envPath?: string | null;
  apiKey?: string;
  vertexAuth?: (() => Promise<VertexEmbedAuth | null>) | null;
  scanChunks?: typeof scanCorpusChunks;
  postBatch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<unknown>;
}

function readDotenv(options: EmbedChunksOptions): Record<string, string | undefined> | null {
  if (options.envPath === null) return null;
  const envFile = options.envPath ?? path.join(rootDir, ".env");
  try {
    const raw = fs.readFileSync(envFile, "utf8");
    return parseEnv(raw);
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
    return null;
  }
}

function createDefaultVertexAuthProvider(options: EmbedChunksOptions): () => Promise<VertexEmbedAuth | null> {
  let storagePromise: Promise<import("@google-cloud/storage").Storage> | null = null;
  return async () => {
    try {
      if (!storagePromise) {
        storagePromise = import("@google-cloud/storage").then(({ Storage }) => new Storage());
      }
      const storage = await storagePromise;
      const rawHeaders = await storage.authClient.getRequestHeaders();
      const headers: Record<string, string> = {};
      if (rawHeaders instanceof Headers) {
        rawHeaders.forEach((v, k) => {
          headers[k] = v;
        });
      } else if (rawHeaders && typeof rawHeaders === "object") {
        for (const [k, v] of Object.entries(rawHeaders as Record<string, unknown>)) {
          if (typeof v === "string") headers[k] = v;
        }
      }
      if (!headers.Authorization && !headers.authorization) {
        return null;
      }
      const dotenv = readDotenv(options);
      const envProject =
        process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
        process.env.GCLOUD_PROJECT?.trim() ||
        process.env.ANTIGRAVITY_GCP_PROJECT?.trim() ||
        process.env.ANTHROPIC_VERTEX_PROJECT_ID?.trim() ||
        dotenv?.GOOGLE_CLOUD_PROJECT?.trim() ||
        dotenv?.GCLOUD_PROJECT?.trim() ||
        dotenv?.ANTIGRAVITY_GCP_PROJECT?.trim() ||
        dotenv?.ANTHROPIC_VERTEX_PROJECT_ID?.trim();
      const projectId =
        envProject || (await storage.authClient.getProjectId().catch(() => ""))?.trim();
      if (!projectId) {
        return null;
      }
      const location =
        process.env.VERTEX_EMBED_LOCATION?.trim() ||
        dotenv?.VERTEX_EMBED_LOCATION?.trim() ||
        "us-central1";
      if (envProject) {
        if ("x-goog-user-project" in headers) headers["x-goog-user-project"] = projectId;
        if ("X-Goog-User-Project" in headers) headers["X-Goog-User-Project"] = projectId;
      }
      return { projectId, location, headers };
    } catch {
      return null;
    }
  };
}

function resolveGeminiApiKey(options: EmbedChunksOptions): string | undefined {
  if (options.apiKey !== undefined) {
    return options.apiKey.trim();
  }
  if (process.env.GEMINI_API_KEY !== undefined) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return readDotenv(options)?.GEMINI_API_KEY?.trim();
}

export async function embedGuideChunks(options: EmbedChunksOptions = {}): Promise<{
  totalChunks: number;
  cachedCount: number;
  newEmbeds: number;
  prunedCount: number;
  missing: GuideChunk[];
}> {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const allChunks = (options.scanChunks ?? scanCorpusChunks)("skills-cli");

  const existingCache = options.force ? new Map<string, Float32Array>() : loadChunkCache(cacheDir);
  const workingCache = new Map<string, Float32Array>(existingCache);

  if (!options.force && options.seedCacheDir && path.resolve(options.seedCacheDir) !== path.resolve(cacheDir)) {
    const activeHashes = new Set(allChunks.map((c) => c.hash));
    const seedCache = loadChunkCache(options.seedCacheDir);
    for (const [hash, vec] of seedCache) {
      if (activeHashes.has(hash) && !workingCache.has(hash)) {
        workingCache.set(hash, vec);
      }
    }
  }

  // If check mode requested: verify that 100% of chunks are in cache without calling API
  if (options.check) {
    const missing = allChunks.filter((c) => !workingCache.has(c.hash));
    return {
      totalChunks: allChunks.length,
      cachedCount: allChunks.length - missing.length,
      newEmbeds: 0,
      prunedCount: 0,
      missing,
    };
  }

  // Identify missing chunks
  const missingChunks = allChunks.filter((c) => !workingCache.has(c.hash));

  let newEmbeds = 0;
  if (missingChunks.length > 0) {
    const apiKey = resolveGeminiApiKey(options);
    let vertexAuthProvider: (() => Promise<VertexEmbedAuth | null>) | null = null;
    let initialVertexAuth: VertexEmbedAuth | null = null;

    if (!apiKey) {
      const allowDefaultVertex =
        options.vertexAuth !== null && !(options.apiKey === "" && options.vertexAuth === undefined);
      if (allowDefaultVertex) {
        vertexAuthProvider = options.vertexAuth ?? createDefaultVertexAuthProvider(options);
        initialVertexAuth = await vertexAuthProvider();
      }
    }

    if (!apiKey && !initialVertexAuth) {
      const missingGuides = [...new Set(missingChunks.map((c) => c.guideId))];
      throw new Error(
        `GEMINI_API_KEY is required to embed ${missingChunks.length} missing chunk(s) across ${missingGuides.length} guide(s) (${missingGuides.join(", ")}). Set GEMINI_API_KEY in .env or your environment (or configure Vertex AI ADC), or run 'node src/rag/embed-guide-chunks.ts' with GEMINI_API_KEY set.`
      );
    }

    const postBatch = options.postBatch ?? postWithRetry;
    const useVertex = !apiKey && Boolean(initialVertexAuth);
    console.log(
      `Embedding ${missingChunks.length} missing chunks using ${TEACHER_MODEL}${useVertex ? " via Vertex AI" : ""} (${TASK_TYPE}, ${TEACHER_DIM}-d -> ${STATIC_DIMS}-d)...`
    );

    const batchSize = useVertex ? 8 : 100;
    const batches: GuideChunk[][] = [];
    for (let i = 0; i < missingChunks.length; i += batchSize) {
      batches.push(missingChunks.slice(i, i + batchSize));
    }

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      let rawVectors: number[][];

      if (!useVertex) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEACHER_MODEL}:batchEmbedContents?key=${apiKey}`;
        const body = {
          requests: batch.map((c) => ({
            model: `models/${TEACHER_MODEL}`,
            content: { parts: [{ text: c.embeddedText.slice(0, 8000) }] },
            taskType: TASK_TYPE,
            outputDimensionality: TEACHER_DIM,
          })),
        };

        const res = await postBatch(url, body);
        if (!isBatchEmbeddingResponse(res) || res.embeddings.length !== batch.length) {
          throw new Error(`Invalid batchEmbedContents response shape from ${TEACHER_MODEL}`);
        }
        rawVectors = res.embeddings.map((e) => e.values);
      } else {
        const vAuth = bIdx === 0 ? initialVertexAuth! : await vertexAuthProvider!();
        if (!vAuth) {
          throw new Error(`Failed to refresh Vertex AI credentials while embedding ${TEACHER_MODEL}`);
        }
        const location = vAuth.location || "us-central1";
        const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
        const url = `https://${host}/v1/projects/${vAuth.projectId}/locations/${location}/publishers/google/models/${TEACHER_MODEL}:predict`;

        // gemini-embedding-001 on Vertex AI restricts :predict to 1 instance per request.
        rawVectors = await Promise.all(
          batch.map(async (c) => {
            const body = {
              instances: [
                {
                  content: c.embeddedText.slice(0, 8000),
                  task_type: TASK_TYPE,
                },
              ],
              parameters: {
                outputDimensionality: TEACHER_DIM,
              },
            };
            const res = await postBatch(url, body, vAuth.headers);
            if (!isVertexPredictionResponse(res) || res.predictions.length !== 1) {
              throw new Error(`Invalid Vertex predict response shape from ${TEACHER_MODEL}`);
            }
            return res.predictions[0].embeddings.values;
          }),
        );
      }

      rawVectors.forEach((values, i) => {
        const chunk = batch[i];
        const v256 = truncateAndNormalize256(values);
        workingCache.set(chunk.hash, v256);
        newEmbeds++;
      });

      console.log(`  Batch ${bIdx + 1}/${batches.length} completed (+${batch.length} chunks)`);
    }
  }

  // Prune unused entries from older guide versions or deleted guides only if explicitly requested
  let targetCache: Map<string, Float32Array>;
  let prunedCount = 0;
  if (options.prune) {
    const activeCache = new Map<string, Float32Array>();
    for (const chunk of allChunks) {
      const vec = workingCache.get(chunk.hash);
      if (vec) activeCache.set(chunk.hash, vec);
    }
    prunedCount = workingCache.size - activeCache.size;
    targetCache = activeCache;
  } else {
    targetCache = workingCache;
    prunedCount = 0;
  }

  const cacheChanged =
    newEmbeds > 0 ||
    prunedCount > 0 ||
    Boolean(options.force) ||
    targetCache.size !== existingCache.size ||
    [...targetCache.keys()].some((hash) => !existingCache.has(hash));

  if (cacheChanged) {
    const saveStats = saveChunkCache(targetCache, cacheDir);
    console.log(
      `Saved chunk cache to ${cacheDir}: ${saveStats.count} chunks (${(saveStats.bytes / 1024).toFixed(1)} KB)`
    );
    if (prunedCount > 0) {
      console.log(`Pruned ${prunedCount} stale chunk entries.`);
    }
  }

  return {
    totalChunks: allChunks.length,
    cachedCount: targetCache.size,
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
      prune: { type: "boolean", default: false },
      "cache-dir": { type: "string" },
    },
  });

  const res = await embedGuideChunks({
    check: values.check,
    force: values.force,
    prune: values.prune,
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
      console.error(`\nRun 'node src/rag/embed-guide-chunks.ts' to embed them before publishing.`);
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
    console.error("Error in embed-guide-chunks:", err);
    process.exit(1);
  });
}
