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

**Real-world coding agents see only `guide.md`**, retrieved via the Skills CLI when a developer asks for help. Every other file in a guide directory is eval infrastructure.

**The eval harness** runs a coding agent in an isolated workspace initialized with a target base application (`daily-grind` or `devtools-times`). The agent receives the prompt from `targets/<base_app>/task.md` (or legacy Gen1 `tasks/task.md`) and, in guided mode, access to `guide.md` via the Skills CLI. The harness then runs `targets/<base_app>/grader.ts` (or Gen1 `grader.ts`) against the agent's modified application.

None of the following are ever seen by real-world coding agents:

| File | Role in eval pipeline |
|---|---|
| `expectations.md` | SME-authored natural-language assertions that must hold when `guide.md` is followed |
| `demo.html` | Standalone reference implementation authored by the SME |
| `targets/<base_app>/task.md` | Single-bullet developer prompt tailored to `<base_app>`, formatted as one `- ` line with no YAML frontmatter |
| `targets/<base_app>/patches/*-solution.patch` | Multi-agent golden solution diffs (`antigravity-solution.patch` or `jetski-solution.patch`, `claude-solution.patch`, `codex-solution.patch`) generated from `task.md` + `guide.md` that must pass **100%** of `grader.ts` |
| `targets/<base_app>/patches/zero-passrate.patch` | Calibration baseline diff (empty on almost every guide, so calibration runs against the untouched starting app) that must pass **0%** of non-exempt checks |
| `targets/<base_app>/grader.ts` | Playwright + static AST test suite run against the eval agent's output |

---

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

---

## `expectations.md` Rules & Grader Mapping

