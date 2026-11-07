import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PublicAllowlist } from './allowlist.ts';
import {
  buildSelectedSuites,
  buildSuite,
  cleanRelativePath,
  runRelativePath,
  writeManifest,
} from './builder.ts';
import type { BuildOptions } from './builder.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { LeakError } from './scrub.ts';
import { LocalSuiteStore } from './suite-store.ts';
import { CLOUDTOP_HOST, FAKE_LDAP, OTHER_FAKE_LDAP } from './fixtures/leak-samples.ts';
import { FIXTURE_MODEL, FIXTURE_SUITE, makeFixtureStore, PASSKEY_RUN, SECURITY_RUN, write } from './fixtures/make-store.ts';

const SUITE = FIXTURE_SUITE;
const NOW = new Date('2026-10-25T12:00:00Z');

const allowlist: PublicAllowlist = {
  include: ['nightly-*-codex_cli', 'nightly-*-claude_code'],
  exclude: [],
  overrides: [],
  releasedModels: [FIXTURE_MODEL],
};

function makeOptions(overrides: Partial<BuildOptions> = {}): BuildOptions & { storeRoot: string } {
  const { root, baseApps } = makeFixtureStore();
  return {
    store: new LocalSuiteStore(root),
    storeRoot: root,
    outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-out-')),
    allowlist,
    baseAppsDir: baseApps,
    now: NOW,
    ...overrides,
  };
}

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(rel => fs.statSync(path.join(dir, rel)).isFile())
    .sort();
}

describe('runRelativePath', () => {
  test('maps a result key and run number to the suite folder layout', () => {
    assert.equal(runRelativePath('daily-grind - security - guided', 1), '1/security/daily-grind/guided');
    assert.equal(runRelativePath('task - passkey-authentication - unguided', 2), '2/passkey-authentication/task/unguided');
  });

  test('refuses segments that could escape the suite directory or are not plain names', () => {
    for (const key of ['.. - security - guided', 'task - ../../etc - guided', 'task - security - guided/x', 'task - sec urity - guided', 'task - . - guided', 'task - security']) {
      assert.throws(() => runRelativePath(key, 1), /Unsafe path segment/, key);
    }
  });
});

describe('cleanRelativePath', () => {
  test('accepts plain relative paths and rejects anything that could leave the directory', () => {
    assert.equal(cleanRelativePath('index.html'), 'index.html');
    assert.equal(cleanRelativePath('src/app/main.ts'), 'src/app/main.ts');
    assert.equal(cleanRelativePath('.env.local'), '.env.local');
    // Unusual but legitimate file names stay; containment is enforced when the path is resolved.
    assert.equal(cleanRelativePath('app/[id]/page.tsx'), 'app/[id]/page.tsx');
    assert.equal(cleanRelativePath('src/routes/+page.svelte'), 'src/routes/+page.svelte');
    assert.equal(cleanRelativePath('dir name/x'), 'dir name/x');
    for (const bad of ['', '/etc/passwd', '../x', 'a/../b', './a', 'a//b', 'a\\b', '.', '..', 'a/', 'a\0b']) {
      assert.equal(cleanRelativePath(bad), undefined, JSON.stringify(bad));
    }
  });
});

