/**
 * Centralized, typed prompt builder functions for the gd dev evaluation generation process.
 *
 * Having these prompts in one dedicated module ensures high visibility, easy tuning of AI
 * behavior across target capsules (patches, grader.ts, task.md), and
 * type-safe parameter interpolation.
 */

import { type SolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, REPORT_FILE, TASK_FILE } from '../core/guide-validation.ts';
import { Agents } from '../harness/config.ts';
import { HIGH_UNGUIDED_PASS_RATE_THRESHOLD, type TargetEvalSummary } from './dev-report.ts';

/** Shared discipline-guide preamble for the solution, zero-passrate, and grader prompts. */
const DISCIPLINE_RELEVANCE_RULE = '\n\n> [!IMPORTANT]\n> This is a **discipline guide**: broad, cross-cutting guidance covering many patterns. Not every expectation will be relevant to this application. An expectation is relevant only if it applies to any web application (such as document metadata) or the starting application or task already contains the kind of element, feature, or infrastructure it governs (such as forms, credential inputs, images, overlays or flyouts, cookies or sessions, iframes, external scripts, a logout flow, or a server/middleware that sets HTTP response headers—response headers are only relevant when the starting app or task has a server or middleware that sets HTTP headers, never on a purely static client-side site). Judge relevance from the starting application and task, never from the agent\'s output, and by whether that element or infrastructure exists rather than whether the technique the expectation recommends is already used: an existing element that lacks the recommended technique is exactly what should be implemented and tested.';

export interface SolutionPromptOptions {
  guideFile: string;
  taskFile?: string;
  workDir: string;
  isDisciplineGuide?: boolean;
}

export interface PatchPromptOptions {
  guideFile: string;
  expectationsFile: string;
  workDir: string;
  isDisciplineGuide?: boolean;
}

