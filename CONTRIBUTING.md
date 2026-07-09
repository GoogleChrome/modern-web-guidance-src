# Contributing to Guidance

We'd love to accept your patches! We believe it is critical that developers, and their AI agents, have access to the highest quality documentation and guidance.

Just like all other Google open source projects, we require a signed Contributor License Agreement (CLA) for any contribution (even one that just changes documentation).

## Contributor License Agreements

All submissions to Google Open Source projects need to follow Google’s Contributor License Agreement (CLA).

*   If you are an individual writing original source code and you're sure you own the intellectual property, then you'll need to sign an [individual CLA](https://developers.google.com/open-source/cla/individual).
*   If you work for a company that wants to allow you to contribute your work, then you'll need to sign a [corporate CLA](https://developers.google.com/open-source/cla/corporate).

Follow either of the two links above to access the appropriate CLA and instructions for how to sign and return it. Once we receive it, we'll be able to accept your pull requests.

## Scope and positioning policies
### Vendor-agnostic guidance
* Core guides focus on web features aligned with the [web-features project](https://github.com/web-platform-dx/web-features), meaning we key on web-feature IDs and [Browser Compat Data (BCD)](https://github.com/mdn/browser-compat-data) keys to handle compatibility and fallbacks. The guides must remain vendor-agnostic. Negative standards positions are not a reason to exclude guides on how to use a feature.
* Non-web scope: Branded or proprietary extensions (for example, Chrome Extensions, Chrome Web Store APIs, Google Play integration) are available behind an opt-in flag.

### Origin trial (OT) support policy
* Origin trial features are excluded from the core guidance. OT features exhibit high API and syntax volatility, require additional steps that are outside of the scope of just code changes and will generally not be what developers expect to see in their code unprompted. To support developers experimenting with cutting-edge features without exposing most developers to that churn, we’ll treat those as opt-in.

# Repository architecture and release flow
To foster an open-source contributor environment while maintaining a stable, clean installation path for end-users, we utilize a two-repo architecture:
* **Source repo** ([GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src/)): Contains development scripts, eval tasks, agent harnesses, raw guidance files, tests, etc. All contributors submit PRs and file issues here.
* **Installation repo** ([GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)): Contains compiled, ready-to-consume skills and agent-specific plugin configurations. This is the clean, stable repo that users clone to install the skills. This is a read-only repo. No issues and no PRs. 
* **Sync & build mechanism**: Changes merged into `modern-web-guidance-src` lead to a build pipeline that updates both the `modern-web-guidance` install repo and [CLI's NPM package](https://www.npmjs.com/package/modern-web-guidance).

# How to contribute
We want to encourage contributions while maintaining high standards. Our policy is:
* **Proposal first**: For non-trivial changes, contributors need to to [open an issue first](https://github.com/GoogleChrome/modern-web-guidance-src/issues) to align on design before coding.

## Development Setup

This project is managed as a **pnpm workspace**. To set up your local environment:

```bash
pnpm install
pnpm setup:playwright
```

For a walkthrough of the project architecture, see [CONTEXT.md](./CONTEXT.md).

### Quality Control

Before submitting a pull request, please ensure your changes pass lint, typecheck, tests, etc:

```bash
pnpm preflight
```

## Project Structure

- **`guides/`**: Curated guide content organized by discipline (performance, user-experience, etc.), along with core development pipeline orchestration scripts.
- **`harness/`**: The evaluation harness for executing and scoring agent tests. Contains agent runners, evaluation orchestration, and base applications.
- **`serving/`**: Serving infrastructure that compiles guides into semantic search indexes, builds the standalone RAG CLI distribution (`skills-cli`), and orchestrates publishing all Skills to both the public npm registry and the GitHub distribution repository.
- **`skills-src/`**: Source files and templates for standalone discipline-level and topic-specific Agent Skills.
- **`features/`**: Feature definitions and documentation snippets for specific web platform capabilities, used for transclusion and baseline status tracking.
- **`eval-view/`**: A static web dashboard for visualizing and analyzing evaluation suite results.
- **`nightly/`**: Automation scripts for configuring and executing scheduled nightly evaluation runs across multiple agents.
- **`bin/gd.ts`**: The unified CLI entry point for all development and evaluation workflows.

See [CONTEXT.md](./CONTEXT.md) for a comprehensive project overview, architecture details, and contributor workflow. It also somewhat overlaps with this contributing file. ;)

## Guide Development

Guidance is authored across two primary locations in the repository:

- **`guides/`**: Core guides organized by web platform discipline (e.g., performance, user experience). These guides undergo rigorous calibration and automated evaluation using the `gd dev` pipeline.
- **`skills-src/`**: Standalone Agent Skills and templates authored directly as Markdown artifacts.


### Three-Stage Workflow

For core guides under `guides/<discipline>/` (e.g. `guides/performance/my-feature/`), development follows a structured three-stage workflow:
1. **Stage 1: Identifying use cases** — Translate a feature into distinct tasks (Stub state).
2. **Stage 2: Authoring guidance** — Flesh out the guidance and expectations (Needs calibration).
3. **Stage 3: Evaluating guidance** — Auto-generate artifacts and run tests with `gd dev` (Eval-ready).

## Serving

The `modern-web-guidance` **Skill** is served through a standalone CLI distribution (`serving/skills-cli`), enabling AI agents to perform local semantic searches and retrieve targeted implementation patterns on demand. Within the evaluation harness, the serving mechanism is configured via the `serving` setting in [`harness/config.ts`](./harness/config.ts), which defaults to `Serving.SKILLS_CLI`.

Alternatively, an **MCP server** and other experimental interfaces are maintained in the codebase for research and testing purposes, providing connection-based access to the same underlying guidance data.

## Evaluation Harness & Dashboard

#### Prompt Benchmarking Harness (`harness/`)

The evaluation harness is a matrix-driven runner that measures how effectively coding agents adopt modern web APIs. It executes tasks across various AI agents in isolated environments and scores their output against browser-based test assertions.

#### Evaluation Dashboard (`eval-view/`)

The evaluation dashboard provides a web interface to visualize pass rates, inspect agent trajectories, and review grade reports. It supports both a dynamic local development mode and a fully static deployment hosted on GitHub Pages.



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

For configuration details on running evaluations across other agents, see [EVALS.md](./EVALS.md).