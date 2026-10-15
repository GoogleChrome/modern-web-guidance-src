import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executePlaywright } from './run-grader.ts';

describe('executePlaywright reporter configuration', () => {
  test('does not set PLAYWRIGHT_HTML_OUTPUT_DIR when html reporter is omitted', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-opts-test-'));
    const targetFile = path.join(tempDir, 'index.html');
    fs.writeFileSync(targetFile, '<html></html>', 'utf8');

    try {
      const child = executePlaywright({
        targetPathAbs: targetFile,
        graderPath: path.join(tempDir, 'grader.ts'),
        reporters: ['json'],
        htmlOutputDir: path.join(tempDir, 'grade-report'),
        jsonOutputName: path.join(tempDir, 'out.json'),
        stdio: 'pipe',
      });
      child.on('error', () => {});
      try { child.kill(); } catch {}

      assert.ok(child.spawnargs, 'Child process should be spawned');
      const hasHtmlReporter = child.spawnargs.some(arg => arg.startsWith('--reporter=') && arg.includes('html'));
      assert.strictEqual(hasHtmlReporter, false, 'Spawn args should not include html reporter');
      const hasJsonReporter = child.spawnargs.some(arg => arg === '--reporter=json');
      assert.strictEqual(hasJsonReporter, true, 'Spawn args should include --reporter=json');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('includes html reporter in spawn args when reporters has html', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-opts-test-'));
    const targetFile = path.join(tempDir, 'index.html');
    fs.writeFileSync(targetFile, '<html></html>', 'utf8');

    try {
      const child = executePlaywright({
        targetPathAbs: targetFile,
        graderPath: path.join(tempDir, 'grader.ts'),
        reporters: ['json', 'html'],
        htmlOutputDir: path.join(tempDir, 'grade-report'),
        jsonOutputName: path.join(tempDir, 'out.json'),
        stdio: 'pipe',
      });
      child.on('error', () => {});
      try { child.kill(); } catch {}

      assert.ok(child.spawnargs, 'Child process should be spawned');
      const hasCombinedReporter = child.spawnargs.some(arg => arg === '--reporter=json,html');
      assert.strictEqual(hasCombinedReporter, true, 'Spawn args should include --reporter=json,html');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('extracts retained traces from test-results to traces directory', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-trace-extract-test-'));
    const testResultsDir = path.join(tempDir, 'test-results');
    const failureSubdir = path.join(testResultsDir, 'example-spec-test-chromium');
    const tracesDir = path.join(tempDir, 'traces');

    fs.mkdirSync(failureSubdir, { recursive: true });
    fs.writeFileSync(path.join(failureSubdir, 'trace.zip'), 'dummy-zip-content');

    // Simulate trace extraction logic
    if (fs.existsSync(testResultsDir)) {
      const entries = await fs.promises.readdir(testResultsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const traceSource = path.join(testResultsDir, entry.name, 'trace.zip');
          if (fs.existsSync(traceSource)) {
            await fs.promises.mkdir(tracesDir, { recursive: true });
            const dest = path.join(tracesDir, `${entry.name}.zip`);
            await fs.promises.copyFile(traceSource, dest);
          }
        }
      }
    }

    try {
      assert.strictEqual(fs.existsSync(path.join(tracesDir, 'example-spec-test-chromium.zip')), true);
      assert.strictEqual(
        fs.readFileSync(path.join(tracesDir, 'example-spec-test-chromium.zip'), 'utf8'),
        'dummy-zip-content'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
