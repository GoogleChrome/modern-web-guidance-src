---
name: project-evals
description: Best practices for creating and reviewing `expectations.md`, `targets/<app>/task.md`, and `targets/<app>/grader.ts` files to evaluate guidance quality. Use this skill any time you're writing or reviewing an `expectations.md`, `task.md`, or `grader.ts` file.
---

# Stage 3: Evaluating guidance for a use case (Needs evals)

This is the third of three stages in creating guidance:

1. Stage 1: Identifying use cases for a feature
2. Stage 2: Authoring guidance for a use case
3. Stage 3: Evaluating guidance for a use case (you are here)

## What the eval agent sees vs real-world agents

**Real-world coding agents see only `guide.md`** — retrieved via the Skills CLI when a developer asks for help. Every other file in a guide directory is eval infrastructure.

**The eval harness** runs a coding agent in an isolated workspace initialized with a target base application (`daily-grind` or `devtools-times`). The agent receives the prompt from `targets/<base_app>/task.md` and (in guided mode) access to `guide.md` via the Skills CLI. The harness then runs `targets/<base_app>/grader.ts` against the agent's modified application.

None of the following are ever seen by real-world coding agents:

| File | Role in eval pipeline |
|---|---|
| `expectations.md` | Natural-language spec of assertions that must hold when `guide.md` is followed |
| `demo.html` | Standalone reference implementation authored by the SME |
| `targets/<base_app>/task.md` | A concrete, single-bullet user prompt tailored to `<base_app>`, formatted as a single `- ` line with no YAML frontmatter |
| `targets/<base_app>/patches/*-solution.patch` | Multi-agent golden solution diffs (`claude`, `codex`, `jetski`) that must score **100%** on `grader.ts` |
| `targets/<base_app>/patches/zero-passrate.patch` | Baseline anti-pattern diff that must score **0%** on `grader.ts` |
| `targets/<base_app>/grader.ts` | Playwright + static AST test suite run against the eval agent's output |

## Writing `expectations.md`

Write a natural-language, bulleted list of assertions that must be true if an agent implements `guide.md` correctly.

* **1:1 with grader tests** — Each bullet becomes one `test()` block in `grader.ts` (for use-case guides). Write one bullet per assertion; do not combine multiple checks into a single bullet.
* **Plain declarative phrasing** — Write each bullet as a plain statement of what is true of a correct implementation (e.g., "The dialog closes when the Escape key is pressed"). Omit `The implementation MUST…` boilerplate; imperative directives belong in `guide.md`.
* **Concrete, testable criteria** — Every expectation must be verifiable via static AST analysis (Linkedom, CSSOMNom, ts-morph) or Playwright browser execution.
* **Scoped to this use case** — Only include expectations that apply to the specific use case being graded and are documented in `guide.md`.
* **Avoid untestable conditional expectations** — Avoid `"If the implementation uses X, then Y"` expectations when valid solutions may omit `X` entirely; if a golden solution patch has zero instances of `X`, the grader cannot assert `Y` without writing a vacuous guard.
* **No external links** — The grader generator cannot resolve them.
* **Avoid over-constraining** — Describe required outcomes, API contracts, or structural invariants rather than prescribing incidental implementation details (specific variable names, helper names, or file paths).

---

## Writing & Reviewing `targets/<base_app>/task.md`

`targets/<base_app>/task.md` contains a single realistic developer prompt formatted as a single `- ` line with no YAML frontmatter:

```md
- Add a passkey management section to the account settings where signed-in readers can view their registered passkeys, rename them, or remove keys they no longer use, keeping their authenticator in sync.
```

### Rules for `task.md`
1. **Grounded in the Application**: Assume the developer is working on the existing app and reference its real pages, components, and content where relevant. If the feature modifies or enhances an existing layout, component, or behavior already in the app, ask the assistant to upgrade, refactor, or modify those existing parts rather than building an isolated demo from scratch.
2. **Never Copy Description Verbatim**: Do not copy the frontmatter `description` string verbatim into `task.md`. Adapt the desired user outcome into a natural developer request situated in the target app.
3. **Derived Strictly from `guide.md` Frontmatter Description**: `task.md` is generated with structural context isolation: only the frontmatter `description` string and the base app codebase are provided. Neither `guide.md` nor `expectations.md` are present, physically preventing spoiler leakage.
4. **Preserve High-Level Capability Boundary**: Keep the execution context and functional boundary from the frontmatter `description` clear (e.g., distinguishing on-device / built-in browser capabilities from external cloud APIs) so the implementing agent knows what problem domain it is solving.
5. **No Technical or API Dictation (Neutral Hooks Allowed)**: NEVER name specific web platform APIs, CSS properties/at-rules, or method names (e.g., do not say `"use @view-transition"`, `"use window.Translator"`, or `"call signalAllAcceptedCredentials"`). Describe the desired user outcome instead. `task.md` may name a neutral hook (an `id` or `data-` attribute) for an element the grader needs to locate, named after the app content it shows or manages rather than an HTML element, attribute, CSS feature, or API (e.g. `id="passkey-list"`, never `id="share-dialog"` or `data-popover`). Routes or endpoints that do not exist in the base app are never invented.
6. **Single-line bullet format**: Must be formatted strictly as a single line prefixed with `- `, with no YAML frontmatter and no internal line breaks.
7. **Imperative Action Request & Natural Tone**: Phrase as a direct developer request to an AI coding assistant (`"Add..."`, `"Update..."`, `"Implement..."`), casual and natural, never as an advisory question (`"How can I...?"`).
8. **No Internal References**: Never mention `guide.md`, guidance skills, or the guidance project.

