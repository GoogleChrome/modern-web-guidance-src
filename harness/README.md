# Evaluation Harness & Stage 3 Testing

This directory contains the prompt benchmarking harness, base applications, agent runners, and evaluation orchestration tools for Modern Web Guidance.


## Overview

The evaluation harness measures how effectively AI coding agents adopt modern web platform guidance. It executes real-world coding benchmarks across supported agent runners and verifies output against Playwright test assertions (`grader.ts`).

Supported agents and canonical configurations are defined in [`harness/config.ts`](./config.ts).


## Agent Configuration & Setup

Configure API keys and environment variables in a `.env` file at the repository root:

### 1. Antigravity / Jetski
Antigravity (`jetski_cli`) is the default agent used by guide development workflows (`gd dev`).
```bash
JETSKI_MODEL='gemini-3.6-flash'
```

### 2. Gemini CLI
Gemini CLI (`gemini_cli`) is supported for evaluation harness runs and can be used in `gd dev` via `GD_DEV_USE_GEMINI`:
```bash
GEMINI_API_KEY='your_api_key_here'
GEMINI_MODEL='gemini-3-flash-preview'
GD_DEV_USE_GEMINI=1  # Required to use Gemini CLI for 'gd dev'
```

### 3. Claude Code (Vertex AI)
Implemented via [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai):
```bash
gcloud config set project <YOUR-GCP-PROJECT-ID>

# Set in your .env:
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
ANTHROPIC_MODEL=<enabled-model-in-vertex>
```

### 4. Codex CLI
```bash
CODEX_MODEL='gpt-5.5'
```


## Stage 3 Guide Development: `gd dev`

Once `guide.md`, `demo.html`, and `expectations.md` are authored, use `gd dev` to automatically generate evaluation capsules, calibrate graders, and run evaluations:

```bash
# Full auto-generation, calibration, and evaluation run:
gd dev guides/<category>/<use-case-slug>

# Verify grader calibration only (100% pass on golden demo, 0% on negative baseline):
gd dev guides/<category>/<use-case-slug> --test-grader

# Skip evaluation and report generation after calibration:
gd dev guides/<category>/<use-case-slug> --no-test
```

### The 5-Step `gd dev` Pipeline:
1. **Solutions Generation**: Generates golden solution patches and zero-passrate baseline patches across target base applications (`daily-grind`, `devtools-times`).
2. **Grader Generation**: Generates Playwright test assertions in `grader.ts` based on `expectations.md`.
3. **Grader Calibration**: Calibrates the grader (ensures golden patches pass 100% and zero-passrate baseline fails 100%).
4. **Agent Evaluations**: Executes guided and unguided agent runs against target apps to measure pass rates and guidance tool usage.
5. **Evaluation Report (`report.md`)**: Invokes an evaluator agent to analyze failed assertions and output recommendations into `<guide_dir>/test-app-results/report.md`.

* **Normative Specification & Rules**: See [`.agents/skills/project-evals/SKILL.md`](../.agents/skills/project-evals/SKILL.md).


## Running Multi-Agent Benchmarks: `gd eval`

Run prompt benchmarking matrices across agents and serving modes:

```bash
# Run evaluations across default configuration:
gd eval

# Run with custom configuration override:
gd eval --config custom_config.ts
```

### Configuration Profiles:
To override suite parameters without modifying `harness/config.ts` directly, copy the example template from the **repository root**:
```bash
# From the repository root:
cp config.ts.example config.ts

# Pass custom config to gd eval:
gd eval --config config.ts
```


## Evaluation Results Dashboard

Inspect benchmark results, pass rate deltas, tool retrieval transcripts, and failed test assertions via the local dashboard:

```bash
gd dashboard
```
Or start the dashboard dev server directly:
```bash
pnpm --filter eval-view dev
```
