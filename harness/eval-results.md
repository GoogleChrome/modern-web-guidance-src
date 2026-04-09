# Evaluation Results Management

This document covers how evaluation results are stored, uploaded to Google Cloud Storage (GCS), and the workflows for syncing and backfilling metrics.

## Storage Location
Evaluation results are stored locally in:
- `harness/results/` (default within the repo).
- Or a custom external directory (e.g., `~/guidance-evals`).

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
# Upload full suite from local repo results
pnpm upload <suite-name>

# Upload with flags or from custom directory
node harness/upload_suite.ts <suite-name> [--summary-only] [custom_results_dir]
```

---

## Workflows

### 1. Syncing from GCS (Downloading)
If you need to pull down suites from GCS that you don't have locally (e.g., to run backfill on them):

```bash
gcloud storage rsync gs://guidance-evals ~/guidance-evals --recursive
```

*   **Recursive**: You **MUST** pass `--recursive` (or `-r`), otherwise it will not copy files inside the suite folders!
*   **Safe by Default**: It does not delete local files (like `.git`) by default.
*   **Destructive Flag**: If you want to delete local files that aren't in the bucket, use `--delete-unmatched-destination-objects`. 
    > [!WARNING]
    > If you use this flag when pulling from GCS to local, **it WILL delete your `.git` folder** (because `.git` is not on GCS). Move your `.git` folder out of the target directory before running it with this flag!
*   **Dry Run**: To see what it would do without touching files:
    ```bash
    gcloud storage rsync gs://guidance-evals ~/guidance-evals --recursive --dry-run
    ```

### 2. Backfilling Metrics
When metrics reporting logic changes, you can backfill all suites in a directory:

```bash
# Backfill local repo results
node harness/backfill.ts

# Backfill a custom directory (e.g., synced from GCS)
node harness/backfill.ts ~/guidance-evals
```
This updates `evals.json` and `evals.md` in each suite directory.

### 3. Pushing Updates to GCS
After backfilling, you should push the updated summaries back to GCS.

You can use the **`--summary-only`** flag to only upload `evals.json` and `evals.md`, making the sync extremely fast.

To upload **all** suites in bulk from a custom directory, you can use a simple shell loop:

```bash
# Bulk upload ONLY summaries for all suites in ~/guidance-evals
for d in ~/guidance-evals/*/ ; do
    suite=$(basename "$d")
    node harness/upload_suite.ts "$suite" ~/guidance-evals --summary-only
done
```

For a single suite:

```bash
# Upload ONLY summaries from your custom directory
node harness/upload_suite.ts <suite-name> ~/guidance-evals --summary-only

# Upload EVERYTHING from your custom directory
node harness/upload_suite.ts <suite-name> ~/guidance-evals
```
