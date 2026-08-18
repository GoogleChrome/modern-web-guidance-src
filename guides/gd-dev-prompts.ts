/**
 * Centralized, typed prompt builder functions for the gd dev evaluation generation process.
 * 
 * Having these prompts in one dedicated module ensures high visibility, easy tuning of AI
 * behavior across target capsules (patches, grader.ts, task.md), and
 * type-safe parameter interpolation.
 */

import { type SolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, REPORT_FILE } from '../lib/guide-validation.ts';
import { Agents } from '../harness/config.ts';
import type { TargetEvalSummary } from './lib/dev-report.ts';

export interface PatchPromptOptions {
  guideFile: string;
  expectationsFile: string;
  workDir: string;
}

export function buildSolutionPrompt(opts: PatchPromptOptions): string {
  return `# GOAL
Modify the web application codebase in the directory \`${opts.workDir}\` to perfectly implement the guidance and satisfy all must-pass expectations in \`${opts.expectationsFile}\`.

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Verification Requirements**: \`${opts.expectationsFile}\`

# RULES
1. Do NOT modify \`${opts.guideFile}\` or \`${opts.expectationsFile}\`.
2. Ensure your implementation is robust, complete, and type-safe.
3. Your changes MUST compile cleanly. You can run \`npm run build\` inside your workspace to verify.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export function buildZeroPassratePrompt(opts: PatchPromptOptions): string {
  return `# GOAL
Inspect the clean codebase in the directory \`${opts.workDir}\`. Your goal is to ensure the codebase does NOT implement any part of the feature described in \`${opts.guideFile}\` and does NOT satisfy any criteria in \`${opts.expectationsFile}\`.

If the codebase is already clean of this feature (meaning the feature is not present and assertions verifying the feature would naturally fail), do NOT modify any files (leave the workspace unchanged).

If the codebase already contains partial, complete, or conflicting implementations of the feature, disable, unset, revert, or remove those implementations.

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`

# RULES
1. **No-Op by Default**: If the clean codebase does not have the feature implemented, do NOT modify any files.
2. **Realistic Baseline**: If you make modifications, make sure they resemble a realistic baseline state of the application where the feature is absent. Do NOT write buggy or obviously broken code, and do NOT add any comments, messages, or placeholders indicating that this is a simulated, test, or baseline state.
3. Do NOT modify \`${opts.guideFile}\` or \`${opts.expectationsFile}\`.
4. Ensure your modifications are robust, complete, and type-safe.
5. Your changes MUST compile cleanly. You can run \`npm run build\` inside your workspace to verify.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface GraderPromptOptions {
  guideFile: string;
  expectationsFile: string;
  solutionPatchFiles: Partial<Record<SolutionAgent, string>>;
  zeroPassratePatchFile: string;
  graderFile: string;
  baseApp: string;
  templateFile: string;
  testFixtureReferencePath?: string;
  parserPatternLibraryPath?: string;
  playwrightPatternLibraryPath?: string;
  tsMorphDtsPath?: string;
  linkedomDtsPath?: string;
  failureContext?: string;
}

// TODO: Future CSSOMNom OSPO integration
// When the cssomnom package is published to npm and installed in guides/package.json,
// update Rule 2 (Assertion Hierarchy) in buildTargetGraderPrompt and the CSS test example in template.grader.ts to use CSSOMNom AST verification instead of regex.
export function buildTargetGraderPrompt(opts: GraderPromptOptions): string {
  const contextBlock = opts.failureContext
    ? `### ⚠️ PREVIOUS FAILURE CONTEXT
The previous grader failed calibration with this error:
\`\`\`
${opts.failureContext}
\`\`\`
Analyze this failure and modify the existing grader file to fix these assertions while still adhering to all rules below.

---
`
    : '';

  const agentLabels: Record<SolutionAgent, string> = {
    [Agents.GEMINI_CLI]: 'Gemini CLI',
    [Agents.JETSKI_CLI]: 'Jetski CLI',
    [Agents.CLAUDE_CODE]: 'Claude Code',
    [Agents.CODEX_CLI]: 'Codex CLI',
  };

  const solutionList = Object.entries(opts.solutionPatchFiles)
    .filter(([_, file]) => Boolean(file))
    .map(([agent, file]) => `   - ${agentLabels[agent as SolutionAgent] || agent} Solution: \`${file}\` (must pass 100% of tests)`)
    .join('\n');

  const patchInstruction = opts.failureContext
    ? `\n\n> [!NOTE]\n> If you determine that the calibration is failing because any of the golden solution patches or the zero-passrate patch (\`${opts.zeroPassratePatchFile}\`) has a bug, is missing required code, or is not broken in the correct way, you have permission to edit them directly. Any changes you save to the patch files in your workspace will be saved and verified in the next calibration attempt.`
    : '';

  return `${contextBlock}# GOAL
Write a Playwright test script named \`${opts.graderFile}\` that directly validates the implementation requirements defined in \`${opts.expectationsFile}\` for the \`${opts.baseApp}\` web application. The grader must be robust enough to pass 100% against all golden solution diffs, as developers using different AI tools will implement valid variations of the requirements.${patchInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`
3. **Golden Solution Diffs**:
${solutionList}
4. **Anti-Pattern Zero-Passrate Diff**: \`${opts.zeroPassratePatchFile}\` (must fail 100% of tests)
5. **Boilerplate Template**: \`${opts.templateFile}\`

# VERIFICATION & SCOPING RULES

## 1. Strictly Follow the Boilerplate Template
Base your grader's imports, workspace setup, helper function usage, and test structure on \`${opts.templateFile}\`. Use the template's helpers (\`getTargetFiles\`, \`extractAllCss\`, \`getJsProject\`, \`getHtmlDocuments\`) to dynamically locate and analyze modified code across standalone files and embedded template tags. Never hardcode file paths.

## 2. Assertion Hierarchy
- **Static Analysis First**: Prioritize static analysis over browser execution for structural assertions.
- **Browser Checks Only When Necessary**: Only write browser-based Playwright E2E tests when strictly necessary (for requirements that cannot be verified statically, such as runtime click events or dynamic state updates). Omit browser test blocks entirely if static checks are sufficient.
- **Reference Examples & API Definitions**: Before writing tests, use your file-viewing tools to inspect these reference pattern libraries and API type definitions for implementation patterns:
  - **Test Fixture Helper Signatures (Reference Only)**: [test-fixture.reference.ts](file://${opts.testFixtureReferencePath})
  - **Static Analysis Patterns (Linkedom, ts-morph)**: [parser-pattern-library.test.ts](file://${opts.parserPatternLibraryPath})
  - **Browser Analysis Patterns (Playwright)**: [playwright-pattern-library.grader.ts](file://${opts.playwrightPatternLibraryPath})
  - **TS Morph Type Definitions**: [ts-morph.d.ts](file://${opts.tsMorphDtsPath})
  - **Linkedom Type Definitions**: [index.d.ts](file://${opts.linkedomDtsPath})

## 3. Granular Assertions: Single Assertion per Test
Write only one assertion per \`test('...', ...)\` block across both static and browser tests. Do not combine multiple assertions into a single test block. This ensures precise, unambiguous error reporting during calibration if a test fails.

## 4. Precision & Matching Rules
- **Outcome-Based Assertions**: Verify structural and functional requirements in static checks rather than forcing a single narrow implementation when valid alternatives exist.
- **Flexible Pattern Matching**: Avoid exact-string equality for dynamic names or classes. Use loose matches, inclusion checks, and word boundaries (e.g., \`/\\bname\\b/\`) to avoid substring false positives.
- **No Swallowed Errors**: Do not wrap assertions in generic try/catch blocks that swallow exceptions.

## 5. Dependencies & Sandbox Constraints
Do not install any npm packages or execute application dev/build commands (like astro build or vite build) in your workspace. However, you MUST verify that your generated grader code compiles cleanly. Run this command in your workspace to check for TypeScript compilation/syntax errors and fix them before ending your turn:
\`npx tsc --noEmit --skipLibCheck --target esnext --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --esModuleInterop grader.ts\`

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface TaskPromptOptions {
  guideFile: string;
  taskFile: string;
  baseApp: string;
}

export function buildTargetTaskPrompt(opts: TaskPromptOptions): string {
  return `# GOAL
Examine the codebase files of the web application \`${opts.baseApp}\` and read the \`description\` in the frontmatter of \`${opts.guideFile}\` to understand the use case.
Generate a \`${opts.taskFile}\` file containing exactly one realistic, high-level test prompt that a web developer would send to an AI coding assistant to request the overall use case inside the application.

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Target File Name**: \`${opts.taskFile}\`

# RULES
1. **Focus on the Guide Description**: The prompt must request the overall desired user outcome based specifically on the **description** in the frontmatter of \`${opts.guideFile}\`, keeping the request simple, high-level, and generic.
2. **No Technical/API Dictation**: Do NOT dictate the underlying technical implementation. NEVER name specific web platform APIs, framework features, or explicit CSS properties or functions (e.g. do NOT say "use @view-transition", "use active-view-transition-type", or "use pagereveal"). Describe the desired user outcomes instead.
3. **No Specific Details or Sub-Features**: Do NOT list or specify implementation details, custom sub-features, or edge cases (such as directional animations or accessibility preferences) that are not explicitly stated in the frontmatter description of \`${opts.guideFile}\`.
4. **Format**: Format \`${opts.taskFile}\` strictly as a single line prefixed with "- ", containing absolutely no internal line breaks.
5. **Casuality & Tone**: Write the prompt as a developer talking to an AI coding assistant.
6. **Directive Action Request**: Phrase the prompt as an ACTION REQUEST or directive (e.g., "implement X", "modify Y"). NEVER phrase it as an advisory question (e.g., "how can I?", "what's the best way to?") — the agent must implement, not just explain.
7. **No Fallbacks**: Do NOT mention or mandate legacy fallbacks in the prompt.
8. **No Internal Project References**: Do NOT name the guide itself or indicate that guidance exists.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface DevReportPromptOptions {
  guideName: string;
  targets: TargetEvalSummary[];
}

export function buildDevReportPrompt(opts: DevReportPromptOptions): string {
  const targetSections = opts.targets.map(t => {
    return `### Target: \`${t.baseApp}\`
- **Issue Flagged**: \`${t.flag}\`
- **Flag Details**: ${t.flagDetails}`;
  }).join('\n\n');

  return `# GOAL
Analyze the evaluation test results across all target applications for the guide \`${opts.guideName}\`, conduct a thorough root-cause investigation for each target based on its flagged status, and complete the \`### Diagnostic Analysis & Actionable Recommendations\` section under each target in \`${REPORT_FILE}\`.

# INPUTS
1. **Guide**: \`${GUIDE_FILE}\`
2. **Expectations**: \`${EXPECTATIONS_FILE}\`
3. **Target Capsule Directories**: For each target, inspect the artifacts in \`targets/<target>/\`:
   - \`task.md\` (developer test prompt)
   - \`grader.ts\` (Playwright validation suite)
   - \`patches/zero-passrate.patch\` (anti-pattern baseline)
   - \`patches/*-solution.patch\` (golden solution diffs)
4. **Target Evaluation Reports & Flags**:
${targetSections}

Note: \`${REPORT_FILE}\` is already seeded with each target's \`### Evaluation Results\` (copied directly from \`evals.md\`). Your task is to investigate the artifacts and fill in \`### Diagnostic Analysis & Actionable Recommendations\` under each target.

# SYSTEM WORKFLOW CONTEXT
To accurately diagnose failures, understand how \`gd dev\` generates and executes these components:
1. **Ground Truth**: \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` define the canonical implementation and must-pass requirements.
2. **Patches**: Golden solution diffs and the zero-passrate baseline are generated from \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\`.
3. **Task Prompt**: \`task.md\` is generated from the \`description\` frontmatter of \`${GUIDE_FILE}\` and the target app's codebase.
4. **Grader**: \`grader.ts\` validates the requirements in \`${EXPECTATIONS_FILE}\` against the application workspace and is calibrated against the golden patches (must pass 100%) and zero-passrate patch (must fail 100%).
5. **Agent Evaluation Run**: The agent executes the \`task.md\` prompt against each target app without guidance (\`unguided\`) and with guidance (\`guided\`), and results are verified with \`grader.ts\`.

# ROOT-CAUSE DIAGNOSIS RULES (BY PRIMARY FLAG)

Diagnose each target according to its assigned flag:

1. **\`INFRASTRUCTURE_ERROR\`**:
   - The test run failed due to execution timeouts, agent CLI process crashes, rate limits (429), or missing setup files.
   - Explain the error context. No code file modifications are needed unless the issue stems from an invalid build/package configuration.

2. **\`MISSING_GUIDANCE_TOOL\`**:
   - The guided agent did not invoke \`modern-web-guidance\`.
   - **Diagnosis**: State that the test prompt in \`task.md\` failed to activate modern web guidance during the agent's run.
   - **Recommendation**: Recommend that the prompt in \`targets/<target>/task.md\` be revised so that the request more clearly prompts an agent to look up modern web platform guidance.

3. **\`MISSING_EXPECTED_GUIDE\`**:
   - The guided agent invoked guidance tools, but \`${opts.guideName}\` was not among the consumed guides.
   - **Culprit**: \`targets/<target>/task.md\` or the \`description\` in \`${GUIDE_FILE}\`.
   - **Root Cause**: The prompt keywords failed to match the guide's indexing keywords or description frontmatter.
   - **Recommendation**: Provide concrete edits for \`targets/<target>/task.md\` or the frontmatter \`description\` in \`${GUIDE_FILE}\`.

4. **\`LOW_GUIDED_PASS_RATE\`**:
   - The guided agent pass rate is under 90%.
   - **Root Cause Investigation**: Review the failed assertions in \`${REPORT_FILE}\` and examine \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, and \`targets/<target>/grader.ts\` to understand why the agent fell short. Consider:
     - **Guidance Quality (\`${GUIDE_FILE}\`)**: Does the guide lack essential modern web practices, clear syntax examples, fallback patterns, or common pitfalls?
     - **Expectations Alignment (\`${EXPECTATIONS_FILE}\`)**: Are the must-pass expectations ambiguous, conflicting, or missing key constraints?
     - **Grader Robustness (\`targets/<target>/grader.ts\`)**: Is the grader failing valid implementations due to brittle regex, rigid file/syntax assumptions, or over-constrained assertions rather than testing observable outcomes?
   - **Recommendation Rules (Mutually Exclusive)**:
     - **Source-of-Truth Fixes**: If \`${GUIDE_FILE}\` or \`${EXPECTATIONS_FILE}\` needs changes, recommend modifications **ONLY** to those files and **DO NOT** recommend edits to any files in \`targets/\`. Always append:
       \`*(Note: After modifying source files, delete the targets/ directory and re-run gd dev to regenerate all target artifacts)*\`
     - **Grader Fixes**: Only recommend direct edits to \`targets/<target>/grader.ts\` if \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` require **NO** changes.

5. **\`HEALTHY\`**:
   - The target achieved ≥ 90% guided pass rate with all guidance tools and guides correctly consumed.
   - **No investigation or fixes needed**: State that the target is healthy, guidance was consumed as expected, and all assertions passed.
   - **Actionable Recommendations**: Output \`- None (target is healthy and verified).\`

# REPORT OUTPUT REQUIREMENTS

For each target in \`${REPORT_FILE}\`, complete the diagnostic section matching this structure:

\`\`\`markdown
### Diagnostic Analysis & Actionable Recommendations

#### Root Cause Analysis:
- **Issue Flagged**: \`[FLAG]\` ([Flag Details])
- [Diagnostic explanation]

#### Actionable Recommendations:
- \`[relative_path_to_file]\`: [Actionable recommendation]
\`\`\`

# INSTRUCTION
When editing the report, you MUST use your built-in structured file editing tools (e.g., replace or write_file) to update \`${REPORT_FILE}\`.`;
}
