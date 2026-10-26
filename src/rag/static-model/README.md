# Static Embedding Model (`static-tokenlearn-256d`)

This directory contains the 256-dimensional static word-embedding model used by [`StaticEmbedder`](../static-embedder.ts) for hybrid dense + BM25 search (`modern-web-guidance search`).

It replaces the 23.4 MB `all-MiniLM-L6-v2` TensorFlow.js runtime with a zero-dependency lookup table distilled from `gemini-embedding-001` via a [Model2Vec](https://github.com/MinishLab/model2vec) + Tokenlearn recipe:

| File | Format | Size (raw / gzip) | Contents |
| :--- | :--- | :---: | :--- |
| `words.json` | JSON `string[]` | 298 KB / 90 KB | Sorted 27,833-word vocabulary (guide corpus tokens + search aliases + general-English whole words) |
| `words.i8` | `Int8Array(V × 256)` | 7.1 MB / 5.1 MB | Symmetric per-row `Int8` quantized 256-d unit vectors (`E`) |
| `words.scale.f32` | `Float32Array(V)` | 111 KB / 92 KB | Per-word weight folded with row quantization scale (`W[i] * (maxAbs[i] / 127)`) |
| `chunks.json` | JSON `string[]` | 119 KB / 24 KB | Content-hash index of 1,773 teacher-embedded guide chunks |
| `chunks.i8` | `Int8Array(N × 256)` | 454 KB / 395 KB | Symmetric per-row `Int8` quantized 256-d teacher document vectors |
| `chunks.scale.f32` | `Float32Array(N)` | 7.1 KB / 7.0 KB | Per-chunk quantization scales (`maxAbs / 127`) |

At runtime, search operates via asymmetric dense retrieval + BM25 fusion:
- **Queries** are embedded client-side via [`StaticEmbedder.embedSync`](../static-embedder.ts) in <1 ms using the static word table (`words.*`).
- **Guide chunks** are embedded at build time with the teacher model `gemini-embedding-001` (`RETRIEVAL_DOCUMENT`, 768-d → MRL 256-d unit vectors) loaded from the committed cache (`chunks.*`) into `use-cases.vectors.gen.json.gz`.
- Both sides share the 256-d normalized embedding space distilled from `gemini-embedding-001`. Search ranks by best-matching chunk cosine fused with BM25.

---

## Guide Chunks Cache & Pre-Release Workflow

Chunk vectors are cached in `chunks.json`, `chunks.i8`, and `chunks.scale.f32`.
Each entry is keyed by a SHA-256 hash of:
```
teacher_model (gemini-embedding-001) + "\n" + task_type (RETRIEVAL_DOCUMENT) + "\n" + dims (256) + "\n" + exact_embedded_text
```
The exact embedded text includes the guide ID, description, chunk Markdown, and expanded macros (`[baseline]`, `[feature:...]`).
Any change to guide prose, chunk boundaries, baseline data, or macro expansions automatically changes the hash and invalidates the cached vector for that chunk.

### 1. Day-to-Day Development & CI Builds (`pnpm build`)

- Builds use the committed chunk cache.
- If a guide is edited or added and its teacher vectors are not yet in `chunks.*`, `build-guides.ts` issues a loud console warning naming the guide and indexes the chunk for **BM25 search only** (`vector: []`).
- This allows day-to-day editing and test runs without requiring network access or `GEMINI_API_KEY`.

### 2. Pre-Release Embedding Script (`node src/rag/embed-chunks.ts`)

Before cutting a release, an engineer runs:

```bash
# Requires GEMINI_API_KEY in .env or environment
node src/rag/embed-chunks.ts
```

What `embed-chunks.ts` does:
1. Scans all published guide chunks and calculates their content hashes.
2. Checks which hashes are missing from the cache. If everything is up to date, it exits immediately (idempotent).
3. Embeds any missing or changed chunks using `gemini-embedding-001` (`taskType: "RETRIEVAL_DOCUMENT"`, 768 dimensions), batched in groups of 100 with exponential backoff on rate limits.
4. MRL-truncates new vectors to 256 dimensions and L2-normalizes them.
5. Prunes stale chunk hashes from deleted guides or old text versions.
6. Quantizes to Int8 + scale factor and writes `chunks.json`, `chunks.i8`, and `chunks.scale.f32`.

To check whether all chunks have cached vectors without calling the API:
```bash
node src/rag/embed-chunks.ts --check
```

### 3. Release & Publish Gate

The release script (`node src/build/publish-skills.ts`) strictly enforces vector completeness before publishing:
1. It runs `embedGuideChunks({ check: true })`. If any chunk lacks a cached vector, publishing **fails loudly** and stops before creating packages or git tags.
2. `build-dist.ts` and `build-guides.ts` enforce `--fail-on-missing-vectors` during release builds.
3. Distribution tests (`src/build/dist.test.ts`) assert that 100% of chunks in `use-cases.vectors.gen.json.gz` contain valid 256-d vectors.

There are no silent fallbacks.

---

## Vocabulary & Model Retraining (`node src/rag/train-static-model.ts`)

When a batch of new guides introduces net-new non-hyphenated web platform identifiers (for example, a newly coined single-word CSS property or browser API name) and you want dense embeddings for those new tokens:

```bash
# Requires GEMINI_API_KEY in .env or environment
node src/rag/train-static-model.ts
```

What [`src/rag/train-static-model.ts`](../train-static-model.ts) does:
1. **Vocabulary union:** Scans all published `guides/**/*.md` files and unions their tokens with the existing `src/rag/static-model/words.json`.
2. **Incremental teacher distillation:** Calls `gemini-embedding-001` (`RETRIEVAL_QUERY`, 768-d → MRL 256-d) only for newly added words or training queries not already present in `out/static-model-cache/`.
3. **Corpus IDF + Tokenlearn fit:** Recomputes `idfcap` weights across current guide chunks and runs 12 epochs of Adagrad (`LR = 0.01`, `MU = 0.05` L2 regularization toward initial teacher word vectors) so bag-of-words combinations match whole-query teacher embeddings. All benchmark queries (`harness`, `oos`, `wild`) are strictly excluded from training.
4. **Quantization & export:** Writes updated `words.json`, `words.i8`, and `words.scale.f32`, then verifies `Float32 → Int8` cosine fidelity (`> 0.999`).

If you also have an offline JSONL of historical telemetry queries or search aliases to include in the Tokenlearn step, pass `--extra-queries path/to/queries.jsonl`:

```bash
node src/rag/train-static-model.ts --extra-queries path/to/train-queries.jsonl
```

After updating `src/rag/static-model/`, run `pnpm build` and `pnpm benchmark:rag --public-only` to rebuild the guide vectors and verify retrieval metrics.
