---
name: investigating-eval-results
description: >
  Analyzes Guidance evaluation results to identify patterns and causes of low pass rates.
  Use when investigating low guided pass rates, checking trajectories, or debugging eval grader failures.
---

# Investigating Eval Results

This skill helps you diagnose why AI coding agents are failing evaluations, specifically looking for discrepancies between guided and unguided performance.

## 1. Accessing Data

### Via Command Line (Preferred)
If no browser is available, you can pull the raw `evals.json` from GCS.
```bash
# Get the latest suite ID from GCS or use a known one
gcloud storage ls gs://guidance-evals/

# Download the evals.json for a specific suite
gcloud storage cp gs://guidance-evals/{suite_id}/evals.json .
```

### Via Dashboard (Fallback)
If a browser is available, navigate to the dashboard (usually `http://localhost:{port}` or the GitHub Pages URL).
-   **Suite View**: Look for tasks where "Guided" scores are unexpectedly low.
-   **Trajectory View**: Open specific task trajectories to see the agent's step-by-step actions and grader failures.


## 2. Investigation Flow

1.  **Identify Failure Mode**: Look at the grader results in the JSON or dashboard.
    -   `Locator: locator('img[src*="hero-lcp.jpg"]') ... Error: element(s) not found`
2.  **Inspect Trajectories**: Check if the agent performed the right action but on the wrong file, or if it was confused by prompts.
3.  **Check Prompt Context**: verify if `COMMON_APPEND_PROMPT` or task frontmatter is providing conflicting instructions.

## 3. Some Observed Patterns & Solutions

-   **Salient changes in new files**: The agent adds a new page (e.g., `rewards.html`) but the grader only checks `index.html`.
    -   *Solution*: Update task frontmatter with `target_file: rewards.html`.
-   **Conflicting Image Sourcing**: The prompt specifies a filename but a global "prefer stock photos" instruction causes the agent to use external URLs.
    -   *Solution*: Remove conflicting global instructions and ensure grader locators are flexible or task prompts are specific.
-   **Grader Locator Rigidity**: Graders use strict attribute checks that fail even on correct logical changes.
    -   *Solution*: Relax grader assertions or fix the agent's tool usage pattern.

## 4. Self-Improvement
After completion of an investigation, **you MUST update this skill** if you discover a new failure pattern or a more efficient investigation technique... or if anything about the investigation process was difficult or resulted in dead-ends. Use a ‘skill-creator’ skill to make effective updates.
