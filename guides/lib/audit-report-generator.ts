import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditGrade,
  CapsuleAuditAssessment,
  CapsuleAuditResult,
  DiscoveredCapsule,
  StaticAuditSignals,
  ExpectationIssue,
  GraderIssue,
} from './audit-types.ts';

/**
 * Normalizes any grade string to strictly 'HIGH' | 'MEDIUM' | 'LOW' (mapping any legacy 'CRITICAL' to 'HIGH').
 */
export function normalizeGrade(raw?: string): AuditGrade {
  const upper = (raw ?? 'MEDIUM').toUpperCase().trim();
  if (upper === 'CRITICAL' || upper === 'HIGH') return 'HIGH';
  if (upper === 'LOW') return 'LOW';
  return 'MEDIUM';
}

/**
 * Generates a deterministic baseline assessment directly from static analysis signals
 * (used for --dry-run mode or fallback if LLM JSON parsing fails after retries).
 */
export function buildDeterministicBaselineAssessment(
  capsule: DiscoveredCapsule,
  staticSignals: StaticAuditSignals
): CapsuleAuditAssessment {
  const expectationIssues: ExpectationIssue[] = [];
  const graderIssues: GraderIssue[] = [];

  staticSignals.proseExpectationSignals.forEach((sig, i) => {
    expectationIssues.push({
      id: `E${i + 1}`,
      category: 'NON_TESTABLE_PROSE',
      grade: 'HIGH',
      citation: `expectations.md:${sig.lineNumber}`,
      quoteOrRule: sig.text,
      counterexampleProof: `An agent writing valid functional code without "${sig.matchedKeyword}" comments fails this expectation despite following guide.md.`,
      remedy: 'Remove comment requirement; assert observable browser or AST behavior only.',
    });
  });

  staticSignals.unpromptedLocators.forEach((loc) => {
    graderIssues.push({
      id: `G${graderIssues.length + 1}`,
      category: 'FALSE_NEGATIVE_UNPROMPTED_LOCATOR',
      grade: 'HIGH',
      citation: `grader.ts:${loc.lineNumber}`,
      offendingCode: loc.lineSnippet,
      counterexampleProof: `task.md does not mandate selector "${loc.selector}"; any valid implementation using different element IDs or classes fails.`,
      remedy: `Discover element dynamically via semantic roles/styles or mandate "${loc.selector}" in task.md.`,
    });
  });

  staticSignals.staticRegexChecks.forEach((reg) => {
    const isAriaOrHidden = /aria-|hidden/i.test(reg.lineSnippet);
    graderIssues.push({
      id: `G${graderIssues.length + 1}`,
      category: isAriaOrHidden
        ? 'FALSE_POSITIVE_SUPERFICIAL_CHECK'
        : 'FALSE_NEGATIVE_STATIC_FILE_REGEX',
      grade: isAriaOrHidden ? 'HIGH' : 'MEDIUM',
      citation: `grader.ts:${reg.lineNumber}`,
      offendingCode: reg.lineSnippet,
      counterexampleProof: isAriaOrHidden
        ? 'Static HTML attribute matches regex even when JavaScript never dynamically synchronizes state.'
        : 'Fails valid implementations where styles or scripts reside in external files or use alternative formatting.',
      remedy:
        'Use Playwright runtime evaluation (page.evaluate / getComputedStyle / getAttribute) instead of static file regex.',
    });
  });

  staticSignals.embeddingCoverage.missing.forEach((miss) => {
    graderIssues.push({
      id: `G${graderIssues.length + 1}`,
      category: 'UNCOVERED_EXPECTATION',
      grade: 'MEDIUM',
      citation: 'expectations.md',
      offendingCode: `Missing test coverage for: "${miss.expectation}"`,
      counterexampleProof: `No test in grader.ts verifies this expectation (closest match "${miss.bestMatchTest}" has low similarity ${miss.similarity}).`,
      remedy: 'Add a dedicated Playwright test verifying this expectation.',
    });
  });

  const hasHigh =
    expectationIssues.some((e) => e.grade === 'HIGH') ||
    graderIssues.some((g) => g.grade === 'HIGH');
  const hasMedium =
    expectationIssues.some((e) => e.grade === 'MEDIUM') ||
    graderIssues.some((g) => g.grade === 'MEDIUM');

  const overallPriority: AuditGrade = hasHigh ? 'HIGH' : hasMedium ? 'MEDIUM' : 'LOW';

  const expPenalty = expectationIssues.reduce(
    (acc, e) => acc + (e.grade === 'HIGH' ? 15 : e.grade === 'MEDIUM' ? 8 : 3),
    0
  );
  const graderPenalty = graderIssues.reduce(
    (acc, g) => acc + (g.grade === 'HIGH' ? 18 : g.grade === 'MEDIUM' ? 10 : 4),
    0
  );

  const expectationCoverageScore = Math.max(0, Math.min(100, 100 - expPenalty));
  const graderFidelityScore = Math.max(0, Math.min(100, 100 - graderPenalty));

  return {
    overallPriority,
    expectationCoverageScore,
    graderFidelityScore,
    expectationIssues,
    graderIssues,
    executiveSummary:
      expectationIssues.length === 0 && graderIssues.length === 0
        ? 'No expectation or grader defects detected.'
        : `Found ${expectationIssues.length} expectation issue(s) and ${graderIssues.length} grader fidelity issue(s) (${overallPriority} priority).`,
  };
}

