---
name: dev-prompt-canary
description: >
  Empirically validates changes to `gd dev` authoring and grading prompts (`src/authoring/dev-prompts.ts`,
  `src/authoring/dev.ts`, `src/grading/generate-grader.ts`, `src/grading/template.grader.ts`) by running
  targeted `task.md` and `grader.ts` canary regenerations, static AST checks (`src/authoring/check.ts`),
  and a held-out 4th solution stress test in an isolated worktree. Use whenever modifying prompts or
  generation logic in the `gd dev` pipeline.
---

# `gd dev` Prompt Canary Validation

Prompts in [`src/authoring/dev-prompts.ts`](../../../src/authoring/dev-prompts.ts) (`buildTargetTaskPrompt`, `buildTargetGraderPrompt`, `buildZeroPassratePrompt`, `buildSolutionPrompt`) and [`src/grading/generate-grader.ts`](../../../src/grading/generate-grader.ts) are high-leverage generators that shape every `task.md`, `grader.ts`, and calibration patch across the repository.

Unit tests in `dev-prompts.test.ts` only verify substring presence in the prompt template—they **cannot** catch LLM behavioral regressions (such as a well-intentioned prompt tweak causing the grader agent to write brittle Playwright E2E tests that overfit to golden patch routes/selectors, or large failure logs crashing retries with `spawn E2BIG`).

Whenever you modify `gd dev` prompts or generation orchestration, run this empirical canary protocol before merging.

---

## 1. Fast Incremental Mechanics (Why This Takes ~4 Minutes, Not Hours)

Running a full `gd dev <guide>` from scratch takes ~25 minutes because it generates 3 golden solution patches (`claude`, `codex`, `jetski`), a `zero-passrate.patch`, `task.md`, `grader.ts`, and runs full unguided/guided evaluations.

Instead, exploit the incremental file-existence checks in [`src/authoring/dev.ts`](../../../src/authoring/dev.ts):
- **`task.md` Canary (~45s for 8 targets)**: Keep existing patches and graders untouched. Call `extractGuideDescription` + `buildTargetTaskPrompt` + `runAgent` directly in a lightweight runner (or delete only `targets/<app>/task.md` and run `devGuide(dir, { test: false, targets: [app] })`).
- **`grader.ts` Canary (~2–3 mins per target)**: Keep `targets/<app>/patches/*-solution.patch`, `zero-passrate.patch`, and `task.md` untouched. Delete **only** `targets/<app>/grader.ts`, then run `generateTargetGrader` + `testGrader` (or `devGuide(dir, { test: false, targets: [app] })`).

---

## 2. Step-by-Step Workflow

### Step 1: Create an Isolated Scratch Worktree

Never mutate `guides/` inside your active feature worktree. Create a throwaway worktree branched off your candidate commit:

```bash
git worktree add -B exp/canary-eval .worktrees/canary-eval HEAD
ln -s ../../node_modules .worktrees/canary-eval/node_modules
ln -s ../../.env .worktrees/canary-eval/.env
```

### Step 2: Launch Parallel Canary Subagents (`Model: "flash"`)

Orchestrate 3 parallel subagents inside `.worktrees/canary-eval` to test the representative failure modes below.

---

### Experiment A: `task.md` Spoiler & Capability-Boundary Canaries

Regenerate `task.md` across both `daily-grind` and `devtools-times` for these 4 canary guides and compare **OLD vs. NEW**:

