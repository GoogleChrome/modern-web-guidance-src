---
name: investigating-eval-results
description: >
  Analyzes Guidance evaluation results to identify patterns and causes of low pass rates.
  Use when investigating low guided pass rates, checking trajectories, or debugging eval grader failures.
---

# Investigating Eval Results

This skill helps you diagnose why AI coding agents are failing evaluations, specifically looking for discrepancies between guided and unguided performance.

### Core Philosophy: Immediate Resolution
- **Fix It Now**: Do not create tracking issues or delay work. The goal of an investigation is to identify the root cause and implement the fix immediately in the active session.
- **Platform Boundary**: When investigating an eval, strictly modify use-case specific files (i.e., `task.md`, `grader.ts`, `expectations.md`, demo apps, and `guide.md`). Do not attempt to fix bugs in the underlying platform infrastructure or Playwright test environment. If you identify infrastructure issues, note them clearly for the user and suggest filing an issue on GitHub for the engineering team, ensuring the use-case investigation remains focused and clean.

## Quick Reference: Investigation Files

### Eval Files

Artifacts generated during an evaluation run that log success rates, agent trajectories, and the final output produced by the agent.

- **Eval Test Results** (`evals.json`)
  - **Path**: `harness/results/<suite_id>/evals.json`
  - **Purpose**: Reference to check overall pass rates, verify the success of individual test checks, and confirm which tools or skills were activated during guided runs to ensure the agent properly utilized the corresponding guide.

- **Agent Trajectory** (`session-<timestamp>.json`)
  - **Path**: `harness/results/<suite_id>/<run_number>/<use-case>/task/guided/session-<timestamp>.json`
  - **Purpose**: Review to trace the agent's step-by-step thought process. **Rule**: Always check the most recent run by timestamp; if stale, rerun the eval.

- **Agent Output** (`index.html`)
  - **Path**: `harness/results/<suite_id>/<run_number>/<use-case>/task/guided/index.html`
  - **Purpose**: Inspect the exact markup, selectors, and resources produced or modified by the agent. *(Note: If expected changes are missing from index.html, check this directory for stray subresources created by the agent.)*

### Use Case Files

The permanent source files that define the task prompt, validation logic, expected implementation patterns, and reference guidance.

- **Use Case Prompt** (`tasks/task.md`)
  - **Path**: `guides/<category>/<use-case>/tasks/task.md`
  - **Purpose**: Contains the exact prompt passed to the agent. Modify this directly to refine instructions or bypass discovery issues.

- **Validation Logic** (`grader.ts`)
  - **Path**: `guides/<category>/<use-case>/grader.ts`
  - **Purpose**: Inspect grading assertions to ensure tests are resilient and not overly rigid (e.g., using structural locators).

- **Expectations** (`expectations.md`)
  - **Path**: `guides/<category>/<use-case>/expectations.md`
  - **Purpose**: **Grader Generation**: Used strictly to generate `grader.ts` and is never read by the agent during evals. If you update `grader.ts`, you must update this file to keep them perfectly in sync.

- **Demos** (`demo.html`)
  - **Path**: `guides/<category>/<use-case>/demo.html`
  - **Purpose**: **Grader Calibration**: Used strictly for calibration and is never read by the agent. If you update `grader.ts`, update this file to ensure it passes 100% of checks. Includes `negative-demo.html` for 0% calibration.

- **Reference Guidance** (`guide.md`)
  - **Path**: `guides/<category>/<use-case>/guide.md`
  - **Purpose**: Confirm instructions are perfectly clear, unambiguous, and explicitly define mandatory requirements.

## 1. Accessing Data

### Running Locally
The standard way to check pass rates across one or more use cases is to run:
```bash
gd eval <path/to/use-case>
```
- **Read-Only Safety**: `gd eval` skips destructive calibration checks on demo files and graders, ensuring your source files are not modified during evaluation.
- **Batch Support**: Accepts paths to one or more use cases.

To see which specific tests passed or failed, reference the generated `evals.json` file (detailed in the Quick Reference section).

### Via GCS (Remote / Historical)
If you are reviewing a shared dashboard and need to investigate specific historical or remote evaluation results, download the entire suite directory recursively to your local harness path:

