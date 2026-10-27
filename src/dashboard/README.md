# Eval-View Dashboard

The Eval-View Dashboard lets you visualize test results from the Modern Web Guidance eval harness.

The dashboard can be viewed in two different ways:

1. Locally, with `gd dashboard`, via `server.js`.
2. Remotely, with GitHub Pages at **[https://googlechrome.github.io/modern-web-guidance-src/](https://googlechrome.github.io/modern-web-guidance-src/)** (static hosting).

The `eval-view` codebase contains complexity to support both views.

## Viewing the Dashboard

The dashboard is continuously deployed to GitHub Pages and can be accessed at:
**[https://googlechrome.github.io/modern-web-guidance-src/](https://googlechrome.github.io/modern-web-guidance-src/)**

### Authentication & Permissions

When you visit the site, there is a button to sign in with your Google account. Note that simply logging in does not grant you access to the data.

The application fetches evaluation data directly from the private Google Cloud Storage bucket (`guidance-evals`) in the `chrome-kiwi-air-force-dev` GCP project.

> [!IMPORTANT]
> To view the suites and results on the dashboard, **your Google email address must be granted access** in the Google Cloud Console. You will need at minimum the `Storage Object Viewer` role on the `guidance-evals` bucket in the `chrome-kiwi-air-force-dev` project.

## Local Development

To run the dashboard locally and see local results (run from the root `modern-web-guidance-src` directory):

```bash
pnpm dashboard
```

`server.js` serves the dashboard on `http://localhost:8081` and reads local suites from `results/suites/<suite>/evals.json` (`suitesDir` in `src/core/paths.ts`). `/api/suites` extracts a summary per suite with `extractSuiteSummary()` and memoizes it by the file's mtime and size, so dropping a new `evals.json` into `results/suites/` is picked up on the next request without a restart. Changes to `summary-extractor.js`, `a11y-classifier.js`, or `utils.js` **do** require a server restart because `server.js` imports them at startup; HTML/CSS/JS served to the browser is read fresh from disk.

Useful environment variables: `PORT` (default `8081`), `NO_OPEN=true` (do not launch a browser), `USE_MOCK_RESULTS=true` (serve `src/dashboard/mock-results/` instead of `results/suites/`, as the e2e tests do).

Add `?source=local`, `?source=remote`, or `?source=static` to force a data source; without it, `localhost`, `127.0.0.1`, and `*.googlers.com` hosts default to `local` and everything else to `remote`.

### Parity Testing
To ensure your changes will work on the static deployment host, you can run the dashboard in a "Static" mode that serves files via `statikk` to mimic static deployment structure:

```bash
# From the project root directory
STATIC=true gd dashboard
```

## Page Structure

The landing page (`index.html`) is structured into four progressive stages:

1. **Stage 1 — Headline takeaways & hero** (`hero.js`, `hero.css`): two number-forward cards (overall pass-rate uplift in pp and accessibility-subscore uplift in pp), a per-agent-family table, and a "How we measure" disclosure. All numbers come from `computeHeadlineInsights()` in `insights.js`, which pools recent nightly suites per agent family (`claude_code`, `codex_cli`, `antigravity_cli` + its predecessor `jetski_cli`).
2. **Stage 2 — A/B task spotlight** (`showcase.js`, `showcase.css`): interactive side-by-side comparison of guided versus unguided implementations with live diffs, verdict highlights, and deterministic grader check inspection.
3. **Stage 3 — Browse all runs** (`landing.js`, `landing.css`): the sortable suites table (nightly suites by default, ad-hoc runs behind a toggle), per-guide hover previews, and unguided leak rate tracking.
4. **Stage 4 — Detailed run diagnostics** (`dashboard.js`, `dashboard.css`): per-suite summary cards and detailed per-task accordion diagnostics linked from individual suite runs.

Both layers load data through `ApiClient` in `api.js`:

- `api.getManifest('slim' | 'full' | 'insights')` resolves `suites.slim.gen.json`, `suites.gen.json`, or `headline-insights.gen.json` and transparently falls back to deriving the requested shape from the full manifest (or `/api/suites` locally) when a file is missing.
- `api.getHeadlineInsights({ onUpdate })` returns the hero numbers, hydrating `a11yStats` / `efficiencyStats` from each selected suite's `evals.json` (`hydrateMissingStats()`) when the manifest predates them.

`generate-manifests.js` writes all three manifest files for static builds. `src/harness/upload-suite.ts` keeps its default upload behavior; `--refresh-stale`, `--derived-manifests`, `--gzip`, and the explicit `--reconcile-manifest [--dry-run]` command are opt-in and are not run by the nightlies.

## Testing

```bash
pnpm typecheck                                  # tsc + tsc -p src/dashboard/tsconfig.json
node --test "src/dashboard/*.test.ts"           # unit tests (extractor, classifier, insights, api, manifests)
pnpm test:e2e                                   # Playwright, boots the server on :11432 with mock results
```

`dashboard.spec.js` covers the landing table, suite and guide pages, the hero (empty state, populated state via `fixtures/hero-suites.fixture.json`, keyboard-operable disclosure, heading hierarchy), and the browse section (text equivalents, `aria-sort`, scheduled-only toggle, suite summary cards). The fixture is a trimmed `/api/suites` response for one nightly suite per agent family; regenerate it from a running local server if the summary schema changes.

Before shipping UI changes, also run an axe scan and Lighthouse (performance, accessibility, best practices) against `http://localhost:8081/?source=local` and one `dashboard.html?testId=…` page; the bar is zero serious/critical axe violations and a Lighthouse accessibility score of 100.

## Deploying Changes

If you make modifications to the `eval-view` code (HTML, CSS, JS), you can deploy your changes directly to the live GitHub Pages site using the built-in deploy script.

From the **project root directory**, run:
```bash
gd deploy
```

This will automatically bundle the current `eval-view` directory and push it to the `gh-pages` branch on GitHub in the `eval-view` folder, which GitHub Pages uses to host the web app. It takes about 2-3 minutes for GitHub Actions to process the deployment and update the live URL.

When deploying, you should also separately merge the changes into `main`.
