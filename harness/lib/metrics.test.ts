import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateMetrics } from './metrics.ts';
import type { RunResult } from './metrics.ts';

describe('calculateMetrics', () => {
  test('should calculate correct metrics for a simple result set', () => {
    const allResults: Record<string, RunResult[]> = {
      'greenfield - specific - guided': [
        {
          runNumber: 1,
          results: [
            { id: 'check1', passed: true, message: 'msg1' },
            { id: 'check2', passed: false, message: 'msg2' }
          ]
        },
        {
          runNumber: 2,
          results: [
            { id: 'check1', passed: true, message: 'msg1' },
            { id: 'check2', passed: true, message: 'msg2' }
          ]
        }
      ],
      'greenfield - specific - unguided': [
        {
          runNumber: 1,
          results: [
            { id: 'check1', passed: false, message: 'msg1' },
            { id: 'check2', passed: false, message: 'msg2' }
          ]
        }
      ]
    };

    const metrics = calculateMetrics(allResults, 2);

    // Summary checks
    assert.strictEqual(metrics.summary.numRuns, 2);
    
    // Guided: Run 1 (50%), Run 2 (100%). Median of [50, 100] is 75.
    assert.strictEqual(metrics.summary.guidedMedian, 75);
    
    // Unguided: Run 1 (0%). Median is 0.
    assert.strictEqual(metrics.summary.unguidedMedian, 0);

    // Totals
    // Guided: 3 passed out of 4 total
    assert.strictEqual(metrics.summary.guidedPassed, 3);
    assert.strictEqual(metrics.summary.guidedTotal, 4);
    assert.strictEqual(metrics.summary.guidedPassRate, 75);

    // Unguided: 0 passed out of 2 total
    assert.strictEqual(metrics.summary.unguidedPassed, 0);
    assert.strictEqual(metrics.summary.unguidedTotal, 2);
    assert.strictEqual(metrics.summary.unguidedPassRate, 0);

    // Sorted keys
    assert.deepStrictEqual(metrics.sortedKeys, [
      'greenfield - specific - unguided',
      'greenfield - specific - guided'
    ]);
  });

  test('should handle empty results gracefully', () => {
    const metrics = calculateMetrics({}, 0);
    assert.strictEqual(metrics.summary.guidedTotal, 0);
    assert.strictEqual(metrics.summary.unguidedTotal, 0);
    assert.deepStrictEqual(metrics.sortedKeys, []);
  });
});
