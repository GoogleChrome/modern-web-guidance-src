# <img src="./.github/img/modern-web-guidance.svg" alt="Modern Web Guidance" width="30" height="30"> Modern Web Guidance (Source)

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

## Serving

The `modern-web-guidance` **Skill** is served through a standalone CLI distribution (`serving/skills-cli`), enabling AI agents to perform local semantic searches and retrieve targeted implementation patterns on demand. Within the evaluation harness, the serving mechanism is configured via the `serving` setting in [`harness/config.ts`](./harness/config.ts), which defaults to `Serving.SKILLS_CLI`.

Alternatively, an **MCP server** and other experimental interfaces are maintained in the codebase for research and testing purposes, providing connection-based access to the same underlying guidance data.

## Evaluation Harness & Dashboard

#### Prompt Benchmarking Harness (`harness/`)

The evaluation harness is a matrix-driven runner that measures how effectively coding agents adopt modern web APIs. It executes tasks across various AI agents in isolated environments and scores their output against browser-based test assertions.

#### Evaluation Dashboard (`eval-view/`)

The evaluation dashboard provides a web interface to visualize pass rates, inspect agent trajectories, and review grade reports. It supports both a dynamic local development mode and a fully static deployment hosted on GitHub Pages.

## Getting Started

This project is managed as a **pnpm workspace**. You can install all dependencies for all projects with a single command from the root:

```bash
pnpm install
pnpm setup:playwright
```

### CLI Setup

The `gd` CLI is the main way to run this project. To make it available globally and set up shell auto-completion, run:

```bash
pnpm link --global && gd setup-completion
```

*Note: For the auto-completion to take effect, you must refresh your shell (e.g., open a new terminal or source your config).*

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

- **Environment Configuration (`environmentConfig`)**: Resolves absolute paths to AI agent binaries/CLIs, GCP credentials, and required API keys. Values are populated via environment variables loaded automatically from `.env` at the repository root.
- **Suite Configuration (`defaultSuiteConfig`)**: Controls evaluation execution parameters such as agent selection (`agent`), serving mode (`serving`), task filters (`tasks`), etc.

### API Keys & Environment Setup

For setup of core guide development workflows (`gd dev`), configure your Gemini API key and model in your environment or `.env` file:

```bash
GEMINI_API_KEY='your_api_key_here'
GEMINI_MODEL='gemini-3-flash-preview'
```

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

For comprehensive configuration details on running evaluations across other agents, see [EVALS.md](./EVALS.md).

## Quality Control

Run the full preflight suite (typechecking, linting, and tests) from the root:

```bash
pnpm preflight
```

## License

Unless otherwise noted:
* Software code in this repository is licensed under the [Apache License 2.0](LICENSE).
* Documentation and guide content under `guides/` are licensed under [Creative Commons Attribution 4.0 International (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
