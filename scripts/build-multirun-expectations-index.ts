import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../lib/paths.ts';
import {
  calibrateAssessmentPriorities,
  getCapsuleCategoriesAttr,
  getCapsulePriorityCounts,
  getViolationCategoryTally,
  renderViolationTallyHtml,
  renderViolationTallyMd,
  resolveCapsuleSourceLinks,
} from '../guides/lib/audit-report-generator.ts';
import type { CapsuleAuditResult } from '../guides/lib/audit-types.ts';

interface CategoryRunSummary {
  category: string;
  runId: string;
  runDir: string;
  relHtmlPath: string;
  relMdPath: string;
  relJsonPath: string;
  generatedAt: string;
  capsuleCount: number;
  highCapsules: number;
  medCapsules: number;
  lowCapsules: number;
  highIssues: number;
  medIssues: number;
  lowIssues: number;
  totalIssues: number;
  avgCoverage: number;
  results: CapsuleAuditResult[];
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBreakdownPillsHtml(high: number, med: number, low: number): string {
  const highClass = high > 0 ? 'p-pill p-high' : 'p-pill p-zero';
  const medClass = med > 0 ? 'p-pill p-med' : 'p-pill p-zero';
  const lowClass = low > 0 ? 'p-pill p-low' : 'p-pill p-zero';
  return `<div class="priority-breakdown">
    <span class="${highClass}">🔴 HIGH: <strong>${high}</strong></span>
    <span class="${medClass}">🟠 MED: <strong>${med}</strong></span>
    <span class="${lowClass}">🟢 LOW: <strong>${low}</strong></span>
  </div>`;
}

export function buildMultirunExpectationsIndex(): {
  indexHtmlPath: string;
  indexMdPath: string;
  summaries: CategoryRunSummary[];
} {
  const evalAuditsDir = path.join(rootDir, 'harness', 'results', 'eval-audits');
  fs.mkdirSync(evalAuditsDir, { recursive: true });

  const entries = fs.readdirSync(evalAuditsDir, { withFileTypes: true });
  const summaries: CategoryRunSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('audit-expectations-')) {
      continue;
    }
    const category = entry.name.replace(/^audit-expectations-/, '');
    const runDir = path.join(evalAuditsDir, entry.name);
    const jsonPath = path.join(runDir, 'audit_evals_results.json');
    const htmlPath = path.join(runDir, 'SUMMARY_AUDIT_EVALS.html');
    const mdPath = path.join(runDir, 'SUMMARY_AUDIT_EVALS.md');

