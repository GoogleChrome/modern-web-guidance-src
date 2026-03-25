import * as ort from 'onnxruntime-web';
(globalThis as any)[Symbol.for('onnxruntime')] = ort;

import { pipeline, env } from '@huggingface/transformers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tell ONNX to load the WASM files from our local bundled 'wasm' directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
env.backends.onnx.wasm.wasmPaths = path.join(__dirname, 'wasm/');
env.backends.onnx.wasm.numThreads = 1; // Sometimes helps prevent worker import issues in Node

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
