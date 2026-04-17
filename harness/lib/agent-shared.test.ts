import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getGraderScriptContent } from './agent-shared.ts';

describe('getGraderScriptContent', () => {
  test('should generate valid JavaScript code', () => {
    const cwd = '/path/to/cwd';
    const graderPath = '/path/to/grader.ts';

    const scriptContent = getGraderScriptContent(cwd, graderPath, 'dummy-guide');

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
