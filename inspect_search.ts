import { searchUseCases } from "./serving/lib/search.ts";

async function run() {
  const query = "autofill address form";
  const results = await searchUseCases(query, 10);
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
