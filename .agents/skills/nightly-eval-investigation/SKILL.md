---
name: nightly-eval-investigation
description: >
  Downloads and analyzes the latest three distinct nightly evaluation runs (Claude Code, Codex CLI, and Jetski CLI)
  from the GCS remote dashboard to identify and flag unhealthy or low-performing tasks and guides.
  Use this skill whenever you need to run a bulk investigation on remote nightly runs, track agent health,
  or identify over-prescribed/brittle guides.
---

# Nightly Evaluation Investigation

This skill automates the retrieval and multi-agent comparison of remote nightly evaluation runs from Google Cloud Storage (GCS) to diagnose system-wide guidance health, task drift, and over-prescribed guides.

### Core Objectives

1. **Cross-Agent Diagnostics**: Compare results across three distinct, modern agents (Claude Code, Codex CLI, and Jetski CLI) to locate patterns that are agent-agnostic.
2. **Guide Discovery Audit**: Catch cases where agents skip the expected guide or over-retrieve irrelevant guides.
3. **Health Thresholding**: Flag tasks that either underperform under guidance or are too easy/over-prescriptive (meaning unguided runs already pass easily).
4. **Structured Reporting**: Produce reliable Markdown and JSON artifacts that downstream automation can easily ingest.

> [!IMPORTANT]
> **CRITICAL CONSTRAINT - READ-ONLY INVESTIGATION ONLY**
> This skill is **strictly for diagnostics, investigation, and suggesting recommendations**. The agent MUST NOT under any circumstances edit, modify, create, delete, or touch any files under the `guides/` directory (including task files, guides, graders, expectations, or demos). All suggestions for fixes must be documented *exclusively* in the generated investigation report markdown file under the "Actionable Recommendations" section. No automated or manual code remediation should be performed.

---

## Quick Reference: Remote Dashboard Results (GCS)

All nightly evaluation suites are automatically uploaded to Google Cloud Storage:
- **GCS Bucket**: `gs://guidance-evals/`
- **Naming Pattern**: `nightly-YYYY-MM-DD_HH-MM-SS-[agent_type]/` (note: legacy folders may contain an optional trailing `-[ldap]` suffix)

### Distinct Agent Categories
We track three core agent implementations in our periodic evaluations:
1. **Claude Code** (`claude_code` or `claude`)
2. **Codex CLI** (`codex_cli` or `codex`)
3. **Jetski CLI** (`jetski_cli` or `agy` or `jetski`)

---

## Flagging & Health Criteria

For every task evaluated in the runs, the investigation tracks four specific metrics across the 3 runs:

