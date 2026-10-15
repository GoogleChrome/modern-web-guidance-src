import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkModernFeaturePresent,
  checkStructuralIntegrity,
  checkSyntaxCleanliness,
  getSeededSensitivityTestCases,
  runBadPatchSensitivitySuite,
  validateFixPatch,
  type FixPatch,
} from './fix-harness.ts';
import { QUALIFIED_GUIDE_IDS } from './rules/index.ts';

describe('checkModernFeaturePresent', () => {
  it('detects dialog feature correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent('dialog', '<dialog id="modal"><button>Close</button></dialog>'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dialog', 'dialogEl.showModal();'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dialog', '<div class="modal"><button>Close</button></div>'),
      false,
    );
  });

  it('detects child-state-based-styling (:has) correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent('child-state-based-styling', '.card:has(input:checked) { border: 1px solid blue; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('child-state-based-styling', '.card.is-active { border: 1px solid blue; }'),
      false,
    );
  });

  it('detects animate-to-intrinsic-sizes correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent('animate-to-intrinsic-sizes', ':root { interpolate-size: allow-keywords; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('animate-to-intrinsic-sizes', 'height: calc-size(auto, size);'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('animate-to-intrinsic-sizes', 'height: 0; transition: height 0.3s;'),
      false,
    );
  });

  it('detects coordinate-global-events (Temporal) correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent('coordinate-global-events', 'const zdt = Temporal.ZonedDateTime.from("2026-10-15[America/New_York]");'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('coordinate-global-events', 'const d = new Date();'),
      false,
    );
  });

  it('returns true for unknown / unconstrained guide IDs', () => {
    assert.strictEqual(
      checkModernFeaturePresent('unconstrained-guide-xyz', 'const foo = 1;'),
      true,
    );
  });
});

describe('checkSyntaxCleanliness', () => {
  it('passes on valid TypeScript / JavaScript', () => {
    const res = checkSyntaxCleanliness(
      'src/foo.ts',
      'export function sum(a: number, b: number): number { return a + b; }',
    );
    assert.strictEqual(res.clean, true);
    assert.strictEqual(res.diagnostics.length, 0);
  });

  it('rejects TypeScript syntax errors', () => {
    const res = checkSyntaxCleanliness(
      'src/foo.ts',
      'export function sum(a: number, b: number { return a + b; }',
    );
    assert.strictEqual(res.clean, false);
    assert.ok(res.diagnostics.length > 0);
    assert.ok(res.diagnostics.some((d) => d.includes('TS1005')));
  });

  it('passes on valid CSS', () => {
    const res = checkSyntaxCleanliness(
      'src/styles.css',
      '.modal { display: block; border-radius: 8px; }',
    );
    assert.strictEqual(res.clean, true);
  });

  it('rejects unclosed block CSS syntax errors', () => {
    const res = checkSyntaxCleanliness(
      'src/styles.css',
      '.modal { display: block; border-radius: 8px; ',
    );
    assert.strictEqual(res.clean, false);
    assert.ok(res.diagnostics.length > 0);
  });

  it('passes on valid JSON', () => {
    const res = checkSyntaxCleanliness(
      'package.json',
      '{\n  "name": "my-pkg",\n  "version": "1.0.0"\n}',
    );
    assert.strictEqual(res.clean, true);
  });

  it('rejects malformed JSON', () => {
    const res = checkSyntaxCleanliness(
      'package.json',
      '{\n  "name": "my-pkg",\n  "version":\n}',
    );
    assert.strictEqual(res.clean, false);
  });

  it('rejects empty content', () => {
    const res = checkSyntaxCleanliness('src/empty.ts', '   \n  ');
    assert.strictEqual(res.clean, false);
    assert.strictEqual(res.diagnostics[0], 'Content is empty');
  });
});

describe('checkStructuralIntegrity', () => {
  it('passes when line count and structural anchors are preserved', () => {
    const original = [
      'import { helper } from "./helper.js";',
      'export function toggleDialog(show: boolean) {',
      '  const el = document.getElementById("diag");',
      '  if (show) {',
      '    el.style.display = "block";',
      '  } else {',
      '    el.style.display = "none";',
      '  }',
      '}',
    ].join('\n');

    const patched = [
      'import { helper } from "./helper.js";',
      'export function toggleDialog(show: boolean) {',
      '  const el = document.getElementById("diag") as HTMLDialogElement;',
      '  if (show) el.showModal();',
      '  else el.close();',
      '}',
    ].join('\n');

    const res = checkStructuralIntegrity(original, patched, 'src/diag.ts');
    assert.strictEqual(res.passed, true);
  });

  it('rejects severe line-count gutting (<40% of original lines)', () => {
    const original = Array.from({ length: 30 }, (_, i) => `const line${i} = ${i};`).join('\n');
    const patched = `const line0 = 0;`;

    const res = checkStructuralIntegrity(original, patched, 'src/lines.ts');
    assert.strictEqual(res.passed, false);
    assert.match(res.failureReason ?? '', /line count reduced/i);
  });

  it('rejects elimination of enclosing function declaration', () => {
    const original = [
      'export function setupNavigationModal() {',
      '  const modal = document.querySelector("#modal");',
      '  modal.classList.add("visible");',
      '}',
    ].join('\n');

    const patched = [
      '// completely gutted without the setupNavigationModal function',
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
    ].join('\n');

    const res = checkStructuralIntegrity(original, patched, 'src/nav.ts');
    assert.strictEqual(res.passed, false);
    assert.match(res.failureReason ?? '', /all functions and classes removed/i);
  });
});

