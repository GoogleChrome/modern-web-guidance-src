import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { getGraderScriptContent, runCliAgentCommand } from './agent-shared.ts';
import { UNSAFE_NO_SANDBOX_ENV } from './sandbox.ts';

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

describe('runCliAgentCommand', () => {
  test('reaps orphaned background grandchildren holding stdio open when command exits', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-shared-bg-'));
    const workDir = path.join(tempDir, 'work');
    const targetDir = path.join(tempDir, 'target');
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    const pidFile = path.join(tempDir, 'orphan.pid');

    const prevNoSandbox = process.env[UNSAFE_NO_SANDBOX_ENV];
    process.env[UNSAFE_NO_SANDBOX_ENV] = '1';
    try {
      const script = `
        const { spawn } = require('child_process');
        const fs = require('fs');
        const orphan = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
        fs.writeFileSync(${JSON.stringify(pidFile)}, String(orphan.pid));
        console.log('agent done');
        process.exit(0);
      `;
      await runCliAgentCommand(process.execPath, ['-e', script], workDir, targetDir, 'TestAgent', 'unguided');
      const orphanPid = Number(fs.readFileSync(pidFile, 'utf8'));
      assert.ok(orphanPid > 0);
      assert.throws(() => process.kill(orphanPid, 0), /ESRCH/, 'Orphaned grandchild should be killed when agent exits');
      assert.match(fs.readFileSync(path.join(targetDir, 'chat_log.txt'), 'utf8'), /agent done/);
    } finally {
      if (prevNoSandbox === undefined) delete process.env[UNSAFE_NO_SANDBOX_ENV];
      else process.env[UNSAFE_NO_SANDBOX_ENV] = prevNoSandbox;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('executes caller finally block and records TIMEOUT (10m) when killed by SIGTERM timeout', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-shared-timeout-'));
    const workDir = path.join(tempDir, 'work');
    const targetDir = path.join(tempDir, 'target');
    fs.mkdirSync(workDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
    const pidFile = path.join(tempDir, 'child.pid');
    const finallyMarker = path.join(targetDir, 'finally-exported.txt');
    const wrapperScript = path.join(tempDir, 'wrapper.ts');

    const agentSharedPath = path.resolve(import.meta.dirname, 'agent-shared.ts');
    fs.writeFileSync(wrapperScript, `
      import fs from 'fs';
      import { runCliAgentCommand } from ${JSON.stringify(agentSharedPath)};
      async function main() {
        try {
          await runCliAgentCommand(
            process.execPath,
            ['-e', 'require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);'],
            ${JSON.stringify(workDir)},
            ${JSON.stringify(targetDir)},
            'TestAgent',
            'unguided'
          );
        } catch {
          process.exitCode = 1;
        } finally {
          fs.writeFileSync(${JSON.stringify(finallyMarker)}, 'exported');
        }
      }
      main();
    `);

    const wrapper = spawn(process.execPath, ['--experimental-strip-types', wrapperScript], {
      env: { ...process.env, [UNSAFE_NO_SANDBOX_ENV]: '1' },
      stdio: 'inherit'
    });
    const exitPromise = new Promise<number | null>((resolve) => wrapper.on('exit', (code) => resolve(code)));

    try {
      const deadline = Date.now() + 5000;
      while (!(fs.existsSync(pidFile) && fs.statSync(pidFile).size > 0) && wrapper.exitCode === null && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(fs.existsSync(pidFile), 'Child process should have written pidFile before timeout');
      wrapper.kill('SIGTERM');

      const status = await exitPromise;
      assert.strictEqual(status, 1);
      assert.ok(fs.existsSync(finallyMarker), 'Caller finally block must run to export trajectories on SIGTERM timeout');
      const failureData = JSON.parse(fs.readFileSync(path.join(targetDir, 'generation_failed.json'), 'utf8'));
      assert.strictEqual(failureData.exitCode, 'TIMEOUT (10m)');
      const childPid = Number(fs.readFileSync(pidFile, 'utf8'));
      assert.throws(() => process.kill(childPid, 0), /ESRCH/, 'Timed-out child process must be killed');
    } finally {
      if (wrapper.exitCode === null) wrapper.kill('SIGKILL');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

