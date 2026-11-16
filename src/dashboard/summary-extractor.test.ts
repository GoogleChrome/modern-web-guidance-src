import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobSummary } from './summary-extractor.js';
import {
    sanitizeReasoningEffort,
    normalizeReasoningEffort,
    getEffortLevel,
    getEffortTooltip,
    compareEffortLevels,
    pickHigherPrecedenceEffort,
    renderEffortChip,
} from './utils.js';

/**
 * Builds a trial whose grader results contain `passed` passes out of `total` checks.
 */
function mockTrial(passed: number, total: number) {
    return {
        runNumber: 1,
        results: Array.from({ length: total }, (_, i) => ({
            id: `check-${i + 1}`,
            passed: i < passed,
            message: `check ${i + 1}`,
        })),
    };
}

test('extractJobSummary breaks multi-base-app guides down per task', () => {
    const summary = extractJobSummary('job-1', {
        results: {
            'daily-grind - translator - guided': [mockTrial(4, 5)],
            'daily-grind - translator - unguided': [mockTrial(1, 5)],
            'devtools-times - translator - guided': [mockTrial(2, 5)],
            'devtools-times - translator - unguided': [mockTrial(0, 5)],
        },
    });

    assert.ok(summary);
    const translator = summary.guides.translator;

    // Guide-level totals stay as the roll-up across every base app.
    assert.strictEqual(translator.guidedRate, 60);
    assert.strictEqual(translator.unguidedRate, 10);

    // Each base app is also reported on its own so trend views can isolate one.
    assert.deepStrictEqual(Object.keys(translator.tasks ?? {}).sort(), ['daily-grind', 'devtools-times']);
    assert.strictEqual(translator.tasks?.['daily-grind'].guidedRate, 80);
    assert.strictEqual(translator.tasks?.['daily-grind'].unguidedRate, 20);
    assert.strictEqual(translator.tasks?.['devtools-times'].guidedRate, 40);
    assert.strictEqual(translator.tasks?.['devtools-times'].unguidedRate, 0);
});

test('extractJobSummary stores only a name for single-task guides', () => {
    const summary = extractJobSummary('job-2', {
        results: { 'task - preload-prerender - guided': [mockTrial(3, 4)], 'task - preload-prerender - unguided': [mockTrial(1, 4)], },
    });

    assert.ok(summary);
    const guide = summary.guides['preload-prerender'];

    // The roll-up already holds this task's numbers, so no breakdown is duplicated.
    assert.strictEqual(guide.taskName, 'task');
    assert.strictEqual(guide.tasks, undefined);
    assert.strictEqual(guide.guidedRate, 75);
});

