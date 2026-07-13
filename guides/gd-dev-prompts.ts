/**
 * Centralized, typed prompt builder functions for the gd dev evaluation generation process.
 * 
 * Having these prompts in one dedicated module ensures high visibility, easy tuning of AI
 * behavior across target capsules (solution.patch, broken.patch, grader.ts, task.md), and
 * type-safe parameter interpolation.
 */

export interface PatchPromptOptions {
  guideFile: string;
  expectationsFile: string;
  workDir: string;
}

export function buildSolutionPrompt(opts: PatchPromptOptions): string {
  return `Read ${opts.guideFile} and ${opts.expectationsFile} to understand the web guidance and verification criteria.
Modify the web application codebase in this directory (${opts.workDir}) so that it perfectly implements the guidance and satisfies all must-pass expectations in ${opts.expectationsFile}.
Do NOT modify ${opts.guideFile} or ${opts.expectationsFile}.
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export function buildBrokenPrompt(opts: PatchPromptOptions): string {
  return `Read ${opts.guideFile} and ${opts.expectationsFile} to understand the web guidance and verification criteria.
Modify the web application codebase in this directory (${opts.workDir}) to introduce subtle, realistic violations of the must-fail criteria in ${opts.expectationsFile}.
CRITICAL: Do NOT use obvious placeholders, syntax errors, or 'TODO: implement here' comments. The broken state must represent a subtle, realistic incomplete or legacy implementation so AI agents cannot trivially guess the required changes without reading ${opts.guideFile}.
Do NOT modify ${opts.guideFile} or ${opts.expectationsFile}.
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface GraderPromptOptions {
  guideFile: string;
  expectationsFile: string;
  solutionPatchFile: string;
  brokenPatchFile: string;
  graderFile: string;
  baseApp: string;
  failureContext?: string;
}

export function buildTargetGraderPrompt(opts: GraderPromptOptions): string {
  const contextNote = opts.failureContext
    ? `\nPREVIOUS FAILURE CONTEXT:\nThe previous grader failed calibration with this error:\n${opts.failureContext}\nFix the assertions to avoid this failure.`
    : '';

  // ACTION ITEM FOR FUTURE CSSOMNOM OSPO INTEGRATION (+/35652):
  // When the cssomnom package is published to npm and installed in guides/package.json,
  // update the static check instructions below to mandate importing cssomnom and passing
  // the files from extractTargetFilesFromPatch(...) into cssomnom.parse() for AST verification.
  return `Read ${opts.guideFile}, ${opts.expectationsFile}, ${opts.solutionPatchFile} (the golden implementation diff), and ${opts.brokenPatchFile} (the negative anti-pattern diff).
Write a Playwright test script named ${opts.graderFile} directly modeling the expectations.md requirements for this multi-file web application (${opts.baseApp}).
The test script must assert that when ${opts.solutionPatchFile} is applied, all tests pass (100% success rate), and when ${opts.brokenPatchFile} is applied, all negative/must-fail tests fail (0% success rate on must-fail criteria).${contextNote}

VERIFICATION & SCOPING RULES:
1. Primary Authority (Playwright Browser APIs): Prioritize browser evaluation APIs (e.g., window.getComputedStyle(el), bounding rect measurements, and page.evaluate()) over static string matching whenever possible. Testing actual browser computed styles and layout ensures robustness against formatting or structural variations.
2. Dynamic File Scoping (Option B): Where static file checks or structural parsing are required, NEVER hardcode target file paths assuming the agent modified the exact same file as ${opts.solutionPatchFile}. Instead, dynamically discover which files were touched using:
   \`import { extractTargetFilesFromPatch } from '../lib/patch-utils.ts';\`
   \`const appRoot = path.dirname(process.env.TARGET_FILE || '');\`
   \`const modifiedFiles = extractTargetFilesFromPatch(process.env.PATCH_FILE || path.join(__dirname, '${opts.solutionPatchFile}')).map(f => path.resolve(appRoot, f));\`
   Run any static file assertions strictly against the files in \`modifiedFiles\` so agents modifying alternative component files during evaluation runs are evaluated fairly.
3. Do not use generic try/catch blocks that aggressively swallow exceptions (e.g. catch (e) { /* ignore */ }).
4. Before finishing, verify that your generated TypeScript code compiles cleanly.
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface TaskPromptOptions {
  guideFile: string;
  taskFile: string;
  baseApp: string;
}

export function buildTargetTaskPrompt(opts: TaskPromptOptions): string {
  return `Read ${opts.guideFile} and base-app.html (the existing "${opts.baseApp}" application).
Generate a ${opts.taskFile} file containing 1–4 realistic test prompts that a web developer would send to an AI coding assistant to accomplish the goal described in ${opts.guideFile}.

Rules:
- CRITICAL: Do NOT include YAML frontmatter, and do NOT place the file inside a tasks/ subdirectory. Create strictly ${opts.taskFile} as plain markdown bullet lines starting with '- '.
- Write prompts as a developer talking to an AI coding assistant — casual, lowercase, sometimes vague.
- Phrase prompts as ACTION REQUESTS or directives (e.g. "add X", "can you build Y", "implement Z"). NEVER phrase them as advisory questions (e.g. "how can I?", "what's the best way to?", "can you explain?") — the agent must implement, not just explain.
- The first prompt is the most important: it must be specific enough that an agent implementing it would produce a grader-testable result.
- Vary specificity: include at least one vague/intent-based prompt and one specific/technical ask.
- Assume the developer is working on the existing app seen in base-app.html. Reference its real assets and content where relevant.
- Do NOT mention or mandate legacy fallbacks in the prompt. The RAG system handles fallbacks automatically.
- Do NOT mention the guide itself or indicate that guidance exists.
- Do NOT name the base app (e.g. "${opts.baseApp}") — a real developer wouldn't refer to it that way.
- Do NOT dictate the underlying technical implementation. NEVER name specific web platform APIs, framework features, or explicit CSS functions. Describe the desired user outcome instead. However, including specific DOM IDs or class names is acceptable if the grader requires them to locate elements.
- Each prompt must be on its own line, prefixed with "- ", containing absolutely no internal line breaks.
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}


