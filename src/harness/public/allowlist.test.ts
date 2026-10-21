import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { globToRegExp, loadAllowlist, overrideFor, selectSuites } from './allowlist.ts';
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

  test('rejects missing or mistyped fields', () => {
    assert.throws(() => loadAllowlist(writeTemp('{"include": "nightly-*"}')), /"include" must be an array of strings/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, overrides: [{ excludeGuides: ['x'] }] }))), /overrides\[0\]/);
    assert.throws(() => loadAllowlist(writeTemp(JSON.stringify({ ...allowlist, releasedModels: [1] }))), /"releasedModels"/);
  });
});
