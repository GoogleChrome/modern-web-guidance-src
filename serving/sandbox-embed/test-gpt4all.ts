import { loadModel, createEmbedding } from 'gpt4all';

async function main() {
  console.log("Initializing gpt4all embedder with all-MiniLM-L6-v2... (this will download the model if not cached)");
  try {
    const model = await loadModel("all-MiniLM-L6-v2.gguf2.f16.gguf", { type: 'embedding' });
    const result = createEmbedding(model, "Hello world");
    
    if (result.embeddings) {
      let embeddingList: number[] = [];
      if (Array.isArray(result.embeddings)) {
          embeddingList = result.embeddings;
      } else if (result.embeddings instanceof Float32Array) {
          embeddingList = Array.from(result.embeddings);
      } else if (typeof result.embeddings === 'object') {
          const keys = Object.keys(result.embeddings).filter(k => !isNaN(Number(k)));
          if (keys.length > 10) {
              embeddingList = keys.map(k => result.embeddings[k]);
          }
      }
      
      if (embeddingList.length > 0) {
          console.log("Embedding:", embeddingList.slice(0, 10), "...");
          console.log("Vector dimension:", embeddingList.length);
      } else {
          console.log("Unexpected format:", typeof result.embeddings, result.embeddings);
      }
    } else {
        console.log("Unexpected root result format:", result);
    }
  } catch (err) {
      console.error("Error loading model:", err);
  }
}

main().catch(console.error);
