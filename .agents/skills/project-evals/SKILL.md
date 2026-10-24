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
* **Feature-scoped expectations (`[supported: <feature>]` / `[unsupported: <feature>]`)** — Evaluations run with `BASELINE_TARGET=widely` by default, and **untagged bullets run on every target** (`widely`, `newly`, `limited`). When a guide covers a Newly or Limited availability feature with a fallback, tag fallback/polyfill expectations with `[unsupported: <feature-id>]` (runs when the target Baseline does not support `<feature-id>`) and pair them with a `[supported: <feature-id>]` bullet asserting the implementation relies on the native feature without the fallback/polyfill (where `<feature-id>` is a `web-features` ID or BCD key). The harness automatically determines which Baseline targets (`newly`, `limited`) to evaluate from the feature's current Baseline status.

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
5. **No Technical or API Dictation**: NEVER name specific web platform APIs, CSS properties/at-rules, or method names (e.g., do not say `"use @view-transition"`, `"use window.Translator"`, or `"call signalAllAcceptedCredentials"`). Describe the desired user outcome instead.
6. **Single-line bullet format**: Must be formatted strictly as a single line prefixed with `- `, with no YAML frontmatter and no internal line breaks.
7. **Imperative Action Request & Natural Tone**: Phrase as a direct developer request to an AI coding assistant (`"Add..."`, `"Update..."`, `"Implement..."`), casual and natural, never as an advisory question (`"How can I...?"`).
8. **No Internal References**: Never mention `guide.md`, guidance skills, or the guidance project.

---

## Writing & Reviewing `targets/<base_app>/grader.ts`

Graders are generated from [`src/grading/template.grader.ts`](../../../src/grading/template.grader.ts) and calibrated against the 3 golden solution patches (`100%`) and `zero-passrate.patch` (`0%`).

### 1. Assertion Hierarchy: Static Analysis First
Unlike single-file `demo.html` checks, target app tasks (`daily-grind`, `devtools-times`) do not prescribe URL routes, mock REST API endpoints, or button selectors in `task.md`.
- **Prioritize static AST analysis** over browser execution:
  - **Linkedom** (`getHtmlDocuments`) for HTML structure and DOM querying.
  - **CSSOMNom** (`getCssStyleSheet`) for CSS rules, at-rules (`@media`, `@supports`, `@container`, `@view-transition`), and declarations.
  - **ts-morph** (`getJsProject`) for JS/TS syntax, API calls, and state wiring.
  - **Never use regex** on HTML, CSS, or JS/TS source strings to verify syntax.
- **Browser E2E checks only when strictly necessary**: Only use Playwright browser tests for runtime layout geometry or computed style checks on existing base-app elements. **Never** write Browser E2E tests that navigate to newly invented routes, intercept custom REST API URLs/payloads, or click patch-specific selectors that only exist in the 3 golden solution patches.

### 2. Anti-Overfitting to Golden Solution Patches
The 3 golden solution patches (`claude`, `codex`, `jetski`) are generated from `task.md` + `guide.md` (without seeing `expectations.md`) and are **locked** during calibration. They represent valid implementations, **not** an exhaustive specification.
- **Never hardcode golden-patch identifiers**: Do not match allowlists of helper function names (e.g., `syncAcceptedCredentials`, `loadCredentials`), React state variable names, or newly created filenames from the calibration patches. Match conceptual roles (e.g., any function calling a WebAuthn method or registered in an event listener).
- **Unwrap TypeScript expressions**: Always unwrap `AsExpression`, `TypeAssertionExpression`, `SatisfiesExpression`, and `ParenthesizedExpression` before inspecting call arguments or object literals.
- **Follow variable indirection**: Resolve local `VariableDeclaration`, `BindingElement`, or parameter references when an identifier is passed as an argument instead of assuming inline object literals.
- **Trace helper & wrapper functions**: Do not assume a platform API is called directly inside a component or event handler. Trace calls and forwarded arguments through helper/wrapper functions across modules.
- **Flexible error handling**: Accept both `try/catch` (`TryStatement`) and promise `.catch()` handlers.
- **Utility CSS flexibility**: In apps using Tailwind or utility CSS, accept either standard CSS declarations (`getCssStyleSheet`) or equivalent utility classes (`getHtmlDocuments`).

### 3. No Vacuous Checks or Swallowed Errors
- **Single assertion per `test()` block**: Write one assertion per `test('...', ...)` block for clear failure diagnostics.
- **No vacuous guards**: Never write `if (items.length > 0) { expect(...); }`, `hasFeature && (items.length === 0 || ...)`, or `if (files.length === 0) { expect(false).toBe(true); return; }`. Always assert `expect(items.length).toBeGreaterThan(0)` before asserting `.every(...)` or item properties.
- **Never use `test.skip()`** or wrap assertions in `try/catch` blocks that swallow errors.
- **Feature-scoped tests (`skipUnless`)**: For any expectation prefixed with `[supported: <feature>]` or `[unsupported: <feature>]` in `expectations.md`, prefix the `test('[supported: <feature>] ...', () => { ... })` title with the exact tag and call `skipUnless({ supported: '<feature>' })` or `skipUnless({ unsupported: '<feature>' })` (imported from `test-fixture.ts`) as the first line of the test body. Do not call `skipUnless` for untagged expectations.

---

## Generating & Validating Evals

```bash
# Generate missing target patches, task.md, and grader.ts, calibrate, and run evals
gd dev <path-to-guide-directory>

# Verify existing grader calibration against golden (100%) and zero-passrate (0%) patches
gd dev <path-to-guide-directory> --test-grader
```

If you modify the underlying `gd dev` prompts (`src/authoring/dev-prompts.ts`, `src/authoring/dev.ts`, `src/grading/generate-grader.ts`), use the [`dev-prompt-canary`](../dev-prompt-canary/SKILL.md) skill to empirically validate the prompt changes against the canary suite.
