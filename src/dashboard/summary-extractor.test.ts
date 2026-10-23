import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSuiteSummary } from './summary-extractor.js';

/**
 * Builds a run whose grader results contain `passed` passes out of `total` checks.
 */
function mockRun(passed: number, total: number) {
    return {
        runNumber: 1,
        results: Array.from({ length: total }, (_, i) => ({
            id: `check-${i + 1}`,
            passed: i < passed,
            message: `check ${i + 1}`,
        })),
    };
}

test('extractSuiteSummary breaks multi-target guides down per task', () => {
    const summary = extractSuiteSummary('run-1', {
        results: {
            'daily-grind - translator - guided': [mockRun(4, 5)],
            'daily-grind - translator - unguided': [mockRun(1, 5)],
            'devtools-times - translator - guided': [mockRun(2, 5)],
            'devtools-times - translator - unguided': [mockRun(0, 5)],
        },
    });

    assert.ok(summary);
    const translator = summary.guides.translator;

    // Guide-level totals stay as the roll-up across every target.
    assert.strictEqual(translator.guidedRate, 60);
    assert.strictEqual(translator.unguidedRate, 10);

    // Each target is also reported on its own so trend views can isolate one.
    assert.deepStrictEqual(Object.keys(translator.tasks ?? {}).sort(), ['daily-grind', 'devtools-times']);
    assert.strictEqual(translator.tasks?.['daily-grind'].guidedRate, 80);
    assert.strictEqual(translator.tasks?.['daily-grind'].unguidedRate, 20);
    assert.strictEqual(translator.tasks?.['devtools-times'].guidedRate, 40);
    assert.strictEqual(translator.tasks?.['devtools-times'].unguidedRate, 0);
});

test('extractSuiteSummary stores only a name for single-task guides', () => {
    const summary = extractSuiteSummary('run-2', {
        results: {
            'task - preload-prerender - guided': [mockRun(3, 4)],
            'task - preload-prerender - unguided': [mockRun(1, 4)],
        },
    });

    assert.ok(summary);
    const guide = summary.guides['preload-prerender'];

    // The roll-up already holds this task's numbers, so no breakdown is duplicated.
    assert.strictEqual(guide.taskName, 'task');
    assert.strictEqual(guide.tasks, undefined);
    assert.strictEqual(guide.guidedRate, 75);
});

test('extractSuiteSummary excludes infra-errored task pairs from guide and suite rollups while counting agent-broken apps as 0/N', () => {
    // daily-grind: guided passed 5/5, unguided broke the app build (0/5 agent failure, not isEarlyFailure)
    // devtools-times: guided had an infra error (isEarlyFailure: true -> 0 valid runs), unguided passed 1/5
    // Paired task validity must exclude devtools-times from the translator rollup and suite rollup!
    const summary = extractSuiteSummary('run-paired-validity', {
        results: {
            'daily-grind - translator - guided': [mockRun(5, 5)],
            'daily-grind - translator - unguided': [mockRun(0, 5)],
            'devtools-times - translator - guided': [
                {
                    runNumber: 1,
                    results: [
                        { id: 'early-failure-1', passed: false, message: 'TIMEOUT (10m)', isEarlyFailure: true }
                    ]
                }
            ],
            'devtools-times - translator - unguided': [mockRun(1, 5)],
        },
    });

    assert.ok(summary);
    const translator = summary.guides.translator;

    // Only daily-grind is a valid pair: guided = 5/5 (100%), unguided = 0/5 (0%)
    assert.strictEqual(translator.guidedPassed, 5);
    assert.strictEqual(translator.guidedTotal, 5);
    assert.strictEqual(translator.guidedRate, 100);

    assert.strictEqual(translator.unguidedPassed, 0);
    assert.strictEqual(translator.unguidedTotal, 5);
    assert.strictEqual(translator.unguidedRate, 0);

    // devtools-times has 0 total in the per-task breakdown so guide.js filters it out
    assert.strictEqual(translator.tasks?.['devtools-times'].guidedTotal, 0);
    assert.strictEqual(translator.tasks?.['devtools-times'].unguidedTotal, 0);

    // Suite-level totals only include valid task pairs (daily-grind)
    assert.strictEqual(summary.guidedStats.total, 5);
    assert.strictEqual(summary.guidedStats.passed, 5);
    assert.strictEqual(summary.unguidedStats.total, 5);
    assert.strictEqual(summary.unguidedStats.passed, 0);

    // 1 out of 4 total runs was an early failure -> 25% (1/2 guided = 50%, 0/2 unguided = 0%)
    assert.strictEqual(summary.earlyFailureRate, 25);
    assert.strictEqual(summary.guidedErrorRate, 50);
    assert.strictEqual(summary.unguidedErrorRate, 0);

    // Chart data only includes the eligible scenario (daily-grind)
    assert.deepStrictEqual(summary.chartData.labels, ['daily-grind (translator)']);
    assert.deepStrictEqual(summary.chartData.guided, [100]);
    assert.deepStrictEqual(summary.chartData.unguided, [0]);
    assert.deepStrictEqual(summary.chartData.guided_err_rate, [0]);
    assert.deepStrictEqual(summary.chartData.unguided_err_rate, [0]);
});

test('extractSuiteSummary computes unguidedLeakRate when unguided run accesses expected guide', () => {
    const summary = extractSuiteSummary('run-leak', {
        results: {
            'daily-grind - translator - guided': [mockRun(5, 5)],
            'daily-grind - translator - unguided': [{ ...mockRun(5, 5), guidesUsed: ['translator'] }],
            'devtools-times - translator - guided': [mockRun(5, 5)],
            'devtools-times - translator - unguided': [mockRun(0, 5)],
        },
    });

    assert.ok(summary);
    // 1 out of 2 unguided runs leaked -> 50%, without altering pass rates
    assert.strictEqual(summary.unguidedLeakRate, 50);
    assert.strictEqual(summary.unguidedStats.passed, 5);
    assert.strictEqual(summary.unguidedStats.total, 10);
});
