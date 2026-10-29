import { test } from 'node:test';
import assert from 'node:assert';
import {
    computeHeadlineInsights,
    selectRecentSuites,
    hydrateMissingStats,
    getAgentFamily,
    getSuiteTimestamp,
    AGENT_FAMILIES,
} from './insights.js';
import { extractSuiteSummary } from './summary-extractor.js';

function mockEvals(agent: string, model: string, timestamp: string, tasks: Array<{ name: string; passed: [number, number] }>) {
    const results: Record<string, unknown[]> = {};
    for (const t of tasks) {
        (['unguided', 'guided'] as const).forEach((mode, idx) => {
            const passed = t.passed[idx];
            results[`task - ${t.name} - ${mode}`] = [{
                results: [
                    { passed: passed >= 1, message: 'Trigger button sets aria-expanded="true"', testId: 'a' },
                    { passed: passed >= 2, message: 'Renders panels', testId: 'b' },
                    { passed: passed >= 3, message: 'Uses popover', testId: 'c' },
                    { passed: passed >= 4, message: 'Persists state', testId: 'd' },
                ],
            }];
        });
    }
    return { agent, model, timestamp, results, summary: { taskCount: tasks.length } };
}

function suite(testId: string, agent: string, model: string, timestamp: string, tasks: Parameters<typeof mockEvals>[3]) {
    const summary = extractSuiteSummary(testId, mockEvals(agent, model, timestamp, tasks) as never);
    assert.ok(summary);
    return summary;
}

const gemini3 = suite('nightly-2026-10-09_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-09T07:00:02Z', [
    { name: 'accordion', passed: [2, 4] },
    { name: 'dialog', passed: [1, 4] },
    { name: 'timeout', passed: [0, 4] },
]);
const gemini2 = suite('nightly-2026-10-07_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-07T07:00:02Z', [
    { name: 'accordion', passed: [3, 4] },
    { name: 'dialog', passed: [2, 3] },
]);
const gemini1 = suite('nightly-2026-09-25_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-25T17:00:02Z', [
    { name: 'accordion', passed: [2, 4] },
]);
const gemini0 = suite('nightly-2026-09-21_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-21T17:00:02Z', [
    { name: 'accordion', passed: [0, 0] },
]);
const claude1 = suite('nightly-2026-10-09_11-12-49-claude_code', 'claude_code', 'claude-z', '2026-10-09T11:12:49Z', [
    { name: 'accordion', passed: [2, 4] },
    { name: 'dialog', passed: [2, 2] },
]);
const adhoc = suite('opus-4.8-2026-06-10_17-23-16', 'claude_code', 'claude-old', '2026-06-10T17:23:16Z', [
    { name: 'accordion', passed: [0, 0] },
]);

const manifest = [gemini0, gemini1, adhoc, claude1, gemini3, gemini2];