test('extractJobSummary computes a11yStats, agent-only efficiencyStats, and rounded-rate-consistent uplift', () => {
    const summary = extractJobSummary('job-3', {
        results: {
            'daily-grind - scrollspy - unguided': [{
                discipline: 'ui-behaviors',
                runtime: { agentRuntime: 120000, graderRuntime: 9000 },
                tokenUsage: { total: 500000, cached: 450000 },
                results: [
                    { passed: true, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: false, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: false, message: 'Renders three sections', testId: 's3' },
                ],
            }],
            'daily-grind - scrollspy - guided': [{
                discipline: 'ui-behaviors',
                runtime: { agentRuntime: 90000, graderRuntime: 9000 },
                tokenUsage: { total: 600000, cached: 560000 },
                results: [
                    { passed: true, message: 'Active link sets aria-current="true"', testId: 's1' },
                    { passed: true, message: 'Respects prefers-reduced-motion', testId: 's2' },
                    { passed: false, message: 'Renders three sections', testId: 's3' },
                ],
            }],
        },
    } as never);
    assert.ok(summary);
    assert.strictEqual(summary.a11yStats.unguidedPassed, 1);
    assert.strictEqual(summary.a11yStats.unguidedTotal, 2);
    assert.strictEqual(summary.a11yStats.guidedPassed, 2);
    assert.strictEqual(summary.a11yStats.guidedTotal, 2);
    assert.strictEqual(summary.a11yStats.uplift, 50);
    assert.strictEqual(summary.a11yStats.guideCount, 1);
    const scrollspy = summary.guides.scrollspy;
    assert.strictEqual(scrollspy.unguidedRate, 33);
    assert.strictEqual(scrollspy.guidedRate, 67);
    assert.strictEqual(scrollspy.uplift, 34);
    assert.strictEqual(summary.efficiencyStats.runtime.unguidedMedianMs, 120000);
    assert.strictEqual(summary.efficiencyStats.runtime.guidedMedianMs, 90000);
    assert.strictEqual(summary.efficiencyStats.runtime.medianDeltaPct, -25);
    assert.strictEqual(summary.efficiencyStats.tokens.unguidedUncachedMedian, 50000);
    assert.strictEqual(summary.efficiencyStats.tokens.guidedUncachedMedian, 40000);
    assert.strictEqual(summary.efficiencyStats.tokens.uncachedMedianDeltaPct, -20);
});
test('extractJobSummary excludes infra-errored task pairs from guide and job rollups while counting agent-broken apps as 0/N', () => {
    // daily-grind: guided passed 5/5, unguided broke the app build (0/5 agent failure, not isEarlyFailure)
    // devtools-times: guided had an infra error (isEarlyFailure: true -> 0 valid trials), unguided passed 1/5
    // Paired task validity must exclude devtools-times from the translator rollup and job rollup!
    const summary = extractJobSummary('job-paired-validity', {
        results: {
            'daily-grind - translator - guided': [mockTrial(5, 5)],
            'daily-grind - translator - unguided': [mockTrial(0, 5)],
            'devtools-times - translator - guided': [
                {
                    runNumber: 1,
                    results: [
                        { id: 'early-failure-1', passed: false, message: 'TIMEOUT (10m)', isEarlyFailure: true }
                    ]
                }
            ],
            'devtools-times - translator - unguided': [mockTrial(1, 5)],
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

    // Job-level totals only include valid task pairs (daily-grind)
    assert.strictEqual(summary.guidedStats.total, 5);
    assert.strictEqual(summary.guidedStats.passed, 5);
    assert.strictEqual(summary.unguidedStats.total, 5);
    assert.strictEqual(summary.unguidedStats.passed, 0);

    // 1 out of 4 total trials was an infra error -> 25% (1/2 guided = 50%, 0/2 unguided = 0%)
    assert.strictEqual(summary.taskCount, 2);
    assert.strictEqual(summary.pairedTaskCount, 1);
    assert.strictEqual(summary.earlyFailureRate, 25);
    assert.strictEqual(summary.earlyFailureCount, 1);
    assert.strictEqual(summary.guidedErrorRate, 50);
    assert.strictEqual(summary.unguidedErrorRate, 0);

    // Chart data only includes the eligible task (daily-grind)
    assert.deepStrictEqual(summary.chartData.labels, ['daily-grind (translator)']);
    assert.deepStrictEqual(summary.chartData.guided, [100]);
    assert.deepStrictEqual(summary.chartData.unguided, [0]);
    assert.deepStrictEqual(summary.chartData.guided_err_rate, [0]);
    assert.deepStrictEqual(summary.chartData.unguided_err_rate, [0]);
});

test('extractJobSummary computes unguidedLeakRate when unguided trial accesses expected guide', () => {
    const summary = extractJobSummary('job-leak', {
        results: {
            'daily-grind - translator - guided': [mockTrial(5, 5)],
            'daily-grind - translator - unguided': [{ ...mockTrial(5, 5), guidesUsed: ['translator'] }],
            'devtools-times - translator - guided': [mockTrial(5, 5)],
            'devtools-times - translator - unguided': [mockTrial(0, 5)],
        },
    });

    assert.ok(summary);
    // 1 out of 2 unguided trials leaked -> 50%, without altering pass rates
    assert.strictEqual(summary.unguidedLeakRate, 50);
    assert.strictEqual(summary.unguidedStats.passed, 5);
    assert.strictEqual(summary.unguidedStats.total, 10);
});
test('extractJobSummary counts distinct base-app tasks and excludes infra errors from efficiency medians while counting timeouts', () => {
    const summary = extractJobSummary('job-efficiency-hygiene', {
        results: {
            'task - preload-prerender - guided': [{
                ...mockTrial(4, 4),
                runtime: { agentRuntime: 60000, graderRuntime: 5000 },
                tokenUsage: { total: 100000, cached: 70000 },
            }],
            'task - preload-prerender - unguided': [{
                ...mockTrial(2, 4),
                runtime: { agentRuntime: 90000, graderRuntime: 5000 },
                tokenUsage: { total: 120000, cached: 70000 },
            }],
            'task - responsive-table - guided': [{
                ...mockTrial(4, 4),
                runtime: { agentRuntime: 80000, graderRuntime: 5000 },
                tokenUsage: { total: 110000, cached: 70000 },
            }],
            'task - responsive-table - unguided': [
                {
                    ...mockTrial(1, 4),
                    runtime: { agentRuntime: 110000, graderRuntime: 5000 },
                    tokenUsage: { total: 130000, cached: 70000 },
                },
                {
                    runNumber: 2,
                    runtime: { agentRuntime: 2000, graderRuntime: 0 },
                    tokenUsage: { total: 1500, cached: 0 },
                    results: [{ id: 'ef-1', passed: false, message: 'TIMEOUT (10m)', isEarlyFailure: true }],
                },
            ],
        },
    } as never);
    assert.ok(summary);
    // Without summary.taskCount, older evals.json files count distinct base-app names (both tasks share `task`).
    assert.strictEqual(summary.taskCount, 1);
    assert.strictEqual(summary.efficiencyStats.runtime.unguidedMedianMs, 100000);
    assert.strictEqual(summary.efficiencyStats.tokens.unguidedUncachedMedian, 55000);
    assert.strictEqual(summary.efficiencyStats.runtime.unguidedTimeouts, 1);
    assert.strictEqual(summary.efficiencyStats.runtime.guidedTimeouts, 0);
});
test('extractJobSummary emits Spotlight slices only for featured guides, aligned by check id', () => {
    const trial = (checks: Array<[string, boolean]>, extra: Record<string, unknown> = {}) => ({
        runNumber: 1,
        prompt: 'add an action menu',
        discipline: 'ui-components',
        guidesUsed: ['menu'],
        runtime: { agentRuntime: 60000, graderRuntime: 5000 },
        tokenUsage: { total: 100000, cached: 60000 },
        results: checks.map(([id, passed]) => ({ id, passed, message: `check ${id}` })),
        ...extra,
    });
    const summary = extractJobSummary('nightly-2026-10-28_01-55-42-claude_code', {
        results: {
            'task - menu - guided': [trial([['a', true], ['b', true], ['c', false]])],
            // Unguided lists checks in a different order; slices must align by id, not position.
            'task - menu - unguided': [trial([['c', false], ['a', true], ['b', false]], { guidesUsed: [] })],
            'task - not-featured - guided': [trial([['x', true]])],
            'task - not-featured - unguided': [trial([['x', false]])],
        },
    } as never);
    assert.ok(summary);
    assert.deepStrictEqual(Object.keys(summary.showcase), ['menu']);
    const slice = summary.showcase['menu'];
    assert.strictEqual(slice.prompt, 'add an action menu');
    assert.strictEqual(slice.discipline, 'ui-components');
    assert.deepStrictEqual([slice.unguided.passed, slice.unguided.total, slice.guided.passed, slice.guided.total], [1, 3, 2, 3]);
    assert.strictEqual(slice.guided.uncachedTokens, 40000);
    assert.strictEqual(slice.guided.earlyFailure, false);
    assert.deepStrictEqual(slice.checks.map(c => [c.message, c.unguidedPassed, c.guidedPassed]), [
        ['check a', true, true],
        ['check b', false, true],
        ['check c', false, false],
    ]);
});

test('extractJobSummary preserves valid reasoningEffort and omits absent or malformed values', () => {
    const baseResults = {
        'task - preload-prerender - guided': [mockTrial(4, 4)],
        'task - preload-prerender - unguided': [mockTrial(2, 4)],
    };

    const legacy = extractJobSummary('legacy-job', { results: baseResults });
    assert.ok(legacy);
    assert.strictEqual('reasoningEffort' in legacy, false);

    const observed = extractJobSummary('observed-job', {
        results: baseResults,
        reasoningEffort: { level: 'high', source: 'observed' },
    });
    assert.ok(observed);
    assert.deepStrictEqual(observed.reasoningEffort, { level: 'high', source: 'observed' });

    const configured = extractJobSummary('configured-job', {
        results: baseResults,
        reasoningEffort: { level: 'medium', source: 'configured' },
    });
    assert.ok(configured);
    assert.deepStrictEqual(configured.reasoningEffort, { level: 'medium', source: 'configured' });

    const modelId = extractJobSummary('model-id-job', {
        results: baseResults,
        reasoningEffort: { level: 'low', source: 'model-id' },
    });
    assert.ok(modelId);
    assert.deepStrictEqual(modelId.reasoningEffort, { level: 'low', source: 'model-id' });

    const agentDefault = extractJobSummary('agent-default-job', {
        results: baseResults,
        reasoningEffort: { source: 'agent-default' },
    });
    assert.ok(agentDefault);
    assert.deepStrictEqual(agentDefault.reasoningEffort, { source: 'agent-default' });

    for (const bad of [
        null,
        'high',
        { level: 'high', source: 'bogus' },
        { source: 'observed' },
        { level: 'MEDIUM', source: 'configured' },
        { level: '   ', source: 'configured' },
        { level: '<script>alert(1)</script>', source: 'observed' },
    ]) {
        const summary = extractJobSummary('malformed-job', {
            results: baseResults,
            reasoningEffort: bad as never,
        });
        assert.ok(summary);
        assert.strictEqual('reasoningEffort' in summary, false);
    }
});

test('extractJobSummary preserves curated flag when present', () => {
    const regular = extractJobSummary('regular-job', { results: {} });
    assert.ok(regular);
    assert.strictEqual('curated' in regular, false);

    const curated = extractJobSummary('curated-job', {
        results: {},
        curated: true,
    } as never);
    assert.ok(curated);
    assert.strictEqual(curated.curated, true);
});

test('reasoningEffort helpers format provenance tooltips, order levels, and reject unsafe tokens', () => {
    assert.deepStrictEqual(normalizeReasoningEffort(undefined), { source: 'agent-default' });
    assert.strictEqual(sanitizeReasoningEffort({ level: 'custom_tier-2', source: 'observed' })?.level, 'custom_tier-2');
    assert.strictEqual(sanitizeReasoningEffort({ level: ' High ', source: 'observed' }), undefined);
    assert.strictEqual(getEffortLevel(undefined), 'default');
    assert.strictEqual(getEffortLevel({ source: 'agent-default' }), 'default');
    assert.strictEqual(getEffortLevel({ level: 'xhigh', source: 'configured' }), 'xhigh');

    assert.strictEqual(
        getEffortTooltip({ level: 'high', source: 'observed' }),
        'Reasoning effort: high (observed from agent logs)'
    );
    assert.strictEqual(
        getEffortTooltip({ level: 'medium', source: 'configured' }),
        'Reasoning effort: medium (configured by harness)'
    );
    assert.strictEqual(
        getEffortTooltip({ level: 'low', source: 'model-id' }),
        'Reasoning effort: low (from model ID)'
    );
    assert.strictEqual(
        getEffortTooltip({ source: 'agent-default' }),
        'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)'
    );
    assert.strictEqual(
        getEffortTooltip(undefined),
        'Reasoning effort: default (CLI built-in default; not explicitly configured or logged)'
    );

    const levels = ['default', 'max', 'high', 'low', 'off', 'xhigh', 'medium'];
    assert.deepStrictEqual(
        [...levels].sort(compareEffortLevels),
        ['off', 'low', 'medium', 'high', 'xhigh', 'max', 'default']
    );

    assert.deepStrictEqual(
        pickHigherPrecedenceEffort(
            { level: 'high', source: 'configured' },
            { level: 'high', source: 'observed' }
        ),
        { level: 'high', source: 'observed' }
    );

    const rejectedMarkup = renderEffortChip({ level: '<img src=x onerror=1>', source: 'configured' }, { interactive: false });
    assert.ok(!rejectedMarkup.includes('<img'), 'must reject HTML injection in effort level');
    assert.ok(rejectedMarkup.includes('data-effort-level="default"'));

    const interactiveBtn = renderEffortChip({ level: 'high', source: 'observed' });
    assert.ok(interactiveBtn.includes('interestfor="effort-tooltip"'));
    assert.ok(interactiveBtn.includes('data-effort-level="high"'));
    assert.ok(interactiveBtn.includes('data-effort-source="observed"'));
});
