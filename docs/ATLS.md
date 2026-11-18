# Content Area Tech Leads (ATLs)

Content Area Tech Leads (Content ATLs) are project [Peers](../GOVERNANCE.md#peers) and long-term contributors who take ownership and stewardship over domain categories (e.g., *Performance*, *CSS*, *Forms*, *UI Behaviors*, *Accessibility*) and cross-cutting feature horizontals in Modern Web Guidance.

Content ATLs ensure that all guidance within their domain is technically accurate, aligned with modern web standards, and ready for downstream automated evaluation.


## Core Responsibilities

* **Subject Matter Expertise & Coverage Strategy**: Serve as the primary technical point of contact for architectural or platform questions in their area, and proactively identify high-impact developer tasks where new guidance is needed.
* **Use Case Validation (Stage 1)**: Triage and align on proposed new use cases within their category against the [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md) criteria before authors invest effort in full guide authoring.
* **Authoring & Technical Review (Stage 2)**: Author guidance for new use cases and provide formal technical review and sign-off on PRs in their domain against the [`project-guides`](../.agents/skills/project-guides/SKILL.md) and [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) standards. Every guide must be authored (or co-authored/sponsored) by a Peer or Content ATL and approved according to [`GOVERNANCE.md`](../GOVERNANCE.md#content-area-tech-leads-content-atls) before merging.
* **Discipline Guide Stewardship**: Ensure discipline-level guides are decomposed into focused subguides rather than monolithic guides, following [`project-discipline-guides`](../.agents/skills/project-discipline-guides/SKILL.md).
* **Evaluation Triage & Continuous Maintenance**: Partner with the Engineering team when automated evaluations surface content or expectation issues, keep `guide.md` and `expectations.md` aligned as web standards and Baseline statuses evolve, and prune guidance that becomes redundant.


## Category Ownership & Lookup

ATL stewardship spans both **domain verticals** (directory categories) and **guidance horizontals** (cross-cutting feature groups like Motion or WebAuthn).

Official ownership mapping is maintained in **[`.github/atls.json`](../.github/atls.json)**. When routing pull requests, `src/ci/atl-triage.ts` resolves a **single lead reviewer** per modified guide using a strict precedence waterfall (falling through to the next tier only when no eligible reviewer matches or the reviewer is the PR author):

1. **Primary Guide Author (`git blame`)**: For updates to existing guides, the active [Peer](../GOVERNANCE.md#peers)/ATL/Owner with write access who authored the primary share of `guide.md` (who may manually tag a category ATL for a second opinion when needed).
2. **`web_features`**: Specific feature-level assignments in `.github/atls.json` (e.g., `prefers-reduced-motion`, `canvas-html`).
3. **`web_features_groups`**: Cross-cutting guidance horizontals and feature groups (e.g., `animation`, `transitions`, `view-transitions`, `scrolling`, `webauthn`).
4. **`default`**: Domain vertical defaults across guidance directories (`css`, `forms`, `performance`, `ui-behaviors`, `ui-components`, `built-in-ai`, `privacy`, `security`, `webmcp`, etc.), picking the candidate with the fewest open review requests when a tier lists multiple leads.

The `.github/workflows/atl-triage.yml` workflow gates external contributor PRs on an approved (`pr-welcome` or author-assigned) issue and a passing `cla/google` check before requesting review.


## Review & Triage Workflows

* **Reviewing Stage 1 Use Cases**: Verify that proposed use cases follow [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md) (action-oriented task phrasing, non-duplicative scope, real-world developer impact) before approving the author to proceed to Stage 2.
* **Reviewing Stage 2 Guidance PRs**: Verify that `guide.md`, `demo.html`, and `expectations.md` satisfy [`project-guides`](../.agents/skills/project-guides/SKILL.md) and [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) (technical accuracy, self-contained guidance, appropriate Baseline fallback macros, clean standalone demo, and observable expectations).
* **Triaging Volatility Objections**: Within two weeks of the `volatility` label being applied to an issue or pull request in their domain, assess the concern (e.g., whether guidance can be scoped to a stable subset of the feature) and recommend an outcome for the Owners to decide per [Volatility Objections](../guides/CONTRIBUTING.md#volatility-objections).
