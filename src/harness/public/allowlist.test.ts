import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_ALLOWLIST_PATH,
  globToRegExp,
  isCuratedSuite,
  loadValidatedAllowlist,
  newestFirst,
  overrideFor,
  parseAllowlist,
  parseValidatedAllowlist,
  selectSuites,
  suiteCreatedAt,
  validateAllowlistPolicy,
  withinMaxAge,
  withinSuiteCaps,
} from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';

const NIGHTLY = 'nightly-2026-10-20_20-43-48-codex_cli';

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

describe('isCuratedSuite', () => {
  test('returns true for exact non-scheduled suites in the allowlist', () => {
    assert.equal(isCuratedSuite('one-off-2026-05-13_19-17-28', allowlist), true);
    assert.equal(isCuratedSuite('opus-medium-1.0-rc-2026-11-08'), true);
  });

  test('returns false for scheduled nightlies and weeklies', () => {
    assert.equal(isCuratedSuite('nightly-2026-10-20_20-43-48-codex_cli', allowlist), false);
    assert.equal(isCuratedSuite('weekly-2026-10-20-codex_cli', allowlist), false);
  });

  test('returns false when allowlist is passed and suite is not in include', () => {
    assert.equal(isCuratedSuite('unknown-suite', allowlist), false);
  });
});

describe('loadValidatedAllowlist', () => {
  const tempDirs: string[] = [];
  after(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function writeTemp(contents: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'allowlist.json');
    fs.writeFileSync(file, contents);
    return file;
  }

  test('loads a valid file and the checked-in allowlist', () => {
    const file = writeTemp(JSON.stringify(allowlist));
    assert.deepEqual(loadValidatedAllowlist(file), allowlist);
    assert.ok(Array.isArray(loadValidatedAllowlist(DEFAULT_ALLOWLIST_PATH).releasedModels));
  });

  test('rejects missing or mistyped fields with every problem listed', () => {
    assert.throws(() => loadValidatedAllowlist(writeTemp('{"include": "nightly-*"}')), /does not match the allowlist schema[\s\S]*must have required property 'exclude'[\s\S]*\/include must be array/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ excludeGuides: ['x'] }] }))), /overrides\/0 must have required property 'id'/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, releasedModels: [1] }))), /releasedModels\/0 must be string/);
  });

  test('rejects unknown keys and names the extra key', () => {
    assert.throws(
      () => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'x', excludeGuides: ['g'], replaceGuides: {} }] }))),
      /overrides\/0 must NOT have additional properties \("replaceGuides"\)/,
    );
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, includes: [] }))), /must NOT have additional properties \("includes"\)/);
  });

  test('rejects patterns in exclude and override ids, odd guide names, empty overrides, duplicates, and blanks', () => {
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, exclude: ['nightly-*'] }))), /exclude\/0 must match pattern/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'nightly-?', excludeGuides: ['g'] }] }))), /overrides\/0\/id must match pattern/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'x', excludeGuides: ['../g'] }] }))), /overrides\/0\/excludeGuides\/0 must match pattern/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ id: 'x', excludeGuides: [] }] }))), /excludeGuides must NOT have fewer than 1 items/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, releasedModels: ['m', 'm'] }))), /releasedModels must NOT have duplicate items/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, exclude: [' '] }))), /exclude\/0 must match pattern/);
  });

  test('accepts a $schema key and an optional retention block', () => {
    assert.deepEqual(loadValidatedAllowlist(writeTemp(JSON.stringify({ $schema: './x.json', ...allowlist }))), allowlist);
    const withRetention = { ...allowlist, retention: { maxAgeDays: 90, maxSuites: 300, maxSuitesPerAgent: 10 } };
    assert.deepEqual(loadValidatedAllowlist(writeTemp(JSON.stringify(withRetention))), withRetention);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxAgeDays: 0 } }))), /maxAgeDays must be >= 1/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxSuites: 0 } }))), /maxSuites must be >= 1/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxSuitesPerAgent: 1.5 } }))), /maxSuitesPerAgent must be integer/);
  });

  test('loadValidatedAllowlist also applies policy', () => {
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, include: ['*'] }))), /violates allowlist policy[\s\S]*"\*" uses wildcards/);
  });

  test('parseAllowlist and parseValidatedAllowlist work from text and name the source in errors', () => {
    assert.deepEqual(parseAllowlist(JSON.stringify({ $schema: 'x', ...allowlist }), 'origin/main'), allowlist);
    assert.deepEqual(parseValidatedAllowlist(JSON.stringify(allowlist), 'origin/main'), allowlist);
    assert.throws(() => parseAllowlist('{"include": []}', 'origin/main'), /^Error: origin\/main does not match the allowlist schema/);
    assert.throws(() => parseValidatedAllowlist(JSON.stringify({ ...allowlist, include: ['*'] }), 'origin/main'), /^Error: origin\/main violates allowlist policy/);
    assert.throws(() => parseAllowlist('{not json', 'origin/main'), (err: unknown) => err instanceof Error && err.message.startsWith('origin/main is not valid JSON: ') && err.cause instanceof SyntaxError);
  });
});

