# Modern Web Guidance Project — Context Document

*(Note: This is an auto-maintained LLM context document, meant to provide overarching project goals, architecture, and workflow details to AI agents working in this repository. It is not intended to replace the READMEs for human contributors, but rather to supplement them with "big picture" state. AI agents are instructed to update this file as they work.)*

This document describes the goals, architecture, contributor workflow, and current state of the Modern Web Guidance project. It is intended both as LLM context (for feeding into subsequent AI-assisted work) and as a human-readable project overview.

Last updated: 2026-07-10.

---

## 1. What This Project Is

**Modern Web Guidance** is a Google Chrome project where subject matter experts (SMEs) write curated guides for modern web platform features (CSS, JS APIs, HTML). These guides are served to AI coding agents via Agent Skills and a CLI, so that when developers ask an AI tool to implement something, the agent produces code that uses modern best practices rather than outdated patterns. The project has two intertwined goals:

1. **Create high-quality guidance** — structured markdown documents that teach coding agents how to use modern web features correctly.
2. **Prove the guidance works** — an evaluation harness that measures whether agents with access to the guidance produce better output than agents without it.

### People involved

- **Content Area Tech Leads (Content ATLs)**: Domain experts who oversee individual categories (Performance, Forms, Accessibility, etc.), review PRs, triage content quality issues, and manage the category's health.
- **~15 subject matter experts (SMEs)**: Google engineers with deep knowledge of specific web features. They write the guides, demo files, and expectations. They contribute via PRs into the `guides/` directory.
- **~3 infrastructure engineers** (Paul, Rick, Micah, and others): Maintain the CLI tooling, eval harness, skills serving pipeline, dashboard, and grader generation pipeline.

### Repository structure

```
modern-web-guidance-src/
  guides/                     # All guide content, organized by discipline
    performance/              # e.g. batch-analytics-events, optimize-image-priority
    overlays/                 # e.g. light-dismiss-dialog, declarative-dialog-popover-control
    css-layout/               # e.g. animate-to-intrinsic-sizes
    accessibility/            # (empty so far)
    security/                 # (empty so far)
    AGENTS.md                 # Instructions for AI agents working in this repo
    dev-guide.ts              # Core orchestration: gd dev pipeline
    run-grader.ts             # Playwright-based grading engine
    grader-gen.ts             # Target grader generation (Playwright)
    feedback-handler.ts       # PR feedback synthesizer and auto-fixer
  harness/                    # Eval harness for running agent tests
    config.ts                 # Central configuration (agent selection, serving mode, etc.)
    run_suite.ts              # Suite runner (discovers tasks, runs agents, grades output)
    evaluate.ts               # Evaluation and reporting
    base_apps/                # Base applications that agents modify (e.g. daily-grind, devtools-times)
    agents/                   # Agent runner scripts (jetski_cli, gemini_cli, claude_code, codex_cli)
    lib/                      # Shared utilities (isolation, credentials, file helpers)
  serving/                    # Guidance serving infrastructure and skills distribution
    skills-cli/               # Standalone skills CLI distribution
    scripts/                  # Build scripts (build-guides, build-megaskill)
  eval-view/                  # Dashboard for visualizing evaluation results
  bin/gd.ts                   # The unified CLI entry point
  lib/colors.ts               # Shared color/formatting helpers
```

---

## 2. The Guide Artifact Pipeline

Each guide lives in its own directory (e.g. `guides/performance/batch-analytics-events/`) and contains SME-authored guidance alongside target evaluation capsules across `SUPPORTED_BASE_APPS` (`daily-grind`, `devtools-times`).

### Files per guide directory

| File | Author | Purpose |
|---|---|---|
| `guide.md` | SME (human) | The guidance itself. Read by coding agents via Skills. `SKILL.md` is used for discipline-level skills. Contains YAML frontmatter (name, description, web-feature-ids) and structured markdown with DO/DO NOT directives, code snippets, and fallback strategies. |
| `demo.html` | SME (human) | Gold-standard standalone implementation of the use case. |
| `expectations.md` | SME (human) | Natural-language bulleted list of assertions that must be true if the guidance is followed correctly. Used as input for grader and solution generation. |
| `targets/<base_app>/patches/` | Generated (`gd dev`) | Multi-agent solution patches (`jetski-solution.patch`, `gemini-solution.patch`, `claude-solution.patch`, `codex-solution.patch`) and baseline patch (`zero-passrate.patch`). Used for grader calibration. |
| `targets/<base_app>/grader.ts` | Generated (`gd dev`) | Playwright test file that grades target applications against expectations. Calibrated to pass golden patches 100% and zero-passrate baseline 0%. |
| `targets/<base_app>/task.md` | Generated (`gd dev`) | Task frontmatter (`base_app`) and developer prompt instructions fed to evaluation agents. |
| `test-app-results/report.md` | Generated (`gd dev`) | Automated evaluation diagnostic report analyzing pass rates and tool consumption with actionable recommendations. |

