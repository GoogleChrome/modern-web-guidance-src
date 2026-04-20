#!/usr/bin/env node
/**
 * merge-reports.js
 *
 * Merges eslint-plugin-compat findings and Lighthouse findings into a single
 * unified compatibility report with a summary and per-finding remediation
 * recommendations.
 *
 * Usage:
 *   node merge-reports.js <eslint-results.json> <lighthouse-parsed.json> [--baseline "query"] [--browsers "Chrome 90, Safari 14, ..."]
 *
 * Inputs:
 *   eslint-results.json    — raw ESLint JSON output (from --format json)
 *   lighthouse-parsed.json — output of parse-lighthouse.js
 *
 * Output: Writes the unified report to stdout as JSON.
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { eslintPath: null, lighthousePath: null, e18ePath: null, stylelintPath: null, baseline: null, browsers: null };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline" && argv[i + 1]) {
      args.baseline = argv[++i];
    } else if (argv[i] === "--browsers" && argv[i + 1]) {
      args.browsers = argv[++i];
    } else {
      positional.push(argv[i]);
    }
  }

  args.eslintPath = positional[0] || null;
  args.lighthousePath = positional[1] || null;
  args.e18ePath = positional[2] || null;
  args.stylelintPath = positional[3] || null;
  return args;
}

function parseEslintFindings(eslintPath) {
  if (!eslintPath || !fs.existsSync(eslintPath)) return [];

  const raw = fs.readFileSync(eslintPath, "utf-8").trim();
  if (!raw) return [];

  let results;
  try {
    results = JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse ESLint results JSON.");
    return [];
  }

  const findings = [];
  let index = 1;

  for (const file of results) {
    if (!file.messages || file.messages.length === 0) continue;

    for (const msg of file.messages) {
      if (msg.ruleId !== "compat/compat") continue;

      // Extract the feature name and unsupported browsers from the message
      // Typical format: "FeatureName is not supported in Browser1, Browser2"
      const { feature, browsers } = parseCompatMessage(msg.message);

      findings.push({
        id: `eslint-${String(index).padStart(3, "0")}`,
        source: "static",
        feature: feature,
        description: msg.message,
        location: {
          file: file.filePath,
          line: msg.line || null,
          column: msg.column || null,
        },
        unsupported_browsers: browsers,
        severity: msg.severity === 2 ? "error" : "warning",
        remediation: {
          type: "polyfill",
          recommendation: null,
          package: null,
          example: null,
        },
      });
      index++;
    }
  }

  return findings;
}

function parseCompatMessage(message) {
  // eslint-plugin-compat messages look like:
  // "NodeList.prototype.forEach is not supported in IE 11"
  // "fetch is not supported in IE 11, Opera Mini all"
  const match = message.match(/^(.+?)\s+is not supported in\s+(.+)$/i);
  if (match) {
    const feature = match[1].trim();
    const browsers = match[2]
      .split(/,\s*/)
      .map((b) => b.trim())
      .filter(Boolean);
    return { feature, browsers };
  }

  // Fallback: try to extract just the feature name
  const featureMatch = message.match(/^(\S+)/);
  return {
    feature: featureMatch ? featureMatch[1] : message.substring(0, 60),
    browsers: [],
  };
}

function parseLighthouseFindings(lhPath) {
  if (!lhPath || !fs.existsSync(lhPath)) return { findings: [], scores: {} };

  const raw = fs.readFileSync(lhPath, "utf-8").trim();
  if (!raw) return { findings: [], scores: {} };

  try {
    return JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse Lighthouse findings JSON.");
    return { findings: [], scores: {} };
  }
}

function parseE18eFindings(e18ePath) {
  if (!e18ePath || !fs.existsSync(e18ePath)) return { findings: [], stats: {} };

  const raw = fs.readFileSync(e18ePath, "utf-8").trim();
  if (!raw) return { findings: [], stats: {} };

  try {
    return JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse e18e findings JSON.");
    return { findings: [], stats: {} };
  }
}

function parseStylelintFindings(stylelintPath) {
  if (!stylelintPath || !fs.existsSync(stylelintPath)) return { findings: [] };

  const raw = fs.readFileSync(stylelintPath, "utf-8").trim();
  if (!raw) return { findings: [] };

  try {
    return JSON.parse(raw);
  } catch {
    console.error("Warning: Could not parse stylelint findings JSON.");
    return { findings: [] };
  }
}

