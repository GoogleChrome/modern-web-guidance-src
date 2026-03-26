# RAG Benchmarks & Evaluation Suite

This directory contains the offline evaluation framework used to rigorously benchmark the vector search accuracy of the `modern-web-mcp` guidance server. 

Because embedding models and chunking strategies can be notoriously difficult to validate anecdotally, we actively maintain this isolated test suite to measure `Top-1 Hit Rate` and `Mean Reciprocal Rank` (MRR) dynamically over an 850-query dataset.

## Directory Structure

*   **`rag/`**: Contains the active test instrumentation.
    *   **`generate-eval-queries.ts`**: Uses the Gemini API to rapidly synthesize 50 highly-realistic edge-case search queries per guide, automatically updating the master pool.
    *   **`test-variance.ts`**: The core statistical runner. Automatically shuffles exactly 5 random queries per guide out of the master pool, loops the evaluation cycle 10 times across different model quantization pipelines, and measures accuracy variance. 
    *   **`eval-search.ts`**: The operational script that executes queries natively against the database and measures vector retrieval accuracy against the ground-truth target.
    *   **`run-chunked.ts`**: An isolated script to execute the variance tests exclusively over the deprecated "chunked" database strategy.
    *   **`plot-evals.ts`**: Dynamically compiles the historic `NaN/JSON` metrics logged out of the test suite into an interactive Plotly HTML scatter-box diagram.
*   **`data/`**: The strictly segregated data mapping.
    *   `eval-queries-pool.json`: The massive master dataset of edge-case prompts.
    *   `eval-queries.json`: The active 85-query subset currently locked-in for evaluation.
    *   `eval-results.json`: A historic map of variance performance data plotted over time natively by the suite.

## Running the Benchmark

You can execute the primary variance evaluation test from the root of the repository:

```bash
npm run benchmark:rag
```

To just visualize the data history that's already been collected natively, you can run:
```bash
node --experimental-strip-types benchmarks/rag/plot-evals.ts
```
*(This outputs an interactive plot natively to `benchmarks/data/eval-plot.html`)*
