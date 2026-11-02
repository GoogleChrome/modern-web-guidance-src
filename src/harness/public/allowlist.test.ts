import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyPendingChanges,
  applyPromote,
  applyUnpublish,
  assertAllowlistShape,
  DEFAULT_ALLOWLIST_PATH,
  globToRegExp,
  loadValidatedAllowlist,
  newestFirst,
  overrideFor,
  parseAllowlist,
  parseValidatedAllowlist,
  PENDING_CHANGE_TTL_MS,
  selectSuites,
  suiteCreatedAt,
  validateAllowlistPolicy,
  withinMaxAge,
} from './allowlist.ts';
import type { PendingChange, PublicAllowlist } from './allowlist.ts';

const NIGHTLY = 'nightly-2026-10-20_20-43-48-codex_cli';
const ONE_OFF = 'opus-4.8-2026-06-10_17-23-16';

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
    const withRetention = { ...allowlist, retention: { maxAgeDays: 90, maxSuites: 300 } };
    assert.deepEqual(loadValidatedAllowlist(writeTemp(JSON.stringify(withRetention))), withRetention);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxAgeDays: 0 } }))), /maxAgeDays must be >= 1/);
    assert.throws(() => loadValidatedAllowlist(writeTemp(JSON.stringify({ ...allowlist, retention: { maxSuites: 0 } }))), /maxSuites must be >= 1/);
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
});

describe('applyPromote', () => {
  const base: PublicAllowlist = { ...allowlist, include: ['nightly-*-codex_cli'], exclude: [], overrides: [] };

  test('is a no-op for a nightly already admitted by a pattern', () => {
    const { allowlist: next, edits } = applyPromote(base, NIGHTLY);
    assert.deepEqual(edits, []);
    assert.deepEqual(next, base);
  });

  test('adds an exact id for a one-off suite', () => {
    const { allowlist: next, edits } = applyPromote(base, ONE_OFF);
    assert.deepEqual(edits, [`add ${ONE_OFF} to include`]);
    assert.deepEqual(next.include, ['nightly-*-codex_cli', ONE_OFF]);
  });

  test('restores a suite by clearing exclude and overrides', () => {
    const current: PublicAllowlist = {
      ...base,
      exclude: [NIGHTLY, 'other'],
      overrides: [{ id: NIGHTLY, excludeGuides: ['security'] }, { id: 'other', excludeGuides: ['x'] }],
    };
    const { allowlist: next, edits } = applyPromote(current, NIGHTLY);
    assert.deepEqual(edits, [`remove ${NIGHTLY} from exclude`, `remove overrides for ${NIGHTLY}`]);
    assert.deepEqual(next.exclude, ['other']);
    assert.deepEqual(next.overrides, [{ id: 'other', excludeGuides: ['x'] }]);
    assert.deepEqual(current.exclude, [NIGHTLY, 'other'], 'input must not be mutated');
  });
});

describe('applyUnpublish', () => {
  const base: PublicAllowlist = { ...allowlist, include: ['nightly-*-codex_cli'], exclude: [], overrides: [] };

  test('promote and unpublish refuse patterns, whitespace and empty ids before touching anything', () => {
    for (const bad of ['nightly-*', 'nightly-?-x', 'two words', ' lead', '', 'tab\there']) {
      assert.throws(() => applyPromote(base, bad), /single exact id/, bad);
      assert.throws(() => applyUnpublish(base, bad, []), /single exact id/, bad);
    }
  });

  test('refuses guide names that are not plain directory names', () => {
    for (const bad of ['../x', 'a/b', 'a b', '', 'g*']) {
      assert.throws(() => applyUnpublish(base, NIGHTLY, [bad]), /plain directory name/, bad);
    }
    assert.equal(applyUnpublish(base, NIGHTLY, ['web-mcp.v2_x']).edits.length, 1);
  });

  test('adds the suite to exclude', () => {
    const { allowlist: next, edits } = applyUnpublish(base, NIGHTLY, []);
    assert.deepEqual(edits, [`add ${NIGHTLY} to exclude`]);
    assert.deepEqual(next.exclude, [NIGHTLY]);
  });

  test('is a no-op when already excluded', () => {
    const { edits } = applyUnpublish({ ...base, exclude: [NIGHTLY] }, NIGHTLY, []);
    assert.deepEqual(edits, []);
  });

  test('creates an override for a guide and extends it on repeat', () => {
    const first = applyUnpublish(base, NIGHTLY, ['security']);
    assert.deepEqual(first.allowlist.overrides, [{ id: NIGHTLY, excludeGuides: ['security'] }]);

    const second = applyUnpublish(first.allowlist, NIGHTLY, ['security', 'passkeys']);
    assert.deepEqual(second.edits, [`exclude guide(s) passkeys from ${NIGHTLY}`]);
    assert.deepEqual(second.allowlist.overrides, [{ id: NIGHTLY, excludeGuides: ['security', 'passkeys'] }]);

    const third = applyUnpublish(second.allowlist, NIGHTLY, ['passkeys']);
    assert.deepEqual(third.edits, []);
  });

  test('never writes a guide twice, even when --guide repeats it', () => {
    const { allowlist: next, edits } = applyUnpublish(base, NIGHTLY, ['security', 'security']);
    assert.deepEqual(next.overrides, [{ id: NIGHTLY, excludeGuides: ['security'] }]);
    assert.deepEqual(edits, [`exclude guide(s) security from ${NIGHTLY}`]);
    assert.deepEqual(applyUnpublish(next, NIGHTLY, ['security', 'security']).edits, []);
  });

  test('every change is idempotent and satisfies both schema and policy', () => {
    const changes = [
      (current: PublicAllowlist) => applyPromote(current, ONE_OFF),
      (current: PublicAllowlist) => applyPromote(current, NIGHTLY),
      (current: PublicAllowlist) => applyUnpublish(current, NIGHTLY, []),
      (current: PublicAllowlist) => applyUnpublish(current, NIGHTLY, ['security']),
    ];
    const excludedWithOverride = { ...base, exclude: [NIGHTLY], overrides: [{ id: NIGHTLY, excludeGuides: ['x'] }] };
    for (const change of changes) {
      for (const start of [base, excludedWithOverride]) {
        const first = change(start);
        assertAllowlistShape(first.allowlist, 'test');
        assert.deepEqual(validateAllowlistPolicy(first.allowlist), []);
        assert.deepEqual(change(first.allowlist).edits, [], 'applying the same change again must be a no-op');
      }
    }
  });
});

