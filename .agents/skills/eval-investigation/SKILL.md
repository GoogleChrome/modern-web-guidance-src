---
name: investigating-eval-results
description: >
  Analyzes Guidance evaluation results to identify patterns and causes of low pass rates.
  Use when investigating low guided pass rates, checking trajectories, or debugging eval grader failures.
---

# Investigating Eval Results

Terse cheatsheet for diagnosing agent calibration and guidance failures.

## 1. Quick Data Pull

```bash
# Get latest suite ID
gcloud storage ls gs://guidance-evals/

# Download evals.json for a specific suite
gcloud storage cp gs://guidance-evals/{suite_id}/evals.json .

# View local trajectory for a specific task
# (Found in harness/_results/{suite_id}/{task_dir}/trajectory.json)
```

## 2. Investigation Flow

1.  **Spot Grader Errors**: Search `evals.json` for "Error" to find failed assertions.
2.  **Verify Tool Presence**: Check `trajectory.json` -> `tool_definitions`.
    - If `guideUsed` is false, ensure MCP tools were actually discovered.
3.  **Audit Harness Logs**: Check `chat_log.txt` and `mcp-server.log`.
    - If `mcp-server.log` is missing, the server failed to start or discovery was skipped.
4.  **Catch Silent Skips**: For Gemini CLI, check `stderr` for "Skipping MCP discovery for untrusted folder".
    - Discovery-time errors often hide in `stderr`, not `stdout`.
5.  **Deduce Fallbacks**: Check if agent used JS (e.g., `addEventListener('scroll'...)`) instead of the CSS required by the task.

## 3. Observed Patterns & Solutions

-   **MCP Silent Skip**: GCLI skips discovery in untrusted folders.
    - *Fix*: Disable `folderTrust` in `settings.json` or set `GEMINI_CLI_INTEGRATION_TEST=true`.
-   **Salient changes in new files**: Agent adds new file (e.g., `rewards.html`); grader only checks `index.html`.
    - *Fix*: Update task frontmatter with `target_file`.
-   **Conflicting Image Sourcing**: Global instruction (e.g., "use stock photos") overrides local prompt.
    - *Fix*: Remove conflicting global `COMMON_APPEND_PROMPT` instructions.
-   **JS Fallback for CSS Tasks**: Agent uses JS due to missing guidance on modern CSS support.
    - *Fix*: Ensure MCP guidance tools are functional and suggest the optimal stack.
-   **Grader Locator Rigidity**: Graders use strict attribute checks (e.g., exact `id` or `class`) that fail on logically correct changes.
    - *Fix*: Relax grader assertions in task definition.
