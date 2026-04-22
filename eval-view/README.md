# Eval-View Dashboard

The Eval-View Dashboard lets you visualize test results from the Guidance eval harness.

The dashboard can be view in two different ways:

1. Locally, with `gd dashboard`, via `server.js`.
2. Remotely, with GitHub Pages at **[https://googlechrome.github.io/guidance/](https://googlechrome.github.io/guidance/)** (static hosting).

The `eval-view` codebase contains complexity to support both views.

## Viewing the Dashboard

The dashboard is continuously deployed to GitHub Pages and can be accessed at:
The dashboard fetches evaluation data from Google Cloud Storage (GCS) at `gs://guidance-evals/`. It requires Google Authentication to read from the bucket.

1.  **Run evaluations locally**: Generate your test metrics in `harness/results/`.
2.  **Upload piecewise**: Use `pnpm run upload <suite>` in the `harness` directory to push your specific suite to GCS.
3.  **App deployment**: Run `pnpm run deploy-pages` in `eval-view` to upload static manifests to GCS and push the viewer to GitHub Pages.


## Local Development

To run the dashboard locally and see local results (run from the root `guidance` directory):

```bash
pnpm dashboard
```

## Deploying Changes

If you make modifications to the `eval-view` code (HTML, CSS, JS), you can deploy your changes directly to the live GitHub Pages site.

From the **`eval-view` worktree directory**, run:
```bash
pnpm run deploy-pages
```

This will:
1. Run `node generate-manifests.js` to generate the manifests.
2. Use `gcloud storage rsync` to sync results to GCS.
3. Push the viewer code to the `gh-pages` branch on GitHub.

### Parity Testing
To ensure your changes will work on the static GitHub Pages host, you can run the dashboard in a "Strict Static" mode that disables all dynamic APIs:

```bash
# From the root directory
pnpm dashboard:static
```

### Piecewise Suite Upload
If you just want to upload a new evaluation suite without redeploying the whole web app:

From the **`harness` directory**, run:
```bash
pnpm run upload <test-suite-id>
```
This uses a temporary git worktree to pull `gh-pages` and push just your suite metrics to it, without polluting your active workspace branch!
