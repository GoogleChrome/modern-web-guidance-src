/**
 * Centralized, typed prompt builder functions for the gd dev evaluation generation process.
 *
 * Having these prompts in one dedicated module ensures high visibility, easy tuning of AI
 * behavior across target capsules (patches, grader.ts, task.md), and
 * type-safe parameter interpolation.
 */

import { type SolutionAgent, GUIDE_FILE, EXPECTATIONS_FILE, REPORT_FILE, TASK_FILE } from '../core/guide-validation.ts';
import { Agents } from '../harness/config.ts';
import type { TargetEvalSummary } from './dev-report.ts';

/** Shared discipline-guide preamble for the solution, zero-passrate, and grader prompts. */
const DISCIPLINE_RELEVANCE_RULE = '\n\n> [!IMPORTANT]\n> This is a **discipline guide**: broad, cross-cutting guidance covering many patterns. Not every expectation will be relevant to this application. An expectation is relevant only if it applies to any web application (such as document metadata or response headers) or the application already contains the kind of element or feature it governs (such as forms, credential inputs, images, overlays or flyouts, cookies or sessions, iframes, external scripts, or a logout flow). Judge relevance by whether that element or feature exists, not by whether the technique the expectation recommends is already used: an existing element that lacks the recommended technique is exactly what should be implemented and tested.';

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
    ? `### ⚠️ PREVIOUS FAILURE CONTEXT
The previous grader failed calibration with this error:
\`\`\`
${truncatedFailure}
\`\`\`
Analyze this failure and modify the existing grader file to fix these assertions while still adhering to all rules below.

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
    ? `\n\n> [!NOTE]\n> Golden solution patches (\`patches/*-solution.patch\`) are **LOCKED** and any edits to them will be discarded. If calibration is failing because a golden solution used a different valid selector, helper, or structure than your test assumed, update \`${opts.graderFile}\` to accept all valid implementations. You may only edit \`${opts.zeroPassratePatchFile}\` if the baseline app already satisfies an expectation and needs to be adjusted.`
    : '';

  const disciplineInstruction = opts.isDisciplineGuide
    ? `${DISCIPLINE_RELEVANCE_RULE} In this task, you do NOT need to write a test for every expectation. Decide relevance from the base application in your workspace, not from the solution patches: do NOT test an expectation whose pattern only exists because a solution patch added it. Also skip expectations the base application already satisfies. If a relevant pattern is implemented in different files or components across solutions, write a project-wide check instead of skipping it. At the top of \`${opts.graderFile}\`, add a comment listing every expectation number as TESTED or SKIPPED with a one-line reason.`
    : '';

  return `${prReviewContextBlock}${contextBlock}# GOAL
Write a Playwright test script named \`${opts.graderFile}\` that directly validates the implementation requirements defined in \`${opts.expectationsFile}\` for the \`${opts.baseApp}\` web application. The grader must be robust enough to pass 100% against all golden solution diffs, as developers using different AI tools will implement valid variations of the requirements.${disciplineInstruction}${patchInstruction}

# INPUTS
1. **Standard Guidance**: \`${opts.guideFile}\`
2. **Requirements**: \`${opts.expectationsFile}\`
3. **Golden Solution Diffs**:
${solutionList}
4. **Anti-Pattern Zero-Passrate Diff**: \`${opts.zeroPassratePatchFile}\` (must fail 100% of tests)
5. **Boilerplate Template**: \`${opts.templateFile}\`

# VERIFICATION & SCOPING RULES

## 1. Strictly Follow the Boilerplate Template
Base your grader's imports, workspace setup, helper function usage, and test structure on \`${opts.templateFile}\`. Use the template's helpers (\`getTargetFiles\`, \`getCssStyleSheet\`, \`getJsProject\`, \`getHtmlDocuments\`) to dynamically locate and analyze modified code across standalone files and embedded template tags. Never hardcode file paths.

## 2. Assertion Hierarchy
- **Static Analysis First**: Prioritize static AST analysis over browser execution for structural assertions. Always avoid regex on HTML, CSS, and JavaScript files.
  - Use **Linkedom** for HTML structure and DOM querying (\`getHtmlDocuments\`).
  - Use **CSSOMNom** for CSS rules, at-rules (@media, @supports, @container, @view-transition), and declarations (\`getCssStyleSheet\`).
  - Use **ts-morph** for JavaScript/TypeScript syntax, AST analysis, and function/variable querying (\`getJsProject\`).
- **Browser Checks Only When Necessary**: Only write browser-based Playwright E2E tests when strictly necessary for requirements that cannot be verified statically (such as computed layout geometry or animations on existing base-app elements). Never write browser E2E tests that depend on newly invented page routes, custom REST API endpoints/payloads, or DOM selectors/button labels that only exist in the golden solution patches and are not part of the base application. Omit browser test blocks entirely if static checks are sufficient.
- **Reference Examples & API Definitions**: Before writing tests, use your file-viewing tools to inspect these reference pattern libraries and API type definitions for implementation patterns:
  - **Test Fixture Helper Signatures (Reference Only)**: [test-fixture.reference.ts](file://${opts.testFixtureReferencePath})
  - **Static Analysis Patterns (Linkedom, CSSOMNom, ts-morph)**: [parser-pattern-library.test.ts](file://${opts.parserPatternLibraryPath})
  - **Browser Analysis Patterns (Playwright)**: [playwright-pattern-library.grader.ts](file://${opts.playwrightPatternLibraryPath})
  - **TS Morph Type Definitions**: [ts-morph.d.ts](file://${opts.tsMorphDtsPath})
  - **Linkedom Type Definitions**: [linkedom.d.ts](file://${opts.linkedomDtsPath})
  - **CSSOMNom Type Definitions**: [cssomnom.d.ts](file://${opts.cssomnomDtsPath})

## 3. Granular Assertions: Single Assertion per Test
Write only one assertion per \`test('...', ...)\` block across both static and browser tests. Do not combine multiple assertions into a single test block. This ensures precise, unambiguous error reporting during calibration if a test fails.

## 4. Precision & Matching Rules
- **Outcome-Based Assertions**: Verify structural and functional requirements in static checks rather than forcing a single narrow implementation when valid alternatives exist.
- **No Patch-Specific Identifier Overfitting**: The golden solution patches are examples of valid implementations, not an exhaustive specification. Never hardcode helper function names, local variable/state names, custom class names, or newly created filenames that happen to appear in the solution patches. Match conceptual roles, standard web platform APIs, and DOM/CSS semantics instead.
- **AST Indirection & Wrapper Resilience**:
  - **Unwrap TypeScript Expressions**: Always unwrap \`AsExpression\`, \`TypeAssertion\`, \`SatisfiesExpression\`, and \`ParenthesizedExpression\` before inspecting a node's kind or properties:
    \`\`\`ts
    function unwrapExpr(node: any): any {
      while (node && (
        node.isKind(SyntaxKind.AsExpression) ||
        node.isKind(SyntaxKind.SatisfiesExpression) ||
        node.isKind(SyntaxKind.ParenthesizedExpression) ||
        node.isKind(SyntaxKind.TypeAssertion)
      )) {
        node = node.getExpression();
      }
      return node;
    }
    \`\`\`
  - **Follow Variable Indirection & Helper Calls**: When a platform API call passes an identifier or invokes a helper function, resolve the referenced \`VariableDeclaration\`, \`BindingElement\`, parameter, or helper function declaration across modules rather than requiring inline literals.
  - **Flexible Error Handling**: Accept both \`try / catch\` (\`TryStatement\`) and Promise \`.catch(...)\` chains.
- **Utility CSS Flexibility**: In apps using utility-first CSS frameworks (e.g., Tailwind), accept either standard CSS declarations (\`getCssStyleSheet\`) or equivalent utility classes on elements in template markup (\`getHtmlDocuments\`).
- **Flexible Pattern Matching**: Avoid exact-string equality for dynamic names or classes. Use loose matches, inclusion checks, and word boundaries (e.g., \`/\\bname\\b/\`) to avoid substring false positives.
- **No Vacuous Guards or \`test.skip()\`**: Never use \`test.skip()\`. Never wrap \`expect(...)\` inside \`if (items.length > 0)\` without first asserting \`expect(items.length).toBeGreaterThan(0)\`. Every \`test()\` block must execute a real, non-trivial assertion that fails when the requirement is absent. For negative expectations (e.g., "Do not use deprecated attribute X", "Do not add attribute Y to below-the-fold elements"), always pair the negative check with an assertion that the target elements and primary feature setup exist (e.g., \`expect(imgs.length).toBeGreaterThan(0)\` and that priority optimization is present), so that an unoptimized baseline or empty \`${opts.zeroPassratePatchFile}\` fails 100% of tests without needing synthetic anti-patterns planted in \`${opts.zeroPassratePatchFile}\`.
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
3. **Preserve High-Level Capability Boundary**: Keep the functional domain and execution context from the **Guide Description** clear (e.g., distinguishing on-device / built-in browser capabilities vs. external cloud APIs) without naming specific JS/CSS APIs, properties, or method names.
4. **No Technical/API Dictation**: Do NOT dictate the underlying technical implementation. NEVER name specific web platform APIs, framework features, or explicit CSS properties or functions (e.g. do NOT say "use @view-transition", "use active-view-transition-type", or "use pagereveal"). Describe the desired user outcome instead.
5. **No Specific Details or Sub-Features**: Keep the request high-level. Do NOT list or specify secondary implementation details, custom sub-features, or edge cases (such as directional animations or accessibility preferences) that are not explicitly stated in the **Guide Description** above.
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

  const contextBlock = parts.join('\n\n');

  let rerunNote = '';
  if (opts.rerunMode === 'needs-eval-gen') {
    rerunNote = `\n> [!NOTE]\n> This rerun is in \`needs-eval-gen\` mode: all target capsules under \`targets/\` will be wiped and regenerated from source guidance after this step. Apply reviewer feedback ONLY to \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\`. Do NOT edit files under \`targets/\`.\n`;
  }

  return `${contextBlock}
${rerunNote}
# GOAL
You are updating the guidance and evaluation files for \`${opts.guideName}\` based on pull request review feedback.
Your goal is to address all reviewer comments by directly updating the relevant files on disk (\`guide.md\`, \`expectations.md\`, \`targets/<target>/task.md\`, and \`targets/<target>/grader.ts\`).

# RULES & INSTRUCTIONS
1. **Direct File Modifications**:
   - Apply requested changes directly to \`guide.md\`, \`expectations.md\`, \`targets/<target>/task.md\`, or \`targets/<target>/grader.ts\` in your workspace using your structured file editing tools.
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
    parts.push(`\n> [!IMPORTANT]\n> This is a subsequent pass on an open pull request. You MUST carefully review the PR comments, ATL/reviewer feedback, and existing branch commits/diff above.\n> - Honor reviewer feedback and requested changes directly in your recommendations and file updates.\n> - Address reviewer concerns without blindly overwriting human-authored changes.\n> - If reviewer feedback conflicts with prior automated suggestions, defer to the human reviewer's guidance.\n`);
    prContextBlock = '\n' + parts.join('\n\n') + '\n';
  }

  return `${prContextBlock}# GOAL
Analyze the evaluation test results across all target applications for the guide \`${opts.guideName}\`, conduct a thorough root-cause investigation for each target based on its flagged status, complete the placeholders in \`${REPORT_FILE}\` (\`### Evaluation Results\` is already populated for each target), and directly apply recommended modifications to the relevant files in the workspace (\`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, \`targets/<target>/task.md\`, \`targets/<target>/grader.ts\`).

# DIRECT FILE UPDATES REQUIREMENT
Whenever you determine that changes are needed in \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, or any target files (\`targets/<target>/task.md\`, \`targets/<target>/grader.ts\`), you MUST:
1. Directly modify those files in your workspace using your structured file editing tools.
2. In addition, document your changes in \`${REPORT_FILE}\` under \`#### Actionable Recommendations:\` with a clear explanation and a unified \`diff\` block illustrating the changes applied.
Do not leave recommended changes only as diff text in the report; always apply them directly to disk.

# INPUTS
1. **Guide**: \`${GUIDE_FILE}\`
2. **Expectations**: \`${EXPECTATIONS_FILE}\`
3. **Target Capsule Directories**: For each target, inspect the artifacts in \`targets/<target>/\`:
   - \`task.md\` (developer test prompt)
   - \`grader.ts\` (Playwright validation suite)
   - \`patches/zero-passrate.patch\` (anti-pattern baseline)
   - \`patches/*-solution.patch\` (golden solution diffs)
4. **Evaluation Run Artifacts**: For each target, \`results/<target>/\` contains various artifacts, such as \`agent.patch\` (code changes generated by the agent), \`chat_log.txt\` (the agent's conversation log), etc.
5. **Target Evaluation Reports & Flags**:
${targetSections}

# SYSTEM WORKFLOW CONTEXT
To accurately diagnose failures, understand how \`gd dev\` generates and executes these components:
1. **Ground Truth**: \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` define the canonical, framework-agnostic implementation and must-pass requirements.
2. **Task Prompt**: \`task.md\` is generated first from only the frontmatter \`description\` of \`${GUIDE_FILE}\` and the target app codebase (isolated from \`${GUIDE_FILE}\` body and \`${EXPECTATIONS_FILE}\`).
3. **Patches**: Golden solution diffs are generated by solution agents provided with only \`task.md\` and \`${GUIDE_FILE}\` (they never see \`${EXPECTATIONS_FILE}\`) and are locked during calibration. The \`zero-passrate.patch\` anti-pattern baseline is generated using \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\`.
4. **Grader**: \`grader.ts\` validates the requirements in \`${EXPECTATIONS_FILE}\` against the application workspace and is calibrated against the locked golden patches (must pass 100%) and zero-passrate patch (must fail 100%). If all active golden solutions fail the same test during calibration, calibration aborts early with \`CALIBRATION_FAILED\`.
5. **Agent Evaluation Run**: If calibration passes, the evaluated agent executes the \`task.md\` prompt against each target app without guidance (\`unguided\`) and with guidance (\`guided\`), and results are verified with \`grader.ts\`.

# ROOT-CAUSE DIAGNOSIS RULES (BY PRIMARY FLAG)

Diagnose each target according to its assigned flag:

0. **\`CALIBRATION_FAILED\`**:
   - The test suite failed calibration against the golden solution patches before agent evaluation runs could execute — typically because all 3 golden solution agents (which only read \`task.md\` + \`guide.md\`) failed the same expectation in \`expectations.md\`, or because \`grader.ts\` has a broken assertion.
   - **Treat \`guide.md\` as Authoritative over \`expectations.md\`**: Compare the failing test(s) against \`guide.md\` and \`expectations.md\`.
     - If \`expectations.md\` demands a detail, sub-feature, selector, or requirement that is omitted from \`guide.md\` or marked optional/secondary in \`guide.md\`, **trim or relax \`expectations.md\`** (and update \`targets/<target>/grader.ts\` to match) rather than bloating \`guide.md\`. Modifying \`guide.md\` triggers \`gd-dev-content\` and pings human ATLs, so avoid editing \`guide.md\` unless \`guide.md\` itself has contradictory code snippets or is genuinely missing a core concept of the feature. Always append:
       \`*(Note: These expectations/grader adjustments have already been applied directly in this PR. After reviewing, add the needs-eval-gen label to the PR to regenerate all target artifacts when running gd dev-gap)*\`
     - If \`expectations.md\` and \`guide.md\` are already aligned and the failure is purely a buggy or overly rigid check in \`targets/<target>/grader.ts\` or an under-scoped prompt in \`targets/<target>/task.md\`, fix \`targets/<target>/grader.ts\` or \`targets/<target>/task.md\` directly without touching \`guide.md\` or \`expectations.md\`. Always append:
       \`*(Note: These target adjustments have already been applied directly in this PR. After reviewing, add the needs-eval-run label to the PR to re-run calibration when running gd dev-gap)*\`

1. **\`INFRASTRUCTURE_ERROR\`**:
   - The test run failed due to execution timeouts, agent CLI process crashes, rate limits (429), or missing setup files.
   - Explain the error context. No code file modifications are needed unless the issue stems from an invalid build/package configuration.

2. **\`MISSING_GUIDANCE_TOOL\`**:
   - The guided agent did not invoke \`modern-web-guidance\`.
   - **Diagnosis**: State that the test prompt in \`task.md\` failed to activate modern web guidance during the agent's run.
   - **Recommendation**: Provide concrete edits for \`targets/<target>/task.md\` so the desired user outcome in the target app more naturally triggers modern web guidance lookup. Always append:
     \`*(Note: This fix has already been applied directly to targets/<target>/task.md in this PR. After reviewing, add the needs-eval-run label to the PR to re-run evaluations when running gd dev-gap)*\`

3. **\`MISSING_EXPECTED_GUIDE\`**:
   - The guided agent invoked guidance tools, but \`${opts.guideName}\` was not among the consumed guides.
   - **Culprit**: \`targets/<target>/task.md\` or the \`description\` in \`${GUIDE_FILE}\`.
   - **Root Cause**: The prompt keywords failed to match the guide's indexing keywords or description frontmatter.
   - **Recommendation**: Provide concrete edits for \`targets/<target>/task.md\` or the frontmatter \`description\` in \`${GUIDE_FILE}\`. Always append:
     \`*(Note: This fix has already been applied directly in this PR. If source guidance was modified, add the needs-eval-gen label; if only targets/<target>/task.md was modified, add the needs-eval-run label)*\`

4. **\`LOW_GUIDED_PASS_RATE\`**:
   - The guided agent pass rate is under 90%.
   - **Root Cause Investigation**: Review the failed assertions in \`${REPORT_FILE}\` and examine \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, and \`targets/<target>/grader.ts\` to understand why the agent fell short. Consider:
     - **Grader Robustness (\`targets/<target>/grader.ts\`)**: Is the grader failing valid implementations due to overly rigid syntax checks, hardcoded selectors/names, or fragile AST queries?
     - **Guidance Quality (\`${GUIDE_FILE}\`)**: Does the guide lack essential modern web practices, clear syntax examples, fallback patterns, or common pitfalls?
     - **Expectations Alignment (\`${EXPECTATIONS_FILE}\`)**: Are the must-pass expectations ambiguous, conflicting, or missing key constraints?
     - **Miscellaneous Issues**: Any other issues discovered.
   - **Default Attribution Bias (\`targets/\` First, Avoid False-Alarm \`guide.md\` Edits)**:
     - Because calibration already passed (meaning all 3 solution agents successfully implemented \`task.md\` using only \`guide.md\` and passed 100% of \`grader.ts\`), **presume \`targets/<target>/grader.ts\` or \`targets/<target>/task.md\` is at fault** (\`gd-dev-eval\`, no edits to \`guide.md\`, no ATL ping) unless \`guide.md\` is demonstrably missing a core requirement or contains a contradictory code snippet.
     - If \`expectations.md\` is misaligned with \`guide.md\` (e.g. requiring something omitted or optional in \`guide.md\`), treat \`guide.md\` as authoritative and trim \`expectations.md\` (plus update \`targets/<target>/grader.ts\`) rather than adding extra requirements to \`guide.md\`.
   - **Recommendation Rules**:
     - **Source-of-Truth Fixes**: If \`${GUIDE_FILE}\` or \`${EXPECTATIONS_FILE}\` needs changes, recommend modifications **ONLY** to those files and **DO NOT** recommend edits to any files in \`targets/\`. Always append:
       \`*(Note: These source guidance changes have already been applied directly to ${GUIDE_FILE} / ${EXPECTATIONS_FILE} in this PR. After reviewing, add the needs-eval-gen label to the PR to regenerate all target artifacts when running gd dev-gap)*\`
     - **Grader Fixes**: When grader fixes are necessary, only recommend direct edits to \`targets/<target>/grader.ts\` if \`${GUIDE_FILE}\` and \`${EXPECTATIONS_FILE}\` require **NO** changes. Always append:
       \`*(Note: These grader adjustments have already been applied directly to targets/<target>/grader.ts in this PR. After reviewing, add the needs-eval-run label to the PR to re-run evaluations when running gd dev-gap)*\`
     - **Miscellaneous Fixes**: Any other recommended fixes (do not have to be file-specific).

5. **\`HIGH_UNGUIDED_PASS_RATE\`**:
   - The unguided agent achieved a 100% pass rate without consuming any guidance.
   - **Root Cause Investigation**: Inspect \`targets/<target>/task.md\`, \`targets/<target>/grader.ts\`, and \`${EXPECTATIONS_FILE}\` to determine why the unguided agent passed every check:
     - **Prompt Leakage (\`targets/<target>/task.md\`)**: Does \`task.md\` spell out the exact APIs, attributes, CSS properties, or implementation recipe from \`${GUIDE_FILE}\` instead of describing only the user-facing outcome?
     - **Overly Lenient Grader (\`targets/<target>/grader.ts\`)**: Are the assertions in \`grader.ts\` too loose or incomplete relative to the requirements in \`${EXPECTATIONS_FILE}\` (allowing a naive or partial unguided implementation to pass 100%)?
   - **Recommendation Rules (\`targets/\` Only — Do NOT Edit \`${GUIDE_FILE}\`)**:
     - Do **NOT** modify \`${GUIDE_FILE}\` or \`${EXPECTATIONS_FILE}\`.
     - If \`targets/<target>/task.md\` leaks implementation details or \`targets/<target>/grader.ts\` has overly loose checks that fail to enforce \`${EXPECTATIONS_FILE}\`, tighten \`targets/<target>/task.md\` and/or \`targets/<target>/grader.ts\` directly. Always append:
       \`*(Note: These target adjustments have already been applied directly in this PR. After reviewing, add the needs-eval-run label to the PR to re-run evaluations when running gd dev-gap)*\`

6. **\`HEALTHY\`**:
   - The target achieved ≥ 90% guided pass rate with all guidance tools and guides correctly consumed.
   - **No investigation or fixes needed**: State that the target is healthy, guidance was consumed as expected, and all assertions passed.
   - **Actionable Recommendations**: Output \`- None (target is healthy and verified).\`

# REPORT OUTPUT REQUIREMENTS

1. **Top-Level Summary (\`## Summary\`)**:
   Complete the \`## Summary\` section at the top of \`${REPORT_FILE}\` with a concise executive summary aggregating findings across all tested targets:
   - **Key Findings**: Concisely synthesize the root causes across any flagged targets (highlighting shared issues if multiple targets failed for the same reason), or confirm that all targets consumed the guidance and passed.
   - **Recommended Actions**: Summarize the high-level fixes needed across \`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, or \`targets/<target>/\` (or state that no changes are needed if all targets are healthy).

2. **Per-Target Diagnostics (\`### Diagnostic Analysis & Actionable Recommendations\`)**:
   For each target in \`${REPORT_FILE}\`, complete the diagnostic section matching this structure. Whenever recommending a change to a file (\`${GUIDE_FILE}\`, \`${EXPECTATIONS_FILE}\`, \`targets/<target>/task.md\`, or \`targets/<target>/grader.ts\`), include a fenced \`diff\` block directly beneath that bullet showing the exact lines to remove (\`-\`) and add (\`+\`) so reviewers can see the changes applied directly in this PR:

\`\`\`markdown
### Diagnostic Analysis & Actionable Recommendations

#### Root Cause Analysis:
- **Issue Flagged**: \`[FLAG]\` ([Flag Details])
- [Diagnostic explanation]

#### Actionable Recommendations:
- \`[relative_path_to_file]\`: [Actionable recommendation]
  \`\`\`diff
  - [exact existing line(s) from the file]
  + [exact proposed replacement line(s)]
  \`\`\`
\`\`\`

# INSTRUCTION
When editing the report and applying recommendations to code or guidance files, you MUST use your built-in structured file editing tools (e.g., replace or write_file). Do not use shell commands (like cat, echo, or heredocs <<) to create or edit files in the terminal. Remember to apply all recommended file modifications directly to the files in your workspace in addition to updating \`${REPORT_FILE}\`.`;
}
