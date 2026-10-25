# Analyzer Lexicon

The canonical domain language for the Modern Web Guidance Analyzer (`src/analyzing`) and the conceptual boundaries those terms represent.

## Workflows & CLI Commands

### Modernize

The people-facing name for the end-to-end workflow of finding legacy web platform code in an existing project and changing it to modern platform standards across three steps: **Detection** (via `analyze`), **Verification** (reviewing findings against `verifierRubric`), and **Update** (retrieving `guide.md`, updating the code, and verifying the result). Distinct from **`analyze`**, which is the detection step only.

* _Reference_: `guides/modern-web-guidance/SKILL.md#step-3-modernize-existing-code-analyze`, `src/analyzing/README.md#2-modernize-workflow-d-013`
* _Avoid_: `Modern Web Refactor`, `Refactor` (as a feature or workflow name), `Uplift`, `Modern Web Uplift`

### `analyze`

The CLI subcommand (`modern-web-guidance analyze`) that scans a codebase for legacy web platform patterns matching qualified or experimental rules. It performs the detection step only and stops there; the AI coding agent and developer carry out the verification and update steps of the **Modernize** workflow.

* _Reference_: `src/analyzing/cli.ts#runAnalyzeCli`, `guides/modern-web-guidance/SKILL.md#step-3-modernize-existing-code-analyze`
* _Avoid_: `modern-web-guidance refactor`, `modern-web-guidance uplift`, `scan` (as a CLI command name)

## Pipeline Steps

### Guide Triage

