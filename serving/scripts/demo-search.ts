import { searchUseCases } from "../lib/search.ts";

async function main() {
  const query = process.argv[2] || "how to optimize images";
  console.log(`\n🔎 Searching for: "${query}"\n`);

  // Search
  console.log("Searching vectors...");
  const startSearch = performance.now();
  const results = await searchUseCases(query, 3);
  const endSearch = performance.now();
  console.log(`  ↳ Took ${(endSearch - startSearch).toFixed(2)}ms`);

  // Display
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