```bash
gcloud storage cp -r gs://guidance-evals/<suite_id> harness/results/
```


## 2. Investigation Flow

1.  **Run `gd eval`** to execute the evaluation suite for a given use case.
2.  **Check `evals.json` First**: Review the top-level summary in `evals.json` to inspect unguided and guided pass statuses.
    - **Crucial Check**: In the guided run results, verify whether the skill tools were called and if the specific use case guide was used.
    - **If the guide was NOT used**, investigate why and correct the usage:
      - **Check the Prompt**: Review and modify the prompt directly in the use case's `tasks/task.md` file.
      - **First Prompt Only**: Be aware that the evaluation suite only executes the **first** list item in `task.md`. Adding additional bullet points will not change the prompt used in the eval.
      - **Base App Alignment**: Ensure the prompt makes sense against the starting conditions of the `base_app` (e.g., `daily-grind`). Any elements, selectors, or locations mentioned in the prompt must exist in the initial state of the base app.
      - **Temporary Workaround (Debugging Only)**: If the agent fails to discover the guide, you can temporarily append `"use the modern web skill"` to the prompt in `task.md`. This forces the agent to search for and retrieve the guide, allowing you to bypass discovery issues and debug grader or implementation failures. **Crucial**: This is strictly a temporary debugging workaround and must be removed before finalizing the task.
      - **Enforce Product Requirements (Last Resort)**: If the agent still ignores the skill, emphasize mandatory product requirements or constraints that legacy methods cannot satisfy (e.g., "mandatory: you must ensure X behavior"). This signals to the agent that its baseline training is insufficient, forcing it to look up the skill.
      - **Always Re-Run Evals After Prompt Changes**: Prompting is extremely sensitive. If you modify the prompt in any way, you MUST immediately re-run the evaluation to validate that your changes successfully encourage skill usage and improve pass rates.
3.  **Check which tests failed**: The most reliable way to see which tests are failing is to examine the `evals.json` file for the entire eval run. It contains a `results` object where each test run has a `results` array listing every check, including a `passed` boolean (`true` or `false`) and the test message.
4.  **Inspect the trajectory** (`session-<timestamp>.json`) to determine how the agent used skill tools. Trajectory files for `gd eval` runs are located in the harness results directory as defined in the Quick Reference table above.
    - *Failure Diagnosis*: Refer to Section 3 (Observed Patterns & Solutions) to match the trajectory behavior to known failure patterns, such as silent skips, poor search selection, or content ambiguity.
5.  **Verify Harness Integration & Logs**: Review standard error and harness output files to confirm whether skill tools were registered, and check if folder trust logic (e.g., `security.folderTrust.enabled`) is silently blocking discovery.

## 3. Some Observed Patterns & Solutions

-   **Conversational Answer Instead of Code Edits (Informational Prompt)**:
    -   *Investigation*: The agent retrieves the guide and understands the task, but the trajectory shows it outputting a text explanation instead of modifying the target files (causing all grader checks to fail).
    -   *Solution*: Update the prompt in `tasks/task.md` to be an explicit command (e.g., `"update index.html to..."`) rather than an open-ended question (`"how can I..."`).

-   **Agent Searches Skills but Picks the Wrong Guide**:
    -   *Investigation*: Verify in the trajectory which guide titles or keywords the agent searched for versus what the metadata returned.
    -   *Solution*: Improve the guide's metadata description, title, or associated search keywords so that it ranks higher or explicitly matches likely agent queries.
-   **Missing Skill Tools (Silent Skip)**: GCLI skips tool discovery in untrusted folders.
    -   *Solution*: Disable `folderTrust` in the harness `settings.json` or set `GEMINI_CLI_INTEGRATION_TEST=true`.
-   **Salient changes in new files**: Graders typically only inspect `index.html`. If a prompt is ambiguous, the agent might happily create a new page or subresource, causing all grader checks to fail because the grader never sees those edits.
    -   *Investigation*: Check the agent's output in the results directory to see exactly which files were modified or created.
    -   *Solution*: Prepend a specific target instruction to the prompt, for example: `"add to index.html: <rest of prompt>"`. This removes ambiguity and forces the agent to modify the exact file the grader expects.