| Canary Guide | Historical Failure Mode Tested | Pass Criteria |
| :--- | :--- | :--- |
| `guides/ui-behaviors/directional-navigation-transitions` | **Secondary Expectation Spoilers**: Previously leaked `prefers-reduced-motion` and accessibility fallbacks from `expectations.md` into `task.md`. | Zero mention of `prefers-reduced-motion`, `reduced motion`, `@view-transition`, `active-view-transition-type`, or `pagereveal`. |
| `guides/built-in-ai/translator` | **Capability-Boundary Erasure**: Over-stripping caused prompts to ask for generic "translation", leading unguided/guided agents to wire up cloud REST APIs instead of browser built-in AI. | Preserves the "on-device / built-in browser" capability boundary from `guide.md`'s frontmatter `description` without naming `window.Translator` or `Translator.create()`. |
| `guides/html/html` | **Discipline Guide Leakage**: Previously leaked specific `expectations.md` items (`autofill`, `autocomplete`, `srcset`, `fetchpriority`) into a general HTML review task. | High-level semantic HTML review request; zero mention of `autofill`, `autocomplete`, `srcset`, `sizes`, or `fetchpriority`. |
| `guides/security/passkey-management` | **API Method Dictation**: Leaking specific WebAuthn Signal API method names into the prompt. | Requests viewing, renaming, and revoking passkeys + keeping the authenticator in sync without naming `PublicKeyCredential`, `signalAllAcceptedCredentials`, or `signalUnknownCredential`. |

Every generated `task.md` must also pass:
- Single bullet line (`- ...`) beneath YAML frontmatter (`base_app: <app>`) with no internal line breaks.
- Imperative directive phrasing (not a question).
- 0 violations from `node src/authoring/check.ts`.

---

### Experiment B1: `grader.ts` Anti-Overfitting & Held-Out 4th Solution Stress Test

**Target**: `guides/security/passkey-management` (`devtools-times`)

#### Why Calibration Alone Is Insufficient
During `generateTargetGrader`, the agent has `claude-solution.patch`, `codex-solution.patch`, and `jetski-solution.patch` open in its workspace. A grader that hardcodes an allowlist of the 3 patches' helper function names (e.g., `['syncAcceptedCredentials', 'loadCredentials', 'load']`) will score **100% on calibration** while rejecting any unseen 4th agent run in `gd eval`.

#### Protocol
1. Save the existing `guides/security/passkey-management/targets/devtools-times/grader.ts` as `/tmp/passkey-OLD.grader.ts`.
2. Delete `targets/devtools-times/grader.ts` and run `devGuide('guides/security/passkey-management', { test: false, targets: ['devtools-times'] })`.
3. Audit the newly generated `grader.ts`:
   - Confirm calibration converged (`claude=100%`, `codex=100%`, `jetski=100%`, `zero-passrate=0%`).
   - Run `node src/authoring/check.ts guides/security/passkey-management` (must report 0 violations).
   - Inspect AST checks to confirm:
     - No hardcoded golden-patch helper names (`syncAcceptedCredentials`, `loadCredentials`, `loadManagementPanel`).
     - TypeScript expression unwrapping (`AsExpression`, `SatisfiesExpression`, `ParenthesizedExpression`, `TypeAssertion`) via an `unwrap` helper.
     - Variable indirection resolution (`VariableDeclaration` lookup when an identifier is passed to an API call).
     - Cross-file helper/wrapper function tracing (`CallExpression` resolution across imported modules).
4. **Run the Held-Out 4th Solution Stress Test**:
   - Construct or apply a held-out 4th solution patch against `devtools-times` that satisfies every requirement in `expectations.md` using **unseen structural patterns**:
     - Completely renamed functions (`reconcilePasskeyVault`, `revokePasskeyItem`, `notifyUnknownPasskey`).
     - Options passed via an intermediate variable with a TypeScript type assertion (`const payload = { rpId, userId, allAcceptedCredentialIds }; await PublicKeyCredential.signalAllAcceptedCredentials(payload as any)`).
     - Cross-file wrapper helper (`Component.tsx` calls `syncVault(userId, ids)` in `src/utils/passkey-client.ts`, which calls `PublicKeyCredential.signalAllAcceptedCredentials`).
     - Promise `.catch()` error handling instead of `try { ... } catch`.
   - Grade the held-out 4th solution using `runPlaywright`:
     - Verify the **NEW `grader.ts` scores 100% (all tests passing)** on the held-out 4th solution.

