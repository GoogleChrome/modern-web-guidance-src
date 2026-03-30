# Eval-View Dashboard

The Eval-View Dashboard lets you visualize test results from the Guidance eval harness.

The dashboard can be view in two different ways:

1. Locally, with `gd dashboard`, via `server.js`.
2. Remotely, with GitHub Pages at **[https://googlechrome.github.io/guidance/](https://googlechrome.github.io/guidance/)** (static hosting).

The `eval-view` codebase contains complexity to support both views.

## Viewing the Dashboard

The dashboard is continuously deployed to GitHub Pages and can be accessed at:
**[https://googlechrome.github.io/guidance/](https://googlechrome.github.io/guidance/)**

The dashboard fetches evaluation data from a static `./results/` directory hosted directly on GitHub Pages. There is no longer a dependency on Google Cloud Storage for remote viewing.

1.  **Run evaluations locally**: Generate your test metrics in `harness/results/`.
2.  **Upload piecewise**: Use `pnpm run upload <suite>` in the `harness` directory to push your specific suite to the live site.
3.  **App deployment**: Run `pnpm run deploy-pages` in `eval-view` to rebuild the app files and static `suites.gen.json` manifest.


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
1. Run `node generate-manifests.js` to generate the `features_mapping.gen.js`, `suites.gen.json`, and all `run-files.gen.json` manifests.
2. Copy `tasks/` and `base_apps/` for direct viewing.
3. Merge them all using standard `gh-pages` module with `--add` flag (to avoid clobbering existing `results/` from remote).
4. Push to the `gh-pages` branch on GitHub.

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
