# Analyzer Lexicon

The canonical domain language for the Modern Web Guidance Analyzer (`src/analyzing`) and the conceptual boundaries those terms represent.

## Workflows & CLI Commands

### Modernize

The people-facing name for the end-to-end workflow of finding legacy web platform code in an existing project and changing it to modern platform standards across three steps: **Detection** (via `analyze`), **Verification** (reviewing findings against `verifierRubric`), and **Update** (retrieving `guide.md`, updating the code, and verifying the result). Distinct from **`analyze`**, which is the detection step only.

* _Reference_: `guides/modern-web-guidance/SKILL.md#modernize-an-existing-codebase`, `src/analyzing/README.md#2-modernize-workflow`
* _Avoid_: `Modern Web Refactor`, `Refactor` (as a feature or workflow name), `Uplift`, `Modern Web Uplift`

### `analyze`

The CLI subcommand (`modern-web-guidance analyze`) that scans a codebase for legacy web platform patterns matching qualified or experimental rules. It performs the detection step only and stops there; the AI coding agent and developer carry out the verification and update steps of the **Modernize** workflow.

* _Reference_: `src/analyzing/cli.ts#runAnalyzeCli`, `guides/modern-web-guidance/SKILL.md#modernize-an-existing-codebase`
* _Avoid_: `modern-web-guidance refactor`, `modern-web-guidance uplift`, `scan` (as a CLI command name)

## Pipeline Steps

### Guide Triage

