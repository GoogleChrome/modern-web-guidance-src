# Analyzer Lexicon

The canonical domain language for the Modern Web Guidance Analyzer (`src/analyzing`) and the conceptual boundaries those terms represent.

## Pipeline Steps

### Guide Triage

Single-shot LLM classification of a published feature guide (`guide.md` plus upstream explainer context) into `detectable`, `ui-recipe-multi-part`, or `skip-no-old-way` before any rule is written. Not to be confused with **LLM Verifier** or **Eval Judge**, which evaluate code findings rather than guides.

* _Reference_: `src/analyzing/gate0.ts#classifyGuideGate0`
* _Avoid_: `Gate 0`, `Stage 0`

### Static Matcher

Fast, deterministic CPU scan (JavaScript/TypeScript AST via `ts-morph`, HTML/JSX DOM via `linkedom`, CSS via `cssomnom`, or `package.json` dependencies) that emits candidate findings with an enclosing code slice. Never calls an LLM.

* _Reference_: `src/analyzing/scanners/index.ts#scanRepoFiles`
* _Avoid_: `Phase 1`, `Stage 2`, `Detector`

### LLM Verifier

Runtime LLM filter (`gemini-3.8-flash`) that reads a **Static Matcher** candidate finding, `guide.md`, and the rule's `keepWhen`/`dropWhen` rubric to decide `keep` vs `drop` before reporting findings. Not to be confused with **Eval Judge**, which is an offline evaluation rater that never sees the rule's `keepWhen`/`dropWhen` rubric.

* _Reference_: `src/analyzing/phase2.ts#runPhase2Filter`
* _Avoid_: `Phase 2`, `Phase 2 Filter`, `Stage 3`

### Eval Judge

Offline evaluation LLM (`3`-pass majority vote) that grades blind finding cards (`right`, `not-old-pattern`, `leave-it`, `guide-wrong`, `unsure`) using only `guide.md` and upstream explainer context (never the rule's rubric) to estimate precision at scale. Never invoked during user-facing CLI runs.

* _Reference_: `src/analyzing/judge.ts#judgeBlindCardsDirect`
* _Avoid_: `Detective`, `Phase 2 Judge`

### Fix Smoke Test

Offline evaluation harness that asks an LLM to modernize a flagged code window using `guide.md` and checks three static invariants: (1) legacy finding eliminated, (2) modern syntax present and parses cleanly without gutting exports, and (3) seeded bad patches rejected.

* _Reference_: `src/analyzing/fix-harness.ts#evaluateAgentFix`
* _Avoid_: `Milestone 4`, `Gate 1 / Gate 2 / Gate 3`

## Corpus Splits

### `rule-writing` split

Repositories (`115` local repositories in `analyzer-internal/repos.json` where `split === "rule-writing"` plus the `rule-writing` half of GitMirror) that engineers and agents may freely inspect to discover legacy patterns, author rules, and debug matchers.

* _Reference_: `analyzer-internal/repos.json`
* _Avoid_: `build` split, `dev` split

### `grading-only` split

The `93` local repositories (`analyzer-internal/repos.json` where `split === "grading-only"`) used for iterative precision and recall measurement. Never inspected when authoring or debugging rules, but evaluated across iterations.

* _Reference_: `analyzer-internal/repos.json`
* _Avoid_: `tune` split, `local-93`

### `held-out` split

The `2,336` GitMirror repositories (`2,713` files in `~/.cache/analyzer-gitmirror/grading-only`) reserved for untuned out-of-sample precision measurement.

* _Reference_: `analyzer-internal/scripts/sample-gitmirror.ts`
* _Avoid_: `final` split, `gitmirror-grading-only`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` (`30` guides / `41` rules) available behind `--experimental` (`--all-rules`) that has not yet cleared the default shipping precision bar (`wilson95.lower >= 0.90` at $n \ge 35$).

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` shipped by default in `npx modern-web-guidance analyze` after clearing `wilson95.lower >= 0.90` at $n \ge 35$ on held-out evaluation.

* _Reference_: `src/analyzing/rules/index.ts#QUALIFIED_GUIDE_IDS`
* _Avoid_: `Default Rule`, `Tier 1 Rule`

### Retired Guide

A guide for which a rule was prototyped and subsequently removed from `ALL_RULES` (`shadow-dom`, `accessible-error-announcement`, `stack-drill-down`, `model-partial-time-concepts`, `custom-select-picker-layouts`) because **Guide Triage** / human review determined it is a multi-part UI recipe, has no legacy equivalent, or has zero wild prevalence. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding.

* _Reference_: `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
