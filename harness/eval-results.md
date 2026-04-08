# Evaluation Results Management

This document covers how evaluation results are stored, uploaded to Google Cloud Storage (GCS), and the workflows for syncing and backfilling metrics.

## Storage Location
Evaluation results are stored locally in:
- `harness/results/` (default within the repo).
- Or a custom external directory (e.g., `~/guidance-results`).

Each suite has its own directory containing:
- `evals.json`: Summary of all runs and assertions.
- `evals.md`: Markdown report of the suite.
- Numbered directories (`1`, `2`, `3`...) for each run, containing agent logs and grader results.

---

## Uploading to GCS
We use `harness/upload_suite.ts` to upload a suite to GCS.

### How it works
1. Requires `evals.json` to exist in the suite directory (ensures evaluation was run).
2. Uploads all files in the suite directory to `gs://guidance-evals/<suite-name>/` (skipping `node_modules`).
3. Uploads concurrently (chunked to 50 files at a time).

### Command
```bash
pnpm upload <suite-name>
```
*(This maps to running `node --experimental-strip-types harness/upload_suite.ts`)*

---

## Workflows

### 1. Syncing from GCS (Downloading)
If you need to pull down suites from GCS that you don't have locally (e.g., to run backfill on them):

```bash
gcloud storage rsync gs://guidance-evals ~/guidance-results
```

*   **Safe**: It does not delete local files (like `.git`) by default unless you pass `--delete`.
*   **Dry Run**: To see what it would do without touching files:
    ```bash
    gcloud storage rsync gs://guidance-evals ~/guidance-results --dry-run
    ```

### 2. Backfilling Metrics
When metrics reporting logic changes, you can backfill all suites in a directory:

```bash
# Backfill local repo results
node harness/backfill.ts

# Backfill a custom directory (e.g., synced from GCS)
node harness/backfill.ts ~/guidance-results
```
This updates `evals.json` and `evals.md` in each suite directory.

### 3. Pushing Updates to GCS
After backfilling, you should push the updated summaries back to GCS.

*(Note: Currently `upload_suite.ts` re-uploads all files. We plan to add a `--summary-only` flag to only upload `evals.json` and `evals.md` to make this sync extremely fast).*
