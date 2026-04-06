---
name: project-use-cases
description: Best practices for creating use cases for a given feature. This is the first step in creating a new guide. Use this skill any time you're writing or reviewing a use case under the guides/ directory.
---

# Stage 1: Identifying use cases for a feature (Needs use cases)

The primary goal of this stage is to translate a technical web platform feature into a carefully selected set of its most common and important use cases. This is the first of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature (you are here)
2. Stage 2: Authoring guidance for a use case
3. Stage 3: Evaluating guidance for a use case

## Research and discovery

Instead of relying on your (the agent's) general knowledge to come up with a proposed list of use cases yourself, use the `project-use-cases-research` skill to perform grounded research. This skill guides you through using your own tools and optional automated deep research to surface authoritative sources and real-world implementations.

### Using `project-use-cases-research`

Refer to the `project-use-cases-research` skill file for detailed instructions on how to:
1.  **Gather inputs** from GitHub issues or arguments.
2.  **Conduct standard research** using `search_web` and `read_url_content`.
3.  **Run optional automated deep research** using the `deep_research.js` script.

The process will result in:
1.  A research report saved to `guides/.research/<feature-id>.md`.
2.  Proposed use cases that follow the constraints described in this skill.
3.  Scaffolded `guide.md` and `demo.html` stubs.

## Identifying action-oriented tasks

A "use case" in this project is not a description of a feature; it's a task that the user is trying to implement, or a problem they're trying to solve. The feature is only relevant in the sense that it's part of the recommended solution for the use case.

* **Action-oriented thinking**: Frame every use case as a task, and make sure it starts with a verb. Instead of "Scroll-driven animations support horizontal scrolling," use something like "Synchronize an animation's progress with the horizontal scroll distance of a container."
* **Bridge the knowledge gap**: Assume the developer knows *what* they want to build (e.g., "I need a sticky header that shrinks on scroll") but might not know *which* modern web feature is the best solution (e.g., scroll-driven animations). Your use cases should facilitate this discovery by focusing on the desired outcome.
* **Don't get too specific**: The use case must be general enough to match a wide range of relevant user prompts. Try to be as general as possible, while still faithfully representing the use case. For example, instead of saying "Fade an image in/out..." say "Smoothly hide/show a component...".
* **Focus on the WHAT not the HOW**: Do not mention the solution in the use case description. For example, avoid phrases like "...by doing..." or "...through the use of...". Ideally, the use case description should remain constant, even if the recommended features or best practices for implementing it change over time.
* **Scope**: Aim for 2-5 distinct use cases per feature. Each use case should represent a distinct implementation pattern or a significant variation in how the feature is applied. IMPORTANT: Not every sub-feature or feature variation needs a use case.
* **Drop niche use cases**: If a use case is unlikely to match real developer prompts (e.g., very specific visual effects, obscure layout tricks), omit it. Prefer use cases that represent common, everyday developer needs.
* **Merge rather than split**: If two proposed use cases would result in guides that are 99% identical, combine them into one, more general use case. Duplicate guides bloat context windows and create confusing contradictions.

## Minimizing overlap

This guidance is ultimately served through a RAG (Retrieval-Augmented Generation) search system. If multiple guides have significant overlap, coding agents may struggle to select the most relevant one, leading to confusing or contradictory advice.

* **Check existing guides**: Before creating a new use case, review existing guides in the same discipline.
* **Search by web-feature-id**: Each guide lists the web features it relies on in the `web-feature-ids` metadata field. Search for the ID of the feature you're writing about in existing guides and open PRs to see how it's being used.
* **Merge or differentiate**: If your proposed use case is substantially similar to an existing one, do not create a duplicate. Instead, consider how the existing guide should be updated to include your new scenario as a variation or a specific directive.
* **Distinct value proposition**: Every new guide must offer a distinct solution to a distinct problem.

## Implementation and scaffolding

The following steps are REQUIRED for creating a new use case:

* **Step 1: Describe the use case**

  You MUST choose a short (max 1024 characters), action-oriented description of the problem the feature solves. The description must be a single sentence, start with a verb, and answer the question: "What is the user trying to DO?"
  
  For example, a use case of the `fetch-priority` feature is "Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests."

* **Step 2: Choose a category**

  Use cases MUST live under the [`guides/`](/guides) directory, organized into a single, high-level category such as [`performance`](/guides/performance) or [`accessibility`](/guides/accessibility). List the current subdirectories under `guides/` and choose the most appropriate one. If a use case doesn't fit into any of these categories, create a new one.

* **Step 3: Create the use case subdirectory**

  Create a subdirectory under `guides/<category>/` for your use case. The subdirectory name MUST be a short, slugified version of the action-oriented use case. For example, for the use case in Step 1, the subdirectory name is `deprioritize-background-fetches`.

  DO NOT prefix the slug with action verbs like `create-`, `build-`, or `add-`. Slugs are directory names scanned in lists—action verbs just add noise and make it harder to find what you're looking for.

* **Step 4: Create the `guide.md` stub**

  Create a `guide.md` file in the new subdirectory. For now, the guide should only contain metadata about the use case. The actual content of the guide will be filled in later after peer review.

  The required YAML frontmatter fields are:

  - **name**: Short, slugified name of the use case.
  - **description**: Action-oriented description of the use case.
  - **web-feature-ids**: List of web feature IDs that the use case relies on. These can be found in the `web-features` package or via webstatus.dev.
  - **sources**: List of primary source URLs used to synthesize the document. Do NOT guess these. The user should provide them.

  For example:

  ```yaml
  ---
  name: deprioritize-background-fetches
  description: Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests.
  web-feature-ids:
    - fetch-priority
    - fetch
  sources:
    - https://web.dev/articles/fetch-priority
  ---
  ```

* **Step 5: Create the `demo.html` file**

  Create a `demo.html` file in the new subdirectory. This file is **eval infrastructure** — it is used by `grader.ts` to verify that a correct implementation passes all tests. Real-world coding agents never see this file.

  Because it is not shown to agents, `demo.html` does not need to be a polished or production-ready example. It just needs to be a correct, minimal implementation of the use case. Keep it self-contained with inline scripts and styles. Use placeholder URLs for any subresources like images or videos.

  See [demo.html](examples/demo.html) for an example from the `deprioritize-background-fetches` use case.

* **Step 6: Validate the use case**

  Run `pnpm --filter guides test` to validate the use case.

* **Step 7: Get the use case approved**

  Submit the use case for review by creating a Pull Request containing only the files created in steps 1-6. This allows for early feedback on the selection and naming of the use cases.

After the use case is approved, you can proceed to writing the guidance and expectations. Additional guidance for these stages is provided by the `project-guides` and `project-evals` skills.