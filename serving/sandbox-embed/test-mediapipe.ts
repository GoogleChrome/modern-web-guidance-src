import { FilesetResolver, TextEmbedder } from '@mediapipe/tasks-text';

/**
 * NOTE: This script currently fails in Node.js with "ReferenceError: document is not defined".
 * MediaPipe Tasks Text is primarily designed for browser environments and lacks 
 * first-class Node.js support without significant DOM polyfilling.
 */
async function main() {
  console.log("Loading mediapipe...");
  const text = await FilesetResolver.forTextTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@latest/wasm"
  );
  
  console.log("Initializing TextEmbedder...");
  const textEmbedder = await TextEmbedder.createFromOptions(text, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/text_embedder/universal_sentence_encoder/float32/1/universal_sentence_encoder.tflite`
    },
  });

  console.log("Embedding text...");
  const result = textEmbedder.embed("Hello world");
  console.log("Embedding:", result.embeddings[0].floatEmbedding.slice(0, 10), "...");
  console.log("Vector dimension:", result.embeddings[0].floatEmbedding.length);
}

main().catch(console.error);