function gradeBadge(grade: AuditGrade): string {
  switch (grade) {
    case 'HIGH':
      return '🔴 **HIGH**';
    case 'MEDIUM':
      return '🟠 **MEDIUM**';
    case 'LOW':
      return '🟢 **LOW**';
  }
}

function escapeMdTable(text: string): string {
  return (text || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/**
 * Generates the comprehensive SUMMARY_AUDIT_EVALS.md content from all completed CapsuleAuditResults.
 */
export function generateSummaryMarkdown(results: CapsuleAuditResult[], runId: string): string {
  const gradeOrder: Record<AuditGrade, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...results].sort((a, b) => {
    const pDiff =
      gradeOrder[a.finalAssessment.overallPriority] -
      gradeOrder[b.finalAssessment.overallPriority];
    if (pDiff !== 0) return pDiff;
    return a.finalAssessment.graderFidelityScore - b.finalAssessment.graderFidelityScore;
  });

  const total = results.length;
  const highCount = results.filter((r) => r.finalAssessment.overallPriority === 'HIGH').length;
  const medCount = results.filter((r) => r.finalAssessment.overallPriority === 'MEDIUM').length;
  const lowCount = results.filter((r) => r.finalAssessment.overallPriority === 'LOW').length;

  const legacyCount = results.filter((r) =>
    r.guideFormat.startsWith('legacy - top level guide')
  ).length;
  const newCount = total - legacyCount;

  const avgExpScore =
    total > 0
      ? Math.round(
          results.reduce((s, r) => s + r.finalAssessment.expectationCoverageScore, 0) / total
        )
      : 0;
  const avgGraderScore =
    total > 0
      ? Math.round(
          results.reduce((s, r) => s + r.finalAssessment.graderFidelityScore, 0) / total
        )
      : 0;
  const consensusCount = results.filter((r) => r.consensusReached).length;

  let md = `# Guide Expectations & Grader Fidelity Audit (\`SUMMARY_AUDIT_EVALS.md\`)

- **Run ID**: \`${runId}\`
- **Generated At**: ${new Date().toISOString()}
- **Total Capsules Audited**: **${total}**

---

## 1. Executive Overview

| Metric | Value |
|---|---|
| **Overall Priority Breakdown** | 🔴 **HIGH**: ${highCount} &nbsp;&#124;&nbsp; 🟠 **MEDIUM**: ${medCount} &nbsp;&#124;&nbsp; 🟢 **LOW**: ${lowCount} |
| **Guide Formats Audited** | \`legacy - top level guide\`: ${legacyCount} &nbsp;&#124;&nbsp; \`new - low level guide\`: ${newCount} |
| **Average Expectation Coverage Score** | **${avgExpScore} / 100** |
| **Average Grader Fidelity Score** | **${avgGraderScore} / 100** |
| **Adversarial Review Consensus Rate** | **${consensusCount} / ${total}** (${total > 0 ? Math.round((consensusCount / total) * 100) : 0}%) |

---

## 2. Priority Triage Table (Sorted HIGH $\\rightarrow$ LOW Priority)

| Guide Capsule | Guide Format | Overall Priority | Exp Coverage | Grader Fidelity | Verification | Defects (Exp / Grader) | Executive Summary |
|---|---|---|---|---|---|---|---|
`;

  for (const r of sorted) {
    const a = r.finalAssessment;
    const verifText = r.consensusReached
      ? `✅ Agreed (${r.turnsTaken}t)`
      : `⚠️ Capped (${r.turnsTaken}t)`;
    md += `| [\`${r.capsuleId}\`](#${r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}) | \`${r.guideFormat}\` | ${gradeBadge(a.overallPriority)} | ${a.expectationCoverageScore}/100 | ${a.graderFidelityScore}/100 | ${verifText} | ${a.expectationIssues.length} / ${a.graderIssues.length} | ${escapeMdTable(a.executiveSummary)} |\n`;
  }

  md += `\n---\n\n## 3. Detailed Evidence-First Capsule Assessments\n\n`;

  for (const r of sorted) {
    const a = r.finalAssessment;
    const anchor = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const consensusText = r.consensusReached
      ? `✅ Consensus reached in **${r.turnsTaken} turn(s)** (\`Auditor\` + \`Assessment Review SubAgent\`)`
      : `⚠️ Capped at **${r.turnsTaken} turns** (\`Auditor\` + \`Assessment Review SubAgent\`)`;

    md += `### <a id="${anchor}"></a>\`${r.capsuleId}\`
- **Guide format**: \`${r.guideFormat}\`
- **Overall Priority**: ${gradeBadge(a.overallPriority)} (Expectations Coverage: **${a.expectationCoverageScore}/100** | Grader Fidelity: **${a.graderFidelityScore}/100**)
- **Verification**: ${consensusText}
- **Summary**: ${a.executiveSummary}

`;

    // Table A: Expectation Defects
    md += `#### A. Expectation Defects (\`expectations.md\` vs \`guide.md\`)\n\n`;
    if (a.expectationIssues.length === 0) {
      md += `_No expectation defects identified._\n\n`;
    } else {
      md += `| ID | Issue Type & Grade | Citation | Evidence & Counterexample Proof | Tight Remedy |\n`;
      md += `|---|---|---|---|---|\n`;
      for (const e of a.expectationIssues) {
        const evidenceCell = `**Quote**: \`${escapeMdTable(e.quoteOrRule)}\`<br>**Proof**: ${escapeMdTable(e.counterexampleProof)}`;
        md += `| **${escapeMdTable(e.id)}** | \`${e.category}\`<br>${gradeBadge(normalizeGrade(e.grade))} | \`${escapeMdTable(e.citation)}\` | ${evidenceCell} | ${escapeMdTable(e.remedy)} |\n`;
      }
      md += `\n`;
    }

    // Table B: Grader Defects
    md += `#### B. Grader Defects (\`grader.ts\` vs \`expectations.md\` & \`task.md\`)\n\n`;
    if (a.graderIssues.length === 0) {
      md += `_No grader false positive or false negative defects identified._\n\n`;
    } else {
      md += `| ID | Issue Type & Grade | Citation | Offending Code & Counterexample Proof | Tight Remedy |\n`;
      md += `|---|---|---|---|---|\n`;
      for (const g of a.graderIssues) {
        const codeCell = `**Code**: \`${escapeMdTable(g.offendingCode)}\`<br>**Proof**: ${escapeMdTable(g.counterexampleProof)}`;
        md += `| **${escapeMdTable(g.id)}** | \`${g.category}\`<br>${gradeBadge(normalizeGrade(g.grade))} | \`${escapeMdTable(g.citation)}\` | ${codeCell} | ${escapeMdTable(g.remedy)} |\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

/**
 * Writes SUMMARY_AUDIT_EVALS.md and audit_evals_results.json atomically to the run output directory.
 */
export function writeAuditReports(
  outputDir: string,
  results: CapsuleAuditResult[],
  runId: string
): { summaryPath: string; jsonPath: string } {
  fs.mkdirSync(outputDir, { recursive: true });
  const summaryPath = path.join(outputDir, 'SUMMARY_AUDIT_EVALS.md');
  const jsonPath = path.join(outputDir, 'audit_evals_results.json');

  const md = generateSummaryMarkdown(results, runId);
  fs.writeFileSync(summaryPath, md, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ runId, updatedAt: new Date().toISOString(), results }, null, 2), 'utf8');

  return { summaryPath, jsonPath };
}
