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
- `nightly-eval-investigation`, `dev-prompt-canary`, `grader-replay`: Eval diagnostics, grader replay, & `gd dev` prompt changes
- `project-maintenance`, `coherence-auditor`: Routine maintenance & coherence audits

For repository architecture, terminology, governance, and contributor workflows, see [`docs/CONTEXT.md`](./docs/CONTEXT.md), [`docs/LEXICON.md`](./docs/LEXICON.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`GOVERNANCE.md`](./GOVERNANCE.md), [`guides/CONTRIBUTING.md`](./guides/CONTRIBUTING.md), and [`docs/ATLS.md`](./docs/ATLS.md).

## GitHub & PR Etiquette

- **External Contributor Gate (non-Peers/ATLs/Owners):** Before opening a PR, verify: (1) the user signed the [Google CLA](https://cla.developers.google.com/) with their `git config user.email`, (2) an agreed-upon issue exists and is assigned to them or labeled `help wanted` (open issues and maintainer follow-up comments are **not** invitations to PR; only unambiguous typos/broken links skip this), (3) no open competing PR targets the issue and the user has **0 other open PRs** in this repo (limit: 1 open PR at a time), and (4) content diffs touch at most **1 guide directory**. If any check fails, stop and do not open a PR.
- **Provenance Prefix:** Prefix agent-drafted GitHub issues, PR descriptions, and review comments with `🤖` autonomous (unsteered), `✨` directed (quick prompt), or `🧠` co-designed (multi-turn iteration/debugging).
- **No AI Commit Trailers:** Never emit `Co-Authored-By:` trailers for AI models or tools.
- **PR Descriptions:** Keep descriptions concise and focused on the motivation and net effect—no introductory fluff ("This PR..."), no repeating the title, no listing changed files/methods already visible in the diff, and no verification boilerplate.
- **Review Replies:** Commit verbatim ` ```suggestion ` blocks with human `Co-authored-by: Name <email>` trailers, reply to every addressed thread (citing the commit SHA or explaining how a suggestion was adapted), and resolve the thread.
