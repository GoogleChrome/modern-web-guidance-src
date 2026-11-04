import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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

  test('excludes infra errors (isEarlyFailure: true) from pass rate denominator and enforces paired task validity', () => {
    const validChecks3Of5 = [
      { id: 'c1', passed: true, message: 'check 1' },
      { id: 'c2', passed: true, message: 'check 2' },
      { id: 'c3', passed: true, message: 'check 3' },
      { id: 'c4', passed: false, message: 'check 4' },
      { id: 'c5', passed: false, message: 'check 5' },
    ];
    const infraErrorCheck = [
      { id: 'early-failure-1', passed: false, message: 'Agent exited with TIMEOUT (10m)', isEarlyFailure: true },
    ];
    const unguidedChecks1Of5 = [
      { id: 'c1', passed: true, message: 'check 1' },
      { id: 'c2', passed: false, message: 'check 2' },
      { id: 'c3', passed: false, message: 'check 3' },
      { id: 'c4', passed: false, message: 'check 4' },
      { id: 'c5', passed: false, message: 'check 5' },
    ];

    const allResults: Record<string, RunResult[]> = {
      // taskA: Run 1 valid (3/5), Run 2 infra error (excluded -> 0/0). Both sides have >=1 valid run -> included!
      'taskA - guideA - guided': [
        {
          runNumber: 1,
          guideName: 'guideA',
          guidesUsed: ['guideA'],
          guidanceToolsUsed: ['modern-web'],
          expectedToolPrefixes: ['modern-web'],
          results: validChecks3Of5
        },
        {
          runNumber: 2,
          guideName: 'guideA',
          guidesUsed: ['guideA'],
          guidanceToolsUsed: ['modern-web'],
          expectedToolPrefixes: ['modern-web'],
          results: infraErrorCheck
        }
      ],
      'taskA - guideA - unguided': [
        { runNumber: 1, results: unguidedChecks1Of5 },
        { runNumber: 2, results: unguidedChecks1Of5 }
      ],
      // taskB: Guided has ONLY infra errors (0 valid runs), while Unguided has valid runs.
      // Paired task validity must exclude taskB from both guided and unguided pass-rate rollups!
      'taskB - guideA - guided': [
        { runNumber: 1, results: infraErrorCheck }
      ],
      'taskB - guideA - unguided': [
        { runNumber: 1, results: validChecks3Of5 }
      ]
    };

    const metrics = calculateMetrics(allResults, 2);

    // taskA guided has 1 valid run (3/5 = 60%); taskB is excluded from rollup because guided had 0 valid runs
    assert.strictEqual(metrics.summary.guidedPassed, 3);
    assert.strictEqual(metrics.summary.guidedTotal, 5);
    assert.strictEqual(metrics.summary.guidedPassRate, 60);
    assert.strictEqual(metrics.summary.guidedMedian, 60);

    // taskA unguided has 2 valid runs (1/5 + 1/5 = 2/10 = 20%); taskB unguided is excluded from paired rollup!
    assert.strictEqual(metrics.summary.unguidedPassed, 2);
    assert.strictEqual(metrics.summary.unguidedTotal, 10);
    assert.strictEqual(metrics.summary.unguidedPassRate, 20);

    // Infra error counts: 2 guided runs failed early (1 in taskA, 1 in taskB)
    assert.strictEqual(metrics.summary.guidedEarlyFailures, 2);
    assert.strictEqual(metrics.summary.unguidedEarlyFailures, 0);
    assert.strictEqual(metrics.summary.totalGuidedRuns, 3);
  });
});
