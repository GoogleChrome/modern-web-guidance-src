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