### 1. Missing Expected Guide (`MISSING_EXPECTED_GUIDE`)
- **Rule**: The expected guide for a task (which matches the task's guide name) is **not** listed in the run's `guidesUsed` array.
- **Threshold**: Flagged if **2 out of the 3** nightly runs for that task are missing the expected guide.
- **Implication**: The prompt in `tasks/task.md` is failing to force discovery/retrieval of the correct reference guide.

### 2. Too Many Guides Consumed (`TOO_MANY_GUIDES_CONSUMED`)
- **Rule**: The agent consumes **3 or more** guides during a single guided run of the task.
- **Threshold**: Flagged if **2 out of the 3** nightly runs for that task are consuming 3 or more guides.
- **Implication**: The agent is either experiencing search query sprawl or guide definitions overlap too heavily.

### 3. Low Guided Pass Rate (`LOW_GUIDED_PASS_RATE`)
- **Rule**: The guided pass rate for a task is **under 75%**.
- **Threshold**: Flagged if **all three** nightly runs for that task have guided pass rates under 75%.
- **Implication**: The guide content is ambiguous, incomplete, or the grading assertions are brittle.

### 4. High Unguided Pass Rate (`HIGH_UNGUIDED_PASS_RATE`)
- **Rule**: The unguided pass rate for a task is **70% or higher**.
- **Threshold**: Flagged if **all three** nightly runs for that task have unguided pass rates of 70% or higher.
- **Implication**: The task prompt is overly prescriptive (giving away the solution) or the task itself is too trivial to require guidance.

---

## Workflow Instructions

To perform a nightly evaluation investigation, follow these steps:

### Step 1: Query and Select the Runs
1. List all suites in GCS:
   ```bash
   gcloud storage ls gs://guidance-evals/
   ```
2. Parse the output to filter directories starting with `nightly-`.
3. Group runs by the three distinct agent types (handling both newer clean names and legacy runs containing a user LDAP suffix):
   - **Claude Code**: matches `claude_code` or `claude`
   - **Codex CLI**: matches `codex_cli` or `codex`
   - **Jetski CLI**: matches `jetski_cli`, `agy`, or `jetski`
4. For each group, select the single folder with the **latest** timestamp.

### Step 2: Pull down Results
1. For each of the selected 3 folders, create the directory locally:
   `harness/results/<folder_name>`
2. Sync the suite folder recursively while excluding heavy binaries (Playwright `trace.zip` and screenshots) to save bandwidth and disk space:
   ```bash
   gcloud storage rsync gs://guidance-evals/<folder_name> harness/results/<folder_name> --recursive --exclude ".*\.zip$|.*\.png$"
   ```
   *(Note: This is done automatically by the investigate script in Step 3, but can be run manually if needed.)*

### Step 3: Run the Flagging Script
Run the automated TypeScript analysis script:
```bash
node --experimental-strip-types .agents/skills/nightly-eval-investigation/scripts/investigate.ts
```

This script will automatically cross-examine the results, flag unhealthy tasks, and output the report and context helper artifacts to the skill's directory:
- Markdown: `.agents/skills/nightly-eval-investigation/artifacts/nightly_investigation_report.md`
- JSON Context: `.agents/skills/nightly-eval-investigation/artifacts/flagged_tasks_context.json` (contains extracted prompts, guide descriptions, and test headers for all flagged tasks to assist in diagnostics)

### Step 4: Perform Qualitative Deep-Dives (Investigation Playbook)

For each task listed in the Flagged Tasks Table of `nightly_investigation_report.md`, you must perform a qualitative deep-dive to locate the root cause and recommend actionable fixes.

> [!IMPORTANT]
> **CRITICAL COMPLIANCE RULES:**
> 1. **Do Not Modify Source Files**: This is a passive/diagnostic investigation. Do NOT touch, edit, or modify any files under `guides/` (such as task prompts, guide markdown files, or grader TypeScript files). All diagnostic findings and recommendations must be written *only* inside the markdown report.
> 2. **Complete All Flagged Tasks**: You MUST qualitatively investigate and fully populate the summary for **every single flagged task**. Leaving placeholder text or skipping any flagged task is unacceptable.
> 3. **Strict Heading Omission**: Under `Diagnostic Details`, only include headings/bullet points for the specific flags that were triggered for the task. Omit any non-triggered flags completely from the markdown file. Do not write "N/A" or "No issues".
> 4. **Long-Running, Thorough Investigation**: The qualitative investigation phase is a long-running, intensive task. You MUST thoroughly examine each flagged guide/test one by one, inspecting the target prompt (`task.md`), reference guide (`guide.md`), and grading code (`grader.ts`) to build a high-quality, task-specific diagnostic summary and actionable recommendation. Do not rush, skip steps, or bundle tasks.

Follow this linear playbook for each flagged task:

1. **Locate Source Files**
   Find the task's directory under the local workspace: `guides/[category]/[use-case]/`
   - Prompt: `tasks/task.md`
   - Guide: `guide.md`
   - Grader: `grader.ts` and `expectations.md`

2. **Review Extracted Failed Assertions**
   The script `investigate.ts` automatically extracts and intersects the failed assertions across all three agents, writing them directly into the report.
   - **Omission Rule**: This section is only populated if the task triggered the `LOW_GUIDED_PASS_RATE` flag. For all other flags, it is completely omitted.
   - Only assertions that failed across all three agents are included.
   - Review these common failures to analyze their root causes.

3. **Map Flags to Diagnostic Explanations**
   Analyze the source files based on the specific flags that were triggered, and write a diagnostic summary explaining why the task was flagged under each active flag.

   > [!IMPORTANT]
   > **OMISSION RULE:** Only include bullets for the specific flags that were triggered for the task. Omit any flags that were not triggered (do not write "N/A" or "No issues").

   - **`HIGH_UNGUIDED_PASS_RATE`**: Explain why unguided runs passed. Inspect `tasks/task.md` to see if the prompt is overly prescriptive (explicitly mentioning CSS attributes or API details that act as giveaways). Inspect `grader.ts` to check for loose/vacuous assertions.
   - **`LOW_GUIDED_PASS_RATE`**: Explain why guided runs failed. Inspect `guide.md` for bugs, outdated modules, or incorrect syntax. Inspect `grader.ts` for calibration drift or rigid checks. Check for browser/emulation issues in the sandbox.
   - **`MISSING_EXPECTED_GUIDE`**: Explain why the expected guide was missed. Inspect the task prompt in `tasks/task.md` to see if it lacks search keywords, or the guide metadata/synonyms in `guide.md`.
   - **`TOO_MANY_GUIDES_CONSUMED`**: Explain why multiple guides (3 or more) were consumed. Check for overly broad prompts that cause query sprawl, or overlapping guide descriptions.

4. **Draft Specific, Actionable Recommendations**
   Determine which recommendations to include based on the diagnostics mapped in previous steps. All recommendations must be directly justified by the findings from your investigation of the prompts, guides, and graders. Vague recommendations like "Fix prompt" or "Fix guide" are not acceptable; you must propose exact, concrete changes.

   > [!IMPORTANT]
   > **OMISSION RULE:** Only include recommendation lines for components that actually require changes. If a component does not require updates (e.g., the grader is correct as-is), you MUST OMIT the corresponding recommendation line completely from the markdown file (do not write "Keep as is" or "No changes").

   - **Prompt**: Propose the specific new phrasing or keywords to add/remove.
   - **Guide**: Specify the description, metadata, or content updates needed.
   - **Grader**: Detail the exact logic changes or assertions to modify/loosen.

5. **Synthesize the Markdown Report**
   Write the summary under the task's section in `.agents/skills/nightly-eval-investigation/artifacts/nightly_investigation_report.md` following the template below.

### Step 5: Inform the User of the Publishing Script
Once the qualitative diagnostics and recommendations have been fully written and saved to the markdown report, present the final report to the user and inform them that they can run the automated publisher script to create the GitHub parent issue and the task-level engineering/devrel subissues.

> [!WARNING]
> **DO NOT EXECUTE THE PUBLISHER SCRIPT YOURSELF:** The agent must never run the publisher script (`publish_report.ts`) or create/publish any GitHub issues itself. It must only inform the user of the command so they can verify the report first and execute it manually.

```bash
node --experimental-strip-types .agents/skills/nightly-eval-investigation/scripts/publish_report.ts
```

### Step 6: Present and Link
Present the final report to the user, providing a clickable link, and remind them of the publishing command:
- Markdown Report: [nightly_investigation_report.md](file:///Users/micahjo/modern-web-guidance-src/.agents/skills/nightly-eval-investigation/artifacts/nightly_investigation_report.md)

---

## Report Format Standards

All investigation reports MUST strictly follow these templates to ensure downstream compatibility:

### Markdown Standard (`artifacts/nightly_investigation_report.md`)
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
| `[task_name]` | `[FLAG_1]`, `[FLAG_2]` | [Detail explanation of flags] |

## Flagged Tasks Details

### `[task_name]`

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
  - **[FLAG_1]**: TODO
  - **[FLAG_2]**: TODO

- **Actionable Recommendations**:
  - [ ] **Prompt**: TODO
  - [ ] **Guide**: TODO
  - [ ] **Grader**: TODO

---
```
