/**
 * Centralized, typed prompt builder functions for the gd dev evaluation generation process.
 * 
 * Having these prompts in one dedicated module ensures high visibility, easy tuning of AI
 * behavior across target capsules (solution.patch, zero-passrate.patch, grader.ts, task.md), and
 * type-safe parameter interpolation.
 */

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
  solutionPatchFile: string;
  zeroPassratePatchFile: string;
  graderFile: string;
  baseApp: string;
  templateFile: string;
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

  const patchInstruction = opts.failureContext
    ? `\n\n> [!NOTE]\n> If you determine that the calibration is failing because the golden solution patch (\`${opts.solutionPatchFile}\`) or the zero-passrate patch (\`${opts.zeroPassratePatchFile}\`) has a bug, is missing required code, or is not broken in the correct way, you have permission to edit them directly. Any changes you save to the patch files in your workspace will be saved and verified in the next calibration attempt.`
    : '';

  return `${contextBlock}# GOAL
Write a Playwright test script named \`${opts.graderFile}\` that directly validates the implementation requirements defined in \`${opts.expectationsFile}\` for the \`${opts.baseApp}\` web application.${patchInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`
3. **Golden Solution Diff**: \`${opts.solutionPatchFile}\` (must pass 100% of tests)
4. **Anti-Pattern Zero-Passrate Diff**: \`${opts.zeroPassratePatchFile}\` (must fail 100% of tests)
5. **Boilerplate Template**: \`${opts.templateFile}\`

# VERIFICATION & SCOPING RULES

## 1. Strictly Follow the Boilerplate Template
Base your grader's imports, workspace setup, helper function usage, and test structure on \`${opts.templateFile}\`. Use the template's helpers (\`extractTargetFilesFromPatch\`, \`extractAllCss\`, \`populateJsProject\`, \`getHtmlDocuments\`) to dynamically locate and analyze modified code across standalone files and embedded template tags. Never hardcode file paths.

## 2. Assertion Hierarchy
- **Static Analysis First**: Prioritize static analysis over browser execution for structural assertions.
- **Browser Checks Only When Necessary**: Only write browser-based Playwright E2E tests when strictly necessary (for requirements that cannot be verified statically, such as runtime click events or dynamic state updates). Omit browser test blocks entirely if static checks are sufficient.
- **Reference Examples & API Definitions**: Before writing tests, use your file-viewing tools to inspect these reference pattern libraries and API type definitions for implementation patterns:
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
Examine the codebase files of the web application \`${opts.baseApp}\` and read the \`description\` in the frontmatter of \`${opts.guideFile}\` to understand the overall feature.
Generate a \`${opts.taskFile}\` file containing exactly one realistic, high-level test prompt that a developer would send to an AI coding assistant to request the overall feature inside the application.

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Target File Name**: \`${opts.taskFile}\`

# RULES
1. **Focus on the Guide Description**: The prompt must request the overall desired user outcome based specifically on the **description** in the frontmatter of \`${opts.guideFile}\`, keeping the request simple, high-level, and generic.
2. **No Technical/API Dictation**: Do NOT dictate the underlying technical implementation. NEVER name specific web platform APIs, framework features, or explicit CSS properties or functions (e.g. do NOT say "use @view-transition", "use active-view-transition-type", or "use pagereveal"). Describe the desired user outcomes instead.
3. **No Specific Details or Sub-Features**: Do NOT list or specify implementation details, custom sub-features, or edge cases (such as directional animations or accessibility preferences) that are not explicitly stated in the frontmatter description of \`${opts.guideFile}\`.
4. **Format**: Format \`${opts.taskFile}\` strictly as a single line prefixed with "- ", containing absolutely no internal line breaks.
5. **Casuality & Tone**: Write the prompt as a developer talking to an AI coding assistant.
6. **Directive Action Request**: Phrase the prompt as an ACTION REQUEST or directive (e.g., "add X", "can you build Y"). NEVER phrase it as an advisory question (e.g., "how can I?", "what's the best way to?") — the agent must implement, not just explain.
7. **No Fallbacks**: Do NOT mention or mandate legacy fallbacks in the prompt.
8. **No Internal Project References**: Do NOT name the guide itself or indicate that guidance exists.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}
