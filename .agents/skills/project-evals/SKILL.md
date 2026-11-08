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

**The eval harness** runs a coding agent in an isolated workspace initialized with a target base application (`daily-grind` or `devtools-times`). The agent receives the prompt from `targets/<base_app>/task.md` (or legacy Gen1 `tasks/task.md`) and (in guided mode) access to `guide.md` via the Skills CLI. The harness then runs `targets/<base_app>/grader.ts` (or Gen1 `grader.ts`) against the agent's modified application.

None of the following are ever seen by real-world coding agents:

| File | Role in eval pipeline |
|---|---|
| `expectations.md` | Natural-language spec of assertions that must hold when `guide.md` is followed |
| `demo.html` | Standalone reference implementation authored by the SME |
| `targets/<base_app>/task.md` | A concrete, single-bullet user prompt tailored to `<base_app>`, formatted as a single `- ` line with no YAML frontmatter |
| `targets/<base_app>/patches/*-solution.patch` | Multi-agent golden solution diffs (`antigravity`/`jetski`, `claude`, `codex`) that must score **100%** on `grader.ts` |
| `targets/<base_app>/patches/zero-passrate.patch` | Baseline diff (empty on almost every guide, i.e., the untouched starting app) that must score **0%** on non-exempt checks in `grader.ts` |
| `targets/<base_app>/grader.ts` | Playwright + static AST test suite run against the eval agent's output |

## Eval Review Bar: The 8 Red Lines

When authoring or reviewing an eval, hold it to these 8 red lines. An eval is wrong if any of the following is true:

1. **A check gives the wrong verdict.** It fails a solution that follows the guide, or passes a broken or missing one. Common causes: vacuous or tautological assertions; checks that only find elements via classes or IDs the task never establishes or that only the golden solutions use; reading a single file when a solution can span several; using source regex or AST for behavior the browser should check; fixed `waitForTimeout` waits instead of polling; or a required expectation with no test.
   * *Guard:* Only treat an over-strict check as wrong when the rejected pattern is one the guide allows, or when a failure is reproduced on a real run or valid solution. Never loosen a check speculatively for hypothetical code no agent would write.
2. **The task hands the unguided run the answer.** It names the target API, CSS property, HTML attribute, fallback mechanism, or expectation checklist, names the guide, or copies `guide.md`'s frontmatter `description` verbatim.
   * *Guard:* Naming the user-visible component being built ("a modal dialog", "custom elements") and neutral `id`/`data-*` hooks is fine.
3. **An expectation grades something the guide doesn't require, or contradicts it.** It invents an untaught rule, turns an "(Optional)" or one-of-several pattern into a mandatory requirement, hardcodes snippet identifiers or magic numbers, requires a fallback for a Baseline Widely Available feature the guide says needs none, or contradicts the guide's own code or prose.
4. **An expectation can't be tested objectively on the target app.** It requires subjective judgment, grades the guide, the browser, or code comments instead of the app, or assumes something the starting app and task never include (such as live HTTP response headers on a static client-only app, or media/iframes/forms that aren't there).
5. **The guide teaches broken code or wrong spec/browser behavior.** A code snippet throws or fails in a real browser (including code in the fallback section), or the prose misstates web specs or browser support.
6. **The task and grader disagree on what to build.** The task contradicts an expectation, or the grader checks a feature, selector, or endpoint that the task never asks for *and* the guide doesn't require. This often happens after `task.md` is edited to remove a leak while `grader.ts` keeps the old check: whenever you edit a task, re-check the grader.
7. **Two guides an agent retrieves together contradict each other on the task**, so following one causes the other's grader to fail.
8. **Calibration breaks.** A golden solution fails a check, the untouched starting app (or Gen1 `negative-demo.html`) passes a non-exempt check, or a patch commits build or dependency artifacts (`node_modules`, `dist`).

