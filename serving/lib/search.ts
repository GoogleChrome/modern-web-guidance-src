import { Store } from "./store.ts";
import { Embedder } from "../mcp-server/lib/embedder.ts";
import { logToolResult } from "./logger.ts";

export async function searchUseCases(query: string) {
  const store = new Store();
  const embedder = Embedder.getInstance();

  const vector = await embedder.embed(query);
  const results = await store.search(vector);
  
  // Log the result
  logToolResult("search_use_cases", results.map(r => ({ id: r.id, distance: r.distance })));

  return results;
}
