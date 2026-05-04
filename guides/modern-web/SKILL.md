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

### Step 1. Determine Project Target

Before you can check if a feature satisfies the target, you need to find the project's Baseline target:

- **`baseline.config.json`**: Check for a `"baseline_target"` property in this file at the project root. This takes precedence over all other sources.
- **Browserslist**: Check for `baseline` queries in `.browserslistrc` or `package.json` (e.g., `baseline widely available`).
- **Linters**: Check linter configurations (e.g., `eslint.config.js`, `stylelint.config.js`) to see if they explicitly specify a Baseline target.

Do NOT attempt to interpret or map general browser support matrices (like `> 1%` or `last 2 versions`) to Baseline equivalents.

If no explicit configuration is found, default to `Widely Available`.

### Step 2. Search Use Cases

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

### Step 3. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `retrieve` command to get the full guide. You can pass multiple IDs separated by commas.

```sh
node <modern-web-directory>/modern-web.mjs retrieve "<id>"
```

**Example Output**:
`The markdown content of the guide describing implementation steps...`

### Step 4. Verify Baseline Satisfaction

Compare the project's Baseline target (from Step 1) with the Baseline status of **each feature** recommended in the guide (typically found in the **Fallback strategies** section).

#### Project Target Types
Project targets fall into three main categories that map to the Satisfaction Matrix:
- **Relative**: `Widely Available` (from configs like `"widely"` or `"baseline widely available"`), `Newly Available`, `Limited Availability`
- **Yearly**: `Baseline YYYY` (from configs like `"baseline 2024"`)
- **Date-specific**: `Widely on YYYY-MM-DD` (from configs like `"baseline widely available on 2027-01-01"`)

#### Baseline Status Types
Features are labeled in the guide as:
- **Widely Available**: High baseline status.
- **Newly Available since YYYY-MM-DD**: Low baseline status with a specific "interoperable" date.
- **Limited Availability**: Not yet interoperable.

#### Satisfaction Matrix

| Project Target | Widely Available | Newly Available | Limited Availability |
| :--- | :---: | :---: | :---: |
| **Widely Available** (default) | ✅ | ❌ | ❌ |
| **Newly Available** | ✅ | ✅ | ❌ |
| **Limited Availability** | ✅ | ✅ | ✅ |
| **Baseline YYYY** | ✅ | If Low Date ≤ YYYY-12-31 | ❌ |
| **Widely on YYYY-MM-DD** | ✅ | If Low Date ≤ (Target Date - 30 months) | ❌ |

**✅ Satisfied**: The feature is safe to use as-is.
**❌ Not Satisfied**: You must implement a fallback or avoid the feature as described in the guide.

**Target Normalization**: 
- When parsing project targets from external configurations (such as ESLint's `"newly"`/`"widely"` or Browserslist's `"baseline widely available"`), normalize them to their closest equivalent in the matrix (e.g., `"newly"` to `Newly Available`) before evaluating satisfaction.
- **Baseline Date vs. Widely Available Date**: The "Baseline since YYYY-MM-DD" date always represents the date the feature became **Newly Available** (first became interoperable). A feature only becomes **Widely Available** 30 months after that date. Keep this 30-month offset in mind when manually evaluating "Widely available on YYYY-MM-DD" targets.

If you are unsure whether a feature satisfies the Baseline target, always err on the side of caution and use the fallback strategy.

## Guidelines

-   Always search **first** to find the most specific design/performance patterns.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
