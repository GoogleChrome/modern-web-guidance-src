# Analyzer Lexicon

The canonical domain language for the Modern Web Guidance Analyzer (`src/analyzing`) and the conceptual boundaries those terms represent.

## Pipeline Steps

### Guide Triage

Single-shot LLM classification of a published feature guide (`guide.md` plus upstream explainer context) into `detectable`, `ui-recipe-multi-part`, or `skip-no-old-way` before any rule is written. Not to be confused with **LLM Verifier** or **Eval Judge**, which evaluate code findings rather than guides.

* _Reference_: `src/analyzing/gate0.ts#classifyGuideGate0`
* _Avoid_: `Gate 0`, `Stage 0`

### Legacy Pattern Spec

Explicit specification per detectable guide defining **`replaces`** (the concrete 1-to-1 legacy APIs, CSS workarounds, or npm packages the guide's modern feature replaces) and **`doesNotReplace`** (lookalike patterns that are out of scope for the modern feature). Verified before authoring a **Static Matcher** so that rule authors, the **LLM Verifier**, and the **Eval Judge** share a single ground-truth scope boundary.

* _Reference_: `analyzer-internal/findings/2026-10-19-legacy-pattern-specs.md`
* _Avoid_: `Brownfield Rubric`, `Candidate Techniques`

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

Repositories (`208` local repositories in `analyzer-internal/repos.json` plus `7,048` files across `5,320` repositories in `~/.cache/analyzer-gitmirror/rule-writing/`, `MOD(ABS(FARM_FINGERPRINT(repository)), 2) = 0`) that engineers and agents freely inspect to discover legacy patterns, author rules, and debug matchers.

* _Reference_: `analyzer-internal/repos.json`, `analyzer-internal/scripts/sample-gitmirror.ts`
* _Avoid_: `build` split, `dev` split

### `held-out` split

Repositories (`7,137` files across `5,258` repositories in `~/.cache/analyzer-gitmirror/held-out/`, `MOD(ABS(FARM_FINGERPRINT(repository)), 2) = 1`) reserved strictly for precision and recall evaluation (`scorecard.ts`). Never inspected when authoring or debugging rules, ensuring zero tuning leakage.

* _Reference_: `analyzer-internal/scripts/sample-gitmirror.ts`
* _Avoid_: `grading-only` split, `tune` split, `final` split, `local-93`, `gitmirror-grading-only`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` (`36` guides / `50` rules) available behind `--experimental` (`--all-rules`) that has not yet cleared the default shipping precision bar (`wilson95.lower >= 0.90` at $n \ge 35$).

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` shipped by default in `npx modern-web-guidance analyze` after clearing `wilson95.lower >= 0.90` at $n \ge 35$ on held-out evaluation.

* _Reference_: `src/analyzing/rules/index.ts#QUALIFIED_GUIDE_IDS`
* _Avoid_: `Default Rule`, `Tier 1 Rule`

### Retired Guide

A guide for which a rule was prototyped and subsequently removed from `ALL_RULES` (`shadow-dom`, `accessible-error-announcement`, `stack-drill-down`, `detect-initial-visibility-state`, `model-partial-time-concepts`, `custom-select-picker-layouts`) because **Guide Triage**, **Legacy Pattern Spec**, or human review determined it is a multi-part UI recipe, has no 1-to-1 legacy equivalent, or mismatched the guide's actual feature. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding.

* _Reference_: `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