Upfront classification and scoping of a published feature guide (`guideId`) before any **Static Matcher** is authored. Defines **`replaces`** (the concrete legacy APIs, CSS workarounds, DOM idioms, or npm packages the guide's modern feature replaces), **`doesNotReplace`** (lookalike patterns that are out of scope), and scores the guide's cleanest legacy **Sub-Pattern** on two orthogonal axes: **`Detection`** (`'direct-token' | 'structural-ast' | 'needs-verifier' | 'no-legacy-pattern'`) and **`Update Scope`** (`'local-swap' | 'cross-layer-refactor' | 'widget-recipe' | 'n/a'`). The authoritative definitions of each `Detection` and `UpdateScope` value live on the TypeScript types in `src/analyzing/schema.ts`.

* _Reference_: `src/analyzing/schema.ts#Detection`, `src/analyzing/schema.ts#UpdateScope`, `src/analyzing/schema.ts#GuideTriage`, `src/analyzing/guide-triage.ts#triageGuide`
* _Avoid_: `DetectionKind`, `Gate 0`, `Stage 0`, `Legacy Pattern Spec`, `Rewrite Scope`, `Brownfield Rubric`, `Candidate Techniques`, `clean-1-to-1`, `needs-care`, `ui-recipe-multi-part`, `skip-no-old-way`

### Static Matcher

Fast, deterministic CPU scan (JavaScript/TypeScript AST via `ts-morph`, HTML/JSX DOM via `linkedom`, CSS via `cssomnom`, or `package.json` dependencies) that emits candidate findings with an enclosing `contextSlice`. Never calls an LLM.

* _Reference_: `src/analyzing/scanners/index.ts#scanRepoFiles`
* _Avoid_: `Phase 1`, `Stage 2`, `Detector`

### LLM Verifier

Runtime LLM filter (`gemini-3.8-flash`) that reads a **Static Matcher** candidate finding, `guide.md`, and the rule's `verifierRubric` (`keepWhen`/`dropWhen`) to decide `keep` vs `drop` before reporting findings. Not to be confused with **Detection Eval Judge**, which is an offline evaluation rater that never sees the rule's `verifierRubric`.

* _Reference_: `src/analyzing/llm-verifier.ts#runLlmVerifier`, `src/analyzing/schema.ts#VerifierRubric`
* _Avoid_: `Phase 2`, `Phase 2 Filter`, `Stage 3`, `phase2Rubric`

### Detection Eval (`Detection Eval Judge`)

Offline evaluation pass that grades **Blind Card** findings on the **`held-out` split** to measure whether detected code is a valid modernization target. The **Detection Eval Judge** (`3`-pass majority vote LLM) grades each card into the 7 canonical `JudgeVerdict` values (`legit-modernize-target`, `not-old-pattern`, `fallback-or-guard`, `loses-behavior`, `no-payoff`, `guide-wrong`, `unsure`) using only `guide.md` and upstream explainer context (never the rule's `verifierRubric`). Never invoked during user-facing CLI runs.

* _Reference_: `src/analyzing/detection-eval.ts#JudgeVerdict`, `src/analyzing/detection-eval.ts#runJudgeDirect`
* _Avoid_: `Detective`, `Phase 2 Judge`, `Eval Judge` (unscoped)

### Update Eval

Offline evaluation pass that gives an LLM a flagged code window and `guide.md`, asks it to update the code to the modern standard, and verifies three static invariants: (1) legacy finding eliminated, (2) modern syntax present and parses cleanly without gutting exports, and (3) seeded broken updates rejected. Pairs with **Detection Eval** to cover both ends of the **Modernize** workflow.

* _Reference_: `src/analyzing/update-eval.ts#evaluateAgentUpdate`
* _Avoid_: `Fix Smoke Test`, `Fix Harness`, `Milestone 4`, `Gate 1 / Gate 2 / Gate 3`

## Detection Hierarchy

### Guide (`guideId`)

A published feature guide in `guides/<guideId>/guide.md` representing one modern web platform capability.

* _Reference_: `guides/modern-web-guidance/SKILL.md#step-1-learn-what-the-guide-teaches`
* _Avoid_: `Feature`, `Article`, `Standard`

### Rule (`ruleId`)

A **Static Matcher** entry (`AnalyzerRule`) targeting a specific language or scanner layer (JS/TS AST, CSS, HTML/JSX DOM, or `package.json`) for a given `guideId`. A single guide may have multiple rules across layers (e.g., a `package.json` dependency rule plus a JS AST rule).

* _Reference_: `src/analyzing/schema.ts#AnalyzerRule`, `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Detector`, `Check`, `Linter Rule`

### Sub-Pattern (`subPattern`)

A distinct syntactic or payoff variant within a single `Rule` (for example, individual transform function variants in `individual-transform-properties.ts`). A **Deferred Sub-Pattern** (`ITP_DEFERRED_SUB_PATTERNS`) is a sub-pattern held back from default execution because its precision or payoff profile differs from the rule's active sub-patterns.

* _Reference_: `src/analyzing/rules/individual-transform-properties.ts#ITP_DEFERRED_SUB_PATTERNS`
* _Avoid_: `Sub-Rule`, `Rule Variant`, `Branch`

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

An evaluation finding packaged for unbiased grading (enclosing `contextSlice`, file location, and guide context), presented to human raters and the **Detection Eval Judge** stripped of rule rubrics, author commentary, and prior labels.

* _Reference_: `src/analyzing/detection-eval.ts#BlindCardPayload`, `src/analyzing/prompts.ts#formatBlindCardPrompt`
* _Avoid_: `Test Case`, `Evaluation Finding`

### Grading Deck

A curated or sampled collection of **Blind Cards** packaged together for human spot-checking, judge benchmarking, or calibration. Grading decks are stored as JSON in `analyzer-internal/labels/` and graded blind without showing rule rubrics or prior labels.

* _Reference_: `analyzer-internal/labels/`, `analyzer-internal/ui/`
* _Avoid_: `Evaluation Suite`, `Test Deck`, `Test Suite`, `Calibration Deck`, `FP Check Deck`, `Gate 0 Deck`

### Blind Replication

Independent authoring of a **Static Matcher** from `guide.md` and upstream explainers alone without inspecting existing rule code, used to discover author blind spots and benchmark recall overlap on **`held-out` split** code.

* _Reference_: `analyzer-internal/DECISIONS.md#d-040`, `analyzer-internal/DECISIONS.md#d-047`
* _Avoid_: `Dual Coding`, `Parallel Implementation`

### Precision

The proportion of evaluated findings graded `legit-modernize-target` ($\text{legit-modernize-target} / n$), measuring whether applying the guide to the flagged code is a genuine win.

* _Reference_: `src/analyzing/qualification.ts`
* _Avoid_: `Strict Precision`, `Raw Precision`, `Detector Accuracy`

### Matcher Misfire Rate

The proportion of evaluated findings graded `not-old-pattern` ($\text{not-old-pattern} / n$), measuring how often a **Static Matcher** fires on code that is not attempting the legacy pattern. Its complement ($1 - \text{Matcher Misfire Rate}$, or **Non-Misfire Rate**) is used only when plotting alongside **Precision** on a `0–100%` chart axis.

* _Reference_: `analyzer-internal/DECISIONS.md#d-048`, `src/analyzing/qualification.ts`
* _Avoid_: `False Positive Rate`, `Error Rate`, `Non-Misfire Rate (as an evaluation metric)`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` available behind `--experimental` (`--all-rules`) that has not yet cleared the qualification criteria for default shipping.

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`, `PILOT_RULES`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` (`QUALIFIED_RULES`) shipped by default in `npx modern-web-guidance analyze` after clearing one of the project's three **Qualification Tiers** (`Tier A`, `Tier B`, or `Tier C` defined on `QualificationTier` in `src/analyzing/qualification.ts`).

* _Reference_: `src/analyzing/qualification.ts#QUALIFIED_GUIDE_IDS`, `src/analyzing/qualification.ts#QualificationTier`, `src/analyzing/rules/index.ts#QUALIFIED_RULES`
* _Avoid_: `Default Rule`, `Tier 1 Rule`, `Graduated Rule`, `TERMINAL_QUALIFIED_RULES`, `JSON_QUALIFIED_RULES`

### Suspended Rule

A previously qualified rule in `SUSPENDED_QUALIFIED_GUIDE_IDS` whose default shipping was temporarily halted pending evaluation-harness remediation or fresh **`held-out` split** re-verification. Distinct from an **Experimental Rule** (never qualified) and a **Retired Guide** (permanently removed from active scanning).

* _Reference_: `src/analyzing/qualification.ts#SUSPENDED_QUALIFIED_GUIDE_IDS`
* _Avoid_: `Quarantined Rule`, `Disabled Rule`

### Unwired Module

A rule module in `src/analyzing/rules/*.ts` with unit tests on disk that is not yet imported into `src/analyzing/rules/index.ts`. Distinct from a registered **Experimental Rule** or **Qualified Rule**.

* _Reference_: `analyzer-internal/scripts/rule-inventory.ts`
* _Avoid_: `Orphaned Rule`, `Unreferenced File`

### Retired Guide

A guide for which a rule was prototyped and subsequently removed or emptied from `ALL_RULES` because **Guide Triage** or human review determined it has `no-legacy-pattern` or mismatched the guide's actual feature. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding, or a **Suspended Rule**.

* _Reference_: `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
