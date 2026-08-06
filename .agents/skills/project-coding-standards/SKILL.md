---
name: project-coding-standards
description: Coding style, architectural conventions, and PR review standards for the modern-web-guidance-src (guidance) repository. Use when authoring new code, refactoring features, writing CLI tools, adding server endpoints, or preparing PRs for review.
---

# Guidance Repository Coding Standards & Review Guidelines

## Overview
This skill defines the architectural principles, coding conventions, and PR review standards for the `modern-web-guidance-src` repository.

Follow these guidelines whenever authoring TypeScript, JavaScript, CLI commands, harness utilities, server endpoints, or dashboard code.

---

## PR Scope and Modularity

### Keep PRs Focused and Single-Purpose
- **Split multi-component features:** Do not combine backend data models, CLI tools, and frontend UI changes into a single monolithic PR.
- **Logical progression:** Structure larger features into small, stacked, or sequential PRs:
  1. Data layer / core libraries (parsing, normalization, abstractions)
  2. CLI workflows and execution commands
  3. UI / visualization components and dashboard views
- Smaller, well-scoped PRs are easier to review, test, and safely revert if regressions occur.

---

## Architectural Principles

### Use Existing Abstractions & CLI Runners
- **Reuse repository tooling:** When interacting with LLMs or executing agent workflows, use the shared repository abstractions in `config.environment` (such as `config.environment.jetskiCliBin` or `config.environment.geminiCliBin`) instead of writing custom REST API clients, bespoke fetch loops, or ad-hoc token validators.
- **Environment and flag handling:** Respect standard environment toggles (such as `GD_DEV_USE_JETSKI === '1'`) and omit non-essential flags (e.g., omit `--yolo` for non-interactive or diagnostics tasks).

### Single Source of Truth & Canonical Enums
- **Never hardcode string constants for agents or serving modes:**
  - Use centralized enums like `Agents` from `harness/config.ts` (`Agents.JETSKI`, `Agents.CLAUDE_CODE`, `Agents.GEMINI_CLI`, `Agents.CODEX_CLI`).
  - Use centralized enums like `Serving` from `harness/config.ts` (`Serving.MCP`, `Serving.SKILLS_CLI`).
- **Extract metadata from source-of-truth files:**
  - Never infer properties (such as `targetFile`, `agent`, or `serving` mode) using fragile path heuristics or regexes if canonical metadata files (e.g., `evals.json`) exist in the parent hierarchy. Extract canonical properties directly from `evals.json`.

### Modular Prompt & Template Management
- **Separate prompts from execution logic:** Do not embed long prompt templates, system instructions, or markdown synthesizer templates inside runtime runner files.
- Place prompts and instructions into dedicated modules (e.g., `*-prompts.ts`) to maintain clean separation of concerns.

---

## File, Git, & Config Integrity

### Never Weaken Shared Tooling or tsconfig
- **Strict type safety is non-negotiable:** Never modify shared root configurations (`tsconfig.json`, `.oxlintignore`, `package.json`) to bypass typecheck or lint failures.
- Fix types properly with TypeScript interfaces and types, or use targeted JSDoc annotations in `.js` files.

### Targeted Remote I/O & Robust Caching
- **Scope remote storage operations:** When downloading from remote stores (such as Cloud Storage/GCS buckets), scope queries and downloads strictly to the specific prefixes and subdirectories needed for the task. Never fetch entire buckets or unrelated directories.
- **Local caching first:** Always check whether required assets or result files already exist locally before initiating remote downloads, avoiding redundant network traffic.

### Keep Repository Clean of Generated Artifacts
- **Ignore transient outputs:** Never commit test outputs, debug files, local caches, or working directories.
- Store temporary data in standard output locations (e.g., `harness/results/`) and ensure `.gitignore` excludes transient files.

---

## Frontend & Dashboard Guidelines

### Dual-Environment Compatibility (Static vs. Local Server)
- **Graceful degradation:** The evaluation dashboard operates in both static hosted mode (e.g., GitHub Pages) and local server mode (`gd dashboard`). Features, actions, or API endpoints requiring a local Node server must detect static mode and gracefully hide or disable themselves.
- **Explicit data sourcing:** When requesting data from local server endpoints, pass the data source context (such as `?source=local`) so the server can distinguish local file operations from remote streaming.

### Disambiguate Multi-Run and Temporal Data
- **Handle multiple runs gracefully:** Do not assume only a single run exists per day or per task. Distinguish runs using explicit run indices and timestamps to prevent datasets from overwriting or collapsing together.
- **Robust query parameter handling:** Ensure URL query parameters are safely parsed with proper fallbacks, preserving dashboard state across navigations.

### Safe URL & Path Construction
- **Avoid protocol-relative URL bugs:** When constructing URLs from path variables, sanitize slashes to avoid accidental leading double slashes (`//...`), which browsers interpret as protocol-relative hostnames.

### UI Precision & Alignment
- **Mathematical centering:** Ensure chart markers, badges, indicators, and tooltips are centered horizontally and vertically over their target elements so visual associations are unmistakable.

---

## Verification & Testing Gates

### Tiered Preflight Gates
All changes must pass verification before PR submission:
- **Core preflight gate (all PRs):** Runs build, typecheck, lint, and unit tests across all workspace packages in parallel:
  ```bash
  pnpm run preflight
  ```
- **Browser E2E gate (eval-view / dashboard / UI changes):** Playwright browser tests are not included in `pnpm run preflight` and must be executed when touching frontend visualizers, dashboard code, or server endpoints in `eval-view/`:
  ```bash
  pnpm --filter eval-view run test:e2e
  ```
  *(Run `pnpm run setup:playwright` first if browser binaries are not installed).*

### Domain-Specific Validation
- **Serving & Skills:** When modifying MCP servers or skills packaging, verify with `pnpm --filter serving run publish-skills --dry-run`.
- **Guides & Graders:** When authoring or updating evaluation capsules, verify grader calibration via `gd dev <guide> --test-grader`.
- **Clean Git Tree:** The build must produce zero uncommitted side effects or untracked artifacts (`git status` must remain clean).

### Code Hygiene
- **Safe data parsing:** Never use `eval()` to parse data or JSON; use `JSON.parse()` or dedicated parsers.
- **Clean regular expressions:** Avoid raw or unescaped control characters in regular expressions; use explicit Unicode escapes (e.g., `[\u001b\u009b]`).

---

## Quick Reference Checklist Before Submitting PRs

1. [ ] **PR Scope:** Focused on a single feature, library, or UI component (no monolithic multi-component PRs).
2. [ ] **Abstractions:** Reuses repository CLI runners (`config.environment`) and avoids custom API clients.
3. [ ] **Enums:** Uses `Agents` and `Serving` enums from `harness/config.ts` rather than raw string constants.
4. [ ] **Metadata:** Reads properties from canonical metadata files (`evals.json`) instead of path heuristics.
5. [ ] **Prompts:** Extracted into dedicated `*-prompts.ts` or constants modules.
6. [ ] **Configs:** Root `tsconfig.json`, `package.json`, and `.oxlintignore` are untouched unless explicitly intended.
7. [ ] **Remote I/O & Git:** Remote fetches are strictly scoped and cached; no transient debug artifacts committed.
8. [ ] **Dashboard/UI:** Handles static vs. local server modes; URL parameters safely parsed and sanitized.
9. [ ] **Verification:** `pnpm run preflight` (and `pnpm --filter eval-view run test:e2e` for `eval-view/` changes) passes with 0 errors.
