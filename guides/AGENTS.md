# Creating Modern Web Guidance

The goal of this project is to create Modern Web Guidance for web platform features. This guidance will be used by other AI agents to create web pages.

The content contribution process for creating modern web guidance consists of two authoring stages (see [`guides/CONTRIBUTING.md`](./CONTRIBUTING.md) and [`GOVERNANCE.md`](../GOVERNANCE.md)). This ensures that core use cases are aligned before effort is invested in full guide authoring, while keeping content authors shielded from downstream evaluation infrastructure.

**Stage 1: Identifying use cases**

The first priority is to identify the right set of use cases for a given feature.

- **Goal:** Define 2–5 action-oriented use cases that solve real-world developer problems.
- **Deliverable:** Create `guides/<category>/<use-case-slug>/guide.md` containing **only** the YAML frontmatter stub (`name`, `description`, `web-feature-ids`) and align with the category's [Content Area Tech Lead (ATL)](./ATLS.md) via an issue or draft PR. *(Onboarded [Peers](../GOVERNANCE.md#peers) may fast-track and proceed directly to Stage 2).*

Always refer to the [Use Cases](../.agents/skills/project-use-cases/SKILL.md) skill for detailed instructions.

**Stage 2: Authoring guidance (where content contribution stops)**

Once use cases are aligned, complete the guidance, reference demo, and testable expectations.

- **Goal:** Write the full content for `guide.md`, build a clean standalone `demo.html`, define observable assertions in `expectations.md`, and self-validate using the [Guide Validation](../.agents/skills/project-guide-validation/SKILL.md) skill.
- **Deliverable:** A Pull Request containing the completed `guide.md`, `demo.html`, and `expectations.md` for review and approval by the category Content ATL.

Always refer to the [Guides](../.agents/skills/project-guides/SKILL.md) and [Guide Validation](../.agents/skills/project-guide-validation/SKILL.md) skills for detailed instructions.

> **Stage 3 (Evaluations & Graders):** Target evaluation suites (`targets/<base_app>/grader.ts`, solution patches, `task.md`) and calibration runs (`gd dev`) are handled downstream by the engineering pipeline and are not required in Stage 2 content PRs.

When writing content, note that it is intended to be read by *other* coding agents. In particular, `guide.md` is the only file read by general web developers' coding agents to learn how to use the features. Other files like `demo.html` and `expectations.md` are used within this project to validate and evaluate the guidance. Therefore, your writing must be highly structured, deterministic, and command-oriented.

**Discipline guides**

A discipline guide is either a category root guide at `guides/<category>/<category>/guide.md` (such as `guides/css/css/guide.md`) or a named guide registered in `DISCIPLINE_GUIDES` in `lib/guide-validation.ts` (such as `guides/wasm/cpp-on-the-web/guide.md`). Refer to the [Discipline Guides](../.agents/skills/project-discipline-guides/SKILL.md) skill when creating or updating one.
