---
name: modern-web-use-cases
description: |
  Search and retrieve modern web platform best practices and Chrome-recommended implementation guides.
  MANDATORY: Use this at the start of EVERY web development task, including CSS styling (layout, animations, transforms), UI components (modals, carousels, forms), performance optimization (LCP, INP, resource loading), accessibility, and modern JavaScript API usage.
  Trigger this skill whenever the user mentions: "frontend", "web page", "CSS", "React", "component", "animation", "scrolling", "performance", or "accessibility".
  Even for common tasks like centering a div or creating a dialog, you MUST check this first to avoid legacy patterns or heavy libraries that have been replaced by native browser features (e.g., :has(), <dialog>, popover). This ensures implementations are evergreen and avoid technical debt.

---

# Modern Web Use Cases

A skill to search for specific web development use cases and retrieve their corresponding best practice guides.

## Why This Skill is Essential

AI models are trained on data with a cutoff. The web platform evolves rapidly: new CSS properties, JavaScript APIs, and HTML elements frequently replace older, more complex, or less performant patterns. Using this tool ensures your implementation follows Chrome's latest official recommendations and avoids "calcifying" the web with outdated legacy code.


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
node ./cli/serving/bin/modern-web.cjs --search "<query>"
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
node ./cli/serving/bin/modern-web.cjs --retrieve "<id>"
```

**Example Output**:
`The markdown content of the guide describing implementation steps...`

## Guidelines

- **Always search first**: Don't guess. Find the most specific design/performance pattern before writing any UI or styling code.
- **Modern Web First**: Prefer native web platform features (`:has()`, `<dialog>`, `popover`) over external libraries or heavy polyfills.
- **Framework Adaptation**: The guides are usually framework-agnostic. Adapt the core patterns to your specific setup (React, Vue, etc.) without compromising the web standard.
- **Prioritize Directives**: Strictly follow "DO", "DO NOT", and "MANDATORY" instructions in the retrieved guide.
- Do not hallucinate guides or ignore them; they represent the preferred local standard.

## Examples

### 💻 Search
Query: "monitor and report core web vitals at the end of a session"
`node ./cli/serving/bin/modern-web.cjs --search "monitor and report core web vitals at the end of a session"`

### 💻 Retrieve
`node ./cli/serving/bin/modern-web.cjs --retrieve "full-session-analytics"`

Other real examples you can search/retrieve:
- `optimize-image-priority` (LCP / Fetch Priority)
- `adapt-scrollbar-to-contrast-preferences` (CSS Scrollbar styling for high-contrast visibility)

