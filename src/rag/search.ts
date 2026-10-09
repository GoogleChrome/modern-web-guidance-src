import fs, { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { TfjsEmbedder } from "./tfjs-embedder.ts";
import { logToolResult } from "./logger.ts";

export interface UseCaseResult {
  id: string;
  description: string;
  category: string;
  featuresUsed?: string[];
  tokenCount: number;
  similarity: number;
}

export interface UseCaseVector {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount: number;
  vector: number[];
}

export interface EmbedderLike {
  embed(text: string): Promise<number[]>;
}

let cachedVectors: UseCaseVector[] | null = null;

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

function dotProduct(a: number[], b: number[]): number {
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
    if (!item.id || !Array.isArray(item.vector) || item.vector.length === 0) {
      throw new Error(`Corrupt vector entry in ${VECTORS_FILE}: missing id or vector`);
    }
  }
  return items;
}

export async function searchUseCases(
  query: string,
  limit = 5,
  minSimilarity = 0.3,
  embedder?: EmbedderLike
): Promise<UseCaseResult[]> {
  const actualEmbedder = embedder ?? TfjsEmbedder.getInstance();
  const queryVector = await actualEmbedder.embed(query);

  if (!cachedVectors) {
    cachedVectors = loadVectors();
  }

  const resultsMap = new Map<string, { item: UseCaseVector; similarity: number }>();

  // Both query and corpus vectors are L2-normalized unit vectors, so cosine similarity is dot product
  for (const item of cachedVectors) {
    const sim = dotProduct(queryVector, item.vector);
    if (sim < minSimilarity) continue;

    const existing = resultsMap.get(item.id);
    if (!existing || sim > existing.similarity) {
      resultsMap.set(item.id, { item, similarity: sim });
    }
  }

  const results = Array.from(resultsMap.values());

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  const limitedResults = results.slice(0, limit).map(r => ({
    id: r.item.id,
    description: r.item.description,
    category: r.item.category,
    featuresUsed: r.item.featuresUsed.length > 0 ? r.item.featuresUsed : undefined,
    tokenCount: r.item.tokenCount,
    similarity: parseFloat(r.similarity.toFixed(4))
  }));

  // Log the result
  logToolResult("search_use_cases", limitedResults.map(r => ({ id: r.id, similarity: r.similarity })));

  return limitedResults;
}
