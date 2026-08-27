import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  cleanText,
  parseVerifiableExpectations,
  extractTestTitles,
  validateGraderExpectationCoverage,
  formatCoverageFailureMessage,
} from './grader-coverage.ts';
import { rootDir } from './paths.ts';

describe('Grader Coverage Validation Utility', () => {
  it('cleans test names and expectations properly', () => {
    assert.strictEqual(cleanText('1. Output must never be set via innerHTML'), 'Output must never be set via innerHTML');
    assert.strictEqual(cleanText('- should have `interpolate-size: allow-keywords`'), 'have interpolate-size: allow-keywords');
    assert.strictEqual(cleanText('* Should use `onINP` for metric collection'), 'use onINP for metric collection');
  });

  it('parses only top-level expectations and ignores sub-bullets', () => {
    const sample = `# Header
- Top level 1
  - Sub bullet A
  - Sub bullet B
- Top level 2
  * Sub bullet C
- DO NOT assume specific class names
`;
    const parsed = parseVerifiableExpectations(sample);
    assert.deepStrictEqual(parsed, ['Top level 1', 'Top level 2']);
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
    const tempFile = path.join(rootDir, 'lib', 'temp-test-titles.ts');
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
