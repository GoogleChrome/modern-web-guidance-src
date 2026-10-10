import { test } from 'node:test';
import assert from 'node:assert';
import { extractSuiteSummary } from './summary-extractor.js';

/**
 * Builds a run whose grader results contain `passed` passes out of `total` checks.
 */
function mockRun(passed: number, total: number) {
    return {
        results: Array.from({ length: total }, (_, i) => ({ passed: i < passed })),
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
    } as never);

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
    } as never);

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

