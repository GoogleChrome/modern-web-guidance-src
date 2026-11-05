import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResultPath, evaluateScenarioResults } from './collection.ts';
import path from 'path';
import fs from 'fs';
import os from 'os';

test('parseResultPath handles new structure', () => {
  const relPath = path.join('guide-name', 'task-name', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task-name',
    runType: 'guided'
  });
});

test('parseResultPath handles legacy structure', () => {
  const relPath = path.join('guide-name-task', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task',
    runType: 'guided'
  });
});

test('parseResultPath handles legacy negative structure', () => {
  const relPath = path.join('guide-name-task-negative', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task',
    runType: 'guided'
  });
});

test('parseResultPath returns null for invalid structure', () => {
  const relPath = 'guided';
  const result = parseResultPath(relPath);
  assert.strictEqual(result, null);
});

test('parseResultPath handles deep suite and nightly structure', () => {
  const relPath = path.join('nightly-2026-08-10_17-00-02-jetski_cli', '1', 'accessible-error-announcement', 'task', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'accessible-error-announcement',
    taskName: 'task',
    runType: 'guided'
  });
});

test('evaluateScenarioResults splits infra errors (isEarlyFailure: true) from agent-broken apps (0/N checks)', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-denom-test-'));
  try {
    const graderPath = path.join(tempDir, 'grader.ts');
    const graderContent = `
      import { test, expect } from '@playwright/test';
      test('check 1: has header element', async ({ page }) => {});
      test('check 2: form has email input', async ({ page }) => {});
      test('check 3: user-invalid pseudo class applied', async ({ page }) => {});
      test('check 4: aria-invalid synced on blur', async ({ page }) => {});
      test('check 5: error message is announced', async ({ page }) => {});
    `;
    fs.writeFileSync(graderPath, graderContent);

    await t.test('missing target app without generation_failed.json is an agent failure (0/N checks, not isEarlyFailure)', () => {
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        path.join(tempDir, 'results.json'),
        false,
        path.join(tempDir, 'index.html')
      );
      assert.strictEqual(res.length, 5);
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        Array(5).fill({ passed: false, isEarlyFailure: undefined })
      );
      assert.strictEqual(res[0].message, 'check 1: has header element');
      assert.ok(res[0].failureReason?.includes('Target app missing'));
    });

    await t.test('empty suites in grader results JSON without generation_failed.json is an agent failure (0/N checks)', () => {
      const resultsJsonPath = path.join(tempDir, 'results.json');
      fs.writeFileSync(resultsJsonPath, JSON.stringify({ suites: [] }));
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        resultsJsonPath,
        true,
        path.join(tempDir, 'index.html')
      );
      assert.strictEqual(res.length, 5);
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        Array(5).fill({ passed: false, isEarlyFailure: undefined })
      );
      assert.strictEqual(res[0].message, 'check 1: has header element');
      assert.ok(res[0].failureReason?.includes('Playwright test runner failed'));
    });

    await t.test('missing grader results JSON (ENOENT) without generation_failed.json is an agent failure (0/N checks)', () => {
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        path.join(tempDir, 'non_existent_results.json'),
        true,
        path.join(tempDir, 'index.html')
      );
      assert.strictEqual(res.length, 5);
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        Array(5).fill({ passed: false, isEarlyFailure: undefined })
      );
      assert.strictEqual(res[0].message, 'check 1: has header element');
      assert.strictEqual(res[0].failureReason, 'Playwright test runner failed to produce a results file');
    });

    await t.test('crashed or timed-out generation with generation_failed.json is an infra error (single isEarlyFailure entry)', () => {
      fs.writeFileSync(
        path.join(tempDir, 'generation_failed.json'),
        JSON.stringify({ agentName: 'claude_code', exitCode: 'TIMEOUT (10m)' })
      );
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        path.join(tempDir, 'results.json'),
        false, // even when targetAppExists is false, generation_failed.json takes precedence
        path.join(tempDir, 'index.html')
      );
      assert.deepStrictEqual(res, [{
        id: 'early-failure-1',
        passed: false,
        message: 'Generation failed: claude_code exited with TIMEOUT (10m)',
        isEarlyFailure: true,
      }]);
    });

    await t.test('missing grader.ts is an infra error (single isEarlyFailure entry)', () => {
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        path.join(tempDir, 'non_existent_grader.ts'),
        path.join(tempDir, 'results.json'),
        true,
        path.join(tempDir, 'index.html')
      );
      assert.deepStrictEqual(res, [{
        id: 'early-failure-1',
        passed: false,
        message: 'Grader not found',
        isEarlyFailure: true,
      }]);
    });

    await t.test('omits skipped Playwright specs from scenario results instead of counting them as failed', () => {
      const genFail = path.join(tempDir, 'generation_failed.json');
      if (fs.existsSync(genFail)) fs.unlinkSync(genFail);

      const resultsJsonPath = path.join(tempDir, 'skipped_results.json');
      fs.writeFileSync(
        resultsJsonPath,
        JSON.stringify({
          suites: [
            {
              title: 'Target Grader',
              specs: [
                {
                  id: 'spec-1',
                  title: 'Universal check passes',
                  ok: true,
                  tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
                },
                {
                  id: 'spec-2',
                  title: 'Skipped fallback check under limited',
                  ok: true,
                  tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }],
                },
                {
                  id: 'spec-3',
                  title: 'Fallback check fails',
                  ok: false,
                  tests: [{ status: 'unexpected', results: [{ status: 'failed', errors: [{ message: 'Expected fallback' }] }] }],
                },
              ],
            },
          ],
        })
      );

      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        resultsJsonPath,
        true,
        path.join(tempDir, 'index.html')
      );
      assert.strictEqual(res.length, 2);
      assert.strictEqual(res[0].id, 'spec-1');
      assert.strictEqual(res[0].passed, true);
      assert.strictEqual(res[1].id, 'spec-3');
      assert.strictEqual(res[1].passed, false);
    });

    await t.test('returns empty array when every spec in the file is skipped for a baseline target', () => {
      const allSkippedJsonPath = path.join(tempDir, 'all_skipped_results.json');
      fs.writeFileSync(
        allSkippedJsonPath,
        JSON.stringify({
          suites: [
            {
              title: 'Target Grader',
              specs: [
                {
                  id: 'spec-1',
                  title: 'Skipped fallback check',
                  ok: true,
                  tests: [{ status: 'skipped', results: [{ status: 'skipped' }] }],
                },
              ],
            },
          ],
        })
      );

      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        allSkippedJsonPath,
        true,
        path.join(tempDir, 'index.html')
      );
      assert.deepStrictEqual(res, []);
    });

    await t.test('patch apply failure recorded in results.json infraError or un-applicable agent.patch is an infra error', () => {
      const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-patch-fail-'));
      try {
        // Case A: grade.mjs recorded { infraError } in results.json
        const resultsPath = path.join(cleanDir, 'results.json');
        fs.writeFileSync(
          resultsPath,
          JSON.stringify({
            infraError: 'Failed to apply patch /tmp/agent.patch to daily-grind: patch failed at line 4',
            suites: [],
          }),
        );
        const resA = evaluateScenarioResults(
          cleanDir,
          'test-guide',
          graderPath,
          resultsPath,
          true,
          path.join(cleanDir, 'index.html'),
        );
        assert.strictEqual(resA.length, 1);
        assert.strictEqual(resA[0].isEarlyFailure, true);
        assert.match(resA[0].message, /Failed to apply patch/);

        // Case B: results.json is missing (ENOENT) and agent.patch has a contentless binary diff
        fs.unlinkSync(resultsPath);
        fs.writeFileSync(
          path.join(cleanDir, 'agent.patch'),
          'diff --git a/foo.wasm b/foo.wasm\nnew file mode 100644\nindex 0000000..72e7bbc\nBinary files /dev/null and b/foo.wasm differ\n',
        );
        const resB = evaluateScenarioResults(
          cleanDir,
          'test-guide',
          graderPath,
          resultsPath,
          true,
          path.join(cleanDir, 'index.html'),
        );
        assert.strictEqual(resB.length, 1);
        assert.strictEqual(resB[0].isEarlyFailure, true);
        assert.match(resB[0].message, /Failed to apply patch.*Binary files/i);

        // Case C: Gen1 task directory (<guide>/task/guided) resolves real base_app (e.g. devtools-times) from task.md frontmatter
        const gen1Root = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-gen1-task-'));
        try {
          const gen1GuideDir = path.join(gen1Root, 'guide');
          const gen1RunDir = path.join(gen1Root, 'autofill-sign-in-form', 'task', 'guided');
          fs.mkdirSync(gen1GuideDir, { recursive: true });
          fs.mkdirSync(gen1RunDir, { recursive: true });
          const gen1GraderPath = path.join(gen1GuideDir, 'grader.ts');
          fs.writeFileSync(gen1GraderPath, "test('gen1 check', async () => {});\n");
          fs.writeFileSync(
            path.join(gen1GuideDir, 'task.md'),
            '---\nbase_app: devtools-times\n---\n- Update the sign-in form.\n',
          );
          fs.writeFileSync(
            path.join(gen1RunDir, 'agent.patch'),
            '--- a/nonexistent-file-in-devtools-times.xyz\n+++ b/nonexistent-file-in-devtools-times.xyz\n@@ -1,3 +1,3 @@\n-old\n+new\n',
          );
          const resC = evaluateScenarioResults(
            gen1RunDir,
            'autofill-sign-in-form',
            gen1GraderPath,
            path.join(gen1RunDir, 'autofill-sign-in-form_results.json'),
            true,
            path.join(gen1RunDir, 'index.html'),
          );
          assert.strictEqual(resC.length, 1);
          assert.strictEqual(resC[0].isEarlyFailure, true);
          assert.match(resC[0].message, /Failed to apply patch .* to devtools-times/);
        } finally {
          fs.rmSync(gen1Root, { recursive: true, force: true });
        }
      } finally {
        fs.rmSync(cleanDir, { recursive: true, force: true });
      }
    });

    await t.test('grading setup timeout (Fixture ... exceeded during setup) is an infra error, not test failures', () => {
      const timeoutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-setup-timeout-'));
      try {
        const resultsPath = path.join(timeoutDir, 'results.json');
        fs.writeFileSync(
          resultsPath,
          JSON.stringify({
            suites: [
              {
                title: 'grader.ts',
                specs: [
                  {
                    id: 'spec-1',
                    title: 'check 1: has header element',
                    tests: [
                      {
                        results: [
                          {
                            status: 'timedOut',
                            error: {
                              message: '\u001b[31mFixture "_targetServer" timeout of 60000ms exceeded during setup.\u001b[39m',
                            },
                            errors: [
                              {
                                message: '\u001b[31mFixture "_targetServer" timeout of 60000ms exceeded during setup.\u001b[39m',
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        );
        const res = evaluateScenarioResults(
          timeoutDir,
          'test-guide',
          graderPath,
          resultsPath,
          true,
          path.join(timeoutDir, 'index.html'),
        );
        assert.strictEqual(res.length, 1);
        assert.strictEqual(res[0].isEarlyFailure, true);
        assert.match(res[0].message, /Grading setup timed out: Fixture "_targetServer" timeout of 60000ms exceeded during setup/);
      } finally {
        fs.rmSync(timeoutDir, { recursive: true, force: true });
      }
    });

    await t.test('ENOSPC, No space left on device, lost-skill, failed patch capture, and >=98% /tmp usage are marked infra errors', () => {
      const cases = [
        { file: 'chat_log.txt', text: "Error: ENOSPC: no space left on device, mkdir '/tmp/ghh-abc'", expected: /ENOSPC/ },
        { file: 'agent_stderr.log', text: "mkdir: cannot create directory '/tmp/ghh-abc': No space left on device", expected: /ENOSPC/ },
        {
          file: 'session-test.jsonl',
          text: JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_bash_1',
                  content: "mkdir: cannot create directory '/tmp/ghh-abc': No space left on device",
                },
              ],
            },
          }),
          expected: /ENOSPC/,
        },
        {
          file: 'trajectory_summary.json',
          text: JSON.stringify({
            agent: 'claude_code',
            steps: [
              {
                stepNumber: 1,
                thought: '',
                action: { type: 'run_command', name: 'Bash', params: { command: 'pnpm build' } },
                outcome: { status: 'error', message: "Error: ENOSPC: no space left on device, write '/tmp/out'" },
              },
            ],
          }),
          expected: /ENOSPC/,
        },
        {
          file: 'runtime.json',
          text: JSON.stringify({
            agentRuntime: 1000,
            tmpUsageStart: { byteRatio: 0.5, inodeRatio: 0.4 },
            tmpUsageEnd: { byteRatio: 0.985, inodeRatio: 0.45 },
          }),
          expected: /\/tmp usage reached critical level/,
        },
        { file: 'chat_log.txt', text: 'Failed to copy standalone skills-cli: permission denied', expected: /Failed to copy standalone skills-cli/ },
        { file: 'agent_stderr.log', text: 'Failed to capture patch from git', expected: /Failed to capture patch/ },
      ];
      for (const c of cases) {
        const caseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-log-infra-'));
        try {
          fs.writeFileSync(path.join(caseDir, c.file), c.text, 'utf8');
          const res = evaluateScenarioResults(
            caseDir,
            'test-guide',
            graderPath,
            path.join(caseDir, 'results.json'),
            true,
            path.join(caseDir, 'index.html'),
          );
          assert.strictEqual(res.length, 1, `Expected 1 infra error for ${c.file}`);
          assert.strictEqual(res[0].isEarlyFailure, true);
          assert.match(res[0].message, c.expected);
        } finally {
          fs.rmSync(caseDir, { recursive: true, force: true });
        }
      }
    });

    await t.test('passing run whose transcript quotes a guide or reasoning mentioning "No space left on device" stays a normal graded result', () => {
      const passDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-prose-pass-'));
      try {
        // 1. Write passing Playwright results
        const resultsPath = path.join(passDir, 'results.json');
        fs.writeFileSync(
          resultsPath,
          JSON.stringify({
            suites: [
              {
                title: 'grader.ts',
                specs: [
                  {
                    id: 'spec-1',
                    title: 'check 1: has header element',
                    tests: [{ results: [{ status: 'passed' }] }],
                  },
                ],
              },
            ],
          }),
          'utf8',
        );

        // 2. Write Claude JSONL chat_log.txt and session-*.jsonl quoting a guide mentioning "No space left on device" & ENOSPC
        const jsonlLines = [
          JSON.stringify({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'thinking',
                  thinking: 'The guide mentions handling QuotaExceededError when the OS reports No space left on device (ENOSPC).',
                },
                {
                  type: 'tool_use',
                  id: 'toolu_read_guide',
                  name: 'Read',
                  input: { file_path: '/tmp/.claude/skills/storage/guide.md' },
                },
              ],
            },
          }),
          JSON.stringify({
            type: 'user',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_read_guide',
                  content:
                    '# Storage Guide\nWhen disk is full (`No space left on device` or `ENOSPC: no space left on device, write`), catch `QuotaExceededError`.\nExample:\n`mkdir: cannot create directory: No space left on device`',
                },
              ],
            },
          }),
          JSON.stringify({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'I updated the storage handler so "No space left on device" (ENOSPC) is handled gracefully.',
                },
              ],
            },
          }),
        ].join('\n');
        fs.writeFileSync(path.join(passDir, 'chat_log.txt'), jsonlLines, 'utf8');
        fs.writeFileSync(path.join(passDir, 'session-123.jsonl'), jsonlLines, 'utf8');

        // 3. Write trajectory_summary.json with thought and guide_read step mentioning "No space left on device"
        fs.writeFileSync(
          path.join(passDir, 'trajectory_summary.json'),
          JSON.stringify({
            agent: 'claude_code',
            steps: [
              {
                stepNumber: 1,
                thought: 'Checking how guide handles No space left on device / ENOSPC',
                action: { type: 'read_file', name: 'Read', canonicalCategory: 'guide_read' },
                outcome: {
                  status: 'success',
                  message: 'Guide text: Error: ENOSPC: no space left on device, write / mkdir: cannot create directory: No space left on device',
                },
              },
            ],
          }),
          'utf8',
        );

        // 4. Write an app file in the directory mentioning ENOSPC to ensure app files are never scanned
        fs.writeFileSync(
          path.join(passDir, 'app-notes.json'),
          JSON.stringify({ note: "Error: ENOSPC: no space left on device, write '/tmp/x'" }),
          'utf8',
        );

        // 5. Write normal runtime.json (< 98% /tmp usage)
        fs.writeFileSync(
          path.join(passDir, 'runtime.json'),
          JSON.stringify({
            agentRuntime: 1200,
            tmpUsageStart: { byteRatio: 0.45, inodeRatio: 0.3 },
            tmpUsageEnd: { byteRatio: 0.52, inodeRatio: 0.31 },
          }),
          'utf8',
        );

        const res = evaluateScenarioResults(
          passDir,
          'test-guide',
          graderPath,
          resultsPath,
          true,
          path.join(passDir, 'index.html'),
        );
        assert.strictEqual(res.length, 1);
        assert.strictEqual(res[0].passed, true);
        assert.strictEqual(res[0].isEarlyFailure, undefined);
      } finally {
        fs.rmSync(passDir, { recursive: true, force: true });
      }
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

