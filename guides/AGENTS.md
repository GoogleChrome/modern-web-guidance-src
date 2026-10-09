# Creating Modern Web Guidance

This directory contains Modern Web Guidance for web platform features. Because `guide.md` is the **only** file retrieved and read by external coding agents at runtime (`demo.html` and `expectations.md` are used within this repo for validation and evaluation), all guidance must be self-contained, deterministic, and command-oriented.

When creating, updating, or validating guidance in `guides/`, follow the contributor workflow in **[`guides/CONTRIBUTING.md`](./CONTRIBUTING.md)** and use the authoritative project skills:

- **Stage 1 — Identifying Use Cases**: [`project-use-cases`](../.agents/skills/project-use-cases/SKILL.md) (create the `guide.md` frontmatter stub; align with the category [Content ATL](../docs/ATLS.md) or fast-track if a [Peer](../GOVERNANCE.md#peers)).
- **Stage 2 — Authoring Guidance**: [`project-guides`](../.agents/skills/project-guides/SKILL.md) (author `guide.md`, `demo.html`, and `expectations.md`).
- **Stage 2 — Self-Validation**: [`project-guide-validation`](../.agents/skills/project-guide-validation/SKILL.md) (test `demo.html` in DevTools MCP and verify accessibility and expectation alignment before opening a PR).
- **Discipline Guides**: [`project-discipline-guides`](../.agents/skills/project-discipline-guides/SKILL.md) (category root guides and conceptual hubs registered in `DISCIPLINE_GUIDES` in `src/core/guide-validation.ts`).
- **Stage 3 — Evaluations & Graders**: Handled downstream via `gd dev` (see [`src/harness/README.md`](../src/harness/README.md) and [`project-evals`](../.agents/skills/project-evals/SKILL.md)).
