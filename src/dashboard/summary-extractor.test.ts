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

test('extractSuiteSummary computes cross-cutting a11yStats and runtime/token efficiencyStats', () => {
    const summary = extractSuiteSummary('run-3', {
        results: {
            'daily-grind - accordion - unguided': [{
                runtimeMs: 120000,
                tokenUsage: { total: 500000, cached: 450000 },
                results: [
                    { passed: false, message: 'Trigger button sets aria-expanded="true"', testId: 'c1' },
                    { passed: true, message: 'Renders three panels', testId: 'c2' },
                ],
            }],
            'daily-grind - accordion - guided': [{
                runtimeMs: 90000,
                tokenUsage: { total: 600000, cached: 560000 },
                results: [
                    { passed: true, message: 'Trigger button sets aria-expanded="true"', testId: 'c1' },
                    { passed: true, message: 'Renders three panels', testId: 'c2' },
                ],
            }],
        },
    } as never);

    assert.ok(summary);
    assert.strictEqual(summary.a11yStats.unguidedPassed, 0);
    assert.strictEqual(summary.a11yStats.unguidedTotal, 1);
    assert.strictEqual(summary.a11yStats.guidedPassed, 1);
    assert.strictEqual(summary.a11yStats.guidedTotal, 1);
    assert.strictEqual(summary.a11yStats.uplift, 100);
    assert.strictEqual(summary.a11yStats.guideCount, 1);
    assert.strictEqual(summary.a11yStats.bySubCategory.aria_roles_live.guidedRate, 100);

    assert.strictEqual(summary.efficiencyStats.runtime.unguidedMedianMs, 120000);
    assert.strictEqual(summary.efficiencyStats.runtime.guidedMedianMs, 90000);
    assert.strictEqual(summary.efficiencyStats.runtime.medianDeltaPct, -25);
    assert.strictEqual(summary.efficiencyStats.runtime.fasterTaskPct, 100);
    assert.strictEqual(summary.efficiencyStats.runtime.pairedTaskCount, 1);

    // Uncached tokens: unguided = 50,000, guided = 40,000 (-20%)
    assert.strictEqual(summary.efficiencyStats.tokens.unguidedUncachedMedian, 50000);
    assert.strictEqual(summary.efficiencyStats.tokens.guidedUncachedMedian, 40000);
    assert.strictEqual(summary.efficiencyStats.tokens.uncachedMedianDeltaPct, -20);
    assert.strictEqual(summary.efficiencyStats.tokens.fewerUncachedTokensTaskPct, 100);
    assert.strictEqual(summary.efficiencyStats.tokens.pairedTaskCount, 1);
});

test('extractSuiteSummary efficiency uses agent runtime only and excludes token-less runs from pairs', () => {
    const summary = extractSuiteSummary('run-4', {
        results: {
            'task - popover - unguided': [{
                runtime: { agentRuntime: 650000, graderRuntime: 9000 }, // timed out (>= 600s), no tokens recorded
                results: [{ passed: false, message: 'Generation failed', isEarlyFailure: true }],
            }],
            'task - popover - guided': [{
                runtime: { agentRuntime: 200000, graderRuntime: 9000 },
                tokenUsage: { total: 100000, cached: 20000 },
                results: [{ passed: true, message: 'Uses popover', testId: 'p1' }],
            }],
            'task - dialog - unguided': [{
                runtime: { agentRuntime: 100000, graderRuntime: 9000 },
                tokenUsage: { total: 50000, cached: 10000 },
                results: [{ passed: true, message: 'Opens dialog', testId: 'd1' }],
            }],
            'task - dialog - guided': [{
                runtime: { agentRuntime: 120000, graderRuntime: 9000 },
                tokenUsage: { total: 60000, cached: 10000 },
                results: [{ passed: true, message: 'Opens dialog', testId: 'd1' }],
            }],
        },
    } as never);

    assert.ok(summary);
    const { runtime, tokens } = summary.efficiencyStats;
    // Grader time is excluded: medians are agent-only.
    assert.strictEqual(runtime.unguidedMedianMs, 375000);
    assert.strictEqual(runtime.guidedMedianMs, 160000);
    assert.strictEqual(runtime.unguidedTimeouts, 1);
    assert.strictEqual(runtime.guidedTimeouts, 0);
    assert.strictEqual(runtime.pairedTaskCount, 2);
    assert.strictEqual(runtime.fasterTasksCount, 1);
    // The timed-out unguided run has no tokens, so only `dialog` forms a token pair.
    assert.strictEqual(tokens.pairedTaskCount, 1);
    assert.strictEqual(tokens.fewerUncachedTasksCount, 0);
    assert.strictEqual(tokens.unguidedUncachedMedian, 40000);
    assert.strictEqual(tokens.guidedUncachedMedian, 65000);
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

test('extractSuiteSummary computes uplift from unrounded exact rates and attaches per-task a11y breakdowns', () => {
    const summary = extractSuiteSummary('run-rounding-and-task-a11y', {
        results: {
            'daily-grind - scrollspy - unguided': [{
                discipline: 'ui-behaviors',
                results: [
                    { passed: true, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: false, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: false, message: 'Scroll container has :focus-visible outline', testId: 's3' },
                ],
            }],
            'daily-grind - scrollspy - guided': [{
                discipline: 'ui-behaviors',
                results: [
                    { passed: true, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: true, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: false, message: 'Scroll container has :focus-visible outline', testId: 's3' },
                ],
            }],
            'devtools-times - scrollspy - unguided': [{
                discipline: 'ui-behaviors',
                results: [
                    { passed: false, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: false, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: false, message: 'Scroll container has :focus-visible outline', testId: 's3' },
                ],
            }],
            'devtools-times - scrollspy - guided': [{
                discipline: 'ui-behaviors',
                results: [
                    { passed: true, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: true, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: true, message: 'Scroll container has :focus-visible outline', testId: 's3' },
                ],
            }],
        },
    } as never);

    assert.ok(summary);
    const scrollspy = summary.guides.scrollspy;
    const dg = scrollspy.tasks?.['daily-grind'];
    const dt = scrollspy.tasks?.['devtools-times'];
    assert.ok(dg && dt);

    // 1/3 (33.33% -> 33%) to 2/3 (66.67% -> 67%): exact difference is 33.33 pp -> rounds to 33, not 67 - 33 = 34
    assert.strictEqual(dg.unguidedRate, 33);
    assert.strictEqual(dg.guidedRate, 67);
    assert.strictEqual(dg.uplift, 33);

    // Per-task a11y breakdown is populated on multi-target guides
    assert.ok(dg.a11y);
    assert.strictEqual(dg.a11y.unguidedPassed, 1);
    assert.strictEqual(dg.a11y.unguidedTotal, 3);
    assert.strictEqual(dg.a11y.guidedPassed, 2);
    assert.strictEqual(dg.a11y.guidedTotal, 3);
    assert.strictEqual(dg.a11y.uplift, 33);

    assert.ok(dt.a11y);
    assert.strictEqual(dt.a11y.unguidedPassed, 0);
    assert.strictEqual(dt.a11y.unguidedTotal, 3);
    assert.strictEqual(dt.a11y.guidedPassed, 3);
    assert.strictEqual(dt.a11y.guidedTotal, 3);
    assert.strictEqual(dt.a11y.uplift, 100);
});
