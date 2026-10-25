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

### Legacy Pattern Spec

Explicit specification per guide (`guideId`) defining **`replaces`** (the concrete legacy APIs, CSS workarounds, DOM idioms, or npm packages the guide's modern feature replaces) and **`doesNotReplace`** (lookalike patterns that are out of scope), and scoring the guide's cleanest legacy **Sub-Pattern** on two orthogonal axes before any **Static Matcher** is authored:
1. **`Detection` (`'direct-token' | 'structural-ast' | 'needs-verifier' | 'no-legacy-pattern'`)** — How easy it is to spot the legacy pattern statically without false alarms:
   - `direct-token`: A dedicated vendor prefix (`::-webkit-scrollbar`, `-webkit-mask-image`), deprecated attribute (`importance="high"`), single-purpose package (`autosize`), or dedicated idiom (`.fadeOut()`) identifies the pattern directly (0–3% static misfire).
   - `structural-ast`: Standard HTML, CSS, or JS combined in a 2–3 clause AST shape that proves intent (`<dialog>` backdrop click listener checking `e.target === dialog` and calling `.close()`, or a boolean `.is-stuck` class toggle on a `position: sticky` header; 3–10% static misfire).
   - `needs-verifier`: A real legacy pattern written with an everyday general-purpose API (`setTimeout`, `ResizeObserver`, `document.visibilityState`, continuous `getBoundingClientRect` coordinate math) where static syntax looks identical to normal code (>50% static misfire; requires **LLM Verifier** or deferral).
   - `no-legacy-pattern`: No client-side legacy code pattern to find — either a greenfield platform capability (`passkey-registration`, `agentic-forms`) or a guide whose applicability depends on human visual/semantic judgment (`adapt-scrollbar-to-contrast-preferences`, `accessible-generated-content`).
2. **`Rewrite Scope` (`'local-swap' | 'cross-layer-refactor' | 'widget-recipe' | 'n/a'`)** — What kind of code change the guide asks for (`'n/a'` when `Detection` is `'no-legacy-pattern'`):
   - `local-swap`: Replacing or adding a property, selector, attribute, or call at the same site in the same language (including adding `autocomplete` attributes to form inputs or replacing `::-webkit-scrollbar` with `scrollbar-width` / `scrollbar-color`).
   - `cross-layer-refactor`: Deleting imperative JS listeners, observers, or helper libraries and moving behavior into declarative CSS or HTML (`@starting-style`, `animation-timeline`, `:has()`, `field-sizing`, `closedby="any"`).
   - `widget-recipe`: Coordinating HTML structure, CSS layout/styling, and JS behavior across multiple parts of a composite UI widget (`navigation-drawer`, `anchor-positioning-tab-underline`, `menu`).

* _Reference_: `analyzer-internal/findings/2026-10-19-legacy-pattern-specs.md`, `src/analyzing/schema.ts`
* _Avoid_: `Gate 0`, `Stage 0`, `Guide Triage`, `Brownfield Rubric`, `Candidate Techniques`, `clean-1-to-1`, `needs-care`, `ui-recipe-multi-part`, `skip-no-old-way`

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

An evaluation finding packaged for unbiased grading (enclosing code slice, file location, and guide context), presented to human raters and the **Eval Judge** stripped of rule rubrics, author commentary, and prior labels.

* _Reference_: `src/analyzing/judge.ts#BlindCardPayload`, `src/analyzing/prompts.ts#formatBlindCardPrompt`
* _Avoid_: `Test Case`, `Evaluation Finding`

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
* _Avoid_: `False Positive Rate`, `Error Rate`

## Rule Lifecycle States

### Experimental Rule

An active rule in `ALL_RULES` available behind `--experimental` (`--all-rules`) that has not yet cleared the qualification criteria for default shipping.

* _Reference_: `src/analyzing/rules/index.ts#ALL_RULES`
* _Avoid_: `Active Rule`, `Unqualified Rule`, `Stage 1`

### Qualified Rule

A rule in `QUALIFIED_GUIDE_IDS` shipped by default in `npx modern-web-guidance analyze` after clearing the project's qualification criteria. Rules qualify under one of three objective **Qualification Tiers** (`Tier A` human-verified $\ge 90\%$, `Tier B` **Eval Judge** $\ge 90\%$ at $n \ge 35$, or `Tier C` **Matcher Misfire Rate** $\le 10\%$ or deterministic swap).

* _Reference_: `src/analyzing/qualification.ts#QUALIFIED_GUIDE_IDS`, `src/analyzing/qualification.ts#QualificationTier`
* _Avoid_: `Default Rule`, `Tier 1 Rule`, `Graduated Rule`

### Suspended Rule

A previously qualified rule in `SUSPENDED_QUALIFIED_GUIDE_IDS` whose default shipping was temporarily halted pending evaluation-harness remediation or fresh **`held-out` split** re-verification. Distinct from an **Experimental Rule** (never qualified) and a **Retired Guide** (permanently removed from active scanning).

* _Reference_: `src/analyzing/qualification.ts#SUSPENDED_QUALIFIED_GUIDE_IDS`
* _Avoid_: `Quarantined Rule`, `Disabled Rule`

### Unwired Module

A rule module in `src/analyzing/rules/*.ts` with unit tests on disk that is not yet imported into `src/analyzing/rules/index.ts`. Distinct from a registered **Experimental Rule** or **Qualified Rule**.

* _Reference_: `analyzer-internal/scripts/rule-inventory.ts`
* _Avoid_: `Orphaned Rule`, `Unreferenced File`

### Retired Guide

A guide for which a rule was prototyped and subsequently removed or emptied from `ALL_RULES` because **Legacy Pattern Spec** or human review determined it has `no-legacy-pattern` or mismatched the guide's actual feature. Not to be confused with an **LLM Verifier** `drop` decision on an individual finding, or a **Suspended Rule**.

* _Reference_: `src/analyzing/README.md`
* _Avoid_: `Dropped Rule`
