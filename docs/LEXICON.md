# Evaluation & Benchmark Lexicon

The canonical domain language for Modern Web Guidance evaluation datasets, benchmark execution, grading, and reporting (`src/harness/`, `src/grading/`, `src/authoring/`, `src/dashboard/`). Distinct from the analyzer domain vocabulary in [`src/analyzing/LEXICON.md`](../src/analyzing/LEXICON.md).

This lexicon governs documentation, CLI help, and dashboard UI terminology first; legacy internal symbols, flags, and artifact paths cited in `_Reference_` remain unchanged until follow-up code migrations.

## Benchmark Structure

### Dataset

The repository's complete collection of evaluation **Tasks** across guides (authored in guide `targets/` and legacy `tasks/` directories). Distinct from a **Job**, which executes a configured selection of tasks at a point in time, and from an analyzer **Grading Deck** (`src/analyzing/LEXICON.md`).

* _Reference_: `src/core/guide-validation.ts#getTaskMap`
* _AKA_: Evaluation Suite — `Agentic Benchmarks + Evals` / Anthropic eval terminology
* _Avoid_: Test Suite, Suite (for the static collection)

### Task

A single benchmark problem pairing a developer prompt (`task.md`), a **Base App**, and a Playwright **Grader** (`grader.ts`, derived from `expectations.md`). One guide may have multiple tasks across different base apps or Baseline targets (`widely` / `newly` / `limited`).

* _Reference_: `src/core/guide-validation.ts#TaskInfo`, `guides/<category>/<slug>/targets/<base_app>/task.md`
* _Avoid_: Scenario, Test Case

### Base App

A starter web application (`daily-grind`, `devtools-times`, `cards-app`, `empty-app`) stored in `src/harness/base-apps/` and copied as the clean starting workspace for a **Task** or ad-hoc `gd run`. Per-guide task inputs (`task.md`, `grader.ts`, patches) targeting that starter app live in `guides/<category>/<slug>/targets/<base_app>/` for historical reasons; distinct from a Web Platform Baseline feature target (`widely` / `newly` / `limited`).

* _Reference_: `src/core/guide-validation.ts#getSupportedBaseApps`, `src/harness/base-apps/`
* _Avoid_: Template (in CLI/UI prose), Target App

## Execution & Conditions

### Job

One batch execution of the **Eval Harness** across a configured selection of **Tasks**, **Conditions**, and repetitions for an **Agent Harness** and model snapshot (for example, a nightly schedule, a baseline release snapshot, or an ad-hoc invocation). Each row on the evaluation dashboard landing page represents one job.

* _Reference_: `src/harness/run-suite.ts`, `src/dashboard/summary-extractor.js#JobSummary`, `results/suites/`
* _AKA_: Job — Harbor Framework
* _Avoid_: Suite, Suite Run, Run (unscoped for the batch), Trial (for a historical job point in guide trend charts)

### Trial

A single execution of an **Agent Harness** on one **Task** under one **Condition** (**Guided** or **Unguided**), producing one **Trajectory** and one set of grader **Check** results. When a **Job** repeats tasks (`×N/task`), `N` specifies **trials per condition** (one guided trial and one unguided trial per repetition). Distinct from a Chrome `Origin Trial`.

* _Reference_: `src/harness/lib/metrics.ts#RunResult`, `results/suites/<suiteId>/<n>/<guide>/<task>/<guided|unguided>/`
* _AKA_: Trial — Harbor Framework and `Agentic Benchmarks + Evals`; Attempt — Harbor Framework (`n_attempts`)
* _Avoid_: Run / Task Run (for a leaf execution), Pass (for repetition count), Trial Pair

### Condition

The A/B experimental treatment under which a **Trial** runs within a **Job**: **Guided** gives the **Agent Harness** access to `modern-web-guidance` skills and CLI retrieval, whereas **Unguided** runs the control condition without guidance tools or docs enabled.

* _Reference_: `src/harness/run-suite.ts`, `src/harness/lib/metrics.ts#calculateMetrics` (`runType: 'guided' | 'unguided'`)

### Agent Harness

The coding CLI loop paired with a model under evaluation (shorthand: **Agent** — such as Claude Code, Codex CLI, Jetski CLI, or Antigravity CLI), invoked inside an isolated sandbox via an in-repo agent runner. Distinct from the **Eval Harness**, which orchestrates benchmarking around it.

* _Reference_: `src/harness/config.ts#Agents`, `src/harness/agents/`
* _AKA_: Agent Harness — `Agentic Benchmarks + Evals`

### Eval Harness

