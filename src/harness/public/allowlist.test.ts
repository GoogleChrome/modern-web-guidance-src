import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPendingChanges, applyRetention, globToRegExp, loadAllowlist, loadValidatedAllowlist, overrideFor, selectSuites, suiteCreatedAt, validateAllowlistPolicy } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';

const allowlist: PublicAllowlist = {
  include: ['nightly-*-codex_cli', 'nightly-*-claude_code', 'one-off-2026-05-13_19-17-28'],
  exclude: ['nightly-2026-10-09_11-27-57-codex_cli'],
  overrides: [{ id: 'nightly-2026-10-14_10-21-40-codex_cli', excludeGuides: ['security'] }],
  releasedModels: ['example-model'],
};

describe('globToRegExp', () => {
  test('matches * and ? and escapes everything else', () => {
    assert.ok(globToRegExp('nightly-*-codex_cli').test('nightly-2026-10-14_10-21-40-codex_cli'));
    assert.ok(!globToRegExp('nightly-*-codex_cli').test('nightly-2026-10-14-codex_cli-extra'));
    assert.ok(globToRegExp('run-?').test('run-1'));
    assert.ok(!globToRegExp('run-?').test('run-12'));
    assert.ok(globToRegExp('a.b').test('a.b'));
    assert.ok(!globToRegExp('a.b').test('axb'));
  });
});

describe('selectSuites', () => {
  test('keeps included suites, drops excluded and unmatched, and sorts', () => {
    const selected = selectSuites(allowlist, [
      'test-2026-07-30T13-02-05',
      'nightly-2026-10-14_10-21-40-codex_cli',
      'nightly-2026-10-09_11-27-57-codex_cli',
      'nightly-2026-10-14_07-00-02-antigravity_cli',
      'one-off-2026-05-13_19-17-28',
      'nightly-2026-10-14_10-05-13-claude_code',
    ]);
    assert.deepEqual(selected, [
      'nightly-2026-10-14_10-05-13-claude_code',
      'nightly-2026-10-14_10-21-40-codex_cli',
      'one-off-2026-05-13_19-17-28',
    ]);
  });

  test('selects nothing when include is empty', () => {
    assert.deepEqual(selectSuites({ ...allowlist, include: [] }, ['nightly-x-codex_cli']), []);
  });
});

describe('overrideFor', () => {
  test('finds the matching override', () => {
    assert.deepEqual(overrideFor(allowlist, 'nightly-2026-10-14_10-21-40-codex_cli'), {
      id: 'nightly-2026-10-14_10-21-40-codex_cli',
      excludeGuides: ['security'],
    });
    assert.equal(overrideFor(allowlist, 'other'), undefined);
  });
});

describe('loadAllowlist', () => {
  function writeTemp(contents: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-'));
    const file = path.join(dir, 'allowlist.json');
    fs.writeFileSync(file, contents);
    return file;
  }

  test('loads a valid file', () => {
    const file = writeTemp(JSON.stringify(allowlist));
    assert.deepEqual(loadAllowlist(file), allowlist);
  });

  test('loads the checked-in allowlist', () => {
    const loaded = loadAllowlist(path.join(import.meta.dirname, '..', '..', 'dashboard', 'public-suites-allowlist.json'));
    assert.ok(loaded.include.every(pattern => pattern.startsWith('nightly-')));
  });

  test('rejects missing or mistyped fields with every problem listed', () => {
    assert.throws(() => loadAllowlist(writeTemp('{"include": "nightly-*"}')), /does not match the allowlist schema[\s\S]*must have required property 'exclude'[\s\S]*\/include must be array/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ excludeGuides: ['x'] }] }))), /overrides\/0 must have required property 'id'/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, releasedModels: [1] }))), /releasedModels\/0 must be string/);
  });

  test('rejects unknown keys so unsupported features cannot be silently ignored', () => {
    assert.throws(
      () => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'x', excludeGuides: ['g'], replaceGuides: {} }] }))),
      /overrides\/0 must NOT have additional properties/,
    );
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, includes: [] }))), /must NOT have additional properties/);
  });

  test('rejects patterns in exclude and override ids, empty overrides, duplicates, and blanks', () => {
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, exclude: ['nightly-*'] }))), /exclude\/0 must match pattern/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'nightly-?', excludeGuides: ['g'] }] }))), /overrides\/0\/id must match pattern/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'x', excludeGuides: [] }] }))), /excludeGuides must NOT have fewer than 1 items/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, releasedModels: ['m', 'm'] }))), /releasedModels must NOT have duplicate items/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, exclude: [' '] }))), /exclude\/0 must match pattern/);
  });

  test('accepts a $schema key and an optional retention block', () => {
    assert.deepEqual(loadAllowlist(writeTemp(JSON.stringify({ $schema: './x.json', ...allowlist }))), allowlist);
    const withRetention = { ...allowlist, retention: { maxAgeDays: 90, maxSuites: 300 } };
    assert.deepEqual(loadAllowlist(writeTemp(JSON.stringify(withRetention))), withRetention);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxAgeDays: 0 } }))), /maxAgeDays must be >= 1/);
  });

  test('loadValidatedAllowlist also applies policy', () => {
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, include: ['*'] }))), /violates allowlist policy[\s\S]*"\*" uses wildcards/);
  });
});

