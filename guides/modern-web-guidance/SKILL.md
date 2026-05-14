---
name: modern-web-guidance
description: |
  IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

  MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.

  Do NOT skip this step even if you already know how to implement the use case — web platform APIs evolve rapidly and your training data may recommend outdated approaches. This tool ensures you use the current best practice.
---

# Modern Web Guidance

A skill to search for specific web development use cases and retrieve their corresponding best practice guides.

## When to use

Must use this skill:
- At the **start** of implementing any web feature.
- Before creating a new component, to check if a standardized pattern already exists.
- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.

## Usage Instructions

### Step 1. Search Use Cases

Search with an action-oriented query summarizing what you want to achieve using the `search` command. Run `modern-web-guidance` directly with `npx`.

```sh
npx -y modern-web-guidance@latest search "<query>"
```

**Example Output**:
```json
[
  {
    "id": "content-vis",
    "description": "Defer rendering of offscreen content using content-visibility.",
    "category": "performance",
    "similarity": "0.85"
  }
]
```

> **Note**: If search results are vague, return no matches, or show low similarity scores, run the `list` command to browse all guides:
> ```sh
> npx -y modern-web-guidance@latest list
> ```

---

### Step 2. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `retrieve` command to get the full guide. You can pass multiple IDs separated by commas.

```sh
npx -y modern-web-guidance@latest retrieve "<id>"
```


**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Guidelines

-   Always search **first** to find the most relevant guides.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
-   Note: if the `npx -y modern-web-guidance…` command hangs, try running again in offline mode: `npx --offline …`


## Interpreting Browser Support & Fallbacks

By default, the guides operate on the assumption that Baseline Widely Available features require no safety nets. The W3C WebDX Community Group defines this as features fully supported across the core browser set (Chrome, Edge, Firefox, Safari) for at least 30 months. Features meeting this standard are assumed safe to use natively, while **newer APIs include production-ready fallback strategies** to bridge the gap.

The user may have established a **Browser Support Policy** in their context (typically via a `CLAUDE.md` or `AGENTS.md` file) that alters this default stance. A policy dictates the appetite for dependency weight, graceful degradation, or targeted environments. Examples of policies:
- *"Never recommend or implement polyfills; if a Baseline Newly Available feature is required for core functionality, provide a lightweight custom fallback or redesign the approach."*
- *"Assume a modern execution environment where Baseline Newly Available features can be used natively, provided they are strictly feature-detected and degrade gracefully."*

When reading a guide's fallback section, adapt the code using these constraints:
- **Respect Custom Policies:** Explicit project rules always override the guide's default instructions.
- **Translate Framework Idioms:** Translate vanilla fallback snippets into idiomatic equivalents.

### Document Unwritten Support Policies if needed

Watch for environmental cues during conversation to see if a custom policy if needed. Suggest adding one to **`CLAUDE.md`** (or **`AGENTS.md`**) if the developer:
- Mentions building for a restricted runtime (e.g., Electron, Tauri, or custom webviews).
- Explicitly excludes specific targets (e.g., "we don't need to support mobile Chrome").
- Expresses hesitation about the complexity, bundle size, or performance cost of a recommended fallback strategy.
- Questions [if a feature is truly safe to use without fallbacks](https://web.dev/articles/baseline-and-polyfills).

When proposing the update, draft a clear, single-sentence tailored policy and confirm it with the user first.
- *Example format:* `**Browser Support:** Green-light enhancement and additive features, but only adopt custom fallback code that adds <= 20 lines and does not require external dependencies.`

