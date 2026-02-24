# Instructions for AI Agents: Creating Web Feature Guidance

The goal of this project is to create Modern Web Guidance for web platform features. This guidance will be used by other AI agents to create web pages.

This document provides explicit instructions for an AI agent (like Claude, Gemini, or Antigravity) to create and format Developer Guidance for web platform features. Your output (`guide.md`) will be read by *other* coding agents, demo.html will be used to validate the output of agentic tools is correct, and expectations.md will be used to drive the testing of the output of agentic tools. Therefore, your writing must be highly structured, deterministic, and command-oriented.

## 📚 Primary Resources for Feature Research
When researching a feature to write guidance, consult:
* [Chrome Developers](https://developer.chrome.com/) - Introductory articles that explain the feature and its benefits
* [MDN](https://developer.mozilla.org/en-US/) - Canonical and primary API reference
* [webstatus.dev](https://webstatus.dev/) (Crucial for extracting `web-feature` IDs)
* [web.dev](https://web.dev/) - Industry best-practice guideance
* [chromestatus.com](https://chromestatus.com/) - Feature implementation status in Chrome with links to specifications and other developer resources.

---

## Step 1: Identify and Scaffold Use Cases

1. **Determine Use Cases**: Identify 2-5 action-oriented use cases for the designated web feature.
   * *Example:* For scroll-driven animations, a use case is "Synchronize animation progress with the scroll distance of a container".
2. **Create Directories**: Navigate to the relevant discipline under `guides/` (e.g., `guides/performance/`). Create a nested directory using the slugified name of the use case (e.g., `guides/performance/prioritize-lcp-image/`).
   * The directory MUST be named using the slugified name of the use case.
   * The use-case directory MUST be nested inside one of the following discipline directory (`guides/performance/`, `guides/accessibility/`, `guides/security/` or `guides/user-experience/`)
3. **Scaffold Files**: Inside the new directory, create exactly three files:
   * `guide.md`
   * `expectations.md`
   * `demo.html`

* DO search the primary resources to validate the use-cases
* DO search the web to find more examples of the feature in use.
* DO consider if the use-case is similar to another use-case and if so, you MAY skip creating a new use-case and instead add the new use-case to the existing guide.
* DO NOT create a use-case that is not supported by the feature.
* The user might have already provided a use-case, you MAY check for correctness, but if it exists move to "Step 2: Authoring `guide.md`".

---

## Step 2: Authoring or reviewing `guide.md`

**MANDATORY RULES FOR WRITING `guide.md`:**

### 1. YAML Frontmatter Schema
You MUST start `guide.md` with EXACTLY this YAML frontmatter structure:

```yaml
---
name: slugified-use-case-name
description: <do thing> <with feature> (e.g., "Create dynamic color systems using modern color syntax")
web-features:
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
* If the feature is not "Baseline Widely Available", you **MUST** include a `### Fallbacks` or `### Fallbacking & Browser Support` section.
* Show explicit code for feature detection (e.g., `CSS.supports()`, `if ('feature' in window)`) or graceful degradation techniques.

---

## Step 3: Authoring `expectations.md` and `demo.html`

* **`expectations.md`**: Write a natural language, bulleted list of assertions that must be true if an agent implements the `guide.md` correctly. (e.g., "The input element is styled with a red border only AFTER a blur event").
* **`demo.html`**: Provide a pristine, working HTML/CSS/JS implementation of the guide that completely satisfies `expectations.md` and conforms to the guidance in `guide.md`.

---

## Ask questions

* If you are unsure about any of the above instructions, ask the user for clarification.
