import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import config, { Agents } from '../config.ts';
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

  test('sanitizes host agent env and configures Pi env overrides only for Agents.PI', async () => {
    const dumpCli = path.join(tempDir, 'dump-env-cli');
    const dumpJsonPath = path.join(tempDir, 'dumped-env.json');
    fs.writeFileSync(
      dumpCli,
      `#!${process.execPath}
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(dumpJsonPath)}, JSON.stringify(process.env));
console.log('ok');
`,
      { mode: 0o755 }
    );

    const prevClaudeBin = config.environment.claudeCodeCliBin;
    const prevPiBin = config.environment.piBin;
    const prevNoSandbox = process.env[UNSAFE_NO_SANDBOX_ENV];
    const prevEnv: Record<string, string | undefined> = {};
    const injected: Record<string, string> = {
      [UNSAFE_NO_SANDBOX_ENV]: '1',
      AI_AGENT: 'custom-agent',
      ANTIGRAVITY_AGENT: 'true',
      CLAUDECODE: '1',
      CODEX_THREAD_ID: 'thread-1',
      PI_CODING_AGENT: 'true',
      PI_CODING_AGENT_DIR: '/tmp/host/.pi/agent',
      CLAUDE_CODE_USE_VERTEX: '1',
      ANTIGRAVITY_GCP_PROJECT: 'eval-proj',
      PATH: `/home/host/.pi/agent/bin${path.delimiter}${process.env.PATH || ''}`,
    };
    for (const [k, v] of Object.entries(injected)) {
      prevEnv[k] = process.env[k];
      process.env[k] = v;
    }

    config.environment.claudeCodeCliBin = dumpCli;
    config.environment.piBin = dumpCli;

    try {
      await runAgent(Agents.CLAUDE_CODE, 'test', tempDir, { captureOutput: true, homeDir: tempDir });
      const claudeChildEnv = JSON.parse(fs.readFileSync(dumpJsonPath, 'utf8'));
      assert.strictEqual(claudeChildEnv.AI_AGENT, undefined);
      assert.strictEqual(claudeChildEnv.ANTIGRAVITY_AGENT, undefined);
      assert.strictEqual(claudeChildEnv.CLAUDECODE, undefined);
      assert.strictEqual(claudeChildEnv.CODEX_THREAD_ID, undefined);
      assert.strictEqual(claudeChildEnv.PI_CODING_AGENT, undefined);
      assert.strictEqual(claudeChildEnv.PI_CODING_AGENT_DIR, undefined);
      assert.ok(!claudeChildEnv.PATH.includes('.pi/agent'));
      assert.strictEqual(claudeChildEnv.CLAUDE_CODE_USE_VERTEX, '1');
      assert.strictEqual(claudeChildEnv.ANTIGRAVITY_GCP_PROJECT, 'eval-proj');

      await runAgent(Agents.PI, 'test', tempDir, { captureOutput: true, homeDir: tempDir });
      const piChildEnv = JSON.parse(fs.readFileSync(dumpJsonPath, 'utf8'));
      assert.strictEqual(piChildEnv.ANTIGRAVITY_AGENT, undefined);
      assert.strictEqual(piChildEnv.CLAUDECODE, undefined);
      assert.ok(!piChildEnv.PATH.includes('.pi/agent'));
      assert.strictEqual(piChildEnv.PI_CODING_AGENT, 'true');
      assert.strictEqual(piChildEnv.PI_CODING_AGENT_DIR, path.join(tempDir, '.pi', 'agent'));
    } finally {
      config.environment.claudeCodeCliBin = prevClaudeBin;
      config.environment.piBin = prevPiBin;
      if (prevNoSandbox === undefined) delete process.env[UNSAFE_NO_SANDBOX_ENV];
      else process.env[UNSAFE_NO_SANDBOX_ENV] = prevNoSandbox;
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
