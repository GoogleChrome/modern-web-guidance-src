import fs from "fs";
import path from "path";
import { Embedder } from "./embedder.ts";
import { logToolResult } from "./logger.ts";

export interface UseCaseResult {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  distance: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchUseCases(query: string, limit = 5, maxDistance = 1.5, embedder?: any): Promise<UseCaseResult[]> {
  const actualEmbedder = embedder || Embedder.getInstance();
  const queryVector = await actualEmbedder.embed(query, true); // Pass isQuery = true

  // Load vectors from static storage
  const VECTORS_FILE = path.join(import.meta.dirname, "use-cases.vectors.gen.json");
  if (!fs.existsSync(VECTORS_FILE)) {
    return [];
  }

  const items: any[] = JSON.parse(fs.readFileSync(VECTORS_FILE, "utf-8"));
  
  const resultsMap = new Map<string, UseCaseResult>();

  for (const item of items) {
    if (!item.vector) continue;

    const similarity = cosineSimilarity(queryVector, item.vector);
    const distance = 1 - similarity;

    if (distance > maxDistance) continue;

    const existing = resultsMap.get(item.id);
    if (!existing || distance < parseFloat(existing.distance)) {
      resultsMap.set(item.id, {
        id: item.id,
        description: item.description,
        category: item.category,
        featuresUsed: item.featuresUsed || [],
        distance: distance.toString(), // Retain raw float precision for accurate sorting
      });
    }
  }

  const results = Array.from(resultsMap.values());

  // Sort by distance ascending
  results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

  const limitedResults = results.slice(0, limit);

  // Log the result
  logToolResult("search_use_cases", limitedResults.map(r => ({ id: r.id, distance: r.distance })));

  return limitedResults;
}
