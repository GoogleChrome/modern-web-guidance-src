import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PublicAllowlist } from './allowlist.ts';
import { buildSelectedSuites, buildSuite, runRelativePath, writeManifest } from './builder.ts';
import type { BuildOptions } from './builder.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { LocalSuiteStore } from './suite-store.ts';
import { CLOUDTOP_HOST } from './fixtures/leak-samples.ts';
import { FIXTURE_MODEL, FIXTURE_SUITE, makeFixtureStore, PASSKEY_RUN, SECURITY_RUN, write } from './fixtures/make-store.ts';

const SUITE = FIXTURE_SUITE;

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

  test('generates a diff against the base app for legacy runs', async () => {
    const options = makeOptions();
    await buildSuite(SUITE, options);
    const patch = fs.readFileSync(path.join(options.outDir, 'public-evals', SUITE, PASSKEY_RUN, 'agent.patch'), 'utf8');
    assert.ok(patch.startsWith('diff --git a/index.html b/index.html\n'));
    assert.match(patch, /^-<p>base version<\/p>$/m);
    assert.match(patch, /^\+<p>agent version<\/p>$/m);
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
      results.map(result => [result.suiteId, result.status]),
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

  test('second run leaves unchanged suites alone and records state', async () => {
    const options = makeOptions();
    const first = await buildSelectedSuites(options);
    assert.equal(first.find(r => r.suiteId === SUITE)?.status, 'built');
    assert.ok(stateFor(options.outDir).suites[SUITE].generation);

    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === SUITE)?.status, 'unchanged');
    assert.equal(second.find(r => r.suiteId === 'nightly-2026-10-21_00-00-00-claude_code')?.status, 'skipped');
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
    assert.match(stateFor(options.outDir).suites[unreleased].skipped.reason, /secret-model/);

    reads.length = 0;
    const second = await buildSelectedSuites(options);
    assert.equal(second.find(r => r.suiteId === unreleased)?.status, 'skipped');
    assert.deepEqual(reads.filter(r => r.startsWith(unreleased)), [], 'skipped suite must not be fetched again');

    // Releasing the model is a reason to try again.
    const released = { ...options, allowlist: { ...allowlist, releasedModels: [FIXTURE_MODEL, 'secret-model'] } };
    const third = await buildSelectedSuites(released);
    assert.equal(third.find(r => r.suiteId === unreleased)?.status, 'built');
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

  test('retention drops old suites', async () => {
    const options = makeOptions();
    const evalsPath = path.join(options.storeRoot, SUITE, 'evals.json');
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    fs.utimesSync(evalsPath, old, old);
    const results = await buildSelectedSuites({ ...options, allowlist: { ...allowlist, retention: { maxAgeDays: 90 } } });
    assert.equal(results.find(r => r.suiteId === SUITE), undefined);
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
