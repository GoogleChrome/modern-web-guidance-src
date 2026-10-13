import { test } from 'node:test';
import assert from 'node:assert';
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

test('evaluateScenarioResults expands early failures to all N checks in multi-check grader', () => {
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

    // Case A: Missing target app (targetAppExists = false)
    const resMissingTarget = evaluateScenarioResults(
      tempDir,
      'test-guide',
      graderPath,
      path.join(tempDir, 'results.json'),
      false, // targetAppExists
      path.join(tempDir, 'index.html')
    );
    assert.strictEqual(resMissingTarget.length, 5, 'Should produce 5 checks for missing target app');
    assert.ok(resMissingTarget.every(c => !c.passed && c.isEarlyFailure));
    assert.ok(resMissingTarget[0].message.includes('check 1: has header element'));
    assert.ok(resMissingTarget[0].message.includes('Target app missing'));

    // Case B: Crashed generation / missing grader results JSON with generation_failed.json
    fs.writeFileSync(
      path.join(tempDir, 'generation_failed.json'),
      JSON.stringify({ agentName: 'claude_code', exitCode: 'TIMEOUT (10m)' })
    );
    const resCrashed = evaluateScenarioResults(
      tempDir,
      'test-guide',
      graderPath,
      path.join(tempDir, 'results.json'),
      true, // targetAppExists
      path.join(tempDir, 'index.html')
    );
    assert.strictEqual(resCrashed.length, 5, 'Should produce 5 checks for generation_failed.json');
    assert.ok(resCrashed.every(c => !c.passed && c.isEarlyFailure));
    assert.ok(resCrashed[0].message.includes('check 1: has header element'));
    assert.ok(resCrashed[0].message.includes('claude_code exited with TIMEOUT (10m)'));

    // Case C: Empty suites in grader results JSON (e.g. dev server crashed in beforeAll)
    const resultsJsonPath = path.join(tempDir, 'results.json');
    fs.writeFileSync(resultsJsonPath, JSON.stringify({ suites: [] }));
    const resEmptySuites = evaluateScenarioResults(
      tempDir,
      'test-guide',
      graderPath,
      resultsJsonPath,
      true,
      path.join(tempDir, 'index.html')
    );
    assert.strictEqual(resEmptySuites.length, 5, 'Should produce 5 checks when suites are empty');
    assert.ok(resEmptySuites.every(c => !c.passed && c.isEarlyFailure));
    assert.ok(resEmptySuites[0].message.includes('Playwright test runner failed'));

    // Case D: Fallback to single entry if grader has 0 parseable tests or does not exist
    const nonExistentGrader = path.join(tempDir, 'non_existent_grader.ts');
    const resNoGrader = evaluateScenarioResults(
      tempDir,
      'test-guide',
      nonExistentGrader,
      resultsJsonPath,
      true,
      path.join(tempDir, 'index.html')
    );
    assert.strictEqual(resNoGrader.length, 1, 'Should fallback to 1 check if grader file does not exist');
    assert.strictEqual(resNoGrader[0].passed, false);
    assert.strictEqual(resNoGrader[0].isEarlyFailure, true);
    assert.strictEqual(resNoGrader[0].id, 'early-failure-1');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

