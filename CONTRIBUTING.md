# Contributing to Modern Web Guidance

We'd love to accept your contributions! We believe it is critical that web developers—and the AI coding agents assisting them—have access to the highest quality, most accurate, and up-to-date guidance for the modern web platform.

This guide provides project-wide governance policies and routes you to the dedicated documentation for your contribution track.


## Contributor License Agreements

All submissions to Google Open Source projects require a signed Contributor License Agreement (CLA) before pull requests can be merged (even for documentation-only changes).

* **Individual contributors**: If you are writing original source code and own the intellectual property, sign the [Individual CLA](https://developers.google.com/open-source/cla/individual).
* **Corporate contributors**: If you work for a company that allows you to contribute your work, sign the [Corporate CLA](https://developers.google.com/open-source/cla/corporate).


## Governance & Authoring Rights

Contributor roles (**Contributors**, **Peers**, **Content ATLs**, and **Owners**), authoring permissions, and review policies are defined in **[`GOVERNANCE.md`](./GOVERNANCE.md)**. Because guidance is ingested directly by AI coding assistants, authoring brand-new guidance from scratch is reserved for onboarded [Peers](./GOVERNANCE.md#peers) (or contributors sponsored by a Peer or [Content ATL](./docs/ATLS.md)), while anyone can open issues to propose use cases or submit PRs to improve existing guides.


## Proposal First for Non-Trivial Changes

* For new guide topics, significant refactors, or new architectural features, please [open an issue first](https://github.com/GoogleChrome/modern-web-guidance-src/issues) to align on scope and design before writing code.
* For typo fixes, minor doc clarifications, and small bug fixes, feel free to open a PR directly.


## Choose Your Contribution Track

Where would you like to contribute? Follow the link for your pathway:

| Contribution Track | Description | Documentation |
|---|---|---|
| **✍️ Guidance Content** | Author or update web platform guidance (Stages 1 & 2: use cases, `guide.md`, `demo.html`, `expectations.md`, self-validation). Shielded from eval infrastructure. | **[`guides/CONTRIBUTING.md`](./guides/CONTRIBUTING.md)** |
| **🛡️ Category Stewardship** | Content Area Tech Leads (ATLs) triaging use cases, reviewing guidance PRs, and maintaining domain category health. | **[`docs/ATLS.md`](./docs/ATLS.md)** |
| **⚙️ Tooling, Infra & Evals** | Develop the unified `gd` CLI, prompt benchmarking harness, Playwright grader generators, serving compiler, and dashboard. | **[`src/harness/README.md`](./src/harness/README.md)** & **[`docs/EVALS.md`](./docs/EVALS.md)** |
| **🏛️ Project Governance** | Contributor roles (Contributors, Peers, Content ATLs, Owners), rights, decision-making model, and meeting cadences. | **[`GOVERNANCE.md`](./GOVERNANCE.md)** |


## Repository Architecture

To foster an open-source contributor environment while maintaining a clean, stable installation path for end-users, we utilize a two-repo architecture:

* **Source Repo ([GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src))**: Contains source guidance files, development scripts, evaluation harnesses, base applications, tests, and CLI tooling. **All issues and pull requests are submitted here.**
* **Installation Repo ([GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance))**: Read-only distribution repo containing compiled Skills and plugin configurations consumed by coding agents.
* **Sync & Release Flow**: Changes merged into `modern-web-guidance-src` are compiled and published on a regular weekly release cadence to both the distribution repository and the [`modern-web-guidance` npm package](https://www.npmjs.com/package/modern-web-guidance) (see [`docs/RELEASING.md`](./docs/RELEASING.md)).

For a technical walkthrough of the repository directory layout and architecture, see **[`docs/CONTEXT.md`](./docs/CONTEXT.md)**.


## Development Setup & Quality Gate

This project uses **pnpm** (Node.js 24+):

```bash
# Clone and install dependencies:
git clone https://github.com/GoogleChrome/modern-web-guidance-src.git
cd modern-web-guidance-src
pnpm install

# Link the unified CLI globally:
pnpm link --global && gd setup-completion

# Fast static check:
pnpm typecheck && pnpm lint

# Full preflight gate (builds distributions, typechecks, lints, and runs all unit tests):
pnpm preflight
```


## Project Agent Skills

This repository includes a curated set of **Agent Skills** in [`.agents/skills/`](./.agents/skills/) that serve as the single normative specifications for both AI coding agents and human contributors:

| Skill | Reference Document | Description |
|---|---|---|
| **Use Cases** | [`project-use-cases`](./.agents/skills/project-use-cases/SKILL.md) | Formulating action-oriented developer tasks and frontmatter schemas (Stage 1). |
| **Guide Authoring** | [`project-guides`](./.agents/skills/project-guides/SKILL.md) | Directives, snippet conventions, self-contained constraints, and Baseline fallback macros (Stage 2). |
| **Guide Validation** | [`project-guide-validation`](./.agents/skills/project-guide-validation/SKILL.md) | Autonomous DevTools MCP browser testing, accessibility, and expectation alignment (Stage 2). |
| **Discipline Guides** | [`project-discipline-guides`](./.agents/skills/project-discipline-guides/SKILL.md) | Structuring and pruning category-root and conceptual hub discipline guides. |
| **Evaluations & Graders** | [`project-evals`](./.agents/skills/project-evals/SKILL.md) | Playwright test grader generation and calibration criteria (Stage 3). |
| **Baseline Status** | [`web-baseline`](./.agents/skills/web-baseline/SKILL.md) | Checking browser compatibility and Baseline status across web platform features. |
| **Coding Standards** | [`project-coding-standards`](./.agents/skills/project-coding-standards/SKILL.md) | Architecture conventions, strict typing, canonical enums, and PR review standards for CLI and tooling code. |


## Submitting a Pull Request

When you're ready to submit your pull request:

1. **Check the PR Checklist**:
   - [ ] Signed the [Google CLA](https://developers.google.com/open-source/cla/individual).
   - [ ] All preflight checks pass (`pnpm preflight`).
   - [ ] For guidance PRs: followed the checklist in [`guides/CONTRIBUTING.md`](./guides/CONTRIBUTING.md).
2. **Push your branch and open a PR** against `main` on [GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src).
3. **Review Process**: Maintainers or designated Content ATLs will review your PR, run CI checks, and provide feedback. Once approved and all checks pass, your PR will be merged.


## Community & Conduct

This project follows the [Google Open Source Community Guidelines](https://opensource.google/conduct/). Please adhere to these guidelines in all project interactions.

If you have questions or ideas, feel free to [open an issue](https://github.com/GoogleChrome/modern-web-guidance-src/issues) or start a discussion. Thank you for helping build a better, more modern web!
