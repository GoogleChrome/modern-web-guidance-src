import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { guideOfResultKey, guidesIn, withoutGuides } from './overrides.ts';
import type { ResultsByKey } from './overrides.ts';

const run = { runNumber: 1, results: [{ passed: true, message: 'ok' }] };

const results: ResultsByKey = {
  'task - passkeys - guided': [run],
  'task - passkeys - unguided': [run],
  'daily-grind - security - guided': [run],
  'daily-grind - security - unguided': [run],
  'daily-grind - long-task - guided': [run],
};

describe('guideOfResultKey', () => {
  test('takes the middle part, even when the guide name ends in -task', () => {
    assert.equal(guideOfResultKey('task - passkeys - guided'), 'passkeys');
    assert.equal(guideOfResultKey('daily-grind - security - unguided'), 'security');
    assert.equal(guideOfResultKey('daily-grind - long-task - guided'), 'long-task');
  });

  test('throws on malformed keys', () => {
    assert.throws(() => guideOfResultKey('nonsense'), /Malformed result key/);
    assert.throws(() => guideOfResultKey('a - b'), /Malformed result key/);
  });
});

describe('withoutGuides', () => {
  test('removes both guided and unguided scenarios for the guide', () => {
    const kept = withoutGuides(results, ['security']);
    assert.deepEqual(Object.keys(kept).sort(), [
      'daily-grind - long-task - guided',
      'task - passkeys - guided',
      'task - passkeys - unguided',
    ]);
  });

  test('excludes a guide whose name ends in -task', () => {
    assert.ok(!('daily-grind - long-task - guided' in withoutGuides(results, ['long-task'])));
  });

  test('returns a copy when nothing is excluded', () => {
    const kept = withoutGuides(results, []);
    assert.deepEqual(kept, results);
    assert.notEqual(kept, results);
  });

  test('throws when an excluded guide is not in the suite', () => {
    assert.throws(() => withoutGuides(results, ['securty']), /not present in this suite: securty/);
  });

  test('throws on a malformed key rather than keeping it', () => {
    assert.throws(() => withoutGuides({ ...results, 'bad key': [run] }, []), /Malformed result key/);
  });
});

describe('guidesIn', () => {
  test('lists distinct guides', () => {
    assert.deepEqual([...guidesIn(results)].sort(), ['long-task', 'passkeys', 'security']);
  });
});
