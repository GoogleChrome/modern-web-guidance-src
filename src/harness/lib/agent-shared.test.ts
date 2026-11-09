import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import {
  createWorkDir,
  getAgentCommandAndArgs,
  getGraderScriptContent,
  runCliAgentCommand,
  sanitizeAgentChildEnv,
} from './agent-shared.ts';
import { Agents } from '../config.ts';
import { DETECTED_AGENT_ENV_VARS, determineAgent } from '../../cli/telemetry/detect-agent.ts';
import { initGitRepo } from '../../core/patch-utils.ts';
import { DEFAULT_GUIDED_MWGRC } from '../../core/feature-gates.ts';
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

  test('passes baselineTarget to runPlaywright in generated script', () => {
    const scriptLimited = getGraderScriptContent('/path/to/cwd', '/path/to/grader.ts', 'dummy-guide', 'limited');
    assert.ok(scriptLimited.includes('"limited"'));

    const scriptDefault = getGraderScriptContent('/path/to/cwd', '/path/to/grader.ts', 'dummy-guide');
    assert.ok(scriptDefault.includes('"widely"'));
  });
});

describe('createWorkDir', () => {
  test('does not create a duplicate init commit when templateDir already contains .git', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-shared-workdir-'));
    const templateDir = path.join(tempDir, 'template_app');
    const homeDir = path.join(tempDir, 'home');
    fs.mkdirSync(templateDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    fs.writeFileSync(path.join(templateDir, 'index.js'), 'console.log("hello");\n');

    try {
      initGitRepo(templateDir);
      const workDir = createWorkDir(templateDir, homeDir, 'guided');
      const logResult = spawnSync('git', ['log', '--oneline'], { cwd: workDir, encoding: 'utf8' });
      const commits = logResult.stdout.trim().split('\n').filter(Boolean);
      assert.strictEqual(commits.length, 1, `Expected exactly 1 initial commit, got: ${logResult.stdout}`);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('provisions .mwgrc with opt-in flags before git init in single-task workDir for guided run', () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'create-workdir-test-'));
    try {
      const workDir = createWorkDir('', tempHome, 'guided');
      const mwgrcPath = path.join(workDir, '.mwgrc');
      assert.ok(fs.existsSync(mwgrcPath), '.mwgrc should exist in workDir');
      const config = JSON.parse(fs.readFileSync(mwgrcPath, 'utf8'));
      assert.deepStrictEqual(config, DEFAULT_GUIDED_MWGRC);

      // Verify .mwgrc is tracked in git and clean in git status
      const status = spawnSync('git', ['status', '--porcelain'], { cwd: workDir, encoding: 'utf8' }).stdout.trim();
      assert.strictEqual(status, '', 'workDir git status should be clean after initGitRepo');

      // Verify .mwgrc is in the root commit
      const rootFiles = spawnSync('git', ['ls-tree', '--name-only', 'HEAD'], { cwd: workDir, encoding: 'utf8' }).stdout.trim().split('\n');
      assert.ok(rootFiles.includes('.mwgrc'), '.mwgrc must be part of the initial git commit');
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test('does not provision .mwgrc for unguided runs', () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'create-workdir-unguided-'));
    try {
      const workDir = createWorkDir('', tempHome, 'unguided');
      const mwgrcPath = path.join(workDir, '.mwgrc');
      assert.strictEqual(fs.existsSync(mwgrcPath), false, '.mwgrc should not exist for unguided runs');
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  test('provisions .mwgrc with opt-in flags before git init in templated suite workDir', () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'create-workdir-suite-'));
    const templateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
    fs.writeFileSync(path.join(templateDir, 'package.json'), '{"name":"test-app"}\n');
    initGitRepo(templateDir); // suite templates already have .git (see setupWorkspaceBaseApp)
    try {
      const workDir = createWorkDir(templateDir, tempHome, 'guided');
      const mwgrcPath = path.join(workDir, '.mwgrc');
      assert.ok(fs.existsSync(mwgrcPath), '.mwgrc should exist in workDir');
      const config = JSON.parse(fs.readFileSync(mwgrcPath, 'utf8'));
      assert.deepStrictEqual(config, DEFAULT_GUIDED_MWGRC);

      const status = spawnSync('git', ['status', '--porcelain'], { cwd: workDir, encoding: 'utf8' }).stdout.trim();
      assert.strictEqual(status, '', 'workDir git status should be clean after initGitRepo');

      const rootFiles = spawnSync('git', ['ls-tree', '--name-only', 'HEAD'], { cwd: workDir, encoding: 'utf8' }).stdout.trim().split('\n');
      assert.ok(rootFiles.includes('.mwgrc'), '.mwgrc must be part of the initial git commit');
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
      fs.rmSync(templateDir, { recursive: true, force: true });
    }
  });

  test('provisions baseline target in .mwgrc when BASELINE_TARGET is set for guided run', () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'create-workdir-baseline-'));
    const prevBaseline = process.env.BASELINE_TARGET;
    process.env.BASELINE_TARGET = 'newly';
    try {
      const workDir = createWorkDir('', tempHome, 'guided');
      const config = JSON.parse(fs.readFileSync(path.join(workDir, '.mwgrc'), 'utf8'));
      assert.deepStrictEqual(config, { ...DEFAULT_GUIDED_MWGRC, baseline: 'newly' });
      const homeConfig = JSON.parse(fs.readFileSync(path.join(tempHome, '.mwgrc'), 'utf8'));
      assert.deepStrictEqual(homeConfig, { ...DEFAULT_GUIDED_MWGRC, baseline: 'newly' });
    } finally {
      if (prevBaseline === undefined) delete process.env.BASELINE_TARGET;
      else process.env.BASELINE_TARGET = prevBaseline;
      fs.rmSync(tempHome, { recursive: true, force: true });
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

  test('executes caller finally block and records TIMEOUT (15m) when killed by SIGTERM timeout', async () => {
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

    const wrapper = spawn(process.execPath, [wrapperScript], {
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
      assert.strictEqual(failureData.exitCode, 'TIMEOUT (15m)');
      const childPid = Number(fs.readFileSync(pidFile, 'utf8'));
      assert.throws(() => process.kill(childPid, 0), /ESRCH/, 'Timed-out child process must be killed');
    } finally {
      if (wrapper.exitCode === null) wrapper.kill('SIGKILL');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('strips harness, pnpm, and host AI-agent environment leaks while preserving provider config and applying overrides', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-shared-env-'));
    const workDir = path.join(tempDir, 'work');
    const targetDir = path.join(tempDir, 'target');
    const shimDir = path.join(tempDir, '.gd-bin');
    const piAgentDir = path.join(tempDir, '.pi', 'agent');
    for (const d of [workDir, targetDir, shimDir]) fs.mkdirSync(d, { recursive: true });
    const envDumpFile = path.join(workDir, 'env.json');

    const prevEnv: Record<string, string | undefined> = {};
    const testEnv: Record<string, string> = {
      [UNSAFE_NO_SANDBOX_ENV]: '1',
      PNPM_PACKAGE_NAME: 'modern-web-guidance-src',
      GD_SUITE_CONFIG: '/repo/results/suites/s/suite_config.json',
      AI_AGENT: 'custom-agent',
      AGENT: 'amp',
      ANTIGRAVITY_AGENT: 'true',
      ANTIGRAVITY_LS_ADDRESS: '127.0.0.1:42000',
      INVOKER_INFO_CHAIN: 'host',
      CLAUDECODE: '1',
      CLAUDE_CODE_SESSION_ID: 'sess-123',
      CODEX_THREAD_ID: 'thread-456',
      CODEX_HOME: '/tmp/host-codex',
      GEMINI_CLI: '1',
      CURSOR_AGENT: '1',
      CURSOR_TRACE_ID: 'trace-123',
      PI_CODING_AGENT: 'true',
      PI_CODING_AGENT_DIR: '/tmp/host/.pi/agent',
      CLAUDE_CODE_USE_VERTEX: '1',
      ANTIGRAVITY_GCP_PROJECT: 'eval-gcp-project',
      GPG_AGENT_INFO: '/tmp/gpg-agent',
      PATH: [
        path.join(process.cwd(), 'results', 'suites', 's', '1', 'secret-guide', 'demo', 'unguided', 'node_modules', '.bin'),
        path.join(targetDir, 'node_modules', '.bin'),
        '/Users/dev/.pi/agent/bin',
        process.env.PATH || '',
      ].filter(Boolean).join(path.delimiter),
    };
    for (const [k, v] of Object.entries(testEnv)) {
      prevEnv[k] = process.env[k];
      process.env[k] = v;
    }

    try {
      const script = `require('fs').writeFileSync(${JSON.stringify(envDumpFile)}, JSON.stringify(process.env));`;
      await runCliAgentCommand(process.execPath, ['-e', script], workDir, targetDir, 'TestAgent', 'unguided');
      const childEnv = JSON.parse(fs.readFileSync(envDumpFile, 'utf8'));
      for (const stripped of [
        'PNPM_PACKAGE_NAME',
        'GD_SUITE_CONFIG',
        'AI_AGENT',
        'AGENT',
        'ANTIGRAVITY_AGENT',
        'ANTIGRAVITY_LS_ADDRESS',
        'INVOKER_INFO_CHAIN',
        'CLAUDECODE',
        'CLAUDE_CODE_SESSION_ID',
        'CODEX_THREAD_ID',
        'CODEX_HOME',
        'GEMINI_CLI',
        'CURSOR_AGENT',
        'CURSOR_TRACE_ID',
        'PI_CODING_AGENT',
        'PI_CODING_AGENT_DIR',
      ]) {
        assert.strictEqual(childEnv[stripped], undefined, `Expected ${stripped} to be stripped`);
      }
      assert.strictEqual(childEnv.CLAUDE_CODE_USE_VERTEX, '1');
      assert.strictEqual(childEnv.ANTIGRAVITY_GCP_PROJECT, 'eval-gcp-project');
      assert.strictEqual(childEnv.GPG_AGENT_INFO, '/tmp/gpg-agent');

      const pathEntries = (childEnv.PATH || '').split(path.delimiter);
      assert.strictEqual(pathEntries[0], shimDir);
      assert.ok(!pathEntries.some((p: string) => p.includes('secret-guide') || p.startsWith(targetDir) || p.includes('/.pi/agent')));

      assert.strictEqual(getAgentCommandAndArgs(Agents.CLAUDE_CODE, 'test', tempDir).envOverrides, undefined);
      assert.deepStrictEqual(getAgentCommandAndArgs(Agents.PI, 'test').envOverrides, { PI_CODING_AGENT: 'true' });
      const piOverrides = getAgentCommandAndArgs(Agents.PI, 'test', tempDir).envOverrides;
      assert.deepStrictEqual(piOverrides, { PI_CODING_AGENT: 'true', PI_CODING_AGENT_DIR: piAgentDir });

      await runCliAgentCommand(
        process.execPath,
        ['-e', script],
        workDir,
        targetDir,
        'Pi',
        'unguided',
        piOverrides,
      );
      const piEnv = JSON.parse(fs.readFileSync(envDumpFile, 'utf8'));
      assert.strictEqual(piEnv.PI_CODING_AGENT, 'true');
      assert.strictEqual(piEnv.PI_CODING_AGENT_DIR, piAgentDir);
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('sanitizeAgentChildEnv', () => {
  test('strips all detect-agent markers including shared TTY-gated markers while keeping safe terminal vars', () => {
    const sanitized = sanitizeAgentChildEnv({
      HOME: '/tmp/home',
      TERM_PROGRAM: 'kiro',
      REPL_ID: 'repl-1',
      CURSOR_EXTENSION_HOST_ROLE: 'agent-exec',
      KIMI_PLUGIN_ROOT: '/tmp/kimi',
      GROK_PLUGIN_ROOT: '/tmp/grok',
      AMP_CURRENT_THREAD_ID: 't-1',
      GEMINI_CLI: '1',
      CLINE_ACTIVE: 'true',
      CODEX_SANDBOX_NETWORK_DISABLED: '1',
      ANTIGRAVITY_CLI_ALIAS: 'agy',
      ANTIGRAVITY_MODEL: 'gemini-3.8-flash-medium',
      ANTIGRAVITY_EFFORT: 'high',
      CLAUDE_EFFORT: 'medium',
      CODEX_EFFORT: 'xhigh',
      JETSKI_EFFORT: 'max',
      AUGMENT_AGENT: '1',
      OPENCODE: '1',
      GOOSE_TERMINAL: '1',
      GOOSE_PROVIDER: 'anthropic',
      JUNIE_DATA: '/tmp/junie',
      AGENT_CONTEXT_OUT: '/tmp/ctx',
      COPILOT_CLI: '1',
      CLAUDE_CODE: '1',
      CLAUDE_CODE_IS_COWORK: '1',
      CLAUDE_CODE_USE_VERTEX: '1',
      DISABLE_TELEMETRY: '1',
      NODE_TEST_CONTEXT: 'child',
      PATH: ['/Users/dev/.pi/agent/bin', '/Users/dev/not.pi/agentic', '/usr/bin'].join(path.delimiter),
    });

    assert.deepStrictEqual(determineAgent(sanitized, () => false, false), {
      isAgent: false,
      agent: undefined,
    });
    assert.strictEqual(sanitized.TERM_PROGRAM, undefined);
    assert.strictEqual(sanitized.ANTIGRAVITY_MODEL, 'gemini-3.8-flash-medium');
    assert.strictEqual(sanitized.ANTIGRAVITY_EFFORT, undefined);
    assert.strictEqual(sanitized.CLAUDE_EFFORT, undefined);
    assert.strictEqual(sanitized.CODEX_EFFORT, undefined);
    assert.strictEqual(sanitized.JETSKI_EFFORT, undefined);
    assert.strictEqual(sanitized.CLAUDE_CODE_USE_VERTEX, '1');
    assert.strictEqual(sanitized.DISABLE_TELEMETRY, '1');
    assert.strictEqual(sanitized.NODE_TEST_CONTEXT, 'child');
    assert.strictEqual(sanitized.PATH, ['/Users/dev/not.pi/agentic', '/usr/bin'].join(path.delimiter));

    const withWindowsPath = sanitizeAgentChildEnv({
      Path: ['/Users/dev/.pi/agent/bin', '/usr/bin'].join(path.delimiter),
    });
    assert.strictEqual(withWindowsPath.PATH, '/usr/bin');
    assert.strictEqual(withWindowsPath.Path, undefined);

    const withVscodeTerm = sanitizeAgentChildEnv({ TERM_PROGRAM: 'vscode' });
    assert.strictEqual(withVscodeTerm.TERM_PROGRAM, 'vscode');

    const allDetected = Object.fromEntries([...DETECTED_AGENT_ENV_VARS].map(key => [key, '1']));
    assert.deepStrictEqual(sanitizeAgentChildEnv(allDetected), {});
  });

  test('strips host credentials and arbitrary unknown env vars via allowlist', () => {
    const sanitized = sanitizeAgentChildEnv({
      PATH: '/usr/bin',
      HOME: '/tmp/isolated',
      HTTP_PROXY: 'http://proxy.example:8080',
      ANTHROPIC_MODEL: 'claude-sonnet-4-6',
      PLAYWRIGHT_BROWSERS_PATH: '/cache/ms-playwright',
      GEMINI_API_KEY: `AIzaSy${'X'.repeat(33)}`,
      GITHUB_TOKEN: `ghp_${'A'.repeat(36)}`,
      GOOGLE_APPLICATION_CREDENTIALS: '/home/user/.config/gcloud/adc.json',
      CUSTOM_ARBITRARY_SECRET: 'do-not-leak',
    });

    assert.strictEqual(sanitized.PATH, '/usr/bin');
    assert.strictEqual(sanitized.HOME, '/tmp/isolated');
    assert.strictEqual(sanitized.HTTP_PROXY, 'http://proxy.example:8080');
    assert.strictEqual(sanitized.ANTHROPIC_MODEL, 'claude-sonnet-4-6');
    assert.strictEqual(sanitized.PLAYWRIGHT_BROWSERS_PATH, '/cache/ms-playwright');
    for (const dropped of ['GEMINI_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS', 'CUSTOM_ARBITRARY_SECRET']) {
      assert.strictEqual(sanitized[dropped], undefined);
    }
  });
});

describe('getAgentCommandAndArgs reasoning effort flags', () => {
  const EFFORT_TEST_KEYS = [
    'ANTIGRAVITY_MODEL',
    'ANTIGRAVITY_EFFORT',
    'ANTHROPIC_MODEL',
    'CLAUDE_EFFORT',
    'CODEX_MODEL',
    'CODEX_EFFORT',
    'JETSKI_MODEL',
    'JETSKI_EFFORT',
    'PI_MODEL',
  ] as const;

  test('injects adapter effort CLI args and enforces conflict checks on tiered model IDs', () => {
    const saved: Record<string, string | undefined> = {};
    for (const k of EFFORT_TEST_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }

    try {
      process.env.ANTIGRAVITY_MODEL = 'gemini-4-argon';
      process.env.ANTIGRAVITY_EFFORT = 'High';
      assert.deepStrictEqual(getAgentCommandAndArgs(Agents.ANTIGRAVITY_CLI, 'build app').commandArgs, [
        '-p',
        'build app',
        '--dangerously-skip-permissions',
        '--model',
        'gemini-4-argon',
        '--effort',
        'high',
      ]);

      process.env.ANTHROPIC_MODEL = 'claude-sonnet-5-5';
      process.env.CLAUDE_EFFORT = 'medium';
      assert.deepStrictEqual(getAgentCommandAndArgs(Agents.CLAUDE_CODE, 'build app').commandArgs, [
        '-p',
        'build app',
        '--dangerously-skip-permissions',
        '--model',
        'claude-sonnet-5-5',
        '--effort',
        'medium',
      ]);

      process.env.CODEX_MODEL = 'gpt-6.1-sol';
      process.env.CODEX_EFFORT = 'xhigh';
      assert.deepStrictEqual(getAgentCommandAndArgs(Agents.CODEX_CLI, 'build app').commandArgs, [
        'exec',
        'build app',
        '--yolo',
        '--model',
        'gpt-6.1-sol',
        '-c',
        'model_reasoning_effort=xhigh',
      ]);

      process.env.JETSKI_MODEL = 'gemini-4-argon';
      process.env.JETSKI_EFFORT = 'max';
      assert.deepStrictEqual(getAgentCommandAndArgs(Agents.JETSKI_CLI, 'build app').commandArgs, [
        '-p',
        'build app',
        '--dangerously-skip-permissions',
        '--model',
        'gemini-4-argon',
        '--effort',
        'max',
      ]);

      process.env.ANTIGRAVITY_MODEL = 'gemini-3.8-flash-medium';
      process.env.ANTIGRAVITY_EFFORT = 'high';
      assert.throws(
        () => getAgentCommandAndArgs(Agents.ANTIGRAVITY_CLI, 'build app'),
        /ANTIGRAVITY_EFFORT=high conflicts with model 'gemini-3\.8-flash-medium'/,
      );
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});