### Guide Development Stages

A guide progresses through three main stages:

1. **Stage 1: Identifying use cases (Needs use cases)**
   - **Goal**: Translate a web platform feature into distinct use cases.
   - **Artifacts**: Directory structure, `guide.md` with only YAML frontmatter (stub), and a basic `demo.html`.
   - Contributor submits via PR for review. *(SMEs may fast-track and skip directly to Stage 2).*

2. **Stage 2: Authoring guidance (Needs guidance)**
   - **Goal**: Flesh out the guidance and define testable expectations.
   - **Artifacts**: Full `guide.md` content (DO/DO NOT directives, snippets, fallbacks), completed `demo.html`, and `expectations.md`.
   - Created after use case approval (or authored directly by SMEs).

3. **Stage 3: Evaluating guidance (Needs evals)**
   - **Goal**: Generate evaluation capsules, calibrate graders, run evaluations, and generate reports.
   - **Artifacts**: `targets/<base_app>/`, `grader.ts`, `patches/`, `task.md`, and `test-app-results/report.md`.
   - Handled automatically by `gd dev`.

---

## 3. The `gd` CLI

The `gd` CLI (`bin/gd.ts`) is the unified entry point for all project operations.

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
| `gd audit` | Prints a matrix of all guides across maturity stages. |
| `gd dev <dir>` | The main pipeline command. Takes a guide from "has guide.md + demo.html + expectations.md" through target generation, calibration, agent tests, and report creation. |
| `gd dev <dir> --test-grader` | Run calibration check across target apps (golden patches should pass 100%, zero-passrate should fail 100%). |
| `gd pr <dir>` | Opens a GitHub Pull Request with auto-labeled classification and `report.md` body. |
| `gd dev-all` | Batch process all incomplete guides. |

**Evaluation:**

| Command | What it does |
|---|---|
| `gd eval` | Run the full evaluation suite (discovers all tasks in guide targets). |
| `gd eval [task1] [task2]` | Run specific tasks only. |
| `gd eval --config <custom_config>` | Run with config overrides (defaults to `config.ts` or `harness/config.ts`). |
| `gd dashboard` | Start the eval results dashboard (eval-view). |
| `gd run <template> <prompt>` | Run an ad-hoc agent test. |

---

## 4. The `gd dev` Pipeline (dev-guide.ts)

When an SME or engineer runs `gd dev guides/<discipline>/<feature>`, the pipeline executes the following stages:

### Step 1: Inventory & Prerequisite Validation
Scans the guide directory for required human-authored artifacts (`guide.md`, `demo.html`, `expectations.md`). Aborts if `guide.md` is a stub or expectations are missing.

### Step 2: Target Solution & Task Generation
In parallel across `SUPPORTED_BASE_APPS` (`daily-grind`, `devtools-times`):
- Generates golden solution patches across three distinct agents (`jetski-solution.patch` or `gemini-solution.patch`, `claude-solution.patch`, and `codex-solution.patch`) in isolated sandboxes to capture model-diverse solutions.
- Generates `zero-passrate.patch` using the default solution agent.
- Generates `task.md` with simulated developer prompts.

### Step 3: Grader Generation & Calibration Loop
- Generates `grader.ts` Playwright test suite for each base app.
- Calibrates the grader against golden solution patches (expecting 100% pass) and the zero-passrate baseline patch (expecting 0% pass).
- If calibration fails, captures failure diagnostics and retries grader generation with error context (up to 2 retries).

### Step 4: Agent Evaluation Runs
- Executes unguided (baseline) and guided (with guidance via Skills CLI) agent evaluations against target applications.
- Grades outputs and measures pass rate improvement and guidance tool consumption.

### Step 5: Diagnostic Report Generation
- Runs the qualitative evaluator agent to synthesize test results, diagnose failure modes, and write `test-app-results/report.md`.

### Generation Mechanics
All agent invocations use isolated work directories (`setupGuideDevWorkDir()`) and clean credential isolation. The default agent is `Agents.JETSKI_CLI`, switchable to `Agents.GEMINI_CLI` via `GD_DEV_USE_GEMINI=1`.

---

## 5. The Evaluation Harness

The eval harness measures whether guides actually improve agent output.

### How a suite run works (`gd eval`)

