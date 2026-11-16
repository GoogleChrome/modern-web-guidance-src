import { describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gitExec, readGitObjectsBatch } from './git-utils.ts';
import { initGitRepo } from './patch-utils.ts';

function makeTempRepo(t: import('node:test').TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-utils-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  initGitRepo(dir);
  return dir;
}

describe('readGitObjectsBatch', () => {
  test('returns an empty map for empty specs', () => {
    const res = readGitObjectsBatch(process.cwd(), []);
    assert.strictEqual(res.size, 0);
  });

  test('reads multi-object batches with newlines, empty blobs, CRLF, and missing specs', (t) => {
    const repo = makeTempRepo(t);
    const emptyContent = '';
    const multilineContent = 'line one\n\nline three\r\nline four (no trailing newline)';
    const afterContent = 'after multiline\n';

    fs.writeFileSync(path.join(repo, 'empty.txt'), emptyContent);
    fs.writeFileSync(path.join(repo, 'multiline.txt'), multilineContent);
    fs.writeFileSync(path.join(repo, 'after.txt'), afterContent);
    gitExec(['add', '-A'], { cwd: repo, isolated: true, stdio: 'ignore' });
    gitExec(['commit', '-q', '-m', 'add fixtures'], { cwd: repo, isolated: true, stdio: 'ignore' });

    const specs = [
      'HEAD',
      'HEAD^{tree}',
      'HEAD:empty.txt',
      'HEAD:multiline.txt',
      'HEAD:missing.txt',
      'HEAD:after.txt',
      '0000000000000000000000000000000000000000',
    ];
    const objs = readGitObjectsBatch(repo, specs);

    assert.strictEqual(objs.size, specs.length);
    assert.strictEqual(objs.get('HEAD')?.type, 'commit');
    assert.strictEqual(objs.get('HEAD^{tree}')?.type, 'tree');
    assert.strictEqual(objs.get('HEAD:empty.txt')?.type, 'blob');
    assert.strictEqual(objs.get('HEAD:empty.txt')?.content.toString('utf8'), emptyContent);
    assert.strictEqual(objs.get('HEAD:multiline.txt')?.type, 'blob');
    assert.strictEqual(objs.get('HEAD:multiline.txt')?.content.toString('utf8'), multilineContent);
    assert.strictEqual(objs.get('HEAD:missing.txt'), null);
    assert.strictEqual(objs.get('HEAD:after.txt')?.type, 'blob');
    assert.strictEqual(objs.get('HEAD:after.txt')?.content.toString('utf8'), afterContent);
    assert.strictEqual(objs.get('0000000000000000000000000000000000000000'), null);
  });
});

describe('gitExec', () => {
  test('disables commit signing and global/system config only when isolated', (t) => {
    const repo = makeTempRepo(t);
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'git-utils-home-'));
    t.after(() => fs.rmSync(fakeHome, { recursive: true, force: true }));
    const fakeGlobalCfg = path.join(fakeHome, '.gitconfig');
    fs.writeFileSync(fakeGlobalCfg, '[user]\n\tname = GlobalUser\n[commit]\n\tgpgSign = true\n[gpg]\n\tprogram = /nonexistent-gpg-bin\n');

    gitExec(['config', 'commit.gpgSign', 'true'], { cwd: repo, isolated: true });
    gitExec(['config', 'gpg.program', '/nonexistent-gpg-bin'], { cwd: repo, isolated: true });

    // Isolated execution skips global config (even with HOME set) and commit signing.
    assert.throws(() => {
      gitExec(['config', '--global', 'user.name'], { cwd: repo, isolated: true, env: { HOME: fakeHome }, stdio: 'pipe' });
    });
    gitExec(['commit', '--allow-empty', '-m', 'isolated commit'], {
      cwd: repo,
      isolated: true,
      env: { HOME: fakeHome },
      stdio: 'ignore',
    });

    // Non-isolated execution preserves global config and commit.gpgSign.
    assert.strictEqual(
      gitExec(['config', '--global', 'user.name'], {
        cwd: repo,
        env: { HOME: fakeHome, GIT_CONFIG_GLOBAL: fakeGlobalCfg, GIT_CONFIG_NOSYSTEM: '1' },
      }).trim(),
      'GlobalUser'
    );
    assert.throws(() => {
      gitExec(['commit', '--allow-empty', '-m', 'signed commit'], {
        cwd: repo,
        env: { HOME: fakeHome, GIT_CONFIG_GLOBAL: fakeGlobalCfg, GIT_CONFIG_NOSYSTEM: '1' },
        stdio: 'pipe',
      });
    });
  });
});
