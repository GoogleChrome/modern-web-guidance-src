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
    assert.strictEqual(metrics.summary.runsPerTest, 2);
    
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

  test('should split capability and regression tasks in summary', () => {
    const allResults: Record<string, RunResult[]> = {
      'task-a - guide-a - guided': [
        { runNumber: 1, results: [{ id: 'c1', passed: true, message: 'ok' }], evalType: 'capability' }
      ],
      'task-a - guide-a - unguided': [
        { runNumber: 1, results: [{ id: 'c1', passed: false, message: 'fail' }], evalType: 'capability' }
      ],
      'task-b - guide-b - guided': [
        { runNumber: 1, results: [{ id: 'c1', passed: true, message: 'ok' }], evalType: 'regression' }
      ],
      'task-b - guide-b - unguided': [
        { runNumber: 1, results: [{ id: 'c1', passed: true, message: 'ok' }], evalType: 'regression' }
      ],
    };

    const metrics = calculateMetrics(allResults, 1);

    // Overall totals still work
    assert.strictEqual(metrics.summary.guidedTotal, 2);
    assert.strictEqual(metrics.summary.unguidedTotal, 2);

    // Capability split
    assert.ok(metrics.summary.capability, 'capability summary should exist');
    assert.strictEqual(metrics.summary.capability!.guidedPassed, 1);
    assert.strictEqual(metrics.summary.capability!.guidedTotal, 1);
    assert.strictEqual(metrics.summary.capability!.unguidedPassed, 0);
    assert.strictEqual(metrics.summary.capability!.unguidedTotal, 1);

    // Regression split
    assert.ok(metrics.summary.regression, 'regression summary should exist');
    assert.strictEqual(metrics.summary.regression!.guidedPassed, 1);
    assert.strictEqual(metrics.summary.regression!.guidedTotal, 1);
    assert.strictEqual(metrics.summary.regression!.unguidedPassed, 1);
    assert.strictEqual(metrics.summary.regression!.unguidedTotal, 1);

    // testStats have evalType
    assert.strictEqual(metrics.testStats['task-a - guide-a - guided'].evalType, 'capability');
    assert.strictEqual(metrics.testStats['task-b - guide-b - guided'].evalType, 'regression');
  });

  test('should return no capability/regression split when all tasks are same type', () => {
    const allResults: Record<string, RunResult[]> = {
      'task-a - guide-a - guided': [
        { runNumber: 1, results: [{ id: 'c1', passed: true, message: 'ok' }], evalType: 'capability' }
      ],
    };
    const metrics = calculateMetrics(allResults, 1);
    assert.ok(metrics.summary.capability, 'capability summary should exist');
    assert.strictEqual(metrics.summary.regression, undefined);
  });
});
