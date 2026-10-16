import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import config from '../config.ts';
import { runAgent } from './utils.ts';
import { UNSAFE_NO_SANDBOX_ENV } from './sandbox.ts';
import { getDefaultSolutionAgent } from '../../core/guide-validation.ts';
import { rootDir } from '../../core/paths.ts';

const canSandbox = (process.platform === 'darwin' && spawnSync('which', ['sandbox-exec']).status === 0)
  || (process.platform === 'linux' && spawnSync('which', ['bwrap']).status === 0);

describe('runAgent routing and argument building', () => {
  let tempDir: string;
  let mockCliPath: string;
  let originalAntigravityCli: string;
  let originalJetskiCli: string;
  let originalGdUseJetski: string | undefined;

  before(() => {
    // Create temporary directory and mock CLI
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mock-agent-cli-')));
    mockCliPath = path.join(tempDir, 'mock-cli');
    
    // The mock CLI script prints its arguments to stdout
    const scriptContent = `#!/bin/sh
echo "mock-cli ran with args: $@"
`;
    fs.writeFileSync(mockCliPath, scriptContent, { mode: 0o755 });

    // Backup original configs
    originalAntigravityCli = config.environment.antigravityCliBin;
    originalJetskiCli = config.environment.jetskiCliBin;
    originalGdUseJetski = process.env.GD_DEV_USE_JETSKI;

    // Override config paths to point to the mock CLI
    config.environment.antigravityCliBin = mockCliPath;
    config.environment.jetskiCliBin = mockCliPath;
  });

  after(() => {
    // Restore config paths and environment variables
    config.environment.antigravityCliBin = originalAntigravityCli;
    config.environment.jetskiCliBin = originalJetskiCli;
    
    if (originalGdUseJetski === undefined) {
      delete process.env.GD_DEV_USE_JETSKI;
    } else {
      process.env.GD_DEV_USE_JETSKI = originalGdUseJetski;
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should invoke Antigravity CLI by default', async () => {
    delete process.env.GD_DEV_USE_JETSKI;
    
    const output = await runAgent(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
    assert.ok(output.includes('mock-cli ran with args: -p hello world --dangerously-skip-permissions'));
  });

  test('should invoke Jetski CLI without --yolo when GD_DEV_USE_JETSKI=1', async () => {
    process.env.GD_DEV_USE_JETSKI = '1';

    try {
      const output = await runAgent(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
      assert.ok(output.includes('mock-cli ran with args: -p hello world'));
      assert.ok(!output.includes('--yolo'));
    } finally {
      delete process.env.GD_DEV_USE_JETSKI;
    }
  });

  test(
    'should set PWD to workDir and sandbox rootDir when homeDir is provided',
    { skip: !canSandbox || process.env[UNSAFE_NO_SANDBOX_ENV] === '1' },
    async () => {
      const probeCli = path.join(tempDir, 'probe-cli');
      const strayFile = path.join(rootDir, 'stray-sandbox-probe.txt');
      fs.writeFileSync(
        probeCli,
        `#!/bin/sh\necho "PWD=$PWD"\nif touch "${strayFile}" 2>/dev/null; then echo "WROTE_ROOT"; rm -f "${strayFile}"; else echo "BLOCKED_ROOT"; fi\n`,
        { mode: 0o755 }
      );
      config.environment.antigravityCliBin = probeCli;
      config.environment.jetskiCliBin = probeCli;
      try {
        const output = await runAgent(getDefaultSolutionAgent(), 'probe', tempDir, {
          captureOutput: true,
          homeDir: tempDir,
        });
        assert.ok(output.includes(`PWD=${tempDir}`));
        assert.ok(output.includes('BLOCKED_ROOT'));
        assert.ok(!fs.existsSync(strayFile));
      } finally {
        config.environment.antigravityCliBin = mockCliPath;
        config.environment.jetskiCliBin = mockCliPath;
      }
    }
  );
});
