import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import { spawnSync } from 'child_process';
import { rootDir } from '../../src/core/paths.ts';

test('npx interception via shim', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npx-intercept-test-'));
  const templatePath = path.join(rootDir, 'harness', 'npx-intercept.template.ts');

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

  for (const binName of ['npx', 'pnpx', 'pnpm']) {
    const shimPath = path.join(tempDir, binName);
    fs.writeFileSync(shimPath, templateContent);
    fs.chmodSync(shimPath, 0o755);
  }

  try {
    // Run commands that should be intercepted across npx, pnpx, and pnpm dlx
    const env = { ...process.env, PATH: `${tempDir}:${process.env.PATH}` };
    const calledFile = path.join(tempDir, 'called.txt');

    for (const [cmd, cmdArgs] of [
      ['npx', ['-y', 'modern-web-guidance@latest', 'search', 'foo']],
      ['pnpx', ['modern-web-guidance@latest', 'search', 'foo']],
      ['pnpm', ['dlx', 'modern-web-guidance@latest', 'search', 'foo']],
    ] as const) {
      const result = spawnSync(cmd, [...cmdArgs], {
        cwd: tempDir,
        stdio: 'inherit',
        env,
        timeout: 10000,
        shell: process.platform === 'win32'
      });

      assert.strictEqual(result.status, 0, `Intercepted ${cmd} command should succeed`);
      assert.ok(fs.existsSync(calledFile), `Dummy CLI should have been called for ${cmd}`);
      assert.strictEqual(fs.readFileSync(calledFile, 'utf8'), 'yes', 'Dummy CLI should have written yes');
      fs.unlinkSync(calledFile);
    }

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

    // Verify killing a backgrounded shim (`pnpm ... & PID=$!; kill $PID`) kills grandchild processes
    const pidFile = path.join(tempDir, 'grandchild.pid');
    const fakeRealBinDir = path.join(tempDir, 'real-bin');
    fs.mkdirSync(fakeRealBinDir, { recursive: true });
    const fakeRealPnpm = path.join(fakeRealBinDir, 'pnpm');
    fs.writeFileSync(fakeRealPnpm, `#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const srv = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
fs.writeFileSync(${JSON.stringify(pidFile)}, String(srv.pid));
srv.on('exit', (c) => process.exit(c ?? 0));
`, { mode: 0o755 });

    const bgResult = spawnSync('/bin/sh', [
      '-c',
      `"${path.join(tempDir, 'pnpm')}" start & PID=$!; for i in $(seq 1 30); do [ -s "${pidFile}" ] && break; sleep 0.1; done; kill $PID; wait $PID 2>/dev/null || true`
    ], {
      cwd: tempDir,
      env: { ...process.env, PATH: `${tempDir}:${fakeRealBinDir}:${process.env.PATH}` },
      timeout: 5000,
    });
    assert.strictEqual(bgResult.status, 0, 'Backgrounded shim command should exit cleanly after kill');
    const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.ok(grandchildPid > 0, 'Grandchild PID should have been recorded');
    let isDead = false;
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(grandchildPid, 0);
        await new Promise(r => setTimeout(r, 50));
      } catch (err: any) {
        if (err.code === 'ESRCH') {
          isDead = true;
          break;
        }
        throw err;
      }
    }
    assert.strictEqual(isDead, true, 'Grandchild server process must not remain alive after killing shim');

  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
