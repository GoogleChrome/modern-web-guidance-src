import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { compareGuides } from "./compare-built-guides.ts";

test("compareGuides processes file-based diffs using local git diff --no-index without mocks", (t) => {
  // Setup isolated temporary directories for the baseline and active branch compile outputs
  const tmpTestDir = fs.mkdtempSync("/tmp/test-guides-compare-");
  const baselineDir = path.join(tmpTestDir, "baseline");
  const branchDir = path.join(tmpTestDir, "branch");

  fs.mkdirSync(path.join(baselineDir, "forms"), { recursive: true });
  fs.mkdirSync(path.join(branchDir, "forms"), { recursive: true });

  // Guarantee workspace cleanup when test iteration completes
  t.after(() => {
    try {
      fs.rmSync(tmpTestDir, { recursive: true, force: true });
    } catch (e) {}
  });

  // 1. Verbatim Scenario: Exact parity matches
  fs.writeFileSync(
    path.join(baselineDir, "forms/autofill-sign-in-form.md"),
    "This is a standard sign-in guide prose content.\n"
  );
  fs.writeFileSync(
    path.join(branchDir, "forms/autofill-sign-in-form.md"),
    "This is a standard sign-in guide prose content.\n"
  );

  // 2. Modified Scenario: Prose delta
  fs.writeFileSync(
    path.join(baselineDir, "forms/autofill-sign-up-form.md"),
    "Original text line.\n"
  );
  fs.writeFileSync(
    path.join(branchDir, "forms/autofill-sign-up-form.md"),
    "Original text line.\nAdded modification here.\n"
  );

  // 3. Newly Created File Scenario
  fs.writeFileSync(
    path.join(branchDir, "forms/autofill-payment-form.md"),
    "New payment form content.\n"
  );

  // 4. Deleted File Scenario
  fs.writeFileSync(
    path.join(baselineDir, "forms/autofill-address-form.md"),
    "Address form content.\n"
  );

  const modifiedGuides = [
    "forms/autofill-sign-in-form",
    "forms/autofill-sign-up-form",
    "forms/autofill-payment-form",
    "forms/autofill-address-form"
  ];

  // Run comparative extraction directly.
  // Note that no git mock models are required because git diff --no-index runs on plain directories on-disk
  const report = compareGuides(modifiedGuides, baselineDir, branchDir);

  // Verbatim outlines match
  assert.ok(report.includes("- **Verbatim (Macro rendering parity):** 1 guides"));
  assert.ok(report.includes("- `forms/autofill-sign-in-form`"));

  // Modified files index links
  assert.ok(report.includes("- **Refactored & Improved (Visual diffs):** 1 guides"));
  assert.ok(report.includes("- [forms/autofill-sign-up-form](#user-content-forms-autofill-sign-up-form)"));

  // New / Deleted sections mapped
  assert.ok(report.includes("### 🆕 [NEW] forms/autofill-payment-form"));
  assert.ok(report.includes("### 🗑️ [DELETED] forms/autofill-address-form"));

  // Output contains real line additions diff logs
  assert.ok(report.includes('<h3 id="forms-autofill-sign-up-form">forms/autofill-sign-up-form</h3>'));
  assert.ok(report.includes("```diff"));
  assert.ok(report.includes("+ Added modification here."));
});