The repository's benchmarking infrastructure (`src/harness/`) that stages **Base App** workspaces, invokes **Agent Harness** trials, runs Playwright **Graders**, and aggregates **Job** results. Distinct from the **Agent Harness** under test.

* _Reference_: `src/harness/run-suite.ts`, `docs/EVALS.md`
* _AKA_: Evaluation Harness — `Agentic Benchmarks + Evals`

### Trajectory

The normalized structured execution history of a **Trial**, parsed from raw agent session logs into turns, reasoning, tool calls, skill searches, guide retrievals, and file edits. Distinct from unparsed raw CLI session files and `modern-web.log` sidecars.

* _Reference_: `src/harness/lib/trajectory-normalizer.ts#TrajectorySummary`
* _AKA_: Trajectory — Harbor Framework (`ATIF`); Trace / Transcript — `Agentic Benchmarks + Evals`

## Grading & Outcomes

### Grader

A Playwright test file (`grader.ts`, authored from `expectations.md`) that verifies a **Task** workspace by inspecting built artifacts, DOM state, computed styles, and browser runtime behavior. Distinct from an individual **Check** inside it and from an analyzer **Detection Eval Judge** (`src/analyzing/LEXICON.md`).

* _Reference_: `src/grading/run-grader.ts`, `guides/<category>/<slug>/targets/<base_app>/grader.ts`
* _Avoid_: Spec (outside Playwright internals), LLM Judge (reserved for `src/analyzing/`)

### Check

A single deterministic assertion executed by a **Grader** during a **Trial**; pass rate equals checks passed divided by checks run across valid paired tasks. Distinct from the whole `grader.ts` **Grader** file.

* _Reference_: `src/harness/lib/metrics.ts#ScenarioCheck`, `src/harness/lib/metrics.ts#calculateMetrics`
* _Avoid_: Assertion (in UI/metrics copy for a check)

### Uplift

The delta between **Guided** and **Unguided** check pass rates measured in percentage points (`pp`, e.g., `25% -> 90%` is `+65 pp`), not relative percent change. Also labeled concisely in compact UI badges as **Lift**.

* _Reference_: `src/harness/lib/metrics.ts#calculateMetrics`, `src/dashboard/index.html`
* _AKA_: Lift — dashboard compact badges

### Infra Error

Umbrella classification for **Trials** that fail due to harness, sandbox, environment, or upstream API infrastructure rather than the quality of the generated solution, excluded from pass-rate denominators and rendered as uncertainty bands in charts. Covers:

- **Generation Error**: agent crash, non-zero exit before completion, setup failure, upstream rate-limit exhaustion, or **Agent Timeout**.
- **Grading Infra Error**: missing grader file, Playwright runner crash, missing results report, or non-solution server/browser startup failures during grading.

Not to be confused with solution-caused **`Page-Load / Build Error`** (`pageLoadFailed`), missing solution app files (`Target app missing`), **`Unguided Leak`**, or authoring-time **`Calibration Failure`**.

* _Reference_: `src/harness/lib/metrics.ts#isEarlyFailureRun`, `src/harness/lib/collection.ts#evaluateScenarioResults`, `src/authoring/dev-report.ts#DevReportFlag` (`INFRASTRUCTURE_ERROR`)
* _Avoid_: Early Failure, Run failed before grading, System error (for runtime infra failures), Generation Error (when used as the top-level umbrella)

### Page-Load / Build Error

A grading outcome recorded when the agent's modified application fails to build or hits runtime errors on initial browser load during `checkTargetPageLoad`. Tracked separately from **`Infra Error`** because build/runtime defects in agent output reflect solution quality rather than harness infrastructure (except when caused by runner/browser startup crashes).

* _Reference_: `src/grading/test-fixture.ts#checkTargetPageLoad`, `src/grading/run-grader.ts#runPlaywright`, `src/dashboard/insights.js#toJobRef` (`pageLoadFailed`)

### Unguided Leak

A control-hygiene flag triggered when an **Unguided** trial accesses or retrieves its expected guide (or `modern-web-guidance` skill), indicating contamination of the unguided baseline rather than an **`Infra Error`** or check failure.

* _Reference_: `src/harness/lib/collection.ts#collectGuideUsage`, `src/dashboard/utils.js#isUnguidedLeakTrial`

### Calibration Failure

An authoring-time `gd dev` failure where a **Task**'s **Grader** fails validation against golden solutions or the untouched baseline (`zero-passrate.patch`). Distinct from runtime **`Infra Error`** and runtime check failures within a benchmark **Job**.

* _Reference_: `src/authoring/dev-report.ts#DevReportFlag` (`CALIBRATION_FAILED`), `src/grading/run-grader.ts`
