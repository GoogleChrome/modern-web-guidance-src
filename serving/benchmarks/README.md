# RAG Benchmarks & Evaluation Suite

This directory contains the offline evaluation framework used to rigorously benchmark the vector search accuracy of the `serving` guidance server. 

Because embedding models and chunking strategies can be notoriously difficult to validate anecdotally, we actively maintain this isolated test suite to measure `Top-1 Hit Rate` and `Mean Reciprocal Rank` (MRR) dynamically over an 850-query dataset.

> **Read the published engineering report with the historical benchmarking results here:** [go/rxolz](http://go/rxolz)

## Directory Structure

*   **`rag/`**: Contains the active test instrumentation.
    *   **`generate-eval-queries.ts`**: Uses the Gemini API to rapidly synthesize 50 highly-realistic edge-case search queries per guide, automatically updating the master pool.
    *   **`eval-rag-suite.ts`**: The core statistical runner. By default, it executes a full-pool deterministic evaluation sequence against the entirety of the master queries to guarantee strictly comparable Top-1 MRR scores and eliminate all randomized sampling noise.
    *   **`eval-rag-search.ts`**: The operational script that executes queries natively against the database and measures vector retrieval accuracy against the ground-truth target.
    *   **`gpt4all-embedder.ts`**: An isolated wrapper used specifically by the benchmarking suite to test historical C++ natively-bound `.gguf` quantizations completely separate from the production Transformers.js workflow.
    *   **`plot-evals.ts`**: Dynamically compiles the historic `NaN/JSON` metrics logged out of the test suite into an interactive Plotly HTML scatter-box diagram.
*   **`data/`**: The strictly segregated data mapping.
    *   `eval-queries-pool.json`: The massive master dataset of edge-case prompts.
    *   `eval-results.json`: A historic map of variance performance data plotted over time natively by the suite.

## Running the Benchmark

You can execute the primary variance evaluation test from the root of the repository. By default, it runs a 10-iteration loop over a core set of specific MiniLM/Gemma models.

```bash
npm run benchmark:rag
```

### CLI Overrides
You can customize the evaluation loops by passing flags explicitly to the script:
```bash
# Run a quick single-iteration test against all master queries:
npm run benchmark:rag -- --runs=1 --models=Xenova/all-MiniLM-L6-v2@q8

# Opt-out of full pool evaluation to test random variance sampling instead:
npm run benchmark:rag -- --random-subset
```

## Visualizing Results

The `plot-evals.ts` script generates an HTML canvas that dynamically executes a browser `fetch()` for the local JSON results.

```bash
node --experimental-strip-types benchmarks/rag/plot-evals.ts
```

Because browsers aggressively block `file://` protocol network requests via CORS, you cannot simply double-click the output file. Instead, we have provided a clean local dev-server proxy:

```bash
npm run plot:serve
```
This commands boots a static hosting daemon over port 3000, allowing you to easily view the interactive metrics scatter plot cleanly.
