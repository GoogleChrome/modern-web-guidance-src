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

* If the primary implementation relies on features that are not Baseline Widely Available, you **MUST** include a fallback recommendation. This recommendation can be any of the following (in order of preference):
    * A short bit of code (<50 lines) that reliably reimplements the function of the modern feature (specific to the given use case) using widely available features.
    * A robust and performant polyfill for the modern feature (if one exists) that is conditionally loaded **IFF** the native feature is not supported in the browser.
    * A well-tested userland abstraction that implements the use case across browsers.
    * If the use case **CAN** be achieved in a simple and robust way using Baseline Newly Available features that degrade gracefully when unsupported, this can be presented as an option to consider, as an alternative _or in addition_ to one of the above.
    * If none of the above are possible, or if the use case cannot be implemented without using non-widely-available features, then clearly state this fact and show how to conditionally load the feature(s) as a progressive enhancement only.
* The fallback recommendations **MUST** be faithful to the use case. If the primary recommendation gracefully degrades, but ultimately doesn't accomplish the use case, suggest a different fallback if one is available. Graceful degradation **IS** acceptable for features that enhance, but are otherwise not core to the use case.
* The fallback section **MUST** start with a broad recommendation and assessment of the overall fallback approach, based on its robustness and effectiveness to achieve the given use case.
    * If the features recommended in the primary implementation offer meaningful user value, and if the fallback is robust and effective, provide a strong recommendation for this approach, despite the use of non-widely available features.
    * If the fallback is complex and has numerous caveats and gotchas, make that clear and consider suggesting alternatives if they exist (e.g., well-tested userland solutions).
* The fallback section should frame fallback necessity in terms of Baseline target, e.g. "If your Baseline target does not support X, use the following fallback..."
* **MANDATORY**: You MUST explicitly describe the fallback experience for unsupported browsers. Explain if the feature is a progressive enhancement (and what the base experience looks like), or show explicit code for feature detection (e.g., `CSS.supports()`, `if ('feature' in window)`) and graceful degradation techniques.
* When recommending feature detection, prefer checking `HTMLElement.prototype` (e.g., `'onbeforematch' in HTMLElement.prototype`) over `window` or `document`, as it is more reliable.

#### Baseline status best practices

* **MANDATORY**: the fallback section must include a `{{ BASELINE_STATUS("feature-id") }}` macro for every non-widely available feature included in the primary implementation section.
* If multiple non-widely available features are used, create a separate subsection for each feature fallback with its own `{{ BASELINE_STATUS("feature-id") }}` macro.
* **DO NOT** use the `{{ BASELINE_STATUS("feature-id") }}` outside of the fallback section.
* **OPTIONAL** provide an optional second argument for specific BCD keys: `{{ BASELINE_STATUS("feature-id", "bcd.key") }}`. This is useful when a critical sub-feature's status differs from the overall feature status.

#### Polyfill considerations and best practices

* When recommending a polyfill, ALWAYS show how to conditionally load it only for browsers that need it. Do not instruct agents to unconditionally load polyfills (even small ones).
* Prefer including polyfills in your build (so they can be combined into a polyfill chunk) rather than loading them from a CDN, but **ALWAYS** do so in a way that supports code splitting and conditional loading.
* **DO NOT** recommend polyfills that incur significant performance tradeoffs. Prefer abstraction and userland solutions in these cases, if available.
* **DO NOT** recommend polyfills that require fetching and parsing CSS in order to function.
* **DO NOT** recommend loading polyfills from polyfill.io.

## Authoring `expectations.md` and  `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").
* **`demo.html`**: The `demo.html` file should be a clean example of a correct implementation of the use case. If possible, it should be self-contained with inline scripts and styles.
* **Warning-Free Demos**: Documentation and demos must adhere to all browser console recommendations, including non-fatal warnings, to ensure clean evaluation runs.