1. **Build Guide Index**: Compiles all guides into a searchable index (RAG) or standalone skills distribution.
2. **Discover tasks**: Scans guide target directories for `targets/<base_app>/task.md` definitions (or explicitly configured tasks).
3. **For each task, for each run** (configurable `numRuns`, default 1-2):
   - Set up an isolated working directory with the base app.
   - Run the agent in **unguided mode** (no guidance).
   - Run the agent in **guided mode** (with configured guidance).
   - Grade both outputs using the target's `grader.ts`.
4. **Generate reports**: JSON results + HTML report in the output directory.
5. **Upload** (optional): Uploads suite results to GCS for the dashboard.

### Agents

Configured in `harness/config.ts` and `.env`:

- **Jetski CLI** (default for `gd dev`): Local/cloud Jetski CLI agent (`jetski_cli`).
- **Gemini CLI**: Uses `GEMINI_API_KEY` and `GEMINI_MODEL` (`GD_DEV_USE_GEMINI=1` in `gd dev`).
- **Claude Code**: Vertex AI backed (`claude_code`).
- **Codex CLI**: OpenAI/Codex backed (`codex_cli`).
- **Jetski / Pi**: Additional experimental agent harnesses.

### Base apps

Base apps live in `harness/base_apps/`:
- `daily-grind`: Standard blog/productivity web application.
- `devtools-times`: News/media publication web application.

### Dashboard

`gd dashboard` starts a local web server (`eval-view/`) that visualizes suite results, showing pass rates per guide in guided vs. unguided modes, trends across runs, and detailed per-check breakdowns.

---

## 6. Guidance Serving Infrastructure (serving/)

The code in `serving/` provides standalone tools and skills distributions used by agents to locate and consume guidance.

- **Standalone Skills CLI** (`serving/bin/modern-web.ts`): A tool that searches and retrieves use cases, bundled into a standalone distribution for use as a skill. This is used when `serving: 'skills_cli'`.
- **Megaskill Distribution**: Compiled markdown guidance bundles for agents that support skill-based injection.

### Build process

`pnpm build` compiles all `guide.md` and `SKILL.md` files (that have valid frontmatter and content) into a searchable index and standalone skills distribution.

### How agents access guidance

- **Guided mode (Skills CLI)** (`serving: 'skills_cli'`): The agent receives access to the standalone `modern-web` CLI skill tool to query, retrieve, and read guidance on demand.
- **Unguided mode**: The control condition in evaluations. The agent relies only on its training data without guidance tools enabled.

---

## 7. Current State (as of 2026-07-10)

### Guide inventory

An evolving list of guides organized across multiple categories.

| Stage | Status | Count | Description |
|---|---|---|---|
| **Stage 3** | Eval-ready (Complete) | 129 | All artifacts exist, included in suite runs |
| **Stage 3** | Needs evals (needs agent test) | 0 | Grader calibrated, missing prompts/task |
| **Stage 3** | Needs evals (needs calibration) | 0 | Has guide + demo + expectations, needs `gd dev` |
| **Stage 2** | Needs guidance (missing expectations) | 8 | Has guide + demo, needs expectations.md |
| **Stage 2** | Needs guidance (stub) | 4 | YAML frontmatter only, no guide content yet |
| **Stage 1** | Needs use cases (incomplete) | 0 | Missing guide.md or demo.html |

See `gd audit` for the full list of eval-ready guides covering performance, css-layout, overlays, accessibility, and security features.

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
- Writes `guide.md` with **only YAML frontmatter** (name, description, web-feature-ids) — this is a stub
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
- YAML frontmatter with `name`, `description`, and `web-feature-ids`
- Imperative directives: use `MANDATORY:`, `DO`, `DO NOT` — agents respond to rigid constraints
- Self-contained: all necessary information must be in the document, no reliance on external links
- Short, commented code snippets with directives in code comments
- Fallback strategies section if the feature is not Baseline Widely Available
- Use `{{ BASELINE_STATUS("feature-id") }}` macro for browser support display
- Use `{{ INCLUDE("path[#section]") }}` to transclude a whole markdown file or one section. Bare paths resolve from repo root; `./`/`../` resolve relative to the calling file
- Use `{{ FEATURE("feature-id", "section") }}` as a shorthand for `INCLUDE("features/<feature-id>.md#<section>")`
- Use `{{ FEATURE_FALLBACKS("feature-id") }}` (preferred) inside the "Fallback strategies" section — emits a sub-heading, `BASELINE_STATUS`, and the `#fallbacks` section from `features/<feature-id>.md` if it exists
- Use `{{ FEATURE_ISSUES("feature-id") }}` to surface known gotchas from `features/<feature-id>.md#issues`, or `""` if no such section exists