describe('validateAllowlistPolicy', () => {
  test('accepts the example and the checked-in allowlist', () => {
    assert.deepEqual(validateAllowlistPolicy(allowlist), []);
    assert.deepEqual(validateAllowlistPolicy(loadValidatedAllowlist()), []);
  });

  test('rejects wildcard patterns outside nightly-', () => {
    assert.match(validateAllowlistPolicy({ ...allowlist, include: ['*'] })[0], /"\*" uses wildcards/);
    assert.match(validateAllowlistPolicy({ ...allowlist, include: ['test-*'] })[0], /"test-\*" uses wildcards/);
    assert.deepEqual(validateAllowlistPolicy({ ...allowlist, include: ['one-off-exact-id'] }), []);
  });

  test('rejects two overrides for the same suite', () => {
    const doubled = { ...allowlist, overrides: [{ id: NIGHTLY, excludeGuides: ['a'] }, { id: 'other', excludeGuides: ['b'] }, { id: NIGHTLY, excludeGuides: ['c'] }] };
    assert.deepEqual(validateAllowlistPolicy(doubled), [`overrides lists "${NIGHTLY}" more than once`]);
    assert.throws(() => parseValidatedAllowlist(JSON.stringify(doubled), 'x'), /more than once/);
  });
});

describe('retention helpers', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-10-26T00:00:00Z');
  const suites = [
    { id: 'c', createdAt: new Date(now.getTime() - 1 * day) },
    { id: 'a', createdAt: new Date(now.getTime() - 10 * day) },
    { id: 'b', createdAt: new Date(now.getTime() - 100 * day) },
  ];

  test('withinMaxAge keeps everything when no retention is set', () => {
    assert.deepEqual(withinMaxAge(allowlist, suites, now).map(s => s.id), ['c', 'a', 'b']);
  });

  test('withinMaxAge drops suites older than maxAgeDays', () => {
    assert.deepEqual(withinMaxAge({ ...allowlist, retention: { maxAgeDays: 30 } }, suites, now).map(s => s.id), ['c', 'a']);
  });

  test('newestFirst sorts by createdAt descending without mutating', () => {
    const input = [suites[1], suites[2], suites[0]];
    assert.deepEqual(newestFirst(input).map(s => s.id), ['c', 'a', 'b']);
    assert.deepEqual(input.map(s => s.id), ['a', 'b', 'c']);
  });

  test('withinSuiteCaps applies the per-agent cap before the global cap', () => {
    // Newest first: four codex runs, then two claude, then one with no agent.
    const ranked = [
      { id: 'x1', agent: 'codex_cli' },
      { id: 'x2', agent: 'codex_cli' },
      { id: 'x3', agent: 'codex_cli' },
      { id: 'x4', agent: 'codex_cli' },
      { id: 'c1', agent: 'claude_code' },
      { id: 'c2', agent: 'claude_code' },
      { id: 'n1' },
    ];
    const ids = (retention: PublicAllowlist['retention']) => withinSuiteCaps({ ...allowlist, retention }, ranked).map(s => s.id);

    assert.deepEqual(ids(undefined), ['x1', 'x2', 'x3', 'x4', 'c1', 'c2', 'n1'], 'no caps keeps everything');
    assert.deepEqual(ids({ maxSuites: 3 }), ['x1', 'x2', 'x3'], 'a global cap alone lets one agent take every slot');
    assert.deepEqual(ids({ maxSuitesPerAgent: 2 }), ['x1', 'x2', 'c1', 'c2', 'n1'], 'per-agent cap skips the surplus and keeps scanning');
    assert.deepEqual(ids({ maxSuitesPerAgent: 2, maxSuites: 3 }), ['x1', 'x2', 'c1'], 'per-agent first, then the global cap');
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
