import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  cleanText,
  parseVerifiableExpectations,
  extractTestTitles,
  extractManifestEntries,
  validateGraderExpectationCoverage,
  formatCoverageFailureMessage,
} from './grader-coverage.ts';
import { rootDir } from './paths.ts';

describe('Grader Coverage Validation Utility', () => {
  it('cleans test names and expectations properly', () => {
    assert.strictEqual(cleanText('1. Output must never be set via innerHTML'), 'Output must never be set via innerHTML');
    assert.strictEqual(cleanText('- should have `interpolate-size: allow-keywords`'), 'have interpolate-size: allow-keywords');
    assert.strictEqual(cleanText('* Should use `onINP` for metric collection'), 'use onINP for metric collection');
    assert.strictEqual(cleanText('Expectation 6: The implementation uses :not()'), 'The implementation uses :not()');
  });

  it('parses top-level expectations and combines indented sub-bullets into their parent', () => {
    const sample = `# Header
- Top level 1
  - Sub bullet A
  - Sub bullet B
- Top level 2
  * Sub bullet C
- DO NOT assume specific class names
`;
    const parsed = parseVerifiableExpectations(sample);
    assert.deepStrictEqual(parsed, [
      'Top level 1 Sub bullet A Sub bullet B',
      'Top level 2 Sub bullet C',
      'DO NOT assume specific class names',
    ]);
  });

  it('extracts test titles from Playwright test blocks', () => {
    const sampleCode = `
import { test, expect } from '@playwright/test';
test('First assertion test', async () => {});
test.only("Second assertion test", () => {});
test(\`Third assertion template\`, async () => {});
test.describe('Suite', () => {
  test('Nested test', () => {});
});
`;
    const tempFile = path.join(import.meta.dirname, 'temp-test-titles.ts');
    fs.writeFileSync(tempFile, sampleCode);
    try {
      const titles = extractTestTitles(tempFile);
      assert.deepStrictEqual(titles, [
        'First assertion test',
        'Second assertion test',
        'Third assertion template',
        'Nested test',
      ]);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('validates translator target graders independently against expectations', async () => {
    const expPath = path.join(rootDir, 'guides', 'built-in-ai', 'translator', 'expectations.md');
    const dailyGrindGrader = path.join(rootDir, 'guides', 'built-in-ai', 'translator', 'targets', 'daily-grind', 'grader.ts');
    const devtoolsTimesGrader = path.join(rootDir, 'guides', 'built-in-ai', 'translator', 'targets', 'devtools-times', 'grader.ts');

    if (!fs.existsSync(expPath) || !fs.existsSync(dailyGrindGrader)) return;

    const res1 = await validateGraderExpectationCoverage(expPath, dailyGrindGrader);
    assert.strictEqual(res1.isComplete, true, `daily-grind target grader should cover all expectations: ${JSON.stringify(res1.missing)}`);

    if (fs.existsSync(devtoolsTimesGrader)) {
      const res2 = await validateGraderExpectationCoverage(expPath, devtoolsTimesGrader);
      assert.strictEqual(res2.isComplete, true, `devtools-times target grader should cover all expectations: ${JSON.stringify(res2.missing)}`);
    }
  });

  it('handles multiline test titles in extractTestTitles', () => {
    const sampleCode = `
import { test } from '@playwright/test';
test(
  \`Multiline test title
  with whitespace\`,
  async () => {}
);
`;
    const tempFile = path.join(import.meta.dirname, 'temp-multiline-titles.ts');
    fs.writeFileSync(tempFile, sampleCode);
    try {
      const titles = extractTestTitles(tempFile);
      assert.deepStrictEqual(titles, ['Multiline test title with whitespace']);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('handles non-existent files gracefully in validateGraderExpectationCoverage', async () => {
    const res = await validateGraderExpectationCoverage('/non/existent/exp.md', '/non/existent/grader.ts');
    assert.strictEqual(res.isComplete, true);
    assert.deepStrictEqual(res.matches, []);
    assert.deepStrictEqual(res.missing, []);
  });

  it('marks all expectations missing when grader has zero tests', async () => {
    const tempExp = path.join(import.meta.dirname, 'temp-zero-test-exp.md');
    const tempGrader = path.join(import.meta.dirname, 'temp-zero-test-grader.ts');
    fs.writeFileSync(tempExp, '- Expectation 1\n- Expectation 2\n');
    fs.writeFileSync(tempGrader, '// No test() calls here\n');

    try {
      const res = await validateGraderExpectationCoverage(tempExp, tempGrader);
      assert.strictEqual(res.isComplete, false);
      assert.strictEqual(res.missing.length, 2);
      assert.strictEqual(res.missing[0].expectation, 'Expectation 1');
      assert.strictEqual(res.missing[0].isCovered, false);
      assert.strictEqual(res.missing[1].expectation, 'Expectation 2');
      assert.strictEqual(res.missing[1].isCovered, false);
    } finally {
      if (fs.existsSync(tempExp)) fs.unlinkSync(tempExp);
      if (fs.existsSync(tempGrader)) fs.unlinkSync(tempGrader);
    }
  });

  it('formats actionable failure messages when expectations are uncovered', () => {
    const missingItem = {
      expectation: 'The component wrapper MUST have container-type: inline-size applied.',
      isCovered: false,
      bestMatchTest: 'should animate smoothly on click',
      similarity: 0.22,
    };
    const fakeResult = {
      isComplete: false,
      graderPath: '/root/guides/cat/my-guide/targets/daily-grind/grader.ts',
      expectationsPath: '/root/guides/cat/my-guide/expectations.md',
      matches: [
        { expectation: 'Exp 1', isCovered: true, bestMatchTest: 'Test 1', similarity: 0.9 },
        { expectation: 'Exp 2', isCovered: true, bestMatchTest: 'Test 2', similarity: 0.9 },
        missingItem,
      ],
      missing: [missingItem],
    };

    const msg = formatCoverageFailureMessage(fakeResult, '/root');
    assert.ok(msg.includes('❌ Uncovered expectation(s) found in grader: guides/cat/my-guide/targets/daily-grind/grader.ts'));
    assert.ok(msg.includes('1. Expectation 3: "The component wrapper MUST have container-type: inline-size applied."'));
    assert.ok(msg.includes('Closest test found: "should animate smoothly on click" (similarity: 0.22)'));
    assert.ok(msg.includes('Add a test case verifying this behavior'));
    assert.ok(msg.includes('Update/rephrase the test name in guides/cat/my-guide/targets/daily-grind/grader.ts'));
    assert.ok(msg.includes('lists all expectations (1..3) and records "// Expectation 3: SKIPPED: <missing precondition>"'));
  });

  it('covers tested expectations and manifest SKIPPED entries with a non-empty reason', async () => {
    const tempExp = path.join(import.meta.dirname, 'temp-skip-reason-exp.md');
    const tempGrader = path.join(import.meta.dirname, 'temp-skip-reason-grader.ts');
    fs.writeFileSync(
      tempExp,
      [
        '- The overlay is a `<dialog>` with a non-empty accessible name.',
        '- When a dialog guards unsaved form changes, it has `closedby="none"`.',
        '- A non-modal dialog panel leaves the page behind it interactive.',
      ].join('\n')
    );
    fs.writeFileSync(
      tempGrader,
      [
        '// Expectation 1: TESTED - Verifies dialog accessible name.',
        '// Expectation 2: SKIPPED: The target app and task have no form with unsaved changes.',
        '// - Expectation 3: SKIPPED - The task only builds a modal dialog, not a non-modal panel.',
        "test('The overlay is a <dialog> with a non-empty accessible name', () => {});",
      ].join('\n')
    );

    try {
      const entries = extractManifestEntries(tempGrader);
      assert.strictEqual(entries.get(1)?.status, 'TESTED');
      assert.strictEqual(entries.get(2)?.status, 'SKIPPED');
      assert.strictEqual(entries.get(2)?.reason, 'The target app and task have no form with unsaved changes.');
      assert.strictEqual(entries.get(3)?.status, 'SKIPPED');

      const res = await validateGraderExpectationCoverage(tempExp, tempGrader);
      assert.strictEqual(res.isComplete, true);
      assert.strictEqual(res.missing.length, 0);
      assert.strictEqual(res.matches[0].isCovered, true);
      assert.strictEqual(res.matches[1].isCovered, true);
      assert.strictEqual(res.matches[1].bestMatchTest, 'SKIPPED: The target app and task have no form with unsaved changes.');
      assert.strictEqual(res.matches[2].isCovered, true);
    } finally {
      if (fs.existsSync(tempExp)) fs.unlinkSync(tempExp);
      if (fs.existsSync(tempGrader)) fs.unlinkSync(tempGrader);
    }
  });

  it('fails when a manifest SKIPPED entry has no reason, even if a test title is similar', async () => {
    const tempExp = path.join(import.meta.dirname, 'temp-skip-noreason-exp.md');
    const tempGrader = path.join(import.meta.dirname, 'temp-skip-noreason-grader.ts');
    fs.writeFileSync(
      tempExp,
      [
        '- A modal dialog is opened with `showModal()`.',
        '- A modal dialog closes when Escape is pressed.',
        '- When a dialog guards unsaved form changes, it has `closedby="none"`.',
      ].join('\n')
    );
    fs.writeFileSync(
      tempGrader,
      [
        '// Expectation 1: TESTED - Opens modal dialog with showModal.',
        '// Expectation 2: SKIPPED',
        '// Expectation 3: SKIPPED -   ',
        "test('A modal dialog is opened with showModal() and closes when Escape is pressed', () => {});",
      ].join('\n')
    );

    try {
      const res = await validateGraderExpectationCoverage(tempExp, tempGrader);
      assert.strictEqual(res.isComplete, false);
      assert.strictEqual(res.matches[0].isCovered, true);
      assert.strictEqual(res.matches[1].isCovered, false);
      assert.strictEqual(res.matches[1].bestMatchTest, 'SKIPPED (missing reason)');
      assert.strictEqual(res.matches[2].isCovered, false);
      assert.strictEqual(res.matches[2].bestMatchTest, 'SKIPPED (missing reason)');
      assert.strictEqual(res.missing.length, 2);
    } finally {
      if (fs.existsSync(tempExp)) fs.unlinkSync(tempExp);
      if (fs.existsSync(tempGrader)) fs.unlinkSync(tempGrader);
    }
  });

  it('fails when a manifest SKIPPED entry is in an incomplete manifest that does not list 1..N', async () => {
    const tempExp = path.join(import.meta.dirname, 'temp-skip-incomplete-exp.md');
    const tempGrader = path.join(import.meta.dirname, 'temp-skip-incomplete-grader.ts');
    fs.writeFileSync(
      tempExp,
      [
        '- A modal dialog is opened with `showModal()`.',
        '- When a dialog guards unsaved form changes, it has `closedby="none"`.',
      ].join('\n')
    );
    fs.writeFileSync(
      tempGrader,
      [
        '// Expectation 2: SKIPPED: The target app and task have no form with unsaved changes.',
        "test('A modal dialog is opened with showModal()', () => {});",
      ].join('\n')
    );

    try {
      const res = await validateGraderExpectationCoverage(tempExp, tempGrader);
      assert.strictEqual(res.isComplete, false);
      assert.strictEqual(res.matches[0].isCovered, true);
      assert.strictEqual(res.matches[1].isCovered, false);
      assert.strictEqual(
        res.matches[1].bestMatchTest,
        'SKIPPED, but the manifest lists 1 entries for 2 expectations'
      );
    } finally {
      if (fs.existsSync(tempExp)) fs.unlinkSync(tempExp);
      if (fs.existsSync(tempGrader)) fs.unlinkSync(tempGrader);
    }
  });

  it('validates discipline guide graders without exempting them', async () => {
    const cssExp = path.join(rootDir, 'guides', 'css', 'css', 'expectations.md');
    const cssGrader = path.join(rootDir, 'guides', 'css', 'css', 'targets', 'daily-grind', 'grader.ts');
    const htmlExp = path.join(rootDir, 'guides', 'html', 'html', 'expectations.md');
    const htmlGrader = path.join(rootDir, 'guides', 'html', 'html', 'targets', 'daily-grind', 'grader.ts');
    const secExp = path.join(rootDir, 'guides', 'security', 'security', 'expectations.md');
    const secGrader = path.join(rootDir, 'guides', 'security', 'security', 'targets', 'daily-grind', 'grader.ts');

    for (const p of [cssExp, cssGrader, htmlExp, htmlGrader, secExp, secGrader]) {
      assert.ok(fs.existsSync(p), `expected file to exist: ${p}`);
    }

    const cssRes = await validateGraderExpectationCoverage(cssExp, cssGrader);
    assert.strictEqual(cssRes.isComplete, true, `css discipline grader should pass coverage: ${JSON.stringify(cssRes.missing)}`);

    const htmlRes = await validateGraderExpectationCoverage(htmlExp, htmlGrader);
    assert.strictEqual(htmlRes.isComplete, true, `html discipline grader should pass coverage: ${JSON.stringify(htmlRes.missing)}`);

    const secRes = await validateGraderExpectationCoverage(secExp, secGrader);
    assert.strictEqual(secRes.isComplete, true, `security discipline grader should pass coverage: ${JSON.stringify(secRes.missing)}`);
  });

  it('allows a leaf guide grader to skip expectations whose preconditions are absent from the target app or task', async () => {
    const tempExp = path.join(import.meta.dirname, 'temp-leaf-dialog-exp.md');
    const tempGrader = path.join(import.meta.dirname, 'temp-leaf-dialog-grader.ts');
    fs.writeFileSync(
      tempExp,
      [
        '- The overlay is a `<dialog>` with a non-empty accessible name (`aria-labelledby` or `aria-label`).',
        '- A modal dialog is opened with `showModal()` or `command="show-modal"`, and `:modal` matches while it is open.',
        '- Focus returns to the invoking element when a modal dialog closes.',
        '- Pressing Esc closes an open modal dialog unless `closedby="none"` is set.',
        '- When light dismiss is requested on a dialog, clicking the backdrop closes it.',
        '- A backdrop-click fallback, if present, does not close the dialog when a press starts inside the dialog and ends on the backdrop.',
        '- When a dialog guards unsaved form changes, it has `closedby="none"` or cancels the `cancel` event before closing.',
        '- When a dialog guards unsaved form changes, attempting to dismiss it prompts or warns before discarding edits.',
        '- A non-modal dialog panel is opened with `show()` and leaves the page behind it interactive.',
        '- While a modal dialog is open, content outside it is not focusable.',
        '- No `<dialog>` has `role="dialog"` or `aria-modal`.',
        '- While a modal dialog is open, scrolling over its backdrop or inside it does not scroll the page behind it.',
      ].join('\n')
    );
    fs.writeFileSync(
      tempGrader,
      [
        '// Expectation 1: TESTED - Dialog has non-empty accessible name',
        '// Expectation 2: TESTED - Modal dialog opened with showModal() or command="show-modal"',
        '// Expectation 3: TESTED - Focus returns to invoking element on close',
        '// Expectation 4: TESTED - Pressing Esc closes open modal dialog',
        '// Expectation 5: TESTED - Clicking backdrop closes dialog when light dismiss is requested',
        '// Expectation 6: TESTED - Backdrop-click fallback tracks press and release',
        '// Expectation 7: SKIPPED: The daily-grind task only builds a read-only drink details modal without unsaved form edits.',
        '// Expectation 8: SKIPPED: The daily-grind task only builds a read-only drink details modal without unsaved form edits.',
        '// Expectation 9: SKIPPED: The daily-grind task only requests a modal dialog, not a non-modal dialog panel.',
        '// Expectation 10: TESTED - Content outside open modal dialog is not focusable',
        '// Expectation 11: TESTED - No <dialog> has redundant role="dialog" or aria-modal',
        '// Expectation 12: TESTED - Scrolling over backdrop or inside modal dialog does not scroll page behind it',
        "test('The overlay is a <dialog> with a non-empty accessible name (aria-labelledby or aria-label)', () => {});",
        "test('A modal dialog is opened with showModal() or command=\"show-modal\", and :modal matches while it is open', () => {});",
        "test('Focus returns to the invoking element when a modal dialog closes', () => {});",
        "test('Pressing Esc closes an open modal dialog unless closedby=\"none\" is set', () => {});",
        "test('When light dismiss is requested on a dialog, clicking the backdrop closes it', () => {});",
        "test('A backdrop-click fallback, if present, does not close the dialog when a press starts inside the dialog and ends on the backdrop', () => {});",
        "test('While a modal dialog is open, content outside it is not focusable', () => {});",
        "test('No <dialog> has role=\"dialog\" or aria-modal', () => {});",
        "test('While a modal dialog is open, scrolling over its backdrop or inside it does not scroll the page behind it', () => {});",
      ].join('\n')
    );

    try {
      const res = await validateGraderExpectationCoverage(tempExp, tempGrader);
      assert.strictEqual(res.isComplete, true, `leaf dialog grader with skips should pass coverage: ${JSON.stringify(res.missing)}`);
      assert.strictEqual(res.matches[6].isCovered, true);
      assert.ok(res.matches[6].bestMatchTest.startsWith('SKIPPED:'));
      assert.strictEqual(res.matches[7].isCovered, true);
      assert.strictEqual(res.matches[8].isCovered, true);
    } finally {
      if (fs.existsSync(tempExp)) fs.unlinkSync(tempExp);
      if (fs.existsSync(tempGrader)) fs.unlinkSync(tempGrader);
    }
  });
});
