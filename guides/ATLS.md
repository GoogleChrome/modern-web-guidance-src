# Content Area Tech Leads (ATLs)

Content Area Tech Leads (Content ATLs) are project [Peers](../GOVERNANCE.md#peers) and long-term contributors who take ownership and stewardship over entire domain categories in Modern Web Guidance (e.g., *Performance*, *CSS*, *Forms*, *UI Behaviors*, *Accessibility*).

ATLs ensure that all guidance within their domain is technically accurate, aligned with modern web standards, comprehensive, and ready for automated evaluation.


## Core Responsibilities

### 1. Subject Matter Expertise
* Possess deep, domain-level expertise spanning the entire scope of your category.
* Serve as the primary technical point of contact for contributors and maintainers on architectural, design, or platform questions in your area.

### 2. Authoring & Peer Review
* Act as the primary author or designated reviewer/approver for all guide content created within your category.
* Author high-quality guidance for new use cases and provide thorough technical review for PRs submitted by other contributors.
* **Technical Review & Sign-Off**: Ensure that every guide in your category has been authored or formally reviewed and approved by a Peer before it is merged.

### 3. Coverage Strategy
* Proactively research the web platform landscape and identify gaps where new guidance is needed to address low AI agent performance or developer pain points.
* Prioritize high-impact developer tasks over niche APIs or visual tricks.

### 4. Continuous Content Maintenance
* Continuously update and evolve guidance as new web standards, browser features, and best practices emerge.
* Refactor or prune guidance if evaluation metrics indicate it is redundant (e.g., when modern foundation models naturally produce the modern pattern without guidance).

### 5. Evaluation & Quality Triage
* **Coordinate with Engineering**: Partner with the Engineering team when investigations into low-performing or regressing automated eval runs indicate potential content issues.
* **Content & Expectations Assessment**: Assess whether failing evaluations stem from guidance clarity or accuracy gaps in `guide.md`, missing fallbacks, or ambiguous/misaligned criteria in `expectations.md` (which serves as the interface for the Engineering team's automated graders).
* **Guidance Remediation**: Adjust and iterate on `guide.md` and `expectations.md` when evaluation investigations indicate suboptimal guidance or misaligned expectations.
* **Community Feedback**: Troubleshoot and resolve bug reports or guidance quality feedback reported by the community.

### 6. Use Case Validation (Stage 1)
* Triage and align on proposed new use cases within your category before authors invest effort in full guide authoring.
* Ensure use cases are action-oriented tasks (starting with verbs, focusing on WHAT rather than HOW, and avoiding API catalogs).

### 7. Evaluation Readiness & Expectations Sync
* Ensure all guides within your category are fully "eval-ready".
* Verify that the natural-language assertions in `expectations.md` are kept in sync with the recommendations and code examples in `guide.md`, as the evaluation harness uses these expectations to generate automated Playwright graders.

### 8. Baseline & Fallback Alignment
* Align all guidance and expectations with a **Baseline Widely available** target.
* If a recommended feature is newly available or limited availability, verify that the guide mandates (and `expectations.md` tests for) appropriate fallback strategies or progressive enhancement patterns.

### 9. Discipline Guide Decomposition
* Ensure discipline-level skills (e.g., CSS, JS, Performance) are broken down into granular, focused subskills rather than monolithic mega-guides.
* The primary discipline-level guide (e.g., `guides/css/css/guide.md`) should serve as a conceptual hub that establishes the agent's mental model and links granular subskills via the `{{ GUIDE_REF("guide-slug") }}` macro.
* **Specification**: See [`.agents/skills/project-discipline-guides/SKILL.md`](../.agents/skills/project-discipline-guides/SKILL.md).


## Category Ownership & Lookup

ATL stewardship spans both **domain verticals** (directory categories) and **guidance horizontals** (cross-cutting feature groups like Motion or WebAuthn).

Official ownership mapping is maintained in **[`guides/atls.json`](./atls.json)**, which resolves ATL assignments through three hierarchical tiers:

1. **`web_features`**: Specific feature-level overrides (highest priority, e.g., `prefers-reduced-motion`, `canvas-html`).
2. **`web_features_groups`**: Cross-cutting guidance horizontals and feature groups (e.g., `animation`, `transitions`, `view-transitions`, `scrolling`, `webauthn`).
3. **`default`**: Domain vertical defaults across guidance directories (`css`, `forms`, `performance`, `ui-behaviors`, `ui-components`, `built-in-ai`, `privacy`, `security`, `webmcp`, etc.).

When opening a PR or triaging issues, check [`guides/atls.json`](./atls.json) to identify and tag the assigned ATL.


## Review & Triage Workflows

### Reviewing Stage 1 Use Cases
When a contributor opens an issue or PR proposing a new use case:
1. Verify action-oriented task phrasing (e.g., *"Apply component styles conditionally based on parent container size"*).
2. Check for duplication against existing guides in your category and across other disciplines.
3. Confirm that the feature solves a high-priority, real-world developer problem.
4. Approve the use case so the author can proceed to Stage 2. *(Note: Onboarded Peers may fast-track and skip Stage 1 review).*

### Reviewing Stage 2 Guidance PRs
When a contributor submits a PR containing `guide.md`, `demo.html`, and `expectations.md`:
1. **Technical & Accuracy Review**: Review guidance for domain accuracy, modern idioms, and alignment with repository directives.
2. **Check Directives & Self-Containment**: Verify that `guide.md` uses imperative directives (`MANDATORY:`, `DO`, `DO NOT`), includes inline code comments explaining choices, and contains **no external links**.
3. **Verify Baseline Fallbacks**: Ensure non-widely available features include fallback strategies using the `{{ FEATURE_FALLBACKS("feature-id") }}` macro.
4. **Inspect Demo & Expectations**: Ensure `demo.html` is clean, standalone, and warning-free in DevTools, and that `expectations.md` lists testable, observable outcomes matching the guide.
5. **Encourage Self-Validation**: Verify that the author ran the [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) skill.
