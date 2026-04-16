import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getGraderScriptContent } from './agent-shared.ts';

describe('getGraderScriptContent', () => {
  test('should generate valid JavaScript code', () => {
    const runGraderModulePath = '/path/to/run-grader.ts';
    const targetPkgJson = '/path/to/package.json';
    const cwd = '/path/to/cwd';
    const targetFile = '/path/to/index.html';
    const graderPath = '/path/to/grader.ts';
    const gradeReportDir = '/path/to/grade-report';
    const graderResults = '/path/to/results.json';

    const scriptContent = getGraderScriptContent(
      runGraderModulePath,
      targetPkgJson,
      cwd,
      targetFile,
      graderPath,
      gradeReportDir,
      graderResults
    );

    // Write to a temporary file with .mjs extension to ensure it's parsed as ESM
    const tempFile = path.join(process.cwd(), `temp_grader_test_${Math.random().toString(36).substring(7)}.mjs`);
    fs.writeFileSync(tempFile, scriptContent);

    try {
      // Check if it compiles as valid JS
      const result = spawnSync(process.execPath, ['--check', tempFile], { stdio: 'pipe' });
      
      // If there are syntax errors, result.status will be non-zero and stderr will contain details
      if (result.status !== 0) {
        console.error('Generated script failed compilation check:');
        console.error(result.stderr.toString());
      }
      
      assert.strictEqual(result.status, 0, 'Generated script should be valid JavaScript');
    } finally {
      // Clean up
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });
});
