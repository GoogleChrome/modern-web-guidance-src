---
name: project-guide-validation
description: Protocol for validating the technical accuracy, framework nuances, and evaluation readiness of web guidance. Use this skill when assigned to validate or review a guide, demo, or expectations file.
---

# Guide Validation

This protocol defines the process for an AI agent to validate the technical accuracy, framework nuances, and evaluation readiness of web guidance. It ensures that guidance is not only correct according to documentation but also robust in practice across different framework reactivity models and target environments.

## Validation Checklist

When assigned to validate a guide, create a task list artifact based on this checklist and complete each phase:

- [ ] 1. Familiarization
- [ ] 2. Best Practices & Accessibility Review
- [ ] 3. Expectation Alignment
- [ ] 4. Testing and Verification with DevTools MCP (Includes starting server)
- [ ] 5. Manual Verification (Only if automated tests pass)
- [ ] 6. Feedback Report

---

## 1. Familiarization & Automated Inspection

Before performing qualitative or browser verification, read the `guide.md` file in its entirety and run the automated guide inspector:
*   **Understand the Problem & Solution**: Identify the core developer problem the guide addresses and the recommended API, property, or architectural approach.
*   **Run Automated Validation & Macro Inspection**: Run [scripts/inspect-guide.ts](./scripts/inspect-guide.ts) to validate frontmatter, `web-feature-ids`, markdown soundness, transclusion macros, and grader expectation coverage, and to inspect the exact macro-expanded markdown served to coding agents (`skills-cli` target):
    ```bash
    node .agents/skills/project-guide-validation/scripts/inspect-guide.ts guides/<category>/<slug>
    ```
*   **When Reviewing a PR (Splits, Merges, & Reorgs)**: Inspect existing review threads first to avoid duplicating open feedback or rehashing settled discussions. Compare full `BASE` and `HEAD` files (`git show <base_sha>:<path>`) bullet-by-bullet and code-block-by-code-block to catch silently dropped guidance or duplicate bullets, and check for stale `GUIDE_REF` or `INCLUDE` targets across `guides/` and `features/`.

## 2. Qualitative & Best Practices Review

Critically evaluate the guide's content against the authoring standards in [project-use-cases](../project-use-cases/SKILL.md), [project-guides](../project-guides/SKILL.md), and [project-evals](../project-evals/SKILL.md):
*   **Discipline Guides**: Check if there is a discipline guide for the relevant discipline, either a category root guide at `guides/<category>/<category>/guide.md` or a named guide registered in `DISCIPLINE_GUIDES` in `src/core/guide-validation.ts` (such as `guides/wasm/cpp-on-the-web/guide.md`). If one exists, ensure the guide complies with it (and ensure any new orientation guide is added to `DISCIPLINE_GUIDES`).
*   **Accessibility (A11y)**: Accessibility is a distinct concern that MUST **always** be evaluated. The canonical reference is `guides/accessibility/accessibility/guide.md`. Read it first, then apply it as follows:
    *   **`guide.md` under review**: MUST adhere to every applicable best practice across all sections of the canonical guide (landmarks/headings, ARIA roles, names/descriptions, focus management, keyboard navigation, alt text and SVG treatment, hints and validation, live regions, non-color state indicators, reduced motion, dialog/overlay semantics, and visibility hiding decisions). Recommendations and code samples must not contradict the canonical guide. Pay particular attention to copy-paste safety (code examples must embed the rules they mention, e.g. `prefers-reduced-motion`, `:focus-visible`, `aria-hidden`), multi-indicator state communication, AT-tree synchronization with visibility changes, and post-transition focus management.
    *   **`demo.html` under review**: NOT held to general a11y best practices — only required to faithfully demonstrate the patterns the `guide.md` prescribes. If the guide mandates a specific a11y pattern (e.g., `aria-live="polite"` on toasts, `aria-pressed` on a toggle, `prefers-reduced-motion` in CSS), the demo MUST show it. Do not flag demos for missing a11y features that the guide does not call out.
    *   **`expectations.md` under review**: SHOULD encode the a11y patterns that the guide prescribes as testable expectations, but MUST NOT include prose-only or manual-verification-only requirements that the grader cannot assert.
