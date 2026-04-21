import { test } from 'node:test';
import assert from 'node:assert';
import { mergeResults } from '../evaluate.ts';

test('mergeResults merges non-overlapping results', () => {
  const oldResults = { 'task1': [{ run: 1 }] };
  const newResults = { 'task2': [{ run: 2 }] };
  const result = mergeResults(oldResults, newResults);
  assert.deepStrictEqual(result, {
    'task1': [{ run: 1 }],
    'task2': [{ run: 2 }]
  });
});

test('mergeResults overwrites overlapping results with new ones', () => {
  const oldResults = { 'task1': [{ run: 1 }] };
  const newResults = { 'task1': [{ run: 2 }] };
  const result = mergeResults(oldResults, newResults);
  assert.deepStrictEqual(result, {
    'task1': [{ run: 2 }]
  });
});
