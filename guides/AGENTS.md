# Creating Modern Web Guidance

The goal of this project is to create Modern Web Guidance for web platform features. This guidance will be used by other AI agents to create web pages.

The development process for creating modern web guidance is split into two distinct checkpoints. This ensures that the core use cases are reviewed and approved before significant effort is invested in documentation and evaluation logic.

**Checkpoint 1: Use case identification**

The first priority is to identify the right set of use cases for a given feature.

- **Goal:** Define 2-5 action-oriented use cases that solve real-world developer problems.
- **Deliverable:** Create a Pull Request containing **only** the use cases metadata and `demo.html` files. This includes creating the directory structure and outlining the use case definitions.

Always refer to the [Use Cases](.agents/skills/project-use-cases/SKILL.md) skill for detailed instructions.

**Checkpoint 2: Implementation and evaluation**

Once the use cases are approved, the second stage is to complete the documentation and validate them through the evals pipeline.

- **Goal:** Write the full content for the guides, define expectations, and generate the evaluation harness via `gd dev`.
- **Deliverable:** A follow-up Pull Request with the complete `guide.md`, `expectations.md`, and `demo.html` for each use case, plus the auto-generated evaluation files (`grader.ts`, `negative-demo.html`, `task.md`, etc.).

Always refer to the [Guides](.agents/skills/project-guides/SKILL.md) and [Evaluations](.agents/skills/project-evals/SKILL.md) skills for detailed instructions.

When writing content, note that it is intended to be read by *other* coding agents. In particular, `guide.md` will be read by general web developers' coding agents to learn how to use the features. Other files like `demo.html` and `expectations.md` will be used by coding agents within this project to validate that the guidance is correct. Therefore, your writing must be highly structured, deterministic, and command-oriented.
