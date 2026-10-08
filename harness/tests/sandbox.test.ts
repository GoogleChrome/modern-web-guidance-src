import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { buildSandboxPolicy, buildBwrapArgs, defaultExtraHiddenPaths, wrapCommandInSandbox, UNSAFE_NO_SANDBOX_ENV } from '../lib/sandbox.ts';

function makeFakeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-repo-')));
  const guideDir = path.join(repo, 'guides', 'cat', 'some-guide');
  const targetDir = path.join(repo, 'results', 'suites', 'suite', 'task', 'guided');
  const distDir = path.join(repo, 'dist', 'skills-cli');
  for (const d of [guideDir, targetDir, distDir, path.join(repo, 'node_modules')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(guideDir, 'guide.md'), 'SECRET GUIDE');
  fs.writeFileSync(path.join(distDir, 'cli.txt'), 'CLI');
  return { repo, guideDir, targetDir, distDir };
}

test('buildSandboxPolicy exposes dist only for guided runs and the target dir as writable', () => {
  const { repo, targetDir, distDir } = makeFakeRepo();
  try {
    const guided = buildSandboxPolicy(targetDir, 'guided', repo, []);
    assert.strictEqual(guided.hiddenDir, repo);
    assert.ok(guided.readOnlyPaths.includes(distDir));
    assert.ok(guided.readOnlyPaths.includes(path.join(repo, 'node_modules')));
    assert.deepStrictEqual(guided.writablePaths, [targetDir]);

    const unguided = buildSandboxPolicy(targetDir, 'unguided', repo, []);
    assert.ok(!unguided.readOnlyPaths.includes(distDir));
    assert.deepStrictEqual(unguided.writablePaths, [targetDir]);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('buildSandboxPolicy re-exposes an isolated HOME inside /tmp when /tmp is hidden', () => {
  const { repo, targetDir } = makeFakeRepo();
  const fakeHome = fs.realpathSync(fs.mkdtempSync('/tmp/ghh-test-'));
  const prevHome = process.env.HOME;
  process.env.HOME = fakeHome;
  try {
    const policy = buildSandboxPolicy(targetDir, 'unguided', repo, ['/tmp']);
    assert.ok(policy.extraHiddenPaths?.includes(fs.realpathSync('/tmp')));
    assert.ok(policy.writablePaths.includes(fakeHome));
  } finally {
    process.env.HOME = prevHome;
    fs.rmSync(fakeHome, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('defaultExtraHiddenPaths isolates /tmp on Linux, Playwright cache on macOS, and real ~/.gemini', () => {
  const realGemini = path.join(os.userInfo().homedir, '.gemini');
  const linuxPaths = defaultExtraHiddenPaths('linux');
  assert.deepStrictEqual(linuxPaths, ['/tmp', realGemini]);

  const darwinPaths = defaultExtraHiddenPaths('darwin');
  assert.ok(darwinPaths.includes(realGemini));
  if (process.geteuid && !process.env.PWTEST_CACHE_DIR) {
    const cache = path.join(os.tmpdir(), `playwright-transform-cache-${process.geteuid()}`);
    assert.ok(darwinPaths.includes(cache));
    assert.ok(fs.existsSync(cache));
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
      writablePaths: ['/repo/results/suites/x'],
      extraHiddenPaths: ['/tmp'],
    }, fakeRun);
    const tmpfsIdx = args.indexOf('--tmpfs');
    assert.strictEqual(args[tmpfsIdx + 1], '/repo');
    const extraIdx = args.indexOf('/tmp');
    assert.strictEqual(args[extraIdx - 1], '--tmpfs');
    assert.ok(args.indexOf('--ro-bind') > extraIdx);
    assert.ok(args.indexOf('--bind') > extraIdx);
    if (process.getuid) {
      assert.ok(args.includes(fakeRun));
      assert.ok(args.includes(path.join(fakeRun, 'user')));
      assert.ok(args.includes(userSubDir));
      assert.strictEqual(args[args.indexOf(userSubDir) - 1], '--bind-try', '/run entries must use --bind-try');
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

test('sandboxed process cannot read guides or extra hidden dirs but can use exposed paths', { skip: !canSandbox || process.env[UNSAFE_NO_SANDBOX_ENV] === '1' }, () => {
  const { repo, guideDir, targetDir, distDir } = makeFakeRepo();
  const graderCache = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-grader-cache-')));
  fs.writeFileSync(path.join(graderCache, 'grader.js'), 'SECRET GRADER');
  try {
    const script = [
      `cat "${path.join(guideDir, 'guide.md')}" 2>/dev/null || echo NO_GUIDE`,
      `ls "${repo}/guides" 2>/dev/null || echo NO_LIST`,
      `cat "${path.join(graderCache, 'grader.js')}" 2>/dev/null || echo NO_GRADER`,
      `cat "${path.join(distDir, 'cli.txt')}"`,
      `echo WROTE > "${path.join(targetDir, 'out.txt')}" && cat "${path.join(targetDir, 'out.txt')}"`,
    ].join('\n');
    const policy = buildSandboxPolicy(
      targetDir,
      'guided',
      repo,
      process.platform === 'linux' ? ['/tmp'] : [graderCache]
    );
    const { command, commandArgs } = wrapCommandInSandbox('/bin/sh', ['-c', script], policy);
    const result = spawnSync(command, commandArgs, { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.ok(!result.stdout.includes('SECRET GUIDE'), `guide leaked: ${result.stdout}`);
    assert.ok(!result.stdout.includes('SECRET GRADER'), `grader cache leaked: ${result.stdout}`);
    assert.match(result.stdout, /NO_GUIDE/);
    assert.match(result.stdout, /NO_LIST/);
    assert.match(result.stdout, /NO_GRADER/);
    assert.match(result.stdout, /CLI/);
    assert.match(result.stdout, /WROTE/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(graderCache, { recursive: true, force: true });
  }
});
