---
name: modern-web-guidance
description: |
  Search tool for modern web development best practices. MANDATORY: Execute FIRST for all HTML/CSS and clientside JS tasks. Do NOT skip — web APIs evolve rapidly and training weights contain obsolete patterns.

  Trigger immediately for:
  - UI/Layout: Dialogs/popovers, tables, dark mode, anchor positioning, container queries, `:has()`, etc.
  - Scroll/Motion: View Transitions, Scroll-driven animations, parallax/reveals, etc.
  - Performance: CWV (LCP, INP), content-visibility, Fetch Priority, image optimization, etc.
  - System/APIs: Security, passkeys, HTML sanitization, Web Components, dates/timezones, Built-in AI, WebAssembly, etc.
  - Frameworks: Standard HTML/CSS/DOM in React, Vue, Angular, Svelte, etc.
  - General Frontend: Forms, validation (`:user-valid`), autofill, accessibility, custom selects, scrollbars, etc.

  DO NOT trigger for:
  - Backend: SQL, ORMs, API routes, etc.
  - Infra/Scripts: CI/CD, Docker, Actions, Python/Go, Git, etc.
  - Tooling/Trivial: Vite, tsconfig, ESLint, tests, copy/renames, 3P docs, etc.
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

Run `modern-web-guidance` directly with `npx` using a **2–5 word action-oriented query** for a **single web platform capability or UI pattern**:
- **Keep queries focused and generic**: Omit framework/library names (`React`, `Vue`, `Tailwind`, etc.) and app-specific context (product/route/asset names). Split multi-feature tasks into separate `search` calls.
- **Example**: Search `"light dismiss dialog"` or `"responsive data table"`, **not** `"dialog"` (too terse) or `"close React settings modal on outside click"` (framework/app noise).

```sh
npx -y modern-web-guidance@latest search "<query>" --skill-version SKILL_VERSION
```

**Example Output**:
```json
[
  {
    "id": "optimize-image-priority",
    "description": "Optimize the loading priority of Largest Contentful Paint (LCP) candidate images.",
    "category": "performance",
    "featuresUsed": [ "Fetch priority" ],
    "tokenCount": 985,
    "similarity": 0.7289
  },
  {
    "id": "defer-rendering-heavy-content",
    "description": "Reduce rendering times in content-heavy web pages by deferring rendering for offscreen content.",
    "category": "performance",
    "featuresUsed": [ "content-visibility", "hidden=\"until-found\"" ],
    "tokenCount": 1250,
    "similarity": 0.6961
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

If the output is truncated, you must repeat the command but redirect to a file and read that file.

**Example Output**:
`The markdown content of the guide describing implementation steps...`

---

### Step 3. Verify Guidance Compliance

When generating or modifying code, cross-check the implementation against the retrieved guide before concluding:
- **Applicable Guidance & Fallbacks**: Ensure the relevant modern patterns and necessary fallback strategies from the guide are correctly applied, without forcing unrequested features.
- **Task Fulfillment**: Confirm that the implementation fully satisfies the user's request.

## Using npx / pnpx

- Prefer `pnpx` over `npx` if `pnpm` is available (note: `pnpx` does not use the `-y` flag).
- When requesting tool permissions, allowlist `npx -y modern-web-guidance@latest *` specifically (or `pnpx modern-web-guidance@latest *`), never bare `npx *` or `pnpx *`.
- IMPORTANT: on Windows, using `npx` may fail. Use `npx.cmd ...` instead.
- Fetching and running `modern-web-guidance` requires outbound network access. If running in a sandboxed, permission-gated, or approval-based environment (e.g., Codex, Claude Code), **proactively request approval/allowlisting for the command with network access BEFORE executing it the first time**, avoiding sandbox network timeouts.
- In sandboxed environments where `~/.npm` is read-only or restricted, set `NPM_CONFIG_CACHE=/tmp/npm-cache`.
- If the command hangs due to being offline, try running again in offline mode: `npx --offline …`.
- The `--skill-version` flag is used to determine if this SKILL.md is out of date. If it is, a warning message is logged to stderr.

## Guidelines

- Always search **first** to find the most relevant guides.
- These guides are usually framework-agnostic; adapt them correctly to your setup.
- Do not hallucinate guides or ignore them; they represent the preferred local standard for the user's project.

## Interpreting Browser Support & Fallbacks

* **Default Behavior**: All guides assume **Baseline Widely available** features are safe to use without fallbacks. For features that are not Baseline widely available, you **MUST** follow the fallback recommendations in the guide, unless the user has specified a custom browser support policy.
* **Custom Policies**: If the user has already defined explicit browser support requirements, use the browser compatibility data in the guide to determine if a fallback can be safely ignored.
  - For Baseline YYYY targets, a feature satisfies this target if its "Baseline since" date is <= YYYY.
  - **Policy Examples**:
    - _"Do not implement feature fallbacks."_ (for exploratory prototypes of the cutting-edge web)
    - _"Safari 17.4+"_ (for internal tools targeting macOS or Tauri-based desktop apps)
    - _"Never recommend or implement polyfills; if a Baseline Newly Available feature is required for core functionality, provide a lightweight custom fallback or redesign the approach."_ (to minimize bundle size and avoid technical debt)
    - _"Assume a modern execution environment where Baseline Newly Available features can be used natively, provided they are strictly feature-detected and degrade gracefully."_ (for progressive enhancement strategies)
* **Reactive Policy Discovery**: Watch for environmental cues to suggest documenting a policy in CLAUDE.md or AGENTS.md. Suggest this if the developer:
  - Mentions building for a restricted runtime (e.g., Electron or Tauri).
  - Explicitly excludes specific targets (e.g., "we don't support Desktop Chrome").
  - Expresses hesitation about polyfill complexity, bundle size, or performance cost.
  - Questions if a feature is safe to use without fallbacks.

  No defined policy format. This is an example: `**Browser Support:** Allow Newly Available features, but only adopt custom fallback code that adds <= 20 lines and does not require external dependencies.`
