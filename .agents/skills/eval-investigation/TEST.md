# Test Plan: investigating-eval-results

Verify that the skill provides concise, actionable guidance for debugging evaluation failures.

## Triggering

- **Prompt**: "Investigate why the guided pass rate for GCLI dropped in the latest eval."
- **Expected Outcome**: The agent should trigger the skill and immediately suggest checking `trajectory.json` or `evals.json` using the commands provided.

## Capabilities

### 1. Data Pulling
- **Test**: "How do I get the evals.json for suite full-2026-03-10-gcli?"
- **Expectation**: Provide the `gcloud storage cp` command with the correct path.

### 2. Diagnosis
- **Test**: "The MCP server didn't start for GCLI. What should I check?"
- **Expectation**: Suggest checking `stderr` for trust issues and verifying `folderTrust` in `settings.json`.

### 3. Pattern Recognition
- **Test**: "The grader is failing even though the agent added the hero image."
- **Expectation**: Mention checking if the agent added the image to a new file that the grader isn't inspecting (target_file issue).
