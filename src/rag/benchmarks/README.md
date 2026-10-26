# RAG Benchmarks & Evaluation Suite

This directory contains the evaluation framework used to benchmark retrieval quality, context token cost, out-of-scope rejection, and embedder latency for the `modern-web-guidance` search pipeline (`src/rag/search.ts`).

> **Read the published engineering report on the initial embedding model, quantization, and runtime benchmarks here:** [go/rxolz](http://go/rxolz)

## Datasets & Relevance Judgments (Qrels)

Retrieval is evaluated against three complementary query sets paired with pooled, multi-label relevance judgments (`0..2` grade per candidate guide plus `in_domain` / `out_of_domain` scope):

| Dataset | Location | Size | Description |
| :--- | :--- | :---: | :--- |
| **`wild`** | GCS (`gs://guidance-rag-evals/v2/`, cached at `out/benchmarks/wild/v2/`, gitignored) | 4,000 | Anonymized real-world search queries sampled from post-#1850 CLI telemetry with a fixed 50/50 dev/test split (2,000 dev / 2,000 test, stratified by query word count). Downloaded and SHA-256-verified automatically via `ensureWildDataset()`. Historical `v1` (1,000 pre-#1850 queries) remains archived in GCS (`gs://guidance-rag-evals/v1/`) and accessible via `--wild-version v1`. |
| **`harness`** | `data/harness-{queries,qrels}.jsonl` | 160 | Real `skill_search` queries mined from nightly evaluation trajectories across Antigravity CLI, Claude Code, Codex CLI, and Jetski CLI, paired with `expectedGuide` task targets and pooled multi-label qrels. |
| **`oos`** | `data/oos-{queries,qrels}.jsonl` | 90 | Curated out-of-scope queries (`50` far out-of-domain like Python/Kubernetes/SQL, `40` near-miss web topics outside our corpus like React hooks, Next.js App Router, Tailwind, WebGL) to measure false-positive admission and wasted context tokens. |

### Grading Scale
Each query's candidate pool (union of top-5 results across dense max-pool, dense mean-pool, whole-guide BM25, and `expectedGuide`) is graded by `gemini-3.8-flash` against compact guide cards (`src/rag/benchmarks/judge-prompts.ts`):
- **`2` (Directly answers)**: Dedicated coverage of the core web platform feature or pattern asked for.
- **`1` (Partially useful)**: Covers one facet of a multi-part query or an adjacent technique.
- **`0` (Not useful)**: Tangential or unrelated.

In blind validation against 69 human judgments across wild and harness queries, this judge setup achieved **0.78 quadratic-weighted Cohen's $\kappa$**, **93.3% binary hit agreement**, and **92.8% answerability agreement**.

## Directory Structure

- **`bench-rag.ts`**: Primary benchmark CLI (`pnpm benchmark:rag`). Evaluates the current working tree or runs side-by-side A/B comparisons between any two git refs (`--base <ref> --head <ref>`) using isolated git worktrees and embedder-hash-keyed query vector caching.
- **`metrics.ts`**: Computes per-query and aggregate `nDCG@5` (with broad discipline guides capped at `grade = 1` when a `grade = 2` leaf guide exists), `Success@1` ($\text{grade} \ge 1$), `Hit@1` ($\text{grade} = 2$), `LeafRecall@5` ($\text{grade} = 2$ leaf guides), `Disc@1` (broad discipline top-1 rate), `MRR@5`, `Recall@5`, `Expected@1`, average returned tokens per query, answerable empty-return rate, OOS false-positive admission rate (`near` / `far`), unjudged rate, and 2,000-iteration paired bootstrap 95% confidence intervals.
- **`dataset.ts`** & **`dataset.test.ts`**: JSONL schemas, parsers, boundary validators, and the GCS `wild` dataset loader (`ensureWildDataset`).
- **`judge-fill.ts`** & **`judge-prompts.ts`**: Multi-retriever candidate pooling and incremental LLM-as-judge grading for any unjudged `(query, guide)` pairs.
- **`mine-harness.ts`**: Extracts `skill_search` queries from nightly agent evaluation trajectories in GCS. Note that `data/harness-queries.jsonl` is a frozen historical benchmark mined from pre-`#2056` trajectories (before `guided` runs injected `retrieve <guideName>` hints into `task.md`), and remains a static regression suite for agent query phrasings.
- **`benchmark-latency.ts`**: Measures cold-start and warm median inference latency for `TfjsEmbedder`.

## Running the Benchmark

```bash
# Run full benchmark (wild + harness + oos) on the current working tree:
pnpm benchmark:rag

# Run benchmark specifically on the held-out test split of the wild dataset:
pnpm benchmark:rag --split test

# Run only checked-in public datasets (no GCS credentials required; runs in CI):
pnpm benchmark:rag --public-only

# Run against historical wild-v1 dataset:
pnpm benchmark:rag --wild-version v1

# A/B compare a branch or commit against origin/main (with paired 95% bootstrap CIs):
pnpm benchmark:rag --base origin/main --head HEAD

# Compare two historical commits against the current guide corpus:
pnpm benchmark:rag --base 394e1220f~1 --head 394e1220f

# Measure TFJS embedder cold-start and warm inference latency:
node src/rag/benchmarks/benchmark-latency.ts
```

## Updating Qrels & Datasets

When new guides are added or retrieval changes surface previously unpooled guides (causing `Unjudged%` to rise):

```bash
# Incrementally judge any ungraded top-10 candidates on public datasets:
node --env-file=.env src/rag/benchmarks/judge-fill.ts src/rag/benchmarks/data/harness-queries.jsonl src/rag/benchmarks/data/harness-qrels.jsonl
```

## Historical Milestones & Prior Results

1. **Chunk Max-Pooling & Pure-JS TFJS Runtime (`#528` / [go/rxolz](http://go/rxolz), April 2026)**:
   - Switching from early single-chunk deduplication (`no-maxsim`: `54.8%` Top-1, `0.695` MRR) to per-guide max-similarity pooling across chunks (`maxsim`: `70.3%` Top-1, `0.821` MRR) improved Top-1 accuracy by **+15.5pp** on the initial 848-query synthetic pool.
   - Moving from `onnxruntime-node` / `wasm` to pure-JS `@tensorflow/tfjs` with `q8` weight quantization preserved accuracy (`69.6%` Top-1, `0.812` MRR vs `70.3%` / `0.821` native ONNX) while eliminating native binary install failures (`~685ms` cold start, `~228ms` warm median per query).
2. **Minimal BERT WordPiece Tokenizer (`#1718`, `394e1220f`, Oct 2026)**:
   - Replaced `@huggingface/transformers` `BertTokenizer` at runtime with a lightweight tokenizer config (`tfjs-embedder.test.ts` verifies 0 token-ID mismatches across all benchmark queries and Unicode edge cases) with identical retrieval scores (`0.000` nDCG@5 delta).
3. **Hybrid Okapi BM25 + Dense Retrieval via RRF (`#2052`, Oct 2026)**:
   - Fusing per-chunk max-pooled Okapi BM25 with dense `all-MiniLM-L6-v2` cosine ranking via Reciprocal Rank Fusion (`k = 60`, `0.30` query floor) and replacing `#1853`'s two-stage similarity gates improved 1,000-query `wild` nDCG@5 from `0.468` (`#1853`) / `0.554` (pre-`#1853` dense max-pool) to **`0.590`** (`+0.123` vs `#1853`, `MRR@5` `0.638` → **`0.772`**) and `harness` nDCG@5 from `0.833` to **`0.869`** (`MRR@5` `0.958` → **`0.978`**).
