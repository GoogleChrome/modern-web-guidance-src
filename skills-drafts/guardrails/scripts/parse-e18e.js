#!/usr/bin/env node
/**
 * parse-e18e.js
 *
 * Parses the JSON output of `@e18e/cli analyze --json` and extracts
 * dependency-level findings into a normalized findings array compatible
 * with the unified report format used by merge-reports.js.
 *
 * Usage: node parse-e18e.js <e18e-raw.json> [output.json]
 *
 * If output path is omitted, writes to stdout.
 */

const fs = require("fs");
const path = require("path");

/**
 * e18e CLI --json output schema (v0.5.0):
 * {
 *   stats: { name, version, dependencyCount: { production, development }, installSize, extraStats: [] },
 *   messages: [
 *     { message: string, severity: 'error'|'warning'|'suggestion', score: number, fixableBy?: 'migrate' }
 *   ]
 * }
 */

const SEVERITY_MAP = {
  error: "error",
  warning: "warning",
  suggestion: "info",
};

function parseRawOutput(rawPath) {
  const raw = fs.readFileSync(rawPath, "utf-8").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse e18e JSON output.");
    return null;
  }
}

function classifyMessage(message) {
  if (message.startsWith("[duplicate dependency]")) return "duplicate";
  if (/can be removed/.test(message)) return "native-removal";
  if (/native functionality/.test(message)) return "native-replacement";
  if (/native syntax/.test(message)) return "native-inline";
  if (/more performant alternative/.test(message)) return "preferred-replacement";
  if (/\[publint\]/i.test(message)) return "publint";
  return "other";
}

function extractPackageName(message) {
  // Pattern: Module "package-name" can be ...
  const quoted = message.match(/Module "([^"]+)"/);
  if (quoted) return quoted[1];

  // Pattern: [duplicate dependency] package-name has N installed versions
  const dupMatch = message.match(
    /\[duplicate dependency\]\s+(\S+)\s+has\s+\d+/
  );
  if (dupMatch) return dupMatch[1];

  // Fallback: first non-bracket word
  const fallback = message.match(/^(?:\[[^\]]+\]\s+)?(\S+)/);
  return fallback ? fallback[1] : message.substring(0, 40);
}

function extractReplacementInfo(message) {
  // "can be replaced with inline native syntax. <description>."
  const inlineMatch = message.match(
    /can be replaced with inline native syntax\.\s*(.+?)\./
  );
  if (inlineMatch) {
    return { type: "native", detail: inlineMatch[1].trim() };
  }

  // "can be removed, and native functionality used instead"
  if (/can be removed.*native functionality/.test(message)) {
    return { type: "native", detail: "Use native JS/browser APIs" };
  }

  // "can be replaced with native functionality"
  if (/can be replaced with native functionality/.test(message)) {
    return { type: "native", detail: "Use native JS/browser APIs" };
  }

  // "can be replaced with a more performant alternative"
  if (/more performant alternative/.test(message)) {
    return { type: "preferred", detail: null };
  }

  // duplicate dependency
  if (/\[duplicate dependency\]/.test(message)) {
    return { type: "duplicate", detail: null };
  }

  return { type: "other", detail: null };
}

function buildRecommendation(msg, replacementInfo, category) {
  const pkg = extractPackageName(msg.message);

  if (msg.fixableBy === "migrate") {
    return `Run \`npx @e18e/cli migrate ${pkg}\` to automatically replace with a modern alternative.`;
  }

  switch (category) {
    case "native-removal":
    case "native-replacement":
    case "native-inline":
      return replacementInfo.detail
        ? `Remove the package and ${replacementInfo.detail}.`
        : `Remove the package and use native JS/browser APIs instead.`;
    case "preferred-replacement":
      return `Replace with a lighter alternative. Run \`npx @e18e/cli migrate ${pkg} --interactive\` to see options.`;
    case "duplicate":
      return "Deduplicate by standardizing on a single version. Run `npm dedupe` or update consuming packages.";
    default:
      return "Review and address the issue manually.";
  }
}

function parseFindings(data) {
  if (!data || !data.messages) return { findings: [], stats: {} };

  const findings = [];
  let index = 1;

  for (const msg of data.messages) {
    const category = classifyMessage(msg.message);
    const packageName = extractPackageName(msg.message);
    const replacementInfo = extractReplacementInfo(msg.message);

    const remediationType =
      msg.fixableBy === "migrate" ? "auto-migrate" : "manual-review";

    findings.push({
      id: `e18e-${String(index).padStart(3, "0")}`,
      source: "dependency",
      feature: packageName,
      description: msg.message.split("\n")[0], // First line only for the summary
      location: {
        file: "package.json",
        line: null,
        column: null,
      },
      unsupported_browsers: [],
      severity: SEVERITY_MAP[msg.severity] || "info",
      remediation: {
        type: remediationType,
        recommendation: buildRecommendation(msg, replacementInfo, category),
        package: null,
        example: null,
      },
      e18e_category: category,
      e18e_fixable: msg.fixableBy === "migrate",
      e18e_full_message: msg.message,
    });
    index++;
  }

  // Build normalized stats
  const stats = {};
  if (data.stats) {
    stats.install_size = data.stats.installSize || null;
    stats.dependency_count = data.stats.dependencyCount || {};
    stats.duplicate_dependency_count = 0;

    if (data.stats.extraStats) {
      const dupStat = data.stats.extraStats.find(
        (s) => s.name === "duplicateDependencyCount"
      );
      if (dupStat) stats.duplicate_dependency_count = dupStat.value;
    }
  }

  return { findings, stats };
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node parse-e18e.js <e18e-raw.json> [output.json]");
  process.exit(1);
}

const rawPath = path.resolve(args[0]);
if (!fs.existsSync(rawPath)) {
  console.error(`Error: File not found: ${rawPath}`);
  process.exit(1);
}

const data = parseRawOutput(rawPath);
const result = parseFindings(data);

if (args[1]) {
  fs.writeFileSync(args[1], JSON.stringify(result, null, 2));
  console.error(
    `Parsed ${result.findings.length} findings. Written to ${args[1]}`
  );
} else {
  console.log(JSON.stringify(result, null, 2));
}
