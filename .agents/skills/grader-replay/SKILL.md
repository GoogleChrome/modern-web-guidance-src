---
name: grader-replay
description: >-
  Validates changes to graders, grading fixtures, and CSS/DOM/AST helpers by
  replaying saved agent solutions from historical eval suites and triaging
  before/after diffs. Use when modifying grader.ts, test-fixture.ts,
  run-grader.ts, or parser helpers used by graders. Don't use for debugging
  low guided pass rates in live evals (use eval-investigation), flagging
  nightly suites (nightly-eval-investigation), or validating gd dev prompt
  generation (dev-prompt-canary).
---

# Historical Eval Replay for Grader Changes

Golden calibration (`gd dev <guide> --test-grader`) only tests three locked solution patches and `zero-passrate.patch`. Historical eval runs contain diverse, imperfect agent implementations that expose broken assumptions, parser edge cases, and false positives.

Because replay applies today's graders against yesterday's saved outputs, before/after mismatches are expected — treat them as signals to triage, not an automatic pass/fail gate.

## 1. Run Calibration First

Run the repo's golden + zero-passrate calibration on each modified guide:

```bash
gd dev <guide> --test-grader
```

Never run `gd dev` without `--test-grader` during validation, or write mode may overwrite manual `grader.ts` edits.

## 2. Pull Suites (if Missing or Stale) & Replay

[`scripts/replay.ts`](scripts/replay.ts) checks `results/suites/` and `~/guidance-evals/` and picks the newest `nightly-*` suite per configured agent using `suite_config.json`.

If local suites are missing or drifted behind current base apps, pull recent nightlies while skipping trace archives and screenshots:

```bash
gcloud storage ls gs://guidance-evals/
gcloud storage rsync gs://guidance-evals/<suite_id> ~/guidance-evals/<suite_id> \
  --recursive --exclude ".*\.zip$|.*\.png$"
```

Then run [`scripts/replay.ts`](scripts/replay.ts):

```bash
# Auto-scope to target graders changed against origin/main
node .agents/skills/grader-replay/scripts/replay.ts

# Scope to specific guides or target keys
node .agents/skills/grader-replay/scripts/replay.ts --guides css-layout,menu

# Replay all tasks (required when modifying test-fixture.ts, run-grader.ts, or parser deps)
node .agents/skills/grader-replay/scripts/replay.ts --all --concurrency 6

# Pin specific suites, cap runs, or emit JSON
node .agents/skills/grader-replay/scripts/replay.ts \
  --suites nightly-2026-11-02_03-04-27-codex_cli,nightly-2026-10-31_23-00-02-antigravity_cli \
  --limit 12 \
  --json
```

**Why never run `grade.mjs` inside a suite folder?** Saved `grade.mjs` files hardcode the original runner's home directory, use an older `runPlaywright` signature, and overwrite the saved `*_results.json` baseline you are comparing against.

**Why stacking matters on Gen 2 targets:** Eval runs apply `zero-passrate.patch` before invoking the agent, so `agent.patch` is diffed on top of `base-apps/<app> + zero-passrate.patch`. `runPlaywright` stacks both patches in a throwaway workspace and throws `PatchApplyError` (reported as `PATCH_CONFLICT`) if either fails to apply, while passing each task's `baselineTarget` (`widely`, `newly`, or `limited`).

## 3. Triage Every `DIFF`, `PATCH_CONFLICT`, or `ERROR`

Inspect the saved `agent.patch` (or `index.html` for Gen 1 tasks), the modified `grader.ts`, and `expectations.md` to classify each mismatch:

- **Real regression (fix required):** Saved `pass -> fail` where the saved output legitimately satisfies `expectations.md`, or an assertion stopped matching valid syntax after a refactor.
- **Intentional grader fix (expected diff):**
  - `pass -> fail` when tightening a check that previously false-passed on unrelated CSS/markup. Confirm in `agent.patch` that the saved solution missed the requirement.
  - `fail -> pass` when loosening an overly brittle check. Confirm in `agent.patch` that the saved solution satisfied `expectations.md` in spirit.
- **Timeout flakiness:** Specs involving `timedOut` (`pass -> timedOut` or `timedOut -> pass`) point to worker contention rather than grader changes — re-run at lower `--concurrency`.
- **Title or structure drift (expected diff):** Spec titles appear as `saved -> <missing>` and `<missing> -> now` because tests were renamed or consolidated on `main`. Check `git log -p -n 3 -- <grader>` and compare pass/fail totals.
- **Base-app drift (`PATCH_CONFLICT`):** An older `agent.patch` fails to apply against current `src/harness/base-apps/` or `zero-passrate.patch`. Not a grader bug — re-run against a newer nightly suite from GCS.

If you edit a `grader.ts` after triaging, re-run `gd dev <guide> --test-grader` and `scripts/replay.ts`, then finish with `pnpm run preflight`.

## Related Skills

- [`project-evals`](../project-evals/SKILL.md) — rules for writing and reviewing `expectations.md`, `task.md`, and `grader.ts`.
- [`dev-prompt-canary`](../dev-prompt-canary/SKILL.md) — empirical validation for edits to `gd dev` prompts and grader generation templates.
- [`nightly-eval-investigation`](../nightly-eval-investigation/SKILL.md) — triaging low-performing tasks across nightly suites in GCS.