*   **Avoid Gating Critical Content**: Verify that the guide does not recommend interactive reveal patterns (e.g., following the cursor) that are inaccessible to non-pointer users. Ensure accessible alternatives are provided if such patterns are discussed.
*   **Internal Consistency & Spec Rigor**: Verify API/CSS claims against primary specs and [project-guides](../project-guides/SKILL.md) (token economy, `{# ... #}` maintainer comments vs. inline rationale, `BASELINE_STATUS` vs. `FEATURE_FALLBACKS`, upfront `GUIDE_REF` disambiguation, and no hard-coded browser support claims).
*   **Copy-Paste Safety**: Ensure that code examples are complete and safe to copy. If the text recommends a fallback or a constraint (like reduced motion), the code example **MUST** implement it.

## 3. Expectation Alignment

Review `expectations.md` against `guide.md`, `demo.html`, and primary specs/MDN/BCD to prevent both **false failures** (rejecting valid code) and **false passes** (passing broken code). Follow the authoring rules in [project-guides](../project-guides/SKILL.md#writing-expectationsmd); sibling `expectations.md` files are useful for calibrating scope and length but not phrasing, since many predate the plain-declarative convention.
*   **Accuracy & Contradictions**:
    *   **Traceability & Strength**: Map each expectation to the `guide.md` section it comes from. Flag expectations absent from the guide, expectations that strengthen or narrow guide wording (e.g., turning a *"Prefer"* or snippet detail into a required rule, or *"preceding"* into *"immediately before"*), and rules that the guide's own code examples, decision trees, or `demo.html` would fail.
    *   **Actionability**: The guide must provide clear instructions on *how* to meet each expectation. An agent should not have to guess the implementation to satisfy an expectation.
    *   **Spec & BCD Verification (`guide.md` is not infallible)**: Verify technical claims against specs (W3C, WHATWG, CSSWG), MDN, and BCD. Flag valid alternatives the expectation would reject, deprecated or renamed syntax (`masonry` vs. `grid-lanes`, `interesttarget` vs. `interestfor`), unit and property edge cases, and flawed feature-detection strings. Report `guide.md` errors separately from expectation issues.
    *   **Internal Consistency**: Flag direct contradictions or redundant overlaps between bullets in `expectations.md`.
*   **Coverage (Missing & Unnecessary)**:
    *   **Missing**: Identify core guide rules (`DO` / `DO NOT` / decision-tree branches, accessibility, overflow, focus order, fallbacks) and `demo.html` behaviors with no corresponding expectation, prioritized by how likely an agent is to get them wrong and how deterministically testable they are.
    *   **Unnecessary**: Cut items that are absent from `guide.md`, redundant, subjective or untestable (*"where content should determine the size"*), off-scenario, or so strict that they reject idiomatic correct code.
*   **Per-Expectation Grader Read**: Evaluate each bullet as the grader generator (`gd dev`) will interpret it when writing a test that must pass every golden solution patch and fail the zero-passrate patch:

| Check | Question |
|---|---|
| **Clear** | Is there one unambiguous reading with self-evident terms in plain declarative phrasing (no `MUST` / `SHOULD` boilerplate)? |
| **Succinct** | Is it a single requirement per bullet (no compound assertions)? |
| **Scoped** | Does every correct implementation of this use case satisfy it? If it is a discipline-guide bullet, does it name the element or feature it governs so the grader generator can judge relevance per base app? |
| **Correct** | Does it match both `guide.md` and the underlying spec/MDN/BCD without rejecting valid alternatives? |
| **Achievable** | Would all golden solutions (written by different agents) satisfy it, or would the generated test overfit to an example value or *"such as"* clause? |
| **Gradable** | Can it be verified deterministically—statically (DOM, CSSOM, or JS AST) or in-browser (computed style, accessibility tree, runtime behavior)—without human judgment or site-specific locators? |

## 4. Testing and Verification with DevTools MCP

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

## 5. Manual Verification

After automated testing with DevTools MCP, guide the user through manual verification of the demo. This helps confirm behavior across different environments and provides confidence in the solution.

### Instructions for the Agent:
1.  **Prerequisite**: Only proceed to manual verification if the automated tests in Step 4 passed or if specific cross-browser testing is required that DevTools cannot cover.
2.  **Provide Link**: Provide the user with the local server URL started in Step 4.
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

## 6. Feedback Report

After completing the validation steps, provide the user with a structured feedback report.

### Guidelines for the Report:
1.  **Summarize Findings**: Inform the user of what you found during verification (expectations, demo behavior).
2.  **Focus on Critical Issues**: Highlight critical gaps or correctness issues (e.g., "The polyfill is loaded unconditionally despite the guide saying it should be conditional"). Ignore minor nitpicks that do not affect the technical accuracy or user experience.
3.  **Make Recommendations**: If issues were found, make clear recommendations for fixes.
4.  **State Status**: Clearly state if the demo passed or failed automated and manual verification.
