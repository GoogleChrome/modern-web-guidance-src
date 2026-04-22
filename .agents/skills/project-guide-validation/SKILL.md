---
name: project-guide-validation
description: Protocol for validating the technical accuracy, framework nuances, and evaluation readiness of web guidance. Use this skill when assigned to validate or review a guide, demo, or expectations file.
---

# Guide Validation

This protocol defines the process for an AI agent to validate the technical accuracy, framework nuances, and evaluation readiness of web guidance. It ensures that guidance is not only correct according to documentation but also robust in practice across different framework reactivity models and target environments.

## Validation Checklist

When assigned to validate a guide, create a task list artifact based on this checklist and complete each phase:

- [ ] 1. Familiarization
- [ ] 2. Source Verification
- [ ] 3. Best Practices & Accessibility Review
- [ ] 4. Expectation Alignment
- [ ] 5. Testing and Verification with DevTools MCP (Includes starting server)
- [ ] 6. Manual Verification (Only if automated tests pass)
- [ ] 7. Feedback Report

---

## 1. Familiarization

Before performing any verification, read the `guide.md` file in its entirety:
*   **Understand the Problem**: Identify the core issue the guide is addressing (e.g., reactive state drift, layout shift, performance bottleneck).
*   **Identify the Solution**: Understand the recommended API, property, or architectural approach (e.g., Temporal API, container queries, scheduler.yield).
*   **Contextualize**: Get familiar with the overall structure and flow of the guidance before checking external sources or running tests.

## 2. Source Verification

Before finalizing any guide, verify all sources listed in the guide:
*   **Relevance**: Go through each listed source and ensure it is actually relevant to the use case and the feature described.
*   **Alignment**: Check that the guidance accurately aligns with the information provided in the sources. Ensure no contradictions or misunderstandings of the technical spec or documentation.

## 3. Qualitative & Best Practices Review

Critically evaluate the guide's content to ensure it follows established best practices and does not introduce anti-patterns:
*   **Discipline-Specific Skills**: Check if there are finalized "production ready" skill files for the relevant discipline located at `guides/<discipline>/skill.md`. If they exist, ensure the guide complies with them.
*   **Accessibility (A11y)**: Even if a specific accessibility skill file is not yet finalized, accessibility is a distinct concern that should **always** be present. Evaluate the guide against general accessibility best practices based on your own training data (e.g., contrast, motion, focus management, ARIA usage).
*   **Internal Consistency**: Ensure no deviations from existing skills or established patterns in the project.
*   **Copy-Paste Safety**: Ensure that code examples are complete and safe to copy. If the text recommends a fallback or a constraint (like reduced motion), the code example **MUST** implement it.

## 4. Expectation Alignment

Ensure that the `expectations.md` file (used for evaluation) aligns perfectly with `guide.md`:
*   **Traceability**: Every expectation should be traceable back to a specific recommendation in the guide. Do not create expectations for behaviors not covered in the guidance.
*   **Actionability**: The guide must provide clear instructions on *how* to meet each expectation. An agent should not have to guess the implementation to satisfy an expectation.
*   **Outcome Focus**: Expectations should focus on the observable output and behavior (e.g., "The UI correctly updates when the date is modified"), not the specific implementation approach (unless strictly required by the guide's constraints).

## 5. Testing and Verification with DevTools MCP

Always use the **DevTools MCP** server to test the demo associated with the guide. This drives testing autonomously without requiring manual user interaction.

### Steps for Verification:
1.  **Start Local Server First**: Before opening the page with DevTools MCP, start a lightweight HTTP server (e.g., using `python3 -m http.server 8080` or `npx http-server` in the background via `run_command`) to serve the demo file. This ensures that polyfills and modules load correctly for both automated and manual tests, avoiding issues with the `file:///` protocol.
2.  **Load the Demo**: Use `mcp_chrome-devtools-mcp_new_page` to open the demo via the local server URL (e.g., `http://localhost:8080/demo.html`).
3.  **Exercise the Demo Fully**: Interact with the demo to test every corner of the use case and exercise all available options. Use `mcp_chrome-devtools-mcp_click`, `mcp_chrome-devtools-mcp_type_text`, etc.
4.  **Verify Alignment**: If any part of the demo behavior does not align with the guidance in `guide.md`, ask the user to help reconcile which one needs to be fixed.
5.  **Stop if Broken**: If the automated test fails to demonstrate the expected behavior or shows critical correctness issues, **STOP** here. Do not proceed to manual verification. Fix the issue or report it in the feedback report.

### Baseline and Fallback Verification
*   **Target Baseline**: The demo file should always assume a baseline target of **widely available**.
*   **Check Status**: Use the `baseline-status` skill (by reading its `SKILL.md` file) to learn how to query the status of any given feature.
*   **Fallback Requirement**: If a feature is NOT widely available, the demo file MUST demonstrate how the fallback strategy described in the guide should be used.

## 6. Manual Verification

After automated testing with DevTools MCP, guide the user through manual verification of the demo. This helps confirm behavior across different environments and provides confidence in the solution.

### Instructions for the Agent:
1.  **Prerequisite**: Only proceed to manual verification if the automated tests in Step 5 passed or if specific cross-browser testing is required that DevTools cannot cover.
2.  **Provide Link**: Provide the user with the local server URL started in Step 5.
3.  **Guide the User**: Provide the user with clear, step-by-step instructions on how to interact with the demo manually.
    *   Specify what to click on or what inputs to provide.
    *   Describe what they should look for to confirm success or failure.
4.  **Test in Supported and Unsupported Browsers**:
    *   **Supported**: Chrome is the target for DevTools MCP, but encourage the user to also try it themselves via the local server link.
    *   **Unsupported**: Identify a browser that does not support the feature (using the `baseline-status` skill). Suggest testing in a browser that lacks support to verify the fallback behavior.
5.  **Handle "Newly Available" Features**: If the feature is newly Baseline and it is hard to find an unsupported browser version, guide the user to perform a **static evaluation of the code** (e.g., checking for feature detection and fallback logic in the source).
6. **Success Criteria**: Explain clearly how the user can convince themselves that the demo illustrates a correct implementation of the use case.

### Common Failure Patterns to Watch For:
- **`ReferenceError: Can't find variable: Temporal` (Safari)**: Often caused by race conditions between dynamic polyfill loading and application execution, or by `file:///` protocol restrictions.
- **Unconditional Polyfill Loading**: Using a standard `<script>` tag for a polyfill violates project standards; it must be conditionally loaded.
- **Implementation-Prescriptive Expectations**: Watch for expectations that mandate a specific syntax (e.g., `typeof Temporal === 'undefined'`) instead of a functional outcome.

## 7. Feedback Report

After completing the validation steps, provide the user with a structured feedback report.

### Guidelines for the Report:
1.  **Summarize Findings**: Inform the user of what you found during verification (sources, expectations, demo behavior).
2.  **Focus on Critical Issues**: Highlight critical gaps or correctness issues (e.g., "The polyfill is loaded unconditionally despite the guide saying it should be conditional"). Ignore minor nitpicks that do not affect the technical accuracy or user experience.
3.  **Make Recommendations**: If issues were found, make clear recommendations for fixes.
4.  **State Status**: Clearly state if the demo passed or failed automated and manual verification.
