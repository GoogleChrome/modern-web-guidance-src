import { TfjsEmbedderBrowser } from "./tfjs-embedder-browser.ts";

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

/**
 * Perform client-side search of use cases.
 * @param query The search query.
 * @param vectorsUrl URL to the use-cases.vectors.gen.json.gz file.
 * @param modelUrl URL to the TFJS model.json file.
 * @param limit Maximum number of results to return.
 * @param minSimilarity Minimum similarity score.
 */
export async function searchUseCasesBrowser(
  query: string,
  vectorsUrl: string,
  modelUrl: string,
  limit = 5,
  minSimilarity = 0.3
): Promise<UseCaseResult[]> {
  const embedder = TfjsEmbedderBrowser.getInstance();
  const queryVector = await embedder.embed(query, modelUrl);
  const queryNorm = calculateNorm(queryVector);

  if (!cachedVectors) {
    try {
      const response = await fetch(vectorsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch vectors: ${response.statusText}`);
      }

      // Decompress gzip stream in browser
      const ds = new DecompressionStream("gzip");
      const decompressedStream = response.body!.pipeThrough(ds);
      const decompressedResponse = new Response(decompressedStream);
      const jsonContent = await decompressedResponse.text();
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
    } catch (e) {
      console.error("Failed to load/decompress vectors in browser:", e);
      throw e;
    }
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

  return limitedResults;
}
