---
name: project-guides
description: Best practices for authoring guidance. Use this skill any time you're writing or reviewing `guide.md` files.
---

# Stage 2: Authoring guidance for a use case

This is the second of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case (you are here)
3. Stage 3: Evaluating guidance for a use case

**MANDATORY RULES FOR WRITING `guide.md`:**

### 1. YAML Frontmatter Schema
You MUST start `guide.md` with EXACTLY this YAML frontmatter structure:

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
* **web-features**: Must be a list of accurate IDs found via webstatus.dev. If the ID is missing, inform the USER.
* **sources**: Must be a list of primary source URLs used to synthesize the document.

### 2. Tone and Formatting
* **MANDATORY:** Use strict imperative directives. Start instructions with `MANDATORY:`, `DO`, and `DO NOT`. Coding agents respond best to rigid constraints.
* **Focus:** Keep it abstract but short. No fluff. No conversational text. Include a brief overview of the feature and why it is useful for the use-case.
* **Self-Contained:** DO NOT require the reading agent to click external links to understand the code. All required knowledge to use the feature MUST be fully synthesized into the markdown body.

### 3. Code Snippets
* Include short, heavily commented code snippets.
* Put directives directly in code comments so they are impossible to miss (e.g., `<!-- DO: Always use the required attribute -->`).

### 4. Fallback Strategies
* If the feature is not "Baseline Widely Available", you **MUST** include a `### Fallback strategies` section.
* **DO** use the `{{ BASELINE_STATUS("feature-id") }}` macro to display the current support status.
* **OPTIONAL** provide an optional second argument for specific BCD keys: `{{ BASELINE_STATUS("feature-id", "bcd.key") }}`. This is useful when a critical sub-feature's status differs from the overall feature status.
* Show explicit code for feature detection (e.g., `CSS.supports()`, `if ('feature' in window)`) or graceful degradation techniques.

## Step 3: Authoring `expectations.md` and `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").