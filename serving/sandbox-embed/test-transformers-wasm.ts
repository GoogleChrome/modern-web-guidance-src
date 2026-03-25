import * as ort from 'onnxruntime-web';
(globalThis as any)[Symbol.for('onnxruntime')] = ort;

import { pipeline } from '@huggingface/transformers';

async function main() {
  console.log("Initializing transformers.js with WASM backend (forced via global symbol)...");
  
  const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  console.log("Embedding text...");
  const output = await pipe('Hello world', { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);
  
  console.log("Embedding:", embedding.slice(0, 10), "...");
  console.log("Vector dimension:", embedding.length);
}

main().catch(console.error);
