import { Embedder } from "../src/lib/embedder.js";
import { Store } from "../src/lib/store.js";

async function main() {
  const query = process.argv[2] || "how to optimize images";
  console.log(`\n🔎 Searching for: "${query}"\n`);


  // 1. Embed
  console.log("Vectorizing query...");
  const startEmbed = performance.now();
  const embedder = Embedder.getInstance();
  const vector = await embedder.embed(query);
  const endEmbed = performance.now();
  console.log(`  ↳ Took ${(endEmbed - startEmbed).toFixed(2)}ms`);

  // 2. Search
  console.log("Querying LanceDB...");
  const startSearch = performance.now();
  const store = new Store();
  const results = await store.search(vector, 3);
  const endSearch = performance.now();
  console.log(`  ↳ Took ${(endSearch - startSearch).toFixed(2)}ms`);

  // 3. Display
  console.log("\nTop Results:");
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. [${r.id}] (${r.category}) - Distance: ${r.distance}`);
    console.log(`   ${r.description}`);
  });
}

main().catch(console.error);
