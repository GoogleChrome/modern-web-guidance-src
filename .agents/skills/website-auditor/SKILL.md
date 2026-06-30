---
name: website-auditor
description: Audit a website URL against one or more modern web platform guides defined in this repository.
---

# Website Auditor Skill

This skill allows you to audit any website or local page URL against modern web guidance rules defined under the `guides/` directory.

## Triggering the Skill
This skill is triggered when the user requests an audit, validation, or compliance check of a website or URL against specific guides or categories (e.g., "Audit http://localhost:8089 against select-menu-interaction").

## Workflow

### 1. Locate the Guides
1. Identify the requested guide name or category from the user prompt.
2. Locate the guide's directory under the `guides/` folder.
   * If a specific guide name is provided (e.g., `select-menu-interaction`), find its folder.
   * If a general category/discipline is requested (e.g., "all forms guides"), find all subfolders containing `guide.md` in that category.
3. Read the `guide.md` file for each target guide to extract:
   * The core requirements.
   * Visual/behavioral states to look for.
   * Fallback requirements when modern APIs are missing.

### 2. Run the Browser Audit
For each target guide:
1. Launch the `browser_subagent` tool to audit the target URL.
2. Set `RecordingName` to a descriptive name (e.g., `audit_select_menu`).
3. Set the `Task` prompt for the subagent with the following instructions:
   * **Target URL**: Navigate to the specified URL.
   * **Verification Criteria**: List the exact requirements extracted from `guide.md`.
   * **Actions to Perform**:
     * Check if the target elements/attributes exist (e.g., specific tags, classes, or `aria-*` attributes).
     * Simulate fallback states if applicable (e.g., run a snippet using the browser subagent's JS tool to delete `window.someAPI` and reload/re-evaluate the page behaviour).
   * **Output**: The subagent must return a JSON-like report with a verdict (`PASS`, `FAIL`, or `N/A`) and a list of specific reasons or violations.

### 3. Aggregate & Report
1. Present the results to the user in a clean, professional table format showing:
   * Guide Name / Category
   * Verdict (PASS / FAIL / N/A)
   * Reasons / Violations list
2. Offer to automatically fix any source files if the audit target is a page hosted locally within this workspace.
