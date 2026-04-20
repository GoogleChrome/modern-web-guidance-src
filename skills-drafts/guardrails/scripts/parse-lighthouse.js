#!/usr/bin/env node
/**
 * parse-lighthouse.js
 *
 * Parses a Lighthouse JSON report and extracts compatibility-relevant findings
 * (deprecations, console errors, best-practice violations) into a normalized
 * findings array.
 *
 * Usage: node parse-lighthouse.js <lighthouse-report.json> [output.json]
 *
 * If output path is omitted, writes to stdout.
 */

const fs = require("fs");
const path = require("path");

const RELEVANT_AUDITS = [
  {
    id: "deprecations",
    severity: "warning",
    description: "Uses deprecated APIs that will be removed in future browser versions",
  },
  {
    id: "errors-in-console",
    severity: "error",
    description: "JavaScript errors in the console may indicate unsupported APIs",
  },
  {
    id: "no-unload-listeners",
    severity: "warning",
    description:
      "The unload event is deprecated and unreliable in modern browsers",
  },
  {
    id: "inspector-issues",
    severity: "warning",
    description: "Browser inspector issues (mixed content, CORS, etc.)",
  },
  {
    id: "uses-passive-event-listeners",
    severity: "warning",
    description:
      "Non-passive event listeners degrade scroll performance on mobile",
  },
  {
    id: "is-on-https",
    severity: "info",
    description: "Page is not served over HTTPS",
  },
];

function parseReport(reportPath) {
  const raw = fs.readFileSync(reportPath, "utf-8");
  const report = JSON.parse(raw);
  const findings = [];
  let findingIndex = 1;

  const audits = report.audits || {};

  for (const auditDef of RELEVANT_AUDITS) {
    const audit = audits[auditDef.id];
    if (!audit) continue;

    // score === 1 means the audit passed — skip it
    if (audit.score === 1 || audit.score === null) continue;

    const items = audit.details?.items || [];

    if (items.length === 0 && audit.score !== null && audit.score < 1) {
      // Audit failed but has no item details — record a single finding
      findings.push({
        id: `lh-${String(findingIndex).padStart(3, "0")}`,
        source: "runtime",
        feature: audit.title || auditDef.id,
        description: audit.description || auditDef.description,
        location: { file: null, line: null, column: null },
        unsupported_browsers: [],
        severity: auditDef.severity,
        remediation: {
          type: "manual-review",
          recommendation: `Review the Lighthouse "${auditDef.id}" audit for details.`,
          package: null,
          example: null,
        },
      });
      findingIndex++;
      continue;
    }

    for (const item of items) {
      const description =
        item.value || item.description || item.label || auditDef.description;

      // Try to extract source location
      const source = item.source || {};
      const location = {
        file: source.url || item.url || null,
        line: source.line != null ? source.line : null,
        column: source.column != null ? source.column : null,
      };

      findings.push({
        id: `lh-${String(findingIndex).padStart(3, "0")}`,
        source: "runtime",
        feature: extractFeatureName(description, auditDef.id),
        description: description,
        location: location,
        unsupported_browsers: [],
        severity: auditDef.severity,
        remediation: {
          type: inferRemediationType(auditDef.id, description),
          recommendation: inferRecommendation(auditDef.id, description),
          package: null,
          example: null,
        },
      });
      findingIndex++;
    }
  }

  // Also extract category scores for the summary
  const categories = report.categories || {};
  const scores = {};
  for (const [key, cat] of Object.entries(categories)) {
    scores[key] = {
      title: cat.title,
      score: cat.score != null ? Math.round(cat.score * 100) : null,
    };
  }

  return { findings, scores, fetchTime: report.fetchTime || null };
}

function extractFeatureName(description, auditId) {
  // Try to pull out the specific API/feature name from the description
  const apiMatch = description.match(
    /`([^`]+)`|'([^']+)'|"([^"]+)"|(\S+\.\S+\(\))/
  );
  if (apiMatch) {
    return apiMatch[1] || apiMatch[2] || apiMatch[3] || apiMatch[4];
  }

  // For deprecation messages, the feature is usually at the start
  if (auditId === "deprecations") {
    const parts = description.split(/\s+is\s+deprecated|\s+has\s+been/i);
    if (parts[0] && parts[0].length < 80) {
      return parts[0].trim();
    }
  }

  // For console errors, try to extract the error type
  if (auditId === "errors-in-console") {
    const errorMatch = description.match(
      /(\w+Error):|(\w+) is not defined|Cannot read propert/
    );
    if (errorMatch) {
      return errorMatch[1] || errorMatch[2] || "JavaScript Error";
    }
  }

  return description.substring(0, 60);
}

function inferRemediationType(auditId, description) {
  if (auditId === "deprecations") return "fallback";
  if (auditId === "errors-in-console") {
    if (/is not defined|is not a function/i.test(description)) return "polyfill";
    return "manual-review";
  }
  if (auditId === "uses-passive-event-listeners") return "fallback";
  return "manual-review";
}

function inferRecommendation(auditId, description) {
  if (auditId === "deprecations") {
    return `Replace the deprecated API with its modern equivalent. ${description}`;
  }
  if (auditId === "errors-in-console") {
    if (/is not defined|is not a function/i.test(description)) {
      return "This may indicate a missing polyfill for an API not supported in the current browser. Check the polyfill registry for a recommended package.";
    }
    return "Investigate the console error to determine if it's caused by a compatibility issue.";
  }
  if (auditId === "uses-passive-event-listeners") {
    return "Add { passive: true } to event listeners that don't call preventDefault(). Example: element.addEventListener('scroll', handler, { passive: true });";
  }
  if (auditId === "no-unload-listeners") {
    return "Replace 'unload' event listeners with 'pagehide' or the Page Lifecycle API. The unload event is unreliable on mobile and is being deprecated.";
  }
  return `Review the Lighthouse "${auditId}" audit and address the flagged issue.`;
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node parse-lighthouse.js <report.json> [output.json]");
  process.exit(1);
}

const reportPath = path.resolve(args[0]);
if (!fs.existsSync(reportPath)) {
  console.error(`Error: File not found: ${reportPath}`);
  process.exit(1);
}

const result = parseReport(reportPath);

if (args[1]) {
  fs.writeFileSync(args[1], JSON.stringify(result, null, 2));
  console.error(`Parsed ${result.findings.length} findings. Written to ${args[1]}`);
} else {
  console.log(JSON.stringify(result, null, 2));
}