### Writing expectations.md

Natural-language bulleted list of assertions. These are the input for automated grader generation. Requirements:
- Each assertion should be independently testable
- Be specific enough that a Playwright test can verify it (e.g., "The input has a red border after blur" rather than "The form looks good")
- Cover both positive requirements (what should be present) and negative requirements (what should not be present)

---

## 9. Roles and Responsibilities

The architecture is designed so that each group can work independently without needing deep knowledge of the other group's domain.

**Subject Matter Experts (SMEs)** focus exclusively on technical accuracy: understanding edge cases of a web feature, writing clear guidance, building a canonical demo, and defining testable expectations. They are shielded from the underlying Playwright infrastructure and do not need to be functional test engineers. Their deliverables are `guide.md`, `expectations.md`, and `demo.html`.

**Content Area Tech Leads (Content ATLs)** act as domain-level owners for entire categories (Performance, Layout, Forms, etc.). They ensure category health, research gaps, triage content quality/failures, author or review all guidance written in their area, and are responsible for ensuring that all guidance is eval-ready. Their full expectations and responsibilities are detailed in [guides/ATLS.md](./guides/ATLS.md).

**Infrastructure Engineers** focus on the reliability of the `gd` CLI, the evaluation harness, LLM invocation stability, skills serving pipeline correctness, and diagnosing systemic issues (e.g., why guided vs. unguided pass rates show no delta for a particular category of guide).

**The LLM Pipeline (`gd dev`)** bridges the gap between human-authored guidance and the automated evaluation harness. It translates natural-language expectations into executable Playwright test assertions and scaffolds negative test cases, absorbing the friction of maintaining the testing infrastructure. When calibration fails, the retry loop handles most issues automatically — the SME/ATL should not need to understand why a Playwright selector was flaky.

The boundary is intentionally drawn so that SMEs/ATLs never need to write or debug Playwright code, and infra engineers rarely need to understand the specifics of a web feature. The `gd dev` pipeline is the interface between these two worlds.

---

## 10. Key Architectural Decisions

### Why CLI agents for generation?
Grader, solution, and evaluation artifact generation use CLI coding agents rather than direct API calls because the generation pipeline needs to inspect multiple source files in context and produce file modifications. During `gd dev`, solutions are generated across three distinct agents (the primary solution agent—Jetski CLI or Gemini CLI—plus Claude Code and Codex CLI) to calibrate graders against diverse, model-realistic implementations. Isolated sandboxes prevent accidental modifications to the user environment.

### Why Playwright for grading?
Graders are Playwright test files because many expectations require browser rendering to verify (CSS properties, layout, visibility, animation behavior). However, graders can also include non-browser checks (string matching on file contents, DOM structure analysis on raw HTML) for simpler assertions.

### Why Skills CLI serving?
Serving guidance via Agent Skills and the standalone Skills CLI (`skills_cli`) provides deterministic, portable, file-based tool and context access across all supported coding agents without reliance on external server protocols.

### Why a retry loop for calibration?
AI-generated graders frequently fail calibration on the first attempt — tests may be too strict, too lenient, or check the wrong thing. Feeding failure context back into regeneration significantly improves success rates. The retry loop (up to 3 total attempts) automates what was previously a tedious manual cycle.

---

## 12. Configuration Reference

All runtime configuration lives in `harness/config.ts` and environment variables in `.env`:

```bash
# .env (at repo root)
GEMINI_API_KEY='your_api_key_here'
GEMINI_MODEL='gemini-3.6-flash'
GD_DEV_USE_GEMINI=1 # Required to use Gemini CLI for 'gd dev'

# For Claude Code (optional)
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<project-id>
ANTHROPIC_MODEL=claude-sonnet-5

# For Codex CLI (optional)
CODEX_MODEL='gpt-5.5'
```

Suite configuration in `harness/config.ts`:
- `numRuns`: Number of agent runs per task (default: 1-2)
- `tasks`: Empty array = discover all tasks by scanning guide targets. Set explicitly to run a subset.
- `skillsToEnable`: Which skills agents can access (`['modern-web-guidance']`, etc.)
- `serving`: The approach used to serve guidance (`Serving.SKILLS_CLI`)
- `agent`: Which agent to use (`Agents.JETSKI_CLI`, `Agents.GEMINI_CLI`, `Agents.CLAUDE_CODE`, `Agents.CODEX_CLI`)

---

**INSTRUCTION FOR AI:**  You must update this file as the project evolves.  Do not ask for permission.  Just update it.