    if (!fs.existsSync(jsonPath) || !fs.existsSync(htmlPath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
        runId: string;
        generatedAt: string;
        results: CapsuleAuditResult[];
      };
      const results = Array.isArray(parsed.results) ? parsed.results : [];
      if (results.length === 0) continue;

      let highCapsules = 0;
      let medCapsules = 0;
      let lowCapsules = 0;
      let highIssues = 0;
      let medIssues = 0;
      let lowIssues = 0;
      let sumCoverage = 0;

      for (const r of results) {
        r.finalAssessment = calibrateAssessmentPriorities(
          r.finalAssessment,
          r.auditScope || 'expectations'
        );
        const p = r.finalAssessment.overallPriority;
        if (p === 'HIGH') highCapsules++;
        else if (p === 'MEDIUM') medCapsules++;
        else lowCapsules++;

        const counts = getCapsulePriorityCounts(r);
        highIssues += counts.high;
        medIssues += counts.medium;
        lowIssues += counts.low;
        sumCoverage += r.finalAssessment.expectationCoverageScore || 0;
      }

      const avgCoverage = Math.round(sumCoverage / results.length);

      summaries.push({
        category,
        runId: entry.name,
        runDir,
        relHtmlPath: `./${entry.name}/SUMMARY_AUDIT_EVALS.html`,
        relMdPath: `./${entry.name}/SUMMARY_AUDIT_EVALS.md`,
        relJsonPath: `./${entry.name}/audit_evals_results.json`,
        generatedAt: parsed.generatedAt || new Date().toISOString(),
        capsuleCount: results.length,
        highCapsules,
        medCapsules,
        lowCapsules,
        highIssues,
        medIssues,
        lowIssues,
        totalIssues: highIssues + medIssues + lowIssues,
        avgCoverage,
        results,
      });
    } catch {
      // Skip incomplete or malformed run directories
    }
  }

  // Sort summaries by highCapsules DESC, highIssues DESC, avgCoverage ASC, category ASC
  summaries.sort((a, b) => {
    if (b.highCapsules !== a.highCapsules) return b.highCapsules - a.highCapsules;
    if (b.highIssues !== a.highIssues) return b.highIssues - a.highIssues;
    if (a.avgCoverage !== b.avgCoverage) return a.avgCoverage - b.avgCoverage;
    return a.category.localeCompare(b.category);
  });

  const allResults = summaries.flatMap((s) => s.results);
  const totalCategories = summaries.length;
  const totalCapsules = summaries.reduce((acc, s) => acc + s.capsuleCount, 0);
  const totalHighCapsules = summaries.reduce((acc, s) => acc + s.highCapsules, 0);
  const totalMedCapsules = summaries.reduce((acc, s) => acc + s.medCapsules, 0);
  const totalLowCapsules = summaries.reduce((acc, s) => acc + s.lowCapsules, 0);
  const totalHighIssues = summaries.reduce((acc, s) => acc + s.highIssues, 0);
  const totalMedIssues = summaries.reduce((acc, s) => acc + s.medIssues, 0);
  const totalLowIssues = summaries.reduce((acc, s) => acc + s.lowIssues, 0);
  const overallAvgCoverage =
    totalCapsules > 0
      ? Math.round(
          summaries.reduce((acc, s) => acc + s.avgCoverage * s.capsuleCount, 0) /
            totalCapsules
        )
      : 100;

  const categoryRowsHtml = summaries
    .map((s) => {
      const catVcats = getViolationCategoryTally(s.results)
        .map((t) => t.category)
        .join('|');
      const topHighGuides = s.results
        .filter((r) => r.finalAssessment.overallPriority === 'HIGH')
        .sort((a, b) => getCapsulePriorityCounts(b).high - getCapsulePriorityCounts(a).high)
        .slice(0, 4)
        .map((r) => {
          const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
          const c = getCapsulePriorityCounts(r);
          return `<a class="guide-chip guide-chip-high" href="./${s.runId}/items/${slug}.html" title="${escapeHtml(r.finalAssessment.executiveSummary)}">${escapeHtml(r.guideName)} <span class="chip-count">(🔴${c.high})</span></a>`;
        })
        .join(' ');

      const topMedGuides =
        topHighGuides.length > 0
          ? ''
          : s.results
              .filter((r) => r.finalAssessment.overallPriority === 'MEDIUM')
              .slice(0, 3)
              .map((r) => {
                const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
                const c = getCapsulePriorityCounts(r);
                return `<a class="guide-chip guide-chip-med" href="./${s.runId}/items/${slug}.html" title="${escapeHtml(r.finalAssessment.executiveSummary)}">${escapeHtml(r.guideName)} <span class="chip-count">(🟠${c.medium})</span></a>`;
              })
              .join(' ');

      const covClass =
        s.avgCoverage >= 80
          ? 'score-good'
          : s.avgCoverage >= 65
            ? 'score-warn'
            : 'score-bad';

      return `<tr class="cat-row" data-category="${escapeHtml(s.category)}" data-high="${s.highCapsules}" data-vcats="${escapeHtml(catVcats)}">
        <td class="col-category">
          <div class="cat-title-wrap">
            <a class="cat-link" href="${s.relHtmlPath}">📁 <code>guides/${escapeHtml(s.category)}/</code></a>
            <div class="cat-sublinks">
              <a class="report-btn" href="${s.relHtmlPath}">🌐 Open HTML Report</a>
              <a class="src-chip" href="${s.relMdPath}">📄 Markdown</a>
              <a class="src-chip" href="${s.relJsonPath}">📊 JSON</a>
            </div>
          </div>
        </td>
        <td class="col-center"><strong>${s.capsuleCount}</strong></td>
        <td>${renderBreakdownPillsHtml(s.highCapsules, s.medCapsules, s.lowCapsules)}</td>
        <td>${renderBreakdownPillsHtml(s.highIssues, s.medIssues, s.lowIssues)}</td>
        <td>${renderViolationTallyHtml(s.results, { compact: true })}</td>
        <td class="col-center"><span class="score-pill ${covClass}">${s.avgCoverage}/100</span></td>
        <td class="col-notable">
          ${
            topHighGuides ||
            topMedGuides ||
            '<span class="all-clean">✅ All guides LOW priority</span>'
          }
        </td>
      </tr>`;
    })
    .join('\n');

  // Flatten all capsules for the Master Rollup Table
  const allCapsulesWithRun = summaries.flatMap((s) =>
    s.results.map((r) => ({ runId: s.runId, category: s.category, result: r }))
  );
  allCapsulesWithRun.sort((a, b) => {
    const ca = getCapsulePriorityCounts(a.result);
    const cb = getCapsulePriorityCounts(b.result);
    if (cb.high !== ca.high) return cb.high - ca.high;
    if (cb.medium !== ca.medium) return cb.medium - ca.medium;
    if (cb.low !== ca.low) return cb.low - ca.low;
    return (
      a.result.finalAssessment.expectationCoverageScore -
      b.result.finalAssessment.expectationCoverageScore
    );
  });

  const allCapsuleRowsHtml = allCapsulesWithRun
    .map(({ runId, category, result: r }) => {
      const slug = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
      const anchor = r.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const counts = getCapsulePriorityCounts(r);
      const vcatsAttr = getCapsuleCategoriesAttr(r);
      const p = r.finalAssessment.overallPriority;
      const cov = r.finalAssessment.expectationCoverageScore;
      const covClass =
        cov >= 80 ? 'score-good' : cov >= 65 ? 'score-warn' : 'score-bad';
      const links = resolveCapsuleSourceLinks(r, evalAuditsDir);

      return `<tr class="capsule-row" data-priority="${p}" data-category="${escapeHtml(category)}" data-vcats="${escapeHtml(vcatsAttr)}" data-search="${escapeHtml((r.capsuleId + ' ' + vcatsAttr + ' ' + r.finalAssessment.executiveSummary).toLowerCase())}">
        <td>
          <a class="capsule-link" href="./${runId}/items/${slug}.html">${escapeHtml(r.capsuleId)}</a>
          <div class="src-links">
            <a class="src-chip" href="./${runId}/SUMMARY_AUDIT_EVALS.html#${anchor}">Category Report</a>
            <a class="src-chip" href="${escapeHtml(links.guideRel)}" target="_blank">guide.md</a>
            <a class="src-chip" href="${escapeHtml(links.expectationsRel)}" target="_blank">expectations.md</a>
            <a class="src-chip" href="${escapeHtml(links.taskRel)}" target="_blank">task.md</a>
            <a class="src-chip" href="${escapeHtml(links.graderRel)}" target="_blank">grader.ts</a>
          </div>
        </td>
        <td><a class="cat-badge" href="./${runId}/SUMMARY_AUDIT_EVALS.html">${escapeHtml(category)}</a></td>
        <td>${renderBreakdownPillsHtml(counts.high, counts.medium, counts.low)}</td>
        <td>${renderViolationTallyHtml(r, { compact: true })}</td>
        <td class="col-center"><span class="score-pill ${covClass}">${cov}/100</span></td>
        <td class="exec-summary-cell">${escapeHtml(r.finalAssessment.executiveSummary)}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Master Expectations Audit Index — All Guide Subdirectories</title>
  <style>
    :root {
      --bg: #f1f5f9;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #cbd5e1;
      --border-strong: #94a3b8;
      --accent: #2563eb;
      --high-bg: #fef2f2;
      --high-text: #991b1b;
      --high-border: #f87171;
      --med-bg: #fffbeb;
      --med-text: #92400e;
      --med-border: #fbbf24;
      --low-bg: #f0fdf4;
      --low-text: #166534;
      --low-border: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding: 28px 36px;
    }
    .container { max-width: 1720px; margin: 0 auto; }
    header {
      background: var(--card);
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: 0 2px 6px rgba(15,23,42,0.06);
    }
    h1 { margin: 0 0 8px 0; font-size: 1.6rem; color: #0f172a; }
    .meta-bar { display: flex; flex-wrap: wrap; gap: 18px; color: var(--muted); font-size: 0.92rem; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 16px;
      margin-top: 18px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
    }
    .kpi-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; }
    .kpi-val { font-size: 1.35rem; font-weight: 800; margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .section-card {
      background: var(--card);
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      padding: 22px 26px;
      margin-bottom: 28px;
      box-shadow: 0 2px 6px rgba(15,23,42,0.05);
    }
    .section-title {
      margin: 0 0 14px 0;
      font-size: 1.18rem;
      font-weight: 800;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.9rem;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      padding: 13px 15px;
      text-align: left;
      border-bottom: 2px solid var(--border-strong);
      border-right: 1px solid var(--border);
      vertical-align: top;
    }
    th:last-child, td:last-child { border-right: none; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #eff6ff; }
    th {
      background: #e2e8f0;
      font-weight: 800;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e293b;
    }
    .col-center { text-align: center; }
    .cat-link {
      font-size: 1.02rem;
      font-weight: 800;
      color: var(--accent);
      text-decoration: none;
    }
    .cat-link:hover { text-decoration: underline; }
    .cat-sublinks, .src-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 7px;
    }
    .report-btn {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 700;
      background: #2563eb;
      color: #ffffff;
      text-decoration: none;
    }
    .report-btn:hover { background: #1d4ed8; }
    .src-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 5px;
      font-size: 0.74rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      text-decoration: none;
    }
    .src-chip:hover { background: #e2e8f0; color: #0f172a; }
    .priority-breakdown {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .p-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .p-high { background: var(--high-bg); color: var(--high-text); border-color: var(--high-border); }
    .p-med { background: var(--med-bg); color: var(--med-text); border-color: var(--med-border); }
    .p-low { background: var(--low-bg); color: var(--low-text); border-color: var(--low-border); }
    .p-zero { background: #f1f5f9; color: #94a3b8; border-color: #e2e8f0; opacity: 0.55; }
    .score-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 0.84rem;
    }
    .score-good { background: #dcfce7; color: #166534; }
    .score-warn { background: #fef3c7; color: #92400e; }
    .score-bad { background: #fee2e2; color: #991b1b; }
    .guide-chip {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 3px 9px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
    }
    .guide-chip-high { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
    .guide-chip-high:hover { background: #fee2e2; }
    .guide-chip-med { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .guide-chip-med:hover { background: #fef3c7; }
    .all-clean { color: #166534; font-weight: 600; font-size: 0.84rem; }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
      align-items: center;
    }
    .search-input, .cat-select {
      padding: 8px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      font-size: 0.88rem;
    }
    .search-input { min-width: 280px; }
    .filter-btn {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
      background: #fff;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .filter-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }
    .capsule-link { font-weight: 700; color: var(--accent); text-decoration: none; }
    .capsule-link:hover { text-decoration: underline; }
    .cat-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #1e293b;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.78rem;
      font-weight: 700;
      text-decoration: none;
    }
    .exec-summary-cell { font-size: 0.86rem; color: #1e293b; max-width: 620px; }
    .violation-tally-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .violation-tally-compact { gap: 5px; }
    .vcat-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 11px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
      font-size: 11.5px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      cursor: default;
      transition: all 0.12s ease;
    }
    button.vcat-chip { cursor: pointer; }
    button.vcat-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08);
    }
    button.vcat-chip.active {
      background: #0f172a !important;
      color: #ffffff !important;
      border-color: #0f172a !important;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
    }
    button.vcat-chip.active .vcat-total {
      background: #334155;
      color: #ffffff;
    }
    .vcat-compact { padding: 3px 8px; font-size: 10.5px; }
    .vcat-has-high { background: #fff1f2; border-color: #fda4af; color: #881337; }
    .vcat-has-med { background: #fffbeb; border-color: #fcd34d; color: #78350f; }
    .vcat-has-low { background: #f0fdf4; border-color: #86efac; color: #14532d; }
    .vcat-total {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 19px;
      padding: 0 6px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.09);
      font-size: 11px;
      font-weight: 800;
    }
    .vcat-breakdown {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10.5px;
      font-weight: 700;
    }
    .vcat-sub {
      padding: 1px 4px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(15, 23, 42, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Master Expectations Coverage Audit Index (All Guide Subdirectories)</h1>
      <div class="meta-bar">
        <span><strong>Scope:</strong> <code>expectations</code> (One Run Per Subdirectory)</span>
        <span><strong>Subdirectories Audited:</strong> <strong>${totalCategories}</strong></span>
        <span><strong>Total Guides Audited:</strong> <strong>${totalCapsules}</strong></span>
        <span><strong>Generated At:</strong> ${new Date().toISOString()}</span>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Subdirectories Audited</div>
          <div class="kpi-val">${totalCategories} Categories <span style="font-size:0.86rem;color:var(--muted);font-weight:600;">(${totalCapsules} guides)</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Guides by Highest Priority</div>
          <div class="kpi-val">
            ${renderBreakdownPillsHtml(totalHighCapsules, totalMedCapsules, totalLowCapsules)}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Issues Across All Guides</div>
          <div class="kpi-val">
            ${renderBreakdownPillsHtml(totalHighIssues, totalMedIssues, totalLowIssues)}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Weighted Avg Expectation Coverage</div>
          <div class="kpi-val">${overallAvgCoverage} / 100</div>
        </div>
      </div>
    </header>

    <section class="section-card" style="padding: 18px 26px; margin-bottom: 24px;">
      <div class="section-title" style="margin-bottom: 12px;">
        <span>📊 Global Violation Types Tally Across All ${totalCapsules} Guides <span style="font-weight:500;font-size:0.85rem;color:var(--muted);margin-left:8px;">(Click any violation type to filter subdirectories &amp; guides)</span></span>
      </div>
      ${renderViolationTallyHtml(allResults, { interactive: true })}
    </section>

    <section class="section-card">
      <div class="section-title">
        <span>1. Per-Subdirectory Audit Runs (Click any subdirectory to open its <code>SUMMARY_AUDIT_EVALS.html</code>)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Guide Subdirectory &amp; Reports</th>
            <th class="col-center">Guides</th>
            <th>Guides by Priority (Per Subdirectory)</th>
            <th>Total Issues (Per Subdirectory)</th>
            <th>Violation Types Tally (Per Subdirectory)</th>
            <th class="col-center">Avg Exp Coverage</th>
            <th>Highest-Priority Guides in Subdirectory (Direct Links)</th>
          </tr>
        </thead>
        <tbody id="catTableBody">
          ${categoryRowsHtml}
        </tbody>
      </table>
    </section>

    <section class="section-card">
      <div class="section-title">
        <span>2. All ${totalCapsules} Audited Guides Across All Subdirectories</span>
        <span id="visibleCapsuleCount" style="font-size:0.85rem;color:var(--muted);font-weight:600;">Showing ${totalCapsules} of ${totalCapsules} guides</span>
      </div>
      <div class="filter-bar">
        <input type="text" id="capsuleSearch" class="search-input" placeholder="Search guide ID, violation type, or executive summary..." oninput="filterCapsules()" />
        <select id="categoryFilter" class="cat-select" onchange="filterCapsules()">
          <option value="ALL">All Subdirectories (${totalCategories})</option>
          ${summaries.map((s) => `<option value="${escapeHtml(s.category)}">${escapeHtml(s.category)} (${s.capsuleCount})</option>`).join('')}
        </select>
        <button class="filter-btn active" data-pfilter="ALL" onclick="setPriorityFilter('ALL', this)">All (${totalCapsules})</button>
        <button class="filter-btn" data-pfilter="HIGH" onclick="setPriorityFilter('HIGH', this)">🔴 HIGH (${totalHighCapsules})</button>
        <button class="filter-btn" data-pfilter="MEDIUM" onclick="setPriorityFilter('MEDIUM', this)">🟠 MED (${totalMedCapsules})</button>
        <button class="filter-btn" data-pfilter="LOW" onclick="setPriorityFilter('LOW', this)">🟢 LOW (${totalLowCapsules})</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Guide Capsule &amp; Links</th>
            <th>Subdirectory</th>
            <th>Priority Breakdown (Per Guide)</th>
            <th>Violation Types Tally (Per Guide)</th>
            <th class="col-center">Exp Coverage</th>
            <th>Executive Summary</th>
          </tr>
        </thead>
        <tbody id="allCapsulesBody">
          ${allCapsuleRowsHtml}
        </tbody>
      </table>
    </section>
  </div>

  <script>
    let currentPriority = 'ALL';
    let currentVcat = 'ALL';

    function setPriorityFilter(p, btn) {
      currentPriority = p;
      document.querySelectorAll('[data-pfilter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCapsules();
    }

    function setViolationCategoryFilter(vcat, btn) {
      if (currentVcat === vcat && vcat !== 'ALL') {
        currentVcat = 'ALL';
        document.querySelectorAll('[data-filter-vcat]').forEach(el => el.classList.remove('active'));
        const allBtn = document.querySelector('[data-filter-vcat="ALL"]');
        if (allBtn) allBtn.classList.add('active');
      } else {
        currentVcat = vcat;
        document.querySelectorAll('[data-filter-vcat]').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
      }
      filterCapsules();
    }

    function filterCapsules() {
      const q = (document.getElementById('capsuleSearch').value || '').toLowerCase().trim();
      const cat = document.getElementById('categoryFilter').value;

      // Filter Per-Subdirectory table rows by selected violation category
      document.querySelectorAll('#catTableBody .cat-row').forEach(row => {
        const vcats = (row.getAttribute('data-vcats') || '').split('|').filter(Boolean);
        const matchV = currentVcat === 'ALL' || vcats.includes(currentVcat);
        row.style.display = matchV ? '' : 'none';
      });

      let shown = 0;
      const rows = document.querySelectorAll('#allCapsulesBody .capsule-row');
      rows.forEach(row => {
        const rp = row.getAttribute('data-priority');
        const rcat = row.getAttribute('data-category');
        const vcats = (row.getAttribute('data-vcats') || '').split('|').filter(Boolean);
        const rsearch = row.getAttribute('data-search') || '';
        const matchP = currentPriority === 'ALL' || rp === currentPriority;
        const matchCat = cat === 'ALL' || rcat === cat;
        const matchV = currentVcat === 'ALL' || vcats.includes(currentVcat);
        const matchQ = !q || rsearch.includes(q);
        const vis = matchP && matchCat && matchV && matchQ;
        row.style.display = vis ? '' : 'none';
        if (vis) shown++;
      });

      const countEl = document.getElementById('visibleCapsuleCount');
      if (countEl) {
        countEl.textContent = 'Showing ' + shown + ' of ' + rows.length + ' guides';
      }
    }
  </script>
</body>
</html>`;

  const indexHtmlPath = path.join(evalAuditsDir, 'INDEX_ALL_EXPECTATIONS_AUDITS.html');
  fs.writeFileSync(indexHtmlPath, html, 'utf8');

  const mdLines: string[] = [
    '# Master Expectations Coverage Audit Index (All Guide Subdirectories)',
    '',
    `- **Generated At**: ${new Date().toISOString()}`,
    `- **Subdirectories Audited**: **${totalCategories}**`,
    `- **Total Guides Audited**: **${totalCapsules}**`,
    `- **Guides by Priority**: 🔴 **HIGH**: ${totalHighCapsules} | 🟠 **MEDIUM**: ${totalMedCapsules} | 🟢 **LOW**: ${totalLowCapsules}`,
    `- **Total Issues**: 🔴 **HIGH**: ${totalHighIssues} | 🟠 **MEDIUM**: ${totalMedIssues} | 🟢 **LOW**: ${totalLowIssues}`,
    `- **Weighted Avg Coverage**: **${overallAvgCoverage} / 100**`,
    '',
    '## 1. Global Violation Types Tally (Across All 140 Guides)',
    '',
    renderViolationTallyMd(allResults, false),
    '## 2. Per-Subdirectory Audit Reports',
    '',
    '| Subdirectory | Guides | Guides by Priority | Total Issues | Violation Types Tally (Per Subdirectory) | Avg Coverage | Report Links |',
    '|---|---|---|---|---|---|---|',
    ...summaries.map(
      (s) =>
        `| \`guides/${s.category}/\` | ${s.capsuleCount} | 🔴 **${s.highCapsules}** · 🟠 **${s.medCapsules}** · 🟢 **${s.lowCapsules}** | 🔴 **${s.highIssues}** · 🟠 **${s.medIssues}** · 🟢 **${s.lowIssues}** | ${renderViolationTallyMd(s.results, true)} | ${s.avgCoverage}/100 | [HTML](${s.relHtmlPath}) · [Markdown](${s.relMdPath}) · [JSON](${s.relJsonPath}) |`
    ),
    '',
  ];
  const indexMdPath = path.join(evalAuditsDir, 'INDEX_ALL_EXPECTATIONS_AUDITS.md');
  fs.writeFileSync(indexMdPath, mdLines.join('\n'), 'utf8');

  return { indexHtmlPath, indexMdPath, summaries };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { indexHtmlPath, indexMdPath, summaries } = buildMultirunExpectationsIndex();
  console.log(`✅ Built Multi-Run Master Index (${summaries.length} subdirectories):`);
  console.log(`   🌐 HTML Index: ${indexHtmlPath}`);
  console.log(`   📄 MD Index:   ${indexMdPath}`);
}
