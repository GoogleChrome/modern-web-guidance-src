import type {
  DiscoveredCapsule,
  StaticAuditSignals,
} from './lib/audit-types.ts';

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
  staticSignals: StaticAuditSignals
): string {
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

  return `# Audit Context for Guide Capsule: ${capsule.guideId}
- **Guide Format**: ${capsule.guideFormat}
- **Capsule ID**: ${capsule.capsuleId}

---

## 1. Deterministic Static Pre-Analysis Signals
- **fs.readFileSync Lines in grader.ts**: ${staticSignals.fsReadFileSyncLines.join(', ') || 'None'}
- **Potential Unprompted Hardcoded Locators in grader.ts (not in task.md)**:
${unpromptedSummary}
- **Static Regex / String Checks in grader.ts**:
${regexSummary}
- **Potential Non-Testable Prose/Comment Expectations in expectations.md**:
${proseSummary}
- **Embedding Similarity Coverage Gaps (expectations.md vs grader.ts test titles)**:
${missingCoverageSummary}

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

---

## 4. File: task.md (Line-Numbered)
\`\`\`markdown
${formatWithLineNumbers(taskMd)}
\`\`\`

---

## 5. File: grader.ts (Line-Numbered)
\`\`\`typescript
${formatWithLineNumbers(graderTs)}
\`\`\`
`;
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
      "remedy": "Remove comment requirement; assert functional behavior only."
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
export function buildAuditorInitialPrompt(outputJsonFilename = 'audit-assessment.json'): string {
  return `You are the Lead Evaluation Auditor for the Modern Web Guidance repository.
Your task is to methodically audit the guide capsule documented in \`capsule-context.md\` (located in your current working directory).

Read \`capsule-context.md\` carefully. You must evaluate two pillars:

### Pillar 1: Expectation Completeness & Validity (\`expectations.md\` vs \`guide.md\` & \`task.md\`)
- Are all core technical rules, mandatory constraints, accessibility requirements (e.g. \`prefers-reduced-motion\`, ARIA state sync), and required fallbacks in \`guide.md\` covered by \`expectations.md\`?
- Do any expectations demand non-testable prose or code comments (\`NON_TESTABLE_PROSE\`) rather than observable runtime/AST behavior?
- Do any expectations over-prescribe a single syntax when \`guide.md\` allows alternatives (\`OVER_PRESCRIBED_EXPECTATION\`)?
- Are expectations disconnected from \`task.md\` (\`TASK_PROMPT_DISCONNECT\`)—e.g. requiring UI components that \`task.md\` never asks the developer/agent to build?

### Pillar 2: Grader Fidelity — False Negatives & False Positives (\`grader.ts\` vs \`expectations.md\`, \`task.md\`, \`guide.md\`)
- **FALSE_NEGATIVE_UNPROMPTED_LOCATOR**: Does \`grader.ts\` hardcode specific DOM IDs or class names (e.g., \`#faq-trigger\`, \`#promo-alert\`) that are NOT explicitly mandated in \`task.md\`?
- **FALSE_NEGATIVE_STATIC_FILE_REGEX**: Does \`grader.ts\` use \`fs.readFileSync\` with regex/string checks on raw HTML instead of Playwright DOM evaluation (\`window.getComputedStyle\`, runtime attributes) or multi-file AST checks?
- **FALSE_NEGATIVE_NARROW_IMPLEMENTATION**: Does \`grader.ts\` fail valid alternative implementations permitted by \`guide.md\` (e.g. checking only \`block-size\` when \`height\` is also valid)?
- **FALSE_POSITIVE_SUPERFICIAL_CHECK**: Does \`grader.ts\` pass broken code due to superficial substring/regex matching (e.g. \`/aria-expanded/i.test(html)\` passing static HTML without testing dynamic click toggling)?
- **FALSE_POSITIVE_WEAK_ASSERTION**: Does \`grader.ts\` use weak/vacuous assertions or swallow errors (\`.catch(() => {})\`) such that non-working implementations pass?
- **UNCOVERED_EXPECTATION**: Is any testable bullet in \`expectations.md\` missing a corresponding test in \`grader.ts\`?

### Strict Rules for Grading & Wording
1. **Grades**: Use ONLY \`"HIGH"\`, \`"MEDIUM"\`, or \`"LOW"\` for \`overallPriority\` and issue \`grade\`. NEVER use \`"CRITICAL"\`.
2. **Ample Evidence, Very Tight Wording**:
   - \`citation\`: Exact filename and line numbers (e.g. \`"grader.ts:106-107"\` or \`"expectations.md:2"\` or \`"guide.md:33"\`).
   - \`quoteOrRule\` / \`offendingCode\`: Exact verbatim quote or code snippet from the file.
   - \`counterexampleProof\`: ONE razor-sharp sentence proving why a valid implementation fails (FN) or a broken implementation passes (FP).
   - \`remedy\`: ONE concise sentence specifying the exact fix.
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
  reviewJsonFilename = 'review-result.json'
): string {
  return `You are the Adversarial Assessment Review SubAgent (Turn ${turnNumber} of 3).
Your job is to skeptically audit the assessment in \`${assessmentJsonFilename}\` against the ground-truth source files in \`capsule-context.md\`.

Read BOTH \`capsule-context.md\` and \`${assessmentJsonFilename}\` in your current working directory.

### Your Adversarial Mandate
Critically verify every claim in \`${assessmentJsonFilename}\`:
1. **Hunt for Hallucinated Defects (\`HALLUCINATED_DEFECT\`)**:
   - Did the Auditor claim a selector (e.g. \`#id\` or \`.class\`) is unprompted when it IS actually mentioned in \`task.md\`?
   - Did the Auditor claim a requirement from \`guide.md\` is missing when another expectation or test already covers it?
   - Did the Auditor misinterpret how the Playwright test or AST check in \`grader.ts\` works?
2. **Hunt for Missed Defects (\`MISSED_DEFECT\`)**:
   - Did the Auditor miss any obvious \`fs.readFileSync\` regex check, unprompted hardcoded locator, superficial false-positive regex, or missing mandatory rule from \`guide.md\`?
3. **Verify Evidence & Counterexample Proofs (\`WEAK_COUNTEREXAMPLE_PROOF\`)**:
   - Does every issue have an exact line citation, verbatim snippet, and a concrete 1-sentence counterexample proof?
4. **Verify Grades & Tightness (\`WRONG_GRADE_OR_CITATION\` / \`WORDING_TOO_VERBOSE\`)**:
   - Grades must strictly be \`HIGH\`, \`MEDIUM\`, or \`LOW\` (never \`CRITICAL\`). Line numbers must match \`capsule-context.md\`. Wording must be very tight.

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
  reviewJsonFilename = 'review-result.json'
): string {
  return `You are the Lead Evaluation Auditor (Refinement Turn ${turnNumber} of 3).
The Adversarial Assessment Review SubAgent has reviewed your previous assessment (\`${assessmentJsonFilename}\`) against \`capsule-context.md\` and produced critiques in \`${reviewJsonFilename}\`.

Read \`capsule-context.md\`, \`${assessmentJsonFilename}\`, and \`${reviewJsonFilename}\`.

### Your Task
1. Address EVERY critique in \`${reviewJsonFilename}\`:
   - Remove any \`HALLUCINATED_DEFECT\` that was disproven by the source files.
   - Add any \`MISSED_DEFECT\` with full citation, verbatim snippet, 1-sentence counterexample proof, and 1-line remedy.
   - Tighten any \`WEAK_COUNTEREXAMPLE_PROOF\` or \`WORDING_TOO_VERBOSE\`.
   - Ensure all grades are strictly \`"HIGH"\`, \`"MEDIUM"\`, or \`"LOW"\` (no \`"CRITICAL"\`).
2. Write the updated, complete JSON assessment to \`${assessmentJsonFilename}\` (overwriting the file) and print the JSON block in your final response.
`;
}