describe('buildSuite', () => {
  test('writes only evals.json, agent.patch and modern-web.log', async () => {
    const options = makeOptions();
    const result = await buildSuite(SUITE, options);
    assert.equal(result.status, 'built', result.reason);

    const suiteDir = path.join(options.outDir, 'public-evals', SUITE);
    assert.deepEqual(listFiles(suiteDir), [
      `${PASSKEY_RUN}/agent.patch`,
      `${PASSKEY_RUN}/modern-web.log`,
      `${SECURITY_RUN}/agent.patch`,
      `${SECURITY_RUN}/modern-web.log`,
      'evals.json',
    ]);
    assert.equal(result.files, 5);
  });

  test('filters captured patches and scrubs logs', async () => {
    const options = makeOptions();
    await buildSuite(SUITE, options);
    const suiteDir = path.join(options.outDir, 'public-evals', SUITE);

    const patch = fs.readFileSync(path.join(suiteDir, SECURITY_RUN, 'agent.patch'), 'utf8');
    assert.ok(patch.includes('a/src/app.ts'));
    assert.ok(!patch.includes('pnpm-lock.yaml'));

    const log = fs.readFileSync(path.join(suiteDir, SECURITY_RUN, 'modern-web.log'), 'utf8');
    assert.equal(log, 'GET /guides/security from guides\n');
  });

  test('harvests usernames from rewritten paths and rejects bare occurrences across the suite', async () => {
    // `makeFixtureStore` puts `/usr/local/google/home/${FAKE_LDAP}/...` in SECURITY_RUN's modern-web.log.
    // Even without `forbiddenTokens` configured, a bare mention of `FAKE_LDAP` in another run or evals.json must fail.
    const inOtherRun = makeOptions();
    write(path.join(inOtherRun.storeRoot, SUITE, PASSKEY_RUN, 'modern-web.log'), `ran as ${OTHER_FAKE_LDAP}\n`);
    write(
      path.join(inOtherRun.storeRoot, SUITE, SECURITY_RUN, 'modern-web.log'),
      `GET /guides/security from /home/${OTHER_FAKE_LDAP}/modern-web-guidance-src/guides\n`,
    );
    const res1 = await buildSuite(SUITE, inOtherRun);
    assert.equal(res1.status, 'skipped');
    assert.equal(res1.code, 'leak');
    assert.match(res1.reason ?? '', /forbidden token/);
    assert.ok(!fs.existsSync(path.join(inOtherRun.outDir, 'public-evals', SUITE)));

    // Also when the path is only in a run artifact and the bare name is in evals.json.
    const inEvals = makeOptions();
    const evalsPath = path.join(inEvals.storeRoot, SUITE, 'evals.json');
    const raw = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
    raw.results['daily-grind - security - guided'][0].prompt = `authored by ${FAKE_LDAP}`;
    fs.writeFileSync(evalsPath, JSON.stringify(raw));
    const res2 = await buildSuite(SUITE, inEvals);
    assert.equal(res2.status, 'skipped');
    assert.equal(res2.code, 'leak');
    assert.match(res2.reason ?? '', /forbidden token/);
  });

  test('generates a diff against the base app for legacy runs', async () => {
    const options = makeOptions();
    await buildSuite(SUITE, options);
    const patch = fs.readFileSync(path.join(options.outDir, 'public-evals', SUITE, PASSKEY_RUN, 'agent.patch'), 'utf8');
    assert.ok(patch.startsWith('diff --git a/index.html b/index.html\n'));
    assert.match(patch, /^-<p>base version<\/p>$/m);
    assert.match(patch, /^\+<p>agent version<\/p>$/m);
  });

  test('a legacy run whose targetFile or baseApp escapes its directory gets no patch', async () => {
    const options = makeOptions();
    // A file outside the base apps dir that a traversing targetFile would otherwise read.
    const secret = path.join(path.dirname(options.baseAppsDir!), 'outside.txt');
    fs.writeFileSync(secret, 'outside the base apps\n');
    const evalsPath = path.join(options.storeRoot, SUITE, 'evals.json');
    const raw = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
    const [run] = raw.results['task - passkey-authentication - guided'];
    const outsideRel = `../${path.basename(secret)}`;
    write(path.join(options.storeRoot, SUITE, PASSKEY_RUN, path.basename(secret)), 'agent copy\n');

    for (const bad of [
      { ...run, targetFile: outsideRel },
      { ...run, targetFile: '/etc/hostname' },
      { ...run, targetFile: 'dir\\index.html' },
      { ...run, targetFile: '.' },
      { ...run, baseApp: '../..' },
    ]) {
      raw.results['task - passkey-authentication - guided'] = [bad];
      fs.writeFileSync(evalsPath, JSON.stringify(raw));
      fs.rmSync(path.join(options.outDir, 'public-evals'), { recursive: true, force: true });
      const result = await buildSuite(SUITE, options);
      assert.equal(result.status, 'built', JSON.stringify(bad));
      assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE, PASSKEY_RUN, 'agent.patch')), JSON.stringify(bad));
      const evals = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json'), 'utf8')) as PublicEvals;
      assert.deepEqual(evals.results['task - passkey-authentication - guided'][0].files, ['modern-web.log'], JSON.stringify(bad));
    }
  });

  test('a legacy run whose target is a directory in the base app is diffed as a new file, not a crash', async () => {
    const options = makeOptions();
    fs.mkdirSync(path.join(options.baseAppsDir!, 'daily-grind', 'index.html.d'));
    const evalsPath = path.join(options.storeRoot, SUITE, 'evals.json');
    const raw = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
    raw.results['task - passkey-authentication - guided'][0].targetFile = 'index.html.d';
    fs.writeFileSync(evalsPath, JSON.stringify(raw));
    write(path.join(options.storeRoot, SUITE, PASSKEY_RUN, 'index.html.d'), 'agent wrote a file here\n');

    const result = await buildSuite(SUITE, options);
    assert.equal(result.status, 'built', result.reason);
    const patch = fs.readFileSync(path.join(options.outDir, 'public-evals', SUITE, PASSKEY_RUN, 'agent.patch'), 'utf8');
    assert.ok(patch.includes('new file mode'));
  });

  test('records written artifacts on each public run and strips private fields', async () => {
    const options = makeOptions();
    await buildSuite(SUITE, options);
    const evals = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json'), 'utf8')) as PublicEvals;

    assert.deepEqual(evals.results['daily-grind - security - guided'][0].files, ['agent.patch', 'modern-web.log']);
    assert.deepEqual(evals.results['task - passkey-authentication - guided'][0].files, ['agent.patch', 'modern-web.log']);
    assert.deepEqual(evals.results['daily-grind - security - unguided'][0].files, []);
    assert.ok(!('serving' in evals));
    assert.ok(!('targetFile' in evals.results['daily-grind - security - guided'][0]));
  });

  test('skips an unreleased model with a reason and leaves no output', async () => {
    const options = makeOptions();
    const result = await buildSuite('nightly-2026-10-21_00-00-00-claude_code', options);
    assert.equal(result.status, 'skipped');
    assert.match(result.reason ?? '', /secret-model/);
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', 'nightly-2026-10-21_00-00-00-claude_code')));
  });

  test('skips and removes partial output when an artifact still leaks', async () => {
    const options = makeOptions();
    write(path.join(options.storeRoot, SUITE, PASSKEY_RUN, 'modern-web.log'), `host ${CLOUDTOP_HOST}\n`);

    const result = await buildSuite(SUITE, options);
    assert.equal(result.status, 'skipped');
    assert.match(result.reason ?? '', /googlers hostname/);
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));
  });

  test('skips when a forbidden token appears in a suite id', async () => {
    const options = makeOptions({ forbiddenTokens: ['codex_cli'] });
    const result = await buildSuite(SUITE, options);
    assert.equal(result.status, 'skipped');
    assert.match(result.reason ?? '', /forbidden token/);
  });

  test('applies excludeGuides from the allowlist', async () => {
    const options = makeOptions({
      allowlist: { ...allowlist, overrides: [{ id: SUITE, excludeGuides: ['security'] }] },
    });
    await buildSuite(SUITE, options);
    const suiteDir = path.join(options.outDir, 'public-evals', SUITE);
    assert.ok(!fs.existsSync(path.join(suiteDir, SECURITY_RUN)));
    const evals = JSON.parse(fs.readFileSync(path.join(suiteDir, 'evals.json'), 'utf8')) as PublicEvals;
    assert.ok(Object.keys(evals.results).every(key => !key.includes(' - security - ')));
  });

  test('reports a missing evals.json as skipped', async () => {
    const options = makeOptions();
    const result = await buildSuite('nightly-2026-01-01_00-00-00-codex_cli', options);
    assert.deepEqual([result.status, result.reason], ['skipped', 'no evals.json']);
  });
});