export function buildSolutionPrompt(opts: SolutionPromptOptions): string {
  const taskFile = opts.taskFile ?? TASK_FILE;
  const disciplineInstruction = opts.isDisciplineGuide
    ? `${DISCIPLINE_RELEVANCE_RULE} In this task, you do NOT need to implement every pattern in \`${opts.guideFile}\`. Implement only the patterns that are relevant to the task in \`${taskFile}\` and the elements already present in the application. Do NOT add new features, pages, routes, servers, forms, scripts, or content that are not requested by the task.`
    : '';

  return `# GOAL
Modify the web application codebase in the directory \`${opts.workDir}\` to complete the developer task in \`${taskFile}\` by faithfully following the guidance in \`${opts.guideFile}\`.${disciplineInstruction}

# INPUTS
1. **Developer Task**: \`${taskFile}\`
2. **Standard Guidance**: \`${opts.guideFile}\`

# RULES
1. Do NOT modify \`${opts.guideFile}\` or \`${taskFile}\`.
2. Ensure your implementation is robust, complete, and type-safe.
3. Your changes MUST compile cleanly. You can run \`npm run build\` inside your workspace to verify.
4. Do NOT start dev servers, preview servers, or background processes (e.g., npm run dev, npm start, astro preview, or importing dist/server/entry.mjs). Only run npm run build to verify compilation.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export function buildZeroPassratePrompt(opts: PatchPromptOptions): string {
  const disciplineInstruction = opts.isDisciplineGuide
    ? `${DISCIPLINE_RELEVANCE_RULE} In this task, you do NOT need to fail every expectation. Only remove existing implementations of relevant expectations. Do NOT add features or anti-patterns the application does not already have. Do NOT remove or degrade anything the application already does correctly; the grader will skip expectations the application already satisfies.`
    : '';

  return `# GOAL
Inspect the clean codebase in the directory \`${opts.workDir}\`. Your goal is to ensure the codebase does NOT implement any part of the feature described in \`${opts.guideFile}\` and does NOT satisfy any criteria in \`${opts.expectationsFile}\`.

If the codebase is already clean of this feature (meaning the feature is not present and assertions verifying the feature would naturally fail), do NOT modify any files (leave the workspace unchanged).

If the codebase already contains partial, complete, or conflicting implementations of the feature, disable, unset, revert, or remove those implementations.${disciplineInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`

# RULES
1. **No-Op by Default**: If the clean codebase does not already implement the feature, do NOT modify any files (leave the workspace completely unchanged so the resulting patch is empty). Do NOT add new HTML elements, images, components, or styles just to have something to fail.
2. **Realistic Baseline**: If the codebase already contains partial or complete implementations of the feature that would cause expectations in \`${opts.expectationsFile}\` to pass, strip or revert only those specific implementations back to a natural, unoptimized baseline state. Do NOT write buggy or obviously broken code, and do NOT add any comments, messages, or placeholders indicating that this is a simulated, test, or baseline state.
3. **Never Copy Guide Examples or Plant Anti-Patterns**: Because this patch is applied to the base application before evaluation runs, NEVER copy example markup, dummy filenames, class names, or code snippets from \`${opts.guideFile}\` or \`${opts.expectationsFile}\`, and NEVER plant synthetic or inverted anti-pattern attributes (such as deprecated attributes or backwards priority values) that would tip off an evaluated agent.
4. Do NOT modify \`${opts.guideFile}\` or \`${opts.expectationsFile}\`.
5. Ensure your modifications are robust, complete, and type-safe.
6. Your changes MUST compile cleanly. You can run \`npm run build\` inside your workspace to verify.
7. Do NOT start dev servers, preview servers, or background processes (e.g., npm run dev, npm start, astro preview, or importing dist/server/entry.mjs). Only run npm run build to verify compilation.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface GraderPromptOptions {
  guideFile: string;
  expectationsFile: string;
  taskFile?: string;
  solutionPatchFiles: Partial<Record<SolutionAgent, string>>;
  zeroPassratePatchFile?: string;
  graderFile: string;
  baseApp: string;
  templateFile: string;
  testFixtureReferencePath?: string;
  parserPatternLibraryPath?: string;
  playwrightPatternLibraryPath?: string;
  tsMorphDtsPath?: string;
  linkedomDtsPath?: string;
  cssomnomDtsPath?: string;
  failureContext?: string;
  isDisciplineGuide?: boolean;
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
  };
}

// `runAgent` passes the prompt via CLI argv (`-p <prompt>`); cap failure logs to stay well below Linux's 128 KB `MAX_ARG_STRLEN` (`spawn E2BIG`).
const MAX_FAILURE_CONTEXT_CHARS = 16_000;

export function buildTargetGraderPrompt(opts: GraderPromptOptions): string {
  const taskFile = opts.taskFile ?? TASK_FILE;
  let prReviewContextBlock = '';
  if (opts.prContext?.comments) {
    const parts: string[] = ['### ⚠️ REVIEWER FEEDBACK ON PREVIOUS GRADER & EVALUATIONS'];
    parts.push(`Reviewer & ATL comments on this PR:\n${opts.prContext.comments.trim()}`);
    parts.push(`If any reviewer comments above pertain to \`${opts.graderFile}\` (e.g. relaxing overly strict checks, fixing false negatives, or adjusting selector scopes), incorporate them while still adhering to \`${opts.expectationsFile}\` and all rules below.`);
    prReviewContextBlock = '\n' + parts.join('\n\n') + '\n\n---\n';
  }

  const truncatedFailure =
    opts.failureContext && opts.failureContext.length > MAX_FAILURE_CONTEXT_CHARS
      ? `${opts.failureContext.slice(0, MAX_FAILURE_CONTEXT_CHARS)}\n...[truncated ${opts.failureContext.length - MAX_FAILURE_CONTEXT_CHARS} chars]`
      : opts.failureContext;

  const contextBlock = truncatedFailure
    ? `### ⚠️ CALIBRATION FAILURES TO FIX IN THE GRADER
The previous grader failed calibration with this error:
\`\`\`
${truncatedFailure}
\`\`\`
Analyze this failure and modify \`${opts.graderFile}\` to fix how failing tests measure (selectors, file lookup, computed styles, timing, or instrument) so valid implementations pass while still adhering to all rules below.
Anti-loosening rule: each test you update must still assert the full expectation (same element, same relationship, same modality) and still fail the baseline / unimplemented app. Never drop assertions, omit expectations, add a broad fallback regex (such as \`/content\\s*:/\`), add a generic \`|| val !== ''\` fallback branch, initialize validation flags to \`true\`, substitute a broad fallback set when a filtered set is empty (\`found.length > 0 ? found : allElements\`), widen tolerances past what \`${opts.guideFile}\` allows, or swap a behavior check for a weaker proxy.

---
`
    : '';

  const agentLabels: Record<SolutionAgent, string> = {
    [Agents.ANTIGRAVITY_CLI]: 'Antigravity CLI',
    [Agents.JETSKI_CLI]: 'Jetski CLI',
    [Agents.CLAUDE_CODE]: 'Claude Code',
    [Agents.CODEX_CLI]: 'Codex CLI',
  };

  const solutionList = Object.entries(opts.solutionPatchFiles)
    .filter(([_, file]) => Boolean(file))
    .map(([agent, file]) => `   - ${agentLabels[agent as SolutionAgent] || agent} Solution: \`${file}\` (must pass 100% of tests)`)
    .join('\n');

  const patchInstruction = opts.failureContext
    ? `\n\n> [!NOTE]\n> Golden solution patches (\`patches/*-solution.patch\`) are **LOCKED** and any edits to them will be discarded. Update \`${opts.graderFile}\` to accept all valid implementations \`${opts.guideFile}\` allows without loosening the check against an unimplemented baseline.`
    : '';

  const disciplineInstruction = opts.isDisciplineGuide
    ? `${DISCIPLINE_RELEVANCE_RULE} In this task, you do NOT need to write a test for every expectation. Decide relevance from the base application and \`${taskFile}\`, not from the solution patches: do NOT test an expectation whose pattern only exists because a solution patch added it without the task asking for it. Skip an expectation only when its precondition is absent from both the base application and \`${taskFile}\` (runtime states Playwright can simulate—such as viewport sizes, permission states, or failed requests—are never missing preconditions). Skip expectations the base application already satisfies. If a relevant pattern is implemented in different files or components across solutions, write a project-wide check instead of skipping it. At the top of \`${opts.graderFile}\`, add a comment listing every expectation number as TESTED or SKIPPED with a one-line reason.`
    : '';

  const coverageInstruction = opts.isDisciplineGuide
    ? ''
    : `Every top-level expectation in \`${opts.expectationsFile}\` must have at least one dedicated \`test('...', ...)\` block whose name clearly describes that expectation. Do not omit, merge, or skip any expectation, including when revising the grader after a calibration failure.\n\n`;

  const baselineInputLine = opts.zeroPassratePatchFile
    ? `5. **Baseline / Zero-Passrate Diff**: \`${opts.zeroPassratePatchFile}\` (or the untouched \`${opts.baseApp}\` starting app if empty; must fail 100% of non-exempt tests)`
    : `5. **Untouched Starting App**: the \`${opts.baseApp}\` source in this workspace (must fail 100% of non-exempt tests)`;

  return `${prReviewContextBlock}${contextBlock}# GOAL
Write a Playwright test script named \`${opts.graderFile}\` that directly validates the implementation requirements defined in \`${opts.expectationsFile}\` for the \`${opts.baseApp}\` web application. The grader must be robust enough to pass 100% against all golden solution diffs, as developers using different AI tools will implement valid variations of the requirements.${disciplineInstruction}${patchInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`
3. **Developer Task**: \`${taskFile}\` (the request the solution agents received; it may name hooks you can use, but it is never a source of tests beyond \`${opts.expectationsFile}\`)
4. **Golden Solution Diffs**:
${solutionList}
${baselineInputLine}
6. **Boilerplate Template**: \`${opts.templateFile}\`

# VERIFICATION & SCOPING RULES

## 1. Strictly Follow the Boilerplate Template
Base your grader's imports, workspace setup, helper function usage, and test structure on \`${opts.templateFile}\`. Use the template's helpers (\`getTargetFiles\`, \`getCssStyleSheet\`, \`getJsProject\`, \`getHtmlDocuments\`, \`expectNever\`) to dynamically locate and analyze modified code across standalone files and embedded template tags. Never hardcode file paths.

## 2. Right Instrument for the Claim: Parsers vs. Browser
- **Check Full Expectation Fidelity**: Every test—static or browser—must verify the full expectation (same element, same relationship, same modality), not just a partial proxy.
- **Structure and API Usage (Parsers)**: Check structure and API usage with parsers across all project files (\`getTargetFiles\`), never reading only one file when a solution can span several, and never using regex on HTML, CSS, or JavaScript/TypeScript source files to test syntax or runtime behavior.
  - Use **Linkedom** for HTML structure and DOM querying (\`getHtmlDocuments\`).
  - Use **CSSOMNom** (imported directly from \`cssomnom\`) for CSS rules, at-rules (@media, @supports, @container, @view-transition, @position-try), and declarations (\`getRules(targetFiles, CSSStyleRule)\`, \`getCssStyleSheet\`, \`closestRule\`, \`resolveSelector\`, \`parseSelectorAST\`, \`getDeclaredProperties\`, \`getPropertyValues\`, \`CSSPositionTryRule\`, \`getCascadedStyle(el, stylesheet, env)\`).
  - Use **ts-morph** for JavaScript/TypeScript syntax, AST analysis, and function/variable querying (\`getJsProject\`).
- **Runtime Behavior (Browser)**: Check runtime behavior (interaction, state changes, computed style, layout, accessibility tree) in the browser with Playwright over HTTP (\`page.goto(TARGET_URL)\`). Browser tests must locate elements through base-app markup, hooks (\`id\` or \`data-\` attributes) that \`${taskFile}\` names, or platform semantics (element types, ARIA roles, standard attributes). Never hardcode guide example classes, newly invented page routes, custom REST API endpoints/payloads, or IDs/classes/labels that exist only in the golden solution patches. Omit browser test blocks if no expectations require runtime browser checks.
- **Poll to End State (Never \`waitForTimeout\`)**: Poll for asynchronous state using \`expect(locator)\` auto-retrying matchers, \`expect.poll()\`, or unswallowed \`page.waitForFunction()\`. Poll for the actual end state (e.g., animation finished or element visible after transition), not a condition already true at test start. Never use fixed \`page.waitForTimeout()\` / \`setTimeout\` sleeps or swallowed \`.catch(() => {})\` waits. When an expectation claims something *never* happens or *stays/remains* in a state over time, observe it over an explicit window with \`await expectNever(page, predicate, { forMs })\` from \`test-fixture.ts\`.
- **Mock Browser APIs Faithfully**: When stubbing or mocking browser APIs via \`page.addInitScript()\`, faithfully implement the standard contract that guide-compliant code calls (for example, a \`PublicKeyCredential\` mock must implement \`.toJSON()\`, expected fields, and \`navigator.credentials\` methods), never partial mocks that break valid solutions.
- **Reference Examples & API Definitions**: Before writing tests, use your file-viewing tools to inspect these reference pattern libraries and API type definitions for implementation patterns:
  - **Test Fixture Helper Signatures (Reference Only)**: [test-fixture.reference.ts](file://${opts.testFixtureReferencePath})
  - **Static Analysis Patterns (Linkedom, CSSOMNom, ts-morph)**: [parser-pattern-library.test.ts](file://${opts.parserPatternLibraryPath})
  - **Browser Analysis Patterns (Playwright)**: [playwright-pattern-library.grader.ts](file://${opts.playwrightPatternLibraryPath})
  - **TS Morph Type Definitions**: [ts-morph.d.ts](file://${opts.tsMorphDtsPath})
  - **Linkedom Type Definitions**: [linkedom.d.ts](file://${opts.linkedomDtsPath})
  - **CSSOMNom Type Definitions**: [cssomnom.d.ts](file://${opts.cssomnomDtsPath})

## 3. Expectation Coverage & One Expectation per Test
${coverageInstruction}Write one expectation per \`test('...', ...)\` block across both static and browser tests, with a precondition assertion (e.g., asserting a list isn't empty with \`expect(items.length).toBeGreaterThan(0)\`) allowed before the main assertion. Do not combine multiple expectations into a single test block. This ensures precise, unambiguous error reporting during calibration if a test fails.

## 4. Precision & Matching Rules
- **Outcome-Based Assertions**: Verify structural and functional requirements in static checks rather than forcing a single narrow implementation when valid alternatives exist.
- **No Patch-Specific Identifier Overfitting**: The golden solution patches are examples of valid implementations, not an exhaustive specification. Never hardcode helper function names, local variable/state names, custom class names, or newly created filenames that happen to appear in the solution patches. Match conceptual roles, hooks named in \`${taskFile}\`, standard web platform APIs, and DOM/CSS semantics instead.
- **Utility CSS Flexibility**: In apps using utility-first CSS frameworks (e.g., Tailwind), accept either standard CSS declarations (\`getCssStyleSheet\`) or equivalent utility classes on elements in template markup (\`getHtmlDocuments\`).
- **Flexible Pattern Matching**: Avoid exact-string equality for dynamic names or classes. Use loose matches, inclusion checks, and word boundaries (e.g., \`/\\bname\\b/\`) to avoid substring false positives.
- **Pair \`MUST NOT\` Checks with Positive Presence Assertions**: An untouched starting app trivially satisfies "does not use X" if the feature is absent. Pair every negative (\`MUST NOT\`) check with a positive presence check confirming the target component or feature exists, so an unimplemented baseline fails the test.
- **No Vacuous Guards, \`test.skip()\`, or Fallback Loops**: Never use \`test.skip()\`. Never wrap \`expect(...)\` inside \`if (items.length > 0)\` without first asserting \`expect(items.length).toBeGreaterThan(0)\`. Never initialize a validation flag to \`true\`, substitute a broader element set when a filtered set is empty, or OR an assertion with a generic \`val !== ''\` fallback. Every \`test()\` block must execute a real, non-trivial assertion that fails when the requirement is absent.
- **No Swallowed Errors**: Do not wrap assertions in generic try/catch blocks that swallow exceptions.

## 5. Dependencies & Sandbox Constraints
Do not install any npm packages or execute application dev, build, or test commands in your workspace. However, you MUST verify that your generated grader code compiles cleanly and passes linting. Run ONLY these verification commands in your workspace and fix any errors before ending your turn:
1. \`npx tsc --noEmit --skipLibCheck --target esnext --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --esModuleInterop grader.ts\`
2. \`npx oxlint grader.ts\`

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface TaskPromptOptions {
  guideDescription: string;
  taskFile?: string;
  baseApp: string;
  isDisciplineGuide?: boolean;
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
  };
}

export function buildTargetTaskPrompt(opts: TaskPromptOptions): string {
  const target = opts.isDisciplineGuide ? 'discipline guidance' : 'use case';
  const taskFile = opts.taskFile ?? TASK_FILE;

  let prReviewContextBlock = '';
  if (opts.prContext?.comments) {
    const parts: string[] = ['### ⚠️ REVIEWER FEEDBACK ON PREVIOUS TASK PROMPT / IMPLEMENTATION'];
    parts.push(`Reviewer & ATL comments on this PR:\n${opts.prContext.comments.trim()}`);
    parts.push(`Carefully address any reviewer suggestions regarding the developer prompt in \`${taskFile}\`. If a reviewer requested specific phrasing, wording adjustments, or additions to the test prompt, incorporate their feedback directly while adhering to all rules below.`);
    prReviewContextBlock = '\n' + parts.join('\n\n') + '\n\n---\n';
  }

  return `${prReviewContextBlock}# GOAL
Examine the codebase files of the web application \`${opts.baseApp}\` and understand the ${target} from the following description:

**Guide Description**: "${opts.guideDescription}"

Generate a \`${taskFile}\` file containing exactly one realistic, high-level test prompt that a web developer would send to an AI coding assistant to apply the ${target} inside the application.

# INPUTS
1. **Guide Description**: "${opts.guideDescription}"
2. **Target File Name**: \`${taskFile}\`

# RULES
1. **Grounded in the Application**: Examine the existing files in \`${opts.baseApp}\` and assume the developer is working on the existing app. Reference its real pages, components, cards, forms, or content where relevant, asking the assistant to upgrade, refactor, or modify those existing parts rather than emitting a generic, detached one-liner or building an isolated demo from scratch.
2. **Never Copy Description Verbatim**: Do NOT copy the **Guide Description** string verbatim into \`${taskFile}\`. Adapt the desired user outcome into a natural developer request situated in the \`${opts.baseApp}\` application.
3. **Preserve High-Level Capability Boundary**: Keep the functional domain and execution context from the **Guide Description** clear (e.g., distinguishing on-device / built-in browser capabilities vs. external cloud APIs), with no unrelated scaffolding, without naming specific JS/CSS APIs, properties, or method names. A discipline guide's task may name its discipline (such as accessibility or security) as its capability boundary; it still never names a mechanism.
4. **Asks for the Outcome, Never the Mechanism**: The task may name what is being built (such as a custom element or a modal dialog), and a discipline guide's task may name its discipline, but never how well or with which API to build it. Never name specific web platform APIs, framework features, HTML elements (like \`<dialog>\`), CSS properties, quality goals ("make it accessible" in a use-case task), or implementation hints ("CSS-only", "natively"). Never add artificial performance, layout, or synchronization constraints to force a specific mechanism. Describe the desired user outcome instead.
5. **No Specific Details or Sub-Features**: Keep the request high-level. Do NOT list or specify secondary implementation details, custom sub-features, or edge cases (such as directional animations or accessibility preferences) that are not explicitly stated in the **Guide Description** above. When introducing a new UI element that has no natural anchor in the existing app, you may name one neutral hook (an \`id\` or \`data-\` attribute) for that primary element, written as a plain part of the request rather than an optional suggestion. Adding a hook is your choice, never a requirement; if you add one, name it after the app content the element shows or manages (e.g. \`id="passkey-list"\`), never after an HTML element, attribute, CSS feature, or API (e.g. never \`id="share-dialog"\` or \`data-popover\`).
6. **Format**: Format \`${taskFile}\` strictly as a single line prefixed with "- ", containing absolutely no internal line breaks.
7. **Casuality & Tone**: Write the prompt as a developer talking to an AI coding assistant — casual, natural, and direct.
8. **Directive Action Request**: Phrase the prompt as an ACTION REQUEST or directive (e.g., "implement X", "modify Y", "update the ..."). NEVER phrase it as an advisory question (e.g., "how can I?", "what's the best way to?") — the agent must implement, not just explain.
9. **No Fallbacks**: Do NOT mention or mandate legacy fallbacks in the prompt.
10. **No Internal Project References**: Do NOT mention or hint at the name of the guide, any guidance files, or the web guidance project in \`${taskFile}\`.

# INSTRUCTION
When writing files, you MUST use your built-in structured file editing tools (e.g., write_file or replace). Do not use shell commands (like cat, echo, or heredocs <<) to create files in the terminal.`;
}

