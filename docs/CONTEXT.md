# Modern Web Guidance Project — Context Document

*(Note: This is an auto-maintained LLM context document, meant to provide overarching project goals, architecture, and workflow details to AI agents working in this repository. It is not intended to replace the READMEs for human contributors, but rather to supplement them with "big picture" state. AI agents are instructed to update this file as they work.)*

This document describes the goals, architecture, contributor workflow, and current state of the Modern Web Guidance project. It is intended both as LLM context (for feeding into subsequent AI-assisted work) and as a human-readable project overview.

Last updated: 2026-07-10.

---

## 1. What This Project Is

**Modern Web Guidance** is a Google Chrome project where subject matter experts (SMEs) write curated guides for modern web platform features (CSS, JS APIs, HTML). These guides are served to AI coding agents via Agent Skills and a CLI, so that when developers ask an AI tool to implement something, the agent produces code that uses modern best practices rather than outdated patterns. The project has two intertwined goals:

1. **Create high-quality guidance** — structured markdown documents that teach coding agents how to use modern web features correctly.
2. **Prove the guidance works** — an evaluation harness that measures whether agents with access to the guidance produce better output than agents without it.

### People involved (see [`GOVERNANCE.md`](../GOVERNANCE.md) & [`docs/ATLS.md`](./ATLS.md))

- **Contributors**: Community members who propose use cases via issues and submit PRs for bug fixes, doc updates, and improvements to existing guides.
- **Peers**: Onboarded subject matter experts who author brand-new Stage 1–2 guidance (`guide.md`, `demo.html`, and `expectations.md`) and provide peer reviews.
- **Content Area Tech Leads (Content ATLs)**: Domain experts ([`.github/atls.json`](../.github/atls.json), [`docs/ATLS.md`](./ATLS.md)) who steward specific categories or feature horizontals, validate Stage 1 use cases, review/approve Stage 2 guidance PRs, and partner with engineering to triage content-related evaluation failures.
- **Owners & Infrastructure Engineers**: Govern the project and maintain Stage 3 evaluation infrastructure (`gd` CLI, eval harness, target/grader generation pipeline, serving distribution, and dashboard).

The boundary is intentionally drawn so that SMEs and Content ATLs focus on web platform accuracy (`guide.md`, `demo.html`, `expectations.md`) without needing to write or debug Playwright test infrastructure, while the `gd dev` pipeline translates expectations into calibrated target evaluations.

### Repository structure

```
modern-web-guidance-src/
  guides/                     # All guide content, organized by discipline
    performance/              # e.g. batch-analytics-events, optimize-image-priority
    overlays/                 # e.g. light-dismiss-dialog, declarative-dialog-popover-control
    css-layout/               # e.g. animate-to-intrinsic-sizes
    accessibility/            # e.g. accessibility, accessible-error-announcement
    security/                 # e.g. verify-email-ownership
    AGENTS.md                 # Instructions for AI agents working in this repo
  features/                   # Feature definitions and snippets for transclusion
  skills-src/                 # Source files for standalone Agent Skills
  src/
    authoring/                # Core orchestration (gd dev pipeline, guides integrity)
    build/                    # Build scripts and release generators
    ci/                       # CI validation and ATL triage scripts
    cli/                      # Skills CLI implementation and telemetry
    core/                     # Shared paths, config, and guide validation
    dashboard/                # Evaluation dashboard and server
    grading/                  # Playwright-based grading engine and grader generation
    harness/                  # Eval harness, agent runners, base apps, nightly scripts
    rag/                      # Semantic search, embedding, and vector store
  bin/gd.ts                   # The unified CLI entry point
  docs/                       # Context, ATL, evaluation, and release documentation
  dist/                       # Built distribution packages (gitignored)
  out/                        # Transient build artifacts (gitignored)
  results/                    # Guide and suite evaluation results (gitignored)
```

---

## 2. The Guide Artifact Pipeline (see [`guides/CONTRIBUTING.md`](../guides/CONTRIBUTING.md))

Each guide lives in its own directory (e.g. `guides/performance/batch-analytics-events/`) and contains SME-authored guidance alongside target evaluation capsules across `SUPPORTED_BASE_APPS` (`daily-grind`, `devtools-times`).

### Files per guide directory

| File | Author | Purpose |
|---|---|---|
| `guide.md` | SME (human) | The guidance itself, read by coding agents via Skills (`SKILL.md` is reserved for the entrypoint and standalone skills). Normative rules and build-time macros (`BASELINE_STATUS`, `INCLUDE`, `FEATURE`, `FEATURE_FALLBACKS`, `FEATURE_ISSUES`, `GUIDE_REF`) are specified in [`project-guides`](../.agents/skills/project-guides/SKILL.md). |
| `demo.html` | SME (human) | Gold-standard standalone implementation of the use case. |
| `expectations.md` | SME (human) | Natural-language bulleted list of observable assertions used as input for grader and solution generation (see [`project-guides`](../.agents/skills/project-guides/SKILL.md) and [`project-evals`](../.agents/skills/project-evals/SKILL.md)). |
| `targets/<base_app>/patches/` | Generated (`gd dev`) | Multi-agent solution patches (`jetski-solution.patch`, `gemini-solution.patch`, `claude-solution.patch`, `codex-solution.patch`) and baseline patch (`zero-passrate.patch`). Used for grader calibration. |
| `targets/<base_app>/grader.ts` | Generated (`gd dev`) | Playwright test file that grades target applications against expectations. Calibrated to pass golden patches 100% and zero-passrate baseline 0%. |
| `targets/<base_app>/task.md` | Generated (`gd dev`) | Task frontmatter (`base_app`) and developer prompt instructions fed to evaluation agents. |
| `results/guides/<category>/<slug>/report.md` | Generated (`gd dev`) | Automated evaluation diagnostic report analyzing pass rates and tool consumption with actionable recommendations. |

