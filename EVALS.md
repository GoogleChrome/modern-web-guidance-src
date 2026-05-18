# Evaluation Harness & Agent Configuration

This document provides comprehensive instructions and configuration details for executing the evaluation harness across supported AI coding agents.

## Overview

The evaluation harness measures how effectively AI coding agents adopt modern web APIs. It runs automated benchmarks across various agent runners and validates their implementation against outcome-based Playwright assertions.

Supported agents are defined in the `Agents` object within [`harness/config.ts`](./harness/config.ts).

---

## Agents

### Gemini CLI

Gemini CLI (`gemini_cli`) is the default agent used by the evaluation harness and guide development workflows (`gd dev`).

**Configuration:**
Set your API key and preferred model in your environment or `.env` file at the repository root:
```bash
GEMINI_API_KEY='your_api_key_here'
GEMINI_MODEL='gemini-3-flash-preview'
```

---

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
   ```

---

### Codex CLI

To use the Codex CLI agent, you will need to request an exception, which appears when attempting to use it:

```bash
harness/node_modules/.bin/codex
```

1. This request should file a bug similar to [`b/492300931`](https://b.corp.google.com/issues/492300931).
2. After approval, restart the CLI locally and log in to your account.
