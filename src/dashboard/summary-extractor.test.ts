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

test('extractSuiteSummary normalizes historical crashed run (results.length === 1) to canonical N checks', () => {
    // Suppose devtools-times has 5 checks.
    // Guided run for devtools-times crashed early with 1 failure check (results.length === 1, isEarlyFailure: true).
    // Unguided run for devtools-times completed with 5 checks (results.length === 5).
    // daily-grind has 5 checks for both guided (5 checks) and unguided (5 checks).
    const summary = extractSuiteSummary('run-crashed-hist', {
        results: {
            'daily-grind - translator - guided': [mockRun(5, 5)],
            'daily-grind - translator - unguided': [mockRun(2, 5)],
            'devtools-times - translator - guided': [
                {
                    results: [
                        { id: 'early-failure-1', passed: false, message: 'TIMEOUT (10m)', isEarlyFailure: true }
                    ]
                }
            ],
            'devtools-times - translator - unguided': [mockRun(1, 5)],
        },
    } as never);

    assert.ok(summary);
    const translator = summary.guides.translator;

    // The crashed devtools-times target must be weighted by its full canonical 5 checks (not 1):
    // Guided passes = 5 (daily-grind) + 0 (devtools-times) = 5
    // Guided total = 5 (daily-grind) + 5 (devtools-times canonical) = 10
    // Guided rate = 5 / 10 = 50% (if it was weighted as 1, it would erroneously be 5 / 6 = 83%!)
    assert.strictEqual(translator.guidedPassed, 5);
    assert.strictEqual(translator.guidedTotal, 10);
    assert.strictEqual(translator.guidedRate, 50);

    // Unguided passes = 2 + 1 = 3 out of 10 = 30%
    assert.strictEqual(translator.unguidedPassed, 3);
    assert.strictEqual(translator.unguidedTotal, 10);
    assert.strictEqual(translator.unguidedRate, 30);

    // Suite-level totals must also reflect the canonical check count
    assert.strictEqual(summary.guidedStats.total, 10);
    assert.strictEqual(summary.guidedStats.passed, 5);
    assert.strictEqual(summary.unguidedStats.total, 10);
    assert.strictEqual(summary.unguidedStats.passed, 3);
});
