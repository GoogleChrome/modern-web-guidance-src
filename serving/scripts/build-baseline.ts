import fs from "fs";
import path from "path";
import { features } from "web-features";
import { Embedder } from "../mcp-server/lib/embedder.ts";
import { Store, type WebFeature } from "../lib/store.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

async function buildBaseline() {
  console.log("Initializing Embedder...");
  const embedder = Embedder.getInstance();
  await embedder.init();

  console.log("Initializing Store for web_features...");
  const store = new Store("web_features");

  const storeFeatures: WebFeature[] = [];

  console.log("Processing web features...");
  const keys = Object.keys(features);
  
  for (const id of keys) {
    const feature = features[id];
    if (feature.kind !== 'feature') continue;

    const name = feature.name;
    const description = feature.description || "";
    
    const embeddingText = `${name} (${id})\n\n${description}`;
    const vector = await embedder.embed(embeddingText);

    storeFeatures.push({
      id,
      name,
      description,
      vector
    });
  }

  console.log(`Upserting ${storeFeatures.length} features to LanceDB...`);
  await store.upsert(storeFeatures);
  console.log("Vector store updated for web_features.");
}

// Only run automatically if executed directly
if (process.argv[1] === import.meta.filename) {
  buildBaseline().catch(console.error);
}

export { buildBaseline };