describe('validateAllowlistPolicy', () => {
  test('accepts the example and the checked-in allowlist', () => {
    assert.deepEqual(validateAllowlistPolicy(allowlist), []);
    const file = path.join(import.meta.dirname, '..', '..', 'dashboard', 'public-suites-allowlist.json');
    assert.deepEqual(validateAllowlistPolicy(loadAllowlist(file)), []);
  });

  test('rejects wildcard patterns outside nightly-', () => {
    assert.match(validateAllowlistPolicy({ ...allowlist, include: ['*'] })[0], /"\*" uses wildcards/);
    assert.match(validateAllowlistPolicy({ ...allowlist, include: ['test-*'] })[0], /"test-\*" uses wildcards/);
    assert.deepEqual(validateAllowlistPolicy({ ...allowlist, include: ['one-off-exact-id'] }), []);
  });
});

describe('applyRetention', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-10-26T00:00:00Z');
  const suites = [
    { id: 'c', createdAt: new Date(now.getTime() - 1 * day) },
    { id: 'a', createdAt: new Date(now.getTime() - 10 * day) },
    { id: 'b', createdAt: new Date(now.getTime() - 100 * day) },
  ];

  test('keeps everything when no retention is set', () => {
    assert.deepEqual(applyRetention(allowlist, suites, now), ['a', 'b', 'c']);
  });

  test('drops suites older than maxAgeDays', () => {
    assert.deepEqual(applyRetention({ ...allowlist, retention: { maxAgeDays: 30 } }, suites, now), ['a', 'c']);
  });

  test('keeps only the newest maxSuites', () => {
    assert.deepEqual(applyRetention({ ...allowlist, retention: { maxSuites: 1 } }, suites, now), ['c']);
  });

  test('applies both limits', () => {
    assert.deepEqual(applyRetention({ ...allowlist, retention: { maxAgeDays: 30, maxSuites: 1 } }, suites, now), ['c']);
  });
});

describe('applyPendingChanges', () => {
  const base: PublicAllowlist = { ...allowlist, include: ['nightly-*'], exclude: [], overrides: [] };

  test('layers changes the allowlist does not yet reflect and keeps them pending', () => {
    const result = applyPendingChanges(base, [
      { command: 'unpublish', suiteId: 'nightly-1', guides: [] },
      { command: 'unpublish', suiteId: 'nightly-2', guides: ['security'] },
    ]);
    assert.deepEqual(result.allowlist.exclude, ['nightly-1']);
    assert.deepEqual(result.allowlist.overrides, [{ id: 'nightly-2', excludeGuides: ['security'] }]);
    assert.equal(result.pending.length, 2);
  });

  test('drops changes the allowlist already reflects', () => {
    const merged = { ...base, exclude: ['nightly-1'] };
    const result = applyPendingChanges(merged, [
      { command: 'unpublish', suiteId: 'nightly-1', guides: [] },
      { command: 'promote', suiteId: 'nightly-3', guides: [] },
    ]);
    assert.deepEqual(result.pending, []);
    assert.deepEqual(result.allowlist, merged);
  });
});

describe('suiteCreatedAt', () => {
  const fallback = new Date('2000-01-01T00:00:00Z');

  test('reads the run time out of a nightly id', () => {
    assert.equal(suiteCreatedAt('nightly-2026-10-20_20-43-48-codex_cli', fallback).toISOString(), '2026-10-20T20:43:48.000Z');
  });

  test('falls back for ids without a timestamp', () => {
    assert.equal(suiteCreatedAt('one-off-exact-id', fallback), fallback);
  });
});
