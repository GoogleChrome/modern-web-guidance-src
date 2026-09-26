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

  test('extractSearchQuery captures the whole query, not just the first word', async () => {
    const { extractSearchQuery } = await import('../lib/compare-evals.ts');
    const cases: Array<[string, string | undefined]> = [
      ['npx modern-web-guidance search "form validation user-invalid"', 'form validation user-invalid'],
      ["npx modern-web-guidance search 'dialog focus management'", 'dialog focus management'],
      ['npx modern-web-guidance search form validation user-invalid', 'form validation user-invalid'],
      ['npx modern-web-guidance search accordion', 'accordion'],
      ['npx modern-web-guidance search --limit 5 "accordion"', 'accordion'],
      ['npx modern-web-guidance search form validation --limit 5', 'form validation'],
      ['npx modern-web-guidance search \\"scroll driven animations\\"', 'scroll driven animations'],
      ['npx modern-web-guidance retrieve details-styling', undefined],
      ['', undefined]
    ];
    assert.deepStrictEqual(
      cases.map(([cmd]) => extractSearchQuery(cmd)),
      cases.map(([, expected]) => expected)
    );
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
              type: 'run_command',
              canonicalCategory: 'skill_search',
              name: 'bash',
              params: { command: 'npx modern-web-guidance search "details styling"' }
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
              type: 'read_file',
              name: 'view_file',
              params: { AbsolutePath: 'index.html' }
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

      // Verify loadRunContext and preprocessTrajectory
      const { loadRunContext, preprocessTrajectory } = await import('../lib/compare-evals.ts');
      const ctx = loadRunContext(tmpDir);

      assert.strictEqual(ctx.score, 50);
      assert.strictEqual(ctx.resultsJson.length, 2);
      assert.strictEqual(ctx.resultsJson[0].passed, true);
      assert.strictEqual(ctx.resultsJson[1].passed, false);
      assert.ok(ctx.resultsJson[1].errors?.[0]?.includes('Expected "a" to be "b"'));
      assert.strictEqual(ctx.codeOutput, '<html><body><details><summary>Title</summary>Body</details></body></html>');
      assert.strictEqual(ctx.preprocessed.taggedSteps.length, 5);
      assert.strictEqual(ctx.preprocessed.codeMutationCount, 2);
      assert.strictEqual(ctx.preprocessed.errorLoopCount, 1);
      assert.deepStrictEqual(ctx.preprocessed.retrievedGuideIds, ['details-styling']);
      assert.deepStrictEqual(ctx.preprocessed.searchQueries, ['details styling']);
      assert.strictEqual(ctx.preprocessed.mandatoryRulesAdopted.length, 1);
      assert.ok(ctx.preprocessed.mandatoryRulesAdopted[0].includes('mandatory rule'));

      const directPreprocessed = preprocessTrajectory(mockSummary as any);
      assert.strictEqual(directPreprocessed.taggedSteps.length, 5);
      assert.strictEqual(directPreprocessed.codeMutationCount, 2);
      assert.strictEqual(directPreprocessed.errorLoopCount, 1);
      assert.deepStrictEqual(directPreprocessed.retrievedGuideIds, ['details-styling']);
      assert.deepStrictEqual(directPreprocessed.searchQueries, ['details styling']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('stripAgentNarration removes streamed conversational preamble before report headings', async () => {
    const { stripAgentNarration } = await import('../lib/compare-evals.ts');

    const rawWithPrimary = `I will start the investigation by checking the workspace files.\nLet me spawn subagents now.\n\n### 1. First Meaningful Divergence\n- **Step Number**: Trial A Step 2\n\n### 2. Root Cause & Friction Analysis\nDetails here.`;
    assert.strictEqual(
      stripAgentNarration(rawWithPrimary),
      `### 1. First Meaningful Divergence\n- **Step Number**: Trial A Step 2\n\n### 2. Root Cause & Friction Analysis\nDetails here.`
    );

    const rawWithFallbackHeading = `Thinking about the problem...\n### Custom Report Heading\nBody text`;
    assert.strictEqual(stripAgentNarration(rawWithFallbackHeading), `### Custom Report Heading\nBody text`);

    const rawClean = `### 1. First Meaningful Divergence\nDirect output.`;
    assert.strictEqual(stripAgentNarration(rawClean), rawClean);
  });

  test('getComparisonPrompts stays well under Linux MAX_ARG_STRLEN (131KB) even with 33KB guide, large diffs, and 200 steps', async () => {
    const { getComparisonPrompts } = await import('../lib/compare-prompts.ts');
    const MAX_ARG_STRLEN = 131_072;

    const hugeGuideCtx = {
      guideName: 'huge-guide',
      taskName: 'complex-task',
      guideContent: 'G'.repeat(35_000) + '\nMandatory rule details\n' + 'H'.repeat(5_000),
      expectationsContent: 'E'.repeat(15_000),
      taskPrompt: 'T'.repeat(8_000),
      graderContent: 'C'.repeat(30_000),
      baseAppContent: 'B'.repeat(20_000)
    };

    const make200Steps = () =>
      Array.from({ length: 200 }, (_, i) => ({
        stepNumber: i + 1,
        category: (i % 5 === 0 ? 'code_mutation' : 'incidental_noise') as any,
        actionName: i % 5 === 0 ? 'write_to_file' : 'view_file',
        thought: `Step ${i + 1} detailed reasoning thought ${'x'.repeat(120)}`
      }));

    const mockCtxA = {
      dir: '/tmp/results/suite-1/1/huge-guide/complex-task/guided',
      score: 100,
      resultsJson: Array.from({ length: 20 }, (_, i) => ({
        message: `Assertion ${i + 1}`,
        passed: true
      })),
      codeOutput: 'A'.repeat(20_000),
      preprocessed: {
        taggedSteps: make200Steps(),
        searchQueries: ['query 1', 'query 2'],
        retrievedGuideIds: ['huge-guide'],
        mandatoryRulesAdopted: Array.from({ length: 30 }, (_, i) => `Rule ${i}: ${'r'.repeat(100)}`),
        codeMutationCount: 40,
        noiseCount: 160,
        errorLoopCount: 2
      },
      initialPrompt: 'P'.repeat(6_000)
    };

    const mockCtxB = {
      ...mockCtxA,
      dir: '/tmp/results/suite-1/2/huge-guide/complex-task/unguided',
      score: 25,
      resultsJson: Array.from({ length: 20 }, (_, i) => ({
        message: `Assertion ${i + 1}`,
        passed: false,
        errors: [`Failure stack trace ${'F'.repeat(500)}`]
      }))
    };

    const diffBaseVsA = 'D1\n'.repeat(15_000);
    const diffBaseVsB = 'D2\n'.repeat(15_000);
    const diffAvsB = 'D3\n'.repeat(15_000);

    const { systemInstruction, prompt } = getComparisonPrompts(
      hugeGuideCtx,
      mockCtxA,
      mockCtxB,
      diffBaseVsA,
      diffBaseVsB,
      diffAvsB,
      'SUCCESSFUL',
      'FAILED/POORER'
    );

    const combinedPrompt = `${systemInstruction}\n\n${prompt}`;
    const byteLen = Buffer.byteLength(combinedPrompt, 'utf8');

    assert.ok(
      byteLen < 95_000 && byteLen < MAX_ARG_STRLEN,
      `Expected combinedPrompt byte length (${byteLen}) to be < 95,000 and < MAX_ARG_STRLEN (${MAX_ARG_STRLEN})`
    );
    assert.ok(prompt.includes('steps omitted from inline overview'), 'Expected inline steps to be capped with omission notice');
    assert.ok(systemInstruction.includes('Strict Payload-Only Constraint'), 'Expected strict payload-only constraint in systemInstruction');
  });

  test('runs runComparison end-to-end with single unified prompt and isolated workspace', async () => {
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
        normalizerVersion: 2,
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
        normalizerVersion: 2,
        agent: 'claude_code',
        initialPrompt: 'Style details',
        steps: [{ stepNumber: 1, action: { type: 'run_command', name: 'npm' }, outcome: { status: 'error' } }]
      }));
      fs.writeFileSync(path.join(runDirB, 'index.html'), '<div></div>');

      const calls: string[] = [];
      let capturedWorkDir: string | undefined;
      let workspaceContextExistedDuringCall = false;

      const mockAgentCaller = async (_sys: string, _prompt: string, label = 'agent', workDir?: string): Promise<string> => {
        calls.push(label);
        capturedWorkDir = workDir;
        if (workDir && fs.existsSync(path.join(workDir, 'comparison_context.md'))) {
          workspaceContextExistedDuringCall = true;
        }
        return `I will start analyzing the runs now...\n\n### 1. First Meaningful Divergence\nMock analysis from ${label}`;
      };

      const { runComparison, buildComparisonReportPath } = await import('../lib/compare-evals.ts');
      const report = await runComparison(runDirA, runDirB, mockAgentCaller);

      assert.strictEqual(typeof report, 'string');
      assert.ok(report.startsWith('### 1. First Meaningful Divergence'), 'Expected streamed narration to be stripped');
      assert.ok(!report.includes('I will start analyzing'), 'Expected preamble before first heading to be stripped');
      assert.strictEqual(calls.length, 1, 'Expected single unified agent call instead of 3-agent fan-out');
      assert.strictEqual(calls[0], 'Compare Agent');
      assert.ok(workspaceContextExistedDuringCall, 'Expected comparison_context.md to be staged inside isolated workDir');
      assert.ok(capturedWorkDir && !fs.existsSync(capturedWorkDir), 'Expected isolated workDir to be cleaned up after runComparison');

      // Check that report was saved to variance_diagnoses with disambiguated filename
      const expectedReportPath = buildComparisonReportPath(runDirA, runDirB, 'details-styling', 'task');
      assert.strictEqual(
        expectedReportPath,
        path.join(suiteDir, 'variance_diagnoses', 'details-styling-task-1-guided-vs-2-unguided.md')
      );
      assert.ok(fs.existsSync(expectedReportPath), `Expected report to be saved at ${expectedReportPath}`);
      const savedContent = fs.readFileSync(expectedReportPath, 'utf8');
      assert.strictEqual(savedContent, report);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  test('buildComparisonReportPath is deterministic regardless of which run won and avoids collisions', async () => {
    const { buildComparisonReportPath } = await import('../lib/compare-evals.ts');
    const { resultsDir } = await import('../../lib/paths.ts');

    const suiteA = '/repo/harness/results/suite-alpha/1/details-styling/task/guided';
    const suiteB = '/repo/harness/results/suite-beta/1/details-styling/task/guided';
    const suiteA_run2 = '/repo/harness/results/suite-alpha/2/details-styling/task/unguided';
    const suiteA_run3 = '/repo/harness/results/suite-alpha/3/details-styling/task/guided';

    // 1. Cross-suite comparison always saves under ctxA's suiteDir regardless of who won
    const pathCrossSuite = buildComparisonReportPath(suiteA, suiteB, 'details-styling', 'task');
    assert.ok(pathCrossSuite.startsWith('/repo/harness/results/suite-alpha/variance_diagnoses/'));
    assert.ok(pathCrossSuite.includes('suite-alpha-1-guided-vs-suite-beta-1-guided.md'));

    // 2. Comparing A vs B and A vs C produces distinct filenames (no overwrite)
    const pathAvsB = buildComparisonReportPath(suiteA, suiteA_run2, 'details-styling', 'task');
    const pathAvsC = buildComparisonReportPath(suiteA, suiteA_run3, 'details-styling', 'task');
    assert.notStrictEqual(pathAvsB, pathAvsC);

    // 3. Runs outside results/ fall back to resultsDir/variance_diagnoses instead of skipping
    const outsideA = '/tmp/custom-evals/trial-1/details-styling/task/guided';
    const outsideB = '/tmp/custom-evals/trial-2/details-styling/task/unguided';
    const pathOutside = buildComparisonReportPath(outsideA, outsideB, 'details-styling', 'task');
    assert.strictEqual(path.dirname(pathOutside), path.join(resultsDir, 'variance_diagnoses'));
    assert.ok(pathOutside.endsWith('details-styling-task-trial-1-guided-vs-trial-2-unguided.md'));
  });

  test('runs runComparison using agent.patch when present', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-patch-'));
    try {
      const suiteDir = path.join(baseDir, 'results', 'suite-test');
      const runDirA = path.join(suiteDir, '1', 'details-styling', 'task', 'guided');
      const runDirB = path.join(suiteDir, '2', 'details-styling', 'task', 'unguided');
      fs.mkdirSync(runDirA, { recursive: true });
      fs.mkdirSync(runDirB, { recursive: true });

      const patchA = '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-old\n+newA\n';
      const patchB = '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-old\n+newB\n';

      fs.writeFileSync(path.join(runDirA, 'details-styling_results.json'), JSON.stringify({ suites: [{ specs: [{ title: 't1', ok: true }] }] }));
      fs.writeFileSync(path.join(runDirA, 'agent.patch'), patchA);
      fs.writeFileSync(path.join(runDirA, 'trajectory_summary.json'), JSON.stringify({ normalizerVersion: 2, agent: 'codex_cli', initialPrompt: 'Task A', steps: [] }));

      fs.writeFileSync(path.join(runDirB, 'details-styling_results.json'), JSON.stringify({ suites: [{ specs: [{ title: 't1', ok: false }] }] }));
      fs.writeFileSync(path.join(runDirB, 'agent.patch'), patchB);
      fs.writeFileSync(path.join(runDirB, 'trajectory_summary.json'), JSON.stringify({ normalizerVersion: 2, agent: 'codex_cli', initialPrompt: 'Task B', steps: [] }));

      let capturedPrompt = '';
      const mockAgentCaller = async (_sys: string, prompt: string, label = 'agent'): Promise<string> => {
        capturedPrompt = prompt;
        return `### 1. First Meaningful Divergence\nReport from ${label}`;
      };

      const { runComparison } = await import('../lib/compare-evals.ts');
      const report = await runComparison(runDirA, runDirB, mockAgentCaller);
      assert.ok(report.includes('Report from Compare Agent'));
      assert.ok(capturedPrompt.includes('+newA'), 'Expected patch A content in prompt');
      assert.ok(capturedPrompt.includes('+newB'), 'Expected patch B content in prompt');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

