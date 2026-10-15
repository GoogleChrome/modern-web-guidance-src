import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkModernFeaturePresent,
  checkStructuralIntegrity,
  checkSyntaxCleanliness,
  getSeededSensitivityTestCases,
  locateFindingLineInContent,
  runBadPatchSensitivitySuite,
  validateFixPatch,
  type FixPatch,
} from './fix-harness.ts';
import { QUALIFIED_GUIDE_IDS } from './rules/index.ts';

describe('locateFindingLineInContent', () => {
  it('extracts line number from cursor marker in codeSnippet', () => {
    const file = Array.from({ length: 900 }, (_, i) => `.rule-${i + 1} { color: red; }`).join('\n');
    const snippet = `   803 | .rule-803 { color: red; }\n>  804 | .rule-804 { transform: rotate(15deg); }\n   805 | .rule-805 { color: red; }`;
    const line = locateFindingLineInContent(file, 1, snippet);
    assert.strictEqual(line, 804);
  });

  it('falls back to locating distinctive code line in content', () => {
    const file = Array.from({ length: 50 }, (_, i) => `// line ${i + 1}`).join('\n') +
      '\n.card:hover { transform: rotate(15deg) scale(1.1); }\n' +
      Array.from({ length: 50 }, (_, i) => `// end line ${i + 1}`).join('\n');
    const snippet = `.card:hover { transform: rotate(15deg) scale(1.1); }`;
    const line = locateFindingLineInContent(file, 1, snippet);
    assert.strictEqual(line, 51);
  });
});

