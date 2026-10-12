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

  test('should not exceed 100% guideUsageRate or toolActivationRate when an early-failure run invoked the guide before failing', () => {
    const allResults: Record<string, RunResult[]> = {
      'greenfield - task1 - guided': [
        {
          runNumber: 1,
          guideName: 'popover',
          guidesUsed: ['popover'],
          guidanceToolsUsed: ['npx modern-web-guidance@latest'],
          expectedToolPrefixes: ['npx modern-web-guidance'],
          results: [{ id: 'check1', passed: true, message: 'ok' }]
        },
        {
          runNumber: 2,
          guideName: 'popover',
          guidesUsed: ['popover'],
          guidanceToolsUsed: ['npx modern-web-guidance@latest'],
          expectedToolPrefixes: ['npx modern-web-guidance'],
          results: [{ id: 'generation-failed', passed: false, message: 'TIMEOUT (10m)', isEarlyFailure: true }]
        }
      ]
    };

    const metrics = calculateMetrics(allResults, 2);
    assert.strictEqual(metrics.summary.guideUsageCount, 1);
    assert.strictEqual(metrics.summary.guideUsageRate, 100);
    assert.strictEqual(metrics.summary.toolActivationCount, 1);
    assert.strictEqual(metrics.summary.toolActivationRate, 100);
  });
});