describe('validateFixPatch (3-Gate Grader)', () => {
  const dialogFixture = getSeededSensitivityTestCases().find(
    (fx) => fx.guideId === 'dialog',
  )!;

  it('Gate 1 fails on no-op patch (legacy finding remains)', async () => {
    const patch: FixPatch = {
      filePath: dialogFixture.filePath,
      originalContent: dialogFixture.originalContent,
      patchedContent: dialogFixture.noOpPatch,
      guideId: dialogFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate1.passed, false);
    assert.ok(res.gate1.findingsRemaining > 0);
  });

  it('Gate 2a fails on syntax error', async () => {
    const patch: FixPatch = {
      filePath: 'src/dialog.ts',
      originalContent: dialogFixture.originalContent,
      patchedContent: 'export function openDialog() { dialog.showModal(; }',
      guideId: 'dialog',
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.syntaxClean, false);
  });

  it('Gate 2b fails on gutting / deletion', async () => {
    const patch: FixPatch = {
      filePath: dialogFixture.filePath,
      originalContent: dialogFixture.originalContent,
      patchedContent: '',
      guideId: dialogFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.structuralIntegrityPassed, false);
  });

  it('Gate 2c fails on evasion without modern feature', async () => {
    const patch: FixPatch = {
      filePath: dialogFixture.filePath,
      originalContent: dialogFixture.originalContent,
      patchedContent: dialogFixture.brokenSyntaxOrEvasionPatch,
      guideId: dialogFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.modernFeatureVerified, false);
  });

  it('Gate 3 fails when behavioralCheck callback fails', async () => {
    const patch: FixPatch = {
      filePath: dialogFixture.filePath,
      originalContent: dialogFixture.originalContent,
      patchedContent: dialogFixture.goodPatch,
      guideId: dialogFixture.guideId,
    };

    const res = await validateFixPatch(patch, {
      behavioralCheck: () => false,
    });
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate1.passed, true);
    assert.strictEqual(res.gate2.passed, true);
    assert.strictEqual(res.gate3.passed, false);
    assert.strictEqual(res.gate3.status, 'FAILED');
  });

  it('passes all 3 gates on reference good patch', async () => {
    const patch: FixPatch = {
      filePath: dialogFixture.filePath,
      originalContent: dialogFixture.originalContent,
      patchedContent: dialogFixture.goodPatch,
      guideId: dialogFixture.guideId,
    };

    const res = await validateFixPatch(patch, {
      behavioralCheck: () => true,
    });
    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.gate1.passed, true);
    assert.strictEqual(res.gate2.passed, true);
    assert.strictEqual(res.gate3.passed, true);
    assert.strictEqual(res.gate3.status, 'PASSED');
  });
});

describe('runBadPatchSensitivitySuite', () => {
  it('covers all 25 qualified guides', () => {
    const fixtures = getSeededSensitivityTestCases();
    assert.strictEqual(fixtures.length, 25);
    const fixtureGuideIds = new Set(fixtures.map((f) => f.guideId));
    for (const gid of QUALIFIED_GUIDE_IDS) {
      assert.ok(fixtureGuideIds.has(gid), `Missing fixture for qualified guide ${gid}`);
    }
  });

  it('achieves 100% bad patch rejection rate and 100% good patch pass rate', async () => {
    const report = await runBadPatchSensitivitySuite();
    assert.strictEqual(
      report.badPatchRejectionRate,
      1.0,
      `Bad patch rejection rate must be 1.0 (got ${report.badPatchRejectionRate}). Violations: ${JSON.stringify(report.violations)}`,
    );
    assert.strictEqual(report.badPatchesRejected, 75);
    assert.strictEqual(report.badPatchesTotal, 75);
    assert.strictEqual(
      report.goodPatchPassRate,
      1.0,
      `Good patch pass rate must be 1.0 (got ${report.goodPatchPassRate}). Violations: ${JSON.stringify(report.violations)}`,
    );
    assert.strictEqual(report.goodPatchesPassed, 25);
    assert.strictEqual(report.goodPatchesTotal, 25);
    assert.strictEqual(report.violations.length, 0);
  });
});
