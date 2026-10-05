import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../lib/paths.ts';
import type {
  AuditScope,
  DiscoveredCapsule,
  StaticAuditSignals,
} from './lib/audit-types.ts';

/**
 * Dynamically reads CONTEXT.md from disk (never cached across runs so changes to CONTEXT.md
 * are picked up on every eval run) and extracts the "Writing expectations.md" instructions.
 */
export function loadContextExpectationsGuidelines(
  contextFilePath = path.join(rootDir, 'CONTEXT.md')
): string {
  const defaultFallback = `### Writing expectations.md
Natural-language bulleted list of assertions. These are the input for automated grader generation. Requirements:
- Each assertion should be independently testable
- Be specific enough that a Playwright test can verify it (e.g., "The input has a red border after blur" rather than "The form looks good")
- Cover both positive requirements (what should be present) and negative requirements (what should not be present)`;

  try {
    if (!fs.existsSync(contextFilePath)) {
      return defaultFallback;
    }
    const content = fs.readFileSync(contextFilePath, 'utf8');
    // Match from "### Writing expectations.md" up to the next heading (## or ###) or horizontal rule (---)
    const match = content.match(
      /(###\s+Writing\s+expectations\.md[\s\S]*?)(?=\n(?:---|#{2,3}\s)|\s*$)/i
    );
    if (match && match[1].trim().length > 0) {
      return match[1].trim();
    }
    return defaultFallback;
  } catch {
    return defaultFallback;
  }
}

/**
 * Formats line-numbered file content so the LLM can cite exact line numbers accurately.
 */
export function formatWithLineNumbers(content: string): string {
  return content
    .split('\n')
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join('\n');
}

/**
 * Builds the consolidated capsule context markdown written to workDir/capsule-context.md.
 */
export function buildCapsuleContextFileContent(
  capsule: DiscoveredCapsule,
  guideMd: string,
  expectationsMd: string,
  taskMd: string,
  graderTs: string,
  staticSignals: StaticAuditSignals,
  scope: AuditScope = 'both'
): string {
  const contextGuidelines = loadContextExpectationsGuidelines();

  const unpromptedSummary =
    staticSignals.unpromptedLocators.length > 0
      ? staticSignals.unpromptedLocators
          .map(
            (u) =>
              `- Line ${u.lineNumber}: selector \`${u.selector}\` in \`${u.lineSnippet}\` (inTaskMd: ${u.inTaskMd}, inDemoHtml: ${u.inDemoHtml})`
          )
          .join('\n')
      : 'None detected statically.';

  const regexSummary =
    staticSignals.staticRegexChecks.length > 0
      ? staticSignals.staticRegexChecks
          .map((r) => `- Line ${r.lineNumber}: \`${r.lineSnippet}\``)
          .join('\n')
      : 'None detected statically.';

  const proseSummary =
    staticSignals.proseExpectationSignals.length > 0
      ? staticSignals.proseExpectationSignals
          .map(
            (p) =>
              `- Bullet #${p.bulletIndex} (Line ${p.lineNumber}): matched "${p.matchedKeyword}" in "${p.text}"`
          )
          .join('\n')
      : 'None detected statically.';

  const missingCoverageSummary =
    staticSignals.embeddingCoverage.missing.length > 0
      ? staticSignals.embeddingCoverage.missing
          .map(
            (m) =>
              `- Expectation "${m.expectation}" -> closest test: "${m.bestMatchTest}" (similarity: ${m.similarity})`
          )
          .join('\n')
      : 'All expectations matched a test title above similarity threshold.';

  const staticSection =
    scope === 'expectations'
      ? `## 1. Deterministic Static Pre-Analysis Signals
- **Potential Non-Testable Prose/Comment Expectations in expectations.md**:
${proseSummary}`
      : `## 1. Deterministic Static Pre-Analysis Signals
- **fs.readFileSync Lines in grader.ts**: ${staticSignals.fsReadFileSyncLines.join(', ') || 'None'}
- **Potential Unprompted Hardcoded Locators in grader.ts (not in task.md)**:
${unpromptedSummary}
- **Static Regex / String Checks in grader.ts**:
${regexSummary}
- **Potential Non-Testable Prose/Comment Expectations in expectations.md**:
${proseSummary}
- **Embedding Similarity Coverage Gaps (expectations.md vs grader.ts test titles)**:
${missingCoverageSummary}`;

  const graderAndTaskSections =
    scope === 'expectations'
      ? ''
      : `
---

## 4. File: task.md (Line-Numbered — Used ONLY for Pillar 2 Grader Fidelity, NOT for locking expectations.md)
\`\`\`markdown
${formatWithLineNumbers(taskMd)}
\`\`\`

---

## 5. File: grader.ts (Line-Numbered — Used ONLY for Pillar 2 Grader Fidelity)
\`\`\`typescript
${formatWithLineNumbers(graderTs)}
\`\`\`
`;

  return `# Audit Context for Guide Capsule: ${capsule.guideId}
- **Guide Format**: ${capsule.guideFormat}
- **Capsule ID**: ${capsule.capsuleId}
- **Audit Scope**: ${scope}

---

## 0. Authoritative Project Guidelines from CONTEXT.md (Refreshed Live)
${contextGuidelines}

---

${staticSection}

---

## 2. File: guide.md (Line-Numbered)
\`\`\`markdown
${formatWithLineNumbers(guideMd)}
\`\`\`

---

## 3. File: expectations.md (Line-Numbered)
\`\`\`markdown
${formatWithLineNumbers(expectationsMd)}
\`\`\`
${graderAndTaskSections}`;
}

export const ASSESSMENT_JSON_SCHEMA_EXAMPLE = `{
  "overallPriority": "HIGH",
  "expectationCoverageScore": 65,
  "graderFidelityScore": 40,
  "executiveSummary": "1-2 tight sentences summarizing key expectation gaps and grader false positive/negative risks.",
  "expectationIssues": [
    {
      "id": "E1",
      "category": "NON_TESTABLE_PROSE",
      "grade": "HIGH",
      "citation": "expectations.md:2",
      "quoteOrRule": "The guide or code comments explicitly state that interpolate-size: allow-keywords is a mandatory opt-in...",
      "counterexampleProof": "An agent writing valid CSS without explanatory comments fails this expectation despite following guide.md.",
      "remedy": "Remove comment requirement; assert generic, site-agnostic functional behavior only.",
      "proposedExpectationDraft": "- Applies \`interpolate-size: allow-keywords\` on \`:root\`, an ancestor container, or the animated element itself (unless \`calc-size()\` is used) so transitions to and from intrinsic sizing keywords (\`auto\`, \`min-content\`, \`max-content\`, \`fit-content\`) produce smooth intermediate dimensions."
    }
  ],
  "graderIssues": [
    {
      "id": "G1",
      "category": "FALSE_NEGATIVE_UNPROMPTED_LOCATOR",
      "grade": "HIGH",
      "citation": "grader.ts:106-107",
      "offendingCode": "const trigger = page.locator('#faq-trigger');",
      "counterexampleProof": "task.md asks for an FAQ accordion without mandating '#faq-trigger'; any valid implementation using '.faq-btn' times out.",
      "remedy": "Locate interactive trigger dynamically (e.g. 'button[aria-expanded], summary') or mandate '#faq-trigger' in task.md."
    }
  ]
}`;

/**
 * Prompt for Turn 1: Auditor Agent creates the initial assessment.
 */
export function buildAuditorInitialPrompt(
  outputJsonFilename = 'audit-assessment.json',
  scope: AuditScope = 'both'
): string {
  const contextGuidelines = loadContextExpectationsGuidelines();

  const pillar1Block = `### Pillar 1: Expectation Completeness & Validity (\`expectations.md\` vs \`guide.md\` and \`CONTEXT.md\`)
#### Authoritative Framework Instructions from \`CONTEXT.md\` (Refreshed Live):
${contextGuidelines}

#### Architectural Rule: \`expectations.md\` MUST Be Site-Agnostic (App-Independent)
- \`expectations.md\` lives at the guide root and is used across **multiple different target test applications** (e.g. \`daily-grind\`, \`zenith-tasks\`, etc.).
- Therefore, \`expectations.md\` **MUST BE GENERIC** to the web feature in \`guide.md\` and **MUST NEVER lock to site-specific DOM selectors, IDs, or class names from \`task.md\`** (e.g., NEVER require \`#faq-trigger\`, \`#faq-content\`, \`#promo-alert\`, or \`.product-card\` inside \`expectations.md\`).
- Translating generic expectations from \`expectations.md\` into test-site-specific selectors from \`task.md\` is strictly the job of \`grader.ts\` (Pillar 2), NOT \`expectations.md\`.
- Do **NOT** fault \`expectations.md\` for using generic descriptions (like "an interactive trigger" or "a collapsible element") instead of \`task.md\` IDs. Conversely, if \`expectations.md\` *does* hardcode site-specific IDs/classes that lock it to one test app, flag that as \`TASK_PROMPT_DISCONNECT\` / \`OVER_PRESCRIBED_EXPECTATION\`.

#### Evaluation Criteria for \`expectations.md\`:
- **Compliance with \`CONTEXT.md\` ("Writing expectations.md")**:
  1. **Independently Testable**: Is every assertion independently testable?
  2. **Playwright-Verifiable Specificity (While Remaining Site-Agnostic)**: Is each assertion specific enough about the observable DOM/CSS/runtime outcome that a Playwright grader can map it to any target app (without requiring prose comments or locking to site-specific DOM IDs)?
  3. **Positive AND Negative Requirements**: Does \`expectations.md\` cover BOTH **positive requirements** (what MUST be present per \`guide.md\` DOs, accessibility, and fallbacks) AND **negative requirements** (what MUST NOT be present—e.g. banned anti-patterns / \`DO NOT\` directives from \`guide.md\`)?
- Are all core technical rules, mandatory constraints, accessibility requirements (e.g. \`prefers-reduced-motion\`, ARIA state sync), and required fallbacks in \`guide.md\` covered by \`expectations.md\`?
- Do any expectations demand non-testable prose or code comments (\`NON_TESTABLE_PROSE\`) rather than observable runtime/AST behavior?
- Do any expectations over-prescribe a single syntax when \`guide.md\` allows alternatives (\`OVER_PRESCRIBED_EXPECTATION\`)?
- **CRITICAL**: For EVERY issue in \`expectationIssues\`, you MUST provide \`"proposedExpectationDraft"\`: the exact replacement or new Markdown bullet(s) (\`- ...\` bullet or \`### Heading\\n- ...\`) phrased so that it is **100% generic/site-agnostic** (NO \`#faq-trigger\` or \`task.md\`-specific selectors!), ready to copy-paste directly into \`expectations.md\`, and strictly compliant with \`CONTEXT.md\`.`;

  const pillar2Block = `### Pillar 2: Grader Fidelity — False Negatives & False Positives (\`grader.ts\` vs \`expectations.md\`, \`task.md\`, \`guide.md\`)
- Note: \`grader.ts\` is responsible for translating the generic expectations in \`expectations.md\` into concrete Playwright tests against the specific target site/app defined by \`task.md\`.
- **FALSE_NEGATIVE_UNPROMPTED_LOCATOR**: Does \`grader.ts\` hardcode specific DOM IDs or class names (e.g., \`#faq-trigger\`, \`#promo-alert\`) that are NOT explicitly mandated in \`task.md\` (or present in the target base app)?
- **FALSE_NEGATIVE_STATIC_FILE_REGEX**: Does \`grader.ts\` use \`fs.readFileSync\` with regex/string checks on raw HTML instead of Playwright DOM evaluation (\`window.getComputedStyle\`, runtime attributes) or multi-file AST checks?
- **FALSE_NEGATIVE_NARROW_IMPLEMENTATION**: Does \`grader.ts\` fail valid alternative implementations permitted by \`guide.md\` (e.g. checking only \`block-size\` when \`height\` is also valid)?
- **FALSE_POSITIVE_SUPERFICIAL_CHECK**: Does \`grader.ts\` pass broken code due to superficial substring/regex matching (e.g. \`/aria-expanded/i.test(html)\` passing static HTML without testing dynamic click toggling)?
- **FALSE_POSITIVE_WEAK_ASSERTION**: Does \`grader.ts\` use weak/vacuous assertions or swallow errors (\`.catch(() => {})\`) such that non-working implementations pass?
- **UNCOVERED_EXPECTATION**: Is any testable bullet in \`expectations.md\` missing a corresponding test in \`grader.ts\`?`;

  const scopeInstruction =
    scope === 'expectations'
      ? `**AUDIT SCOPE: EXPECTATIONS ONLY (\`--scope expectations\`)**\nEvaluate ONLY Pillar 1 (\`expectations.md\` vs \`guide.md\` & \`CONTEXT.md\`). Set \`"graderIssues": []\` and \`"graderFidelityScore": 100\`.\n\n${pillar1Block}`
      : scope === 'grader'
        ? `**AUDIT SCOPE: GRADER FIDELITY ONLY (\`--scope grader\`)**\nEvaluate ONLY Pillar 2 (\`grader.ts\` vs \`expectations.md\`, \`task.md\`, \`guide.md\`). Set \`"expectationIssues": []\` and \`"expectationCoverageScore": 100\`.\n\n${pillar2Block}`
        : `**AUDIT SCOPE: BOTH EXPECTATIONS & GRADER (\`--scope both\`)**\nYou must evaluate both pillars:\n\n${pillar1Block}\n\n${pillar2Block}`;

  return `You are the Lead Evaluation Auditor for the Modern Web Guidance repository.
Your task is to methodically audit the guide capsule documented in \`capsule-context.md\` (located in your current working directory).

Read \`capsule-context.md\` carefully.

${scopeInstruction}

### Strict Rules for Grading & Wording (Calibrated Severity Thresholds)
1. **Grades (\`"HIGH"\`, \`"MEDIUM"\`, or \`"LOW"\` ONLY — NEVER \`"CRITICAL"\`)**:
   - **\`"HIGH"\` (Strict Threshold — Reserve ONLY for issues VERY LIKELY to cause a False Negative or False Positive when converted to a \`grader.ts\` script)**:
     - **False Negative Trigger**: An expectation in \`expectations.md\` explicitly demands code comments/prose notes (\`"The code comments state..."\`, \`"The implementation notes that..."\`), meta-grader instructions (\`"Create a zero-passrate test..."\`), directly contradicts \`guide.md\`, hallucinates an unprompted requirement absent from \`guide.md\`, or hardcodes site-specific DOM selectors/all-at-once showcase patterns that will cause a generated \`grader.ts\` to fail valid implementations.
     - **False Positive Trigger**: \`expectations.md\` completely omits the primary core CSS/JS feature of \`guide.md\` (e.g. never asserting \`overflow: clip\` in an \`overflow: clip\` guide, or never asserting \`:has(:user-invalid)\` in a parent validation guide), or \`grader.ts\` uses a superficial check that passes broken code.
   - **\`"MEDIUM"\` (Standard Completeness, Negative-Guard & Fallback Gaps)**:
     - Missing negative requirements (\`DO NOT\` anti-patterns from \`guide.md\`) when \`expectations.md\` already has positive assertions for the modern feature (since the positive assertion already catches most non-compliant code, missing the secondary negative guard is \`"MEDIUM"\`, NOT \`"HIGH"\`).
     - Missing progressive enhancement / \`@supports\` / \`:where()\` fallback specifics, missing secondary properties (e.g. fluid padding when fluid font-size is already tested), or mildly narrow wording that matches \`guide.md\`'s primary example without contradicting it.
   - **\`"LOW"\` (Minor Specificity, Edge-Case & Polish)**:
     - Minor edge-case rules (e.g. mixing multiple basis keywords inside \`calc-size()\`, unit preference nuances like \`rem\` vs \`px\`, or minor phrasing tightness).
   - **Guide \`overallPriority\`**: Set to \`"HIGH"\` ONLY if the capsule has at least one genuine \`"HIGH"\` defect; otherwise set to \`"MEDIUM"\` (if it has \`"MEDIUM"\` defects) or \`"LOW"\`.
2. **Ample Evidence, Very Tight Wording**:
   - \`citation\`: Exact filename and line numbers (e.g. \`"grader.ts:106-107"\` or \`"expectations.md:2"\` or \`"guide.md:33"\`).
   - \`quoteOrRule\` / \`offendingCode\`: Exact verbatim quote or code snippet from the file.
   - \`counterexampleProof\`: ONE razor-sharp sentence proving why a valid implementation fails (FN) or a broken implementation passes (FP).
   - \`remedy\`: ONE concise sentence specifying the exact fix.
   - \`proposedExpectationDraft\` (required on all \`expectationIssues\`): Ready-to-copy, **site-agnostic** Markdown text (\`- ...\` bullet or \`### Heading\\n- ...\`) phrased for direct insertion into \`expectations.md\` (never hardcode \`task.md\` selectors like \`#faq-trigger\`).
3. **Output Persistence**:
   Write the valid JSON object matching the schema below directly to the file \`${outputJsonFilename}\` in your current working directory. Also print the JSON block in your final response.

### Required JSON Schema
\`\`\`json
${ASSESSMENT_JSON_SCHEMA_EXAMPLE}
\`\`\`
`;
}

/**
 * Prompt for Adversarial Reviewer SubAgent (Turns 1..3).
 */
export function buildReviewerSubAgentPrompt(
  turnNumber: number,
  assessmentJsonFilename = 'audit-assessment.json',
  reviewJsonFilename = 'review-result.json',
  scope: AuditScope = 'both'
): string {
  const contextGuidelines = loadContextExpectationsGuidelines();
  const scopeNote =
    scope === 'expectations'
      ? 'NOTE: This audit is scoped to EXPECTATIONS ONLY (`expectationIssues`). Do NOT fault the Auditor for leaving `graderIssues` empty.'
      : scope === 'grader'
        ? 'NOTE: This audit is scoped to GRADER FIDELITY ONLY (`graderIssues`). Do NOT fault the Auditor for leaving `expectationIssues` empty.'
        : 'NOTE: This audit covers BOTH Expectations and Grader Fidelity.';

  return `You are the Adversarial Assessment Review SubAgent (Turn ${turnNumber} of 3).
Your job is to skeptically audit the assessment in \`${assessmentJsonFilename}\` against the ground-truth source files in \`capsule-context.md\` and the authoritative \`CONTEXT.md\` instructions below.
${scopeNote}

### Authoritative Framework Instructions from \`CONTEXT.md\` (Refreshed Live):
${contextGuidelines}

### Architectural Rule: \`expectations.md\` MUST Remain Generic & Site-Agnostic
- \`expectations.md\` lives at the guide root and is shared across multiple target test apps (\`daily-grind\`, \`zenith-tasks\`, etc.).
- \`expectations.md\` and every \`proposedExpectationDraft\` **MUST BE SITE-AGNOSTIC**—they must describe generic web feature behaviors from \`guide.md\` and **MUST NEVER hardcode site-specific selectors/IDs from \`task.md\`** (such as \`#faq-trigger\`, \`#faq-content\`, \`#promo-alert\`). Translating generic expectations into test-site-specific selectors is strictly the job of \`grader.ts\` (Pillar 2).
- If the Auditor faulted \`expectations.md\` for being generic instead of using \`task.md\` selectors, OR if any \`proposedExpectationDraft\` hardcodes \`task.md\` selectors (like \`#faq-trigger\`), flag that immediately as \`HALLUCINATED_DEFECT\` / \`WEAK_COUNTEREXAMPLE_PROOF\` and require a generic, site-agnostic draft!

Read BOTH \`capsule-context.md\` and \`${assessmentJsonFilename}\` in your current working directory.

### Your Adversarial Mandate
Critically verify every claim in \`${assessmentJsonFilename}\`:
1. **Hunt for Hallucinated Defects (\`HALLUCINATED_DEFECT\`)**:
   - Did the Auditor claim a selector (e.g. \`#id\` or \`.class\`) is unprompted in \`grader.ts\` when it IS actually mentioned in \`task.md\`?
   - Did the Auditor falsely fault \`expectations.md\` for not naming \`task.md\` selectors (remember: \`expectations.md\` is supposed to be generic and site-agnostic)?
   - Did the Auditor claim a requirement from \`guide.md\` is missing when another expectation or test already covers it?
   - Did the Auditor misinterpret how the Playwright test or AST check in \`grader.ts\` works?
2. **Hunt for Missed Defects (\`MISSED_DEFECT\`)**:
   - Within the active scope (${scope}), did the Auditor miss any obvious \`fs.readFileSync\` regex check, unprompted hardcoded locator, superficial false-positive regex, missing mandatory positive/negative requirement (\`DO\` / \`DO NOT\`) from \`guide.md\`, or violation of \`CONTEXT.md\`'s "Writing expectations.md" rules?
3. **Verify Evidence, Counterexample Proofs & Proposed Expectation Drafts (\`WEAK_COUNTEREXAMPLE_PROOF\`)**:
   - Does every issue have an exact line citation, verbatim snippet, and a concrete 1-sentence counterexample proof?
   - Does every \`expectationIssue\` include a clean, copy-paste-ready, **100% site-agnostic** Markdown \`proposedExpectationDraft\` that satisfies \`CONTEXT.md\`'s "Writing expectations.md" criteria (independently testable, Playwright-verifiable specificity, positive/negative coverage, and NO hardcoded \`task.md\` selectors)?
4. **Verify Calibrated Grades & Tightness (\`WRONG_GRADE_OR_CITATION\` / \`WORDING_TOO_VERBOSE\`)**:
   - Grades must strictly be \`HIGH\`, \`MEDIUM\`, or \`LOW\` (never \`CRITICAL\`).
   - **Guard Against \`HIGH\` Grade Inflation**: \`HIGH\` is strictly reserved for defects that are **very likely to cause a False Negative or False Positive when converted to a \`grader.ts\` script** (e.g., demanding untestable code comments/prose notes, directly contradicting \`guide.md\`, hardcoding unprompted DOM tags/selectors, or completely omitting the primary core CSS/JS feature). Missing secondary negative requirements (\`DO NOT\` checks when positive checks already assert the modern feature), missing \`@supports\`/\`:where()\` fallback specifics, or mildly narrow positive wording must be graded \`MEDIUM\` (or \`LOW\` for minor edge-case/unit nuances).
   - Line numbers must match \`capsule-context.md\`. Wording must be very tight.

### Decision Rule
- If the assessment in \`${assessmentJsonFilename}\` is accurate, complete, backed by solid counterexample proofs, and free of hallucinated defects, set \`"agreed": true\` and \`"critiques": []\`.
- Otherwise, set \`"agreed": false\` and list each specific critique so the Auditor Agent can fix it.

Write your review JSON directly to \`${reviewJsonFilename}\` in the current working directory and print it in your final response:

\`\`\`json
{
  "agreed": false,
  "summary": "1-sentence summary of review verdict.",
  "critiques": [
    {
      "targetIdOrTopic": "G1 or Missing A11y Rule",
      "flawType": "HALLUCINATED_DEFECT",
      "critique": "Exact explanation of why G1 is wrong or what was missed.",
      "requiredCorrection": "Remove G1 / Add test defect for line 142 / Fix citation."
    }
  ]
}
\`\`\`
`;
}

/**
 * Prompt for Auditor Agent Refinement after receiving Reviewer critiques.
 */
export function buildAuditorRefinementPrompt(
  turnNumber: number,
  assessmentJsonFilename = 'audit-assessment.json',
  reviewJsonFilename = 'review-result.json',
  scope: AuditScope = 'both'
): string {
  const contextGuidelines = loadContextExpectationsGuidelines();

  return `You are the Lead Evaluation Auditor (Refinement Turn ${turnNumber} of 3, Scope: ${scope}).
The Adversarial Assessment Review SubAgent has reviewed your previous assessment (\`${assessmentJsonFilename}\`) against \`capsule-context.md\` and produced critiques in \`${reviewJsonFilename}\`.

### Authoritative Framework Instructions from \`CONTEXT.md\` (Refreshed Live):
${contextGuidelines}

Read \`capsule-context.md\`, \`${assessmentJsonFilename}\`, and \`${reviewJsonFilename}\`.

### Your Task
1. Address EVERY critique in \`${reviewJsonFilename}\`:
   - Remove any \`HALLUCINATED_DEFECT\` that was disproven by the source files.
   - Add any \`MISSED_DEFECT\` with full citation, verbatim snippet, 1-sentence counterexample proof, 1-line remedy, and (for expectation issues) a copy-ready, **site-agnostic** Markdown \`proposedExpectationDraft\` adhering to \`CONTEXT.md\`'s "Writing expectations.md" rules (never hardcode \`task.md\` selectors).
   - Tighten any \`WEAK_COUNTEREXAMPLE_PROOF\` or \`WORDING_TOO_VERBOSE\`.
   - Ensure all grades are strictly \`"HIGH"\`, \`"MEDIUM"\`, or \`"LOW"\` (no \`"CRITICAL"\`).
2. Write the updated, complete JSON assessment to \`${assessmentJsonFilename}\` (overwriting the file) and print the JSON block in your final response.
`;
}
