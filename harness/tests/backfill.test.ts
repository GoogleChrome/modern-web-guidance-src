import { test } from 'node:test';
import assert from 'node:assert';
import { resolveResultsDir } from '../backfill.ts';
import path from 'path';

const defaultDir = '/default/results';

test('resolveResultsDir uses default dir when no arguments', () => {
  const argv = ['node', 'backfill.ts'];
  const result = resolveResultsDir(argv, defaultDir);
  assert.strictEqual(result, defaultDir);
});

test('resolveResultsDir uses custom dir when run via node', () => {
  const argv = ['node', 'backfill.ts', 'my-dir'];
  const result = resolveResultsDir(argv, defaultDir);
  assert.strictEqual(result, path.resolve('my-dir'));
});

test('resolveResultsDir uses default dir when run via gd with no extra arg', () => {
  const argv = ['node', 'gd.ts', 'backfill'];
  const result = resolveResultsDir(argv, defaultDir);
  assert.strictEqual(result, defaultDir);
});

test('resolveResultsDir uses custom dir when run via gd with extra arg', () => {
  const argv = ['node', 'gd.ts', 'backfill', 'my-dir'];
  const result = resolveResultsDir(argv, defaultDir);
  assert.strictEqual(result, path.resolve('my-dir'));
});