**Ownership & fixes:**
- **Never change a guide to fit its grader.** If a grader needs the guide to say something new, fix the grader (or raise the gap with the guide's owner).
- **Preserve SME wording in `expectations.md`.** SMEs own `guide.md`, `demo.html`, and `expectations.md`. Keep existing `expectations.md` wording; edit a bullet only when its meaning must change (the guide doesn't teach it, the task doesn't ask for it, or it rejects an alternative the guide allows), and state the reason. Never reword existing expectations just to line up with test titles.

## Writing `expectations.md`

All `expectations.md` authoring rules live in [project-guides](../project-guides/SKILL.md#writing-expectationsmd) (cover every required outcome with no bullet cap, omit optional/"prefer" items, never drop hard-to-test requirements, preserve SME wording, and scope discipline bullets to the element/feature they govern). For Stage 3 (`grader.ts` authoring and review):

* **1:1 with grader tests** — Each bullet becomes one `test()` block in `grader.ts` (for use-case guides). Write one bullet per assertion; do not combine multiple checks into a single bullet. `src/core/grader-coverage.ts` verifies semantic coverage on non-discipline guides, and test titles do not have to match expectation bullets verbatim.
* **Separate native and fallback expectations** — Write core expectations assuming all features in `guide.md` are natively supported. When `guide.md` includes `## Fallback strategies`, write each fallback requirement as a separate plain-English bullet that names the unsupported feature (e.g., *"When `<feature>` is unsupported, ..."*) rather than combining native and fallback checks in the same bullet, so `gd dev` can scope fallback tests with `skipUnless({ unsupported: '<feature>' })` automatically.

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
5. **No Technical or API Dictation (Neutral Hooks & Component Names Allowed)**: NEVER name specific web platform APIs, CSS properties/at-rules, HTML attributes, fallback mechanisms, or method names (e.g., do not say `"use @view-transition"`, `"use window.Translator"`, or `"call signalAllAcceptedCredentials"`), and never add artificial constraints designed to force a specific modern API ("constraint forcing" is retired). Describe the desired user outcome instead (naming the user-visible component being built, such as "a modal dialog" or "custom elements", is fine). `task.md` may name a neutral hook (an `id` or `data-` attribute) for an element the grader needs to locate, named after the app content it shows or manages rather than an HTML element, attribute, CSS feature, or API (e.g. `id="passkey-list"`, never `id="share-dialog"` or `data-popover`). Routes or endpoints that do not exist in the base app are never invented.
6. **Single-line bullet format**: Must be formatted strictly as a single line prefixed with `- `, with no YAML frontmatter and no internal line breaks (additional bullets are ignored by the runner).
7. **Imperative Action Request & Natural Tone**: Phrase as a direct developer request to an AI coding assistant (`"Add..."`, `"Update..."`, `"Implement..."`), casual and natural, never as an advisory question (`"How can I...?"`).
8. **No Internal References**: Never mention `guide.md`, guidance skills, or the guidance project.
9. **Agree with the Grader & Expectations**: Unprompted requirements are fair to grade when `guide.md` requires them, but `task.md` must never contradict `expectations.md`. Whenever you edit `task.md` (for example, to scrub a prompt leak), re-check `grader.ts` in the same pass so the grader is not left asserting a removed prompt detail, selector, or sub-feature that `guide.md` doesn't require.

---

## Writing & Reviewing `targets/<base_app>/grader.ts`

Graders are generated from [`src/grading/template.grader.ts`](../../../src/grading/template.grader.ts) and calibrated against the 3 golden solution patches (`100%`) and `zero-passrate.patch` (`0%`).

### 1. Right Instrument for the Claim: Parsers vs. Browser
Unlike single-file `demo.html` checks, target app tasks (`daily-grind`, `devtools-times`) never invent URL routes or mock REST API endpoints in `task.md`, though `task.md` may name a neutral hook (an `id` or `data-` attribute) for an element the grader needs.
- **Structure and API usage → Parsers**: Check source structure and static syntax with parsers across all project files (`getTargetFiles(import.meta.url)`), never reading only a single file when a solution can span several, and never regex on source to test behavior:
  - **Linkedom** (`getHtmlDocuments`) for HTML structure and DOM querying.
  - **CSSOMNom** (`getRules`, `getCssStyleSheet`) for CSS rules, at-rules (`@media`, `@supports`, `@container`, `@view-transition`, `@position-try`), and declarations.
  - **ts-morph** (`getJsProject`) for JS/TS syntax, API calls, and state wiring when runtime browser verification isn't applicable.
  - **Never use regex** on HTML, CSS, or JS/TS source strings to verify syntax or runtime behavior.
- **Runtime behavior → Browser**: Check runtime behavior (interaction, state changes, computed style, layout, accessibility tree) in the browser with Playwright over HTTP (`page.goto(TARGET_URL)` from `test-fixture.ts`, never `file://` in Gen2 graders):
  - Browser tests locate elements through base-app markup, hooks that `task.md` names, or platform semantics (element types, ARIA roles, standard attributes).
  - Poll for asynchronous state (`expect.poll`, `waitForFunction`, Playwright web-first assertions); never use fixed `waitForTimeout` waits. When replacing a fixed wait, poll for the end state it was covering (the animation finished, the element is shown after its transition), not a condition that's already true when the test starts.
  - Prove every new or changed check can fail: run it against a variant with the behavior removed or delayed, and against the guide's own pattern.
  - **Never** use invented routes, custom REST API endpoints/payloads, or IDs or classes that exist only in the 3 golden solution patches.

### 2. Anti-Overfitting to Golden Solution Patches
The 3 golden solution patches (`claude`, `codex`, `jetski`/`antigravity`) are generated from `task.md` + `guide.md` (without seeing `expectations.md`) and are **locked** during calibration. They represent valid implementations, **not** an exhaustive specification. Never edit a golden to make it pass a grader: if a correct check fails a golden, regenerate the golden; if the check is wrong, fix the check.
- **Never hardcode golden-patch identifiers**: Do not match allowlists of helper function names (e.g., `syncAcceptedCredentials`, `loadCredentials`), React state variable names, or newly created filenames from the calibration patches. Match conceptual roles (e.g., any function calling a WebAuthn method or registered in an event listener).
- **Unwrap TypeScript expressions**: Always unwrap `AsExpression`, `TypeAssertionExpression`, `SatisfiesExpression`, and `ParenthesizedExpression` before inspecting call arguments or object literals.
- **Follow variable indirection**: Resolve local `VariableDeclaration`, `BindingElement`, or parameter references when an identifier is passed as an argument instead of assuming inline object literals.
- **Trace helper & wrapper functions**: Do not assume a platform API is called directly inside a component or event handler. Trace calls and forwarded arguments through helper/wrapper functions across modules.
- **Flexible error handling**: Accept both `try/catch` (`TryStatement`) and promise `.catch()` handlers.
- **Utility CSS flexibility**: In apps using Tailwind or utility CSS, accept either standard CSS declarations (`getRules` / `getCssStyleSheet`) or equivalent utility classes (`getHtmlDocuments`).

### 3. No Vacuous Checks or Swallowed Errors
- **One expectation per `test()` block**: Each `test('...', ...)` block checks a single expectation for clear failure diagnostics, with a precondition assertion (e.g., asserting the list isn't empty) allowed before the main assertion.
- **No vacuous guards**: Never write `if (items.length > 0) { expect(...); }`, `hasFeature && (items.length === 0 || ...)`, or `if (files.length === 0) { expect(false).toBe(true); return; }`. Always assert `expect(items.length).toBeGreaterThan(0)` before asserting `.every(...)` or item properties.
- **Pair `MUST NOT` checks with a positive presence check**: An untouched starting app trivially satisfies "does not use X" if the feature isn't built yet. Pair every negative check with a positive check that the target component or feature exists, so an unimplemented app fails the test.
- **Never use `test.skip()`** or wrap assertions in `try/catch` blocks that swallow errors.
- **Fallback-scoped tests (`skipUnless`)**: For expectations that only apply when a feature is unsupported (corresponding to `## Fallback strategies` in `guide.md`), call `skipUnless({ unsupported: '<feature>' })` (imported from `test-fixture.ts`) as the first line of the test body, where `<feature>` is a `web-features` ID from `guide.md` frontmatter or a BCD key. The harness automatically detects `skipUnless({ unsupported: '<feature>' })` calls in `grader.ts` and runs additional evaluation variants (`newly`, `limited`) for any Newly or Limited availability features. Do not call `skipUnless` for universal expectations.
- **Discipline guides & inapplicable expectations**: Discipline guides (`DISCIPLINE_GUIDES` in `src/core/guide-validation.ts`) only test the expectations that apply to the target app. If an expectation's precondition is absent from both the starting app and `task.md` (e.g., server response headers on a static client-only app), omit/skip it for that target with a stated reason in the grader header rather than writing a vacuous pass. Runtime states a grader can simulate in Playwright (viewport sizes, permission states, network errors) are not missing preconditions and must be tested.

---

## Generating & Validating Evals

```bash
# Generate missing target patches, task.md, and grader.ts, calibrate, and run evals
gd dev <path-to-guide-directory>

# Verify existing Gen 2 grader calibration against golden (100%) and zero-passrate (0%) patches
gd dev <path-to-guide-directory> --test-grader

# Legacy Gen 1 root graders (no targets/<app>/ directory; gd dev --test-grader throws on Gen 1):
# run Playwright manually against demo.html (expect 100%) and negative-demo.html (expect 0%):
TARGET_FILE=$PWD/guides/<category>/<slug>/demo.html GD_PREBUILT_TARGET_URL=http://localhost/demo.html PLAYWRIGHT_OUTPUT_DIR=/tmp/pw-cal ./node_modules/.bin/playwright test -c src/grading/playwright.config.ts guides/<category>/<slug>/grader.ts
TARGET_FILE=$PWD/guides/<category>/<slug>/negative-demo.html GD_PREBUILT_TARGET_URL=http://localhost/negative-demo.html PLAYWRIGHT_OUTPUT_DIR=/tmp/pw-cal ./node_modules/.bin/playwright test -c src/grading/playwright.config.ts guides/<category>/<slug>/grader.ts

# Run static grader lint and guide/coverage integrity checks
node --test src/core/grader-lint.test.ts src/authoring/guides-integrity.test.ts
```

If you modify the underlying `gd dev` prompts (`src/authoring/dev-prompts.ts`, `src/authoring/dev.ts`, `src/grading/generate-grader.ts`), use the [`dev-prompt-canary`](../dev-prompt-canary/SKILL.md) skill to empirically validate the prompt changes against the canary suite. When modifying existing graders or shared grading helpers, use [`grader-replay`](../grader-replay/SKILL.md) to replay saved nightly solutions and verify check flips; for triaging pass rates and retrieval flags across nightly runs, use [`nightly-eval-investigation`](../nightly-eval-investigation/SKILL.md).
