# Analyzer Lexicon

The canonical domain language for the Modern Web Guidance Analyzer (`src/analyzing`) and the conceptual boundaries those terms represent.

## Workflows & CLI Commands

### Modernize

The people-facing name for the end-to-end workflow of finding legacy web platform code in an existing project and changing it to modern platform standards (detecting legacy patterns via `analyze`, reviewing against verification rubrics, retrieving guidance, applying modern standards, and verifying the result). Distinct from **`analyze`**, which is the detection step only.

* _Reference_: `guides/modern-web-guidance/SKILL.md#step-3-modernize-existing-code-analyze`, `src/analyzing/README.md#2-modernize-workflow-d-013`
* _Avoid_: `Modern Web Refactor`, `Refactor` (as a feature or workflow name), `Uplift`, `Modern Web Uplift`

### `analyze`

The CLI subcommand (`modern-web-guidance analyze`) that scans a codebase for legacy web platform patterns matching qualified or experimental rules. It performs the detection step only and stops there; the AI coding agent and developer carry out the remainder of the **Modernize** workflow.

* _Reference_: `src/analyzing/cli.ts#runAnalyzeCli`, `guides/modern-web-guidance/SKILL.md#step-3-modernize-existing-code-analyze`
* _Avoid_: `modern-web-guidance refactor`, `modern-web-guidance uplift`, `scan` (as a CLI command name)

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

Offline evaluation LLM (`3`-pass majority vote) that grades blind finding cards into the 7 canonical verdicts using only `guide.md` and upstream explainer context (never the rule's rubric) to estimate precision at scale. Never invoked during user-facing CLI runs.
1. `legit-modernize-target`: Genuine legacy pattern where applying the guide is a clean win (the code matches the legacy/"Before" pattern or library workaround replaced by this guide, is not an intentional fallback, covers needed capabilities, and has meaningful payoff).
2. `not-old-pattern`: Matcher misfired — this code isn't even doing the legacy pattern the guide replaces (detector mistake / token collision).
3. `fallback-or-guard`: Intentional progressive-enhancement fallback (`@supports not (...)`), feature-detection guard, ponyfill, or polyfill.
4. `loses-behavior`: Old pattern, but modern feature lacks capabilities used here (custom side effects, order-dependent geometry, incompatible API contract, or unsupported library feature).
5. `no-payoff`: Matches old syntax and modern feature applies, but rewriting here changes nothing meaningful (zero-payoff syntax swap).
6. `guide-wrong`: The guide's advice is bad or overstates what the feature does for this case (the guide itself is wrong to call this pattern a problem).
7. `unsure`: Insufficient context in snippet/file to tell.

* _Reference_: `src/analyzing/judge.ts#judgeBlindCardsDirect`
* _Avoid_: `Detective`, `Phase 2 Judge`

### Fix Smoke Test

Offline evaluation harness that asks an LLM to modernize a flagged code window using `guide.md` and checks three static invariants: (1) legacy finding eliminated, (2) modern syntax present and parses cleanly without gutting exports, and (3) seeded bad patches rejected.

* _Reference_: `src/analyzing/fix-harness.ts#evaluateAgentFix`
* _Avoid_: `Milestone 4`, `Gate 1 / Gate 2 / Gate 3`

## Corpus Splits

### `rule-writing` split

The partition of repositories that engineers and agents freely inspect to discover legacy patterns, author rules, and debug matchers. Distinct from the **`held-out` split**, which is never inspected during rule development.

* _Reference_: `analyzer-internal/repos.json`, `analyzer-internal/scripts/sample-gitmirror.ts`
* _Avoid_: `build` split, `dev` split

### `held-out` split

The partition of repositories reserved strictly for offline precision and recall evaluation. Never inspected when authoring or debugging rules, ensuring zero tuning leakage.

* _Reference_: `analyzer-internal/scripts/sample-gitmirror.ts`
* _Avoid_: `grading-only` split, `tune` split, `final` split, `local-93`, `gitmirror-grading-only`

## Evaluation & Calibration

### Blind Card

An evaluation finding packaged for unbiased grading (enclosing code slice, file location, and guide context), presented to human raters and the **Eval Judge** stripped of rule rubrics, author commentary, and prior labels.

* _Reference_: `src/analyzing/judge.ts#BlindCardPayload`, `src/analyzing/prompts.ts#formatBlindCardPrompt`
* _Avoid_: `Test Case`, `Evaluation Finding`

### Blind Replication

Independent authoring of a **Static Matcher** from `guide.md` and upstream explainers alone without inspecting existing rule code, used to discover author blind spots and benchmark recall overlap on **`held-out` split** code.

* _Reference_: `analyzer-internal/DECISIONS.md#d-040`, `analyzer-internal/DECISIONS.md#d-047`
* _Avoid_: `Dual Coding`, `Parallel Implementation`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` available behind `--experimental` (`--all-rules`) that has not yet cleared the qualification criteria for default shipping.

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` shipped by default in `npx modern-web-guidance analyze` after clearing the project's qualification criteria.

* _Reference_: `src/analyzing/qualification.ts#QUALIFIED_GUIDE_IDS`
* _Avoid_: `Default Rule`, `Tier 1 Rule`, `Graduated Rule`

### Suspended Rule

A previously qualified rule in `SUSPENDED_QUALIFIED_GUIDE_IDS` whose default shipping was temporarily halted pending evaluation-harness remediation or fresh **`held-out` split** re-verification. Distinct from an **Experimental Rule** (never qualified) and a **Retired Guide** (permanently removed from active scanning).

* _Reference_: `src/analyzing/qualification.ts#SUSPENDED_QUALIFIED_GUIDE_IDS`
* _Avoid_: `Quarantined Rule`, `Disabled Rule`

### Retired Guide

A guide for which a rule was prototyped and subsequently removed or emptied from `ALL_RULES` because **Guide Triage**, **Legacy Pattern Spec**, or human review determined it is a multi-part UI recipe, has no 1-to-1 legacy equivalent, or mismatched the guide's actual feature. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding, or a **Suspended Rule**.

* _Reference_: `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
