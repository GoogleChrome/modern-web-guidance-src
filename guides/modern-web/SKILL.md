---
name: modern-web
description: |
  IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

  MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.

  Do NOT skip this step even if you already know how to implement the use case — web platform APIs evolve rapidly and your training data may recommend outdated approaches. This tool ensures you use the current best practice.
---

# Modern Web

A skill to search for specific web development use cases and retrieve their corresponding best practice guides.

## When to use

Must use this skill:
- At the **start** of implementing any web feature.
- Before creating a new component, to check if a standardized pattern already exists.
- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.

## Usage Instructions

### Step 1. Search Use Cases

Search with an action-oriented query summarizing what you want to achieve using the `search` command. Run `modern-web.mjs` directly with `node`.

```sh
node <modern-web-directory>/modern-web.mjs search "<query>"
```

**Example Output**:
```json
[
  {
    "id": "content-vis",
    "description": "Defer rendering of offscreen content using content-visibility.",
    "category": "performance",
    "distance": "0.85"
  }
]
```

---

### Step 2. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `retrieve` command to get the full guide. You can pass multiple IDs separated by commas.

```sh
node <modern-web-directory>/modern-web.mjs retrieve "<id>"
```


**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Guidelines

-   Always search **first** to find the most relevant guides.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.


### Browser Compatibility & Baseline Fallbacks

#### Baseline Status Types
Features are labeled in the guide as:
- **Widely Available**: High baseline status.
- **Newly Available since YYYY-MM-DD**: Low baseline status with a specific "interoperable" date.
- **Limited Availability**: Not yet interoperable.

#### Guidelines
- **Widely Available default:** Assume the user's project has a **Widely Available** unless instructed otherwise. The guidance will provide expert fallback strategies (progressive enhancement, polyfills) to ensure production safety. Implement these fallbacks by default.
- **Check `AGENTS.md`:** Always respect browser support constraints defined in the project's `AGENTS.md` file. Use this context to determine if a recommended fallback in the guidance can be safely skipped.
- **Reactive Discovery:** Do NOT proactively ask the user about their browser support target. Only act reactively if you observe:
  - The project is a browser monoculture (e.g., **Electron**, **Tauri**).
  - The user explicitly states exclusions (e.g., "we don't support Safari").
  - The user expresses hesitation about using polyfills.
- **Clarify & Persist:** If you detect any of the triggers above, ask the user to clarify their specific browser support constraints. Once clarified, explicitly suggest persisting this free-form policy into a project-level **`AGENTS.md`** file so future interactions remember it.