export interface ReviewFeedbackPromptOptions {
  guideName: string;
  comments: string;
  branchCommits?: string;
  branchDiff?: string;
  rerunMode?: string;
  suggestedEdits?: string;
}

export function buildApplyReviewFeedbackPrompt(opts: ReviewFeedbackPromptOptions): string {
  const parts: string[] = ['# EXISTING PULL REQUEST & REVIEW CONTEXT'];
  if (opts.branchCommits) {
    parts.push(`## Branch Commits against main:\n\`\`\`\n${opts.branchCommits.trim()}\n\`\`\``);
  }
  if (opts.branchDiff) {
    parts.push(`## Branch Diff against main:\n\`\`\`diff\n${opts.branchDiff.trim()}\n\`\`\``);
  }
  parts.push(`## Reviewer Comments & Feedback to Address:\n${opts.comments.trim()}`);
  if (opts.suggestedEdits) {
    parts.push(`## Suggested Edits From The Previous Evaluation Report (not applied):\nAn automated report proposed these edits; none of them are applied. Apply a suggested edit only when a reviewer comment above asks for it, and ignore the rest.\n\n${opts.suggestedEdits.trim()}`);
  }

  const contextBlock = parts.join('\n\n');

  let rerunNote = '';
  if (opts.rerunMode === 'needs-dev-rerun') {
    rerunNote = `\n> [!NOTE]\n> This rerun is in \`needs-dev-rerun\` mode: after this step, files are regenerated based on what changed. If the \`description\` in \`${GUIDE_FILE}\` changes, every file under \`targets/\` is regenerated, so do not also edit target files in that case. For any other \`${GUIDE_FILE}\` change, \`targets/<target>/${TASK_FILE}\` is kept and the patches and \`grader.ts\` are regenerated, so do not also edit \`grader.ts\` in that case. An \`${EXPECTATIONS_FILE}\`-only change regenerates \`grader.ts\`, keeping \`targets/<target>/${TASK_FILE}\` and the golden solution patches, so do not also edit \`grader.ts\` in that case. If only \`targets/<target>/${TASK_FILE}\` changes, the solution patches and \`grader.ts\` are regenerated from the new task. The cascade keeps downstream files whose inputs didn't change; when an upstream edit regenerates a file, \`git diff\` surfaces any overwritten hand edits for review.\n`;
  }

  return `${contextBlock}
${rerunNote}
# GOAL
You are updating the guidance and evaluation files for \`${opts.guideName}\` based on pull request review feedback.
Your goal is to address all reviewer comments by directly updating the relevant files on disk (\`guide.md\`, \`expectations.md\`, \`targets/<target>/task.md\`, and \`targets/<target>/grader.ts\`).

# RULES & INSTRUCTIONS
1. **Direct File Modifications**:
   - Apply requested changes directly to \`guide.md\`, \`expectations.md\`, \`targets/<target>/task.md\`, or \`targets/<target>/grader.ts\` in your workspace using your structured file editing tools.
   - Any edits to \`targets/<target>/task.md\` must ask only for the outcome, never the mechanism (may name what is being built or a discipline boundary, never how well, implementation hints like "natively" or "CSS-only", or specific APIs/elements/CSS properties; no constraint forcing; neutral hooks only; never mention \`guide.md\` or guidance skills).
   - If reviewers approved specific recommendations or suggested explicit diffs (e.g. adding preload attributes, modifying selectors, or rewording task prompts), apply them cleanly to the corresponding files.
2. **Honor Reviewer Intent**:
   - Defer to reviewer feedback over previous automated output.
   - Do not overwrite or revert human-authored commits or requested changes.
3. **No Shell Commands**:
   - Use built-in structured file editing tools (write_file or replace). Do not use terminal heredocs or cat.`;
}

