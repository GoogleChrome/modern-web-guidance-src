---
name: project-guides
description: Best practices for authoring guidance. Use this skill any time you're writing or reviewing `guide.md` files.
---

# Stage 2: Authoring guidance for a use case (Needs guidance)

This is the second of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case (you are here)
3. Stage 3: Evaluating guidance for a use case

## Research

Before writing a guide, check for a research file at `guides/.research/<web-feature-id>.md`. If it exists, it contains a detailed summary of the feature — use cases, technical constraints, performance implications, browser compatibility, and real-world implementation examples — generated during Stage 1. Use it to inform the guide content rather than relying solely on general knowledge.

**MANDATORY RULES FOR WRITING `guide.md`:**

### 1. YAML Frontmatter Schema
`guide.md` must start with this YAML frontmatter structure (added in **Stage 1**):

```yaml
---
name: slugified-use-case-name
description: <do thing> <with feature> (e.g., "Create dynamic color systems using modern color syntax")
web-feature-ids:
  - webstatus-feature-id
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Feature
---
```
* **web-features**: Must be a list of accurate IDs found via webstatus.dev. Include ALL features referenced in the guide body, not just the primary one. If an ID is missing, inform the USER.
* **sources**: Must be a list of ALL reference URLs used to synthesize the document. Add any URL referenced in the guide's research or inline links here.

### 2. Tone and Formatting
* **MANDATORY:** Use strict imperative directives. Start instructions with `MANDATORY:`, `DO`, and `DO NOT`. Coding agents respond best to rigid constraints.
* **Focus:** Keep it abstract but short. No fluff. No conversational text. Include a brief overview of the use case and explanation of why the solution outlined in the guide is the recommended approach.
* **Self-Contained:** DO NOT require the reading agent to click external links to understand the code. All required knowledge to use the feature MUST be fully synthesized into the markdown body.

### 3. Code Snippets
* Include short, heavily commented code snippets.
* Put directives directly in code comments so they are impossible to miss (e.g., `<!-- Always use the required attribute -->`).
* Code comments MUST explain **WHY** a value or approach is chosen, not just what the code does. An agent that copies magic values without understanding them will apply them incorrectly. If a value is context-dependent (e.g., a threshold that should vary by use case), say so explicitly.

### 4. Implementation Steps
* Only mark steps as `MANDATORY` if they are truly required for the feature to function. Optional steps (e.g., adding scroll snap, adding an event listener for progressive enhancement) must be labeled as optional. Incorrect use of `MANDATORY` causes agents to implement unnecessary complexity.
* The guide is the agent's **only** source of truth. DO NOT reference `demo.html` or any other file — agents won't have access to them. Everything the agent needs to implement the use case must be in `guide.md`.
* Use **Baseline** terminology to describe browser support (e.g., "Baseline Widely Available", "Baseline Limited Availability"). DO NOT say "only supported in Chrome" or reference a specific browser version.
* When recommending feature detection, prefer checking `HTMLElement.prototype` (e.g., `'onbeforematch' in HTMLElement.prototype`) over `window` or `document`, as it is more reliable.

### 5. Fallback Strategies
* If the feature is not "Baseline Widely Available", you **MUST** include a `### Fallback strategies` section.
* **DO** use the `{{ BASELINE_STATUS("feature-id") }}` macro to display the current support status as the first, standalone line in the section.
* **OPTIONAL** provide an optional second argument for specific BCD keys: `{{ BASELINE_STATUS("feature-id", "bcd.key") }}`. This is useful when a critical sub-feature's status differs from the overall feature status.
* Show explicit code for feature detection (e.g., `CSS.supports()`, `if ('feature' in window)`) or graceful degradation techniques.
* When recommending a polyfill, ALWAYS show how to conditionally load it only for browsers that need it. Do not instruct agents to unconditionally load polyfills.
* **DO NOT** recommend polyfills from polyfill.io.

## Authoring `expectations.md` and  `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").
* **`demo.html`**: The `demo.html` file should be a clean example of a correct implementation of the use case. If possible, it should be self-contained with inline scripts and styles. 
