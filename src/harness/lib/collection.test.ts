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
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

