# Contributing Guidance

This guide covers the workflow for **Peers and content contributors** authoring or updating web platform guidance in `guides/`.

For authoring permissions and contributor roles, see **[`GOVERNANCE.md`](../GOVERNANCE.md)** and **[`docs/ATLS.md`](../docs/ATLS.md)**. Content authors focus exclusively on technical accuracy, reference demos, and testable expectations—Stage 3 evaluation suites (`grader.ts`), solution patches, and calibration runs are handled downstream via [`src/harness/README.md`](../src/harness/README.md).


## Guidance Scope

* **Vendor-Agnostic**: Core guides focus on standard web platform APIs aligned with [`web-features`](https://github.com/web-platform-dx/web-features) and [Browser Compat Data (BCD)](https://github.com/mdn/browser-compat-data). Origin trial features are excluded due to API volatility.
* **Baseline Target & Fallbacks**: Guidance targets **Baseline Widely available** web features, with mandatory fallback strategies or progressive enhancement patterns for newly or limitedly available features.


## The Two-Stage Content Lifecycle

Content contributions progress through two stages, each governed by a normative Agent Skill that both human authors and AI coding assistants follow:

### Stage 1: Identifying Use Cases (`Needs use cases`)

Translate a web platform feature into 2–5 distinct, action-oriented developer tasks (focusing on *what* the user is trying to accomplish rather than *how* the API works).

1. Create `guides/<category>/<use-case-slug>/guide.md` containing only the YAML frontmatter stub (`name`, `description`, `web-feature-ids`).
2. Validate structure with `pnpm test` (or `gd audit`).
3. Open an issue or draft PR to align with the category's [Content Area Tech Lead (ATL)](../docs/ATLS.md) listed in [`.github/atls.json`](../.github/atls.json). *(Onboarded [Peers](../GOVERNANCE.md#peers) may fast-track directly to Stage 2).*

* **Authoritative Specification**: **[`.agents/skills/project-use-cases/SKILL.md`](../.agents/skills/project-use-cases/SKILL.md)** (and **[`project-discipline-guides`](../.agents/skills/project-discipline-guides/SKILL.md)** for category hub guides).

### Stage 2: Authoring Guidance (`Needs guidance`)

Once the use case is aligned, author the three core files in `guides/<category>/<use-case-slug>/`:

| File | Purpose |
|---|---|
| `guide.md` | Self-contained guidance retrieved by AI coding agents via RAG (no external links, commented snippets explaining *why*, Baseline fallback macros). |
| `demo.html` | Standalone, console-warning-free reference implementation of the use case. |
| `expectations.md` | Bulleted list of observable, testable requirements used downstream to generate automated graders. |

* **Authoritative Specification**: **[`.agents/skills/project-guides/SKILL.md`](../.agents/skills/project-guides/SKILL.md)**


## Self-Validation (Before Opening a PR)

After drafting `guide.md`, `demo.html`, and `expectations.md`, ask your coding agent to run the **[`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md)** skill:

```text
Please run the project-guide-validation skill on my guide: guides/<category>/<use-case-slug>
```

This tests `demo.html` in a real browser session via DevTools MCP, checks accessibility alignment against [`guides/accessibility/accessibility/guide.md`](./accessibility/accessibility/guide.md), and verifies 1-to-1 traceability across `guide.md`, `demo.html`, and `expectations.md`.


## Guidance PR Checklist

- [ ] Signed the [Google CLA](https://developers.google.com/open-source/cla/individual).
- [ ] Followed [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md) and [`project-guides`](../.agents/skills/project-guides/SKILL.md).
- [ ] Ran self-validation via [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) and verified `pnpm test` passes.
- [ ] Tagged the assigned category ATL from [`.github/atls.json`](../.github/atls.json) for review and approval.
