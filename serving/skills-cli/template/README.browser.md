# 🌐 Modern Web Guidance - Browser Client Library

`GuidanceBrowserClient` is a browser-compatible JavaScript/TypeScript library that lets you run semantic search and best-practice guide retrieval entirely client-side in the browser. 

It uses **TensorFlow.js (TFJS)** to run a lightweight embedding model (`all-MiniLM-L6-v2`) locally, enabling search with zero network roundtrips after the initial load.

---

## 🚀 Quickstart

### 1. Host the Assets
To run client-side, the library requires several static assets to be served from your web server:
1.  **Model files**: Located under `tfjs_model_minilm/` (the model graph configuration and binary weight shards).
2.  **Vectors database**: The gzipped semantic vectors file `use-cases.vectors.gen.json.gz`.
3.  **Guides**: The markdown best practice files located under `guides/`.

These files are automatically generated and gathered in the `dist/skills-cli` directory when you build the project. Copy them to your public web root (e.g. `/assets/guidance/`).

### 2. Import and Initialize
In your browser ESM script, import the client and bootstrap the assets:

```javascript
import { GuidanceBrowserClient } from './assets/guidance/skills/modern-web-guidance/search-browser.js';

// Instantiate the client pointing to your hosted assets directory
const client = new GuidanceBrowserClient({
  baseURL: './assets/guidance' // Resolves models, vectors, and guides automatically
});

// Register progress listeners for the initial download (~30MB)
client.addEventListener('progress', (e) => {
  console.log(`Loading [${e.step}]: ${e.percentage}%`);
});

// Register status listeners to know when search is ready
client.addEventListener('statuschange', (e) => {
  console.log(`Status changed to: ${e.status}`);
  if (e.status === 'ready') {
    enableSearchUI();
  }
});

// Start fetching and warming up the TFJS model
client.bootstrap().catch(err => console.error('Bootstrap failed', err));
```

### 3. Search and Retrieve
Once the status is `'ready'`, you can perform semantic queries and retrieve the guide markdown:

```javascript
// Search use cases
const results = await client.search('how to optimize cumulative layout shift');
console.log(results);
/*
Output: Array of UseCaseResult:
[
  {
    id: "optimize-cls",
    category: "performance",
    description: "Optimize Cumulative Layout Shift...",
    similarity: 0.7254,
    tokenCount: 850
  },
  ...
]
*/

// Retrieve guide content (passes the search result object directly!)
if (results.length > 0) {
  const markdownContent = await client.retrieve(results[0]);
  console.log(markdownContent); // Raw markdown text of the guide
}
```

---

## ⚙️ Configuration Options

The `GuidanceBrowserClient` constructor accepts a configuration object:

```typescript
interface ClientConfig {
  /** Base URL to resolve assets relative to. Defaults to '.' */
  baseURL?: string;
  
  /** Direct override for the TFJS model.json URL. Defaults to `${baseURL}/tfjs_model_minilm/model.json` */
  modelURL?: string;
  
  /** Direct override for the vectors file URL. Defaults to `${baseURL}/use-cases.vectors.gen.json.gz` */
  vectorsURL?: string;
  
  /** Direct override for the guides base URL. Defaults to `${baseURL}/guides` */
  guidesBaseURL?: string;

  /** Custom fetch wrapper (useful for routing requests in Chrome Extensions MV3) */
  fetch?: typeof fetch;
  
  /** Preferred TFJS backend: 'cpu' | 'webgl' | 'webgpu'. Defaults to 'cpu' */
  backend?: 'cpu' | 'webgl' | 'webgpu';
  
  /** Enable storing the compiled TFJS graph model in IndexedDB. Defaults to true. */
  cacheModel?: boolean;
  
  /** Enable caching vectors database in Cache Storage. Defaults to true. */
  cacheVectors?: boolean;
}
```

---

## 📊 Caching & Performance

To optimize performance and minimize data transfer, the client implements a **two-tier local caching strategy**:

1.  **Model Cache (IndexedDB)**: The compiled TensorFlow.js graph model is stored using the browser's native `indexeddb://` storage scheme. On repeat visits, the model is re-compiled directly from IndexedDB in milliseconds, completely bypassing the network.
2.  **Vectors Cache (Cache API)**: The `use-cases.vectors.gen.json.gz` file is stored in the browser's Cache Storage.

### Memory Management
To prevent GPU memory leaks (especially when using WebGL backends), the client automatically manages tensor lifecycle and disposal. If you need to clear all references and unload the model from memory, call the synchronous `.dispose()` method:

```javascript
// Unloads model from memory and clears caches
client.dispose();
```

---

## ⚡ Aborting / Cancellation
> [!NOTE]
> *TODO:* Future updates will add `AbortSignal` parameters to all asynchronous methods (`bootstrap`, `search`, `retrieve`) to enable client-side cancellation.
