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

test('evaluateScenarioResults expands early failures to all N checks in multi-check grader', async (t) => {
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

    const expectedEarlyFailureStates = Array(5).fill({ passed: false, isEarlyFailure: true });

    await t.test('missing target app', () => {
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        path.join(tempDir, 'results.json'),
        false,
        path.join(tempDir, 'index.html')
      );
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        expectedEarlyFailureStates
      );
      assert.ok(res[0].message.includes('check 1: has header element'));
      assert.ok(res[0].message.includes('Target app missing'));
    });

    await t.test('crashed generation with generation_failed.json', () => {
      fs.writeFileSync(
        path.join(tempDir, 'generation_failed.json'),
        JSON.stringify({ agentName: 'claude_code', exitCode: 'TIMEOUT (10m)' })
      );
      const res = evaluateScenarioResults(
        tempDir,
        'test-guide',
        graderPath,
        path.join(tempDir, 'results.json'),
        true,
        path.join(tempDir, 'index.html')
      );
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        expectedEarlyFailureStates
      );
      assert.ok(res[0].message.includes('check 1: has header element'));
      assert.ok(res[0].message.includes('claude_code exited with TIMEOUT (10m)'));
    });

    await t.test('empty suites in grader results JSON', () => {
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
      assert.deepStrictEqual(
        res.map(c => ({ passed: c.passed, isEarlyFailure: c.isEarlyFailure })),
        expectedEarlyFailureStates
      );
      assert.ok(res[0].message.includes('Playwright test runner failed'));
    });

    await t.test('fallback to single entry if grader does not exist', () => {
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
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

