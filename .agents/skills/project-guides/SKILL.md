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
* **Focus:** Keep it abstract but short. No fluff. No conversational text. Include a brief overview of the use case and explanation of why the solution outlined in the guide is the recommended approach.
* **Self-Contained:** DO NOT include any external links in the markdown body (`[link text](url)`). All required knowledge to use the feature MUST be fully synthesized into the markdown body. Agents must not be slowed down or require additional resources to implement the guidance.

### 3. Code Snippets
* Include short, heavily commented code snippets.
* Put directives directly in code comments so they are impossible to miss (e.g., `<!-- Always use the required attribute -->`).
* Code comments MUST explain why a value or approach is chosen, not just what the code does. An agent that copies magic values without understanding them will apply them incorrectly. If a value is context-dependent (e.g., a threshold that should vary by use case), say so explicitly.

### 4. Implementation Steps
* Only mark steps as `MANDATORY` if they are truly required for the feature to function. Optional steps (e.g., adding scroll snap, adding an event listener for progressive enhancement) must be labeled as optional. Incorrect use of `MANDATORY` causes agents to implement unnecessary complexity.
* The guide is the agent's **only** source of truth. DO NOT reference `demo.html` or any other file — agents won't have access to them. Everything the agent needs to implement the use case must be in `guide.md`.

### 5. Fallback Strategies
* You **MUST** include a `### Fallback strategies` section regardless of Baseline status, as developers may have older baseline targets.
* **MANDATORY**: The `{{ BASELINE_STATUS("feature-id") }}` macro must *always* be placed as the first, standalone line inside the `### Fallback strategies` section. Do not place it at the top of the document.
* **OPTIONAL** provide an optional second argument for specific BCD keys: `{{ BASELINE_STATUS("feature-id", "bcd.key") }}`. This is useful when a critical sub-feature's status differs from the overall feature status.
* **MANDATORY**: You MUST explicitly describe the fallback experience for unsupported browsers. Explain if the feature is a progressive enhancement (and what the base experience looks like), or show explicit code for feature detection (e.g., `CSS.supports()`, `if ('feature' in window)`) and graceful degradation techniques.
* When recommending feature detection, prefer checking `HTMLElement.prototype` (e.g., `'onbeforematch' in HTMLElement.prototype`) over `window` or `document`, as it is more reliable.
* When recommending a polyfill, ALWAYS show how to conditionally load it only for browsers that need it. Do not instruct agents to unconditionally load polyfills.
* **DO NOT** recommend polyfills from polyfill.io.

## Authoring `expectations.md` and  `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").
* **`demo.html`**: The `demo.html` file should be a clean example of a correct implementation of the use case. If possible, it should be self-contained with inline scripts and styles. 
