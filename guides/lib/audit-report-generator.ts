import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../../lib/paths.ts';
import type {
  AuditGrade,
  AuditScope,
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
 * Synthesizes a ready-to-copy Markdown expectation bullet if the LLM or baseline did not already provide one.
 */
export function ensureProposedExpectationDraft(e: ExpectationIssue): string {
  if (e.proposedExpectationDraft && e.proposedExpectationDraft.trim().length > 0) {
    return e.proposedExpectationDraft.trim();
  }

  const rawRule = (e.quoteOrRule || '').replace(/^\s*-\s*/, '').trim();
  const rawRemedy = (e.remedy || '').trim();

  if (e.category === 'NON_TESTABLE_PROSE') {
    // Strip "The guide or code comments explicitly state that..." or similar comment requirements
    const stripped = rawRule
      .replace(
        /^(?:the\s+guide\s+or\s+)?code\s+comments\s+(?:explicitly\s+)?(?:state|explain|document|note)\s+that\s+/i,
        ''
      )
      .replace(/\s*(?:and|or)\s+(?:include|add)\s+code\s+comments[^.]*/i, '')
      .trim();

    if (stripped && stripped.toLowerCase() !== rawRule.toLowerCase() && !/comment/i.test(stripped)) {
      const capitalized = stripped.charAt(0).toUpperCase() + stripped.slice(1);
      return `- ${capitalized.endsWith('.') ? capitalized : capitalized + '.'}`;
    }
    return `<!-- Remove non-testable comment bullet from expectations.md -->\n- ${
      rawRemedy
        .replace(/^Remove\s+[^;]+;\s*/i, '')
        .replace(/^assert\s+/i, 'Ensures ')
        .trim() || 'Uses observable DOM/CSS state rather than code comments.'
    }`;
  }

  // Convert remedy instruction into a declarative expectation bullet ready for expectations.md
  const cleanedRemedy = rawRemedy
    .replace(/^(?:Add\s+(?:an?\s+)?expectation\s+(?:bullet\s+)?(?:that|requiring|to)\s+)/i, '')
    .replace(/^(?:Update\s+expectations\.md\s+to\s+(?:require|allow|state)\s+(?:that\s+)?)/i, '')
    .replace(/^(?:Replace\s+with\s+)/i, '')
    .trim();

  const finalBullet = cleanedRemedy.charAt(0).toUpperCase() + cleanedRemedy.slice(1);
  return `- ${finalBullet.endsWith('.') ? finalBullet : finalBullet + '.'}`;
}

export interface CapsuleSourceRelativeLinks {
  guideRel: string;
  expectationsRel: string;
  taskRel: string;
  graderRel: string;
}

/**
 * Resolves relative paths (normalized with '/') from `fromDir` to the capsule's
 * guide.md, expectations.md, task.md, and grader.ts files.
 */
export function resolveCapsuleSourceLinks(
  r: Pick<
    CapsuleAuditResult,
    | 'guideId'
    | 'targetApp'
    | 'guideFilePath'
    | 'expectationsFilePath'
    | 'taskFilePath'
    | 'graderFilePath'
  >,
  fromDir: string
): CapsuleSourceRelativeLinks {
  const guideDirAbs = path.join(rootDir, 'guides', r.guideId);
  const inRepo = (p?: string) => Boolean(p && p.startsWith(rootDir));

  const guideAbs = inRepo(r.guideFilePath) ? r.guideFilePath! : path.join(guideDirAbs, 'guide.md');
  const expectationsAbs = inRepo(r.expectationsFilePath)
    ? r.expectationsFilePath!
    : path.join(guideDirAbs, 'expectations.md');

  const isTargetApp =
    r.targetApp &&
    r.targetApp !== 'legacy' &&
    fs.existsSync(path.join(guideDirAbs, 'targets', r.targetApp));

  const taskAbs = inRepo(r.taskFilePath)
    ? r.taskFilePath!
    : isTargetApp
      ? path.join(guideDirAbs, 'targets', r.targetApp!, 'task.md')
      : path.join(guideDirAbs, 'tasks', 'task.md');

  const graderAbs = inRepo(r.graderFilePath)
    ? r.graderFilePath!
    : isTargetApp
      ? path.join(guideDirAbs, 'targets', r.targetApp!, 'grader.ts')
      : path.join(guideDirAbs, 'grader.ts');

  const toRel = (absPath: string) => path.relative(fromDir, absPath).split(path.sep).join('/');

  return {
    guideRel: toRel(guideAbs),
    expectationsRel: toRel(expectationsAbs),
    taskRel: toRel(taskAbs),
    graderRel: toRel(graderAbs),
  };
}

function resolveCitationTargetHref(citation: string, links: CapsuleSourceRelativeLinks): string | null {
  const lower = (citation || '').toLowerCase();
  if (lower.includes('expectations.md')) return links.expectationsRel;
  if (lower.includes('grader.ts')) return links.graderRel;
  if (lower.includes('guide.md')) return links.guideRel;
  if (lower.includes('task.md')) return links.taskRel;
  return null;
}

/**
 * Generates a deterministic baseline assessment directly from static analysis signals
 * (used for --dry-run mode or fallback if LLM JSON parsing fails after retries).
 */
export function buildDeterministicBaselineAssessment(
  capsule: DiscoveredCapsule,
  staticSignals: StaticAuditSignals,
  scope: AuditScope = 'both'
): CapsuleAuditAssessment {
  const expectationIssues: ExpectationIssue[] = [];
  const graderIssues: GraderIssue[] = [];

  if (scope !== 'grader') {
    staticSignals.proseExpectationSignals.forEach((sig, i) => {
      const issue: ExpectationIssue = {
        id: `E${i + 1}`,
        category: 'NON_TESTABLE_PROSE',
        grade: 'HIGH',
        citation: `expectations.md:${sig.lineNumber}`,
        quoteOrRule: sig.text,
        counterexampleProof: `An agent writing valid functional code without "${sig.matchedKeyword}" comments fails this expectation despite following guide.md.`,
        remedy: 'Remove comment requirement; assert observable browser or AST behavior only.',
      };
      issue.proposedExpectationDraft = ensureProposedExpectationDraft(issue);
      expectationIssues.push(issue);
    });
  }

  if (scope !== 'expectations') {
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
  }

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

  const expectationCoverageScore =
    scope === 'grader' ? 100 : Math.max(0, Math.min(100, 100 - expPenalty));
  const graderFidelityScore =
    scope === 'expectations' ? 100 : Math.max(0, Math.min(100, 100 - graderPenalty));

  return {
    overallPriority,
    expectationCoverageScore,
    graderFidelityScore,
    expectationIssues,
    graderIssues,
    executiveSummary:
      expectationIssues.length === 0 && graderIssues.length === 0
        ? `No defects detected (scope: ${scope}).`
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
export function generateSummaryMarkdown(
  results: CapsuleAuditResult[],
  runId: string,
  outputDir = path.join(rootDir, 'harness', 'results', 'eval-audits', runId)
): string {
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
  const activeScopes = Array.from(new Set(results.map((r) => r.auditScope || 'both'))).join(', ');

  let md = `# Guide Expectations & Grader Fidelity Audit (\`SUMMARY_AUDIT_EVALS.md\`)

- **Run ID**: \`${runId}\`
- **Audit Scope**: \`${activeScopes || 'both'}\`
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

| Guide Capsule & Source Files | Guide Format | Overall Priority | Exp Coverage | Grader Fidelity | Verification | Defects (Exp / Grader) | Executive Summary |
|---|---|---|---|---|---|---|---|
`;

  for (const r of sorted) {
    const a = r.finalAssessment;
    const scope = r.auditScope || 'both';
    const links = resolveCapsuleSourceLinks(r, outputDir);
    const verifText = r.consensusReached
      ? `✅ Agreed (${r.turnsTaken}t)`
      : `⚠️ Capped (${r.turnsTaken}t)`;
    const sourceLinksMd = `[guide](${links.guideRel}) · [expectations](${links.expectationsRel}) · [task](${links.taskRel}) · [grader](${links.graderRel})`;
    const expScoreStr = scope === 'grader' ? 'N/A' : `${a.expectationCoverageScore}/100`;
    const graderScoreStr = scope === 'expectations' ? 'N/A' : `${a.graderFidelityScore}/100`;
    md += `| [\`${r.capsuleId}\`](#${r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()})<br>${sourceLinksMd} | \`${r.guideFormat}\` | ${gradeBadge(a.overallPriority)} | ${expScoreStr} | ${graderScoreStr} | ${verifText} | ${a.expectationIssues.length} / ${a.graderIssues.length} | ${escapeMdTable(a.executiveSummary)} |\n`;
  }

  md += `\n---\n\n## 3. Detailed Evidence-First Capsule Assessments\n\n`;

  for (const r of sorted) {
    const a = r.finalAssessment;
    const scope = r.auditScope || 'both';
    const links = resolveCapsuleSourceLinks(r, outputDir);
    const anchor = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const consensusText = r.consensusReached
      ? `✅ Consensus reached in **${r.turnsTaken} turn(s)** (\`Auditor\` + \`Assessment Review SubAgent\`)`
      : `⚠️ Capped at **${r.turnsTaken} turns** (\`Auditor\` + \`Assessment Review SubAgent\`)`;

    md += `### <a id="${anchor}"></a>\`${r.capsuleId}\`
- **Guide format**: \`${r.guideFormat}\` &nbsp;|&nbsp; **Audit Scope**: \`${scope}\`
- **Source Files**: [\`guide.md\`](${links.guideRel}) &nbsp;|&nbsp; [\`expectations.md\`](${links.expectationsRel}) &nbsp;|&nbsp; [\`task.md\`](${links.taskRel}) &nbsp;|&nbsp; [\`grader.ts\`](${links.graderRel})
- **Overall Priority**: ${gradeBadge(a.overallPriority)} (Expectations Coverage: **${scope === 'grader' ? 'N/A' : `${a.expectationCoverageScore}/100`}** | Grader Fidelity: **${scope === 'expectations' ? 'N/A' : `${a.graderFidelityScore}/100`}**)
- **Verification**: ${consensusText}
- **Summary**: ${a.executiveSummary}

`;

    if (scope !== 'grader') {
      md += `#### A. Expectation Defects ([\`expectations.md\`](${links.expectationsRel}) vs [\`guide.md\`](${links.guideRel}))\n\n`;
      if (a.expectationIssues.length === 0) {
        md += `_No expectation defects identified._\n\n`;
      } else {
        md += `| ID | Issue Type & Grade | Citation | Evidence & Counterexample Proof | Tight Remedy & Proposed Expectation Draft |\n`;
        md += `|---|---|---|---|---|\n`;
        for (const e of a.expectationIssues) {
          const draft = ensureProposedExpectationDraft(e);
          const targetHref = resolveCitationTargetHref(e.citation, links);
          const citationMd = targetHref
            ? `[\`${escapeMdTable(e.citation)}\`](${targetHref})`
            : `\`${escapeMdTable(e.citation)}\``;
          const evidenceCell = `**Quote**: \`${escapeMdTable(e.quoteOrRule)}\`<br>**Proof**: ${escapeMdTable(e.counterexampleProof)}`;
          const remedyAndDraftCell = `**Remedy**: ${escapeMdTable(e.remedy)}<br>**Proposed Draft (\`expectations.md\`)**: \`${escapeMdTable(draft)}\``;
          md += `| **${escapeMdTable(e.id)}** | \`${e.category}\`<br>${gradeBadge(normalizeGrade(e.grade))} | ${citationMd} | ${evidenceCell} | ${remedyAndDraftCell} |\n`;
        }
        md += `\n`;
      }
    }

    if (scope !== 'expectations') {
      md += `#### B. Grader Defects ([\`grader.ts\`](${links.graderRel}) vs [\`expectations.md\`](${links.expectationsRel}) & [\`task.md\`](${links.taskRel}))\n\n`;
      if (a.graderIssues.length === 0) {
        md += `_No grader false positive or false negative defects identified._\n\n`;
      } else {
        md += `| ID | Issue Type & Grade | Citation | Offending Code & Counterexample Proof | Tight Remedy |\n`;
        md += `|---|---|---|---|---|\n`;
        for (const g of a.graderIssues) {
          const targetHref = resolveCitationTargetHref(g.citation, links);
          const citationMd = targetHref
            ? `[\`${escapeMdTable(g.citation)}\`](${targetHref})`
            : `\`${escapeMdTable(g.citation)}\``;
          const codeCell = `**Code**: \`${escapeMdTable(g.offendingCode)}\`<br>**Proof**: ${escapeMdTable(g.counterexampleProof)}`;
          md += `| **${escapeMdTable(g.id)}** | \`${g.category}\`<br>${gradeBadge(normalizeGrade(g.grade))} | ${citationMd} | ${codeCell} | ${escapeMdTable(g.remedy)} |\n`;
        }
        md += `\n`;
      }
    }

    md += `---\n\n`;
  }

  return md;
}

function escapeHtml(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlGradeBadge(grade: AuditGrade): string {
  const normalized = normalizeGrade(grade);
  const cls =
    normalized === 'HIGH'
      ? 'badge-high'
      : normalized === 'MEDIUM'
        ? 'badge-medium'
        : 'badge-low';
  const dot = normalized === 'HIGH' ? '🔴' : normalized === 'MEDIUM' ? '🟠' : '🟢';
  return `<span class="badge ${cls}">${dot} ${normalized}</span>`;
}

function htmlScorePill(score: number, disabled = false): string {
  if (disabled) {
    return `<span class="score-pill score-na">N/A</span>`;
  }
  const cls = score >= 85 ? 'score-good' : score >= 65 ? 'score-warn' : 'score-bad';
  return `<span class="score-pill ${cls}">${score}/100</span>`;
}

function renderSourceLinksBarHtml(links: CapsuleSourceRelativeLinks): string {
  return `<div class="source-links-group">
    <a href="${escapeHtml(links.guideRel)}" target="_blank" class="source-file-pill" title="Open guide.md">📘 guide.md</a>
    <a href="${escapeHtml(links.expectationsRel)}" target="_blank" class="source-file-pill" title="Open expectations.md">📋 expectations.md</a>
    <a href="${escapeHtml(links.taskRel)}" target="_blank" class="source-file-pill" title="Open task.md">📝 task.md</a>
    <a href="${escapeHtml(links.graderRel)}" target="_blank" class="source-file-pill" title="Open grader.ts">🧪 grader.ts</a>
  </div>`;
}

function renderCitationHtml(citation: string, links: CapsuleSourceRelativeLinks): string {
  const href = resolveCitationTargetHref(citation, links);
  if (href) {
    return `<a href="${escapeHtml(href)}" target="_blank" class="citation-link" title="Open source file">${escapeHtml(citation)} ↗</a>`;
  }
  return `<code class="citation-code">${escapeHtml(citation)}</code>`;
}

function renderCapsuleCardHtml(
  r: CapsuleAuditResult,
  fromDir: string,
  standalone = false
): string {
  const a = r.finalAssessment;
  const scope = r.auditScope || 'both';
  const links = resolveCapsuleSourceLinks(r, fromDir);
  const anchor = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
  const isLegacy = r.guideFormat.startsWith('legacy - top level guide');
  const formatKey = isLegacy ? 'legacy' : 'new';
  const consensusHtml = r.consensusReached
    ? `<span class="verif-badge verif-ok">✅ Agreed (${r.turnsTaken} turn${r.turnsTaken === 1 ? '' : 's'})</span>`
    : `<span class="verif-badge verif-warn">⚠️ Capped (${r.turnsTaken} turn${r.turnsTaken === 1 ? '' : 's'})</span>`;

  let expSectionHtml = '';
  if (scope !== 'grader') {
    if (a.expectationIssues.length === 0) {
      expSectionHtml = `
      <h4 class="sub-heading">
        A. Expectation Defects (<a href="${escapeHtml(links.expectationsRel)}" target="_blank" class="inline-file-link"><code>expectations.md</code></a> vs <a href="${escapeHtml(links.guideRel)}" target="_blank" class="inline-file-link"><code>guide.md</code></a>)
        <span class="count-pill">0</span>
      </h4>
      <div class="empty-state">✅ No expectation defects identified.</div>`;
    } else {
      expSectionHtml = `
      <h4 class="sub-heading">
        A. Expectation Defects (<a href="${escapeHtml(links.expectationsRel)}" target="_blank" class="inline-file-link"><code>expectations.md</code></a> vs <a href="${escapeHtml(links.guideRel)}" target="_blank" class="inline-file-link"><code>guide.md</code></a>)
        <span class="count-pill">${a.expectationIssues.length}</span>
      </h4>
      <div class="table-wrap"><table class="defect-table">
        <thead>
          <tr>
            <th style="width:68px">ID</th>
            <th style="width:200px">Issue Type &amp; Grade</th>
            <th style="width:150px">Citation</th>
            <th style="width:34%">Evidence &amp; Counterexample Proof</th>
            <th>Recommendation &amp; Proposed Expectation Draft</th>
          </tr>
        </thead>
        <tbody>
          ${a.expectationIssues
            .map((e, idx) => {
              const draft = ensureProposedExpectationDraft(e);
              const draftId = `draft-${slug}-${idx}`;
              return `<tr class="defect-row">
            <td class="id-cell"><span class="defect-id-pill">${escapeHtml(e.id)}</span></td>
            <td class="type-cell">
              <div class="category-tag">${escapeHtml(e.category)}</div>
              <div style="margin-top:8px">${htmlGradeBadge(normalizeGrade(e.grade))}</div>
            </td>
            <td class="citation-cell">${renderCitationHtml(e.citation, links)}</td>
            <td class="evidence-cell">
              <div class="evidence-block">
                <div class="evidence-label">Current Quote / Rule</div>
                <pre class="code-snippet">${escapeHtml(e.quoteOrRule)}</pre>
              </div>
              <div class="proof-block">
                <div class="proof-label">Counterexample Proof</div>
                <div>${escapeHtml(e.counterexampleProof)}</div>
              </div>
            </td>
            <td class="remedy-cell">
              <div class="remedy-callout">
                <div class="remedy-callout-label">Recommended Fix</div>
                <div class="remedy-callout-text">${escapeHtml(e.remedy)}</div>
              </div>
              <div class="draft-box">
                <div class="draft-box-header">
                  <span>✨ Proposed Draft for <a href="${escapeHtml(links.expectationsRel)}" target="_blank" style="color:inherit;text-decoration:underline">expectations.md</a></span>
                  <button type="button" class="copy-btn" onclick="copyDraftText('${draftId}', this)">📋 Copy Markdown</button>
                </div>
                <pre id="${draftId}" class="code-snippet draft-snippet">${escapeHtml(draft)}</pre>
              </div>
            </td>
          </tr>`;
            })
            .join('\n')}
        </tbody>
      </table></div>`;
    }
  }

  let graderSectionHtml = '';
  if (scope !== 'expectations') {
    if (a.graderIssues.length === 0) {
      graderSectionHtml = `
      <h4 class="sub-heading">
        B. Grader Defects (<a href="${escapeHtml(links.graderRel)}" target="_blank" class="inline-file-link"><code>grader.ts</code></a> vs <a href="${escapeHtml(links.expectationsRel)}" target="_blank" class="inline-file-link"><code>expectations.md</code></a> &amp; <a href="${escapeHtml(links.taskRel)}" target="_blank" class="inline-file-link"><code>task.md</code></a>)
        <span class="count-pill">0</span>
      </h4>
      <div class="empty-state">✅ No grader false-positive or false-negative defects identified.</div>`;
    } else {
      graderSectionHtml = `
      <h4 class="sub-heading">
        B. Grader Defects (<a href="${escapeHtml(links.graderRel)}" target="_blank" class="inline-file-link"><code>grader.ts</code></a> vs <a href="${escapeHtml(links.expectationsRel)}" target="_blank" class="inline-file-link"><code>expectations.md</code></a> &amp; <a href="${escapeHtml(links.taskRel)}" target="_blank" class="inline-file-link"><code>task.md</code></a>)
        <span class="count-pill">${a.graderIssues.length}</span>
      </h4>
      <div class="table-wrap"><table class="defect-table">
        <thead>
          <tr>
            <th style="width:68px">ID</th>
            <th style="width:200px">Issue Type &amp; Grade</th>
            <th style="width:150px">Citation</th>
            <th style="width:38%">Offending Code &amp; Counterexample Proof</th>
            <th>Recommended Fix</th>
          </tr>
        </thead>
        <tbody>
          ${a.graderIssues
            .map(
              (g) => `<tr class="defect-row">
            <td class="id-cell"><span class="defect-id-pill">${escapeHtml(g.id)}</span></td>
            <td class="type-cell">
              <div class="category-tag">${escapeHtml(g.category)}</div>
              <div style="margin-top:8px">${htmlGradeBadge(normalizeGrade(g.grade))}</div>
            </td>
            <td class="citation-cell">${renderCitationHtml(g.citation, links)}</td>
            <td class="evidence-cell">
              <div class="evidence-block">
                <div class="evidence-label">Offending Code</div>
                <pre class="code-snippet">${escapeHtml(g.offendingCode)}</pre>
              </div>
              <div class="proof-block">
                <div class="proof-label">Counterexample Proof</div>
                <div>${escapeHtml(g.counterexampleProof)}</div>
              </div>
            </td>
            <td class="remedy-cell">
              <div class="remedy-callout">
                <div class="remedy-callout-label">Recommended Fix</div>
                <div class="remedy-callout-text">${escapeHtml(g.remedy)}</div>
              </div>
            </td>
          </tr>`
            )
            .join('\n')}
        </tbody>
      </table></div>`;
    }
  }

  const itemLinkHtml = standalone
    ? `<a href="../SUMMARY_AUDIT_EVALS.html#${anchor}" class="btn-link">← Back to Full Audit Summary</a>`
    : `<a href="items/${slug}.html" class="btn-link" title="Open standalone capsule report">Open Standalone Page ↗</a>`;

  return `<details class="capsule-card priority-${a.overallPriority.toLowerCase()}" id="${anchor}" data-priority="${a.overallPriority}" data-format="${formatKey}" open>
    <summary class="capsule-card-header">
      <div class="capsule-title-group">
        <span class="capsule-id">${escapeHtml(r.capsuleId)}</span>
        <span class="format-badge format-${formatKey}">${escapeHtml(r.guideFormat)}</span>
        ${htmlGradeBadge(a.overallPriority)}
      </div>
      <div class="capsule-metrics-group">
        <span class="metric-chip">Exp Coverage: ${htmlScorePill(a.expectationCoverageScore, scope === 'grader')}</span>
        <span class="metric-chip">Grader Fidelity: ${htmlScorePill(a.graderFidelityScore, scope === 'expectations')}</span>
        ${consensusHtml}
        ${itemLinkHtml}
      </div>
    </summary>
    <div class="capsule-card-body">
      <div class="source-files-bar">
        <span class="source-files-label">Source Files (Relative Links):</span>
        ${renderSourceLinksBarHtml(links)}
      </div>
      <div class="exec-summary-banner">
        <strong>Executive Summary:</strong> ${escapeHtml(a.executiveSummary)}
      </div>
      ${expSectionHtml}
      ${graderSectionHtml}
    </div>
  </details>`;
}

const SHARED_HTML_STYLES = `
  :root {
    --bg: #f8fafc;
    --surface: #ffffff;
    --surface-subtle: #f1f5f9;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --text: #0f172a;
    --text-muted: #475569;
    --primary: #2563eb;
    --high-bg: #fef2f2;
    --high-text: #991b1b;
    --high-border: #fecaca;
    --med-bg: #fffbeb;
    --med-text: #92400e;
    --med-border: #fde68a;
    --low-bg: #f0fdf4;
    --low-text: #166534;
    --low-border: #bbf7d0;
    --code-bg: #1e293b;
    --code-text: #f8fafc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 36px 60px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
    font-size: 14px;
  }
  .container {
    max-width: 1560px;
    margin: 0 auto;
  }
  header.report-header {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
  }
  header.report-header h1 {
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .meta-list {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }
  .meta-list code {
    background: var(--surface-subtle);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    color: var(--text);
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }
  .kpi-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 8px;
  }
  .kpi-value {
    font-size: 24px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .kpi-sub {
    margin-top: 6px;
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .section-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px 24px;
    margin-bottom: 28px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .section-header h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
  }
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 18px;
    background: var(--surface-subtle);
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  .search-input {
    flex: 1;
    min-width: 240px;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 13.5px;
    background: #fff;
  }
  .filter-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-strong);
    background: #fff;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    color: var(--text);
    transition: all 0.15s ease;
  }
  .filter-btn:hover {
    background: #e2e8f0;
  }
  .filter-btn.active {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  th, td {
    padding: 15px 16px;
    text-align: left;
    border-bottom: 1.5px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    vertical-align: top;
  }
  th:last-child, td:last-child {
    border-right: none;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #334155;
    border-bottom: 2px solid #94a3b8;
  }
  tbody tr.triage-row:nth-child(even) > td {
    background: #f8fafc;
  }
  tbody tr.triage-row:hover > td {
    background: #eff6ff;
  }
  table.defect-table tbody tr.defect-row > td {
    border-bottom: 2px solid #94a3b8;
    padding: 18px 16px;
  }
  table.defect-table tbody tr.defect-row:last-child > td {
    border-bottom: none;
  }
  table.defect-table tbody tr.defect-row:nth-child(odd) > td {
    background: #ffffff;
  }
  table.defect-table tbody tr.defect-row:nth-child(even) > td {
    background: #f8fafc;
  }
  .defect-id-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    padding: 4px 10px;
    border-radius: 6px;
    background: #0f172a;
    color: #ffffff;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
  }
  .badge-high {
    background: var(--high-bg);
    color: var(--high-text);
    border: 1px solid var(--high-border);
  }
  .badge-medium {
    background: var(--med-bg);
    color: var(--med-text);
    border: 1px solid var(--med-border);
  }
  .badge-low {
    background: var(--low-bg);
    color: var(--low-text);
    border: 1px solid var(--low-border);
  }
  .format-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 5px;
    font-size: 11.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
  }
  .format-legacy {
    background: #f3e8ff;
    color: #6b21a8;
    border: 1px solid #d8b4fe;
  }
  .format-new {
    background: #e0f2fe;
    color: #075985;
    border: 1px solid #bae6fd;
  }
  .score-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
  }
  .score-good { background: #dcfce7; color: #166534; }
  .score-warn { background: #fef3c7; color: #92400e; }
  .score-bad { background: #fee2e2; color: #991b1b; }
  .score-na { background: #e2e8f0; color: #64748b; }
  .verif-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .verif-ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .verif-warn { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  .capsule-card {
    background: var(--surface);
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    margin-bottom: 24px;
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05);
    overflow: hidden;
  }
  .capsule-card.priority-high { border-left: 5px solid #ef4444; }
  .capsule-card.priority-medium { border-left: 5px solid #f59e0b; }
  .capsule-card.priority-low { border-left: 5px solid #22c55e; }
  .capsule-card-header {
    padding: 16px 22px;
    background: var(--surface-subtle);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    list-style: none;
    border-bottom: 1px solid #cbd5e1;
  }
  .capsule-card-header::-webkit-details-marker { display: none; }
  .capsule-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .capsule-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  .capsule-metrics-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 12.5px;
  }
  .capsule-card-body {
    padding: 20px 24px;
  }
  .source-files-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    padding: 9px 14px;
    background: #f8fafc;
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .source-files-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .source-links-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .source-file-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 6px;
    background: #ffffff;
    border: 1px solid var(--border-strong);
    color: var(--primary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.12s ease;
  }
  .source-file-pill:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    text-decoration: underline;
  }
  .inline-file-link {
    color: var(--primary);
    text-decoration: none;
  }
  .inline-file-link:hover {
    text-decoration: underline;
  }
  .exec-summary-banner {
    background: #f8fafc;
    border: 1px solid var(--border);
    border-left: 4px solid var(--primary);
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 18px;
    font-size: 13.5px;
  }
  .sub-heading {
    margin: 20px 0 12px 0;
    font-size: 14.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .count-pill {
    background: var(--border);
    color: var(--text);
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 12px;
  }
  .category-tag {
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    font-weight: 600;
    background: #f1f5f9;
    color: #1e293b;
    padding: 3px 7px;
    border-radius: 5px;
    border: 1px solid #cbd5e1;
    word-break: break-all;
  }
  .citation-code, .citation-link {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: #eff6ff;
    color: #1d4ed8;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid #bfdbfe;
    display: inline-block;
    word-break: break-all;
    text-decoration: none;
    font-weight: 600;
  }
  .citation-link:hover {
    background: #dbeafe;
    text-decoration: underline;
  }
  .evidence-block {
    margin-bottom: 10px;
  }
  .evidence-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #475569;
    margin-bottom: 4px;
  }
  pre.code-snippet {
    margin: 0;
    padding: 10px 13px;
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .proof-block {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-left: 4px solid #f59e0b;
    padding: 9px 12px;
    border-radius: 7px;
    font-size: 13px;
    line-height: 1.45;
    color: #78350f;
  }
  .proof-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #92400e;
    margin-bottom: 3px;
  }
  .remedy-cell {
    font-weight: 400;
    color: var(--text);
  }
  .remedy-callout {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 4px solid #2563eb;
    border-radius: 7px;
    padding: 10px 13px;
    margin-bottom: 12px;
  }
  .remedy-callout-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #1d4ed8;
    margin-bottom: 3px;
  }
  .remedy-callout-text {
    font-size: 13px;
    line-height: 1.45;
    color: #1e3a8a;
    font-weight: 500;
  }
  .draft-box {
    background: #ffffff;
    border: 1.5px solid #86efac;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(22, 101, 52, 0.07);
  }
  .draft-box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 12px;
    background: #dcfce7;
    border-bottom: 1px solid #86efac;
    color: #14532d;
    font-size: 11.5px;
    font-weight: 700;
  }
  pre.draft-snippet {
    border: none;
    border-radius: 0;
    background: #f0fdf4;
    color: #064e3b;
    padding: 12px 14px;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .copy-btn {
    background: #ffffff;
    border: 1px solid #22c55e;
    color: #15803d;
    border-radius: 5px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }
  .copy-btn:hover {
    background: #f0fdf4;
  }
  .empty-state {
    padding: 12px 16px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }
  .btn-link {
    text-decoration: none;
    color: var(--primary);
    font-weight: 600;
    font-size: 12.5px;
    padding: 4px 9px;
    border-radius: 6px;
    border: 1px solid #bfdbfe;
    background: #eff6ff;
  }
  .btn-link:hover {
    background: #dbeafe;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .bold { font-weight: 700; }
  a.capsule-jump {
    color: var(--primary);
    text-decoration: none;
    font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  a.capsule-jump:hover { text-decoration: underline; }
`;

const SHARED_COPY_SCRIPT = `
  function copyDraftText(elementId, btn) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1600);
    });
  }
`;

/**
 * Generates a standalone HTML page for a single capsule audit result.
 */
export function generateCapsuleHtml(
  result: CapsuleAuditResult,
  runId: string,
  itemsDir = path.join(rootDir, 'harness', 'results', 'eval-audits', runId, 'items')
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Audit Report: ${escapeHtml(result.capsuleId)} (${escapeHtml(runId)})</title>
  <style>${SHARED_HTML_STYLES}</style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <div>
        <h1>Guide Capsule Audit: <code>${escapeHtml(result.capsuleId)}</code></h1>
        <div class="meta-list">
          <span>Run ID: <code>${escapeHtml(runId)}</code></span>
          <span>Scope: <code>${escapeHtml(result.auditScope || 'both')}</code></span>
          <span>Guide Format: <code>${escapeHtml(result.guideFormat)}</code></span>
          <span>Target App: <code>${escapeHtml(result.targetApp)}</code></span>
          <span>Timestamp: <code>${escapeHtml(result.timestamp)}</code></span>
        </div>
      </div>
      <div>
        <a href="../SUMMARY_AUDIT_EVALS.html" class="btn-link">← Full Audit Summary</a>
      </div>
    </header>
    ${renderCapsuleCardHtml(result, itemsDir, true)}
  </div>
  <script>${SHARED_COPY_SCRIPT}</script>
</body>
</html>`;
}

/**
 * Generates the comprehensive, interactive SUMMARY_AUDIT_EVALS.html content from all completed CapsuleAuditResults.
 */
export function generateSummaryHtml(
  results: CapsuleAuditResult[],
  runId: string,
  outputDir = path.join(rootDir, 'harness', 'results', 'eval-audits', runId)
): string {
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
  const consensusPct = total > 0 ? Math.round((consensusCount / total) * 100) : 0;
  const activeScopes = Array.from(new Set(results.map((r) => r.auditScope || 'both'))).join(', ');

  const triageRowsHtml = sorted
    .map((r) => {
      const a = r.finalAssessment;
      const scope = r.auditScope || 'both';
      const links = resolveCapsuleSourceLinks(r, outputDir);
      const anchor = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
      const isLegacy = r.guideFormat.startsWith('legacy - top level guide');
      const formatKey = isLegacy ? 'legacy' : 'new';
      const verifHtml = r.consensusReached
        ? `<span class="verif-badge verif-ok">✅ Agreed (${r.turnsTaken}t)</span>`
        : `<span class="verif-badge verif-warn">⚠️ Capped (${r.turnsTaken}t)</span>`;

      return `<tr class="triage-row" data-priority="${a.overallPriority}" data-format="${formatKey}" data-search="${escapeHtml((r.capsuleId + ' ' + r.guideFormat + ' ' + a.executiveSummary).toLowerCase())}">
        <td>
          <a href="#${anchor}" class="capsule-jump">${escapeHtml(r.capsuleId)}</a>
          <div style="margin-top:6px">
            ${renderSourceLinksBarHtml(links)}
          </div>
          <div style="margin-top:5px"><a href="items/${slug}.html" style="font-size:11.5px;color:#64748b;text-decoration:none">Standalone report ↗</a></div>
        </td>
        <td><span class="format-badge format-${formatKey}">${escapeHtml(r.guideFormat)}</span></td>
        <td>${htmlGradeBadge(a.overallPriority)}</td>
        <td>${htmlScorePill(a.expectationCoverageScore, scope === 'grader')}</td>
        <td>${htmlScorePill(a.graderFidelityScore, scope === 'expectations')}</td>
        <td>${verifHtml}</td>
        <td class="mono bold">${a.expectationIssues.length} exp / ${a.graderIssues.length} grader</td>
        <td>${escapeHtml(a.executiveSummary)}</td>
      </tr>`;
    })
    .join('\n');

  const detailedCardsHtml = sorted
    .map((r) => renderCapsuleCardHtml(r, outputDir, false))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guide Expectations &amp; Grader Fidelity Audit — ${escapeHtml(runId)}</title>
  <style>${SHARED_HTML_STYLES}</style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <div>
        <h1>🔍 Guide Expectations &amp; Grader Fidelity Audit</h1>
        <div class="meta-list">
          <span>Run ID: <code>${escapeHtml(runId)}</code></span>
          <span>Scope: <code>${escapeHtml(activeScopes || 'both')}</code></span>
          <span>Generated At: <code>${escapeHtml(new Date().toISOString())}</code></span>
          <span>Total Capsules Audited: <code>${total}</code></span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="filter-btn" onclick="toggleAllDetails(true)">Expand All Details</button>
        <button class="filter-btn" onclick="toggleAllDetails(false)">Collapse All Details</button>
      </div>
    </header>

    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Overall Priority Breakdown</div>
        <div class="kpi-value">
          <span class="badge badge-high">🔴 HIGH: ${highCount}</span>
          <span class="badge badge-medium">🟠 MED: ${medCount}</span>
          <span class="badge badge-low">🟢 LOW: ${lowCount}</span>
        </div>
        <div class="kpi-sub">${total} total guide evaluation capsule(s)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Guide Formats Audited</div>
        <div class="kpi-value" style="font-size:16px">
          <span class="format-badge format-legacy">legacy: ${legacyCount}</span>
          <span class="format-badge format-new">new (targets/*): ${newCount}</span>
        </div>
        <div class="kpi-sub">Top-level vs target-app specific</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Expectation Coverage</div>
        <div class="kpi-value">${htmlScorePill(avgExpScore, activeScopes === 'grader')}</div>
        <div class="kpi-sub"><code>expectations.md</code> vs <code>guide.md</code></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Grader Fidelity</div>
        <div class="kpi-value">${htmlScorePill(avgGraderScore, activeScopes === 'expectations')}</div>
        <div class="kpi-sub"><code>grader.ts</code> vs <code>expectations.md</code> &amp; <code>task.md</code></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Adversarial Consensus</div>
        <div class="kpi-value">${consensusCount} / ${total} <span style="font-size:15px;color:var(--text-muted)">(${consensusPct}%)</span></div>
        <div class="kpi-sub">Auditor + Reviewer Sub-Agent agreement</div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h2>Priority Triage Table (Sorted HIGH → LOW Priority)</h2>
        <span id="visible-count" style="font-size:13px;color:var(--text-muted);font-weight:600">Showing ${total} of ${total} capsules</span>
      </div>

      <div class="filter-bar">
        <input
          type="search"
          id="search-input"
          class="search-input"
          placeholder="Search by guide ID, category, defect keyword, or summary..."
          oninput="applyFilters()"
        />
        <button class="filter-btn active" data-filter-priority="ALL" onclick="setPriorityFilter('ALL', this)">All Priorities (${total})</button>
        <button class="filter-btn" data-filter-priority="HIGH" onclick="setPriorityFilter('HIGH', this)">🔴 HIGH (${highCount})</button>
        <button class="filter-btn" data-filter-priority="MEDIUM" onclick="setPriorityFilter('MEDIUM', this)">🟠 MEDIUM (${medCount})</button>
        <button class="filter-btn" data-filter-priority="LOW" onclick="setPriorityFilter('LOW', this)">🟢 LOW (${lowCount})</button>
        <span style="border-left:1px solid var(--border-strong);height:22px;margin:0 4px"></span>
        <button class="filter-btn active" data-filter-format="ALL" onclick="setFormatFilter('ALL', this)">All Formats</button>
        <button class="filter-btn" data-filter-format="legacy" onclick="setFormatFilter('legacy', this)">Legacy (${legacyCount})</button>
        <button class="filter-btn" data-filter-format="new" onclick="setFormatFilter('new', this)">New (${newCount})</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guide Capsule &amp; Source Files</th>
              <th>Guide Format</th>
              <th>Priority</th>
              <th>Exp Coverage</th>
              <th>Grader Fidelity</th>
              <th>Verification</th>
              <th>Defects</th>
              <th>Executive Summary</th>
            </tr>
          </thead>
          <tbody id="triage-tbody">
            ${triageRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 style="margin: 28px 0 16px 0; font-size: 19px;">Detailed Evidence-First Capsule Assessments</h2>
      <div id="capsule-cards-container">
        ${detailedCardsHtml}
      </div>
    </section>
  </div>

  <script>
    ${SHARED_COPY_SCRIPT}
    let currentPriority = 'ALL';
    let currentFormat = 'ALL';

    function setPriorityFilter(priority, btn) {
      currentPriority = priority;
      document.querySelectorAll('[data-filter-priority]').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    }

    function setFormatFilter(format, btn) {
      currentFormat = format;
      document.querySelectorAll('[data-filter-format]').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    }

    function applyFilters() {
      const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
      const rows = document.querySelectorAll('#triage-tbody tr.triage-row');
      const cards = document.querySelectorAll('#capsule-cards-container details.capsule-card');
      let shown = 0;

      rows.forEach((row, idx) => {
        const p = row.getAttribute('data-priority');
        const f = row.getAttribute('data-format');
        const card = cards[idx];
        const cardText = card ? card.textContent.toLowerCase() : (row.getAttribute('data-search') || '');

        const matchP = currentPriority === 'ALL' || p === currentPriority;
        const matchF = currentFormat === 'ALL' || f === currentFormat;
        const matchQ = !q || cardText.includes(q);

        const visible = matchP && matchF && matchQ;
        row.style.display = visible ? '' : 'none';
        if (card) card.style.display = visible ? '' : 'none';
        if (visible) shown++;
      });

      const countEl = document.getElementById('visible-count');
      if (countEl) {
        countEl.textContent = 'Showing ' + shown + ' of ' + rows.length + ' capsules';
      }
    }

    function toggleAllDetails(open) {
      document.querySelectorAll('details.capsule-card').forEach(d => {
        if (d.style.display !== 'none') d.open = open;
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Writes SUMMARY_AUDIT_EVALS.md, SUMMARY_AUDIT_EVALS.html, per-capsule items/<slug>.html,
 * and audit_evals_results.json atomically to the run output directory.
 */
export function writeAuditReports(
  outputDir: string,
  results: CapsuleAuditResult[],
  runId: string
): { summaryPath: string; htmlPath: string; jsonPath: string } {
  fs.mkdirSync(outputDir, { recursive: true });
  const itemsDir = path.join(outputDir, 'items');
  fs.mkdirSync(itemsDir, { recursive: true });

  // Ensure every expectation issue has a proposedExpectationDraft populated
  for (const r of results) {
    if (r.finalAssessment?.expectationIssues) {
      for (const e of r.finalAssessment.expectationIssues) {
        e.proposedExpectationDraft = ensureProposedExpectationDraft(e);
      }
    }
  }

  const summaryPath = path.join(outputDir, 'SUMMARY_AUDIT_EVALS.md');
  const htmlPath = path.join(outputDir, 'SUMMARY_AUDIT_EVALS.html');
  const jsonPath = path.join(outputDir, 'audit_evals_results.json');

  const md = generateSummaryMarkdown(results, runId, outputDir);
  const html = generateSummaryHtml(results, runId, outputDir);

  fs.writeFileSync(summaryPath, md, 'utf8');
  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ runId, updatedAt: new Date().toISOString(), results }, null, 2),
    'utf8'
  );

  for (const r of results) {
    const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
    const itemHtmlPath = path.join(itemsDir, `${slug}.html`);
    fs.writeFileSync(itemHtmlPath, generateCapsuleHtml(r, runId, itemsDir), 'utf8');
  }

  return { summaryPath, htmlPath, jsonPath };
}
