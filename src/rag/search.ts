import fs, { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { StaticEmbedder } from "./static-embedder.ts";
import { logToolResult } from "./logger.ts";
import { buildBm25Index, rankBm25, reciprocalRankFusion, type Bm25Index } from "./bm25.ts";

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
  vector: number[];
  /** Markdown text of the chunk this vector embeds; feeds the lexical (BM25) index. */
  chunkContent: string;
}

export interface EmbedderLike {
  embed(text: string): Promise<number[]>;
  countTokens?(text: string): number | Promise<number>;
}

/**
 * Query-level cosine floor: if dense top-1 is below this similarity AND BM25 has no matches, `[]` is returned.
 * Calibrated empirically across all in-domain dev queries (n=979 of Wild-v2 1,000):
 *   min: 0.6296 ("removable filter chips"), p1: 0.7223, p5: 0.7518, median: 0.8177.
 * With min 0.6296 minus a 0.05 safety margin, 0.58 guarantees 0 empty results on all in-domain queries.
 * On OOS queries (n=90), top-1 cosine has median 0.7676, with 97.8% (88/90) admitted at 0.58.
 * (Full OOS rejection with static queries awaits query-side centering in a future milestone).
 */
export const DEFAULT_MIN_SIMILARITY = 0.58;

let cachedCorpus: { vectors: UseCaseVector[]; bm25: Bm25Index } | null = null;

const BUNDLE_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveSkillsCliDataDir(): string {
  // In the shipped bundle (dist/skills-cli/skills/modern-web-guidance/), guides.json and vectors sit next to modern-web.mjs / search.mjs
  if (existsSync(path.join(BUNDLE_DIR, 'guides.json')) || existsSync(path.join(BUNDLE_DIR, 'use-cases.vectors.gen.json.gz'))) {
    return BUNDLE_DIR;
  }
  // In repo source mode (src/rag/), walk up to repo root (where pnpm-lock.yaml lives) and use out/build/skills-cli
  let dir = BUNDLE_DIR;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
      return path.join(dir, 'out/build/skills-cli');
    }
    dir = path.dirname(dir);
  }
  return BUNDLE_DIR;
}

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

function loadVectors(): UseCaseVector[] {
  const VECTORS_FILE = path.join(resolveSkillsCliDataDir(), "use-cases.vectors.gen.json.gz");
  if (!fs.existsSync(VECTORS_FILE)) {
    throw new Error(`Vectors file not found at ${VECTORS_FILE}. Run 'pnpm build' first.`);
  }
  const compressed = fs.readFileSync(VECTORS_FILE);
  const jsonContent = zlib.gunzipSync(compressed).toString("utf-8");
  const items: UseCaseVector[] = JSON.parse(jsonContent);

  for (const item of items) {
    if (!item.id || !Array.isArray(item.vector) || typeof item.chunkContent !== "string") {
      throw new Error(`Corrupt vector entry in ${VECTORS_FILE}: missing id, vector, or chunkContent`);
    }
  }
  return items;
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
