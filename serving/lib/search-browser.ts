import { TfjsEmbedderBrowser } from "./tfjs-embedder-browser.ts";
import { searchVectorsCore, calculateNorm, VectorItem, UseCaseResult } from "./search.ts";

export { UseCaseResult };

let cachedVectors: VectorItem[] | null = null;

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

  return searchVectorsCore(queryVector, cachedVectors, limit, minSimilarity);
}

/**
 * Retrieve the markdown content of a guide.
 * @param useCaseId The ID of the usecase/guide.
 * @param category The category of the guide.
 * @param guidesBaseUrl Base URL where guides are served.
 */
export async function retrieveUseCaseBrowser(
  useCaseId: string,
  category: string,
  guidesBaseUrl: string
): Promise<string> {
  const url = `${guidesBaseUrl}/${category}/${useCaseId}.md`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch guide from ${url}: ${response.statusText}`);
  }
  return response.text();
}
