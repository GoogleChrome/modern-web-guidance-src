---
name: modern-web-use-cases
description: |
  IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

  MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.
---

# Modern Web Use Cases

A skill to search for specific web development use cases and retrieve their corresponding best practice guides.

## When to use

Must use this skill:
- At the **start** of implementing any web feature.
- Before creating a new component, to check if a standardized pattern already exists.
- To avoid implementing ad-hoc solutions or loading large dependencies unnecessarily.

## Usage Instructions

You can execute these tools using standard `node` from the command line from **any** directory. 

### 1. Search Use Cases

Search with an action-oriented query summarizing what you want to achieve using the `--search` flag.

```bash
node --experimental-strip-types <path-to-serving>/serving/bin/modern-web.ts --search "<query>"
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

### 2. Retrieve Best Practices

Once you have a relevant `id` from the search results, call this script using the `--retrieve` flag to get the full guide. You can pass multiple IDs separated by commas.

```bash
node --experimental-strip-types <path-to-serving>/serving/bin/modern-web.ts --retrieve "<id>"
```

**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Guidelines

-   Always search **first** to find the most specific design/performance patterns.
-   These guides are usually framework-agnostic; adapt them correctly to your setup.
-   Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.
