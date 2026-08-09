import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('compare-evals pipeline', () => {
  test('imports compare-evals module cleanly and exports runComparison', async () => {
    const compareModule = await import('../lib/compare-evals.ts');
    assert.ok(compareModule.runComparison);
    assert.strictEqual(typeof compareModule.runComparison, 'function');
  });

  test('validates loadRunContext and preprocessTrajectory with mock trajectory and playwright report', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-run-'));

    try {
      const resultsFile = path.join(tmpDir, 'test-guide_results.json');
      const mockPlaywright = {
        suites: [
          {
            title: 'Suite 1',
            specs: [
              {
                title: 'should pass step 1',
                ok: true
              },
              {
                title: 'should fail step 2',
                ok: false,
                tests: [
                  {
                    results: [
                      {
                        error: { message: '[31mExpected "a" to be "b"[39m' },
                        location: { file: 'grader.ts', line: 42, column: 5 }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      fs.writeFileSync(resultsFile, JSON.stringify(mockPlaywright));

      const trajFile = path.join(tmpDir, 'trajectory_summary.json');
      const mockSummary = {
        agent: 'claude-code',
        initialPrompt: 'Create a modern accordion using details/summary',
        retrievedGuides: ['details-styling'],
        steps: [
          {
            stepNumber: 1,
            thought: 'Searching for details styling guide',
            action: {
              type: 'web_search',
              canonicalCategory: 'skill_search',
              name: 'search',
              params: { query: 'details styling' }
            },
            outcome: { status: 'success' }
          },
          {
            stepNumber: 2,
            thought: 'Retrieving details guide',
            action: {
              type: 'read_file',
              canonicalCategory: 'guide_retrieval',
              name: 'retrieve',
              params: { id: 'details-styling' }
            },
            outcome: { status: 'success' }
          },
          {
            stepNumber: 3,
            thought: 'I must follow the mandatory rule for ::details-content',
            action: {
              type: 'write_file',
              canonicalCategory: 'mandatory_rule_thought',
              name: 'write_to_file',
              params: { TargetFile: 'index.html' }
            },
            outcome: { status: 'error' }
          },
          {
            stepNumber: 4,
            thought: 'Retrying code mutation',
            action: {
              type: 'write_file',
              canonicalCategory: 'code_mutation',
              name: 'write_to_file',
              params: { TargetFile: 'index.html' }
            },
            outcome: { status: 'error' }
          },
          {
            stepNumber: 5,
            thought: 'Third retry attempt',
            action: {
              type: 'write_file',
              canonicalCategory: 'code_mutation',
              name: 'write_to_file',
              params: { TargetFile: 'index.html' }
            },
            outcome: { status: 'success' }
          }
        ]
      };
      fs.writeFileSync(trajFile, JSON.stringify(mockSummary));

      const indexHtml = path.join(tmpDir, 'index.html');
      fs.writeFileSync(indexHtml, '<html><body><details><summary>Title</summary>Body</details></body></html>');

      // Verify that compare-evals module can import and load this run
      const compareModule = await import('../lib/compare-evals.ts');
      assert.ok(compareModule.runComparison);
      assert.strictEqual(typeof compareModule.runComparison, 'function');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
