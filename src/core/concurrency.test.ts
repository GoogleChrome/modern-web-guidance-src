import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from './concurrency.ts';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  test('returns results in input order and never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([5, 1, 3, 2, 4], 2, async n => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      for (let i = 0; i < n; i++) {
        await tick();
      }
      inFlight--;
      return n * 10;
    });
    assert.deepEqual(results, [50, 10, 30, 20, 40]);
    assert.equal(peak, 2);
  });

  test('handles an empty list', async () => {
    assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
  });

  test('on failure, stops starting new work, lets in-flight items finish, then rethrows the first error', async () => {
    const started: number[] = [];
    const finished: number[] = [];
    await assert.rejects(
      mapWithConcurrency([1, 2, 3, 4, 5], 2, async n => {
        started.push(n);
        await tick();
        if (n === 1) {
          throw new Error('first failure');
        }
        await tick();
        finished.push(n);
      }),
      /first failure/,
    );
    assert.deepEqual(started, [1, 2], 'nothing starts after the failure');
    assert.deepEqual(finished, [2], 'the item already in flight completes');
  });
});