Upfront classification and scoping of a published feature guide (`guideId`) before any **Static Matcher** is authored. Defines **`replaces`** (the concrete legacy APIs, CSS workarounds, DOM idioms, or npm packages the guide's modern feature replaces), **`doesNotReplace`** (lookalike patterns that are out of scope), and scores the guide's cleanest legacy **Sub-Pattern** on two orthogonal axes: **`Detection`** (`'direct-token' | 'structural-ast' | 'needs-verifier' | 'no-legacy-pattern'`) and **`Update Scope`** (`'local-swap' | 'cross-layer-refactor' | 'widget-recipe' | 'n/a'`). The authoritative definitions of each `Detection` and `UpdateScope` value live on the TypeScript types in `src/analyzing/schema.ts`.

* _Reference_: `src/analyzing/schema.ts#Detection`, `src/analyzing/schema.ts#UpdateScope`, `src/analyzing/schema.ts#GuideTriage`, `src/analyzing/eval/guide-triage.ts#triageGuide`
* _Avoid_: `DetectionKind`, `Gate 0`, `Stage 0`, `Legacy Pattern Spec`, `Rewrite Scope`, `Brownfield Rubric`, `Candidate Techniques`, `clean-1-to-1`, `needs-care`, `ui-recipe-multi-part`, `skip-no-old-way`

### Static Matcher

Fast, deterministic CPU scan (JavaScript/TypeScript AST via `ts-morph`, HTML/JSX DOM via `linkedom`, CSS via `cssomnom`, or `package.json` dependencies) that emits candidate findings with an enclosing `contextSlice`. Never calls an LLM.

* _Reference_: `src/analyzing/scanners/index.ts#scanRepoFiles`
* _Avoid_: `Phase 1`, `Stage 2`, `Detector`

### LLM Verifier

Runtime LLM filter that reads a **Static Matcher** candidate finding, `guide.md`, and the rule's `verifierRubric` (`keepWhen`/`dropWhen`) to decide `keep` vs `drop` before reporting findings. Not to be confused with **Detection Eval Judge**, which is an offline evaluation rater that never sees the rule's `verifierRubric`.

* _Reference_: `src/analyzing/llm-verifier.ts#runLlmVerifier`, `src/analyzing/schema.ts#VerifierRubric`
* _Avoid_: `Phase 2`, `Phase 2 Filter`, `Stage 3`, `phase2Rubric`

### Detection Eval (`Detection Eval Judge`)

Offline evaluation pass that grades **Blind Card** findings on the **`held-out` split** to measure whether detected code is a valid modernization target. The **Detection Eval Judge** (an offline LLM evaluator) grades each card into the 7 canonical `JudgeVerdict` values (`legit-modernize-target`, `not-old-pattern`, `fallback-or-guard`, `loses-behavior`, `no-payoff`, `guide-wrong`, `unsure`) using only `guide.md` and upstream explainer context (never the rule's `verifierRubric`). Never invoked during user-facing CLI runs.

* _Reference_: `src/analyzing/eval/detection-eval.ts#JudgeVerdict`, `src/analyzing/eval/detection-eval.ts#runJudgeDirect`
* _Avoid_: `Detective`, `Phase 2 Judge`, `Eval Judge` (unscoped)

## Detection Hierarchy

### Guide (`guideId`)

A published feature guide in `guides/<guideId>/guide.md` representing one modern web platform capability.

* _Reference_: `guides/modern-web-guidance/SKILL.md#step-2-retrieve-best-practices`
* _Avoid_: `Feature`, `Article`, `Standard`

### Rule (`ruleId`)

A **Static Matcher** entry (`AnalyzerRule`) targeting a specific language or scanner layer (JS/TS AST, CSS, HTML/JSX DOM, or `package.json`) for a given `guideId`. A single guide may have multiple rules across layers (e.g., a `package.json` dependency rule plus a JS AST rule).

* _Reference_: `src/analyzing/schema.ts#AnalyzerRule`, `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Detector`, `Check`, `Linter Rule`

### Sub-Pattern (`subPattern`)

A distinct syntactic or payoff variant within a single **Rule**. A **Deferred Sub-Pattern** is a sub-pattern held back from default execution because its precision or payoff profile differs from the rule's active sub-patterns.

* _Reference_: `src/analyzing/rules/individual-transform-properties.ts#ITP_DEFERRED_SUB_PATTERNS`
* _Avoid_: `Sub-Rule`, `Rule Variant`, `Branch`

## Corpus Splits

### `rule-writing` split

The partition of repositories that engineers and agents inspect to discover legacy patterns, author rules, and debug matchers. Kept distinct from the **`held-out` split** to prevent tuning matchers directly against the evaluation sample. The split spans local corpus repos and sampled public repos.

* _Reference_: `src/analyzing/README.md#2-split-corpus-architecture-rule-writing-vs-held-out`
* _Avoid_: `build` split, `dev` split

### `held-out` split

The partition of repositories reserved strictly for offline precision and recall evaluation. Kept separate from repositories used during rule authoring and debugging so performance reflects out-of-sample code. The split spans local corpus repos and sampled public repos.

* _Reference_: `src/analyzing/rules/index.ts`, `src/analyzing/README.md#2-split-corpus-architecture-rule-writing-vs-held-out`
* _Avoid_: `grading-only` split, `tune` split, `final` split, `local-93`

## Evaluation & Calibration

### Blind Card

An evaluation finding packaged for unbiased grading (enclosing `contextSlice`, file location, and guide context), presented to human raters and the **Detection Eval Judge** stripped of rule rubrics, author commentary, and prior labels.

* _Reference_: `src/analyzing/eval/detection-eval.ts#BlindCardPayload`, `src/analyzing/eval/prompts.ts#formatBlindCardPrompt`
* _Avoid_: `Test Case`, `Evaluation Finding`

### Grading Deck

A curated or sampled collection of **Blind Cards** packaged together for human spot-checking, judge benchmarking, or calibration. Graded blind without showing rule rubrics or prior labels.

* _Reference_: `src/analyzing/eval/detection-eval.ts#loadPaulIrishScoredCards`
* _Avoid_: `Evaluation Suite`, `Test Deck`, `Test Suite`, `Calibration Deck`, `FP Check Deck`, `Gate 0 Deck`

### Blind Replication

Independent authoring of a **Static Matcher** from `guide.md` and upstream explainers alone without inspecting existing rule code, used to discover author blind spots and benchmark recall overlap on **`held-out` split** code.

* _Avoid_: `Dual Coding`, `Parallel Implementation`

### Precision

The proportion of evaluated findings graded `legit-modernize-target` ($\text{legit-modernize-target} / n$), measuring whether applying the guide to the flagged code is a genuine win. Because the analyzer operates in two distinct stages (deterministic static analysis vs runtime LLM verification), precision is always stage-qualified:
- **Static Matcher Precision**: Precision of findings emitted by the **Static Matcher** alone, before any **LLM Verifier** pass.
- **Post-Verifier Precision**: Precision of findings retained after the **LLM Verifier** (`verifierRubric`) filter. Default CLI rule shipping (**Qualified Rule**) requires clearing both **Static Matcher Precision** ($\ge 80\%$) and **Post-Verifier Precision** ($\ge 90\%$) at $n \ge 10$ (or **Static Matcher Precision** $\ge 90\%$ at $n \ge 5$ for rare patterns) on the **`held-out` split** as scored by the multi-judge panel.

* _Reference_: `src/analyzing/rules/index.ts#QUALIFIED_GUIDE_IDS`, `src/analyzing/README.md#qualification-criteria`
* _Avoid_: `P1 Precision`, `P2 Precision`, `p1Precision`, `p2Precision`, `Strict Precision`, `Raw Precision`, `Detector Accuracy`, `Verified Precision`, `Final Precision`

### Matcher Misfire Rate

The proportion of evaluated findings graded `not-old-pattern` ($\text{not-old-pattern} / n$), measuring how often a **Static Matcher** fires on code that is not attempting the legacy pattern. Its complement ($1 - \text{Matcher Misfire Rate}$, or **Non-Misfire Rate**) is used only when plotting alongside **Precision** on a `0–100%` chart axis.

* _Reference_: `src/analyzing/rules/index.ts`, `src/analyzing/eval/detection-eval.ts#JudgeVerdict`
* _Avoid_: `False Positive Rate`, `Error Rate`, `Non-Misfire Rate (as an evaluation metric)`

### Yield

The number of **Static Matcher** candidate findings a rule produces on a corpus split (rule-writing yield, held-out yield). Distinct from evaluated sample size ($n$), which is the subset of findings sampled for grading.

* _Avoid_: `Match Count`, `Volume`, `Hits` (unscoped)

### Not Enough Findings to Judge

An evaluation measurement status for an active rule whose **`held-out` split** yield is too low ($1 \le n \le 4$) to run offline evaluation grading. Distinct from **Too Few to Qualify**, which applies to a rule that was evaluated but whose sample size is too small to clear the qualification bar.

* _Avoid_: `Too Few to Measure` (as a user-facing label), `Unmeasurable`

### Too Few to Qualify

An evaluation qualification disposition for an active rule that has been evaluated on the **`held-out` split** but whose sample size ($n < 5$) is too small to clear the default-on qualification bar, regardless of precision. Distinct from **Not Enough Findings to Judge**, where the rule has never been evaluated because its held-out yield is under 5.

* _Avoid_: `Too Few Findings` (as a user-facing label), `Insufficient Sample`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` available behind `--all` that has not yet cleared the qualification criteria for default shipping.

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`, `PILOT_RULES`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` (`QUALIFIED_RULES`) shipped by default in `npx modern-web-guidance analyze` after clearing the default-on qualification bar on the **`held-out` split** as scored by the multi-judge panel (**Static Matcher Precision** $\ge 80\%$ and **Post-Verifier Precision** $\ge 90\%$ at $n \ge 10$, or **Static Matcher Precision** $\ge 90\%$ at $n \ge 5$ for rare patterns). Distinct from an **Experimental Rule**, which runs only under `--all`.

* _Reference_: `src/analyzing/rules/index.ts#QUALIFIED_GUIDE_IDS`, `src/analyzing/rules/index.ts#QUALIFIED_RULES`
* _Avoid_: `Default Rule`, `Tier 1 Rule`, `Tier A / Tier B / Tier C`, `Graduated Rule`, `TERMINAL_QUALIFIED_RULES`, `JSON_QUALIFIED_RULES`

### Scope Hold

A state where an active rule clears the default-on qualification bar on the **`held-out` split** (**Static Matcher Precision** $\ge 80\%$ and **Post-Verifier Precision** $\ge 90\%$ at $n \ge 10$, or **Static Matcher Precision** $\ge 90\%$ at $n \ge 5$) but is held from promotion pending human review (for example, to inspect the distribution of findings, verify payoff in real code, or evaluate sensitivity to vendored files). Distinct from a declined promotion, where human review explicitly decided not to promote the rule.

* _Avoid_: `Pending Rule`, `Paused Promotion`, `Held Rule`

### Retired Guide

A guide for which a rule was prototyped and subsequently retired in `RULE_REGISTRY` (with its module deleted on disk) because **Guide Triage** or human review determined it has `no-legacy-pattern` or mismatched the guide's actual feature. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding.

* _Reference_: `src/analyzing/rules/index.ts#RULE_REGISTRY`, `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
