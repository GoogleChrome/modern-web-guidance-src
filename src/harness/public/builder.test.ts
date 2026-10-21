import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EvalsReport } from '../lib/metrics.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { buildSelectedSuites, buildSuite, runRelativePath, writeManifest } from './builder.ts';
import type { BuildOptions } from './builder.ts';
import type { PublicEvals } from './rebuild-evals.ts';
import { LocalSuiteStore } from './suite-store.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, 'fixtures', 'nightly-sample.evals.json');
const SUITE = 'nightly-2026-10-20_20-43-48-codex_cli';
const SECURITY_RUN = '1/security/daily-grind/guided';
const PASSKEY_RUN = '1/passkey-authentication/task/guided';

const allowlist: PublicAllowlist = {
  include: ['nightly-*-codex_cli', 'nightly-*-claude_code'],
  exclude: [],
  overrides: [],
  releasedModels: ['example-model'],
};

/** A bucket-shaped directory with one publishable suite, one unreleased-model suite, and one non-nightly suite. */
function makeStore(): { root: string; baseApps: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-store-'));
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as EvalsReport;

  const suite = path.join(root, SUITE);
  write(path.join(suite, 'evals.json'), JSON.stringify(fixture));
  write(
    path.join(suite, SECURITY_RUN, 'agent.patch'),
    'diff --git a/src/app.ts b/src/app.ts\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -0,0 +1 @@\n+ok\n' +
      'diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\n--- a/pnpm-lock.yaml\n+++ b/pnpm-lock.yaml\n@@ -0,0 +1 @@\n+lock\n',
  );
  write(path.join(suite, SECURITY_RUN, 'modern-web.log'), 'GET /guides/security from /usr/local/google/home/someone/code/modern-web-guidance-src/guides\n');
  write(path.join(suite, SECURITY_RUN, 'agent_stderr.log'), 'at /usr/local/google/home/someone/secret.ts\n');
  write(path.join(suite, SECURITY_RUN, 'session-1.html'), '<html>trajectory</html>');
  write(path.join(suite, PASSKEY_RUN, 'index.html'), '<p>agent version</p>\n');
  write(path.join(suite, PASSKEY_RUN, 'modern-web.log'), 'GET /guides/passkeys\n');

  const unreleased = path.join(root, 'nightly-2026-10-21_00-00-00-claude_code');
  write(path.join(unreleased, 'evals.json'), JSON.stringify({ ...fixture, agent: 'claude_code', model: 'secret-model' }));

  const adhoc = path.join(root, 'test-2026-07-30T13-02-05');
  write(path.join(adhoc, 'evals.json'), JSON.stringify(fixture));

  const baseApps = fs.mkdtempSync(path.join(os.tmpdir(), 'public-evals-base-apps-'));
  write(path.join(baseApps, 'daily-grind', 'index.html'), '<p>base version</p>\n');
  return { root, baseApps };
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function makeOptions(overrides: Partial<BuildOptions> = {}): BuildOptions & { storeRoot: string } {
  const { root, baseApps } = makeStore();
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
    write(path.join(options.storeRoot, SUITE, PASSKEY_RUN, 'modern-web.log'), 'host travenr.c.googlers.com\n');

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
    assert.equal(writeManifest(options.outDir), 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(options.outDir, 'public-evals', 'suites.gen.json'), 'utf8'));
    assert.deepEqual(manifest, []);
  });
});