describe('buildSelectedSuites + writeManifest', () => {
  test('builds only allowlisted suites and writes a manifest over what was built', async () => {
    const options = makeOptions();
    const results = await buildSelectedSuites(options);

    assert.deepEqual(
      results.map(result => [result.suiteId, result.status]).sort(),
      [
        [SUITE, 'built'],
        ['nightly-2026-10-21_00-00-00-claude_code', 'skipped'],
      ],
    );

    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.equal(manifest.length, 1);
    assert.equal(manifest[0].testId, SUITE);
    assert.equal(manifest[0].model, 'example-model');
    assert.ok(manifest[0].guidedStats.total > 0);
  });

  test('writeManifest reflects the directories present, so removing a suite removes its entry', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    fs.rmSync(path.join(options.outDir, 'public-evals', SUITE), { recursive: true });
    assert.equal(writeManifest(options.outDir, []), 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.deepEqual(manifest, []);
  });
});

describe('incremental builds', () => {
  function stateFor(outDir: string) {
    return JSON.parse(fs.readFileSync(path.join(outDir, 'public-evals', 'build-state.json'), 'utf8'));
  }

  test('second run leaves unchanged suites alone and preserves their state entry', async () => {
    const options = makeOptions();
    const first = await buildSelectedSuites(options);
    assert.equal(first.find(r => r.suiteId === SUITE)?.status, 'built');
    const firstGen = stateFor(options.outDir).suites[SUITE].generation;
    assert.ok(firstGen);
    assert.equal(stateFor(options.outDir).forbiddenTokensVersion, 0);

    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'unchanged');
    assert.equal(stateFor(options.outDir).suites[SUITE]?.generation, firstGen, 'unchanged run preserves recorded state');
    assert.equal(second.find(r => r.suiteId === 'nightly-2026-10-21_00-00-00-claude_code')?.status, 'skipped');
  });

  test('bumping forbiddenTokensVersion or changing builderVersion triggers a rebuild', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);

    const bumped = await buildSelectedSuites({ ...options, forbiddenTokensVersion: 1 });
    assert.equal(bumped.find(r => r.suiteId === SUITE)?.status, 'built');
    assert.equal(stateFor(options.outDir).forbiddenTokensVersion, 1);

    const statePath = path.join(options.outDir, 'public-evals', 'build-state.json');
    const tampered = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    tampered.builderVersion = '000000000000';
    fs.writeFileSync(statePath, JSON.stringify(tampered));

    const rebuilt = await buildSelectedSuites({ ...options, forbiddenTokensVersion: 1 });
    assert.equal(rebuilt.find(r => r.suiteId === SUITE)?.status, 'built');
  });

  test('a skipped suite is remembered and not re-fetched until its inputs change', async () => {
    const options = makeOptions();
    const unreleased = 'nightly-2026-10-21_00-00-00-claude_code';
    const reads: string[] = [];
    const inner = options.store;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => { reads.push(relPath); return inner.readFile(relPath); },
    };

    await buildSelectedSuites(options);
    const remembered = stateFor(options.outDir).suites[unreleased].skipped;
    assert.equal(remembered.code, 'unreleased-model');
    assert.ok(!JSON.stringify(stateFor(options.outDir)).includes('secret-model'), 'state must not quote the rejected model');

    reads.length = 0;
    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === unreleased)?.status, 'skipped');
    assert.deepEqual(reads.filter(r => r.startsWith(unreleased)), [], 'skipped suite must not be fetched again');

    // Releasing the model is a reason to try again.
    const released = { ...options, allowlist: { ...allowlist, releasedModels: [FIXTURE_MODEL, 'secret-model'] } };
    const third = await buildSelectedSuites(released);
    assert.equal(third.find(r => r.suiteId === unreleased)?.status, 'built');
  });

  test('un-releasing a model takes an already published suite down', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    assert.ok(fs.existsSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json')));

    const withdrawn = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, releasedModels: [] } });
    const mine = withdrawn.find(r => r.suiteId === SUITE);
    assert.equal(mine?.status, 'skipped');
    assert.equal(mine?.code, 'unreleased-model');
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.deepEqual(manifest, []);
  });

  test('a changed raw evals.json triggers a rebuild', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const evalsPath = path.join(options.storeRoot, SUITE, 'evals.json');
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(evalsPath, future, future);

    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'built');
  });

  test('a new excludeGuides override triggers a rebuild', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const withOverride = { ...options, allowlist: { ...allowlist, overrides: [{ id: SUITE, excludeGuides: ['security'] }] } };
    const second = await buildSelectedSuites(withOverride);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'built');
    assert.deepEqual(stateFor(options.outDir).suites[SUITE].excludeGuides, ['security']);
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE, SECURITY_RUN)));
  });

  test('--force rebuilds an unchanged suite', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const forced = await buildSelectedSuites({ ...options, force: true });
    assert.equal(forced.find(r => r.suiteId === SUITE)?.status, 'built');
  });

  test('a suite that drops out of selection is removed from disk, state, and manifest', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const excluded = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, exclude: [SUITE] } });
    assert.equal(excluded.find(r => r.suiteId === SUITE)?.status, 'removed');
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));
    assert.ok(!(SUITE in stateFor(options.outDir).suites));
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.deepEqual(manifest, []);
  });

  test('retention uses the run time in the suite id, not the file mtime', async () => {
    const options = makeOptions();
    // The fixture id says 2026-10-20 and NOW is 2026-10-25; maxAgeDays: 1 drops it despite fresh mtime.
    const results = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, retention: { maxAgeDays: 1 } } });
    assert.equal(results.find(r => r.suiteId === SUITE), undefined);
  });

  test('maxSuites counts publishable suites, so an unreleased newer suite does not use up a slot', async () => {
    const options = makeOptions();
    const unreleased = 'nightly-2026-10-21_00-00-00-claude_code';
    const retained = { ...options, allowlist: { ...allowlist, retention: { maxSuites: 1 } } };

    const first = await buildSelectedSuites(retained);
    assert.equal(first.find(r => r.suiteId === SUITE)?.status, 'built', 'the older released suite fills the one slot');
    assert.equal(first.find(r => r.suiteId === unreleased)?.code, 'unreleased-model');

    // Releasing the newer model displaces the older suite; the older one is remembered as deferred, not re-fetched.
    const reads: string[] = [];
    const inner = options.store;
    retained.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => { reads.push(relPath); return inner.readFile(relPath); },
    };
    const released = await buildSelectedSuites({ ...retained, allowlist: { ...retained.allowlist, releasedModels: [FIXTURE_MODEL, 'secret-model'] } });
    assert.equal(released.find(r => r.suiteId === unreleased)?.status, 'built');
    assert.equal(released.find(r => r.suiteId === SUITE)?.status, 'removed');
    assert.equal(stateFor(options.outDir).suites[SUITE].deferred, true);

    reads.length = 0;
    const again = await buildSelectedSuites({ ...retained, allowlist: { ...retained.allowlist, releasedModels: [FIXTURE_MODEL, 'secret-model'] } });
    assert.equal(again.find(r => r.suiteId === unreleased)?.status, 'unchanged');
    assert.deepEqual(reads.filter(r => r.startsWith(SUITE)), [], 'deferred suite is not fetched to be classified again');
  });

  test('maxSuitesPerAgent keeps every agent represented when one agent out-produces the others', async () => {
    const options = makeOptions();
    const fixture = JSON.parse(fs.readFileSync(path.join(options.storeRoot, SUITE, 'evals.json'), 'utf8'));
    // Three newer codex nightlies and one older claude nightly, all on the released model.
    const codex = ['nightly-2026-10-24_00-00-00-codex_cli', 'nightly-2026-10-23_00-00-00-codex_cli', 'nightly-2026-10-22_00-00-00-codex_cli'];
    const claude = 'nightly-2026-10-19_00-00-00-claude_code';
    for (const id of codex) write(path.join(options.storeRoot, id, 'evals.json'), JSON.stringify(fixture));
    write(path.join(options.storeRoot, claude, 'evals.json'), JSON.stringify({ ...fixture, agent: 'claude_code' }));

    // Global cap alone: the three newest codex suites take every slot and claude is aged out.
    const globalOnly = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, retention: { maxSuites: 3 } } });
    assert.deepEqual(globalOnly.filter(r => r.status === 'built').map(r => r.suiteId).sort(), [...codex].sort());
    assert.equal(globalOnly.find(r => r.suiteId === claude), undefined, 'deferred suites produce no result');
    assert.equal(stateFor(options.outDir).suites[claude].deferred, true);

    // Per-agent cap first: two codex, then claude fits in the remaining global slot.
    const perAgent = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, retention: { maxSuites: 3, maxSuitesPerAgent: 2 } } });
    const built = new Set(perAgent.filter(r => r.status === 'built' || r.status === 'unchanged').map(r => r.suiteId));
    assert.deepEqual([...built].sort(), [codex[0], codex[1], claude].sort());
    assert.equal(perAgent.find(r => r.suiteId === codex[2])?.status, 'removed');
    const state = stateFor(options.outDir);
    assert.equal(state.suites[claude].agent, 'claude_code');
    assert.equal(state.suites[claude].model, FIXTURE_MODEL);
    assert.equal(state.suites[codex[2]].deferred, true);
    assert.equal(state.suites[codex[2]].agent, 'codex_cli', 'deferred suites record their agent so later runs rank them without a download');

    // The deferred agent is read from state, not evals.json, on the next run.
    const reads: string[] = [];
    const inner = options.store;
    const spying = { ...options, store: { listSuites: () => inner.listSuites(), readFile: (rel: string) => { reads.push(rel); return inner.readFile(rel); } } };
    await buildSelectedSuites({ ...spying, allowlist: { ...allowlist, retention: { maxSuites: 3, maxSuitesPerAgent: 2 } } });
    assert.deepEqual(reads.filter(r => r.startsWith(codex[2])), []);
  });

  test('releasing an additional model does not rebuild suites whose own model was already released', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    assert.equal(stateFor(options.outDir).suites[SUITE].model, FIXTURE_MODEL);

    const reads: string[] = [];
    const inner = options.store;
    options.store = { listSuites: () => inner.listSuites(), readFile: (rel: string) => { reads.push(rel); return inner.readFile(rel); } };

    const widened = { ...options, allowlist: { ...allowlist, releasedModels: [FIXTURE_MODEL, 'secret-model'] } };
    const second = await buildSelectedSuites(widened);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'unchanged', 'its own model is still released');
    assert.deepEqual(reads.filter(r => r.startsWith(SUITE)), [], 'not re-downloaded');
    assert.equal(second.find(r => r.suiteId === 'nightly-2026-10-21_00-00-00-claude_code')?.status, 'built', 'the newly released suite is');

    // Dropping the suite's own model still takes it down.
    const narrowed = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, releasedModels: ['secret-model'] } });
    assert.equal(narrowed.find(r => r.suiteId === SUITE)?.code, 'unreleased-model');
    assert.equal(stateFor(options.outDir).suites[SUITE].model, undefined, 'a skipped suite records no model');
  });

  test('a published suite that fails transiently at the gate keeps its maxSuites slot without churning an older suite', async () => {
    const options = makeOptions({ allowlist: { ...allowlist, retention: { maxSuites: 1 } } });
    const newer = 'nightly-2026-10-22_00-00-00-codex_cli';
    fs.cpSync(path.join(options.storeRoot, SUITE), path.join(options.storeRoot, newer), { recursive: true });

    const first = await buildSelectedSuites(options);
    assert.equal(first.find(r => r.suiteId === newer)?.status, 'built');
    assert.equal(stateFor(options.outDir).suites[SUITE]?.deferred, true);
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));

    // Transient gate failure on `newer` when forced to re-read: `newer` stays published and `SUITE` stays deferred.
    const inner = options.store;
    let failNewer = true;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => {
        if (failNewer && relPath === `${newer}/evals.json`) {
          throw new Error('storage unavailable');
        }
        return inner.readFile(relPath);
      },
    };
    const transient = await buildSelectedSuites({ ...options, force: true });
    assert.equal(transient.find(r => r.suiteId === newer)?.status, 'failed');
    assert.equal(transient.find(r => r.suiteId === SUITE), undefined, 'older deferred suite is not built');
    assert.ok(fs.existsSync(path.join(options.outDir, 'public-evals', newer, 'evals.json')), 'newer copy stays on disk');
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)), 'older suite was not churned in');
    assert.equal(stateFor(options.outDir).suites[SUITE]?.deferred, true);

    failNewer = false;
    const recovered = await buildSelectedSuites(options);
    assert.equal(recovered.find(r => r.suiteId === newer)?.status, 'built');
    assert.equal(recovered.find(r => r.suiteId === SUITE), undefined);
  });

  test('a suite whose id trips the leak check is skipped and kept out of state', async () => {
    const options = makeOptions();
    const leakyId = `nightly-2026-10-22_00-00-00-${CLOUDTOP_HOST}-codex_cli`;
    fs.cpSync(path.join(options.storeRoot, SUITE), path.join(options.storeRoot, leakyId), { recursive: true });

    const results = await buildSelectedSuites(options);
    const leaky = results.find(r => r.suiteId === leakyId);
    assert.equal(leaky?.status, 'skipped');
    assert.equal(leaky?.code, 'suite-id');
    assert.ok(!fs.readFileSync(path.join(options.outDir, 'public-evals', 'build-state.json'), 'utf8').includes(CLOUDTOP_HOST));
  });

  test('a leaking id is rejected before the model gate, so it is neither remembered nor fetched', async () => {
    const options = makeOptions();
    const leakyId = `nightly-2026-10-22_00-00-00-${CLOUDTOP_HOST}-claude_code`;
    fs.cpSync(path.join(options.storeRoot, 'nightly-2026-10-21_00-00-00-claude_code'), path.join(options.storeRoot, leakyId), { recursive: true });
    const reads: string[] = [];
    const inner = options.store;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => { reads.push(relPath); return inner.readFile(relPath); },
    };

    const results = await buildSelectedSuites(options);
    const leaky = results.find(r => r.suiteId === leakyId);
    assert.equal(leaky?.code, 'suite-id', 'the id check wins over the unreleased model');
    assert.deepEqual(reads.filter(r => r.startsWith(leakyId)), []);
    assert.ok(!fs.readFileSync(path.join(options.outDir, 'public-evals', 'build-state.json'), 'utf8').includes(CLOUDTOP_HOST));
  });

  test('a leaking id never takes a retention slot or a deferred entry', async () => {
    const options = makeOptions({ allowlist: { ...allowlist, retention: { maxSuites: 1 } } });
    const leakyId = `nightly-2026-10-22_00-00-00-${CLOUDTOP_HOST}-codex_cli`;
    fs.cpSync(path.join(options.storeRoot, SUITE), path.join(options.storeRoot, leakyId), { recursive: true });

    const results = await buildSelectedSuites(options);
    assert.equal(results.find(r => r.suiteId === SUITE)?.status, 'built', 'the clean, older suite gets the one slot');
    assert.ok(!fs.readFileSync(path.join(options.outDir, 'public-evals', 'build-state.json'), 'utf8').includes(CLOUDTOP_HOST));
  });

  test('a suite that fails at the gate keeps its published copy and is reported once', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const inner = options.store;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => {
        if (relPath === `${SUITE}/evals.json`) {
          throw new Error('storage unavailable');
        }
        return inner.readFile(relPath);
      },
    };

    const retried = await buildSelectedSuites({ ...options, force: true });
    assert.deepEqual(retried.filter(r => r.suiteId === SUITE).map(r => r.status), ['failed']);
    assert.ok(fs.existsSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json')), 'old copy stays');
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.deepEqual(manifest.map((entry: { testId: string }) => entry.testId), [SUITE], 'old copy stays listed');
    assert.ok(!(SUITE in stateFor(options.outDir).suites), 'not remembered, so it is retried');
  });

  test('a suite removed by policy is reported once, not also as removed', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const withdrawn = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, releasedModels: [] } });
    assert.deepEqual(withdrawn.filter(r => r.suiteId === SUITE).map(r => r.status), ['skipped']);
  });

  test('the gate hands its parsed evals.json to the build, so a forced rebuild downloads it once', async () => {
    const options = makeOptions();
    const reads: string[] = [];
    const inner = options.store;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => { reads.push(relPath); return inner.readFile(relPath); },
    };
    await buildSelectedSuites({ ...options, force: true });
    assert.equal(reads.filter(r => r === `${SUITE}/evals.json`).length, 1);
  });

  test('a result key that would escape the suite directory fails the suite', async () => {
    const options = makeOptions();
    const evalsPath = path.join(options.storeRoot, SUITE, 'evals.json');
    const raw = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
    raw.results['daily-grind - ../../escape - guided'] = raw.results['daily-grind - security - guided'];
    fs.writeFileSync(evalsPath, JSON.stringify(raw));

    const results = await buildSelectedSuites(options);
    const mine = results.find(r => r.suiteId === SUITE);
    assert.equal(mine?.status, 'failed');
    assert.match(mine?.reason ?? '', /Unsafe path segment/);
    assert.ok(!fs.existsSync(path.join(options.outDir, 'escape')));
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));
  });

  test('the manifest is leak-checked even when its entries are reused from the previous manifest', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const manifestPath = path.join(options.outDir, 'public-evals', 'suites.gen.json');
    const entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    entries[0].model = `run on ${CLOUDTOP_HOST}`;
    fs.writeFileSync(manifestPath, JSON.stringify(entries));

    await assert.rejects(buildSelectedSuites(options), LeakError);
    assert.throws(() => writeManifest(options.outDir, []), LeakError);

    entries[0].model = `run by ${FAKE_LDAP}`;
    fs.writeFileSync(manifestPath, JSON.stringify(entries));
    assert.equal(writeManifest(options.outDir, []), 1, 'a bare name is only a leak when it is a forbidden token');
    assert.throws(() => writeManifest(options.outDir, [], [FAKE_LDAP]), LeakError);
  });

  test('an unexpected store error is reported as failed, not remembered, and leaves no output', async () => {
    const options = makeOptions();
    const inner = options.store;
    let fail = true;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => {
        if (fail && relPath.endsWith('modern-web.log')) {
          throw new Error('storage unavailable');
        }
        return inner.readFile(relPath);
      },
    };

    const first = await buildSelectedSuites(options);
    assert.equal(first.find(r => r.suiteId === SUITE)?.status, 'failed');
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals', SUITE)));
    assert.ok(!(SUITE in stateFor(options.outDir).suites));

    fail = false;
    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'built');
  });

  test('a transient failure keeps the previously published copy of the suite', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const inner = options.store;
    options.store = {
      listSuites: () => inner.listSuites(),
      readFile: (relPath: string) => {
        if (relPath.endsWith('modern-web.log')) {
          throw new Error('storage unavailable');
        }
        return inner.readFile(relPath);
      },
    };

    const retried = await buildSelectedSuites({ ...options, force: true });
    assert.equal(retried.find(r => r.suiteId === SUITE)?.status, 'failed');
    assert.ok(fs.existsSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json')), 'old copy stays');
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.equal(manifest.length, 1, 'old copy stays listed');
    assert.ok(!fs.existsSync(path.join(options.outDir, 'public-evals-staging', SUITE)), 'staging is cleaned up');
  });

  test('a suite directory without evals.json is rebuilt', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const suiteDir = path.join(options.outDir, 'public-evals', SUITE);
    fs.rmSync(path.join(suiteDir, 'evals.json'));

    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'built');
    assert.ok(fs.existsSync(path.join(suiteDir, 'evals.json')));
  });

  test('manifest reuses previous entries without re-reading evals.json', async () => {
    const options = makeOptions();
    await buildSelectedSuites(options);
    const manifestPath = path.join(options.outDir, 'public-evals', 'suites.gen.json');
    const before = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // Corrupt the on-disk evals.json: if writeManifest re-parsed it, this would throw.
    fs.writeFileSync(path.join(options.outDir, 'public-evals', SUITE, 'evals.json'), '{not json');
    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'unchanged');
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), before);
  });
});
