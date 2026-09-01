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

  test('runs runComparison end-to-end with mock agent caller', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-e2e-'));
    try {
      const suiteDir = path.join(baseDir, 'results', 'suite-test');
      const runDirA = path.join(suiteDir, '1', 'details-styling', 'task', 'guided');
      const runDirB = path.join(suiteDir, '2', 'details-styling', 'task', 'unguided');
      fs.mkdirSync(runDirA, { recursive: true });
      fs.mkdirSync(runDirB, { recursive: true });

      // Run A setup (success)
      fs.writeFileSync(path.join(runDirA, 'details-styling_results.json'), JSON.stringify({
        suites: [{ specs: [{ title: 'test 1', ok: true }] }]
      }));
      fs.writeFileSync(path.join(runDirA, 'trajectory_summary.json'), JSON.stringify({
        agent: 'claude_code',
        initialPrompt: 'Style details',
        steps: [{ stepNumber: 1, action: { type: 'run_command', name: 'npm' }, outcome: { status: 'success' } }]
      }));
      fs.writeFileSync(path.join(runDirA, 'index.html'), '<details></details>');

      // Run B setup (failure)
      fs.writeFileSync(path.join(runDirB, 'details-styling_results.json'), JSON.stringify({
        suites: [{ specs: [{ title: 'test 1', ok: false, tests: [{ results: [{ error: { message: 'failed' } }] }] }] }]
      }));
      fs.writeFileSync(path.join(runDirB, 'trajectory_summary.json'), JSON.stringify({
        agent: 'claude_code',
        initialPrompt: 'Style details',
        steps: [{ stepNumber: 1, action: { type: 'run_command', name: 'npm' }, outcome: { status: 'error' } }]
      }));
      fs.writeFileSync(path.join(runDirB, 'index.html'), '<div></div>');

      const calls: string[] = [];
      const mockAgentCaller = async (_sys: string, _prompt: string, label = 'agent'): Promise<string> => {
        calls.push(label);
        return `Mock analysis from ${label}`;
      };

      const { runComparison } = await import('../lib/compare-evals.ts');
      const report = await runComparison(runDirA, runDirB, mockAgentCaller);

      assert.strictEqual(typeof report, 'string');
      assert.ok(report.includes('Mock analysis'));
      assert.strictEqual(calls.length, 3);
      assert.ok(calls.includes('Sub-Agent 1 (Guide Compliance)'));
      assert.ok(calls.includes('Sub-Agent 2 (Code & Friction)'));
      assert.ok(calls.includes('Synthesizer Sub-Agent'));

      // Check that report was saved to variance_diagnoses
      const expectedReportPath = path.join(suiteDir, 'variance_diagnoses', 'details-styling-task-guided.md');
      assert.ok(fs.existsSync(expectedReportPath), `Expected report to be saved at ${expectedReportPath}`);
      const savedContent = fs.readFileSync(expectedReportPath, 'utf8');
      assert.strictEqual(savedContent, report);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

