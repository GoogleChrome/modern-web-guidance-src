# Guidance Project — Context Document

*(Note: This is an auto-maintained LLM context document, meant to provide overarching project goals, architecture, and workflow details to AI agents working in this repository. It is not intended to replace the READMEs for human contributors, but rather to supplement them with "big picture" state. AI agents are instructed to update this file as they work.)*

This document describes the goals, architecture, contributor workflow, and current state of the Guidance project. It is intended both as LLM context (for feeding into subsequent AI-assisted work) and as a human-readable project overview.

Last updated: 2026-03-06.

---

## 1. What This Project Is

**Guidance** is a Google Chrome project where subject matter experts (SMEs) write curated guides for modern web platform features (CSS, JS APIs, HTML). These guides are served to AI coding agents via Agent Skills and a CLI (or MCP), so that when developers ask an AI tool to implement something, the agent produces code that uses modern best practices rather than outdated patterns. The project has two intertwined goals:

1. **Create high-quality guidance** — structured markdown documents that teach coding agents how to use modern web features correctly.
2. **Prove the guidance works** — an evaluation harness that measures whether agents with access to the guidance produce better output than agents without it.

### People involved

- **~15 subject matter experts**: Google engineers with deep knowledge of specific web features. They write the guides, demo files, and expectations. They contribute via PRs into the `guides/` directory.
- **~3 infrastructure engineers** (Paul, Rick, Micah, and others): Maintain the CLI tooling, eval harness, MCP server, dashboard, and grader generation pipeline.

### Repository structure

```
guidance/
  guides/                     # All guide content, organized by discipline
    performance/              # e.g. batch-analytics-events, optimize-image-priority
    user-experience/          # e.g. light-dismiss-dialog, animate-to-intrinsic-sizes
    accessibility/            # (empty so far)
    security/                 # (empty so far)
    AGENTS.md                 # Instructions for AI agents working in this repo
    dev-guide.ts              # Core orchestration: gd dev pipeline
    run-grader.ts             # Playwright-based grading engine
    grader-gen.ts             # Gemini CLI-based grader generation
    negative-gen.ts           # Gemini CLI-based negative-demo generation
  harness/                    # Eval harness for running agent tests
    config.ts                 # Central configuration (agent selection, MCP servers, etc.)
    run_suite.ts              # Suite runner (discovers tasks, runs agents, grades output)
    evaluate.ts               # Evaluation and reporting
    base_apps/                # Base applications that agents modify (e.g. daily-grind)
    agents/                   # Agent runner scripts (gemini_cli, claude_code, jetski)
    lib/                      # Shared utilities (isolation, file helpers)
  serving/                    # MCP server that serves guides to AI agents
    mcp-server/               # The actual MCP server implementation
    scripts/                  # Build scripts (build-guides, build-megaskill)
  eval-view/                  # Dashboard for visualizing evaluation results
  bin/gd.ts                   # The unified CLI entry point
  lib/colors.ts               # Shared color/formatting helpers
```

---

## 2. The Guide Artifact Pipeline

Each guide lives in its own directory (e.g. `guides/performance/batch-analytics-events/`) and needs a specific set of files. Some are human-authored, some are machine-generated.

### Files per guide directory

| File | Author | Purpose |
|---|---|---|
| `guide.md` | SME (human) | The guidance itself. Read by coding agents via MCP. Contains YAML frontmatter (name, description, web-feature-ids, sources) and structured markdown with DO/DO NOT directives, code snippets, and fallback strategies. |
| `demo.html` | SME (human) | Gold-standard implementation of the use case. Must score 100% against the grader. |
| `expectations.md` | SME (human) | Natural-language bulleted list of assertions that must be true if the guidance is followed correctly. Used as input for grader generation. |
| `negative-demo.html` | Generated (Gemini CLI) | A deliberately incorrect implementation. Must score 0% against the grader. Used for grader calibration. |
| `grader.ts` | Generated (Gemini CLI) | A Playwright test file that grades any HTML file against the expectations. May include both browser automation checks and static content checks. |
| `task.md` | Generated (Gemini CLI) | Simulated developer prompts and base_app fed to the eval agent by the harness |

