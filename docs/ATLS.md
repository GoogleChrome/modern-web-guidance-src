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

Official ownership mapping is maintained in **[`.github/atls.json`](../.github/atls.json)**, which resolves ATL assignments through three hierarchical tiers:

1. **`web_features`**: Specific feature-level overrides (highest priority, e.g., `prefers-reduced-motion`, `canvas-html`).
2. **`web_features_groups`**: Cross-cutting guidance horizontals and feature groups (e.g., `animation`, `transitions`, `view-transitions`, `scrolling`, `webauthn`).
3. **`default`**: Domain vertical defaults across guidance directories (`css`, `forms`, `performance`, `ui-behaviors`, `ui-components`, `built-in-ai`, `privacy`, `security`, `webmcp`, etc.).

The `.github/workflows/atl-triage.yml` workflow automatically uses [`.github/atls.json`](../.github/atls.json) to assign and request review from the designated Content ATL on issues and pull requests.


## Review & Triage Workflows

* **Reviewing Stage 1 Use Cases**: Verify that proposed use cases follow [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md) (action-oriented task phrasing, non-duplicative scope, real-world developer impact) before approving the author to proceed to Stage 2.
* **Reviewing Stage 2 Guidance PRs**: Verify that `guide.md`, `demo.html`, and `expectations.md` satisfy [`project-guides`](../.agents/skills/project-guides/SKILL.md) and [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) (technical accuracy, self-contained guidance, appropriate Baseline fallback macros, clean standalone demo, and observable expectations).