-   **Conflicting Image Sourcing**: The prompt specifies a filename but a global instruction causes the agent to use external URLs.
    -   *Solution*: Remove conflicting global instructions.
-   **Ambiguous Prompt vs Rigid Grader**: A disconnect exists between what the agent generates and what the grader targets. For example, the grader might query for `#my-button` or `hero.jpg`, but the prompt never specifies those names.
    -   *Investigation*: Compare the agent's output in `index.html` with the precise selectors and resource names expected by the `grader.ts` file to spot discrepancies.
    -   *Solution*: Update the prompt to be explicitly prescriptive about validation constraints (such as specific IDs, class names, or resource filenames). However, **never** be prescriptive about the specific modern web features or solution mechanisms.
-   **Overly Rigid Graders vs Valid Alternatives**: If the agent's `index.html` changes faithfully follow the guide but still fail the checks, the grader is likely too brittle (often due to relying on regular expressions).
    -   *Solution*: Update the `grader.ts` file to be more resilient. Avoid regular expressions at all costs. Instead, verify the implementation using computed styles, structural descendant selectors, or behavior-based Playwright assertions to tolerate non-deterministic but correct agent outputs.
-   **Unreasonable or Untestable Expectations**: Grader files are auto-generated from `expectations.md`. If the expectations themselves are flawed, the resulting grader will be untestable or redundant.
    -   *Investigation*: Compare the list of expectations against the guidance and best practices in the `guide.md` file to ensure they are reasonable, faithfully represent the guide, and are simple enough to test accurately.
    -   *Solution*: Simplify complex expectations and remove overlapping or redundant tests. Ensure each test validates a unique success criteria exactly once, eliminating duplicate positive/negative checks.
-   **Grader Fine-Tuning & Calibration Safety**: When manually fine-tuning `grader.ts`, running `gd dev` can automatically overwrite your changes if the checks are out of alignment with the demos or expectations.
    -   *Investigation*: Avoid running a full `gd dev` in write mode after manually editing a grader file.
    -   *Solution*: Run `gd dev <use-case-dir> --test-grader` to safely test the grader calibration in read-only mode without risking overwrites. Always ensure any substantive changes to `grader.ts` are mirrored in `expectations.md` so they remain perfectly aligned.
-   **JS Fallback for CSS Tasks**: Agent uses JS listeners instead of CSS scroll-driven animations because it lacks guidance on modern browser support.
    -   *Solution*: Ensure skill tools are available and suggest the optimal tech stack.
-   **Guide Content Ambiguity (Last Line of Defense)**: If the prompt, base app, expectations, and grader are all perfectly tuned but the agent still fails, the guide itself may be ambiguous about what is an example versus a strict requirement.
    -   *Investigation*: Check if critical implementation steps (e.g., fallback strategies or accessibility requirements like `prefers-reduced-motion`) are phrased too softly in the guide.
    -   *Solution*: Remove ambiguity by explicitly using strong emphasis keywords like **mandatory**, **critical**, or **must** for non-negotiable requirements so the agent knows precisely what is expected.
-   **Transient API Failures & Rate Limits**: External model API calls can trigger `429 Rate Limit Exceeded` errors, causing evals to fail entirely or yield 0% success rates. This is often caused by running too many concurrent evaluations.
    -   *Investigation*: Check standard error logs for explicit rate limit or API quota errors.
    -   *Solution*: Do not waste time debugging the guide or grader. Instead, mitigate the issue using these workarounds:
        - **Execution Batching**: Run the evaluations sequentially or in smaller batches (e.g., 2 at a time) to avoid hammering the API.
        - **Model Fallback**: Temporarily edit the `GEMINI_MODEL` property in `.env` (e.g., switch from `gemini-pro-latest` to `gemini-flash-latest`). Note that Flash has different capabilities, so re-verify results with Pro once quota issues resolve.
        - **Agent Switching**: Use the harness config to switch the active test agent entirely (e.g., from Gemini CLI to Claude Code).

## 4. Self-Improvement
After completion of an investigation, **you MUST update this skill** if you discover a new failure pattern or a more efficient investigation technique... or if anything about the investigation process was difficult or resulted in dead-ends. Use a ‘skill-creator’ skill to make effective updates.