---

## Writing & Reviewing `targets/<base_app>/grader.ts`

Graders are generated from [`src/grading/template.grader.ts`](../../../src/grading/template.grader.ts) and calibrated against the 3 golden solution patches (`100%`) and `zero-passrate.patch` (`0%`).

### 1. Right Instrument for the Claim: Parsers vs. Browser
Unlike single-file `demo.html` checks, target app tasks (`daily-grind`, `devtools-times`) never invent URL routes or mock REST API endpoints in `task.md`, though `task.md` may name a neutral hook (an `id` or `data-` attribute) for an element the grader needs.
- **Structure and API usage → Parsers**: Check structure and API usage with parsers, never regex on source:
  - **Linkedom** (`getHtmlDocuments`) for HTML structure and DOM querying.
  - **CSSOMNom** (`getCssStyleSheet`) for CSS rules, at-rules (`@media`, `@supports`, `@container`, `@view-transition`), and declarations.
  - **ts-morph** (`getJsProject`) for JS/TS syntax, API calls, and state wiring.
  - **Never use regex** on HTML, CSS, or JS/TS source strings to verify syntax.
- **Runtime behavior → Browser**: Check runtime behavior (interaction, state changes, computed style, layout) in the browser with Playwright:
  - Browser tests locate elements through base-app markup, hooks that `task.md` names, or platform semantics (element types, ARIA roles, standard attributes).
  - **Never** use invented routes, intercepted REST payloads, or IDs or classes that exist only in the 3 golden solution patches.

### 2. Anti-Overfitting to Golden Solution Patches
The 3 golden solution patches (`claude`, `codex`, `jetski`) are generated from `task.md` + `guide.md` (without seeing `expectations.md`) and are **locked** during calibration. They represent valid implementations, **not** an exhaustive specification.
- **Never hardcode golden-patch identifiers**: Do not match allowlists of helper function names (e.g., `syncAcceptedCredentials`, `loadCredentials`), React state variable names, or newly created filenames from the calibration patches. Match conceptual roles (e.g., any function calling a WebAuthn method or registered in an event listener).
- **Unwrap TypeScript expressions**: Always unwrap `AsExpression`, `TypeAssertionExpression`, `SatisfiesExpression`, and `ParenthesizedExpression` before inspecting call arguments or object literals.
- **Follow variable indirection**: Resolve local `VariableDeclaration`, `BindingElement`, or parameter references when an identifier is passed as an argument instead of assuming inline object literals.
- **Trace helper & wrapper functions**: Do not assume a platform API is called directly inside a component or event handler. Trace calls and forwarded arguments through helper/wrapper functions across modules.
- **Flexible error handling**: Accept both `try/catch` (`TryStatement`) and promise `.catch()` handlers.
- **Utility CSS flexibility**: In apps using Tailwind or utility CSS, accept either standard CSS declarations (`getCssStyleSheet`) or equivalent utility classes (`getHtmlDocuments`).

### 3. No Vacuous Checks or Swallowed Errors
- **One expectation per `test()` block**: Each `test('...', ...)` block checks a single expectation for clear failure diagnostics, with a precondition assertion (e.g., asserting the list isn't empty) allowed before the main assertion.
- **No vacuous guards**: Never write `if (items.length > 0) { expect(...); }`, `hasFeature && (items.length === 0 || ...)`, or `if (files.length === 0) { expect(false).toBe(true); return; }`. Always assert `expect(items.length).toBeGreaterThan(0)` before asserting `.every(...)` or item properties.
- **Never use `test.skip()`** or wrap assertions in `try/catch` blocks that swallow errors.

---

## Generating & Validating Evals

```bash
# Generate missing target patches, task.md, and grader.ts, calibrate, and run evals
gd dev <path-to-guide-directory>

# Verify existing grader calibration against golden (100%) and zero-passrate (0%) patches
gd dev <path-to-guide-directory> --test-grader
```

If you modify the underlying `gd dev` prompts (`src/authoring/dev-prompts.ts`, `src/authoring/dev.ts`, `src/grading/generate-grader.ts`), use the [`dev-prompt-canary`](../dev-prompt-canary/SKILL.md) skill to empirically validate the prompt changes against the canary suite.
