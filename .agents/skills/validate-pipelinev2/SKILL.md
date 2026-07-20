---
name: validate-pipelinev2
description: Instructions for validating the automated guidance pipeline v2 using GitHub Actions.
---

# Validate Pipeline v2 Skill

Use this skill when you need to validate the automated guidance pipeline (v2) using GitHub Actions and simulated human feedback.

## Principles

1.  **GitHub Actions First**: Kicking off a new workflow must be done via the GitHub CLI (`gh workflow run`), not by running scripts locally.
2.  **Workflow Awareness**: Be aware of the specific workflow files involved: `generate-guide.yml` and `handle-pr-review.yml`.
3.  **Remote Targeting**: Always target the correct remote (usually `paul` pointing to `[owner]/[repo]`) when running workflows.

## Operations to Perform

1.  **Push Changes to Remote**: Ensure the current working branch is pushed to the remote branch (e.g., `pipelinev2`) on the `paul` remote.
2.  **Trigger Guide Generation Workflow**: Use GitHub CLI to trigger the `generate-guide.yml` workflow.
3.  **Watch the Generation Run**: Find the run ID and watch it until completion or failure.
4.  **Simulate SME Review**: Once the PR is created by the workflow, submit a review with feedback.
5.  **Watch the Feedback Handler Run**: Watch the `handle-pr-review.yml` run triggered by the review.

## Useful GitHub CLI Commands

-   **Trigger Workflow**:
    ```bash
    gh workflow run generate-guide.yml --ref <branch-name> -f feature_id=<feature-id> -f reviewer=<reviewer-handle> --repo [owner]/[repo]
    ```
-   **List Runs**:
    ```bash
    gh run list --workflow <workflow-file> --repo [owner]/[repo]
    ```
-   **Watch Run**:
    ```bash
    gh run watch <run-id> --interval 60 --repo [owner]/[repo]
    ```

## Examples

### Kicking off a workflow for `intl-display-names`
```bash
gh workflow run generate-guide.yml --ref pipelinev2 -f feature_id=intl-display-names -f reviewer=paulirish --repo [owner]/[repo]
```
