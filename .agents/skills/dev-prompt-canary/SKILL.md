---
name: dev-prompt-canary
description: >
  Empirically validates changes to `gd dev` authoring and grading prompts (`src/authoring/dev-prompts.ts`,
  `src/authoring/dev.ts`, `src/grading/generate-grader.ts`, `src/grading/template.grader.ts`) by running
  fast incremental `task.md` and `grader.ts` canary regenerations and a held-out 4th solution stress test
  in an isolated worktree. Use whenever modifying prompts or generation logic in the `gd dev` pipeline.
---

# `gd dev` Prompt Canary Validation

Unit tests in [`src/authoring/dev-prompts.test.ts`](../../../src/authoring/dev-prompts.test.ts) only verify substring presence in prompt templates—they cannot catch behavioral regressions in what the LLM actually generates.

Whenever you modify [`src/authoring/dev-prompts.ts`](../../../src/authoring/dev-prompts.ts), [`src/authoring/dev.ts`](../../../src/authoring/dev.ts), [`src/grading/generate-grader.ts`](../../../src/grading/generate-grader.ts), or [`src/grading/template.grader.ts`](../../../src/grading/template.grader.ts), run this fast empirical canary workflow to verify that generated `task.md` and `grader.ts` files obey the rules in [`project-evals`](../project-evals/SKILL.md).

---

## 1. Incremental Regeneration Mechanics (~4 Minutes Total)

Running `gd dev <guide>` from scratch takes ~25 minutes per guide because it generates 3 golden solution patches, a `zero-passrate.patch`, `task.md`, `grader.ts`, and runs full evaluations.

Instead, use [`dev.ts`](../../../src/authoring/dev.ts)'s incremental file-existence checks inside a throwaway worktree:
- **`task.md` Only (~45s for 8 targets)**: Keep existing patches and graders untouched. Call `extractGuideDescription` + `buildTargetTaskPrompt` + `runAgent` in a small runner script (or delete only `targets/<app>/task.md` and run `devGuide(dir, { test: false, targets: [app] })`).
- **`grader.ts` Only (~2–3 mins per target)**: Keep `targets/<app>/patches/*-solution.patch`, `zero-passrate.patch`, and `task.md` untouched. Delete **only** `targets/<app>/grader.ts`, then run `devGuide(dir, { test: false, targets: [app] })` to regenerate and calibrate `grader.ts`.

---

## 2. Execution Workflow

### Step 1: Create an Isolated Scratch Worktree

Never mutate `guides/` inside your active feature worktree. Branch a temporary worktree off your candidate commit:

```bash
git worktree add -B exp/canary-eval .worktrees/canary-eval HEAD
ln -s ../../node_modules .worktrees/canary-eval/node_modules
ln -s ../../.env .worktrees/canary-eval/.env
```

### Step 2: Run Parallel Canary Subagents (`Model: "flash"`)

Launch 3 parallel subagents in `.worktrees/canary-eval` covering the canary targets below.

#### Experiment A: `task.md` Regeneration Matrix (4 Guides × 2 Apps)
Regenerate `task.md` across `daily-grind` and `devtools-times` and diff **OLD vs. NEW** against the `task.md` rules in [`project-evals`](../project-evals/SKILL.md):
1. `guides/ui-behaviors/directional-navigation-transitions` — tests that secondary `expectations.md` requirements (`prefers-reduced-motion`) do not leak.
2. `guides/built-in-ai/translator` — tests that the on-device capability boundary from `guide.md`'s frontmatter `description` is preserved without naming `window.Translator`.
3. `guides/html/html` — discipline guide canary; tests that specific `expectations.md` checklist items (`autofill`, `srcset`, `fetchpriority`) are not leaked.
4. `guides/security/passkey-management` — tests that WebAuthn Signal API method names (`signalAllAcceptedCredentials`, `signalUnknownCredential`) are not dictated.

#### Experiment B1: `grader.ts` Regeneration + Held-Out 4th Solution Stress Test
**Canary**: `guides/security/passkey-management` (`devtools-times`)

Passing calibration only proves `grader.ts` passes the 3 golden patches (`claude`, `codex`, `jetski`) that the grader agent had open on disk while authoring the test. To prove it generalizes to unseen agent implementations:
1. Delete `guides/security/passkey-management/targets/devtools-times/grader.ts` and run `devGuide('guides/security/passkey-management', { test: false, targets: ['devtools-times'] })`.
2. Confirm calibration passes (`claude=100%`, `codex=100%`, `jetski=100%`, `zero-passrate=0%`) and static AST linting (`src/core/grader-lint.ts`) reports 0 violations.
3. Run `runPlaywright` with the newly generated `grader.ts` against a **held-out 4th solution patch** on `devtools-times` that satisfies all `expectations.md` requirements using structural variations not present in the 3 golden patches:
   - Unseen helper/handler function names (`reconcilePasskeyVault`, `revokePasskeyItem`)
   - Options passed via local variables with TypeScript type assertions (`payload as any`, `satisfies`)
   - Cross-file helper wrapper functions (`Component.tsx -> passkey-client.ts -> webauthn-signals.ts`)
   - Promise `.catch()` error handling instead of `try/catch`
4. Require **100% pass rate** on the held-out 4th solution patch.

#### Experiment B2: Vacuous Guard & Conditional Expectation Canaries
Delete `targets/devtools-times/grader.ts` and run `devGuide(dir, { test: false, targets: ['devtools-times'] })` on:
1. `guides/built-in-ai/translator` (`devtools-times`) — verifies elimination of `if (files.length === 0) { expect(false).toBe(true); return; }`.
2. `guides/security/local-network-access` (`devtools-times`) — has a conditional `<iframe>` expectation where `codex-solution.patch` has 0 iframes (`totalIframes === 0`); verifies the grader omits untestable conditional checks rather than writing vacuous `items.length === 0 || ...` guards.

### Step 3: Cleanup Scratch Worktree

```bash
git worktree remove --force .worktrees/canary-eval
git branch -D exp/canary-eval
```
