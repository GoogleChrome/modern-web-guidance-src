import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { buildSandboxPolicy, buildBwrapArgs, wrapCommandInSandbox, UNSAFE_NO_SANDBOX_ENV } from '../lib/sandbox.ts';

function makeFakeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-repo-')));
  const guideDir = path.join(repo, 'guides', 'cat', 'some-guide');
  const targetDir = path.join(repo, 'harness', 'results', 'suite', 'task', 'guided');
  const distDir = path.join(repo, 'dist', 'skills-cli');
  for (const d of [guideDir, targetDir, distDir, path.join(repo, 'node_modules')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'guide.md'), 'SECRET GUIDE');
  fs.writeFileSync(path.join(distDir, 'cli.txt'), 'CLI');
  return { repo, guideDir, targetDir, distDir };
}

test('buildSandboxPolicy exposes dist only for guided runs and the target dir as writable', () => {
  const { repo, targetDir, distDir } = makeFakeRepo();
  try {
    const guided = buildSandboxPolicy(targetDir, 'guided', repo);
    assert.strictEqual(guided.hiddenDir, repo);
    assert.ok(guided.readOnlyPaths.includes(distDir));
    assert.ok(guided.readOnlyPaths.includes(path.join(repo, 'node_modules')));
    assert.deepStrictEqual(guided.writablePaths, [targetDir, path.join(distDir, 'skills', '.cache')]);

    const unguided = buildSandboxPolicy(targetDir, 'unguided', repo);
    assert.ok(!unguided.readOnlyPaths.includes(distDir));
    assert.deepStrictEqual(unguided.writablePaths, [targetDir]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('buildBwrapArgs hides the repo before re-binding exposed paths', () => {
  const fakeRun = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-run-'));
  const userSubDir = path.join(fakeRun, 'user', '1000');
  fs.mkdirSync(userSubDir, { recursive: true });
  try {
    const args = buildBwrapArgs('agent', ['-p', 'hi'], {
      hiddenDir: '/repo',
      readOnlyPaths: ['/repo/node_modules'],
      writablePaths: ['/repo/harness/results/x'],
    }, fakeRun);
    const tmpfsIdx = args.indexOf('--tmpfs');
    assert.strictEqual(args[tmpfsIdx + 1], '/repo');
    assert.ok(args.indexOf('--ro-bind') > tmpfsIdx);
    assert.ok(args.indexOf('--bind') > tmpfsIdx);
    if (process.getuid) {
      assert.ok(args.includes(fakeRun));
      assert.ok(args.includes(path.join(fakeRun, 'user')));
      assert.ok(args.includes(userSubDir));
    }
    assert.deepStrictEqual(args.slice(args.indexOf('--')), ['--', 'agent', '-p', 'hi']);
  } finally {
    fs.rmSync(fakeRun, { recursive: true, force: true });
  }
});

test('wrapCommandInSandbox passes through when GD_UNSAFE_NO_SANDBOX=1', () => {
  const prev = process.env[UNSAFE_NO_SANDBOX_ENV];
  process.env[UNSAFE_NO_SANDBOX_ENV] = '1';
  try {
    const out = wrapCommandInSandbox('agent', ['a'], { hiddenDir: '/r', readOnlyPaths: [], writablePaths: [] }, 'linux');
    assert.deepStrictEqual(out, { command: 'agent', commandArgs: ['a'] });
  } finally {
    if (prev === undefined) delete process.env[UNSAFE_NO_SANDBOX_ENV];
    else process.env[UNSAFE_NO_SANDBOX_ENV] = prev;
  }
});

test('wrapCommandInSandbox throws on unsupported platforms', () => {
  assert.throws(() => wrapCommandInSandbox('agent', [], { hiddenDir: '/r', readOnlyPaths: [], writablePaths: [] }, 'win32'));
});

const canSandbox = (process.platform === 'darwin' && spawnSync('which', ['sandbox-exec']).status === 0)
  || (process.platform === 'linux' && spawnSync('which', ['bwrap']).status === 0);

test('sandboxed process cannot read guides but can use exposed paths', { skip: !canSandbox || process.env[UNSAFE_NO_SANDBOX_ENV] === '1' }, () => {
  const { repo, guideDir, targetDir, distDir } = makeFakeRepo();
  try {
    const script = [
      `cat "${path.join(guideDir, 'guide.md')}" 2>/dev/null || echo NO_GUIDE`,
      `ls "${repo}/guides" 2>/dev/null || echo NO_LIST`,
      `cat "${path.join(distDir, 'cli.txt')}"`,
      `echo WROTE > "${path.join(targetDir, 'out.txt')}" && cat "${path.join(targetDir, 'out.txt')}"`,
    ].join('\n');
    const { command, commandArgs } = wrapCommandInSandbox('/bin/sh', ['-c', script], buildSandboxPolicy(targetDir, 'guided', repo));
    const result = spawnSync(command, commandArgs, { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.ok(!result.stdout.includes('SECRET GUIDE'), `guide leaked: ${result.stdout}`);
    assert.match(result.stdout, /NO_GUIDE/);
    assert.match(result.stdout, /NO_LIST/);
    assert.match(result.stdout, /CLI/);
    assert.match(result.stdout, /WROTE/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
