import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import { spawnSync } from 'child_process';

test('npx interception via shim', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npx-intercept-test-'));
  const templatePath = path.resolve(import.meta.dirname, 'npx-intercept.template.ts');

  assert.ok(fs.existsSync(templatePath), 'Template should exist');

  // Create a dummy CLI script that creates a file when called
  const dummyCliPath = path.join(tempDir, 'dummy-cli.js');
  fs.writeFileSync(dummyCliPath, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
fs.writeFileSync(path.join(__dirname, 'called.txt'), 'yes');
`);
  fs.chmodSync(dummyCliPath, 0o755);

  // Read template and replace path
  let templateContent = fs.readFileSync(templatePath, 'utf8');
  templateContent = templateContent.replace('__LOCAL_CLI_PATH__', dummyCliPath);

  const npxShimPath = path.join(tempDir, 'npx');
  fs.writeFileSync(npxShimPath, templateContent);
  fs.chmodSync(npxShimPath, 0o755);

  try {
    // Run a command that should be intercepted
    // We need to make sure we use the shim npx by setting PATH
    const env = { ...process.env, PATH: `${tempDir}:${process.env.PATH}` };

    console.log(`Running intercepted command with PATH=${tempDir}...`);
    const result = spawnSync('npx', ['-y', 'modern-web-guidance@latest', 'search', 'foo'], {
      cwd: tempDir,
      stdio: 'inherit',
      env,
      timeout: 10000,
      shell: process.platform === 'win32'
    });

    assert.strictEqual(result.status, 0, 'Intercepted command should succeed');

    const calledFile = path.join(tempDir, 'called.txt');
    assert.ok(fs.existsSync(calledFile), 'Dummy CLI should have been called');
    assert.strictEqual(fs.readFileSync(calledFile, 'utf8'), 'yes', 'Dummy CLI should have written yes');

    // Clean up called file
    fs.unlinkSync(calledFile);

    // Run a command that should NOT be intercepted (fallback)
    console.log(`Running fallback command with PATH=${tempDir}...`);
    const resultFallback = spawnSync('npx', ['--version'], {
      cwd: tempDir,
      stdio: 'inherit',
      env,
      timeout: 10000,
      shell: process.platform === 'win32'
    });

    assert.strictEqual(resultFallback.status, 0, 'Fallback command should succeed');
    assert.ok(!fs.existsSync(calledFile), 'Dummy CLI should NOT have been called for fallback');

  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