export interface DevReportPromptOptions {
  guideName: string;
  targets: TargetEvalSummary[];
  prContext?: {
    branchCommits?: string;
    branchDiff?: string;
    comments?: string;
  };
}

export function buildDevReportPrompt(opts: DevReportPromptOptions): string {
  const targetSections = opts.targets.map(t => {
    return `### Target: \`${t.baseApp}\`
- **Issue Flagged**: \`${t.flag}\`
- **Flag Details**: ${t.flagDetails}`;
  }).join('\n\n');

  let prContextBlock = '';
  if (opts.prContext && (opts.prContext.comments || opts.prContext.branchDiff || opts.prContext.branchCommits)) {
    const parts: string[] = ['# EXISTING PULL REQUEST & REVIEW CONTEXT'];
    if (opts.prContext.branchCommits) {
      parts.push(`## Branch Commits against main:\n\`\`\`\n${opts.prContext.branchCommits.trim()}\n\`\`\``);
    }
    if (opts.prContext.branchDiff) {
      parts.push(`## Branch Diff against main:\n\`\`\`diff\n${opts.prContext.branchDiff.trim()}\n\`\`\``);
    }
    if (opts.prContext.comments) {
      parts.push(`## PR Comments & Reviewer Feedback:\n${opts.prContext.comments.trim()}`);
    }
    parts.push(`\n> [!IMPORTANT]\n> This is a subsequent pass on an open pull request. You MUST carefully review the PR comments, ATL/reviewer feedback, and existing branch commits/diff above.\n> - Honor reviewer feedback and requested changes directly in your recommendations and suggested edits.\n> - Address reviewer concerns without blindly overwriting human-authored changes.\n> - If reviewer feedback conflicts with prior automated suggestions, defer to the human reviewer's guidance.\n`);
    prContextBlock = '\n' + parts.join('\n\n') + '\n';
  }

  return `${prContextBlock}# GOAL
Analyze the evaluation test results across all target applications for the guide \`${opts.guideName}\`, conduct a thorough root-cause investigation for each target based on its flagged status, complete the placeholders in \`${REPORT_FILE}\` (\`### Evaluation Results\` is already populated for each target), and suggest fixes by editing the relevant files in your scratch workspace (\`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, \`targets/<target>/task.md\`, \`targets/<target>/grader.ts\`).

# SUGGESTED EDITS (NEVER APPLIED TO DISK)
Your workspace is a scratch copy of the guide. Edits you make there are never applied directly to the pull request: when you finish, the harness diffs your scratch workspace against the guide, saves \`suggestions.patch\`, and appends the exact diffs to \`${REPORT_FILE}\` under \`## Suggested Edits\`. A reviewer inspects each suggestion and applies it or asks for it in a comment.
Whenever you determine that \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, \`targets/<target>/task.md\`, or \`targets/<target>/grader.ts\` should change:
1. Make the change in your scratch workspace copy of that file with your structured file editing tools so the suggestion is an exact, applicable patch.
2. In \`${REPORT_FILE}\`, list it under \`#### Actionable Recommendations:\` as a bullet naming the file and explaining what to change and why. Do not paste diff blocks into \`${REPORT_FILE}\` or write a \`## Suggested Edits\` section yourself; the harness adds the diffs.
3. Edit only files you recommend changing, and leave everything else untouched.
A suggested grader edit that removes or disables \`test()\` blocks without a matching \`${EXPECTATIONS_FILE}\` change is flagged to reviewers as a coverage loss, so fix \`${EXPECTATIONS_FILE}\` or \`targets/<target>/task.md\` instead when the expectation itself is wrong.

# INPUTS
1. **Guide**: \`${GUIDE_FILE}\`
2. **Expectations**: \`${EXPECTATIONS_FILE}\`
3. **Target Capsule Directories**: For each target, inspect the artifacts in \`targets/<target>/\`:
   - \`task.md\` (developer test prompt)
   - \`grader.ts\` (Playwright validation suite)
   - \`patches/*-solution.patch\` (golden solution diffs)
4. **Evaluation Run Artifacts**: For each target, \`results/<target>/\` contains run artifacts such as \`agent.patch\` and \`chat_log.txt\`.
5. **Target Evaluation Reports & Flags**:
${targetSections}

# SYSTEM WORKFLOW CONTEXT
To accurately diagnose failures, understand how \`gd dev\` generates and executes these components:
1. **Ground Truth**: \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` define the canonical, framework-agnostic implementation and must-pass requirements.
2. **Task Prompt**: \`task.md\` is generated first from only the frontmatter \`description\` of \`${GUIDE_FILE}\` and the target app codebase (isolated from \`${GUIDE_FILE}\` body and \`${EXPECTATIONS_FILE}\`).
3. **Patches**: Golden solution diffs are generated by solution agents provided with only \`task.md\` and \`${GUIDE_FILE}\` (they never see \`${EXPECTATIONS_FILE}\`) and are locked during calibration.
4. **Grader**: \`grader.ts\` validates the requirements in \`${EXPECTATIONS_FILE}\` against the target app and is calibrated against the locked golden patches (must pass 100%, load cleanly, and not depend on golden-only non-contract class names) and the baseline (must fail 100% of non-exempt tests against \`zero-passrate.patch\` or the untouched starting app when \`zero-passrate.patch\` is empty/absent).

# ROOT-CAUSE DIAGNOSIS RULES (BY PRIMARY FLAG)

Diagnose each target according to its assigned flag, suggesting edits only to the file that is wrong:

0. **\`CALIBRATION_FAILED\`**:
   - Calibration failed against the golden solutions, the baseline, page-load health, or the selector-gating probe before agent evaluation runs could execute.
   - **Never trim \`${EXPECTATIONS_FILE}\` or loosen \`grader.ts\` just to make calibration pass when \`${GUIDE_FILE}\` states the requirement**:
     - If golden solutions missed a requirement that \`${GUIDE_FILE}\` states (\`golden_missed_requirement\` / \`guide_gap\`): never loosen \`targets/<target>/grader.ts\` to accept the miss, and never trim \`${EXPECTATIONS_FILE}\` to drop a requirement \`${GUIDE_FILE}\` states. Instead, suggest clarifying \`${GUIDE_FILE}\` (prose and snippets) so agents follow the requirement, and do NOT also suggest edits to \`targets/\` in the same pass.
     - If \`${EXPECTATIONS_FILE}\` demands something \`${GUIDE_FILE}\` omits, marks optional/recommended, contradicts across passages/snippets, or cannot be tested objectively on the target app: treat \`${GUIDE_FILE}\` as authoritative and suggest fixing \`${EXPECTATIONS_FILE}\` to match \`${GUIDE_FILE}\` (or adding the missing reason to \`${GUIDE_FILE}\` if the requirement is meant to be mandatory), without also suggesting \`targets/<target>/grader.ts\` edits in the same pass.
     - If \`${EXPECTATIONS_FILE}\` and \`${GUIDE_FILE}\` already align and the failure is a broken or over-constrained check in \`targets/<target>/grader.ts\` (e.g., coupled to golden-only class names, regex on source, \`waitForTimeout\`, partial browser mocks missing \`toJSON()\`, vacuous baseline pass, or a blocked loosening attempt) or an under-scoped \`targets/<target>/task.md\`, suggest fixing \`targets/<target>/grader.ts\` or \`targets/<target>/task.md\` without touching \`${GUIDE_FILE}\` or \`${EXPECTATIONS_FILE}\`.

1. **\`INFRASTRUCTURE_ERROR\`**:
   - The test run failed due to execution timeouts, agent CLI process crashes, rate limits (429), or missing setup files.
   - Explain the error context. No code file modifications are needed unless the issue stems from an invalid build/package configuration.

2. **\`MISSING_GUIDANCE_TOOL\`**:
   - The guided agent did not invoke \`modern-web-guidance\`.
   - **Diagnosis**: State that the run never queried modern web guidance, and check whether \`targets/<target>/task.md\` obscures the capability boundary or whether the frontmatter \`description\` in \`${GUIDE_FILE}\` fails to frame the developer task.
   - **Recommendation**: Suggest concrete edits to the frontmatter \`description\` in \`${GUIDE_FILE}\` or to \`targets/<target>/task.md\` so the capability boundary is clear. **Never** rewrite \`task.md\` to name \`${GUIDE_FILE}\`, guidance skills, specific web APIs, CSS properties, HTML elements (like \`<dialog>\`), quality goals ("make it accessible" in a use-case task), implementation hints ("CSS-only", "natively"), or artificial constraint forcing.

3. **\`MISSING_EXPECTED_GUIDE\`**:
   - The guided agent invoked guidance tools, but \`${opts.guideName}\` was not among the consumed guides.
   - **Culprit**: \`targets/<target>/task.md\` or the \`description\` in \`${GUIDE_FILE}\`.
   - **Root Cause**: The prompt or guide \`description\` failed to frame \`${opts.guideName}\` as the right match for the developer task.
   - **Recommendation**: Suggest concrete edits to \`${GUIDE_FILE}\`'s frontmatter \`description\` or \`targets/<target>/task.md\` while keeping \`task.md\` outcome-only with no API/guide leaks or constraint forcing.

4. **\`HIGH_UNGUIDED_PASS_RATE\`**:
   - The unguided agent achieved ${HIGH_UNGUIDED_PASS_RATE_THRESHOLD}% or higher without consuming guidance. Before merge this needs a fix, or a note explaining why the rate is legitimate.
   - **Root Cause Investigation**: Inspect \`targets/<target>/task.md\`, \`${EXPECTATIONS_FILE}\`, and \`targets/<target>/grader.ts\`:
     - **Prompt Leakage (\`targets/<target>/task.md\`)**: Does \`task.md\` hand the unguided run the answer by naming APIs, attributes, CSS properties, HTML elements, quality goals, implementation hints, or artificial constraints instead of only the user-facing outcome?
     - **Incomplete or Weak Expectations (\`${EXPECTATIONS_FILE}\`)**: Does \`${EXPECTATIONS_FILE}\` omit required observable outcomes from \`${GUIDE_FILE}\` or contain untestable/weak bullets?
     - **Vacuous or Lenient Grader (\`targets/<target>/grader.ts\`)**: Are assertions vacuous (e.g. a \`MUST NOT\` check without a positive presence assertion, checking only part of an expectation, or failing to set up the runtime state)?
     - **Little Lift**: If task, expectations, and grader all hold up, agents may already follow what the guide teaches.
   - **Recommendation Rules**:
     - Fix whichever file is wrong: tighten \`targets/<target>/task.md\` if it leaks or forces constraints; update \`${EXPECTATIONS_FILE}\` if it omits required outcomes from \`${GUIDE_FILE}\` (and do NOT also edit \`targets/<target>/grader.ts\` in the same pass); tighten \`targets/<target>/grader.ts\` if its checks are vacuous or too loose for \`${EXPECTATIONS_FILE}\`. Never modify \`${GUIDE_FILE}\` merely to make the eval harder.
     - If task, expectations, and grader all hold up, write a brief draft note under \`#### Actionable Recommendations:\` explaining why the unguided rate is legitimate (e.g., the guide adds little lift). Never suggest an edit solely to lower the unguided rate.

5. **\`HEALTHY\`**:
   - Calibration passed, the guided run consumed the expected guide, and the unguided pass rate is below ${HIGH_UNGUIDED_PASS_RATE_THRESHOLD}%. No pass-rate threshold is a quality bar: a healthy target can still have failed guided checks.
   - **Actionable Recommendations**: Output \`- None.\` unless a failed guided check reveals an eval defect or guide finding (see below).

# FAILED GUIDED CHECKS (ANY TARGET, INFORMATIONAL)
A low guided pass rate is never a flag on its own, and you must never suggest an edit just to raise a pass rate. For each guided check that failed, check the eval before blaming the guide:
- **Grader Robustness (\`targets/<target>/grader.ts\`)**: Does the check fail a solution that \`${GUIDE_FILE}\` allows (e.g., coupled to golden-only classes/IDs, single-file reads, source regex for runtime behavior, \`waitForTimeout\`, partial browser mocks missing \`toJSON()\`, or missing utility CSS support)? If so, suggest a grader fix.
- **Expectations Alignment (\`${EXPECTATIONS_FILE}\`)**: Does the expectation demand something \`${GUIDE_FILE}\` omits, marks optional, contradicts across passages/snippets, or cannot be tested objectively on the target app? Treat \`${GUIDE_FILE}\` as authoritative and suggest fixing \`${EXPECTATIONS_FILE}\` (or clarifying \`${GUIDE_FILE}\`) without also suggesting \`targets/<target>/grader.ts\` edits in the same pass.
- **Guide Finding (\`${GUIDE_FILE}\`)**: If the eval holds up, describe what the guided agent missed and what in \`${GUIDE_FILE}\` explains it, and suggest a concrete fix to \`${GUIDE_FILE}\`.
- **Cascading Recommendation Rule**: If \`${GUIDE_FILE}\` or \`${EXPECTATIONS_FILE}\` needs changes, suggest edits **ONLY** to those upstream files and **DO NOT** suggest edits to \`targets/\` in the same pass. Only suggest edits to \`targets/<target>/grader.ts\` if \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` require **NO** changes.

# REPORT OUTPUT REQUIREMENTS

1. **Top-Level Summary (\`## Summary\`)**:
   Complete the \`## Summary\` section at the top of \`${REPORT_FILE}\` with a concise executive summary aggregating findings across all tested targets:
   - **Key Findings**: Concisely synthesize the root causes across any flagged targets (highlighting shared issues if multiple targets failed for the same reason), or confirm that every target is healthy.
   - **Recommended Actions**: Summarize the high-level fixes needed across \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, or \`targets/<target>/\` (or state that no changes are needed if all targets are healthy).

2. **Per-Target Diagnostics (\`### Diagnostic Analysis & Actionable Recommendations\`)**:
   For each target in \`${REPORT_FILE}\`, complete the diagnostic section matching this structure. Name the file each recommendation changes; its exact diff is appended under \`## Suggested Edits\` from your scratch workspace edits:

\`\`\`markdown
### Diagnostic Analysis & Actionable Recommendations

#### Root Cause Analysis:
- **Issue Flagged**: \`[FLAG]\` ([Flag Details])
- [Diagnostic explanation]

#### Actionable Recommendations:
- \`[relative_path_to_file]\`: [What to change and why]
\`\`\`

# INSTRUCTION
When editing \`${REPORT_FILE}\` and making suggested edits in your scratch workspace, you MUST use your built-in structured file editing tools (e.g., replace or write_file). Do not use shell commands (like cat, echo, or heredocs <<) to create or edit files in the terminal. Your workspace edits are emitted as \`suggestions.patch\` and \`## Suggested Edits\`; they are not applied to the pull request.`;
}