### Discipline guides

Most guides are task-based use cases. Discipline guides serve as conceptual orientation "hubs" for a category and link to its use-case subguides via `{{ GUIDE_REF("guide-slug") }}` (see [`project-discipline-guides`](../.agents/skills/project-discipline-guides/SKILL.md)).

### Guide Development Stages

1. **Stage 1: Identifying use cases (`Needs use cases`, [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md))**
   - **Goal**: Translate a web platform feature into distinct, action-oriented use cases.
   - **Artifacts**: Directory structure (`guides/<category>/<use-case-slug>/`) and a stub `guide.md` containing only YAML frontmatter (`name`, `description`, `web-feature-ids`).
   - Contributor aligns with the category Content ATL via an issue or stub PR. *(Onboarded Peers may fast-track and proceed directly to Stage 2).*

2. **Stage 2: Authoring guidance (`Needs guidance`, [`project-guides`](../.agents/skills/project-guides/SKILL.md))**
   - **Goal**: Flesh out the guidance, build a working reference demo, and define testable expectations.
   - **Artifacts**: Full `guide.md` content, standalone `demo.html` (recommended; required by CI/audit when `targets/` do not yet exist), and `expectations.md`.
   - Validated using the [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) skill and reviewed/approved by the category Content ATL. **Content contributors stop here.**

3. **Stage 3: Evaluating guidance (`Needs evals`, [`project-evals`](../.agents/skills/project-evals/SKILL.md))**
   - **Goal**: Generate evaluation capsules, calibrate graders, run evaluations, and generate reports.
   - **Artifacts**: `targets/<base_app>/` (`grader.ts`, `patches/`, `task.md`) and `results/guides/<category>/<slug>/report.md`.
   - Handled downstream by the engineering/evaluation pipeline (`gd dev` and `gd pr`; see [`src/harness/README.md`](../src/harness/README.md)).

---

## 3. The `gd` CLI (`bin/gd.ts`)

### Setup

```bash
pnpm install
pnpm setup:playwright
pnpm link --global && gd setup-completion
```

### Commands

| Command | What it does |
|---|---|
| `gd audit` | Prints a matrix of all guides across maturity stages (`Stub`, `Incomplete`, `Needs expectations`, `Needs calibration`, `Needs test`, `Eval-ready`). |
| `gd dev <dir>` | Runs the 5-step Stage 3 pipeline (`src/authoring/dev.ts`): generates target solutions/tasks across `SUPPORTED_BASE_APPS` (`daily-grind`, `devtools-times`), generates and calibrates `grader.ts` (100% golden / 0% zero-passrate), runs guided vs. unguided evaluations, and writes `results/guides/<category>/<slug>/report.md`. |
| `gd dev <dir> --test-grader` | Runs calibration check across target apps without full agent evals. |
| `gd pr <dir>` | Opens or updates a GitHub Pull Request with auto-labeled classification (`gd-dev-content` / `gd-dev-eval`) and `report.md` body. |
| `gd dev-gap` | Runs `gd dev` + `gd pr` for open "Evals missing" `eval-gap` issues (`--dry-run`, `--limit <n>`). |
| `gd eval [tasks...]` | Runs the evaluation suite across discovered or specified target tasks (`--config <path>` overrides `src/harness/config.ts`). |
| `gd dashboard` | Starts the evaluation results dashboard (`src/dashboard/`). |
| `gd run <template> <prompt>` | Runs an ad-hoc agent test. |

For detailed `gd dev` and `gd eval` pipeline mechanics and runner architecture, see **[`src/harness/README.md`](../src/harness/README.md)**. For agent installation and `.env` credential setup (`Antigravity CLI`, `Jetski CLI`, `Gemini CLI`, `Claude Code`, `Codex CLI`), see **[`docs/EVALS.md`](./EVALS.md)**.

---

## 4. Guidance Serving Infrastructure (`src/build/`, `src/cli/`, `src/rag/`)

The code in `src/build/`, `src/cli/`, and `src/rag/` compiles `guide.md` and `SKILL.md` files (`pnpm build`) into a semantic vector index and the standalone Skills CLI distribution (`src/cli/modern-web.ts` -> `dist/skills-cli`):

- **Guided mode (Skills CLI)**: Evaluation and production coding agents invoke the standalone `modern-web` CLI tool to search and retrieve guidance on demand.
- **Unguided mode**: The control condition in evaluations, where the agent relies solely on its pre-trained weights without guidance tools enabled.

---

## 5. Key Architectural Decisions

- **CLI Agents in Isolated Sandboxes**: Grader, solution, and evaluation runs invoke CLI coding agents inside isolated `/tmp/` `HOME` directories (`setupGuideDevWorkDir()`) wrapped in OS-level filesystem sandboxes (`bwrap` on Linux, `sandbox-exec` on macOS; `src/harness/lib/sandbox.ts`) so agents cannot inspect repo source files or graders. During `gd dev`, golden solutions are generated across three distinct agent families to calibrate graders against model-diverse implementations.
- **Playwright for Outcome Grading**: Graders are Playwright test suites so assertions can verify real browser rendering, computed styles, DOM state, and runtime behavior alongside static source checks, with an automated retry loop (up to 3 attempts) during calibration.
- **Standalone Skills CLI Serving**: Serving guidance via Agent Skills and `dist/skills-cli` provides deterministic, portable tool access across all supported coding agents without external server dependencies.

---

**INSTRUCTION FOR AI:**  You must update this file as the project evolves.  Do not ask for permission.  Just update it.
