# AGENTS.md

This repository authors **Modern Web Guidance** for web platform features (`guides/`), standalone skills (`skills-src/`), and the evaluation harness (`src/`). Because `guide.md` is the **only** file retrieved by external coding agents at runtime (`demo.html`, `expectations.md`, and `targets/` are used within this repo for validation and evaluation), all guidance must be self-contained, deterministic, and command-oriented.

## Required Project Skills (Single Source of Truth)

Always read and follow `.agents/skills/<skill>/SKILL.md` before starting a task:

- `project-features`: Filing & triaging `new-feature` issues
- `project-use-cases`: Identifying use cases (Stage 1 — `guide.md` frontmatter stubs)
- `project-guides`: Authoring guidance (Stage 2 — `guide.md`, `demo.html`, `expectations.md`)
- `project-evals`: Authoring & reviewing evals (Stage 3 — `expectations.md`, `task.md`, `grader.ts`)
- `project-guide-validation`: Validating & reviewing guides
- `project-discipline-guides`: Discipline guides (`DISCIPLINE_GUIDES` in `src/core/guide-validation.ts`)
- `project-coding-standards`: Repo TypeScript & CLI code (`src/`, `bin/`)
- `eval-investigation`, `nightly-eval-investigation`, `dev-prompt-canary`: Eval diagnostics & `gd dev` prompt changes
- `project-maintenance`, `coherence-auditor`: Routine maintenance & coherence audits

For repository architecture, governance, and contributor workflows, see [`docs/CONTEXT.md`](./docs/CONTEXT.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`GOVERNANCE.md`](./GOVERNANCE.md), [`guides/CONTRIBUTING.md`](./guides/CONTRIBUTING.md), and [`docs/ATLS.md`](./docs/ATLS.md).

## PR Review Etiquette

- Prefix agent-posted GitHub comments and replies to indicate human involvement: `🤖` autonomous (unsteered on this point), `✨` directed (from a quick human prompt), or `🧠` co-designed (shaped through multi-turn human iteration or debugging).
- When accepting a ` ```suggestion ` block verbatim, commit it via the GitHub UI/API or in a dedicated commit (`Apply suggestions from code review`) with `Co-authored-by: Name <email>` trailers.
- Reply to every addressed review thread (citing the commit SHA or explaining how a suggestion was adapted).
