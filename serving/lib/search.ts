import fs from "fs";
import path from "path";
import { Embedder } from "../mcp-server/lib/embedder.ts";
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

export async function searchUseCases(query: string, limit = 5, maxDistance = 1.5): Promise<UseCaseResult[]> {
  const embedder = Embedder.getInstance();
  const queryVector = await embedder.embed(query);

  // Load vectors from static storage
  const VECTORS_FILE = path.join(import.meta.dirname, "use-cases.vectors.json");
  if (!fs.existsSync(VECTORS_FILE)) {
    return [];
  }

  const items: any[] = JSON.parse(fs.readFileSync(VECTORS_FILE, "utf-8"));
  
  const results: UseCaseResult[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (!item.vector || seenIds.has(item.id)) continue;

    const similarity = cosineSimilarity(queryVector, item.vector);
    const distance = 1 - similarity;

    if (distance > maxDistance) continue;

    seenIds.add(item.id);
    results.push({
      id: item.id,
      description: item.description,
      category: item.category,
      featuresUsed: item.featuresUsed || [],
      distance: distance.toFixed(2),
    });
  }

  // Sort by distance ascending
  results.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

  const limitedResults = results.slice(0, limit);

  // Log the result
  logToolResult("search_use_cases", limitedResults.map(r => ({ id: r.id, distance: r.distance })));

  return limitedResults;
}
