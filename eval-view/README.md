# Eval-View Dashboard

The Eval-View Dashboard lets you visualize test results from the Modern Web Guidance eval harness.

The dashboard can be view in two different ways:

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

### Parity Testing
To ensure your changes will work on the static deployment host, you can run the dashboard in a "Static" mode that serves files via `statikk` to mimic static deployment structure:

```bash
# From the project root directory
STATIC=true gd dashboard
```

## Guide Run Comparison Architecture

The Guide Run Comparison feature (`gd compare` CLI and the `compare.html` UI) enables side-by-side behavioral, assertion, code diff, and diagnostic comparisons between two evaluation runs (e.g., comparing a local development run against a nightly baseline, or comparing guided vs. unguided runs).

### Backend Pipeline (`gd compare` & `harness/lib/compare-agent.ts`)
* **Data Extraction & Preprocessing:** Loads run metadata (`score`, `agent`, `model`, `initialPrompt`), Playwright assertion results (`*_results.json`), execution logs (`modern-web.log`, `.db`, `chat_log.txt`), and trajectory steps (`trajectory_summary.json`). Categorizes steps into milestones: Guide Retrieval, Skill Search, Code Mutation, Mandatory Rule Adoption, and Context Noise.
* **Three-Way Unified LCS Diffing:** Generates aligned unified diffs (`Base App vs Run A`, `Base App vs Run B`, and `Run A vs Run B`) via `generateUnifiedDiff` to prevent diagnostic models from hallucinating deleted or corrupted code relative to the base application.
* **Three-Phase Modular Diagnostic (`runComparison`):**
  - **Guide Compliance Auditor (Sub-Agent 1):** Evaluates skill discovery specificity, guide retrieval confirmation, launch prompt validity, and mandatory rule adoption against `guide.md` and `expectations.md`.
  - **Code & Friction Diagnostic (Sub-Agent 2):** Audits initial launch prompts (`initialPrompt` / `ARGUMENTS:`), inspects exact `grader.ts` failure traces, verifies tool execution status (`status: success`), and separates structural test harness mismatches (e.g., `button:visible` vs `<a>`) from genuine capability loss.
  - **Synthesizer:** Merges fact-grounded outputs into a standardized 4-section executive report (`First Meaningful Divergence`, `Guide Compliance Matrix`, `Root Cause & Friction Analysis`, and `Actionable Fix Recommendations`).

### Frontend Comparison UI (`compare.html` & `compare.js`)
* **Split-Pane Navigation Tabs:**
  - **Assertions Comparison:** Side-by-side check of Playwright test assertions (`PASSED` vs `FAILED`) with drill-downs into exact error traces.
  - **Trajectory Timeline:** Side-by-side step visualizer displaying agent reasoning (`step-thought`), tool executions (`step-action`), and enriched tool results (`step-outcome.output` / `modern-web.log`) alongside direct deep-links (`Open Full Step Result`) into complete trajectory HTML sessions (`session-*.html`).
  - **Code Diffs:** Interactive rendering of unified diff hunks across all three comparison axes.
* **Live LLM Diagnosis:** Displays the 4-section executive diagnostic report. When running locally (`gd dashboard`), users can trigger on-the-fly diagnoses (`/api/run-comparison`) that stream terminal execution progress and markdown synthesis directly into the browser in real time.

## Deploying Changes

If you make modifications to the `eval-view` code (HTML, CSS, JS), you can deploy your changes directly to the live GitHub Pages site using the built-in deploy script.

From the **project root directory**, run:
```bash
gd deploy
```

This will automatically bundle the current `eval-view` directory and push it to the `gh-pages` branch on GitHub in the `eval-view` folder, which GitHub Pages uses to host the web app. It takes about 2-3 minutes for GitHub Actions to process the deployment and update the live URL.

When deploying, you should also separately merge the changes into `main`.
