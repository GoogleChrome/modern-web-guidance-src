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
- **Success Rate Goal**: The ultimate objective of every investigation is to achieve a **100% Guided Pass Rate**. The unguided pass rate does not matter and can be ignored.
- **Autonomous Initiative & Iteration**: An investigation is not a single pass. You must autonomously loop through fixing files, re-running evaluations, measuring progress, and rolling back failed attempts until you hit 100% success. Never stop early, and run tests multiple times to ensure your fix is consistently non-flaky.

## Communication Protocol

Because evaluation runs (`gd eval`) take time, check in with the user approximately every **30 seconds** to provide a helpful narrative summary of what the agent is currently doing.

Whenever you summarize progress during these check-ins, you **MUST**:
1. Include a direct quote or code block of the underlying log lines to substantiate your update.
2. Provide a clickable markdown link to the specific log file being referenced so the user can click through to see the full contents.

However, **NEVER include timestamps** in your updates, as they add absolutely zero value to the user.

**Example of a good check-in:**
> The agent has successfully retrieved the reference guidance using the modern web skill:
> ```json
> [Modern Web Log]: {"tool":"get_best_practices"}
> ```
> Reference: [task-log](file:///path/to/log/file.log)

**Example of a bad check-in:**
> The agent is currently executing a command to update the workspace CSS files! (timestamp: 00:22:21Z)

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

## 2. Investigation Checklist

To guarantee full adherence to this protocol, you **MUST output this exact verification checklist at the very beginning of your first response to the user** to establish your operational plan, and continuously update it as you complete each step:

1. [ ] **Step 1: Audit the Prompt First** - Verified the target prompt in `tasks/task.md` is valid, non-prescriptive, and completely devoid of hardcoded technical APIs or explicit fallback requirements.
2. [ ] **Step 2: Execute Evals & Check Base App** - Ran `gd eval` to establish a baseline and confirmed the base app (`index.html`) contains the necessary structural elements to support the required implementation.
3. [ ] **Step 3: Inspect Results & Verify Tool Activation** - Reviewed the pass rates in `evals.json` and confirmed that the agent successfully discovered and utilized the relevant reference guide.
4. [ ] **Step 4: Validate Grader Tolerance (False Negatives)** - Confirmed via `gd dev --test-grader` that the grader successfully passes a correct implementation (`demo.html`) and accurately fails an incorrect one (`negative-demo.html`) without relying on overly rigid regular expressions.
5. [ ] **Step 5: Validate Guidance Coverage (True Negatives)** - Verified that all success criteria evaluated by the grader are explicitly documented as `MANDATORY` requirements in `guide.md`.
6. [ ] **Step 6: Trace the Trajectory** - Read the agent's local execution thought logs (`session-*.json`) to diagnose and resolve any search query mismatches or silent implementation rejections.
7. [ ] **Step 7: Final Integrity Audit** - Conducted a strict final review against all skill best practices to confirm that the 100% Guided Pass Rate was earned honestly and completely.

### Step 1: Audit the Prompt First (`tasks/task.md`)
- **Mandatory Substantiation**: When reporting the completion of this step, you MUST explicitly quote the target prompt to the user and summarize exactly why it adheres to all non-prescriptive guidelines.
- **Solution Agnostic**: Ensure the prompt describes the **user problem or outcome**, not the technical solution. If it explicitly names the API or feature (e.g., "Use the Temporal API"), any high pass rate is a false positive.
- **Command vs Question**: Ensure the prompt uses imperative language (e.g., `"Add a section..."` or `"Modify the layout..."`) rather than asking an open-ended question (`"How can I..."`).
- **Explicit Target File (Optional)**: If an ambiguous prompt causes the agent to create new files instead of modifying existing ones, explicitly name the target file (e.g., `"in index.html"`) to guide it correctly. This is only necessary if the grader is strictly locked to that specific file.
- **Legacy Fallbacks Are Automatic**: Prompts should almost never need to mandate that legacy fallbacks are applied. If the agent successfully discovers and reads the relevant guide, it will automatically follow any documented fallback requirements.
- **Base App Alignment**: If the prompt instructs the agent to modify an existing element, confirm that such an element actually exists in the base app template.
- **Prescriptive Constraints vs Open Solutions**: Update the prompt to prescribe specific validation constraints (such as IDs, class names, or resource filenames) if the grader requires them. However, **never** be prescriptive about the specific web platform mechanism.
  > [!IMPORTANT]
  > **Functional Locators vs. Technical Solutions**
  > It is completely acceptable (and sometimes necessary) to mandate specific DOM IDs or CSS classes (e.g., `"add a .fan-card class"`) if the grader requires them to locate elements. What is strictly banned is mandating the underlying implementation technology (e.g., commanding the model to `"use sibling-index()"` or `"use the Temporal API"`).
- **Mandatory List Formatting**: The `task.md` file **must always be formatted as a markdown list** (`- item`). Even though the file may contain multiple unused prompts for future expansion, remember that the evaluation harness currently **only executes the very first list item**.
- **No Line Breaks in the Target Prompt**: Anything you want included in the prompt that actually gets evaluated must be entirely contained on the first bullet point line without any line breaks.
- **Over-Prescription "Smell"**: If both the unguided and guided tests pass at 100%, this is a strong code smell indicating that your prompt may be overly prescriptive and practically giving away the modern solution.
- **Always Re-Run**: Because prompting is highly sensitive, you MUST immediately re-run `gd eval` after any change to validate its effectiveness.

### Step 2: Execute Evals & Report Results
- Run `gd eval <path/to/use-case>` to execute the test suite.
- **Check-in Requirement (Meaningful Trajectory & RAG Guidance Only)**: Because this command takes time, you must check in with the user approximately every **30 seconds** while it runs. When providing these updates, **NEVER output noisy internal JSON tool executions for file edits (e.g., `read`, `repl`, `write_file`, etc.)**. These provide zero value to the user. You MUST exclusively quote domain-relevant activations:
  1. **Guidance Activations**: When the agent successfully uses the search or retrieval mechanisms against the `modern-web` MCP server to find our specific reference documentation.
  2. **Agent Reasoning**: When the agent's natural language thought trajectory explicitly explains its technical strategy for solving the problem.
  3. **Playwright Output**: When the test suite produces a final failure or success status.
- **Results Table Requirement**: Whenever you report evaluation results to the user, you **MUST** format them as a markdown table containing the use case name, the unguided pass rate, the guided pass rate, and an indicator showing whether the reference guide was successfully used.

**Example Output Format:**
| Use Case | Unguided Pass Rate | Guided Pass Rate | Guide Used |
| :--- | :--- | :--- | :---: |
| `customize-scrollbar` | 0% (0/5) | 100% (5/5) | ✅ |

### Step 3: Inspect Results (`evals.json`)
- Check the top-level summary in `evals.json` to compare unguided vs. guided pass statuses.
- **Crucial Discovery Check**: One of the very first things to verify is whether the use case's guidance file was discovered and used by the agent. 
  - **If it wasn't used (Tool Evasion)**: No amount of guide or grader changes will matter. You must immediately fix the prompt in `tasks/task.md` to force discovery:
    - **CRITICAL RULE**: The primary skill's description (`modern-web-use-cases/SKILL.md`) is **OFF-LIMITS**. It is carefully tuned for general system health and must **never** be modified on a use-case by use-case basis.
    - **Constraint Forcing (Correct Approach)**: Modify the prompt to introduce strict performance, layout, or declarative synchronization constraints that legacy methods cannot satisfy. This naturally forces the agent to recognize a gap in its training data and retrieve the reference guide.
    - *Force Discovery (Temporary Check)*: Append `"use the modern web skill"` to isolate discovery failures from implementation bugs, but ensure you remove this before your final integrity audit.
    - Always re-run `gd eval` immediately after updating the prompt.
  - **If it was used**: This successfully narrows down the problem space to either the grader calibration or the specific implementation instructions in the guide.

### Step 4: Validate Grader Tolerance (False Negatives)
- **Eyeball the Implementation (`index.html`)**: If the guide was referenced but failures persist, visually verify the agent's output in `index.html`. 
- Determine if the agent implemented the use case correctly **in spirit**. 
- If the output looks correct but the grader failed it, you have found a **false negative**. 
- Update `grader.ts` to be more tolerant and resilient (e.g., removing overly rigid or brittle regular expressions).
- **Expectations Alignment**: If you substantively change the grader file, you must ensure that the `expectations.md` file stays in tight 1:1 alignment with the new test logic.
- **Calibration Verification**: After editing the grader, immediately run `gd dev <path/to/use-case> --test-grader` to confirm that your updates did not break calibration against the standard `demo.html` and `negative-demo.html` reference files.

### Step 5: Validate Guidance Coverage (True Negatives)
- If the generated output in `index.html` is genuinely incorrect or missing required features, the agent failed due to a **true negative**.
- **Clarify Requirements (`guide.md`)**: Update the guide to explicitly highlight mandatory steps using strong keywords like `"MANDATORY:"` and provide concrete code examples.
- **Compare Guide vs Expectations**: Directly cross-reference `expectations.md` against `guide.md`. Make absolutely sure that every single grading criteria is explicitly documented in the guide, as agents cannot be expected to implement undocumented rules.
- Map any other unexplainable trajectory behavior to the failure patterns listed in **Section 3**.

### Step 6: Trace the Trajectory (`session-<timestamp>.json`)
- If the failure persists despite perfect prompts and guides, read the agent's exact thought process to uncover hidden logic traps:
  1. **Search Query Mismatch**: Did the agent search for a generic phrase (e.g., "custom animations") but the relevant guide required a highly specific keyword? 
     - *Action*: Add the agent's exact search string as a keyword to the guide's metadata so it naturally surfaces in future runs.
  2. **Guide Disambiguation**: Did the agent find the right guide but select a competing one instead because their descriptions overlapped too heavily?
     - *Action*: Disambiguate the metadata descriptions of both guides so their unique use cases are crystal clear.
  3. **Silent Rejection**: Did the agent read the guide but explicitly decide to ignore a crucial instruction (e.g., deciding a fallback rule wasn't necessary)?
     - *Action*: Use strict directive keywords like `"MANDATORY:"` or `"CRITICAL:"` in the guide to override the agent's pre-trained biases.

### Step 7: Integrity Audit (Mandatory Final Review)
- **Mandatory Substantiation**: When concluding the investigation, you MUST provide a final Markdown table showing the exact outcome:
  | Use Case | Unguided Pass Rate | Guided Pass Rate | Guide Used |
  | :--- | :--- | :--- | :---: |
  | `style-parent-with-has` | 0% (0/5) | 100% (5/5) | ✅ |
- After you successfully achieve a **100% Guided Pass Rate**, you must perform a strict final audit of your changes to ensure no steps were skipped.

## 3. Some Observed Patterns & Solutions

-   **Tool Evasion (Agent Completely Bypasses Guidance Tools)**: 
    -   *Investigation*: Check `evals.json` and confirm `guideUsageRate` is 0.
    -   *Solution*: Apply **Constraint Forcing** to the prompt in `tasks/task.md`. Introduce non-negotiable declarative layout, rendering, or synchronization constraints that legacy web technologies cannot resolve. This naturally drives the agent to look up the reference guide.
-   **Search Mismatch (Agent Searches Skills but Picks the Wrong Guide)**:
    -   *Investigation*: Verify in the trajectory which guide titles or keywords the agent searched for versus what the metadata returned.
    -   *Solution*: Improve the guide's metadata description, title, or associated search keywords so that it ranks higher or explicitly matches likely agent queries.
-   **Missing Skill Tools (Silent Skip)**: GCLI skips tool discovery in untrusted folders.
    -   *Solution*: Disable `folderTrust` in the harness `settings.json` or set `GEMINI_CLI_INTEGRATION_TEST=true`.
-   **Conflicting Image Sourcing**: The prompt specifies a filename but a global instruction causes the agent to use external URLs.
    -   *Solution*: Remove conflicting global instructions.
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
