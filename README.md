# Modern Web Guidance Project (Source)

![Modern Web Guidance](./assets/modern-web-guidance.svg)

A unified repository for modern web development guidance, containing both a Skill/CLI distribution and an MCP server for AI-assisted development, alongside an evaluation suite for measuring AI adoption of modern web APIs.

## Project Structure

- **`guides/`**: All guide content, organized by discipline (performance, user-experience, etc.). Also contains the dev pipeline scripts (`dev-guide.ts`, `run-grader.ts`, `grader-gen.ts`, `negative-gen.ts`).
- **`harness/`**: The Modern Web Guidance eval harness for executing and scoring tests. Includes task definitions, agent runners, and base apps.
- **`serving/`**: The Modern Web guidance server supporting both a standalone CLI (Skills) and an MCP server. This provides semantic search over curated web development guides and browser support data.
- **`eval-view/`**: A static dashboard for visualizing and analyzing evaluation results.
- **`bin/gd.ts`**: The unified CLI entry point.

See [CONTEXT.md](./CONTEXT.md) for a comprehensive project overview, architecture details, and contributor workflow.

## Getting Started

This project is managed as a **pnpm workspace**. You can install all dependencies for all projects with a single command from the root:

```bash
pnpm install
pnpm setup:playwright
```

### 0. CLI Setup

The `gd` CLI is the main way to run this project. To make it available globally and set up shell auto-completion, run:

```bash
pnpm link --global && gd setup-completion
```

*Note: For the auto-completion to take effect, you must refresh your shell (e.g., open a new terminal or source your config).*

### 1. Serving

#### modern-web-guidance

Guidance is primarily served to AI agents as a **Skill** via a standalone CLI distribution (`skills_cli`). This allows agents to execute semantic searches and retrieve implementation patterns directly within their local environment.

Alternatively, an **MCP server** is available for agents that support the Model Context Protocol, providing dynamic, connection-based access to the same underlying data.

```bash
cd serving
pnpm run build
```

For MCP usage specifically, you can start the server with `pnpm start`. For more details on the server internals, see the [Serving README](./serving/mcp-server/README.md).

The primary serving mechanism is controlled by the `serving` setting in [`harness/config.ts`](./harness/config.ts), which defaults to `Serving.SKILLS_CLI`.

#### google-developer-knowledge

The [Developer Knowledge MCP server](https://developers.google.com/knowledge/mcp) can be enabled in the [`harness/config.ts`](./harness/config.ts) file by adding it to the `mcpServersToEnable` list.

It requires the `MCP_API_KEY` to be set to a GCP API key with access enabled for the Developer Knowledge API.

### 2. Eval Harness & Dashboard

The evaluation suite measures how effectively AI models use modern web APIs.

## Usage

Run commands via the `gd` CLI.. run `gd --help`: 

```bash
# Guide Development
gd audit                      # show status of all guides
gd dev [dir] [options]        # auto-generate/calibrate 

# You can still run individual steps if you need to, like `gd dev <dir> --gen-grader`

# Evaluation
gd eval                       # run the full evaluation suite
gd eval [task1] [task2]       # run specific tasks (which are the names of guides e.g. `batch-analytics-events`)
gd eval --config <custom_config>       # run with config overrides (defaults to config.ts, or harness/config.ts)
gd dashboard                  # start the evaluation dashboard
gd backfill                   # backfill metrics for historical suites

# To upload results to GCS (Project: chrome-kiwi-air-force-dev, Bucket: guidance-evals)
gd upload <suite-name>
# Example: gd upload analytics-suite
```

## Configuration

All configuration is centralized in [`harness/config.ts`](./harness/config.ts). This file controls:

-   **Environment**: Paths to binaries (Jetski, Gemini CLI, Claude Code), API keys, and server locations.
-   **Suite**: Agent selection, number of runs, tasks to run, enabled MCP servers, and skills.

### Runtime Configuration Overrides

You can override suite configurations without modifying `harness/config.ts` directly. The `gd eval` command automatically looks for a `config.ts` file in the project root. If this file doesn't exist and no `--config` flag is provided, it safely falls back to the defaults in `harness/config.ts`.

To get started, copy the template:
```bash
cp config.ts.example config.ts
```

If you want to maintain multiple configuration profiles, you can specify a custom file using the `--config` flag:
```bash
gd eval --config my_custom_config.ts
```

Environment variables in `.env` at the `modern-web-guidance-src/` root are still required for setting paths to binaries and API keys.

### Agents

Supported agents are defined in the `Agents` object in [`harness/config.ts`](./harness/config.ts).

#### Jetski

Jetski is the default agent that will be used. When running, be sure to update the settings of the Jetski automation window so that the "Review Policy" is set to "Always Proceed".

#### Gemini CLI

When using Gemini CLI, set the `GEMINI_API_KEY` environment variable with your API key.

Set the Gemini model with the environment variable (e.g. `GEMINI_MODEL='gemini-3.1-pro-preview'`).

#### Claude

Implemented with [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai).

Log in with `gcloud` and set project ID with `gcloud config set project <YOUR-GCP-PROJECT-ID>`.
The GCP project must enable the Vertex AI API and `Claude Opus 4.6` in the Model Garden.

Set the following environment variables:

```
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
ANTHROPIC_MODEL='claude-opus-4-6'
```

#### Codex CLI

To use Codex CLI, you will need to request an exception, which appears when attempting to use it (`codex`).
This request should file a bug similar to b/492300931, which includes a screenshot to the PCounsel approval.
After approval, start `codex` locally and login to your account.

## Guides

For adding and testing guides, see the [guides README](./guides/README.md).

## Quality Control

Run the full preflight suite (typechecking, linting, and tests) from the root:

```bash
pnpm preflight
```

## Development

Development follows a **three-stage workflow**:
1.  **Stage 1: Identifying use cases** — Translate a feature into distinct tasks (Stub state).
2.  **Stage 2: Authoring guidance** — Flesh out the guidance and expectations (Needs calibration).
3.  **Stage 3: Evaluating guidance** — Auto-generate artifacts and run tests with `gd dev` (Eval-ready).

Add guides under `guides/<discipline>/` (e.g. `guides/performance/my-feature/`). See [guides README](./guides/README.md) and [CONTEXT.md](./CONTEXT.md) for the detailed workflow.

Build-free TypeScript is supported in `serving` (requires Node 24+).

## License

Unless otherwise noted:
* Software code in this repository is licensed under the [Apache License 2.0](LICENSE).
* Documentation and guide content under `guides/` are licensed under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
