# Contributing Guidance

This guide covers the workflow for **Peers and content contributors** authoring or updating web platform guidance in `guides/`.

For authoring permissions and contributor roles, see **[`GOVERNANCE.md`](../GOVERNANCE.md)** and **[`docs/ATLS.md`](../docs/ATLS.md)**. Content authors focus exclusively on technical accuracy, reference demos, and testable expectations—Stage 3 evaluation suites (`grader.ts`), solution patches, and calibration runs are handled downstream via [`src/harness/README.md`](../src/harness/README.md).


## Guidance Scope

* **Vendor-Agnostic Core Guidance**: Core guides focus on web platform features tracked in (or pending inclusion in) [`web-features`](https://github.com/web-platform-dx/web-features) and [Browser Compat Data (BCD)](https://github.com/mdn/browser-compat-data). Browser-specific guidance (e.g., extension store or proprietary APIs) is never part of the core guidance and may only ship in separate, opt-in skill packs subject to the same review rules.
* **Browser-Specific Implementation Details**: Guides must not reference browser-specific implementation details (e.g., a browser's bundled on-device model) without stating that they are browser-specific and may change.
* **Baseline Target & Fallbacks**: Guidance targets **Baseline Widely available** web features, with mandatory fallback strategies or progressive enhancement patterns for Limited availability or Newly available features. When no reasonable alternative exists, the documented fallback may be to not use the feature.


## Feature Stability

Whether a feature may appear in default guidance depends on how far it has shipped:

| Feature maturity | Treatment in guidance |
|---|---|
| Not yet in an Origin Trial or any stable release | Out of scope. |
| Origin Trial | Tracked in [`features/origin-trials.json`](../features/origin-trials.json) and gated behind the Origin Trial opt-in in `.mwgrc`. |
| Shipped in stable in only one browser engine | Treated as `volatile` for 3 months after shipping and gated behind the `volatile` opt-in in `.mwgrc`. |
| Shipped in two or more engines, or graduated from `volatile` | Included in default guidance. |

* **Graduation**: A `volatile` feature moves to default guidance automatically at the end of the 3-month window unless an objection is upheld. A feature kept `volatile` beyond the window graduates once the concern is resolved (e.g., a second engine ships it and the design settles, or the Content ATL scopes guidance to a stable subset).
* **Objections and petitions**: Any Peer, Content ATL, or Owner may object to a feature graduating, petition to shorten or extend its window, or re-label a feature that changes more than expected. See [Volatility Objections](#volatility-objections).

### Volatility Objections

To raise an objection or petition, apply the `volatility` label to the relevant issue or pull request (or open a new issue with that label) and state the reasoning. Per [`docs/ATLS.md`](../docs/ATLS.md#review--triage-workflows), the assigned Content ATL (or an Owner, if the area has no ATL) triages it within two weeks and recommends an outcome, which the Owners decide through the [governance decision-making process](../GOVERNANCE.md#decision-making).


## The Two-Stage Content Lifecycle

Content contributions progress through two stages, each governed by a normative Agent Skill that both human authors and AI coding assistants follow:

### Stage 1: Identifying Use Cases (`Needs use cases`)

Translate a web platform feature into 2–5 distinct, action-oriented developer tasks (focusing on *what* the user is trying to accomplish rather than *how* the API works).

1. Create `guides/<category>/<use-case-slug>/guide.md` containing only the YAML frontmatter stub (`name`, `description`, `web-feature-ids`).
2. Validate structure with `pnpm test`.
3. Open a [new-use-case issue](../.github/ISSUE_TEMPLATE/new-use-case.yml) or a draft/stub PR to align with the category's [Content Area Tech Lead (ATL)](../docs/ATLS.md) listed in [`.github/atls.json`](../.github/atls.json). *(Onboarded [Peers](../GOVERNANCE.md#peers) may fast-track directly to Stage 2).*

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