function deduplicateFindings(findings) {
  // Group findings by feature name. Multiple occurrences of the same feature
  // (e.g., Array.prototype.at() used in 50 places) are collapsed into a single
  // finding with a `locations` array, preventing report bloat.
  // Findings from different sources (static vs runtime vs dependency) for the
  // same feature are merged, noting the overlap.
  const byFeature = new Map();
  const result = [];

  for (const f of findings) {
    // Exact same feature + file + line = true duplicate, skip
    const exactKey = `${f.feature}::${f.location.file}::${f.location.line}`;

    // Group by feature + source for collapsing multiple locations
    const groupKey = `${f.feature}::${f.source}`;

    if (byFeature.has(groupKey)) {
      const existing = byFeature.get(groupKey);
      const existingExactKeys = existing._exactKeys || new Set();

      if (existingExactKeys.has(exactKey)) {
        // True duplicate — same feature, same location. Skip entirely.
        continue;
      }

      // Same feature, different location — add to locations array
      existingExactKeys.add(exactKey);
      existing._exactKeys = existingExactKeys;

      if (!existing.locations) {
        existing.locations = [{ ...existing.location }];
      }
      existing.locations.push({ ...f.location });
      existing.location_count = existing.locations.length;
    } else {
      const entry = { ...f, _exactKeys: new Set([exactKey]) };
      byFeature.set(groupKey, entry);
      result.push(entry);
    }
  }

  // Cross-source overlap: if the same feature appears in both static and runtime,
  // annotate the static finding (which has better location data)
  const featureToSources = new Map();
  for (const f of result) {
    if (!featureToSources.has(f.feature)) {
      featureToSources.set(f.feature, []);
    }
    featureToSources.get(f.feature).push(f);
  }
  for (const [, entries] of featureToSources) {
    if (entries.length > 1) {
      const sources = entries.map((e) => e.source);
      for (const entry of entries) {
        const otherSources = sources.filter((s) => s !== entry.source);
        if (otherSources.length > 0) {
          entry.also_flagged_by = otherSources;
        }
      }
    }
  }

  // Clean up internal tracking fields
  for (const f of result) {
    delete f._exactKeys;
  }

  return result;
}

function buildReport(eslintFindings, lhData, e18eData, stylelintData, baseline, browsers) {
  const allFindings = [
    ...eslintFindings,
    ...(lhData.findings || []),
    ...(e18eData.findings || []),
    ...(stylelintData.findings || []),
  ];
  const deduped = deduplicateFindings(allFindings);

  // Sort by severity: error > warning > info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  deduped.sort(
    (a, b) =>
      (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3)
  );

  // Re-index after sorting
  deduped.forEach((f, i) => {
    f.id = `finding-${String(i + 1).padStart(3, "0")}`;
  });

  const errors = deduped.filter((f) => f.severity === "error");
  const warnings = deduped.filter((f) => f.severity === "warning");
  const infos = deduped.filter((f) => f.severity === "info");
  const staticCount = deduped.filter((f) => f.source === "static").length;
  const runtimeCount = deduped.filter((f) => f.source === "runtime").length;
  const depCount = deduped.filter((f) => f.source === "dependency").length;
  const cssCount = deduped.filter((f) => f.source === "css").length;
  const autoFixedCount = deduped.filter((f) => f.auto_fixed === true).length;
  const autoMigratedCount = deduped.filter((f) => f.e18e_fixable === true).length;
  const manualReviewCount = deduped.filter(
    (f) => f.remediation && f.remediation.type === "manual-review"
  ).length;

  return {
    report: {
      title: "Browser Compatibility Report",
      generated_at: new Date().toISOString(),
      baseline: {
        source: baseline || "default fallback",
        query: baseline || "> 0.5%, last 2 versions, not dead",
        target_browsers: browsers
          ? browsers.split(",").map((b) => b.trim())
          : [],
      },
      summary: {
        total_findings: deduped.length,
        errors: errors.length,
        warnings: warnings.length,
        info: infos.length,
        static_analysis_findings: staticCount,
        runtime_analysis_findings: runtimeCount,
        dependency_analysis_findings: depCount,
        css_analysis_findings: cssCount,
        auto_fixed: autoFixedCount,
        auto_migrated: autoMigratedCount,
        manual_review_required: manualReviewCount,
      },
      lighthouse_scores: lhData.scores || {},
      e18e_stats: e18eData.stats || {},
      findings: deduped,
    },
  };
}

// --- Main ---
const args = parseArgs(process.argv.slice(2));

if (!args.eslintPath && !args.lighthousePath && !args.e18ePath && !args.stylelintPath) {
  console.error(
    "Usage: node merge-reports.js <eslint-results.json> <lighthouse-parsed.json> [e18e-parsed.json] [stylelint-parsed.json] [--baseline query] [--browsers list]"
  );
  console.error(
    "At least one input file is required. Pass '-' to skip any input."
  );
  process.exit(1);
}

const eslintFindings = parseEslintFindings(
  args.eslintPath !== "-" ? args.eslintPath : null
);
const lhData = parseLighthouseFindings(
  args.lighthousePath !== "-" ? args.lighthousePath : null
);
const e18eData = parseE18eFindings(
  args.e18ePath !== "-" ? args.e18ePath : null
);
const stylelintData = parseStylelintFindings(
  args.stylelintPath !== "-" ? args.stylelintPath : null
);

const report = buildReport(
  eslintFindings,
  lhData,
  e18eData,
  stylelintData,
  args.baseline,
  args.browsers
);

console.log(JSON.stringify(report, null, 2));
