---
name: nightly-eval-investigation
description: >
  Downloads and analyzes nightly evaluation runs (Claude Code, Codex CLI, and Jetski CLI) from the GCS remote dashboard or diagnoses single-guide evaluation runs locally.
  Use this skill to run bulk nightly investigations, triage flagged tasks, inspect eval trajectories, or diagnose low pass rates and grader failures.
---

# Evaluation & Nightly Investigation

This skill covers both bulk multi-agent triage of remote nightly evaluation suites from Google Cloud Storage (GCS) and single-guide evaluation diagnosis (`gd eval`).

Before blaming a guide or editing an eval, check the 8 red lines and authoring rules in `.agents/skills/project-evals/SKILL.md`.

### Core Principles

1. **Read-Only Bulk Nightly Mode vs. Targeted Diagnosis**:
   - When running a **bulk nightly investigation report** across the 3 nightly suites, operate in **strictly read-only mode**: do not edit any files under `guides/`; record all findings and concrete fix proposals exclusively in `out/nightly-investigation/nightly_investigation_report.md` under `Actionable Recommendations`.
   - When asked to **diagnose and fix a specific guide's eval**, inspect the artifacts below, check the 8 red lines in `project-evals`, and fix the broken eval artifact (`task.md`, `grader.ts`, or `expectations.md`). Never change `guide.md` to fit a grader; if `guide.md` itself has a technical bug or ambiguity, follow `.agents/skills/project-guides/SKILL.md` (or raise it with the guide's owner).
2. **How to Read Pass Rates**:
   - **No pass-rate target**: There is no target guided pass rate (do not chase 100% guided pass rates or tune graders and prompts to hit a number).
   - **Guided < 100%** is an informational signal. First rule out an eval defect (the 8 red lines in `project-evals`: over-strict grader, task/grader mismatch, untaught expectation, or co-retrieved guide conflict). Only after the eval is clean is a remaining failure a signal that `guide.md` may be unclear on that step.
   - **Unguided >= 80%** across runs is a triage trigger (`HIGH_UNGUIDED_PASS_RATE`): check for a task leak (`task.md` naming the API, CSS property, attribute, fallback, or guide) or a vacuous check in `grader.ts`. If both the task and grader are clean, the high unguided score is a genuine finding that models already know the pattern and the guide adds little lift on that task.

---

## Quick Reference: Evaluation Artifacts & Commands

### Running or Pulling Evals

- **Run a single guide locally** (read-only on source files; does not overwrite `grader.ts` or patches):
  ```bash
  gd eval guides/<category>/<slug>
  ```
- **Re-check grader calibration** after any `grader.ts` or `expectations.md` edit:
  ```bash
  gd dev guides/<category>/<slug> --test-grader
  ```
- **Pull a specific suite from GCS**:
  ```bash
  gcloud storage rsync gs://guidance-evals/<suite_id> results/suites/<suite_id> --recursive --exclude ".*\.zip$|.*\.png$"
  ```

### Suite Result Files (`results/suites/<suite_id>/`)

- **Suite Summary & Check Diagnostics** (`results/suites/<suite_id>/evals.json`):
  - Contains per-task guided and unguided pass rates (keyed as `<target> - <guide> - guided|unguided`, where `<target>` is `daily-grind`, `devtools-times`, or `daily-grind-limited` for Gen 2 and `task` for Gen 1), `guidesUsed` (which guides the agent retrieved), and per-check results with inline failure diagnostics (`error`, `errorLocation`, `pageSnapshot`, `browserErrors`).
- **Agent Trajectory** (`results/suites/<suite_id>/<run_number>/<guide>/<target>/guided/`):
  - `<target>` is `daily-grind`, `devtools-times`, or `daily-grind-limited` for Gen 2 guides and `task` for Gen 1 guides.
  - **Normalized trajectory (`trajectory_summary.json`) & server log (`modern-web.log`)**: Inspect `trajectory_summary.json` first for the standardized step-by-step tool calls, reasoning, `retrievedGuides`, and `fileReadGuides`, alongside `modern-web.log` (JSONL entries logged by the guidance tool).
  - **Raw session logs** (format varies by agent; see `src/harness/lib/trajectory-normalizer.ts`): `{session,subagent}-*.{json,jsonl}` for Claude Code, Codex CLI, and Gemini CLI, `*.db` + `session-*.html` for Jetski/Antigravity CLI, or `trajectory.jsonl`.
- **Agent Output** (`results/suites/<suite_id>/<run_number>/<guide>/<target>/guided/`):
  - Contains `agent.patch` (for Gen 2 targets) or modified target files (`index.html`, JS/CSS bundles, or stray subresources created by the agent), plus `<guide>_results.json` from the Playwright grader run.

### Guide Source Files (`guides/<category>/<slug>/`)

