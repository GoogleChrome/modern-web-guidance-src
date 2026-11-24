import fs from "fs";
import path from "path";
import zlib from "zlib";
import { StaticEmbedder } from "./static-embedder.ts";
import { logToolResult } from "./logger.ts";
import { buildBm25Index, rankBm25, reciprocalRankFusion, type Bm25Index } from "./bm25.ts";
import { resolveSkillsCliDataDir } from "./data-dir.ts";
import {
  STATIC_DIMS,
  dequantizeVectorRow,
  toAlignedFloat32Array,
  toInt8Array,
} from "./quantize.ts";

export interface UseCaseResult {
  id: string;
  description: string;
  category: string;
  featuresUsed?: string[];
  tokenCount: number;
  similarity: number;
}

export type CompactSearchResult = Pick<UseCaseResult, "id" | "description">;

export interface UseCaseVector {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount: number;
  vector: ArrayLike<number>;
  /** Markdown text of the chunk this vector embeds; feeds the lexical (BM25) index. */
  chunkContent: string;
}

export interface EmbedderLike {
  embed(text: string): Promise<number[]>;
  countTokens?(text: string): number | Promise<number>;
}

/**
 * Query-level cosine floor: if dense top-1 is below this similarity AND BM25 has no matches, `[]` is returned.
 * Across all non-stopword entries in `query-words.json`, single-word top-1 cosine starts at 0.475 ("chips", "bento" 0.532),
 * and in-domain `wild-v2-dev` queries span 0.636..0.899 (median 0.821).
 * Keeping 0.30 acts as a non-zero dense floor so 100% of in-vocab queries use their dense vector while zero-vector / unknown queries
 * with no BM25 matches return `[]`.
 */
export const DEFAULT_MIN_SIMILARITY = 0.3;

let cachedCorpus: { vectors: UseCaseVector[]; bm25: Bm25Index } | null = null;

export function dotProduct(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch in dotProduct: ${a.length} !== ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function loadVectors(dataDir = resolveSkillsCliDataDir()): UseCaseVector[] {
  const genDir = fs.existsSync(path.join(dataDir, "guide-chunks.json.gz"))
    ? dataDir
    : path.join(dataDir, "gen");
  const VECTORS_FILE = path.join(genDir, "guide-chunks.json.gz");
  const I8_FILE = path.join(genDir, "guide-chunks.i8");
  const SCALE_FILE = path.join(genDir, "guide-chunks.scale.f32");

  if (!fs.existsSync(VECTORS_FILE) || !fs.existsSync(I8_FILE) || !fs.existsSync(SCALE_FILE)) {
    throw new Error(`Vectors files not found in ${dataDir}. Run 'pnpm build' first.`);
  }
  const compressed = fs.readFileSync(VECTORS_FILE);
  const jsonContent = zlib.gunzipSync(compressed).toString("utf-8");
  const items: Array<Omit<UseCaseVector, "vector">> = JSON.parse(jsonContent);
  const i8Buf = fs.readFileSync(I8_FILE);
  const scaleBuf = fs.readFileSync(SCALE_FILE);

  const N = items.length;
  if (scaleBuf.byteLength !== N * 4) {
    throw new Error(`Corrupt vector scale file ${SCALE_FILE}: byteLength ${scaleBuf.byteLength} !== ${N} * 4`);
  }
  const dims = N > 0 ? i8Buf.byteLength / N : STATIC_DIMS;
  if (!Number.isInteger(dims) || dims <= 0) {
    throw new Error(`Corrupt vector i8 file ${I8_FILE}: byteLength ${i8Buf.byteLength} not divisible by ${N}`);
  }

  const qTable = toInt8Array(i8Buf);
  const scales = toAlignedFloat32Array(scaleBuf);

  const out: UseCaseVector[] = [];
  for (let i = 0; i < N; i++) {
    const item = items[i];
    if (!item.id || typeof item.chunkContent !== "string") {
      throw new Error(`Corrupt vector entry in ${VECTORS_FILE}: missing id or chunkContent`);
    }
    const vector = dequantizeVectorRow(qTable, scales, i, dims);
    out.push({ ...item, vector });
  }
  return out;
}

/**
 * Hybrid retrieval: guides are ranked by their best-matching chunk (dense cosine) and by per-chunk max-pooled BM25,
 * then merged with reciprocal rank fusion. `minSimilarity` gates the query, not individual guides: `[]` is returned
 * only when dense top-1 is below the floor AND BM25 has no matches; otherwise lexical matches with weaker cosine can surface.
 * The reported `similarity` is still the guide's best dense cosine.
 */
export async function searchUseCases(
  query: string,
  limit = 10,
  minSimilarity = DEFAULT_MIN_SIMILARITY,
  embedder?: EmbedderLike
): Promise<UseCaseResult[]> {
  const actualEmbedder = embedder ?? StaticEmbedder.getInstance();
  const queryVector = await actualEmbedder.embed(query);

  if (!cachedCorpus) {
    const vectors = loadVectors();
    cachedCorpus = { vectors, bm25: buildBm25Index(vectors.map((v) => ({ id: v.id, text: `${v.description}\n\n${v.chunkContent}` }))) };
  }

  // Both query and corpus vectors are L2-normalized unit vectors, so cosine similarity is dot product
  const best = new Map<string, { item: UseCaseVector; similarity: number }>();
  for (const item of cachedCorpus.vectors) {
    if (item.vector.length === 0) continue;
    const sim = dotProduct(queryVector, item.vector);
    const existing = best.get(item.id);
    if (!existing || sim > existing.similarity) {
      best.set(item.id, { item, similarity: sim });
    }
  }
  const dense = [...best.values()].sort((a, b) => b.similarity - a.similarity);
  const bm25Matches = rankBm25(cachedCorpus.bm25, query);

  const topDenseSim = dense.length > 0 ? dense[0].similarity : 0;
  if (topDenseSim < minSimilarity && bm25Matches.length === 0) {
    logToolResult("search_use_cases", []);
    return [];
  }

  const fused = reciprocalRankFusion([
    topDenseSim < minSimilarity ? [] : dense.map((r) => r.item.id),
    bm25Matches.map((r) => r.id),
  ]);

  const limitedResults = fused.slice(0, limit).map(({ id }) => {
    const r = best.get(id);
    const item = r ? r.item : cachedCorpus!.vectors.find((v) => v.id === id)!;
    const similarity = r ? r.similarity : 0;
    return {
      id: item.id,
      description: item.description,
      category: item.category,
      featuresUsed: item.featuresUsed.length > 0 ? item.featuresUsed : undefined,
      tokenCount: item.tokenCount,
      similarity: parseFloat(similarity.toFixed(4)),
    };
  });

  logToolResult("search_use_cases", limitedResults.map(r => ({ id: r.id, similarity: r.similarity })));

  return limitedResults;
}
