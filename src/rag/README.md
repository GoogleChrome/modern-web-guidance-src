# Static Embedding Model (`static-tokenlearn-256d`)

This directory (`src/rag/`) implements hybrid dense + BM25 search (`modern-web-guidance search`), with generated data tables stored under `src/rag/gen/` and benchmark suite documentation in [`./benchmarks/README.md`](./benchmarks/README.md).

[`StaticEmbedder`](./static-embedder.ts) replaces the 23.4 MB `all-MiniLM-L6-v2` TensorFlow.js runtime with a zero-dependency lookup table distilled from `gemini-embedding-001` via a [Model2Vec](https://github.com/MinishLab/model2vec) + Tokenlearn recipe:

| File (`src/rag/gen/`) | Format | Size (raw / gzip) | Contents |
| :--- | :--- | :---: | :--- |
| `query-words.json` | JSON `string[]` | 314 KB / 94 KB | Sorted 29,165-word vocabulary (guide corpus tokens + search aliases + general-English whole words, excluding `bm25.ts` stopwords) |
| `query-words.i8` | `Int8Array(V × 256)` | 7.5 MB / 5.3 MB | Symmetric per-row `Int8` quantized 256-d unit vectors (`E`) |
| `query-words.scale.f32` | `Float32Array(V)` | 117 KB / 96 KB | Per-word weight folded with row quantization scale (`W[i] * (maxAbs[i] / 127)`) |
| `guide-chunk-cache.json` | JSON `string[]` | 125 KB / 67 KB | Content-hash index of 1,859 teacher-embedded guide chunks |
| `guide-chunk-cache.i8` | `Int8Array(N × 256)` | 476 KB / 325 KB | Symmetric per-row `Int8` quantized 256-d teacher document vectors |
| `guide-chunk-cache.scale.f32` | `Float32Array(N)` | 7.4 KB / 6.0 KB | Per-chunk quantization scales (`maxAbs / 127`) |

At runtime, search operates via asymmetric dense retrieval + BM25 fusion:
- **Queries** are embedded client-side via [`StaticEmbedder.embedSync`](./static-embedder.ts) in <1 ms using the static word table (`gen/query-words.*`).
- **Guide chunks** are embedded at build time with the teacher model `gemini-embedding-001` (`RETRIEVAL_DOCUMENT`, 768-d → MRL 256-d unit vectors) loaded from the committed cache (`src/rag/gen/guide-chunk-cache.*`) into `gen/guide-chunks.json.gz` (metadata & chunk text) plus binary `gen/guide-chunks.i8` and `gen/guide-chunks.scale.f32`.
- Both sides share the 256-d normalized embedding space distilled from `gemini-embedding-001`. Search ranks by best-matching chunk cosine fused with BM25.

---

## Guide Chunks Cache & Pre-Release Workflow

Chunk vectors are cached in `src/rag/gen/guide-chunk-cache.json`, `src/rag/gen/guide-chunk-cache.i8`, and `src/rag/gen/guide-chunk-cache.scale.f32`.
Each entry is keyed by a SHA-256 hash of:
```
teacher_model (gemini-embedding-001) + "\n" + task_type (RETRIEVAL_DOCUMENT) + "\n" + dims (256) + "\n" + exact_embedded_text
```
The exact embedded text includes the guide ID, description, chunk Markdown, and expanded macros (`[baseline]`, `[feature:...]`).
Any change to guide prose, chunk boundaries, baseline data, or macro expansions automatically changes the hash and invalidates the cached vector for that chunk.

### 1. Day-to-Day Development & CI Builds (`pnpm build`)

- Builds use the committed chunk cache.
- If a guide is edited or added and its teacher vectors are not yet in `src/rag/gen/guide-chunk-cache.*`, `build-guides.ts` issues a console warning naming the guide, records the chunk in `missingChunks` (so `--fail-on-missing-vectors` blocks release builds until `embed-guide-chunks.ts` is run), and sets `vector: []` so the uncached chunk is indexed for BM25 lexical search while unchanged chunks of the guide retain their cached teacher vectors (avoiding mixing query-space `StaticEmbedder` vectors into the document chunk index).

### 2. Pre-Release Embedding Script (`node src/rag/embed-guide-chunks.ts`)

Before cutting a release, an engineer runs:

```bash
# Requires GEMINI_API_KEY in .env or environment
node src/rag/embed-guide-chunks.ts
```

What `embed-guide-chunks.ts` does:
1. Scans all published guide chunks and calculates their content hashes.
2. Checks which hashes are missing from the cache. If everything is up to date, it exits immediately (idempotent).
3. Embeds any missing or changed chunks using `gemini-embedding-001` (`taskType: "RETRIEVAL_DOCUMENT"`, 768 dimensions), batched in groups of 100 with exponential backoff on rate limits.
4. MRL-truncates new vectors to 256 dimensions and L2-normalizes them.
5. Append-only by default; pass `--prune` to remove stale chunk hashes from deleted guides or old text versions.
6. Quantizes to Int8 + scale factor and writes `src/rag/gen/guide-chunk-cache.json`, `src/rag/gen/guide-chunk-cache.i8`, and `src/rag/gen/guide-chunk-cache.scale.f32`.

To check whether all chunks have cached vectors without calling the API:
```bash
node src/rag/embed-guide-chunks.ts --check
```

### 3. Release & Publish Gate

The release script (`node src/build/publish-skills.ts`) automatically ensures vector completeness before publishing:
1. On real releases, it runs `embedGuideChunks({ prune: true })`, automatically embedding any missing chunks (requiring `GEMINI_API_KEY` in `.env` or environment) and pruning stale entries. Any updated `src/rag/gen/guide-chunk-cache.*` files are automatically committed and pushed to `main` right alongside `README.md` and `src/build/eval-results-summary.json`.
2. `build-dist.ts` and `build-guides.ts` enforce `--fail-on-missing-vectors` during release builds.
3. On `--dry-run` (used by PR CI), `publish-skills.ts` warns on uncached chunks and builds with `vector: []` (`failOnMissingVectors: false`) so guide PRs do not need `GEMINI_API_KEY` or `embed-guide-chunks.ts`.
4. Distribution tests (`src/build/dist.test.ts`) assert that cached chunks contain valid 256-d teacher vectors (`>= 90%` coverage during PR `--dry-run`, `100%` on release via `--fail-on-missing-vectors`).

There are no silent fallbacks.

---

## Vocabulary & Model Retraining (`node src/rag/train-query-words.ts`)

When a batch of new guides introduces net-new non-hyphenated web platform identifiers (for example, a newly coined single-word CSS property or browser API name) and you want dense embeddings for those new tokens:

```bash
# Requires GEMINI_API_KEY in .env or environment
node src/rag/train-query-words.ts
```

What [`src/rag/train-query-words.ts`](./train-query-words.ts) does:
1. **Vocabulary union:** Scans all published `guides/**/*.md` files and unions their tokens with the existing `src/rag/gen/query-words.json`.
2. **Incremental teacher distillation:** Calls `gemini-embedding-001` (`RETRIEVAL_QUERY`, 768-d → MRL 256-d) only for newly added words or training queries not already present in `out/static-model-cache/`.
3. **Corpus IDF + Tokenlearn fit:** Recomputes `idfcap` weights across current guide chunks (including formatted chunk headers) and runs 12 epochs of Adagrad (`LR = 0.01`, `MU = 0.05` L2 regularization toward initial teacher word vectors) so bag-of-words combinations match whole-query teacher embeddings. All benchmark queries (`harness`, `oos`, `agent`, `wild-v1`, `wild-v2`) are strictly excluded from training (matching both exact normalized queries and stemmed token signatures).
4. **Quantization & export:** Writes updated `src/rag/gen/query-words.json`, `src/rag/gen/query-words.i8`, and `src/rag/gen/query-words.scale.f32`, then verifies `Float32 → Int8` cosine fidelity (`> 0.999`).

### Committed Table Provenance

The committed `src/rag/gen/query-words.{json,i8,scale.f32}` table (`29,165` words) was distilled from `gemini-embedding-001` (`RETRIEVAL_QUERY`, 768-d → MRL 256-d) and fit across `32,915` holdout-scrubbed queries:
- `2,999` synthetic corpus queries (guide IDs, titles, descriptions, and H2/H3 headings across all published guides)
- `29,916` unique historical CLI `search_use_cases` telemetry queries collected between `2026-03` and `2026-10` (`30,007` unique queries minus `91` exact/stemmed overlaps with held-out `wild-v1`, `wild-v2`, `agent`, `harness`, and `oos` splits)

Exact command used to produce the committed table:

```bash
node src/rag/train-query-words.ts --extra-queries path/to/train-queries.jsonl
```

After updating `src/rag/gen/`, run `pnpm build` and `pnpm benchmark:rag --public-only` to rebuild the guide vectors and verify retrieval metrics.