- **Gen 2 (multi-target)**: `targets/<app>/task.md`, `targets/<app>/grader.ts`, `targets/<app>/patches/*-solution.patch`, `targets/<app>/patches/zero-passrate.patch`, plus root `guide.md`, `demo.html`, and `expectations.md`.
- **Gen 1 (legacy single-target)**: `tasks/task.md` and `grader.ts` at the guide root.

---

## Flagging & Health Criteria (Nightly Bulk Audit)

Nightly evaluation suites are uploaded to `gs://guidance-evals/` under `nightly-YYYY-MM-DD_HH-MM-SS-[agent_type]/` across three agent families:
1. **Claude Code** (`claude_code` or `claude`)
2. **Codex CLI** (`codex_cli` or `codex`)
3. **Jetski CLI** (`jetski_cli`, `agy`, or `jetski`)

For every task evaluated across the 3 latest nightly runs, `investigate.ts` flags three health conditions:

### 1. Missing Expected Guide (`MISSING_EXPECTED_GUIDE`)
- **Rule**: The expected guide for a task (matching the task's guide slug) is **not** listed in the run's `guidesUsed` array.
- **Threshold**: Flagged if **2 out of the 3** nightly runs miss the expected guide.
- **Implication**: Either the agent searched with terms that did not match `guide.md`'s frontmatter `name`/`description`, or the agent felt confident solving the task from pre-training without consulting the skill.

### 2. Too Many Guides Consumed (`TOO_MANY_GUIDES_CONSUMED`)
- **Rule**: The agent consumes **3 or more** guides during a single guided run of the task.
- **Threshold**: Flagged if **2 out of the 3** nightly runs consume 3 or more guides.
- **Implication**: Search query sprawl, overlapping guide descriptions, or co-retrieved guides whose instructions interact on the same task.

### 3. High Unguided Pass Rate (`HIGH_UNGUIDED_PASS_RATE`)
- **Rule**: The unguided pass rate for a task is **80% or higher**.
- **Threshold**: Flagged if **all three** nightly runs have unguided pass rates of 80% or higher.
- **Implication**: Either `task.md` leaks the solution mechanism, `grader.ts` has loose/vacuous assertions, or models already know the pattern without guidance.

*(Note: Low guided pass rates are never flagged automatically as a health failure. `investigate.ts` still extracts common assertion failures across all 3 guided runs as informational diagnostic context when present.)*

---

## Nightly Bulk Workflow Instructions

### Step 1: Query, Pull, and Flag with `investigate.ts`
Run the automated TypeScript analysis script (which queries `gs://guidance-evals/`, syncs the latest `claude_code`, `codex_cli`, and `jetski_cli` nightly suites excluding `.zip`/`.png` binaries, and generates the report skeleton):
```bash
node .agents/skills/nightly-eval-investigation/scripts/investigate.ts
```

Outputs:
- Markdown report: `out/nightly-investigation/nightly_investigation_report.md`
- JSON context helper: `out/nightly-investigation/flagged_tasks_context.json` (extracted prompts, guide descriptions, and test headers for all flagged tasks)

### Step 2: Perform Qualitative Deep-Dives (Investigation Playbook)

For each task in the Flagged Tasks Table of `nightly_investigation_report.md`, investigate the root cause and write concrete recommendations.

> [!IMPORTANT]
> **BULK REPORT COMPLIANCE RULES:**
> 1. **Do Not Modify Source Files**: In bulk nightly investigation mode, do NOT edit any files under `guides/`. Write all diagnostic findings and recommendations *only* inside `out/nightly-investigation/nightly_investigation_report.md`.
> 2. **Complete All Flagged Tasks**: Populate the diagnostic summary for every flagged task without leaving `TODO` placeholders.
> 3. **Strict Heading Omission**: Under `Diagnostic Details`, include bullets only for the specific flags triggered on that task (plus `*Failed Assertions*` if extracted by the script). Under `Actionable Recommendations`, include lines only for components (`Prompt`, `Guide`, `Grader`) that actually need changes; omit unchanged components completely rather than writing "N/A" or "No changes".

For each flagged task, inspect `targets/<app>/task.md` (or `tasks/task.md`), `guide.md`, `expectations.md`, `targets/<app>/grader.ts`, `trajectory_summary.json`, and `modern-web.log`:

- **`HIGH_UNGUIDED_PASS_RATE`**:
  1. Check `task.md` against Red Line 2 in `project-evals`: does it name the API, CSS property, HTML attribute, fallback mechanism, or guide slug, or copy the guide's `description`?
  2. Check `grader.ts` against Red Line 1 and Red Line 8: are assertions tautological, vacuous, or already satisfied by the starting app?
  3. If both `task.md` and `grader.ts` are clean, report that the task is genuinely baseline-known by current models and no eval change is needed.
- **`MISSING_EXPECTED_GUIDE`**:
  1. Inspect `trajectory_summary.json` and `modern-web.log` to see whether the agent called the guidance search tool.
  2. **Search Mismatch** (agent searched, but got the wrong guide or weak rankings): propose updates to `guide.md`'s frontmatter `description` so it matches the problem terms agents naturally search for (without stuffing feature/API names into `task.md`). Note that `skills-src/modern-web-guidance/SKILL.md` is global and off-limits for per-guide tuning.
  3. **Tool Skip** (agent did not search): check that `task.md` clearly states the user-facing problem and concrete behavioral outcome in the target app. Do **not** add artificial layout/performance/synchronization constraints that the guide doesn't teach ("constraint forcing" is retired because it causes task/grader drift).
- **`TOO_MANY_GUIDES_CONSUMED`**:
  1. Inspect `guidesUsed` in `evals.json` and the trajectory in `trajectory_summary.json`.
  2. Check whether two guides had overlapping descriptions (disambiguate their frontmatter `description` fields) or whether co-retrieved guides gave contradictory rules on the same task (Red Line 7 in `project-evals`, e.g., one guide banning an element or pattern the other teaches).
- **Common Guided Assertion Failures & Environment Checks**:
  1. **Eval vs. Guide Triage**: Check the agent's modified app (`agent.patch` / `index.html`) against `guide.md`. If the agent followed a pattern the guide allows and the test failed, recommend fixing `grader.ts` (never loosen a check speculatively unless the rejected pattern is allowed by the guide or reproduced). If `grader.ts` checks an expectation the guide does not teach, recommend removing or aligning the expectation and check.
  2. **Transient API / Rate-Limit Failures**: Check `trajectory_summary.json` or raw logs for `429 Rate Limit Exceeded`, quota exhaustion, or untrusted-folder tool skips (`folderTrust` in Gemini CLI settings) before attributing a 0% run to the guide or grader. When running local `gd eval` batches under quota pressure, batch fewer tasks at a time or switch the active harness agent.

### Step 3: Present Report & Publisher Command

Once `out/nightly-investigation/nightly_investigation_report.md` is complete, link [nightly_investigation_report.md](file:///out/nightly-investigation/nightly_investigation_report.md) to the user and share the publisher command so they can review and run it manually:

> [!WARNING]
> **DO NOT EXECUTE THE PUBLISHER SCRIPT YOURSELF:** Never run `publish_report.ts` or create GitHub issues automatically; let the user verify the report first.

```bash
node .agents/skills/nightly-eval-investigation/scripts/publish_report.ts
```

---

## Report Format Standard (`out/nightly-investigation/nightly_investigation_report.md`)

`scripts/publish_report.ts` parses the exact structure below (anchor tags, `### \`[task_name]\``, `#### Flags:`, agent table rows, and `- [ ] **Prompt** (\`path\`): ...` recommendation lines):

```markdown
# Nightly Evaluation Investigation Report

**Generated:** YYYY-MM-DD
**Suites Investigated:**
- **claude_code**: `[folder_name_1]`
- **codex_cli**: `[folder_name_2]`
- **jetski_cli**: `[folder_name_3]`

---

## Summary of Flagged Tasks

- **Total distinct tasks analyzed:** [total_count]
- **Total flagged tasks:** [flagged_count]

### Flagged Tasks Table

| Task / Guide | Flags | Details |
| :--- | :--- | :--- |
| `[target_name - guide_name]` | `[FLAG_1]`, `[FLAG_2]` | [Detail explanation of flags] |


## Flagged Tasks Details

<a name="[slugified-task-key]"></a>
### `[target_name - guide_name]`

#### Flags:
- **`[FLAG_1]`**: [Detail explanation]

#### Run Details:

| Agent | Guided Pass Rate | Unguided Pass Rate | Guides Consumed |
| :--- | :---: | :---: | :--- |
| **claude_code** | [guided_rate]% | [unguided_rate]% | `[guide_1]`, `[guide_2]` |
| **codex_cli** | [guided_rate]% | [unguided_rate]% | `[guide_1]` |
| **jetski_cli** | [guided_rate]% | [unguided_rate]% | *None* |

#### Qualitative Diagnostic Summary:

- **Diagnostic Details**:
  - *Failed Assertions*:
    - "[Exact assertion error message string]" (Test ID: `[test_id]`)
  - **[FLAG_1]**: [Concrete root-cause explanation]
- **Actionable Recommendations**:
  - [ ] **Prompt** (`guides/<category>/<slug>/targets/<app>/task.md`): [Exact prompt change]
  - [ ] **Guide** (`guides/<category>/<slug>/guide.md`): [Exact guide metadata or content change]
  - [ ] **Grader** (`guides/<category>/<slug>/targets/<app>/grader.ts`): [Exact grader logic change]

---
```
