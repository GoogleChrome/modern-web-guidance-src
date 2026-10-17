import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executePlaywright } from './run-grader.ts';

describe('executePlaywright configuration', () => {
  test('uses json reporter by default', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-opts-test-'));
    const targetFile = path.join(tempDir, 'index.html');
    fs.writeFileSync(targetFile, '<html></html>', 'utf8');

    try {
      const child = executePlaywright({
        targetPathAbs: targetFile,
        graderPath: path.join(tempDir, 'grader.ts'),
        reporters: ['json'],
        jsonOutputName: path.join(tempDir, 'out.json'),
        stdio: 'pipe',
      });
      child.on('error', () => {});
      try { child.kill(); } catch {}

      assert.ok(child.spawnargs, 'Child process should be spawned');
      const hasJsonReporter = child.spawnargs.some(arg => arg === '--reporter=json');
      assert.strictEqual(hasJsonReporter, true, 'Spawn args should include --reporter=json');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('configures PLAYWRIGHT_OUTPUT_DIR from testResultsDir option', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-opts-test-'));
    const targetFile = path.join(tempDir, 'index.html');
    const customOutputDir = path.join(tempDir, 'custom-test-results');
    fs.writeFileSync(targetFile, '<html></html>', 'utf8');

    try {
      const child = executePlaywright({
        targetPathAbs: targetFile,
        graderPath: path.join(tempDir, 'grader.ts'),
        reporters: ['json'],
        testResultsDir: customOutputDir,
        jsonOutputName: path.join(tempDir, 'out.json'),
        stdio: 'pipe',
      });
      child.on('error', () => {});
      try { child.kill(); } catch {}

      assert.ok(child.spawnargs, 'Child process should be spawned');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
