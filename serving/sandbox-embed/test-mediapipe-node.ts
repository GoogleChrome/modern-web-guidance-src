// Advanced mock DOM for Mediapipe in Node.js
const eventListeners = new Map();
const mockNode = {
    addEventListener: (type: string, listener: any) => {
        if (!eventListeners.has(type)) eventListeners.set(type, []);
        eventListeners.get(type).push(listener);
    },
    removeEventListener: (type: string, listener: any) => {
        const list = eventListeners.get(type);
        if (list) {
            const index = list.indexOf(listener);
            if (index > -1) list.splice(index, 1);
        }
    },
    dispatchEvent: () => true,
    createElement: () => mockNode,
    getElementsByTagName: () => [],
    style: {},
    appendChild: () => {},
    removeChild: () => {},
};

Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true, configurable: true });
Object.defineProperty(globalThis, 'document', { value: mockNode, writable: true, configurable: true });

if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'userAgent', { value: 'Node.js', writable: true, configurable: true });
} else {
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Node.js' }, writable: true, configurable: true });
}

import { FilesetResolver, TextEmbedder } from '@mediapipe/tasks-text';

async function main() {
  console.log("Loading mediapipe (Node.js polyfilled)...");
  // Important: FilesetResolver uses 'https://' paths by default. 
  // It fetches these at runtime.
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
  console.log("Embedding vector slice index 0..10:", result.embeddings[0].floatEmbedding.slice(0, 10));
  console.log("Total dimension:", result.embeddings[0].floatEmbedding.length);
}

main().catch(console.error);
