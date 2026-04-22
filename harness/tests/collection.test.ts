import { test } from 'node:test';
import assert from 'node:assert';
import { parseResultPath } from '../lib/collection.ts';
import path from 'path';

test('parseResultPath handles new structure', () => {
  const relPath = path.join('guide-name', 'task-name', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task-name',
    runType: 'guided'
  });
});

test('parseResultPath handles legacy structure', () => {
  const relPath = path.join('guide-name-task', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task',
    runType: 'guided'
  });
});

test('parseResultPath handles legacy negative structure', () => {
  const relPath = path.join('guide-name-task-negative', 'guided');
  const result = parseResultPath(relPath);
  assert.deepStrictEqual(result, {
    guide: 'guide-name',
    taskName: 'task',
    runType: 'guided'
  });
});

test('parseResultPath returns null for invalid structure', () => {
  const relPath = 'guided';
  const result = parseResultPath(relPath);
  assert.strictEqual(result, null);
});
