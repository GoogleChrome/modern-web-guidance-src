import { features } from "web-features";
import { TfjsEmbedder } from "../lib/tfjs-embedder.ts";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const VECTORS_FILE = path.join(ROOT_DIR, "lib/web-features.vectors.gen.json.gz");

async function buildBaseline() {
  console.log("Initializing TfjsEmbedder...");
  const embedder = TfjsEmbedder.getInstance();

  const storeFeatures: any[] = [];

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

  console.log(`Saving ${storeFeatures.length} features to vectors file...`);
  const jsonContent = JSON.stringify(storeFeatures);
  const compressed = zlib.gzipSync(jsonContent);
  fs.writeFileSync(VECTORS_FILE, compressed);
  console.log(`Vector storage updated at ${VECTORS_FILE}`);
}

if (process.argv[1] === import.meta.filename) {
  buildBaseline().catch(console.error);
}

export { buildBaseline };
