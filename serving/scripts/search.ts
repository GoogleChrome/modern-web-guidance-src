import { Store } from "../mcp-server/lib/store.ts";
import { Embedder } from "../mcp-server/lib/embedder.ts";
import { logToolResult } from "../lib/logger.ts";

async function run() {
  const query = process.argv[2];
  if (!query) {
    console.error("Usage: node search.ts <query>");
    process.exit(1);
  }

  const store = new Store();
  const embedder = Embedder.getInstance();

  try {
    const vector = await embedder.embed(query);
    const results = await store.search(vector);
    logToolResult("search_use_cases", results.map(r => ({ id: r.id, distance: r.distance })));
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Search failed:", error);
    process.exit(1);
  }
}

run();