describe('checkModernFeaturePresent', () => {
  it('detects customize-scrollbar-color-and-thickness feature correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent(
        'customize-scrollbar-color-and-thickness',
        'body { scrollbar-width: thin; scrollbar-color: #888 transparent; }',
      ),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent(
        'customize-scrollbar-color-and-thickness',
        'body { width: 100px; }',
      ),
      false,
    );
  });

  it('detects shadow-dom templates correctly', () => {
    assert.strictEqual(
      checkModernFeaturePresent('shadow-dom', '<template shadowrootmode="open"><div>shadow</div></template>'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('shadow-dom', '<template id="my-tpl"><div>content</div></template>'),
      true,
    );
  });

  it('detects accessible error announcements across css and html', () => {
    assert.strictEqual(
      checkModernFeaturePresent('accessible-error-announcement', 'input:user-invalid { border-color: red; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('accessible-error-announcement', 'input[aria-invalid="true"] { border-color: red; }'),
      false,
    );
    assert.strictEqual(
      checkModernFeaturePresent('accessible-error-announcement', '<div role="alert">Error</div>'),
      true,
    );
  });

  it('detects dark-mode color-scheme variants', () => {
    assert.strictEqual(
      checkModernFeaturePresent('dark-mode', ':root { color-scheme: light dark; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dark-mode', 'body { color-scheme: dark; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dark-mode', 'body { color: light-dark(#fff, #000); }'),
      true,
    );
  });

  it('detects field-sizing content in css and js', () => {
    assert.strictEqual(
      checkModernFeaturePresent('form-fields-automatically-fit-contents', 'textarea { field-sizing: content; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('form-fields-automatically-fit-contents', 'el.style.fieldSizing = "content";'),
      true,
    );
  });

  it('detects branded-select-styling base-select in css and js', () => {
    assert.strictEqual(
      checkModernFeaturePresent('branded-select-styling', 'select { appearance: base-select; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('branded-select-styling', 'select::picker(select) { background: white; }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('branded-select-styling', 'el.style.appearance = "base-select";'),
      true,
    );
  });

  it('detects popover and anchor positioning methods', () => {
    assert.strictEqual(
      checkModernFeaturePresent('resilient-context-menus-and-nested-dropdowns', '<div popover="auto">Menu</div>'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('resilient-context-menus-and-nested-dropdowns', 'menuEl.showPopover();'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('resilient-context-menus-and-nested-dropdowns', '.menu { position-anchor: --my-anchor; }'),
      true,
    );
  });

  it('detects declarative dialog control commandfor and popovertarget', () => {
    assert.strictEqual(
      checkModernFeaturePresent('declarative-dialog-popover-control', '<button commandfor="dialog-1" command="show-modal">Open</button>'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('declarative-dialog-popover-control', '<button popovertarget="menu-1">Menu</button>'),
      true,
    );
  });

  it('detects entry exit animations with starting-style and allow-discrete', () => {
    assert.strictEqual(
      checkModernFeaturePresent('animate-element-entry-exit', '@starting-style { .el { opacity: 0; } }'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('animate-element-entry-exit', 'transition: display 0.3s allow-discrete;'),
      true,
    );
    assert.strictEqual(
      checkModernFeaturePresent('animate-element-entry-exit', 'transition-behavior: allow-discrete;'),
      true,
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

  it('rejects comment-only feature spoofs in Gate 2c (G15)', () => {
    assert.strictEqual(
      checkModernFeaturePresent('brand-consistent-forms', '/* accent-color: #0070f3; */ input { margin: 0; }'),
      false,
    );
    assert.strictEqual(
      checkModernFeaturePresent('manage-recurring-intervals', '// Temporal.PlainDate.from("2026-10-15")\nconst d = new Date();'),
      false,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dark-mode', '/* color-scheme: dark; */ body { background: #000; }'),
      false,
    );
    assert.strictEqual(
      checkModernFeaturePresent('dark-mode', ':root { color-scheme: light; }'),
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

  it('passes on valid TSX React component without throwing TS17004 (G13)', () => {
    const tsxCode = `
import React from 'react';
export function ModalButton({ label }: { label: string }) {
  return <button popovertarget="my-modal">{label}</button>;
}
`;
    const res = checkSyntaxCleanliness('src/components/ModalButton.tsx', tsxCode);
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

  it('allows concise standard replacements (43 lines down to 5 lines per G14)', () => {
    const original = Array.from({ length: 43 }, (_, i) => `<script type="text/template" id="tpl-${i}">line ${i}</script>`).join('\n');
    const patched = `<template shadowrootmode="open">\n  <div>Modern content</div>\n</template>`;

    const res = checkStructuralIntegrity(original, patched, 'src/component.html');
    assert.strictEqual(res.passed, true);
  });

  it('rejects patch when comments are stripped to empty content (G17)', () => {
    const original = `export function calc() { return 42; }`;
    const patched = `// just a comment\n/* another comment */\n`;

    const res = checkStructuralIntegrity(original, patched, 'src/calc.ts');
    assert.strictEqual(res.passed, false);
    assert.match(res.failureReason ?? '', /no executable code/i);
  });

  it('rejects elimination of all exported module declarations (G17)', () => {
    const original = [
      'export function setupNavigationModal() {',
      '  const modal = document.querySelector("#modal");',
      '  modal.classList.add("visible");',
      '}',
    ].join('\n');

    const patched = [
      '// stripped exports, only internal consts remain',
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
    ].join('\n');

    const res = checkStructuralIntegrity(original, patched, 'src/nav.ts');
    assert.strictEqual(res.passed, false);
    assert.match(res.failureReason ?? '', /all exported module symbols were removed/i);
  });
});

describe('validateFixPatch (3-Gate Grader)', () => {
  const foundFixture = getSeededSensitivityTestCases().find(
    (fx) => fx.guideId === 'break-up-long-tasks',
  );
  if (!foundFixture) {
    throw new Error('break-up-long-tasks fixture missing from seeded sensitivity cases');
  }
  const testFixture = foundFixture;

  it('Gate 1 fails on no-op patch (legacy finding remains)', async () => {
    const patch: FixPatch = {
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: testFixture.noOpPatch,
      guideId: testFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate1.passed, false);
    assert.ok(res.gate1.findingsRemaining > 0);
  });

  it('Gate 2a fails on syntax error', async () => {
    const patch: FixPatch = {
      filePath: 'src/scheduler.ts',
      originalContent: testFixture.originalContent,
      patchedContent: 'export function broken() { scheduler.yield(; }',
      guideId: testFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.syntaxClean, false);
  });

  it('Gate 2b fails on gutting / deletion', async () => {
    const patch: FixPatch = {
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: '',
      guideId: testFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.structuralIntegrityPassed, false);
  });

  it('Gate 2c fails on evasion without modern feature', async () => {
    const patch: FixPatch = {
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: testFixture.brokenSyntaxOrEvasionPatch,
      guideId: testFixture.guideId,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate2.passed, false);
    assert.strictEqual(res.gate2.modernFeatureVerified, false);
  });

  it('Gate 3 fails when behavioralCheck callback fails', async () => {
    const patch: FixPatch = {
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: testFixture.goodPatch,
      guideId: testFixture.guideId,
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
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: testFixture.goodPatch,
      guideId: testFixture.guideId,
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

  it('evaluates Gate 1 on patchedWindow when provided for windowed refactoring', async () => {
    const patch: FixPatch = {
      filePath: testFixture.filePath,
      originalContent: testFixture.originalContent,
      patchedContent: testFixture.goodPatch,
      guideId: testFixture.guideId,
      originalWindow: testFixture.originalContent,
      patchedWindow: testFixture.goodPatch,
    };

    const res = await validateFixPatch(patch);
    assert.strictEqual(res.staticResolved, true);
    assert.strictEqual(res.resolved, false);
    assert.strictEqual(res.gate1.passed, true);
    assert.strictEqual(res.gate3.status, 'SKIPPED_NO_TEST_HARNESS');
  });
});

describe('runBadPatchSensitivitySuite', () => {
  it('covers all 25 qualified guides', async (t) => {
    const fixtures = getSeededSensitivityTestCases();
    assert.strictEqual(fixtures.length, 25);
    const fixtureGuideIds = new Set(fixtures.map((f) => f.guideId));
    for (const gid of QUALIFIED_GUIDE_IDS) {
      await t.test(`fixture for ${gid}`, () => {
        assert.ok(fixtureGuideIds.has(gid), `Missing fixture for qualified guide ${gid}`);
      });
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
