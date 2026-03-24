import { loadModel, createEmbedding } from 'gpt4all';

async function main() {
  console.log("Initializing gpt4all embedder... (this will download the model if not cached)");
  const model = await loadModel("nomic-embed-text-v1.5.f16.gguf", { type: 'embedding' });
  const result = createEmbedding(model, "Hello world");
  // The exact return format:
  if (result.embeddings) {
      console.log("Embedding:", result.embeddings[0].slice(0, 10), "...");
      console.log("Vector dimension:", result.embeddings[0].length);
  } else if (result.length && result[0]?.length) {
      console.log("Embedding:", result[0].slice(0, 10), "...");
      console.log("Vector dimension:", result[0].length);
  } else {
      console.log("Result:", result);
  }
}

main().catch(console.error);
