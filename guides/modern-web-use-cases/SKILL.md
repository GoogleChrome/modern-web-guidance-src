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

### Step 1. Search Use Cases

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

---

### Step 2. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `--retrieve` flag to get the full guide. You can pass multiple IDs separated by commas.

```sh
modern-web --retrieve "<id>"
```


**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Guidelines

-   Always search **first** to find the most specific design/performance patterns.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
