---
name: investigating-eval-results
description: >
  Analyzes Guidance evaluation results to identify patterns and causes of low pass rates.
  Use when investigating low guided pass rates, checking trajectories, or debugging eval grader failures.
---

# Investigating Eval Results

This skill helps you diagnose why AI coding agents are failing evaluations, specifically looking for discrepancies between guided and unguided performance.

## 1. Accessing Data

### Running Locally (Preferred)
The fastest way to check a use case's pass rate is:
```bash
gd dev <path/to/use-case> --guided
```
This runs the grader and reports how many checks passed, where each check corresponds to a test in the use case's `grader.ts`.

To see **which specific tests failed**, open the Playwright results page:
```
guides/<category>/<use-case-slug>/test-app-results/1/<use-case-slug>-task/guided/grade-report/index.html
```
Open this in a browser to get a detailed view of each assertion's pass/fail status.

### Via GCS (Remote / Historical)
```bash
gcloud storage ls gs://guidance-evals/
gcloud storage cp gs://guidance-evals/{suite_id}/evals.json .
```


## 2. Investigation Flow

1.  **Run locally** with `gd dev <path/to/use-case> --guided` to get pass/fail counts.
2.  **Check which tests failed** by opening the `grade-report/index.html` Playwright results page.
3.  **Inspect the trajectory** to determine how (or whether) the agent used MCP tools. Trajectory files are at:
    ```
    guides/<category>/<use-case-slug>/test-app-results/1/<use-case-slug>-task/guided/session-<timestamp>.html
    guides/<category>/<use-case-slug>/test-app-results/1/<use-case-slug>-task/guided/session-<timestamp>.json
    ```
    Since files are timestamped, always use the **most recent** one. There are three distinct failure modes — each requiring a different fix:

    | Trajectory Pattern | Problem | Direction |
    |--------------------|---------|-----------|
    | Agent never calls MCP tools | Guide not discovered | Check tool availability, trust settings, MCP server logs |
    | Agent searches MCP but picks the wrong guide | Guide selection / search quality | Improve guide metadata, titles, or search keywords |
    | Agent picks the right guide but implements it wrong | Guide content quality | Improve the guide's instructions, examples, or specificity |

4.  **Check MCP Server Logs**: Look for `mcp-server.log` in the task directory. If missing, the server likely never started or discovery was skipped.
5.  **Verify Harness**: Ensure the agent harness (e.g., `gemini-cli-agent.ts`) captures both `stdout` and `stderr` — discovery failures often appear only in `stderr`.
6.  **Audit Trust Logic**: For Gemini CLI, check if `security.folderTrust.enabled` is silently blocking MCP discovery.

## 3. Some Observed Patterns & Solutions

-   **Missing MCP Tools (Silent Skip)**: GCLI skips MCP discovery in untrusted folders.
    -   *Solution*: Disable `folderTrust` in the harness `settings.json` or set `GEMINI_CLI_INTEGRATION_TEST=true`.
-   **Salient changes in new files**: The agent adds a new page (e.g., `rewards.html`) but the grader only checks `index.html`.
    -   *Solution*: Update task frontmatter with `target_file: rewards.html`.
-   **Conflicting Image Sourcing**: The prompt specifies a filename but a global instruction causes the agent to use external URLs.
    -   *Solution*: Remove conflicting global instructions.
-   **Grader Locator Rigidity**: Graders use strict attribute checks that fail even on correct logical changes.
    -   *Solution*: Relax grader assertions or fix the agent's tool usage pattern.
-   **JS Fallback for CSS Tasks**: Agent uses JS listeners instead of CSS scroll-driven animations because it lacks guidance on modern browser support.
    -   *Solution*: Ensure MCP guidance tools are available and suggest the optimal tech stack.

## 4. Self-Improvement
After completion of an investigation, **you MUST update this skill** if you discover a new failure pattern or a more efficient investigation technique... or if anything about the investigation process was difficult or resulted in dead-ends. Use a ‘skill-creator’ skill to make effective updates.