All `expectations.md` authoring rules live in [project-guides](../project-guides/SKILL.md#writing-expectationsmd) (cover every required outcome with no bullet cap, omit optional/"prefer" items, never drop hard-to-test requirements, preserve SME wording, and scope discipline bullets to the element/feature they govern).

For Stage 3 (`grader.ts` authoring and review):
* **1:1 mapping for new expectations:** Each bullet states a single requirement and maps to one `test()` block in `grader.ts`. `src/core/grader-coverage.ts` verifies semantic coverage on non-discipline guides, and test titles do not have to match expectation bullets verbatim.
* **Separate native and fallback tests:** Core bullets assume native support; fallback bullets (*"When `<feature>` is unsupported, ..."*) map to `test()` blocks that start with `skipUnless({ unsupported: '<feature>' })`.

---

## Writing & Reviewing `targets/<base_app>/task.md`

`targets/<base_app>/task.md` contains a single developer prompt formatted as one `- ` line with no YAML frontmatter and no internal line breaks (the harness only reads the first `- ` bullet):

```md
- Add a passkey management section to the account settings where signed-in readers can view their registered passkeys, rename them, or remove keys they no longer use, keeping their authenticator in sync.
```

### Rules for `task.md`
1. **Single `- ` line:** Format strictly as one line starting with `- `, with no YAML frontmatter and no line breaks. Additional bullets are ignored by the runner.
2. **Describe the outcome, never the mechanism:** Never name web platform APIs, CSS properties/at-rules, HTML attributes, fallback mechanisms, or expectation checklists (e.g., do not say `"use @view-transition"`, `"use window.Translator"`, or `"call signalAllAcceptedCredentials"`). Never add artificial constraints designed to force a specific modern API ("constraint forcing" is retired). Naming the user-visible component being built ("a modal dialog", "custom elements") and preserving the high-level capability boundary (such as on-device vs. cloud processing, or a discipline guide's topic) is fine.
3. **Never name the guide or copy `description` verbatim:** Never mention `guide.md`, the guidance skill, or the guide's slug, and do not paste `guide.md`'s frontmatter `description` verbatim. Adapt the goal into a natural imperative request (`"Add..."`, `"Update..."`, `"Implement..."`, never `"How can I...?"`) grounded in the target app's real pages and components.
4. **Neutral hooks allowed; no invented routes:** `task.md` may point at elements already in the starting app or name a neutral `id` or `data-*` hook for new elements the grader needs to locate, named after the app content it shows or manages rather than an HTML element, attribute, CSS feature, or API (e.g., `id="passkey-list"`, never `id="share-dialog"` or `data-popover`). Never invent routes or REST endpoints that do not exist in the base app.
5. **Agree with the grader and expectations:** Unprompted requirements are fair to grade when `guide.md` requires them, but `task.md` must never contradict `expectations.md`. Whenever you edit `task.md` (for example, to scrub a prompt leak), check `grader.ts` in the same pass so the grader is not left asserting a removed prompt detail, selector, or sub-feature that `guide.md` doesn't require.

---

## Writing & Reviewing `targets/<base_app>/grader.ts`

Graders are built from [`src/grading/template.grader.ts`](../../../src/grading/template.grader.ts) and checked by [`src/core/grader-lint.ts`](../../../src/core/grader-lint.ts).

### 1. Right Instrument: Browser for Behavior, Static Parsers for Source Claims
- **Runtime behavior -> Playwright browser checks:** Verify interaction, state changes, computed styles, layout, accessibility tree state, and runtime API execution in a real browser over HTTP (`page.goto(TARGET_URL)` from `test-fixture.ts`, never `file://` in Gen2 graders).
  - Locate elements through starting-app markup, neutral hooks established in `task.md`, or platform semantics (element types, ARIA roles, standard attributes).
  - Poll for asynchronous state (`expect.poll`, `waitForFunction`, Playwright web-first assertions); never use fixed `waitForTimeout` waits.
- **Source-level claims -> Static AST/DOM/CSSOM parsers:** Use static parsers only when the expectation is genuinely about source structure or static syntax across all project files (`getTargetFiles(import.meta.url)`), never reading only a single file when a solution can span several, and never running regex on raw source to test behavior:
  - **Linkedom** (`getHtmlDocuments`) for static HTML templates.
  - **CSSOMNom** (`getRules`, `getCssStyleSheet`) for stylesheet rules, at-rules (`@media`, `@supports`, `@container`, `@view-transition`, `@position-try`), and declarations.
  - **ts-morph** (`getJsProject`) for JS/TS AST inspection when runtime browser verification isn't applicable.

### 2. Accept Every Pattern the Guide Allows (No Golden Overfitting)
The 3 golden solution patches (`claude`, `codex`, `jetski`/`antigravity`) are generated from `task.md` + `guide.md` without seeing `expectations.md`. They are sample valid solutions, not an exhaustive spec.
- **Never hardcode golden-only selectors or identifiers:** Do not require class names, IDs, helper function names, state variable names, or file names that only appear in the golden patches and were neither established in `task.md`/base-app nor required by `guide.md`.
- **Handle normal code variations:** In AST checks, unwrap TypeScript type assertions (`AsExpression`, `SatisfiesExpression`, `ParenthesizedExpression`), follow local variable/parameter indirection, trace calls through helper functions across modules, and accept both `try/catch` and `.catch()`. In Tailwind/utility-CSS apps, accept either standard CSS declarations or equivalent utility classes.

### 3. One Expectation Per Test, Precondition Assertions, & Non-Vacuous Checks
- **One expectation per `test()` block:** Each `test('...', ...)` block verifies one expectation for clear diagnostics, with a precondition/presence assertion (e.g., `expect(items.length).toBeGreaterThan(0)`) allowed before the main assertion.
- **No vacuous guards or tautologies:** Never write `if (items.length > 0) { expect(...); }`, `expect(true).toBe(true)`, `cond || true`, or wrap assertions in `try/catch` that swallow failures. Always assert element/rule presence before calling `.every(...)`.
- **Pair `MUST NOT` checks with a positive presence check:** An untouched starting app trivially satisfies "does not use X" if the feature isn't built yet. Pair every negative check with a positive check that the target component or feature exists, so an unimplemented app fails the test.
- **Never use `test.skip()`:** Enforced by `grader-lint.ts`.
  - **Fallback tests (`skipUnless`):** For fallback expectations (`## Fallback strategies` in `guide.md`), call `skipUnless({ unsupported: '<feature>' })` as the first line of the test body using a valid `web-features` ID or BCD key.
  - **Discipline guides & inapplicable expectations:** Discipline guides (`DISCIPLINE_GUIDES` in `src/core/guide-validation.ts`) only test the expectations that apply to the target app. If an expectation's precondition is absent from both the starting app and `task.md` (e.g., server response headers on a static client-only app), omit/skip it for that target with a stated reason in the grader header rather than writing a vacuous pass. Runtime states a grader can simulate in Playwright (viewport sizes, permission states, network errors) are not missing preconditions and must be tested.

---

## Calibration & Validation

For Gen 2 guides (`targets/<app>/`), calibration (`gd dev <guide> --test-grader`) verifies that:
1. **Every golden solution patch passes 100%** of non-skipped tests.
2. **The untouched starting app passes 0%**, except for a `MUST NOT` check the starting app already satisfies when paired with a presence check (on `main`, `targets/<app>/patches/zero-passrate.patch` still exists on disk and is empty for almost every guide, so `zero-passrate.patch` is the untouched starting app).
3. **Patches are clean:** Golden patches never commit `node_modules/`, `dist/`, or build junk.

```bash
# Verify Gen 2 target grader calibration against golden patches and zero-passrate.patch
gd dev <path-to-guide-directory> --test-grader

# Legacy Gen 1 root graders (no targets/<app>/ directory; gd dev --test-grader throws on Gen 1):
# run Playwright manually against demo.html (expect 100%) and negative-demo.html (expect 0%):
TARGET_FILE=$PWD/guides/<category>/<slug>/demo.html GD_PREBUILT_TARGET_URL=http://localhost/demo.html PLAYWRIGHT_OUTPUT_DIR=/tmp/pw-cal ./node_modules/.bin/playwright test -c src/grading/playwright.config.ts guides/<category>/<slug>/grader.ts
TARGET_FILE=$PWD/guides/<category>/<slug>/negative-demo.html GD_PREBUILT_TARGET_URL=http://localhost/negative-demo.html PLAYWRIGHT_OUTPUT_DIR=/tmp/pw-cal ./node_modules/.bin/playwright test -c src/grading/playwright.config.ts guides/<category>/<slug>/grader.ts

# Run static grader lint and guide/coverage integrity checks
node --test src/core/grader-lint.test.ts src/authoring/guides-integrity.test.ts
```

* When modifying existing graders or shared grading helpers, use [`grader-replay`](../grader-replay/SKILL.md) to replay saved nightly solutions and verify check flips.
* When modifying `gd dev` prompts (`src/authoring/dev-prompts.ts`, `src/authoring/dev.ts`, `src/grading/generate-grader.ts`), use [`dev-prompt-canary`](../dev-prompt-canary/SKILL.md).
* For triaging pass rates and retrieval flags across nightly runs, use [`nightly-eval-investigation`](../nightly-eval-investigation/SKILL.md).
