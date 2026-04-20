#!/usr/bin/env node
/**
 * parse-stylelint.js
 *
 * Parses stylelint JSON output (from --formatter json) and extracts
 * CSS compatibility findings from stylelint-no-unsupported-browser-features
 * into a normalized findings array compatible with merge-reports.js.
 *
 * Usage: node parse-stylelint.js <stylelint-results.json> [output.json]
 *
 * If output path is omitted, writes to stdout.
 */

const fs = require("fs");
const path = require("path");

function parseResults(resultsPath) {
  const raw = fs.readFileSync(resultsPath, "utf-8").trim();
  if (!raw) return { findings: [] };

  let results;
  try {
    results = JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse stylelint results JSON.");
    return { findings: [] };
  }

  const findings = [];
  let index = 1;

  for (const file of results) {
    if (!file.warnings || file.warnings.length === 0) continue;

    for (const warn of file.warnings) {
      // Only process findings from our compat plugin
      if (warn.rule !== "plugin/no-unsupported-browser-features") continue;

      const { feature, browsers } = parseCompatMessage(warn.text);

      findings.push({
        id: `css-${String(index).padStart(3, "0")}`,
        source: "css",
        feature: feature,
        description: warn.text,
        location: {
          file: file.source || null,
          line: warn.line || null,
          column: warn.column || null,
        },
        unsupported_browsers: browsers,
        severity: warn.severity === "error" ? "error" : "warning",
        remediation: {
          type: inferRemediationType(feature),
          recommendation: null,
          package: null,
          example: null,
        },
      });
      index++;
    }
  }

  return { findings };
}

function parseCompatMessage(text) {
  // stylelint-no-unsupported-browser-features messages look like:
  // "Unexpected browser feature 'css-container-queries' is not supported by IE 11, Chrome 90"
  // or: "'css-nesting' is not supported by Firefox 120, Safari 16"
  const match = text.match(
    /(?:Unexpected browser feature\s+)?'([^']+)'\s+is not supported by\s+(.+?)(?:\s*\(|$)/i
  );
  if (match) {
    const feature = match[1].trim();
    const browsers = match[2]
      .split(/,\s*/)
      .map((b) => b.trim())
      .filter(Boolean);
    return { feature, browsers };
  }

  // Fallback: extract what we can
  const featureMatch = text.match(/'([^']+)'/);
  return {
    feature: featureMatch ? featureMatch[1] : text.substring(0, 60),
    browsers: [],
  };
}

function inferRemediationType(feature) {
  // CSS features generally need fallback patterns, not polyfills
  // Some have polyfills (container queries), most need @supports guards
  const polyfillable = [
    "css-container-queries",
    "dialog",
    "web-animation",
  ];
  if (polyfillable.some((p) => feature.includes(p))) return "polyfill";
  return "fallback";
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(
    "Usage: node parse-stylelint.js <stylelint-results.json> [output.json]"
  );
  process.exit(1);
}

const resultsPath = path.resolve(args[0]);
if (!fs.existsSync(resultsPath)) {
  console.error(`Error: File not found: ${resultsPath}`);
  process.exit(1);
}

const result = parseResults(resultsPath);

if (args[1]) {
  fs.writeFileSync(args[1], JSON.stringify(result, null, 2));
  console.error(
    `Parsed ${result.findings.length} CSS findings. Written to ${args[1]}`
  );
} else {
  console.log(JSON.stringify(result, null, 2));
}
