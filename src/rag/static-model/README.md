# Static Embedding Model (`static-tokenlearn-256d`)

This directory contains the 256-dimensional static word-embedding model used by [`StaticEmbedder`](../static-embedder.ts) for hybrid dense + BM25 search (`modern-web-guidance search`).

It replaces the 23.4 MB `all-MiniLM-L6-v2` TensorFlow.js runtime with a zero-dependency lookup table distilled from `gemini-embedding-001` via a [Model2Vec](https://github.com/MinishLab/model2vec) + Tokenlearn recipe:

| File | Format | Size (raw / gzip) | Contents |
| :--- | :--- | :---: | :--- |
| `words.json` | JSON `string[]` | 298 KB / 90 KB | Sorted 27,833-word vocabulary (guide corpus tokens + search aliases + general-English whole words) |
| `words.i8` | `Int8Array(V × 256)` | 7.1 MB / 5.1 MB | Symmetric per-row `Int8` quantized 256-d unit vectors (`E`) |
| `words.scale.f32` | `Float32Array(V)` | 111 KB / 92 KB | Per-word weight folded with row quantization scale (`W[i] * (maxAbs[i] / 127)`) |

At runtime, [`StaticEmbedder.embedSync`](../static-embedder.ts) tokenizes input text with [`tokenize()`](../bm25.ts), splits unknown hyphenated tokens (e.g., `anchor-positioning` → `anchor` + `positioning`, weighted `1 / parts.length`), accumulates the weighted sum of `words.i8` rows scaled by `words.scale.f32`, and L2-normalizes the resulting 256-d vector (<1 ms warm, ~8 ms cold start, zero third-party runtime dependencies).

---

## How New Guides Are Handled

New guides are added to `guides/` frequently. The system uses a two-tier workflow so day-to-day guide authoring requires **zero API keys and no model retraining**:

### 1. Day-to-Day: Automatic When Adding or Editing Guides (`pnpm build`)

When you add or edit a `guides/<category>/<guide-id>/guide.md` file:

1. Run `pnpm build` (or `node src/build/build-guides.ts`).
2. `build-guides.ts` chunks the new guide by Markdown headings and embeds each `${description}\n\n${chunk}` locally in ~3.6 seconds using `StaticEmbedder` and the existing `src/rag/static-model/` table, writing `use-cases.vectors.gen.json.gz` and `guides.json`.
3. Why this works immediately without retraining `static-model/`:
   - **Broad vocabulary coverage (27,833 words):** `words.json` already includes general English, HTML/CSS/JS/Web API terminology, and hyphen-splitting fallback (`view-transition-name` → `view` + `transition` + `name`). Over 98.5% of tokens in unseen web-dev queries and guides are already in `words.json`.
   - **Exact lexical coverage via Hybrid BM25:** At search time, [`searchUseCases()`](../search.ts) fuses dense cosine similarity with per-chunk Okapi BM25 via Reciprocal Rank Fusion (`k = 60`). Even if a brand-new guide introduces a net-new single-token identifier that is not yet in `words.json`, BM25 indexes that token immediately from the guide chunks and surfaces the guide on exact keyword matches while `StaticEmbedder` matches the surrounding prose and hyphenated concepts.

### 2. Periodic Vocabulary & Weight Refresh (`node src/rag/train-static-model.ts`)

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
