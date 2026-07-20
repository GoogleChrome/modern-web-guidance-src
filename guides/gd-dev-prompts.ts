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
Ensure the web application codebase in the directory \`${opts.workDir}\` is in a "zero-passrate" state where it fails all expectations (both must-pass and must-fail criteria) in \`${opts.expectationsFile}\`.

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Verification Requirements**: \`${opts.expectationsFile}\`

# RULES
1. **Empty Patch Preference (No Modification if Already Failing)**: 
   - First, inspect the codebase. If the base application does NOT yet implement the feature at all (making it already naturally fail the expectations), do NOT make any changes. Keep the codebase completely unmodified (yielding an empty patch).
   - If the codebase already implements the feature in a way that passes some of the expectations, then modify the codebase to introduce subtle, realistic violations of the must-fail criteria (e.g. downgrading it to a legacy/anti-pattern implementation).
2. **Realistic Violations Only**: If you must modify the codebase, do NOT introduce syntax errors, obvious placeholders, or "TODO" comments. The modifications must represent a realistic legacy or alternative pattern.
3. Do NOT modify \`${opts.guideFile}\` or \`${opts.expectationsFile}\`.

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

  const patternsBlock = (opts.parserPatternLibraryPath && opts.playwrightPatternLibraryPath)
    ? `### 📚 BEST PRACTICE EXAMPLES
Use your file-viewing tools to read these reference files for examples of how to write various static and browser assertions:
- **Static Analysis Patterns (Linkedom, ts-morph)**: [parser-pattern-library.test.ts](file://${opts.parserPatternLibraryPath})
- **Browser Analysis Patterns (Playwright)**: [playwright-pattern-library.grader.ts](file://${opts.playwrightPatternLibraryPath})
`
    : '';

  const definitionsBlock = (opts.tsMorphDtsPath && opts.linkedomDtsPath)
    ? `### 📝 PARSER API DEFINITIONS
If you are unfamiliar with the APIs for the static parsers, you can refer to their TypeScript definitions at these paths:
- **TS Morph Type Definitions**: [ts-morph.d.ts](file://${opts.tsMorphDtsPath})
- **Linkedom Type Definitions**: [index.d.ts](file://${opts.linkedomDtsPath})
`
    : '';

  // ACTION ITEM FOR FUTURE CSSOMNOM OSPO INTEGRATION:
  // When the cssomnom package is published to npm and installed in guides/package.json,
  // update the static check instructions below to mandate importing cssomnom and passing
  // the files from extractTargetFilesFromPatch(...) into cssomnom.parse() for AST verification.
  // Also update Rule 1's CSS check description to use CSSOMNom and remove Rule 4 (precise regex word matching)
  // once string/regex-based checks are no longer needed.
  const patchInstruction = opts.failureContext
    ? `\n\n> [!NOTE]\n> If you determine that the calibration is failing because the golden solution patch (\`${opts.solutionPatchFile}\`) or the zero-passrate patch (\`${opts.zeroPassratePatchFile}\`) has a bug, is missing required code, or is not broken in the correct way, you have permission to edit them directly. Any changes you save to the patch files in your workspace will be saved and verified in the next calibration attempt.`
    : '';

  return `${contextBlock}# GOAL
Write a Playwright test script named \`${opts.graderFile}\` that directly validates the implementation requirements defined in \`${opts.expectationsFile}\` for the \`${opts.baseApp}\` web application.${patchInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`
3. **Golden Solution Diff**: \`${opts.solutionPatchFile}\` (must pass 100% of tests)
4. **Anti-Pattern Zero-Passrate Diff**: \`${opts.zeroPassratePatchFile}\` (must fail 100% of negative/must-fail tests)
5. **Boilerplate Template**: \`${opts.templateFile}\` (must base your imports, setup, and structure on this template)

# VERIFICATION & SCOPING RULES

## 1. Primary Authority: Static Analysis First
You MUST prioritize static analysis over browser execution for structural assertions. Keep static assertions as top-level synchronous test blocks.
- **Dynamic File Targeting**: Statically check all relevant modified files extracted from the patch. Do not assume styles or scripts are inline in HTML; they may be in standalone \`.css\` or \`.js\` files.
- **HTML/DOM**: Use \`linkedom\` (\`parseHTML\`) to statically verify DOM structures, tags, and attributes.
- **CSS**: Use regex checks on the contents of all CSS files and HTML style tags in the patch to statically verify CSS styling declarations.
- **JS/TS**: Use \`ts-morph\` (AST querying) on all JS/TS/Astro files and HTML script tags in the patch to statically verify JavaScript source structure.

## 2. Playwright Browser Checks: Use Only if Absolutely Necessary
Use browser-based Playwright E2E checks (grouped under the nested \`test.describe('Browser tests', ...)\` block) ONLY if it is absolutely necessary to verify layout computations (like bounding boxes), runtime values (like computed styles), or interactive state changes.
- **No Redundant Browser Checks**: Do NOT write browser tests for requirements that are already validated statically (e.g., verifying stylesheet definitions or DOM structure).
- **No Navigation Workarounds**: NEVER perform page-to-page click navigations simply to verify event registration or script execution; verify event listener registration statically instead.
- **No Generic Smoke Tests**: Do NOT write generic page-load, title, or header smoke tests. The calibration runner expects 100% of the grader tests to fail against the broken implementation. Since a broken feature does not crash the page, a generic smoke test will pass on the broken app and break calibration. Every test in the grader must assert the specific feature's correct implementation so it fails when the feature is broken.

## 3. Loose Matching for Dynamic Values
When asserting dynamic values, classes, state names, or types (either in static regex checks or browser tests), avoid strict exact-string equality checks. Use loose matches, inclusion checks, or regex pattern matching to accommodate naming variations that fulfill the requirement.

## 4. Dynamic File Scoping
NEVER hardcode target file paths. Use the template's helper \`extractTargetFilesFromPatch\` to dynamically locate the modified files and run static assertions strictly against them.

## 5. Isolated Sandbox Patch Resolution
Always resolve the paths of patch files relative to the grader module directory using Node's \`import.meta.dirname\`.

## 6. Substring Collisions
Avoid lazy substring checks (like \`.includes('reduce')\` or \`.includes('color')\`) that match feature names or prefixes instead of actual values. Use precise word boundaries (e.g., \`/\\breduce\\b/\`) to prevent false positives.

## 7. Error Handling
Do not use generic try/catch blocks that aggressively swallow exceptions.

## 8. Dependencies & Sandbox Constraints
Do not install any npm packages or execute application dev/build commands (like astro build or vite build) in your workspace. However, you MUST verify that your generated grader code compiles cleanly. Run this command in your workspace to check for TypeScript compilation/syntax errors and fix them before ending your turn:
\`npx tsc --noEmit --skipLibCheck --target esnext --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --esModuleInterop grader.ts\`

## 9. Modular Utility Resolution in Browser Tests
If the implementation exposes the target function via exports in a standalone module rather than attaching it to \`window\` directly, your browser tests must dynamically import the modified script files (derived from \`extractTargetFilesFromPatch\`) in the page context (e.g. using \`await import(file)\`) to locate and test the correct exported function.
NEVER fall back to calling native browser APIs like \`window.structuredClone\` or \`window.fetch\` directly in your browser test code if the target function is missing — if no custom wrapper function or module export is found, the test must fail.

${definitionsBlock}
${patternsBlock}
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
