# Creating Modern Web Guidance

The goal of this project is to create Modern Web Guidance for web platform features. This guidance will be used by other AI agents to create web pages.

For repository architecture, `gd` CLI commands, and coding conventions, read [docs/CONTEXT.md](docs/CONTEXT.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the task-specific skills in `.agents/skills/` (especially [project-coding-standards](.agents/skills/project-coding-standards/SKILL.md), [project-guide-validation](.agents/skills/project-guide-validation/SKILL.md), and [coherence-auditor](.agents/skills/coherence-auditor/SKILL.md)).

The development process for creating modern web guidance is split into two distinct checkpoints. This ensures that the core use cases are reviewed and approved before significant effort is invested in documentation and evaluation logic.

**Checkpoint 1: Use case identification**

The first priority is to identify the right set of use cases for a given feature.

- **Goal:** Define 2-5 action-oriented use cases that solve real-world developer problems.
- **Deliverable:** Create a Pull Request containing **only** the `guide.md` frontmatter stubs. This includes creating the directory structure and outlining the use case definitions.

Always refer to the [Use Cases](.agents/skills/project-use-cases/SKILL.md) skill for detailed instructions.

**Checkpoint 2: Authoring guidance**

Once the use cases are approved, the second stage is to complete the documentation, expectations, and reference demo.

- **Goal:** Write the full content for the guides, define expectations, and build the reference demo.
- **Deliverable:** A follow-up Pull Request with the complete `guide.md`, `expectations.md`, and `demo.html` for each use case.

Always refer to the [Guides](.agents/skills/project-guides/SKILL.md) skill for detailed instructions.

When writing content, note that it is intended to be read by *other* coding agents. In particular, `guide.md` will be read by general web developers' coding agents to learn how to use the features. Other files like `demo.html` and `expectations.md` will be used by coding agents within this project to validate that the guidance is correct. Therefore, your writing must be highly structured, deterministic, and command-oriented.

**Discipline guides**

If you add a discipline guide, you MUST add its slug to `DISCIPLINE_GUIDES` in `src/core/guide-validation.ts`.

**PR review etiquette**

- Prefix agent-posted GitHub comments and replies with `✨` when the human was involved in the discussion or decision behind the comment, or `🤖` when posted autonomously by the agent without specific human input.
- When accepting a ` ```suggestion ` block verbatim, commit it via the GitHub UI/API or in a commit (`Apply suggestions from code review`) with `Co-authored-by: Name <email>` trailers.
- Reply to every addressed review thread (citing the commit SHA or explaining how a suggestion was adapted).
