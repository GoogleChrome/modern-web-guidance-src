---
name: modern-web-use-cases
description: |
  IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

  MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.

  Do NOT skip this step even if you already know how to implement the use case — web platform APIs evolve rapidly and your training data may recommend outdated approaches. This tool ensures you use the current best practice.
---

# Modern Web Use Cases

A skill to search for specific web development use cases and retrieve their corresponding best practice guides.

## When to use

Must use this skill:
- At the **start** of implementing any web feature.
- Before creating a new component, to check if a standardized pattern already exists.
- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.

## Usage Instructions

### Step 0. Install the modern-web CLI
First, ensure the modern-web CLI is installed. The below command installs it globally if needed; adjust the path to the modern-web skill directory.

```sh
command -v modern-web >/dev/null 2>&1 || <modern-web-use-cases-directory>/setup.sh
```

### Step 1. Determine Project Target

Before you can check if a feature satisfies the target, you need to find the project's Baseline target:

- **`baseline.config.json`**: Check for a `"baseline_target"` property in this file at the project root. This takes precedence over all other sources.
- **Browserslist**: Check for `baseline` queries in `.browserslistrc` or `package.json` (e.g., `baseline widely available`).
- **Linters**: Check linter configurations (e.g., `eslint.config.js`, `stylelint.config.js`) to see if they explicitly specify a Baseline target.

Do NOT attempt to interpret or map general browser support matrices (like `> 1%` or `last 2 versions`) to Baseline equivalents.

If no explicit configuration is found, default to `'widely available'`.

### Step 2. Search Use Cases

Search with an action-oriented query summarizing what you want to achieve using the `--search` flag.

```sh
modern-web --search "<query>"
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

### Step 3. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `--retrieve` flag to get the full guide. You can pass multiple IDs separated by commas.

```sh
modern-web --retrieve "<id>"
```


**Example Output**:
`The markdown content of the guide describing implementation steps...`

### Step 4. Verify Baseline Status

After retrieving the guide, check if the features it recommends satisfy your project's Baseline target.

```sh
modern-web --baseline-lookup --feature <feature-id>
modern-web --baseline-satisfies --target <target> --feature <feature-id>
```

If needed, perform a semantic search to find features by their descriptions:

```sh
modern-web --baseline-search "<query>" [--limit <number>]
```

### Decision Matrix for Fallbacks

Use this decision matrix to determine the action to take based on target satisfaction and fallback availability.

To determine whether to automatically add Baseline TODOs, check `"enable_baseline_todos"` in `baseline.config.json`. If set to `false`, do not add `TODO(baseline/...)` comments. The default value is `true`.

When adding `TODO(baseline/...)` comments, place them as close as possible to where the final implementation will live and/or where existing implementations will need to change.

| Target Satisfied | Fallback Required | TODOs Enabled | Action | Rationale |
| :---: | :---: | :---: | --- | --- |
| **Yes** | N/A | N/A | **Skip Fallback** | Feature is safe to use as-is per project configuration. Don't add redundant code. |
| **No** | **Yes** | N/A | **Progressive Enhancement** | Use feature detection to use the modern feature if supported by the browser, otherwise load the fallback/polyfill. |
| **No** | **No** | **Yes** | **Avoid Feature & Add TODO** | Do not use the feature. Leave a `// TODO(baseline/feature-id)` in the source code to adopt it later. |
| **No** | **No** | **No** | **Avoid Feature** | Do not use the feature. Do not add a TODO comment. |

### Implementation Patterns

#### Target is NOT Satisfied (Use Fallback)
```javascript
if ('fooBar' in window) {
  // Use modern API where it's available
  window.fooBar();
} else {
  // Polyfill or fallback strategy as defined in the guide
  // TODO(baseline/feature-id): Remove fallback when target satisfies baseline
  guideFallback();
}
```

#### Target is NOT Satisfied (No Fallback Available)
```javascript
// Current target does not support 'feature-id' and no fallback is available.
// TODO(baseline/feature-id): Use modern API when target satisfies baseline
legacyApproach();
```

#### Target is Satisfied (Skip Fallback)
```javascript
// Feature is safe for target
// Rely on native implementation directly
window.someFeature();
```

## Guidelines

-   Always search **first** to find the most specific design/performance patterns.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
