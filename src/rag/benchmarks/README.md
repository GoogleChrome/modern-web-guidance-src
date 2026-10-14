# RAG Benchmarks & Evaluation Suite

This directory contains the evaluation framework used to benchmark retrieval quality, context token cost, out-of-scope rejection, and embedder latency for the `modern-web-guidance` search pipeline (`src/rag/search.ts`).

> **Read the published engineering report on the initial embedding model, quantization, and runtime benchmarks here:** [go/rxolz](http://go/rxolz)

## Datasets & Relevance Judgments (Qrels)

Retrieval is evaluated against three complementary query sets paired with pooled, multi-label relevance judgments (`0..2` grade per candidate guide plus `in_domain` / `out_of_domain` scope):

| Dataset | Location | Size | Description |
| :--- | :--- | :---: | :--- |
| **`wild`** | GCS (`out/benchmarks/wild/v1/`, gitignored) | 1,000 | Anonymized real-world search queries sampled from 90-day CLI telemetry (stratified across head/tail traffic and near-threshold `0.30..0.42` similarity). Downloaded and SHA-256-verified automatically via `ensureWildDataset()`. |
| **`harness`** | `data/harness-{queries,qrels}.jsonl` | 160 | Real `skill_search` queries mined from nightly evaluation trajectories across Claude Code, Codex CLI, and Gemini CLI, paired with `expectedGuide` task targets and pooled multi-label qrels. |
| **`oos`** | `data/oos-{queries,qrels}.jsonl` | 90 | Curated out-of-scope queries (`50` far out-of-domain like Python/Kubernetes/SQL, `40` near-miss web topics outside our corpus like React hooks, Next.js App Router, Tailwind, WebGL) to measure false-positive admission and wasted context tokens. |

### Grading Scale
Each query's candidate pool (union of top-5 results across dense max-pool, dense mean-pool, whole-guide BM25, and `expectedGuide`) is graded by `gemini-3.8-flash` against compact guide cards (`src/rag/benchmarks/judge-prompts.ts`):
- **`2` (Directly answers)**: Dedicated coverage of the core web platform feature or pattern asked for.
- **`1` (Partially useful)**: Covers one facet of a multi-part query or an adjacent technique.
- **`0` (Not useful)**: Tangential or unrelated.

In blind validation against 69 human judgments across wild and harness queries, this judge setup achieved **0.78 quadratic-weighted Cohen's $\kappa$**, **93.3% binary hit agreement**, and **92.8% answerability agreement**.

## Directory Structure

- **`bench-rag.ts`**: Primary benchmark CLI (`pnpm benchmark:rag`). Evaluates the current working tree or runs side-by-side A/B comparisons between any two git refs (`--base <ref> --head <ref>`) using isolated git worktrees and embedder-hash-keyed query vector caching.
- **`metrics.ts`**: Computes per-query and aggregate `nDCG@5`, `Success@1` ($\text{grade} \ge 1$), `Hit@1` ($\text{grade} = 2$), `MRR@5`, `Recall@5`, `Expected@1`, average returned tokens per query, answerable empty-return rate, OOS false-positive admission rate (`near` / `far`), unjudged rate, and 2,000-iteration paired bootstrap 95% confidence intervals.
- **`dataset.ts`** & **`dataset.test.ts`**: JSONL schemas, parsers, boundary validators, and the GCS `wild` dataset loader (`ensureWildDataset`).
- **`judge-fill.ts`** & **`judge-prompts.ts`**: Multi-retriever candidate pooling and incremental LLM-as-judge grading for any unjudged `(query, guide)` pairs.
- **`mine-harness.ts`**: Extracts `skill_search` queries from nightly agent evaluation trajectories in GCS.
- **`refresh-wild.ts`**: Samples and appends new telemetry search queries and uploads updated `wild` dataset versions (`--upload`).
- **`benchmark-latency.ts`**: Measures cold-start and warm median inference latency for `TfjsEmbedder`.

## Running the Benchmark

```bash
# Run full benchmark (wild + harness + oos) on the current working tree:
pnpm benchmark:rag

# Run only checked-in public datasets (no GCS credentials required; runs in CI):
pnpm benchmark:rag --public-only

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
# Incrementally judge any ungraded top-5 candidates on public datasets:
node --env-file=.env src/rag/benchmarks/judge-fill.ts src/rag/benchmarks/data/harness-queries.jsonl src/rag/benchmarks/data/harness-qrels.jsonl

# Refresh wild queries from a new telemetry export JSONL, judge new candidates, and upload to GCS:
node --env-file=.env src/rag/benchmarks/refresh-wild.ts /path/to/telemetry-events.jsonl --upload
```

## Historical Milestones & Prior Results

1. **Chunk Max-Pooling & Pure-JS TFJS Runtime (`#528` / [go/rxolz](http://go/rxolz), April 2026)**:
   - Switching from early single-chunk deduplication (`no-maxsim`: `54.8%` Top-1, `0.695` MRR) to per-guide max-similarity pooling across chunks (`maxsim`: `70.3%` Top-1, `0.821` MRR) improved Top-1 accuracy by **+15.5pp** on the initial 848-query synthetic pool.
   - Moving from `onnxruntime-node` / `wasm` to pure-JS `@tensorflow/tfjs` with `q8` weight quantization preserved accuracy (`69.6%` Top-1, `0.812` MRR vs `70.3%` / `0.821` native ONNX) while eliminating native binary install failures (`~685ms` cold start, `~228ms` warm median per query).
2. **Minimal BERT WordPiece Tokenizer (`#1718`, `394e1220f`, Oct 2026)**:
   - Replaced `@huggingface/transformers` `BertTokenizer` at runtime with a lightweight tokenizer config (`tfjs-embedder.test.ts` verifies 0 token-ID mismatches across all benchmark queries and Unicode edge cases) with identical retrieval scores (`0.000` nDCG@5 delta).
