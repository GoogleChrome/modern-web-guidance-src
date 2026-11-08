# Evaluation Harness & Agent Configuration

This document provides comprehensive instructions and configuration details for executing the evaluation harness across supported AI coding agents.

## Overview

The evaluation harness measures how effectively AI coding agents adopt modern web APIs. It runs automated benchmarks across various agent runners and validates their implementation against outcome-based Playwright assertions.

Supported agents are defined in the `Agents` object within [`src/harness/config.ts`](../src/harness/config.ts).

---

## Agents

### Claude Code

The Claude Code agent (`claude_code`) is implemented with [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai).

**Configuration:**
1. Log in with `gcloud` and set your active project ID:
   ```bash
   gcloud config set project <YOUR-GCP-PROJECT-ID>
   ```
2. Ensure your GCP project has enabled the Vertex AI API and the desired model in the Model Garden.
3. Set the following environment variables in your `.env` file or session:
   ```bash
   CLAUDE_CODE_USE_VERTEX=1
   CLOUD_ML_REGION=global
   ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
   ANTHROPIC_MODEL=<enabled-model-in-vertex>
   # Optional: reasoning effort (`--effort <level>`); defaults to Claude Code's built-in effort when unset.
   # Cannot be combined with a model ID that already ends in a level suffix (e.g., `opus-5.5-high`).
   # CLAUDE_EFFORT=high
   ```

---

### Codex CLI

To use the Codex CLI agent, you will need to request an exception, which appears when attempting to use it:

```bash
node_modules/.bin/codex
```

1. This request should file a bug similar to [`b/492300931`](https://b.corp.google.com/issues/492300931).
2. After approval, restart the CLI locally and log in to your account.
3. Set your preferred model (and optional reasoning effort) in your environment:
   ```bash
   CODEX_MODEL='gpt-5.5'
   # Optional: reasoning effort (`-c model_reasoning_effort=<level>`); defaults to `~/.codex/config.toml` / CLI default when unset.
   # Cannot be combined with a model ID ending in a level suffix.
   # CODEX_EFFORT=high
   ```

---

### Jetski CLI

Jetski CLI (`jetski_cli`) can be used by the guide development workflows (`gd dev`) via the `GD_DEV_USE_JETSKI` flag.

**Configuration:**
Configure the preferred model for Jetski CLI agent runs:
```bash
# Model selection for Jetski CLI agent runs
JETSKI_MODEL='Gemini 3.8 Flash (Medium)'
# Optional: reasoning effort (`--effort <level>`) when using a base model ID without a level suffix; defaults to Jetski CLI's built-in effort.
# JETSKI_EFFORT=high
GD_DEV_USE_JETSKI=1  # Required to use Jetski CLI for 'gd dev'
```

---

### Antigravity CLI

Antigravity CLI (`antigravity_cli`) is the default agent used by the guide development workflows (`gd dev`).

**Installation:**
Antigravity CLI (`agy`) must be installed first:
```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```
Then run `agy` once interactively to sign in.

**Configuration:**
All settings are optional. If you sign in with a personal Antigravity account, no GCP project is needed. If you use agy through a GCP project, set it in `~/.gemini/antigravity-cli/settings.json` (`gcp.project`), or override it in your `.env` file:
```bash
# Optional: GCP project (only for GCP-project auth)
ANTIGRAVITY_GCP_PROJECT=<YOUR-GCP-PROJECT-ID>
# Optional: path to the agy binary if it is not on your PATH (e.g. under cron)
ANTIGRAVITY_CLI_BIN=/home/<you>/.local/bin/agy
# Optional: model override for Antigravity CLI agent runs
ANTIGRAVITY_MODEL=gemini-3.8-flash-medium
# Optional: reasoning effort (`--effort <level>`); defaults to agy's built-in effort when unset.
# Cannot be combined with a tiered model ID that already ends in a level suffix (like `gemini-3.8-flash-medium`).
# ANTIGRAVITY_EFFORT=high
```

---

### Reasoning Effort Recording & Conflict Rule

Each run (`trajectory_summary.json`) and suite (`evals.json`) records `reasoningEffort: { level?: string, source: 'observed' | 'configured' | 'model-id' | 'agent-default' }` alongside `model` (precedence: `observed > configured > model-id > agent-default`):

- **Antigravity CLI (`ANTIGRAVITY_EFFORT`)**, **Jetski CLI (`JETSKI_EFFORT`)**, and **Claude Code (`CLAUDE_EFFORT`)** pass `--effort <level>`.
- **Codex CLI (`CODEX_EFFORT`)** passes `-c model_reasoning_effort=<level>`.
- **Pi (`PI_MODEL` / `PROMPT_MODEL`)** accepts thinking levels via a `:<thinking>` suffix on the model ID (for example `openrouter/deepseek/deepseek-v4.1-flash:low` or `...:off`).
- **Startup conflict check:** Setting `<AGENT>_EFFORT` alongside a model ID that already ends in a `-<level>` or `:<level>` tier suffix (such as `gemini-3.8-flash-medium` or `opus-5.5-high`) throws a startup error instead of passing conflicting flags. When neither an effort env var nor a model-ID tier is present and logs do not report an observed tier, `reasoningEffort` is recorded as `{ source: 'agent-default' }`.