---

### Experiment B2: Vacuous Guards & Conditional Expectation Canaries

Regenerate `targets/devtools-times/grader.ts` on these two canaries:

| Canary Guide | Historical Failure Mode Tested | Pass Criteria |
| :--- | :--- | :--- |
| `guides/built-in-ai/translator` (`devtools-times`) | **Vacuous Boolean Expect (`no-vacuous-boolean-expect`)**: Previously generated `if (allSourceFiles.length === 0) { expect(false).toBe(true); return; }`. | Uses direct `expect(files.length).toBeGreaterThan(0)` before asserting on AST nodes; 0 violations on `src/authoring/check.ts`; 100% golden / 0% zero-passrate calibration. |
| `guides/security/local-network-access` (`devtools-times`) | **Vacuous Conditional Bypass**: `expectations.md` has a conditional requirement (`If the implementation uses <iframe>...`), and `codex-solution.patch` has 0 iframes (`totalIframes === 0`). Previously generated `hasLna && (totalIframes === 0 \|\| iframesWithAllow > 0)`. | Either omits the untestable conditional iframe check or tests unconditional requirements cleanly without `items.length === 0 \|\| ...`, `if (items.length > 0)`, or `test.skip()`; 0 violations on `src/authoring/check.ts`; 100% golden / 0% zero-passrate calibration. |

---

### Step 3: Cleanup Scratch Worktree

Once all experiments pass and artifacts are inspected:

```bash
git worktree remove --force .worktrees/canary-eval
git branch -D exp/canary-eval
```

---

## 3. Known Architectural Traps & Invariants

Keep these empirical lessons in mind whenever editing `src/authoring/dev-prompts.ts` or `src/grading/generate-grader.ts`:

1. **Gen 1 vs. Gen 2 Browser E2E Trap (`buildTargetGraderPrompt` Section 2)**:
   - In Gen 1 (`demo.html`), a single self-contained HTML file was graded, so Playwright E2E DOM checks were cheap and unambiguous.
   - In Gen 2 (`daily-grind`, `devtools-times`), `task.md` is a high-level user prompt that **never** prescribes page routes, mock REST API URLs/schemas, or button selectors.
   - If `buildTargetGraderPrompt` encourages Browser E2E tests for general interactive behavior, the grader agent inspects the 3 golden patches and writes brittle union locators (`page.goto('/settings')`, `page.locator('#add-passkey-btn, .revoke-btn')`, `page.route('**/api/passkeys/**')`). This fails on any 4th agent implementation that chooses a different URL or selector, and breaks inside the offline evaluation sandbox if a patch imports an uncached runtime package during `astro build`.
   - **Invariant**: Always keep **Static Analysis First** and **Browser Checks Only When Strictly Necessary**, and explicitly forbid Browser E2E tests that depend on newly invented routes, custom API endpoints, or patch-specific DOM selectors.
2. **Linux `MAX_ARG_STRLEN` (`spawn E2BIG`) on Grader Retries**:
   - `runAgent` passes the prompt as a CLI argument (`-p <prompt>`) to `agy` / `jetski`. Linux enforces a per-argument limit (`MAX_ARG_STRLEN` = 128 KB).
   - If a Playwright calibration run fails during a verbose Vite/Astro build or dumps long stack traces across 4 patches, an untruncated `failureContext` will exceed 128 KB and crash the retry loop with `spawn E2BIG`.
   - **Invariant**: Always cap `failureContext` in `buildTargetGraderPrompt` (`MAX_FAILURE_CONTEXT_CHARS = 16_000`).
3. **Staged `grader.ts` on Calibration Retries**:
   - Each calibration attempt in `generateTargetGrader` creates a fresh `workDir`.
   - **Invariant**: When `failureContext` is present (retry attempt > 1) and `existingGrader` exists on disk, always copy `existingGrader` into `workDir` before invoking `runAgent` so the agent can inspect and surgically fix its previous attempt instead of rewriting from scratch.
