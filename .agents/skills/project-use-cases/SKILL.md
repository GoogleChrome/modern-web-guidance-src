---
name: project-use-cases
description: Best practices for creating use cases. Use this skill any time you're writing or reviewing a use case under the guides/ directory.
---

# Mapping features to use cases

The primary goal of this stage is to translate a technical web platform feature into a carefully selected set of its most common and important use cases. 

## Research and discovery

To help you define use cases, perform deep research to supplement your pre-existing knowledge. The goal is to move beyond "what the feature is" to "how should it be used in the wild." The following tools can help you:

* **Gemini Deep Research**: Use Deep Research to discover sources and real-world implementations you might not be aware of. Focus on finding complex edge cases, performance implications, and emerging best practices. Deep Research is particularly effective at surfacing GitHub discussions, W3C specifications, and developer blog posts that highlight non-obvious constraints.
* **NotebookLM**: Once you have a collection of sources, feed them all into NotebookLM. Use NotebookLM to distill these sources into a set of concrete, actionable use cases. NotebookLM helps identify the "core tasks" that reflect common developer needs, ensuring the guidance you build is grounded in practical application rather than just theoretical capability.

## Identifying action-oriented tasks

A "use case" in this project is not a description of a feature; it's how the feature would be used in the wild.

* **Action-oriented thinking**: Frame every use case as a task. Instead of "Scroll-driven animations support horizontal scrolling," use "Synchronize an animation's progress with the horizontal scroll distance of a container."
* **Bridge the knowledge gap**: Assume the developer knows *what* they want to build (e.g., "I need a sticky header that shrinks on scroll") but might not know *which* modern web feature is the best solution (e.g., scroll-driven animations). Your use cases should facilitate this discovery by focusing on the desired outcome.
* **Targeted scope**: Aim for 2-5 distinct use cases per feature. Each should represent a unique implementation pattern or a significant variation in how the feature is applied.
    * **Example (fetch-priority)**: Instead of one large "Performance optimization" guide, break it down into "Optimize image priority," "Optimize script priority," and "Deprioritize background fetches." Each has unique implementation details and developer intents.
    * **Example (fetchlater)**: Separate "Reliably track full-session analytics" from "Batch and debounce real-time events." While both use `fetchLater`, they address different developer goals.

## Minimizing overlap

This guidance is served through a RAG (Retrieval-Augmented Generation) search system. If multiple guides have significant overlap, coding agents may struggle to select the most relevant one, leading to confusing or contradictory advice.

* **Check existing guides**: Before creating a new use case, review existing guides in the same discipline.
* **Search by web-feature-id**: Each guide lists the web features it relies on in the `web-feature-ids` metadata field. Search for the ID of the feature you are writing about in existing guides and open PRs to see how it's being used.
* **Merge or differentiate**: If your proposed use case is substantially similar to an existing one, do not create a duplicate. Instead, consider if the existing guide should be updated to include your new scenario as a variation or a specific directive. 
* **Distinct value proposition**: Every new guide must offer a distinct solution to a distinct problem. For example, if both `fetch` and `fetch-priority` are involved in "Deprioritizing background fetches," the guide should justify why this combination is the optimal pattern for that specific problem.

## Implementation and scaffolding

Follow a phased approach when building use cases to ensure they are properly scoped and reviewed.

1.  **Phased PR Approach**: 
    * **Phase 1 (Discovery)**: Create a Pull Request containing only the directory structure and `guide.md` stubs (containing only the frontmatter including `sources` and `web-feature-ids`). This allows for early feedback on the selection and naming of the use cases.
    * **Phase 2 (Implementation)**: Once the use cases are approved, create a subsequent PR with the full technical guidance and validation files:
        * `guide.md`: Complete documentation with best practices, browser support, and code examples.
        * `expectations.md`: Clear, atomic criteria for a successful implementation.
        * `prompts.md`: The actionable task(s) an agent will use during evaluation.
        * `demo.html`: The reference "gold" implementation.
        * `negative-demo.html`: An implementation that deliberately fails the expectations, used to calibrate the grader.
        * `grader.ts`: The automated validation script.
2.  **Select the discipline**: Determine which category the use case falls under: `performance`, `accessibility`, `security`, `user-experience`, etc.
3.  **Create the directory**: Create a sub-directory under `guides/<discipline>/`. The directory name should be the slugified version of the action-oriented use case (e.g., `guides/performance/prioritize-lcp-image/`).
4.  **Generate files**: In Phase 1, start with:
    * `guide.md` (frontmatter), `expectations.md` (summary of criteria), and `demo.html` (stub).

* **DO** search primary resources (MDN, web.dev, etc.) to validate every claim.
* **DO NOT** create a use case for a scenario where the feature is poorly suited or carries significant risks without robust fallbacks.
* **Skip to Step 2** if the user has already provided a specific, valid use-case for you to author.