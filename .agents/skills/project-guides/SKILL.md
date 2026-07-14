---
name: project-guides
description: Best practices for authoring guidance. Use this skill any time you're writing or reviewing `guide.md` files.
---

# Stage 2: Authoring guidance for a use case (Needs guidance)

This is the second of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case (you are here)
3. Stage 3: Evaluating guidance for a use case

## What a real-world coding agent sees

When a developer asks an AI coding assistant to implement something, the assistant retrieves the relevant `guide.md` via a RAG (vector search) system. **`guide.md` is the only project file a real-world coding agent ever sees.** Everything else in a use case directory is eval infrastructure:

| File | Purpose | Seen by real-world agents? |
|---|---|---|
| `guide.md` | Guidance for implementing the use case | ✅ Yes — this is the only file |
| `demo.html` | Reference implementation used to calibrate the grader | ❌ No |
| `negative-demo.html` | Incorrect implementation used to verify the grader catches failures | ❌ No |
| `expectations.md` | Source used to generate `grader.ts` | ❌ No |
| `grader.ts` | Playwright tests run against the eval agent's output | ❌ No |
| `tasks/task.md` | Simulated developer prompts and base application name fed to the eval agent by the harness | ❌ No |

**Implication for `demo.html`:** Because real agents never see `demo.html`, it does not need to be a polished, production-ready example. It just needs to be a correct, minimal implementation that the grader can pass against. Do not over-engineer it.

**Implication for `guide.md`:** Because `guide.md` is the agent's only source of truth, it must be entirely self-contained. Do not rely on agents reading `demo.html`, `expectations.md`, or any external link to understand how to implement the use case.

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

* **Formatting Directives:** Use strict imperative directives (`MANDATORY:`, `DO`, `DO NOT`) only when emphasis is strictly needed (e.g., for critical constraints, security, or common pitfalls). Do not overuse them for every single instruction. Coding agents respond best to rigid constraints when they are selectively applied.
* **Focus:** Keep the guidance focused on the specific use case and short. No fluff. No conversational text. Include a brief overview of the use case and explanation of why the solution outlined in the guide is the recommended approach.
* **Self-Contained:** DO NOT include any external links in the markdown body (`[link text](url)`). All required knowledge to use the feature MUST be fully synthesized into the markdown body. Agents must not be slowed down or require additional resources to implement the guidance.

### 3. Code Snippets

* Include short, heavily commented code snippets.
* Put directives directly in code comments so they are impossible to miss (e.g., `<!-- Always use the required attribute -->`).
* Code comments MUST explain why a value or approach is chosen, not just what the code does. An agent that copies magic values without understanding them will apply them incorrectly. If a value is context-dependent (e.g., a threshold that should vary by use case), say so explicitly.
* **Modern Standards**: Exclusively use ES modules (`import`/`export`) in JavaScript code examples; avoid CommonJS (`require`).
* **Clarifying Arbitrary Values**: Explicitly identify placeholder values (like `2rem` or `50ms`) as example-only in comments to avoid them being mistaken for strict technical constraints.

### 4. Implementation Steps

* The implementation steps should assume any web feature can be used. Choose the best feature for the job, regardless of browser support.
* **DO NOT** suggest modern features just because they are modern. If a modern feature has no distinct user-visible advantage over a legacy feature for the given use case — but will require a more complex fallback implementation — use the legacy feature.
* **DO NOT** include cross-browser fallbacks in the implementation section. Those should only be mentioned in the fallback section.
* Only mark steps as `MANDATORY` if they are truly required for the feature to function. Optional steps (e.g., adding scroll snap, adding an event listener for progressive enhancement) must be labeled as optional. Incorrect use of `MANDATORY` causes agents to implement unnecessary complexity.
* The guide is the agent's **only** source of truth. DO NOT reference `demo.html` or any other file — agents won't have access to them. Everything the agent needs to implement the use case must be in `guide.md`.

### 5. Fallback Strategies

If the primary implementation uses features that are not Baseline Widely Available, you **MUST** include a fallback recommendation in this section.

* **Framing:** Frame fallback necessity in terms of Baseline target (e.g., "If your Baseline target does not support X, use...").
* **Assessment:** Start with a broad assessment of the fallback's robustness. Recommend the modern approach if the fallback is robust; highlight complexity/caveats and suggest alternatives (like userland solutions) if it is not.
* **Experience:** **MANDATORY:** Explicitly describe the fallback experience (progressive enhancement vs. feature detection/graceful degradation).
* **Feature Detection:** Checks should be tightly scoped to the interface rather than the instance (e.g. use `Object.hasOwn(HTMLElement.prototype, 'onbeforematch')` over `'onbeforematch' in winow`)
* **Fallback Options (in order of preference):**
    1.  **Custom Code:** Short, reliable reimplementation (**<50 lines**) using widely available features.
    2.  **Polyfill:** A robust, performant polyfill (see guidelines below).
    3.  **Abstraction:** A well-tested userland library.
    4.  **Graceful Degradation:** Baseline Newly Available features that degrade gracefully.
    5.  **Progressive Enhancement:** Frame as progressive enhancement only if no robust fallback exists.
* **Faithfulness:** Fallbacks MUST be faithful to the use case. If the primary recommendation gracefully degrades but ultimately doesn't accomplish the core use case, suggest a different fallback if one is available. Graceful degradation **IS** acceptable for features that enhance, but are otherwise not core to the use case.

#### Baseline Status Macros
* **MANDATORY:** Include `{{ BASELINE_STATUS("feature-id") }}` for *every* non-widely available feature used.
* **Placement:** Use separate subsections with their own macros if multiple features are used. **DO NOT** use macros outside the fallback section.
* **BCD Keys:** **OPTIONAL:** Use `{{ BASELINE_STATUS("feature-id", "bcd.key") }}` if a sub-feature's status differs.

#### Polyfill Guidelines
* **Conditional Loading:** **MANDATORY:** ALWAYS conditionally load polyfills only when native support is missing. Prefer build-integrated conditional loading (code splitting) over CDNs.
* **Performance:** **DO NOT** recommend polyfills with significant performance tradeoffs, or those requiring fetching/parsing CSS. Prefer abstractions/userland solutions instead.
* **Prohibited CDNs:** **DO NOT** recommend polyfills from polyfill.io.

## Authoring `expectations.md` and  `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").
* **`demo.html`**: The `demo.html` file should be a clean example of a correct implementation of the use case. If possible, it should be self-contained with inline scripts and styles.
* **Warning-Free Demos**: Documentation and demos must adhere to all browser console recommendations, including non-fatal warnings, to ensure clean evaluation runs.
