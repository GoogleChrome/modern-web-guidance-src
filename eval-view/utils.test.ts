import { test, describe } from "node:test";
import assert from "node:assert";
import type { ScenarioCheck } from "../harness/lib/metrics.ts";
import {
  getRunStats,
  getColor,
  escapeHtml,
  capitalize,
  formatTokens,
  parseResultKey,
  categorizeActionClient,
  normalizeTrajectoryClient,
  hasNightlyRuns
} from "./utils.js";

describe("eval-view utils", () => {
  test("getRunStats calculates passed checks rate accurately", () => {
    assert.deepStrictEqual(getRunStats([]), { rate: 0, passed: 0, total: 0 });
    assert.deepStrictEqual(getRunStats(null), { rate: 0, passed: 0, total: 0 });

    const checks: ScenarioCheck[] = [
      { id: "1", message: "", passed: true },
      { id: "2", message: "", passed: false },
      { id: "3", message: "", passed: true },
      { id: "4", message: "", passed: true }
    ];
    assert.deepStrictEqual(getRunStats(checks), { rate: 75, passed: 3, total: 4 });
  });

  test("getColor returns proper OKLCH color strings for thresholds", () => {
    assert.ok(getColor(0).includes("oklch"));
    assert.ok(getColor(50).includes("color-mix"));
    assert.ok(getColor(100).includes("oklch"));
  });

  test("escapeHtml sanitizes special characters", () => {
    assert.strictEqual(escapeHtml('<script>alert("x" & \'y\')</script>'), '&lt;script&gt;alert(&quot;x&quot; &amp; &#039;y&#039;)&lt;/script&gt;');
    assert.strictEqual(escapeHtml(""), "");
    assert.strictEqual(escapeHtml(null), null);
  });

  test("capitalize capitalizes the first character of strings", () => {
    assert.strictEqual(capitalize("hello"), "Hello");
    assert.strictEqual(capitalize(""), "");
    assert.strictEqual(capitalize(null), null);
  });

  test("formatTokens formats compact token counts", () => {
    assert.strictEqual(formatTokens(0), "0 tok");
    assert.strictEqual(formatTokens(null), "0 tok");
    assert.ok(formatTokens(1500).includes("1.5k tok") || formatTokens(1500).includes("1.5k"));
  });

  test("parseResultKey extracts task, guide, and runType", () => {
    assert.strictEqual(parseResultKey("invalid"), null);

    const parsed = parseResultKey("anchor-tooltip - anchor-positioning - guided");
    assert.ok(parsed);
    assert.strictEqual(parsed.task, "anchor-tooltip");
    assert.strictEqual(parsed.guide, "anchor-positioning");
    assert.strictEqual(parsed.runType, "guided");
  });

  test("categorizeActionClient maps action names, parameters, and thoughts into categories", () => {
    assert.strictEqual(categorizeActionClient("respond_to_user", {}, ""), "other");
    assert.strictEqual(categorizeActionClient("retrieve", { id: "anchor-positioning" }, ""), "guide_retrieval");
    assert.strictEqual(categorizeActionClient("search", { query: "popover" }, ""), "skill_search");
    assert.strictEqual(categorizeActionClient("write_to_file", { TargetFile: "index.html" }, ""), "code_mutation");
    assert.strictEqual(categorizeActionClient("other", {}, "I must follow the mandatory baseline rules"), "mandatory_rule_thought");
    assert.strictEqual(categorizeActionClient("view_file", {}, "just reading"), "incidental_noise");
  });

  test("normalizeTrajectoryClient annotates missing canonicalCategories on steps", () => {
    const rawSummary = {
      agent: "gemini-cli",
      steps: [
        {
          stepNumber: 1,
          action: { name: "search", params: { query: "details" } }
        },
        {
          stepNumber: 2,
          action: { name: "write_to_file", params: { TargetFile: "app.jsx" } }
        }
      ]
    };

    const normalized = normalizeTrajectoryClient(rawSummary);
    assert.strictEqual(normalized.steps[0].action.canonicalCategory, "skill_search");
    assert.strictEqual(normalized.steps[1].action.canonicalCategory, "code_mutation");
  });

  test("hasNightlyRuns detects nightly in testId entries", () => {
    assert.strictEqual(hasNightlyRuns(null), false);
    assert.strictEqual(hasNightlyRuns({}), false);
    assert.strictEqual(hasNightlyRuns({ a: { testId: "test-run-1" } }), false);
    assert.strictEqual(hasNightlyRuns({ a: { testId: "nightly-2026-08-01" } }), true);
    assert.strictEqual(hasNightlyRuns({ a: { testId: "run-A" }, b: { testId: "CLI-Nightly-eval" } }), true);
  });
});