test('getAgentFamily and getSuiteTimestamp resolve family lineage and timestamps', () => {
    assert.strictEqual(getAgentFamily('antigravity_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('jetski_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('claude_code')?.id, 'claude_code');
    assert.strictEqual(getAgentFamily('codex_cli')?.id, 'codex_cli');
    assert.strictEqual(getAgentFamily('gemini_cli'), null);
    assert.strictEqual(AGENT_FAMILIES.length, 3);

    assert.strictEqual(getSuiteTimestamp({ testId: 'nightly-2026-10-09_07-00-02-antigravity_cli' }), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(getSuiteTimestamp({ testId: 'nightly-2026-10-09_18-30-00-codex_cli', timestamp: '2026-10-09' }), '2026-10-09T18:30:00.000Z');
    assert.strictEqual(getSuiteTimestamp({ testId: 'custom', timestamp: '2026-10-09T14:20:00' }), '2026-10-09T14:20:00.000Z');
    // Date-only sources stay date-only (no invented UTC-midnight instant) so re-parsing keeps the calendar day.
    assert.strictEqual(getSuiteTimestamp({ testId: 'custom', timestamp: '2026-10-09' }), '2026-10-09');
    assert.strictEqual(getSuiteTimestamp({ testId: 'nightly-2026-10-09-claude_code' }), '2026-10-09');
    assert.strictEqual(getSuiteTimestamp({ testId: 'x', timestamp: '2026-01-01T00:00:00.000Z' }), '2026-01-01T00:00:00.000Z');
    assert.strictEqual(getSuiteTimestamp({ testId: 'no-date' }), '');
});

test('selectRecentSuites defaults to the latest 1 nightly suite per family regardless of model', () => {
    const defaultSelected = selectRecentSuites(manifest);
    assert.deepStrictEqual((defaultSelected.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId]);
    assert.deepStrictEqual((defaultSelected.get(AGENT_FAMILIES[0]) ?? []).map(s => s.testId), [claude1.testId]);
    assert.deepStrictEqual(defaultSelected.get(AGENT_FAMILIES[1]), []);

    const selected = selectRecentSuites(manifest, { perAgentRecentN: 3 });
    assert.deepStrictEqual((selected.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId, gemini2.testId, gemini1.testId]);
    assert.deepStrictEqual((selected.get(AGENT_FAMILIES[0]) ?? []).map(s => s.testId), [claude1.testId]);
    assert.deepStrictEqual(selected.get(AGENT_FAMILIES[1]), []);

    const g38 = suite('nightly-2026-10-19_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-3.8-flash', '2026-10-19T07:00:02Z', [{ name: 'accordion', passed: [1, 2] }]);
    const g4 = suite('nightly-2026-10-20_18-18-02-antigravity_cli', 'antigravity_cli', 'gemini-4-argon', '2026-10-20T18:18:02Z', [{ name: 'accordion', passed: [3, 4] }]);
    assert.deepStrictEqual((selectRecentSuites([g38, g4]).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [g4.testId]);
    assert.deepStrictEqual((selectRecentSuites([g38, g4], { before: '2026-10-20' }).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [g38.testId]);
});

test('computeHeadlineInsights pools pass rates and a11y from unrounded counts', () => {
    const insights = computeHeadlineInsights(manifest, { perAgentRecentN: 3 });
    assert.deepStrictEqual(insights.families.map(f => f.id), ['claude_code', 'antigravity_cli']);
    // Normalized to a canonical ISO instant by the shared parseSuiteDate.
    assert.strictEqual(insights.latestTimestamp, '2026-10-09T11:12:49.000Z');
    assert.deepStrictEqual(insights.missingStats, []);

    const gemini = insights.families.find(f => f.id === 'antigravity_cli');
    assert.ok(gemini);
    assert.strictEqual(gemini.suiteCount, 3);
    assert.strictEqual(gemini.overall.unguidedPassed, 10);
    assert.strictEqual(gemini.overall.unguidedTotal, 24);
    assert.strictEqual(gemini.overall.guidedPassed, 23);
    assert.strictEqual(gemini.overall.unguidedRate, 41.7);
    assert.strictEqual(gemini.overall.guidedRate, 95.8);
    assert.strictEqual(gemini.overall.upliftPp, 54.2);

    assert.ok(gemini.a11y);
    assert.strictEqual(gemini.a11y.unguidedTotal, 6);
    assert.strictEqual(gemini.a11y.unguidedPassed, 5);
    assert.strictEqual(gemini.a11y.guidedPassed, 6);
    assert.strictEqual(gemini.a11y.upliftPp, 16.7);

    assert.ok(insights.pooled);
    assert.strictEqual(insights.pooled.suiteCount, 4);
    assert.strictEqual(insights.pooled.overall.unguidedPassed, 14);
    assert.strictEqual(insights.pooled.overall.unguidedTotal, 32);
});

test('hydrateMissingStats recomputes summaries for selected suites lacking a11yStats', async () => {
    const bare = {
        testId: gemini3.testId,
        timestamp: gemini3.timestamp,
        agent: 'antigravity_cli',
        guidedStats: { passed: 1, total: 2 },
        unguidedStats: { passed: 0, total: 2 },
    };
    assert.deepStrictEqual(computeHeadlineInsights([bare], { perAgentRecentN: 3 }).missingStats, [gemini3.testId]);

    const raw = mockEvals('antigravity_cli', 'gemini-x', '2026-10-09T07:00:02Z', [{ name: 'accordion', passed: [2, 4] }]);
    const result = await hydrateMissingStats([bare], async () => raw as never, { perAgentRecentN: 1 });
    assert.deepStrictEqual(result, { hydrated: [gemini3.testId], failed: [] });
    assert.ok((bare as Record<string, unknown>).a11yStats);
});

test('computeHeadlineInsights returns null a11y when suites have zero accessibility checks and unions distinct guides', () => {
    const noA11ySuite = extractSuiteSummary('nightly-2026-10-12_07-00-00-codex_cli', {
        agent: 'codex_cli',
        model: 'gpt-x',
        timestamp: '2026-10-12T07:00:00Z',
        results: {
            'task - preload-prerender - unguided': [{ results: [{ passed: false, message: 'Uses speculationrules', testId: '1' }] }],
            'task - preload-prerender - guided': [{ results: [{ passed: true, message: 'Uses speculationrules', testId: '1' }] }],
        },
    } as never);
    assert.ok(noA11ySuite);
    const zeroInsights = computeHeadlineInsights([noA11ySuite]);
    assert.strictEqual(zeroInsights.families[0].a11y, null);
    assert.strictEqual(zeroInsights.pooled?.a11y, null);

    const sA = suite('nightly-2026-10-11_07-00-00-codex_cli', 'codex_cli', 'gpt-x', '2026-10-11T07:00:00Z', [{ name: 'accordion', passed: [1, 4] }]);
    const sB = suite('nightly-2026-10-10_07-00-00-codex_cli', 'codex_cli', 'gpt-x', '2026-10-10T07:00:00Z', [{ name: 'dialog', passed: [1, 4] }]);
    const unionInsights = computeHeadlineInsights([sA, sB], { perAgentRecentN: 2 });
    assert.strictEqual(unionInsights.families[0].a11y?.guideCount, 2);
});
