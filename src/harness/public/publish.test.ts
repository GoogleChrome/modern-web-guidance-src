import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkoutPublished, cloneDir, publishPublicEvals, remoteHead, repoFromRemoteUrl } from './publish.ts';

const TEST_USER = { name: 'Example Publisher', email: 'publisher@example.invalid' };
const cacheDirs: string[] = [];

after(() => {
  for (const dir of cacheDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeBareRemote(): string {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-bare-'));
  execFileSync('git', ['init', '--bare', '--quiet', bare]);
  cacheDirs.push(cloneDir(bare));
  return bare;
}

function makeOutDir(files: Record<string, string>): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-pub-out-'));
  for (const [rel, contents] of Object.entries(files)) {
    const target = path.join(outDir, 'public-evals', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return outDir;
}

function seedBranchFile(bareRepo: string, relPath: string, contents: string): void {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-seed-'));
  execFileSync('git', ['init', '--quiet', work]);
  execFileSync('git', ['-C', work, 'checkout', '--quiet', '-b', 'gh-pages']);
  const file = path.join(work, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  execFileSync('git', ['-C', work, 'add', '.']);
  execFileSync('git', ['-C', work, '-c', `user.name=${TEST_USER.name}`, '-c', `user.email=${TEST_USER.email}`, 'commit', '--quiet', '-m', 'seed dashboard']);
  execFileSync('git', ['-C', work, 'push', '--quiet', '--force', bareRepo, 'gh-pages']);
  fs.rmSync(work, { recursive: true, force: true });
}

describe('publishPublicEvals + checkoutPublished', () => {
  test('bootstraps when gh-pages does not exist yet and round-trips via checkoutPublished', async () => {
    const bare = makeBareRemote();
    const emptyCheck = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-empty-'));
    assert.equal(remoteHead(bare), null);
    assert.equal(checkoutPublished(emptyCheck, bare), null);

    const first = makeOutDir({
      'suites.gen.json': '[{"testId":"suite-a"}]\n',
      'suite-a/evals.json': '{"ok":true}\n',
    });
    await publishPublicEvals(first, { repoUrl: bare, message: 'initial publish', expectedHead: null, user: TEST_USER });

    const roundTrip = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-rt-'));
    const head = checkoutPublished(roundTrip, bare);
    assert.match(head ?? '', /^[0-9a-f]{40}$/);
    assert.equal(fs.readFileSync(path.join(roundTrip, 'public-evals', 'suite-a', 'evals.json'), 'utf8'), '{"ok":true}\n');
  });

  test('replaces only public-evals/ and leaves sibling dashboard files untouched', async () => {
    const bare = makeBareRemote();
    seedBranchFile(bare, 'index.html', '<html>dashboard</html>\n');
    const initialHead = remoteHead(bare);
    assert.ok(initialHead);

    const first = makeOutDir({
      'suites.gen.json': '[{"testId":"suite-1"}]\n',
      'suite-1/evals.json': '{"n":1}\n',
    });
    await publishPublicEvals(first, { repoUrl: bare, message: 'publish suite-1', expectedHead: initialHead, user: TEST_USER });

    const secondHead = remoteHead(bare);
    const second = makeOutDir({
      'suites.gen.json': '[{"testId":"suite-2"}]\n',
      'suite-2/evals.json': '{"n":2}\n',
    });
    await publishPublicEvals(second, { repoUrl: bare, message: 'replace with suite-2', expectedHead: secondHead, user: TEST_USER });

    const inspect = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-inspect-'));
    execFileSync('git', ['clone', '--quiet', '--branch', 'gh-pages', bare, inspect]);
    assert.equal(fs.readFileSync(path.join(inspect, 'index.html'), 'utf8'), '<html>dashboard</html>\n');
    assert.ok(!fs.existsSync(path.join(inspect, 'public-evals', 'suite-1')), 'old suite inside public-evals/ is removed');
    assert.equal(fs.readFileSync(path.join(inspect, 'public-evals', 'suite-2', 'evals.json'), 'utf8'), '{"n":2}\n');
    assert.ok(fs.existsSync(path.join(inspect, '.nojekyll')));
    // The branch is one commit holding the whole site, not a growing history.
    assert.equal(execFileSync('git', ['-C', inspect, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(), '1');
  });

  test('publishes modern-web.log even though the deployed dashboard .gitignore excludes *.log', async () => {
    const bare = makeBareRemote();
    seedBranchFile(bare, '.gitignore', '*.log\n');
    const head = remoteHead(bare);
    assert.ok(head);

    const out = makeOutDir({
      'suites.gen.json': '[{"testId":"suite-1"}]\n',
      'suite-1/evals.json': '{"n":1}\n',
      'suite-1/1/security/daily-grind/guided/modern-web.log': 'GET /guides/security\n',
    });
    await publishPublicEvals(out, { repoUrl: bare, message: 'with log', expectedHead: head, user: TEST_USER });

    const inspect = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-inspect-'));
    execFileSync('git', ['clone', '--quiet', '--branch', 'gh-pages', bare, inspect]);
    assert.equal(
      fs.readFileSync(path.join(inspect, 'public-evals', 'suite-1', '1', 'security', 'daily-grind', 'guided', 'modern-web.log'), 'utf8'),
      'GET /guides/security\n',
    );
  });

  test('publishing an identical copy is a no-op, and dot-prefixed entries are not published', async () => {
    const bare = makeBareRemote();
    const out = makeOutDir({
      'suites.gen.json': '[{"testId":"suite-1"}]\n',
      'suite-1/evals.json': '{"n":1}\n',
      '.DS_Store': 'junk',
      'suite-1/.hidden': 'junk',
    });
    const firstResult = await publishPublicEvals(out, { repoUrl: bare, message: 'first', expectedHead: null, user: TEST_USER });
    const head = remoteHead(bare);
    assert.ok(head);
    assert.equal(firstResult, true);

    const secondResult = await publishPublicEvals(out, { repoUrl: bare, message: 'again', expectedHead: head, user: TEST_USER });
    assert.equal(remoteHead(bare), head, 'unchanged content does not create a new commit');
    assert.equal(secondResult, false);

    const inspect = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-inspect-'));
    execFileSync('git', ['clone', '--quiet', '--branch', 'gh-pages', bare, inspect]);
    assert.ok(!fs.existsSync(path.join(inspect, 'public-evals', '.DS_Store')));
    assert.ok(!fs.existsSync(path.join(inspect, 'public-evals', 'suite-1', '.hidden')));
  });

  test('repoFromRemoteUrl parses git and https URLs with fallback', () => {
    assert.equal(repoFromRemoteUrl('git@github.com:GoogleChrome/modern-web-guidance-src.git'), 'GoogleChrome/modern-web-guidance-src');
    assert.equal(repoFromRemoteUrl('https://github.com/GoogleChrome/modern-web-guidance-src.git'), 'GoogleChrome/modern-web-guidance-src');
    assert.equal(repoFromRemoteUrl('https://github.com/GoogleChrome/modern-web-guidance-src'), 'GoogleChrome/modern-web-guidance-src');
    assert.equal(repoFromRemoteUrl('/tmp/local-repo'), 'GoogleChrome/modern-web-guidance-src');
  });

  test('refuses to publish without suites.gen.json or when expectedHead has moved', async () => {
    const bare = makeBareRemote();
    seedBranchFile(bare, 'index.html', '<html>dashboard</html>\n');
    const emptyOut = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-nomf-'));
    await assert.rejects(
      publishPublicEvals(emptyOut, { repoUrl: bare, message: 'missing manifest', user: TEST_USER }),
      /no suites\.gen\.json/,
    );

    const out = makeOutDir({ 'suites.gen.json': '[]\n' });
    await assert.rejects(
      publishPublicEvals(out, { repoUrl: bare, message: 'stale head', expectedHead: '0'.repeat(40), user: TEST_USER }),
      /gh-pages moved while building/,
    );
  });

  test('a branch that moves after the pre-check is not overwritten: the push itself is rejected', async () => {
    const bare = makeBareRemote();
    seedBranchFile(bare, 'index.html', '<html>v1</html>\n');
    const startHead = remoteHead(bare);
    assert.ok(startHead);

    // Pass the pre-check, then move the branch underneath the publish via a filesystem hook:
    // the dotfile filter is evaluated per entry during cpSync, which runs after the pre-check.
    const out = makeOutDir({ 'suites.gen.json': '[{"testId":"suite-1"}]\n', 'suite-1/evals.json': '{"n":1}\n' });
    let moved = false;
    const originalCp = fs.cpSync;
    fs.cpSync = ((...args: Parameters<typeof fs.cpSync>) => {
      if (!moved) {
        moved = true;
        seedBranchFile(bare, 'index.html', '<html>v2 from someone else</html>\n');
      }
      return originalCp(...args);
    }) as typeof fs.cpSync;
    try {
      await assert.rejects(
        publishPublicEvals(out, { repoUrl: bare, message: 'racing publish', expectedHead: startHead, user: TEST_USER }),
        /gh-pages moved while building/,
      );
    } finally {
      fs.cpSync = originalCp;
    }

    const inspect = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-inspect-'));
    execFileSync('git', ['clone', '--quiet', '--branch', 'gh-pages', bare, inspect]);
    assert.equal(fs.readFileSync(path.join(inspect, 'index.html'), 'utf8'), '<html>v2 from someone else</html>\n', 'the other change survived');
    assert.ok(!fs.existsSync(path.join(inspect, 'public-evals', 'suite-1')), 'our racing publish did not land');
  });
});
