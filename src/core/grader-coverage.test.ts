import { describe, it } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import {
  cleanText,
  parseVerifiableExpectations,
  extractTestTitles,
  validateGraderExpectationCoverage,
  formatCoverageFailureMessage,
} from './grader-coverage.ts';

describe('Grader Coverage Validation Utility', () => {
  it('cleans test names and expectations properly', () => {
    assert.strictEqual(cleanText('1. Output must never be set via innerHTML'), 'Output must never be set via innerHTML');
    assert.strictEqual(cleanText('- should have `interpolate-size: allow-keywords`'), 'have interpolate-size: allow-keywords');
    assert.strictEqual(cleanText('* Should use `onINP` for metric collection'), 'use onINP for metric collection');
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

  it('validates target graders independently against expectations', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grader-coverage-'));
    const expPath = path.join(tmpDir, 'expectations.md');
    const dailyGrindGrader = path.join(tmpDir, 'daily-grind-grader.ts');
    const devtoolsTimesGrader = path.join(tmpDir, 'devtools-times-grader.ts');

    fs.writeFileSync(
      expPath,
      [
        '1. The `Translator` API should be available in the browser on `window.Translator`, but not on `window.ai.translator`.',
        '1. The `Translator.availability()` function must be called with both `sourceLanguage` and `targetLanguage` options.',
        '1. The `Translator.availability()` function should return `available` or `downloadable` or `downloading` or `unavailable`.',
        '1. The same `sourceLanguage` and `targetLanguage` options should be passed to both `Translator.availability()` and `Translator.create()`.',
        "1. The `Translator` instance's `translate()` or `translateStreaming()` method should be used to generate a translation.",
        '1. A monitor for download progress should be implemented using the `downloadprogress` event.',
      ].join('\n'),
    );

    fs.writeFileSync(
      dailyGrindGrader,
      [
        "test('Translator API is accessed via global Translator and not deprecated window.ai.translator', () => {});",
        "test('Translator.availability() is called with sourceLanguage and targetLanguage options', () => {});",
        "test('Translator.availability() return statuses are handled (available, downloadable, downloading, unavailable)', () => {});",
        "test('Same sourceLanguage and targetLanguage options are passed to Translator.create() and Translator.availability()', () => {});",
        "test('Translator instance translate() or translateStreaming() method is used to generate a translation', () => {});",
        "test('Monitor for download progress is implemented using the downloadprogress event', () => {});",
      ].join('\n'),
    );

    fs.writeFileSync(
      devtoolsTimesGrader,
      [
        "test('The Translator API should be available on window.Translator and not on window.ai.translator', () => {});",
        "test('The Translator.availability() function must be called with both sourceLanguage and targetLanguage options', () => {});",
        "test('The Translator.availability() function should return available or downloadable or downloading or unavailable', () => {});",
        "test('The same sourceLanguage and targetLanguage options should be passed to both Translator.availability() and Translator.create()', () => {});",
        `test("The Translator instance's translate() or translateStreaming() method should be used to generate a translation", () => {});`,
        "test('A monitor for download progress should be implemented using the downloadprogress event', () => {});",
      ].join('\n'),
    );

    try {
      const res1 = await validateGraderExpectationCoverage(expPath, dailyGrindGrader);
      assert.strictEqual(res1.isComplete, true, `daily-grind target grader should cover all expectations: ${JSON.stringify(res1.missing)}`);

      const res2 = await validateGraderExpectationCoverage(expPath, devtoolsTimesGrader);
      assert.strictEqual(res2.isComplete, true, `devtools-times target grader should cover all expectations: ${JSON.stringify(res2.missing)}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
    const fakeResult = {
      isComplete: false,
      graderPath: '/root/guides/cat/my-guide/targets/daily-grind/grader.ts',
      expectationsPath: '/root/guides/cat/my-guide/expectations.md',
      matches: [],
      missing: [
        {
          expectation: 'The component wrapper MUST have container-type: inline-size applied.',
          isCovered: false,
          bestMatchTest: 'should animate smoothly on click',
          similarity: 0.22,
        },
      ],
    };

    const msg = formatCoverageFailureMessage(fakeResult, '/root');
    assert.ok(msg.includes('❌ Uncovered expectation(s) found in grader: guides/cat/my-guide/targets/daily-grind/grader.ts'));
    assert.ok(msg.includes('The component wrapper MUST have container-type: inline-size applied.'));
    assert.ok(msg.includes('Closest test found: "should animate smoothly on click" (similarity: 0.22)'));
    assert.ok(msg.includes('Add a test case verifying this behavior'));
    assert.ok(msg.includes('Update/rephrase the test name in guides/cat/my-guide/targets/daily-grind/grader.ts'));
  });
});
