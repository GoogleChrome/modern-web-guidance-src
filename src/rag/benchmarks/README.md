# RAG Benchmarks & Evaluation Suite

This directory contains the evaluation framework used to benchmark retrieval quality, context token cost, out-of-scope rejection, and embedder latency for the `modern-web-guidance` search pipeline (`src/rag/search.ts`).

> **Read the published engineering reports on the embedding pipeline, `wild-v2` corpus construction, and telemetry runbook here:** [go/mwg-search-benchmarking](http://go/mwg-search-benchmarking) · [Search Quality Dashboard (`/search/`)](../../dashboard/search/index.html)

## Datasets & Relevance Judgments (Qrels)

Retrieval is evaluated against three complementary query sets paired with pooled, multi-label relevance judgments (`0..2` grade per candidate guide plus `in_domain` / `out_of_domain` scope):

| Dataset | Location | Size | Description |
| :--- | :--- | :---: | :--- |
| **`wild`** | Internal corpus (see [go/mwg-search-benchmarking](http://go/mwg-search-benchmarking)) | 4,000 | Anonymized real-world search queries sampled from post-#1850 CLI telemetry with a fixed 50/50 dev/test split (2,000 dev / 2,000 test, stratified by query word count; see [go/mwg-search-benchmarking](http://go/mwg-search-benchmarking) for extraction & PII screening details). Downloaded and SHA-256-verified automatically via `ensureWildDataset()`. Historical `v1` (1,000 pre-#1850 queries) remains accessible via `--wild-version v1`. |
| **`agent`** | `data/agent-{queries,qrels}.jsonl` | 1,029 | Real `skill_search` queries mined from nightly evaluation trajectories across Antigravity CLI, Claude Code, Codex CLI, and Jetski CLI, deduplicated by normalized query text, filtered for prompt and trajectory answer leakage, and partitioned by connected components of expected guides into a dev/test split (515 dev / 514 test, no shared guides) evaluated with guide-cluster bootstrap CIs. |
| **`harness`** | `data/harness-{queries,qrels}.jsonl` | 160 | Earlier frozen 160-query agent benchmark (July–Oct 2026) retained for reproducing historical evaluation numbers; superseded by `agent`. |
| **`oos`** | `data/oos-{queries,qrels}.jsonl` | 90 | Curated out-of-scope queries (`50` far out-of-domain like Python/Kubernetes/SQL, `40` near-miss web topics outside our corpus like React hooks, Next.js App Router, Tailwind, WebGL) to measure false-positive admission and wasted context tokens. |

### Anti-Overfitting Guardrails

When evaluating retrieval or distilling word tables, the benchmark suite enforces three anti-overfitting guardrails:

1. **Zero stemmed token-bag overlap (`wild-v2`):** The 4,000 telemetry queries are partitioned 50/50 into `2,000 dev` and `2,000 test` such that no two queries across splits share the same stemmed bag of words. This eliminates vocabulary and phrasing leakage between dev and test sets.
2. **Connected-component guide partitioning (`agent`):** The 1,029 nightly agent queries are grouped by connected components of their target `expectedGuide` IDs (70 test clusters) so zero guides are shared between `dev` (`515`) and `test` (`514`). Bootstrap confidence intervals resample across whole guide clusters.
3. **Human-calibrated LLM relevance pooling ($\kappa = 0.78$):** Candidate pools (union of top results across dense max-pooling, BM25, and expected guides) are scored `0..2` by `gemini-3.8-flash` (rubric v1, temperature 0). This judge was validated against 69 blind human ratings across wild and harness queries, achieving **0.78 quadratic-weighted Cohen's $\kappa$**, **93.3% binary hit agreement**, and **92.8% answerability agreement**.

### Grading Scale

Each query's candidate pool is graded against compact guide cards (`src/rag/benchmarks/judge-prompts.ts`):
- **`2` (Directly answers)**: Dedicated coverage of the core web platform feature or pattern asked for.
- **`1` (Partially useful)**: Covers one facet of a multi-part query or an adjacent technique.
- **`0` (Not useful)**: Tangential or unrelated.

## Core Metrics (`metrics.ts`)

Standard information retrieval metrics like raw recall don't account for how coding agents consume search output. We evaluate retrieval using:

- **`Hit@K`**: Percentage of leaf-answerable queries where at least one grade-2 leaf guide is ranked within the top $K$ results.
- **`Leaf nDCG@K`**: Normalized Discounted Cumulative Gain where broad overview index pages (e.g., `css` or `html` discipline guides) are capped at `grade = 1` or zeroed on leaf metrics so specific feature guides rank first.
- **Signal-to-Noise (SNR)**:
  $$\text{SNR} = 0.7 \cdot \text{Recall} + 0.3 \cdot \text{Leaf nDCG} - \text{TokenTax}$$
  Balances retrieval quality against context token waste:
  - **Irrelevant guide penalty:** 1.4 points subtracted per 100 tokens spent on irrelevant guides, steepening to 4.5 points per 100 tokens past 500 tokens.
  - **Empty return penalty:** 1,500 wasted fallback tokens when an answerable query returns `[]`, triggering the agent to fall back to dumping the entire catalog via `modern-web-guidance list`.

`metrics.ts` also tracks `Success@1` ($\text{grade} \ge 1$), `LeafRecall@5`, `Disc@1` (broad discipline top-1 rate), `MRR@5`, `Expected@1`, average tokens per query, empty-return rate, OOS false-positive rate (`near` / `far`), unjudged rate, and 2,000-iteration paired bootstrap 95% confidence intervals.

## Directory Structure

- **`bench-rag.ts`**: Primary benchmark CLI (`pnpm benchmark:rag`). Evaluates the current working tree or runs side-by-side A/B comparisons between any two git refs (`--base <ref> --head <ref>`) using isolated git worktrees and embedder-hash-keyed query vector caching.
- **`metrics.ts`**: Computes per-query and aggregate `nDCG@5` (with broad discipline guides capped at `grade = 1` when a `grade = 2` leaf guide exists), `Success@1` ($\text{grade} \ge 1$), `Hit@1` ($\text{grade} = 2$), `LeafRecall@5` ($\text{grade} = 2$ leaf guides), `Disc@1` (broad discipline top-1 rate), `MRR@5`, `Recall@5`, `Expected@1`, average returned tokens per query, answerable empty-return rate, OOS false-positive admission rate (`near` / `far`), unjudged rate, and 2,000-iteration paired bootstrap 95% confidence intervals.
- **`dataset.ts`** & **`dataset.test.ts`**: JSONL schemas, parsers, boundary validators, and the GCS `wild` dataset loader (`ensureWildDataset`).
- **`judge-fill.ts`** & **`judge-prompts.ts`**: Multi-retriever candidate pooling and incremental LLM-as-judge grading for any unjudged `(query, guide)` pairs.
- **`mine-harness.ts`**: Extracts `skill_search` queries from nightly agent evaluation trajectories in GCS. Note that `data/harness-queries.jsonl` is the earlier frozen 160-query snapshot (July–Oct 2026), retained for continuity alongside the expanded 1,029-query `agent` dataset.
- **`benchmark-latency.ts`**: Measures cold-start and warm median inference latency for `TfjsEmbedder`.

## Running the Benchmark

```bash
# Run full benchmark on the dev split (wild + agent dev splits + oos) on the current working tree:
pnpm benchmark:rag

# Run benchmark specifically on the held-out test split (for final reporting):
pnpm benchmark:rag --split test

# Run benchmark on all splits combined:
pnpm benchmark:rag --split all

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

## Historical Milestones & Scoreboard

Detailed historical milestone scores, runtime footprint comparisons (cold start latency, peak RSS, npm package size), and the $K = 1 \dots 20$ Signal-to-Noise trade-off curve are tracked interactively on the **[Search Quality Dashboard (`src/dashboard/search/index.html`)](../../dashboard/search/index.html)** (`src/dashboard/search/search.js`), which serves as the single source of truth for search quality progression and system benchmarks.
