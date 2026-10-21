import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAllowlist, validateAllowlistPolicy } from './allowlist.ts';
import type { PublicAllowlist } from './allowlist.ts';
import { applyPromote, applyUnpublish, writeAllowlist } from './promote.ts';

const NIGHTLY = 'nightly-2026-10-20_20-43-48-codex_cli';
const ONE_OFF = 'opus-4.8-2026-06-10_17-23-16';

const base: PublicAllowlist = {
  include: ['nightly-*-codex_cli'],
  exclude: [],
  overrides: [],
  releasedModels: ['example-model'],
};

describe('applyPromote', () => {
  test('is a no-op for a nightly already admitted by a pattern', () => {
    const { allowlist, edits } = applyPromote(base, NIGHTLY);
    assert.deepEqual(edits, []);
    assert.deepEqual(allowlist, base);
  });

  test('adds an exact id for a one-off suite', () => {
    const { allowlist, edits } = applyPromote(base, ONE_OFF);
    assert.deepEqual(edits, [`add ${ONE_OFF} to include`]);
    assert.deepEqual(allowlist.include, ['nightly-*-codex_cli', ONE_OFF]);
  });

  test('restores a suite by clearing exclude and overrides', () => {
    const current: PublicAllowlist = {
      ...base,
      exclude: [NIGHTLY, 'other'],
      overrides: [{ id: NIGHTLY, excludeGuides: ['security'] }, { id: 'other', excludeGuides: ['x'] }],
    };
    const { allowlist, edits } = applyPromote(current, NIGHTLY);
    assert.deepEqual(edits, [`remove ${NIGHTLY} from exclude`, `remove overrides for ${NIGHTLY}`]);
    assert.deepEqual(allowlist.exclude, ['other']);
    assert.deepEqual(allowlist.overrides, [{ id: 'other', excludeGuides: ['x'] }]);
    assert.deepEqual(current.exclude, [NIGHTLY, 'other'], 'input must not be mutated');
  });
});

describe('applyUnpublish', () => {
  test('adds the suite to exclude', () => {
    const { allowlist, edits } = applyUnpublish(base, NIGHTLY, []);
    assert.deepEqual(edits, [`add ${NIGHTLY} to exclude`]);
    assert.deepEqual(allowlist.exclude, [NIGHTLY]);
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

  test('results always satisfy allowlist policy', () => {
    for (const change of [
      applyPromote(base, ONE_OFF),
      applyUnpublish(base, NIGHTLY, []),
      applyUnpublish(base, NIGHTLY, ['security']),
    ]) {
      assert.deepEqual(validateAllowlistPolicy(change.allowlist), []);
    }
  });
});

describe('writeAllowlist', () => {
  test('writes stable, schema-first JSON that loads back unchanged', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-write-'));
    const file = path.join(dir, 'public-suites-allowlist.json');
    const allowlist = applyUnpublish(base, NIGHTLY, ['security']).allowlist;

    writeAllowlist(file, allowlist);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('{\n  "$schema": "./public-suites-allowlist.schema.json",\n  "include"'));
    assert.ok(text.endsWith('}\n'));
    assert.deepEqual(loadAllowlist(file), allowlist);
  });
});
