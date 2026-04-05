import { Store, type UseCase, type WebFeature } from "./store.ts";
import { Embedder } from "../mcp-server/lib/embedder.ts";
import { logToolResult } from "./logger.ts";

export async function searchUseCases(query: string, limit?: number): Promise<UseCase[]> {
  const store = new Store("use_cases");
  const embedder = Embedder.getInstance();

  const vector = await embedder.embed(query);
  const results = await store.search(vector, limit) as UseCase[];
  
  // Log the result
  logToolResult("search_use_cases", results.map(r => ({ id: r.id, distance: r.distance })));

  return results;
}

export async function searchBaseline(query: string, limit?: number): Promise<WebFeature[]> {
  const store = new Store("web_features");
  const embedder = Embedder.getInstance();

  const vector = await embedder.embed(query);
  const results = await store.search(vector, limit) as WebFeature[];
  
  // Log the result
  logToolResult("search_baseline", results.map(r => ({ id: r.id, distance: r.distance })));

  return results;
}