describe('applyPendingChanges', () => {
  const base: PublicAllowlist = { ...allowlist, include: ['nightly-*'], exclude: [], overrides: [] };
  const now = new Date('2026-10-26T00:00:00Z');
  const createdAt = '2026-10-25T00:00:00Z';
  const pending = (change: Omit<PendingChange, 'createdAt'>, at = createdAt): PendingChange => ({ ...change, createdAt: at });

  test('layers changes the allowlist does not yet reflect and keeps them pending', () => {
    const result = applyPendingChanges(base, [
      pending({ command: 'unpublish', suiteId: 'nightly-1', guides: [] }),
      pending({ command: 'unpublish', suiteId: 'nightly-2', guides: ['security'] }),
    ], now);
    assert.deepEqual(result.allowlist.exclude, ['nightly-1']);
    assert.deepEqual(result.allowlist.overrides, [{ id: 'nightly-2', excludeGuides: ['security'] }]);
    assert.equal(result.pending.length, 2);
    assert.deepEqual(result.expired, []);
  });

  test('drops changes the allowlist already reflects', () => {
    const merged = { ...base, exclude: ['nightly-1'] };
    const result = applyPendingChanges(merged, [
      pending({ command: 'unpublish', suiteId: 'nightly-1', guides: [] }),
      pending({ command: 'promote', suiteId: 'nightly-3', guides: [] }),
    ], now);
    assert.deepEqual(result.pending, []);
    assert.deepEqual(result.allowlist, merged);
  });

  test('an unpublish is reflected once the allowlist no longer selects the suite at all', () => {
    const narrowed = { ...base, include: ['nightly-*-codex_cli'], exclude: ['nightly-9-codex_cli'] };
    const result = applyPendingChanges(narrowed, [
      pending({ command: 'unpublish', suiteId: 'nightly-1-claude_code', guides: [] }),
      pending({ command: 'unpublish', suiteId: 'nightly-9-codex_cli', guides: ['security'] }),
      pending({ command: 'unpublish', suiteId: 'nightly-2-codex_cli', guides: ['security'] }),
    ], now);
    assert.deepEqual(result.pending.map(change => change.suiteId), ['nightly-2-codex_cli']);
    assert.deepEqual(result.allowlist.exclude, narrowed.exclude);
    assert.deepEqual(result.allowlist.overrides, [{ id: 'nightly-2-codex_cli', excludeGuides: ['security'] }]);
  });

  test('a pending promote does not override an exclude that went through review', () => {
    const takenDown = { ...base, exclude: ['nightly-1'] };
    const result = applyPendingChanges(takenDown, [pending({ command: 'promote', suiteId: 'nightly-1', guides: [] })], now);
    assert.deepEqual(result.allowlist, takenDown);
    assert.deepEqual(result.pending, []);
  });

  test('a pending promote still restores a suite the allowlist merely overrides or does not match', () => {
    const current = { ...base, include: ['nightly-*-codex_cli'], overrides: [{ id: 'nightly-1-codex_cli', excludeGuides: ['security'] }] };
    const result = applyPendingChanges(current, [
      pending({ command: 'promote', suiteId: 'nightly-1-codex_cli', guides: [] }),
      pending({ command: 'promote', suiteId: ONE_OFF, guides: [] }),
      pending({ command: 'unpublish', suiteId: ONE_OFF, guides: ['security'] }),
    ], now);
    assert.deepEqual(result.allowlist.overrides, [{ id: ONE_OFF, excludeGuides: ['security'] }]);
    assert.deepEqual(result.allowlist.include, ['nightly-*-codex_cli', ONE_OFF]);
    assert.equal(result.pending.length, 3);
  });

  test('changes older than the TTL, or without a readable timestamp, expire unapplied', () => {
    const old = new Date(now.getTime() - PENDING_CHANGE_TTL_MS - 1).toISOString();
    const justInTime = new Date(now.getTime() - PENDING_CHANGE_TTL_MS).toISOString();
    const result = applyPendingChanges(base, [
      pending({ command: 'unpublish', suiteId: 'nightly-1', guides: [] }, old),
      pending({ command: 'unpublish', suiteId: 'nightly-2', guides: [] }, justInTime),
      pending({ command: 'unpublish', suiteId: 'nightly-3', guides: [] }, 'not a date'),
    ], now);
    assert.deepEqual(result.expired.map(change => change.suiteId), ['nightly-1', 'nightly-3']);
    assert.deepEqual(result.pending.map(change => change.suiteId), ['nightly-2']);
    assert.deepEqual(result.allowlist.exclude, ['nightly-2']);
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