The **task file** looks like:

```yaml
---
base_app: daily-grind
---
- Implement Core Web Vitals monitoring on a web page...
- Alternative prompt...
```

The task file connects a base application the agent will modify, and the prompt the agent receives (first prompt in the list). The grader is implicit (the same directory).

### Guide maturity stages

A guide progresses through these stages:

1. **Stub**: Directory exists with `guide.md` containing only YAML frontmatter (no body content). The SME has identified the use case but hasn't written the guidance yet.
2. **Incomplete**: Has `guide.md` content but is missing `demo.html` and/or `expectations.md`.
3. **Needs expectations**: Has guide + demo but no `expectations.md` (or it's empty). Cannot proceed to automated generation without this.
4. **Needs calibration**: Has all three human-authored files. Ready for `gd dev` to generate `negative-demo.html`, `grader.ts`, and calibrate.
5. **Needs test**: Grader is calibrated but missing `task.md`. Agent tests haven't been run.
6. **Eval-ready**: All artifacts exist. The guide is included in `gd eval` runs.

---

## 3. The `gd` CLI

The `gd` CLI (`bin/gd.ts`) is the unified entry point for all project operations. It replaces the previous collection of individual `pnpm` scripts.

### Setup

```bash
pnpm install
pnpm setup:playwright
pnpm link --global && gd setup-completion
```

### Commands

**Guide Development:**

| Command | What it does |
|---|---|
| `gd audit` | Prints a matrix of all 44 guides showing which artifacts each has, grouped by maturity stage. Suggests the next action to take. |
| `gd dev <dir>` | The main pipeline command. Takes a guide from "has guide.md + demo.html + expectations.md" to "grader calibrated, agent tests run." See section 4. |
| `gd dev <dir> --gen-negative` | Generate only the `negative-demo.html` |
| `gd dev <dir> --gen-grader` | Generate only the `grader.ts` |
| `gd dev <dir> --grade` | Run the grader against a specific file or directory |
| `gd dev <dir> --test-grader` | Run calibration check (demo should pass 100%, negative-demo should fail 100%) |
| `gd dev-all` | Batch process all incomplete guides (undocumented, powerful) |

**Evaluation:**

| Command | What it does |
|---|---|
| `gd eval` | Run the full evaluation suite (discovers all tasks in guide folders) |
| `gd eval [task1] [task2]` | Run specific tasks only |
| `gd eval --config <custom_config>` | Run with config overrides (`--config my_custom_config.ts`, defaults to `config.ts`, or falls back to defaults in `harness/config.ts`) |
| `gd dashboard` | Start the eval results dashboard (eval-view) |
| `gd run <template> <prompt>` | Run an ad-hoc agent test |

---

## 4. The `gd dev` Pipeline (dev-guide.ts)

This is the core automation. When an SME runs `gd dev guides/performance/my-feature`, the following happens:

### Step 1: Inventory
Scans the guide directory for existing artifacts. Prints a status table showing what exists and what will be generated. Aborts if `guide.md` is a stub (no content), `demo.html` is missing, or `expectations.md` is missing.

### Step 2: Generate `negative-demo.html`
If missing, spawns Gemini CLI in an isolated home directory. Gemini reads `guide.md`, `demo.html`, and `expectations.md`, then produces an HTML file that deliberately violates the expectations. The generated file is copied back into the guide directory.

### Step 3: Generate `grader.ts`
If missing, spawns Gemini CLI similarly. Gemini reads all guide artifacts and produces a Playwright test file that checks HTML output against the expectations.

### Step 4: Calibrate (retry loop)
Runs the grader against both `demo.html` (should pass 100%) and `negative-demo.html` (should fail 100%). If calibration fails:
- Deletes the grader
- Regenerates it with failure context appended to the prompt (e.g., "demo.html failed these tests that should pass: [list]")
- Retries up to 2 additional times

### Step 5: Agent test (runs by default)
After successful calibration:
1. Generates `task.md` if missing (via Gemini CLI, using the base app as context)
3. Grades the base app as-is (pre-score baseline)
4. Runs the configured agent in both **unguided** (no MCP guide access) and **guided** (with MCP guide access) modes
5. Grades both outputs and prints a comparison showing guide impact

### Step 6: Summary
Prints final status of all artifacts and whether calibration/testing succeeded.

### Generation mechanics
All Gemini CLI invocations use an **isolated home directory** pattern (`createIsolatedHome()`). This prevents Gemini from seeing/modifying the real user home. Guide files are copied into a temporary work directory, Gemini runs there, and results are copied back.

---

## 5. The Evaluation Harness

The eval harness measures whether guides actually improve agent output.

### How a suite run works (`gd eval`)

1. **Build Guide Index**: Compiles all guides into a searchable index (RAG).
2. **Discover tasks**: Scans guide directories for `task.md` definitions (or uses explicitly configured tasks).
3. **For each task, for each run** (configurable `numRuns`, default 2):
   - Set up an isolated working directory with the base app
   - Run the agent in **unguided mode** (no guidance)
   - Run the agent in **guided mode** (with configured guidance)
   - Grade both outputs using the task's grader
4. **Generate reports**: JSON results + HTML report in the output directory.
5. **Upload** (optional): `pnpm upload <suite-name>` pushes results to GCS for the dashboard.

### Agents

Three agents are supported, configured in `harness/config.ts`:

- **Jetski** (default): Google's internal IDE agent. Requires the Jetski app.
- **Gemini CLI**: Uses `GEMINI_API_KEY` and `GEMINI_MODEL` env vars.
- **Claude Code**: Uses Claude on Vertex AI. Requires GCP setup.

### Base apps

Base apps live in `harness/base_apps/`. Currently only `daily-grind` exists — a simple web app that agents modify in response to task prompts. More complex base apps are planned.

### Dashboard

`gd dashboard` starts a local web server (`eval-view/`) that visualizes suite results, showing pass rates per guide in guided vs. unguided modes, trends across runs, and detailed per-check breakdowns.

---

## 6. The Modern Web Guidance Server (serving/)

The code in `serving/` provides both the MCP server and standalone tools used by agents to locate guidance.

- **MCP Server** (`serving/mcp-server/`): Provides semantic search over guides. This is used when `serving: 'mcp'` in the test suite configuration.
- **Standalone CLI** (`serving/bin/modern-web.ts`): A tool that search/retrieves use cases, bundled into a distribution for use as a skill. This is used when `serving: 'skills_cli'`.

### Build process

`pnpm build:mcp` compiles all `guide.md` files (that have valid frontmatter and content) into a searchable index. The build script also generates a "megaskill" — a concatenated document of all guides for agents that support skill-based injection rather than MCP.

### How agents access guidance

- **MCP mode** (`serving: 'mcp'` and `mcpServersToEnable: ['modern-web']`): The agent connects to the MCP server and can search/retrieve guides dynamically.
- **Skills mode** (`serving: 'skills'` or `'skills_cli'`): Guide content is copied directly into the agent's working directory as skill files or CLI distribution.
- **Unguided mode**: The control condition in evaluations. The agent relies only on its training data (no skills copied, no MCP servers enabled).

---

## 7. Current State (as of 2026-03-06)

### Guide inventory

**44 total guides** across 2 categories (performance: 15, user-experience: 29).

| Status | Count | Description |
|---|---|---|
| Eval-ready | 4 | All artifacts exist, included in suite runs |
| Needs test | 1 | Grader calibrated, missing prompts/task |
| Needs calibration | 3 | Has guide + demo + expectations, needs `gd dev` |
| Stub | 36 | YAML frontmatter only, no guide content yet |

The 4 eval-ready guides: `batch-analytics-events`, `full-session-analytics`, `adapt-scrollbar-to-contrast-preferences`, `customize-scrollbar-color-and-thickness`.

### Active branch: `cli-plus-dev`

This branch (diverged from `main`) introduces:
- The `gd` CLI with all commands
- The `gd dev` automated pipeline with retry loop
- The `gd audit` command
- Refactored grader internals (CalibrationResult, programmatic API)
- Agent test integration into the dev pipeline

### Open PRs (representative)

- **#217** (bramus): Scroll-driven animations use cases — SME contribution, multiple use cases
- **#224** (agektmr): `starting-style` use cases
- **#218** (tomayac): Language Detection guide
- **#216** (paulirish): spec-rules and scrollbar-contrast grader/negative-demo artifacts
- **#205** (rviscomi): Fetch priority graders and negative demos

---

## 8. Contributor Workflow (Current + Planned)

### Two-checkpoint contribution model (Use Case, then Implementation)

To prevent SMEs from investing time writing full guides for use cases that might be rejected (due to overlap, scope, or platform maturity), the contribution process has two distinct phases to avoid wasted effort:

**Checkpoint 1 — Use case identification:**
- SME picks a web feature from the tracking sheet
- Creates directory structure under `guides/<discipline>/`
- Writes `guide.md` with **only YAML frontmatter** (name, description, web-feature-ids, sources) — this is a stub
- Creates a basic `demo.html` showing the concept
- Opens a PR for review — the team validates that the use cases are well-chosen, distinct, and don't overlap with existing guides
- `gd audit` shows these as "stub" status

**Checkpoint 2 — Implementation and evaluation:**
- After use cases are approved, SME fleshes out `guide.md` with full content (DO/DO NOT directives, code snippets, fallback strategies)
- Writes `expectations.md` with testable assertions
- Completes `demo.html` as a gold-standard implementation
- Runs `gd dev <dir>` to auto-generate negative-demo, grader, calibrate, and run agent tests
- Opens a follow-up PR with all artifacts
- `gd audit` should show these as "eval-ready" after the pipeline succeeds

### Writing guide.md

Guides are read by AI coding agents, not humans directly. Key requirements:
- YAML frontmatter with `name`, `description`, `web-feature-ids`, and `sources`
- Imperative directives: use `MANDATORY:`, `DO`, `DO NOT` — agents respond to rigid constraints
- Self-contained: all necessary information must be in the document, no reliance on external links
- Short, commented code snippets with directives in code comments
- Fallback strategies section if the feature is not Baseline Widely Available
- Use `{{ BASELINE_STATUS("feature-id") }}` macro for browser support display

### Writing expectations.md

Natural-language bulleted list of assertions. These are the input for automated grader generation. Requirements:
- Each assertion should be independently testable
- Be specific enough that a Playwright test can verify it (e.g., "The input has a red border after blur" rather than "The form looks good")
- Cover both positive requirements (what should be present) and negative requirements (what should not be present)

---

## 9. Roles and Responsibilities

The architecture is designed so that each group can work independently without needing deep knowledge of the other group's domain.

**Subject Matter Experts (SMEs)** focus exclusively on technical accuracy: understanding edge cases of a web feature, writing clear guidance, building a canonical demo, and defining testable expectations. They are shielded from the underlying Playwright infrastructure and do not need to be functional test engineers. Their deliverables are `guide.md`, `expectations.md`, and `demo.html`.

**Infrastructure Engineers** focus on the reliability of the `gd` CLI, the evaluation harness, LLM invocation stability, MCP server correctness, and diagnosing systemic issues (e.g., why guided vs. unguided pass rates show no delta for a particular category of guide).

**The LLM Pipeline (`gd dev`)** bridges the gap between human-authored guidance and the automated evaluation harness. It translates natural-language expectations into executable Playwright test assertions and scaffolds negative test cases, absorbing the friction of maintaining the testing infrastructure. When calibration fails, the retry loop handles most issues automatically — the SME should not need to understand why a Playwright selector was flaky.

The boundary is intentionally drawn so that SMEs never need to write or debug Playwright code, and infra engineers rarely need to understand the specifics of a web feature. The `gd dev` pipeline is the interface between these two worlds.

---

## 10. Key Architectural Decisions

### Why Gemini CLI for generation?
Grader and negative-demo generation use Gemini CLI (not API calls) because the generation needs to read multiple files from the guide directory and produce files in context. The CLI handles this naturally with file system access. An isolated home directory prevents accidental side effects.

### Why Playwright for grading?
Graders are Playwright test files because many expectations require browser rendering to verify (CSS properties, layout, visibility, animation behavior). However, graders can also include non-browser checks (string matching on file contents, DOM structure analysis on raw HTML) for simpler assertions.

### Why both MCP and skills modes?
Different agents have different integration capabilities. MCP provides dynamic, search-based access. Skills provides static, file-based access. Supporting both ensures the guidance can reach agents regardless of their integration model.

### Why a retry loop for calibration?
Gemini-generated graders frequently fail calibration on the first attempt — tests may be too strict, too lenient, or check the wrong thing. Feeding failure context back into regeneration significantly improves success rates. The retry loop (up to 3 total attempts) automates what was previously a tedious manual cycle.

---

## 11. Future Direction

### Near-term (in progress or planned)

- **Reconcile contributor docs**: Rick's `.agents/skills/` approach (modular skill files for project-use-cases, project-guides, project-evals) and the `gd` CLI approach need to be unified into a single coherent contributor workflow. The two-checkpoint model from Rick's proposal is compatible with the `gd dev` pipeline and will likely be adopted.
- **Merge `cli-plus-dev` to main**: The CLI and dev pipeline need to land on main so all contributors can use them.

### Medium-term

- **Second base app**: A more complex base application beyond `daily-grind` to provide a harder test for agents. More ambiguous tasks that challenge the system.
- **Grader failure responsibility model**: When grader calibration fails repeatedly, clarify whether the SME iterates on `expectations.md` or an infra engineer debugs the generation prompt. This hasn't been an issue yet but will become important as more SMEs run the pipeline.
- **Scale to all 44 guides**: Currently 36 guides are stubs. The `gd dev-all` batch command exists for processing multiple guides once SMEs have fleshed them out.

### Longer-term

- **Additional agent support**: Evaluating more AI coding tools beyond Gemini CLI, Claude Code, and Jetski.
- **Continuous evaluation**: Automated suite runs on CI to detect regressions in guide effectiveness as models update.
- **Guide effectiveness feedback loop**: Using eval results to identify which guides need improvement (low guided scores, or guided scores not significantly better than unguided).

---

## 12. Configuration Reference

All runtime configuration lives in `harness/config.ts` and environment variables in `.env`:

```
# .env (at repo root)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-pro-preview

# For Claude Code (optional)
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<project-id>
ANTHROPIC_MODEL=claude-opus-4-6

# For google-developer-knowledge MCP (optional)
MCP_API_KEY=...
```

Suite configuration in `harness/config.ts`:
- `numRuns`: Number of agent runs per task (default: 2)
- `tasks`: Empty array = discover all tasks by scanning guide folders. Set explicitly to run a subset.
- `mcpServersToEnable`: Which MCP servers agents can access (`['modern-web']`, `['google-developer-knowledge']`, or both)
- `serving`: The approach used to serve guidance (`skills_cli`, `skills`, or `mcp`)
- `agent`: Which agent to use (`Agents.GEMINI_CLI`, `Agents.CLAUDE_CODE`, `Agents.JETSKI`)

---

**INSTRUCTION FOR AI:**  You must update this file as the project evolves.  Do not ask for permission.  Just update it.
