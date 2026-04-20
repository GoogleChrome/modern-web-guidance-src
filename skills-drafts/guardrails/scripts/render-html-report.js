#!/usr/bin/env node
/**
 * render-html-report.js
 *
 * Renders a unified compatibility report (JSON from merge-reports.js) into a
 * self-contained HTML file with embedded CSS — no external dependencies.
 *
 * Usage:
 *   node render-html-report.js <report.json> <output.html> [--branch main] [--date 2026-04-06] [--target "scrollable.css"]
 *
 * Inputs:
 *   report.json — unified report JSON (stdout of merge-reports.js, saved to file)
 *
 * Output:
 *   Writes a self-contained HTML file to the specified output path.
 */

const fs = require("fs");

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { inputPath: null, outputPath: null, branch: "main", date: "", target: "" };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--branch" && argv[i + 1]) {
      args.branch = argv[++i];
    } else if (argv[i] === "--date" && argv[i + 1]) {
      args.date = argv[++i];
    } else if (argv[i] === "--target" && argv[i + 1]) {
      args.target = argv[++i];
    } else {
      positional.push(argv[i]);
    }
  }

  args.inputPath = positional[0] || null;
  args.outputPath = positional[1] || null;
  return args;
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityClass(severity) {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function severityLabel(severity) {
  if (severity === "error") return "Error";
  if (severity === "warning") return "Warning";
  return "Info";
}

// ---------------------------------------------------------------------------
// Finding card renderer
// ---------------------------------------------------------------------------

function renderFinding(f) {
  const locations = f.locations || (f.location ? [f.location] : []);
  const locHtml = locations
    .map((loc) => {
      const file = loc.file ? loc.file.replace(/.*\//, "") : "unknown";
      return `<code>${esc(file)}:${loc.line}:${loc.column}</code>`;
    })
    .join("<br>");

  const autoFixed = f.auto_fixed === true;
  const fixBadge = autoFixed
    ? `<span class="fix-badge">Auto-fixed</span>`
    : "";

  let extraRows = "";

  if (f.remediation) {
    extraRows += `<dt>Remediation</dt><dd>${esc(f.remediation.type || "—")}${f.remediation.package ? ` &mdash; <code>${esc(f.remediation.package)}</code>` : ""}</dd>`;
  }

  if (f.what_was_applied) {
    extraRows += `<dt>Applied</dt><dd>${esc(f.what_was_applied)}</dd>`;
  }

  // Browser compat chips
  let compatHtml = "";
  if (f.unsupported_browsers && f.unsupported_browsers.length > 0) {
    const chips = f.unsupported_browsers
      .map((b) => `<span class="compat-chip unsupported">${esc(b)}</span>`)
      .join("");
    compatHtml = `
      <div>
        <strong style="font-size:.8rem;color:var(--text-muted);">Unsupported browsers:</strong>
        <div class="compat-grid" style="margin-top:.4rem;">${chips}</div>
      </div>`;
  }

  // Modern web guidance callout
  let guidanceHtml = "";
  if (f.modern_web_guidance) {
    guidanceHtml = `<div class="guidance"><strong>Modern Web Guidance:</strong> ${esc(f.modern_web_guidance)}</div>`;
  }

  return `
  <div class="finding">
    <div class="finding-header">
      <span class="severity-badge ${severityClass(f.severity)}">${severityLabel(f.severity)}</span>
      <span class="finding-id">${esc(f.id)}</span>
      <span class="finding-title">${esc(f.feature)}</span>
      ${fixBadge}
    </div>
    <div class="finding-body">
      <dl class="finding-meta">
        <dt>Source</dt><dd>${esc(f.source)}</dd>
        <dt>Location</dt><dd>${locHtml}</dd>
        ${extraRows}
      </dl>
      ${compatHtml}
      ${guidanceHtml}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Execution trace renderer
// ---------------------------------------------------------------------------

function renderTrace(report) {
  // The trace is not always present in the JSON (it's part of the markdown
  // template filled by Claude). Render a minimal placeholder if absent.
  if (!report.trace) {
    return `
    <details>
      <summary>Execution Trace</summary>
      <div class="trace-body">
        <p style="color:var(--text-muted);font-size:.85rem;">
          Detailed execution trace is available in the companion Markdown report.
        </p>
      </div>
    </details>`;
  }

  const t = report.trace;
  const stages = t.stages || [];
  const stagesHtml = stages
    .map(
      (s) => `
      <div class="trace-stage">
        <div class="stage-name">${esc(s.name)} <span class="status ${s.status === "COMPLETED" ? "completed" : "skipped"}">${esc(s.status)}</span></div>
        <div class="stage-details">${esc(s.details || "")}</div>
      </div>`
    )
    .join("");

  const scriptsRows = (t.scripts || [])
    .map(
      (s) =>
        `<tr><td><code>${esc(s.name)}</code></td><td class="status ${s.used ? "completed" : "skipped"}">${s.used ? "Yes" : "No"}</td><td>${esc(s.notes || "")}</td></tr>`
    )
    .join("");

  const refsRows = (t.references || [])
    .map(
      (r) =>
        `<tr><td><code>${esc(r.name)}</code></td><td class="status ${r.used ? "completed" : "skipped"}">${r.used ? "Yes" : "No"}</td><td>${esc(r.notes || "")}</td></tr>`
    )
    .join("");

  const integrationsRows = (t.integrations || [])
    .map(
      (ig) =>
        `<tr><td>${esc(ig.name)}</td><td class="status ${ig.available ? "completed" : "skipped"}">${ig.available ? "Yes" : "No"}</td><td class="status ${ig.used ? "completed" : "skipped"}">${ig.used ? "Yes" : "No"}</td><td>${esc(ig.notes || "")}</td></tr>`
    )
    .join("");

  return `
  <details>
    <summary>Pipeline Stages</summary>
    <div class="trace-body">${stagesHtml}</div>
  </details>
  ${
    scriptsRows
      ? `<details>
    <summary>Skill Components Used</summary>
    <div class="trace-body">
      <h3>Scripts</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Script</th><th>Used</th><th>Notes</th></tr></thead>
        <tbody>${scriptsRows}</tbody>
      </table></div>
      ${
        refsRows
          ? `<h3>References</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Used</th><th>Notes</th></tr></thead>
        <tbody>${refsRows}</tbody>
      </table></div>`
          : ""
      }
      ${
        integrationsRows
          ? `<h3>External Integrations</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Integration</th><th>Available</th><th>Used</th><th>Notes</th></tr></thead>
        <tbody>${integrationsRows}</tbody>
      </table></div>`
          : ""
      }
    </div>
  </details>`
      : ""
  }`;
}

// ---------------------------------------------------------------------------
// Full HTML document
// ---------------------------------------------------------------------------

function renderHtml(report, { branch, date, target }) {
  const s = report.summary || {};
  const findings = report.findings || [];
  const baseline = report.baseline || {};

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const infos = findings.filter((f) => f.severity === "info");
  const depFindings = findings.filter((f) => f.source === "dependency");

  // Browser tags
  const browsers = baseline.target_browsers || [];
  const browserTagsHtml = (Array.isArray(browsers) ? browsers : [browsers])
    .map((b) => `<span class="browser-tag">${esc(b)}</span>`)
    .join("");

  // Summary cards
  const cards = [
    { label: "Total Findings", value: s.total_findings ?? findings.length, cls: "accent" },
    { label: "Errors", value: s.errors ?? errors.length, cls: errors.length ? "red" : "green" },
    { label: "Warnings", value: s.warnings ?? warnings.length, cls: warnings.length ? "yellow" : "green" },
    { label: "Auto-fixed", value: s.auto_fixed ?? 0, cls: "green", detail: "via modern-web guidance" },
    { label: "Manual Review", value: s.manual_review_required ?? 0, cls: (s.manual_review_required || 0) > 0 ? "yellow" : "green" },
  ];

  const cardsHtml = cards
    .map(
      (c) => `
    <div class="card ${c.cls}">
      <span class="label">${esc(c.label)}</span>
      <span class="value">${c.value}</span>
      ${c.detail ? `<span class="detail">${esc(c.detail)}</span>` : ""}
    </div>`
    )
    .join("");

  // Findings sections
  function renderSection(title, items) {
    if (items.length === 0) return "";
    return `<section><h2>${esc(title)}</h2>${items.map(renderFinding).join("")}</section>`;
  }

  const errorsSection = renderSection("Errors", errors);
  const warningsSection = renderSection("Warnings", warnings.filter((f) => f.source !== "dependency"));
  const infosSection = renderSection("Info", infos.filter((f) => f.source !== "dependency"));
  const depSection = depFindings.length
    ? `<section><h2>Dependency Optimization</h2>${depFindings.map(renderFinding).join("")}</section>`
    : "";

  // Auto-applied fixes
  const fixedFindings = findings.filter((f) => f.auto_fixed === true);
  let fixesSection = "";
  if (fixedFindings.length > 0) {
    const rows = fixedFindings
      .map((f) => {
        const loc = f.locations?.[0] || f.location || {};
        const file = loc.file ? loc.file.replace(/.*\//, "") : "—";
        const desc = f.what_was_applied || f.remediation?.recommendation || "Auto-fixed";
        return `<tr><td><code>${esc(file)}</code></td><td>${esc(desc)}</td></tr>`;
      })
      .join("");
    fixesSection = `
    <section>
      <h2>Auto-applied Fixes</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>File</th><th>Change</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }

  // Next steps
  const manualFindings = findings.filter((f) => f.auto_fixed === false || f.remediation?.type === "manual-review");
  let nextStepsHtml = "";
  if (manualFindings.length === 0) {
    nextStepsHtml = `
    <section>
      <h2>Next Steps</h2>
      <div class="next-steps"><ul>
        <li>No manual review items remain. All findings have been auto-fixed.</li>
      </ul></div>
    </section>`;
  } else {
    const items = manualFindings
      .map((f) => `<li>${esc(f.id)}: ${esc(f.feature)} &mdash; ${esc(f.remediation?.recommendation || "requires manual review")}</li>`)
      .join("");
    nextStepsHtml = `
    <section>
      <h2>Next Steps</h2>
      <div class="next-steps"><ul>${items}</ul></div>
    </section>`;
  }

  // Dependency stats
  const e18eStats = report.e18e_stats || {};
  let depStatsHtml = "";
  if (e18eStats.install_size || e18eStats.production_deps || e18eStats.duplicate_deps) {
    depStatsHtml = `
    <section>
      <h2>Dependency Stats</h2>
      <div class="summary-grid">
        ${e18eStats.install_size ? `<div class="card accent"><span class="label">Install Size</span><span class="value">${esc(e18eStats.install_size)}</span></div>` : ""}
        ${e18eStats.production_deps ? `<div class="card accent"><span class="label">Prod Dependencies</span><span class="value">${e18eStats.production_deps}</span></div>` : ""}
        ${e18eStats.duplicate_deps ? `<div class="card ${e18eStats.duplicate_deps > 0 ? "yellow" : "green"}"><span class="label">Duplicates</span><span class="value">${e18eStats.duplicate_deps}</span></div>` : ""}
      </div>
    </section>`;
  }

  // Execution trace
  const traceHtml = renderTrace(report);

  const targetLabel = target ? ` &middot; Target: <code>${esc(target)}</code>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Browser Compatibility Report — ${esc(date)}</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #181a20;
    --surface-2: #23262f;
    --border: #2e313a;
    --text: #e1e3e8;
    --text-muted: #8b8fa3;
    --accent: #6c8cff;
    --accent-dim: rgba(108,140,255,.12);
    --green: #34d399;
    --green-dim: rgba(52,211,153,.12);
    --yellow: #fbbf24;
    --yellow-dim: rgba(251,191,36,.12);
    --red: #f87171;
    --red-dim: rgba(248,113,113,.12);
    --radius: 10px;
    --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: .25rem; letter-spacing: -0.02em; }
  .subtitle { color: var(--text-muted); font-size: .9rem; margin-bottom: 2rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: .75rem; margin-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: .25rem; }
  .card .label { font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); font-weight: 600; }
  .card .value { font-size: 1.65rem; font-weight: 700; line-height: 1.2; }
  .card .detail { font-size: .78rem; color: var(--text-muted); }
  .card.green .value { color: var(--green); }
  .card.yellow .value { color: var(--yellow); }
  .card.red .value { color: var(--red); }
  .card.accent .value { color: var(--accent); }
  section { margin-bottom: 2rem; }
  h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: .85rem; padding-bottom: .5rem; border-bottom: 1px solid var(--border); letter-spacing: -0.01em; }
  .baseline-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.15rem 1.35rem; margin-bottom: 2rem; }
  .baseline-box .row { display: flex; gap: .5rem; margin-bottom: .35rem; font-size: .88rem; align-items: baseline; flex-wrap: wrap; }
  .baseline-box .row:last-child { margin-bottom: 0; }
  .baseline-box .key { color: var(--text-muted); min-width: 120px; flex-shrink: 0; font-weight: 600; }
  .baseline-box code { background: var(--surface-2); padding: .15em .45em; border-radius: 4px; font-family: var(--font-mono); font-size: .82rem; }
  .browser-tags { display: flex; flex-wrap: wrap; gap: .35rem; }
  .browser-tag { background: var(--accent-dim); color: var(--accent); font-size: .75rem; font-weight: 600; padding: .2em .6em; border-radius: 4px; font-family: var(--font-mono); }
  .finding { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 1rem; }
  .finding-header { display: flex; align-items: center; gap: .65rem; padding: .85rem 1.25rem; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .severity-badge { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: .2em .65em; border-radius: 4px; flex-shrink: 0; }
  .severity-badge.warning { background: var(--yellow-dim); color: var(--yellow); }
  .severity-badge.error { background: var(--red-dim); color: var(--red); }
  .severity-badge.info { background: var(--accent-dim); color: var(--accent); }
  .finding-id { font-family: var(--font-mono); font-size: .78rem; color: var(--text-muted); flex-shrink: 0; }
  .finding-title { font-weight: 600; font-size: .92rem; flex: 1; min-width: 0; }
  .fix-badge { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: .2em .65em; border-radius: 4px; background: var(--green-dim); color: var(--green); flex-shrink: 0; white-space: nowrap; }
  .finding-body { padding: 1.15rem 1.25rem; display: grid; gap: .85rem; }
  .finding-meta { display: grid; grid-template-columns: 120px 1fr; gap: .3rem .75rem; font-size: .84rem; }
  .finding-meta dt { color: var(--text-muted); font-weight: 600; }
  .finding-meta dd { color: var(--text); }
  .finding-meta dd code { background: var(--surface-2); padding: .1em .4em; border-radius: 4px; font-family: var(--font-mono); font-size: .8rem; word-break: break-all; }
  .compat-grid { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .15rem; }
  .compat-chip { font-size: .72rem; font-weight: 600; padding: .15em .55em; border-radius: 4px; font-family: var(--font-mono); }
  .compat-chip.unsupported { background: var(--red-dim); color: var(--red); }
  .compat-chip.partial { background: var(--yellow-dim); color: var(--yellow); }
  .compat-chip.supported { background: var(--green-dim); color: var(--green); }
  .guidance { background: var(--surface-2); border-left: 3px solid var(--accent); border-radius: 0 var(--radius) var(--radius) 0; padding: .85rem 1rem; font-size: .84rem; line-height: 1.55; }
  .guidance strong { color: var(--accent); }
  .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
  table { width: 100%; border-collapse: collapse; font-size: .84rem; }
  thead th { text-align: left; padding: .65rem 1rem; background: var(--surface); border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
  tbody td { padding: .6rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  tbody tr:last-child td { border-bottom: none; }
  tbody td code { background: var(--surface-2); padding: .1em .4em; border-radius: 4px; font-family: var(--font-mono); font-size: .8rem; }
  .status { font-weight: 600; }
  .status.completed { color: var(--green); }
  .status.skipped { color: var(--text-muted); }
  .next-steps { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.15rem 1.35rem; }
  .next-steps ul { list-style: none; padding: 0; }
  .next-steps li { padding: .35rem 0; font-size: .88rem; display: flex; align-items: flex-start; gap: .5rem; }
  .next-steps li::before { content: '\\2713'; color: var(--green); font-weight: 700; flex-shrink: 0; margin-top: .1rem; }
  details { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 1rem; }
  details summary { padding: .85rem 1.25rem; cursor: pointer; font-weight: 600; font-size: .92rem; user-select: none; list-style: none; display: flex; align-items: center; gap: .5rem; }
  details summary::before { content: '\\25B6'; font-size: .65rem; transition: transform .15s; color: var(--text-muted); }
  details[open] summary::before { transform: rotate(90deg); }
  details .trace-body { padding: 0 1.25rem 1.15rem; }
  details .trace-body h3 { font-size: .85rem; font-weight: 700; color: var(--text-muted); margin: 1rem 0 .5rem; text-transform: uppercase; letter-spacing: .04em; }
  details .trace-body h3:first-child { margin-top: 0; }
  .trace-stage { margin-bottom: .85rem; padding-left: .75rem; border-left: 2px solid var(--border); }
  .trace-stage .stage-name { font-weight: 600; font-size: .84rem; margin-bottom: .25rem; }
  .trace-stage .stage-details { font-size: .8rem; color: var(--text-muted); line-height: 1.55; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: .78rem; color: var(--text-muted); text-align: center; }
  .empty-state { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; text-align: center; color: var(--green); font-weight: 600; font-size: 1.1rem; }
</style>
</head>
<body>

<h1>Browser Compatibility Report</h1>
<p class="subtitle">Generated ${esc(date)} &middot; Branch: <strong>${esc(branch)}</strong>${targetLabel}</p>

<!-- Baseline -->
<div class="baseline-box">
  <div class="row">
    <span class="key">Source</span>
    <span><code>${esc(baseline.source || "default fallback")}</code></span>
  </div>
  <div class="row">
    <span class="key">Query</span>
    <span><code>${esc(baseline.query || "")}</code></span>
  </div>
  <div class="row">
    <span class="key">Browsers</span>
    <span class="browser-tags">${browserTagsHtml}</span>
  </div>
</div>

<!-- Summary Cards -->
<div class="summary-grid">${cardsHtml}</div>

${findings.length === 0 ? '<div class="empty-state">No compatibility issues found — clean audit!</div>' : ""}

${errorsSection}
${warningsSection}
${depSection}
${infosSection}
${depStatsHtml}
${fixesSection}
${nextStepsHtml}

<!-- Execution Trace -->
<section>
  <h2>Execution Trace</h2>
  ${traceHtml}
</section>

<footer>Generated by <strong>web-compat-audit</strong> skill &middot; ${esc(date)}</footer>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.inputPath || !args.outputPath) {
    console.error("Usage: render-html-report.js <report.json> <output.html> [--branch name] [--date YYYY-MM-DD] [--target desc]");
    process.exit(1);
  }

  const raw = fs.readFileSync(args.inputPath, "utf-8").trim();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse JSON from ${args.inputPath}: ${e.message}`);
    process.exit(1);
  }

  // Accept either { report: { ... } } or the report object directly
  const report = data.report || data;

  const html = renderHtml(report, {
    branch: args.branch,
    date: args.date || new Date().toISOString().slice(0, 10),
    target: args.target,
  });

  fs.writeFileSync(args.outputPath, html, "utf-8");
  console.log(`HTML report written to ${args.outputPath}`);
}

main();
