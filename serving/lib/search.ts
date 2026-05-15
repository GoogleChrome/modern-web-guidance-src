import fs from "fs";
import path from "path";
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

let cachedVectors: { id: string; description: string; category: string; featuresUsed: string[]; tokenCount: number; vector: number[]; norm: number }[] | null = null;

function dotProduct(a: number[], b: number[]): number {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

function calculateNorm(v: number[]): number {
  let sum = 0;
  for (const val of v) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

export async function searchUseCases(query: string, limit = 5, minSimilarity = 0.3, embedder?: any): Promise<UseCaseResult[]> {
  const actualEmbedder = embedder || TfjsEmbedder.getInstance();
  const queryVector = await actualEmbedder.embed(query);
  const queryNorm = calculateNorm(queryVector);

  if (!cachedVectors) {
    const VECTORS_FILE = path.join(import.meta.dirname, "use-cases.vectors.gen.json.gz");
    if (!fs.existsSync(VECTORS_FILE)) {
      return [];
    }

    const compressed = fs.readFileSync(VECTORS_FILE);
    const jsonContent = zlib.gunzipSync(compressed).toString("utf-8");
    const items: any[] = JSON.parse(jsonContent);

    cachedVectors = items.map(item => ({
      id: item.id,
      description: item.description,
      category: item.category,
      featuresUsed: item.featuresUsed || [],
      tokenCount: item.tokenCount || 0,
      vector: item.vector,
      norm: item.vector ? calculateNorm(item.vector) : 0
    })).filter(item => item.vector);
  }

  const resultsMap = new Map<string, { item: (typeof cachedVectors)[0]; similarity: number }>();

  for (const item of cachedVectors) {
    if (item.norm === 0 || queryNorm === 0) continue;
    
    const sim = dotProduct(queryVector, item.vector) / (queryNorm * item.norm);
    
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
    featuresUsed: r.item.featuresUsed?.length ? r.item.featuresUsed : undefined,
    tokenCount: r.item.tokenCount,
    similarity: parseFloat(r.similarity.toFixed(4))
  }));

  // Log the result
  logToolResult("search_use_cases", limitedResults.map(r => ({ id: r.id, similarity: r.similarity })));

  return limitedResults;
}
