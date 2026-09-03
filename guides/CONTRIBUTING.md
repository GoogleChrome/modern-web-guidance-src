# Contributing Guidance

This guide is for **Peers and content contributors** authoring or updating web platform guidance in `guides/`.

Under our [Governance Model](../GOVERNANCE.md), authoring brand-new guidance from scratch is reserved for **[Peers](../GOVERNANCE.md#peers)** (or contributors co-authoring with an assigned Peer/ATL). Community **Contributors** are warmly invited to propose new guide topics via [Issues](https://github.com/GoogleChrome/modern-web-guidance-src/issues) and submit PRs to improve existing guides, demos, and expectations.

As a guidance author, your focus is entirely on **technical accuracy and best practices**: identifying real-world developer tasks, authoring concise and self-contained guidance, building working reference demos, and defining testable expectations. You do **not** need to write Playwright test code, configure evaluation sandboxes, or manage automated grader pipelines.


## Guidance Scope & Standards

* **Vendor-Agnostic Guidance**: Core guides focus on standard web platform APIs aligned with the [web-features project](https://github.com/web-platform-dx/web-features) and [Browser Compat Data (BCD)](https://github.com/mdn/browser-compat-data). Guidance must remain vendor-agnostic.
* **Origin Trials (OT)**: Origin trial features are excluded from core guidance due to API volatility and setup churn.
* **Baseline Target & Fallbacks**: Guidance targets **Baseline Widely available** web features. When recommending newly available or emerging features, guides **must** include appropriate fallback strategies or progressive enhancement patterns.


## The Guidance Lifecycle for Content Contributors

Guidance development consists of two authoring stages:

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ Stage 1: Identifying Use Cases       │ ──> │ Stage 2: Authoring Guidance          │
│ Define action-oriented tasks & stub  │     │ Write guide.md, demo.html, & expects │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

> **Stage 3 (Evaluations & Graders)**: Evaluation test suites (`grader.ts`), solution patches, and calibration runs are handled downstream via automated tooling and evaluation contributors. Content Area Tech Leads (ATLs) coordinate directly with the Engineering team to triage eval results and adjust guidance if failures are content-related. Content authors are strictly responsible for Stages 1 and 2.


## Stage 1: Identifying Use Cases (Needs use cases)

A use case is an **action-oriented developer task**, not an API catalog.

### Authoring Rules:
* **Task-Oriented Phrasing**: Start with an action verb (e.g., *"Apply component styles conditionally based on parent container size"* or *"Smoothly transition state changes across DOM updates"*).
* **Focus on WHAT, not HOW**: Do not mention specific API names, methods, or feature names in the use case description (avoid phrases like `...by doing...` or `...using the View Transitions API...`).
* **Bridge the Knowledge Gap**: Target the developer's desired outcome (e.g., "sticky header that shrinks on scroll") so agents discover the best modern feature (e.g., scroll-driven animations).
* **Scope**: Aim for 2–5 distinct use cases per feature. Drop niche visual tricks or obscure edge cases with low developer impact.
* **Avoid Monoliths**: Break discipline-level topics (CSS, JS, Performance) into modular subskills.

### Workflow:
1. Locate or create `guides/<category>/<use-case-slug>/` using existing repository taxonomies (`css`, `forms`, `performance`, `ui-behaviors`, `accessibility`, `ui-atoms`, `ui-components`, etc.).
2. Create a stub `guide.md` containing only the YAML frontmatter:
   ```yaml
   ---
   name: size-aware-styling
   description: Apply component styles conditionally based on the size of a parent container
   web-feature-ids:
     - container-queries
   ---
   ```
3. Open an issue or draft PR to align on the use case with the category's [Content Area Tech Lead (ATL)](./ATLS.md).

> **Peer Fast-Track**: Stage 1 alignment prevents wasted effort on poorly framed or duplicate use cases. Because **Peers** have demonstrated domain expertise, Peers may proceed directly to Stage 2 after creating the use case stub. Community contributors proposing new use cases should open an issue first to align with a Peer or ATL.

* **Normative Specification & Schemas**: See [`.agents/skills/project-use-cases/SKILL.md`](../.agents/skills/project-use-cases/SKILL.md).


## Stage 2: Authoring Guidance (Needs guidance)

In Stage 2, you author three core files in the guide directory:

| File | Purpose | Key Requirements | Specification |
|---|---|---|---|
| `guide.md` | Guidance read by AI coding agents via vector search (RAG). | Self-contained, concise, imperative directives (`MANDATORY:`, `DO`, `DO NOT`), explanatory code comments, Baseline fallback macros. **No external markdown links.** | [`.agents/skills/project-guides/SKILL.md`](../.agents/skills/project-guides/SKILL.md) |
| `demo.html` | Canonical working reference implementation. | Standalone HTML/CSS/JS file. Clean and warning-free in browser console. | [`.agents/skills/project-guides/SKILL.md`](../.agents/skills/project-guides/SKILL.md) |
| `expectations.md` | Natural-language criteria for verifying correct implementation. | Bulleted list of observable output requirements used downstream to generate automated graders. | [`.agents/skills/project-guides/SKILL.md`](../.agents/skills/project-guides/SKILL.md) |

### Core Directives for `guide.md`:
* **Self-Contained**: `guide.md` is the only file a real-world coding assistant reads. All required knowledge must be synthesized directly in the text and code snippets. **Never include external markdown links.**
* **Explanatory Code Comments**: Every code snippet must include inline comments explaining *why* specific properties, selectors, or options are chosen.
* **Baseline Fallback Macros**: Non-widely available features must include fallback strategies or progressive enhancement patterns using the `{{ FEATURE_FALLBACKS("feature-id") }}` macro.

* **Normative Specification & Rules**: See [`.agents/skills/project-guides/SKILL.md`](../.agents/skills/project-guides/SKILL.md).


## Self-Validation (Recommended Before Opening a PR)

Once you finish drafting `guide.md`, `demo.html`, and `expectations.md`, ask your AI coding assistant to run the **Guide Validation Skill**:

```text
Please run the project-guide-validation skill on my guide: guides/<category>/<use-case-slug>
```

This autonomously:
1. Starts a local server and tests your `demo.html` in a real browser session via DevTools MCP.
2. Checks for browser console warnings and layout errors.
3. Audits accessibility best practices against canonical standards (ARIA roles, keyboard navigation, focus management, reduced motion).
4. Verifies 1-to-1 alignment between `guide.md`, `demo.html`, and `expectations.md`.

* **Validation Protocol**: See [`.agents/skills/project-guide-validation/SKILL.md`](../.agents/skills/project-guide-validation/SKILL.md).


## Content Area Tech Leads (ATLs)

Each guidance category is stewarded by a Content Area Tech Lead (ATL). When opening an issue or PR, tag the category ATL listed in [`guides/atls.json`](./atls.json).

For details on ATL responsibilities and review criteria, see **[`guides/ATLS.md`](./ATLS.md)**.


## Submitting a Guidance Pull Request

When submitting a guidance PR:

1. **Guidance PR Checklist**:
   - [ ] Signed the [Google CLA](https://developers.google.com/open-source/cla/individual).
   - [ ] Verified `demo.html` is clean, standalone, and warning-free in browser DevTools.
   - [ ] Tagged the category ATL from [`guides/atls.json`](./atls.json).
   - [ ] (Recommended) Ran self-validation via the [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) skill.
2. **Review & Approval**: Guidance PRs are reviewed and approved by category Content ATLs or fellow Peers before merging. Stage 3 evaluation calibration will be handled downstream by maintainers and evaluation tooling.
