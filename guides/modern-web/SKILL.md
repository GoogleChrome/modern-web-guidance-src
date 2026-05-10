---
name: modern-web
description: |
  GOAL: Author performant, accessible, lightweight web interfaces using modern standards to minimize script footprint and layout shift.
  TRIGGER: Trigger when developing CSS layouts (container/style queries, `:has()`, `calc-size`, scrollbars, relative colors), native interactions (`dialog`, `popover`, custom anchor overlays), view transitions (`@starting-style`, discrete transitions), priority fetches (`fetch-priority`, `fetchlater`), or layout rendering policies (`content-visibility`, `speculation-rules`, scheduler, `move-before`).
  EXCLUSIONS: Do NOT invoke for standard baseline styles, minor styling updates (colors, padding, generic spacing), or basic markup modifications.
  BYPASS: Stale training data relies on obsolete scripts and legacy layout conventions. You are strictly forbidden from designing interactive HTML or CSS structures from memory; you must search and retrieve verified use cases from local guides first.
---

# Modern Web Development Guidelines

To locate, retrieve, and execute modern layout, design, and web platform patterns:

## Search and Retrieve Protocol

### 1. Search for an implementation pattern
Find the most relevant pattern matching your current task.

```bash
node <modern-web-directory>/modern-web.mjs search "<query>"
```

Example:
```bash
node <modern-web-directory>/modern-web.mjs search "defer offscreen layout"
```

Example search output:
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

### 2. Retrieve standard requirements
Use the identified `id` from search outputs to load full guidelines.

```bash
node <modern-web-directory>/modern-web.mjs retrieve "<id>"
```

Example:
```bash
node <modern-web-directory>/modern-web.mjs retrieve "content-vis"
```

---

## Directives

1. **Search First**: Do not write layout structures, styling properties, or scripting actions without checking for matching use cases.
2. **Prioritize Native Platform Capabilities**: Leverage native browser-supported features (e.g., `:has()`, `<dialog>`, `popover`) and dynamic units over complex JavaScript calculations, design hacks, or dependencies.
3. **Strict Compliance**: Carry out all "DO", "DO NOT", and "MANDATORY" specifications documented in the retrieved guides.
4. **Framework Adaptations**: Framework adaptations (e.g., React, Vue components) must comply with the core standards constraints.
5. **No Hallucinations**: Adhere strictly to locally available web development guidelines retrieved using this tool.

---

## Query Reference Examples

### Search query:
```bash
node <modern-web-directory>/modern-web.mjs search "monitor and report core web vitals at the end of a session"
```

### Retrieve guide:
```bash
node <modern-web-directory>/modern-web.mjs retrieve "full-session-analytics"
```

Other reference guides available for search:
- `optimize-image-priority` (LCP / Fetch Priority)
- `adapt-scrollbar-to-contrast-preferences` (CSS Scrollbar styling for high-contrast visibility)

