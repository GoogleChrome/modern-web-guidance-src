# Contributing to Modern Web Guidance

We'd love to accept your contributions! We believe it is critical that web developers—and the AI coding agents assisting them—have access to the highest quality, most accurate, and up-to-date guidance for the modern web platform.

This guide provides project-wide governance policies and routes you to the dedicated documentation for your contribution track.


## Contributor License Agreements

All submissions to Google Open Source projects require a signed Contributor License Agreement (CLA) before pull requests can be merged (even for documentation-only changes).

* **Individual contributors**: If you are writing original source code and own the intellectual property, sign the [Individual CLA](https://developers.google.com/open-source/cla/individual).
* **Corporate contributors**: If you work for a company that allows you to contribute your work, sign the [Corporate CLA](https://developers.google.com/open-source/cla/corporate).


## Governance & Authoring Rights

This project operates under a formal governance model:

* **Contributors**: Community members can submit pull requests to fix bugs, clarify documentation, update Baseline compatibility, or improve existing guides, reference demos, and expectations. Contributors can propose new guides by [opening an issue](https://github.com/GoogleChrome/modern-web-guidance-src/issues).
* **Peers**: Formally onboarded Subject Matter Experts with write access who author new guidance and provide peer reviews.
* **Content Area Tech Leads (Content ATLs)**: Designated domain stewards who triage new use cases, review, approve, and merge guidance PRs within their assigned category.
* **Owners**: Project leads responsible for high-level technical direction, infrastructure, serving platforms, and governance.

> **Note on Authoring New Guidance**: Because guidance is ingested directly by autonomous AI coding assistants to write production code across the web ecosystem, **authoring brand-new guidance from scratch is reserved for [Peers](./GOVERNANCE.md#peers)** (or contributors co-authoring with an assigned Peer or Content ATL).

For complete details on roles, decision making, and becoming a Peer or Content ATL, see **[`GOVERNANCE.md`](./GOVERNANCE.md)**.


## Proposal First for Non-Trivial Changes

* For new guide topics, significant refactors, or new architectural features, please [open an issue first](https://github.com/GoogleChrome/modern-web-guidance-src/issues) to align on scope and design before writing code.
* For typo fixes, minor doc clarifications, and small bug fixes, feel free to open a PR directly.


## Choose Your Contribution Track

Where would you like to contribute? Follow the link for your pathway:

| Contribution Track | Description | Documentation |
|---|---|---|
| **✍️ Guidance Content** | Author or update web platform guidance (Stages 1 & 2: use cases, `guide.md`, `demo.html`, `expectations.md`, self-validation). Shielded from eval infrastructure. | **[`guides/CONTRIBUTING.md`](./guides/CONTRIBUTING.md)** |
| **🛡️ Category Stewardship** | Content Area Tech Leads (ATLs) triaging use cases, reviewing guidance PRs, and maintaining domain category health. | **[`guides/ATLS.md`](./guides/ATLS.md)** |
| **⚙️ Tooling, Infra & Evals** | Develop the unified `gd` CLI, prompt benchmarking harness, Playwright grader generators, serving compiler, and dashboard. | **[`harness/README.md`](./harness/README.md)** |
| **🏛️ Project Governance** | Contributor roles (Contributors, Peers, Owners), rights, decision-making model, and meeting cadences. | **[`GOVERNANCE.md`](./GOVERNANCE.md)** |


## Repository Architecture

To foster an open-source contributor environment while maintaining a clean, stable installation path for end-users, we utilize a two-repo architecture:

* **Source Repo ([GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src))**: Contains source guidance files, development scripts, evaluation harnesses, base applications, tests, and CLI tooling. **All issues and pull requests are submitted here.**
* **Installation Repo ([GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance))**: Read-only distribution repo containing compiled Skills and plugin configurations consumed by coding agents.
* **Sync & Release Flow**: Changes merged into `modern-web-guidance-src` are compiled and published on a regular weekly release cadence to both the distribution repository and the [`modern-web-guidance` npm package](https://www.npmjs.com/package/modern-web-guidance).


## Development Setup & Quality Gate

This project is managed as a **pnpm workspace**.

```bash
# Clone and install dependencies:
git clone https://github.com/GoogleChrome/modern-web-guidance-src.git
cd modern-web-guidance-src
pnpm install

# Link the unified CLI globally:
pnpm link --global && gd setup-completion

# Fast static check:
pnpm typecheck && pnpm lint

# Full preflight gate (builds workspaces, typechecks, lints, and runs all unit tests):
pnpm preflight
```


## Project Agent Skills

This repository includes a curated set of **Agent Skills** in [`.agents/skills/`](./.agents/skills/).

* **For AI Coding Agents**: Coding assistants (such as Antigravity, Claude Code, or Gemini CLI) automatically discover and use these skills to follow repository conventions, generate formatted frontmatter, calibrate graders, and write testable expectations.
* **For Human Contributors**: Each skill's `SKILL.md` serves as a normative specification.

| Skill | Reference Document | Description |
|---|---|---|
| **Use Cases** | [`project-use-cases`](./.agents/skills/project-use-cases/SKILL.md) | Formulating action-oriented developer tasks and frontmatter schemas (Stage 1). |
| **Guide Authoring** | [`project-guides`](./.agents/skills/project-guides/SKILL.md) | Directives, snippet conventions, self-contained constraints, and Baseline fallback macros (Stage 2). |
| **Guide Validation** | [`project-guide-validation`](./.agents/skills/project-guide-validation/SKILL.md) | Autonomous DevTools MCP browser testing, accessibility, and expectation alignment (Stage 2). |
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