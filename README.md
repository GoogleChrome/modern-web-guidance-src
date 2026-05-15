# <img src="./assets/modern-web-guidance.svg" alt="Modern Web Guidance" width="48" height="48" style="width: 48px; max-width: 48px; height: 48px; vertical-align: -10px;"> Modern Web Guidance (Source)

A unified repository for authoring, calibrating, and evaluating modern web development guidance. Here, Subject Matter Experts (SMEs) curate best practices, automated pipelines generate test fixtures and grading scripts, and an evaluation harness measures how effectively AI coding agents adopt modern web APIs.

The published distribution of this guidance is compiled and released to the [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) repository as Agent Skills—including the primary `modern-web-guidance` Skill (which utilizes a bundled CLI distribution) alongside other standalone Skills.

## Project Structure

- **`guides/`**: Curated guide content organized by discipline (performance, user-experience, etc.), along with core development pipeline orchestration scripts.
- **`harness/`**: The evaluation harness for executing and scoring agent tests. Contains agent runners, evaluation orchestration, and base applications.
- **`serving/`**: Serving infrastructure that compiles guides into semantic search indexes, builds the standalone RAG CLI distribution (`skills-cli`), and orchestrates publishing all Skills to both the public npm registry and the GitHub distribution repository.
- **`skills-src/`**: Source files and templates for standalone discipline-level and topic-specific Agent Skills.
- **`features/`**: Feature definitions and documentation snippets for specific web platform capabilities, used for transclusion and baseline status tracking.
- **`eval-view/`**: A static web dashboard for visualizing and analyzing evaluation suite results.
- **`nightly/`**: Automation scripts for configuring and executing scheduled nightly evaluation runs across multiple agents.
- **`bin/gd.ts`**: The unified CLI entry point for all development and evaluation workflows.

See [CONTEXT.md](./CONTEXT.md) for a comprehensive project overview, architecture details, and contributor workflow.

## Guide Development

Guidance is authored across two primary locations in the repository:

- **`guides/`**: Core guides organized by web platform discipline (e.g., performance, user experience). These guides undergo rigorous calibration and automated evaluation using the `gd dev` pipeline.
- **`skills-src/`**: Standalone Agent Skills and templates authored directly as Markdown artifacts.

### Three-Stage Workflow

For core guides under `guides/<discipline>/` (e.g. `guides/performance/my-feature/`), development follows a structured three-stage workflow:
1. **Stage 1: Identifying use cases** — Translate a feature into distinct tasks (Stub state).
2. **Stage 2: Authoring guidance** — Flesh out the guidance and expectations (Needs calibration).
3. **Stage 3: Evaluating guidance** — Auto-generate artifacts and run tests with `gd dev` (Eval-ready).

If you are an external contributor looking to add new guidance, calibrate test fixtures, or improve existing content, please follow our guidelines in [CONTRIBUTING.md](./CONTRIBUTING.md).

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

#### `modern-web-guidance`

Guidance is primarily served to agents through the `modern-web-guidance` **Skill** via a standalone CLI distribution (`serving/skills-cli`). This allows agents to execute semantic searches and retrieve implementation patterns directly within their local environment.

The primary serving mechanism is controlled by the `serving` setting in [`harness/config.ts`](./harness/config.ts), which defaults to `Serving.SKILLS_CLI`.

##### Research & Testing Interfaces

Alternatively, an **MCP server** and other experimental serving approaches are maintained in the codebase for research purposes during testing, providing connection-based access to the same underlying data.

### 2. Eval Harness & Dashboard

The evaluation suite measures how effectively AI models use modern web APIs.

## Usage

Run commands via the `gd` CLI. See `gd --help` for a list of commands: 

```bash
Guide Development
  dev <dir>                    Auto-generate and calibrate guide artifacts
    --grade                    Run/calibrate grader
    --test-grader              Check grader calibration (demo + negative-demo)
    --gen-grader               Generate a new grader script
    --gen-negative             Generate negative examples
    --guided                   Skip calibration, run guided agent test only
    --no-test                  Skip agent tests after calibration
    --cross-app                Also check grader on an unmodified base app
  audit                        Show status of all guides
    --usecases                 Group by usecases rather than features

Evaluation & Dashboard
  eval [suite|tasks...]        Run the full evaluation suite, or specific tasks
    --config <path>            Custom config file (defaults to root config.ts)
    --ui                       Start the evaluation review UI
  run <tmpl> <prompt>          Run an ad-hoc agent test against a template
    --config <path>            Custom config file (defaults to root config.ts)
  dashboard                    Start the evaluation dashboard
  deploy                       Deploy the dashboard to GitHub Pages
  upload                       Upload generated evaluation suite to GCS
  backfill                     Backfill metrics for historical suites

Utilities & Setup
  baselinestatus <query>       Check browser support and Baseline status
  setup-completion             Install shell auto-completion
```

## Configuration

All evaluation and environment configuration is centralized in [`harness/config.ts`](./harness/config.ts). This file defines two primary configuration structures:

- **Environment Configuration (`environmentConfig`)**: Resolves absolute paths to AI agent binaries/CLIs (Jetski, Gemini CLI, Claude Code, Codex), GCP credentials, and required API keys. Values are populated via environment variables loaded automatically from `.env` at the repository root.
- **Suite Configuration (`defaultSuiteConfig`)**: Controls evaluation execution parameters such as agent selection (`agent`), serving mode (`serving`), task filters (`tasks`), etc.

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

#### Gemini CLI

Gemini CLI (`gemini_cli`) is the default agent used by the evaluation harness. When using Gemini CLI, set the `GEMINI_API_KEY` environment variable with your API key.

Set the Gemini model with the environment variable (e.g. `GEMINI_MODEL='gemini-3.1-pro-preview'`).

#### Jetski (IDE)

When using Jetski (`jetski`), be sure to update the settings of the Jetski automation window so that the "Review Policy" is set to "Always Proceed".

#### Jetski CLI

When using Jetski CLI (`jetski_cli`), the evaluation harness executes the standalone command-line tool. Note that this agent requires a Cloudtop environment to run successfully.

#### Claude Code

Implemented with [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai).

Log in with `gcloud` and set project ID with `gcloud config set project <YOUR-GCP-PROJECT-ID>`.
The GCP project must enable the Vertex AI API and the desired model in the Model Garden.

Set the following environment variables:

```
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
ANTHROPIC_MODEL=<enabled-model-in-vertex>
```

#### Codex CLI

To use Codex CLI, you will need to request an exception, which appears when attempting to use it (`codex`).
This request should file a bug similar to b/492300931, which includes a screenshot to the PCounsel approval.
After approval, start `codex` locally and login to your account.

## Quality Control

Run the full preflight suite (typechecking, linting, and tests) from the root:

```bash
pnpm preflight
```

## License

Unless otherwise noted:
* Software code in this repository is licensed under the [Apache License 2.0](LICENSE).
* Documentation and guide content under `guides/` are licensed under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
