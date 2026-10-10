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

/**
 * Builds a raw evals.json-like payload with one task per entry of `tasks`.
 * Each task gives [unguidedPassed, guidedPassed] out of 4 checks (1 a11y check + 3 others),
 * plus agent runtime (ms) and tokens for each mode.
 */
function mockEvals(agent: string, model: string, timestamp: string, tasks: Array<{
    name: string;
    passed: [number, number];
    runtime: [number, number];
    tokens: [{ total: number; cached: number } | null, { total: number; cached: number } | null];
}>) {
    const results: Record<string, unknown[]> = {};
    for (const t of tasks) {
        (['unguided', 'guided'] as const).forEach((mode, idx) => {
            const passed = t.passed[idx];
            results[`task - ${t.name} - ${mode}`] = [{
                runtime: { agentRuntime: t.runtime[idx], graderRuntime: 10000 },
                tokenUsage: t.tokens[idx] ?? undefined,
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

const tok = (total: number, cached: number) => ({ total, cached });

// Antigravity family: two antigravity suites + one older jetski suite; guided is faster and cheaper.
const gemini3 = suite('nightly-2026-10-09_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-09T07:00:02Z', [
    { name: 'accordion', passed: [2, 4], runtime: [400000, 300000], tokens: [tok(300000, 60000), tok(250000, 50000)] },
    { name: 'dialog', passed: [1, 4], runtime: [500000, 350000], tokens: [tok(400000, 80000), tok(200000, 40000)] },
    { name: 'timeout', passed: [0, 4], runtime: [1800000, 200000], tokens: [null, tok(100000, 20000)] }, // unguided timed out: no tokens
]);
const gemini2 = suite('nightly-2026-10-07_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-07T07:00:02Z', [
    { name: 'accordion', passed: [3, 4], runtime: [420000, 380000], tokens: [tok(310000, 60000), tok(260000, 50000)] },
    { name: 'dialog', passed: [2, 3], runtime: [450000, 460000], tokens: [tok(390000, 80000), tok(210000, 40000)] },
]);
const gemini1 = suite('nightly-2026-09-25_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-25T17:00:02Z', [
    { name: 'accordion', passed: [2, 4], runtime: [200000, 150000], tokens: [tok(300000, 60000), tok(220000, 50000)] },
]);
const gemini0 = suite('nightly-2026-09-21_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-21T17:00:02Z', [
    { name: 'accordion', passed: [0, 0], runtime: [1, 1], tokens: [tok(1, 0), tok(1, 0)] }, // should be dropped by N=3
]);

// Claude: guided slower, more tokens (mostly cached).
const claude1 = suite('nightly-2026-10-09_11-12-49-claude_code', 'claude_code', 'claude-z', '2026-10-09T11:12:49Z', [
    { name: 'accordion', passed: [2, 4], runtime: [20000, 25000], tokens: [tok(100000, 94000), tok(150000, 143000)] },
    { name: 'dialog', passed: [2, 2], runtime: [30000, 28000], tokens: [tok(80000, 74000), tok(120000, 113000)] },
]);

// Not nightly: must be ignored by default.
const adhoc = suite('opus-4.8-2026-06-10_17-23-16', 'claude_code', 'claude-old', '2026-06-10T17:23:16Z', [
    { name: 'accordion', passed: [0, 0], runtime: [1, 1], tokens: [tok(1, 0), tok(1, 0)] },
]);

const manifest = [gemini0, gemini1, adhoc, claude1, gemini3, gemini2];

test('getAgentFamily folds antigravity and jetski into the Antigravity CLI family', () => {
    assert.strictEqual(getAgentFamily('antigravity_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('jetski_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('claude_code')?.id, 'claude_code');
    assert.strictEqual(getAgentFamily('codex_cli')?.id, 'codex_cli');
    assert.strictEqual(getAgentFamily('pi'), null);
    assert.strictEqual(getAgentFamily('gemini_cli'), null); // standalone Gemini CLI is a different harness agent
    assert.strictEqual(AGENT_FAMILIES.length, 3);
});

test('getSuiteTimestamp falls back to the date encoded in a nightly id', () => {
    assert.strictEqual(getSuiteTimestamp({ testId: 'nightly-2026-10-09_07-00-02-antigravity_cli' }), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(getSuiteTimestamp({ testId: 'x', timestamp: '2026-01-01T00:00:00.000Z' }), '2026-01-01T00:00:00.000Z');
    assert.strictEqual(getSuiteTimestamp({ testId: 'no-date' }), '');
});

test('selectRecentSuites keeps the latest N nightly suites per family, newest first', () => {
    const selected = selectRecentSuites(manifest, { perAgentRecentN: 3 });
    const gemini = selected.get(AGENT_FAMILIES[2]) ?? [];
    assert.deepStrictEqual(gemini.map(s => s.testId), [gemini3.testId, gemini2.testId, gemini1.testId]);
    const claude = selected.get(AGENT_FAMILIES[0]) ?? [];
    assert.deepStrictEqual(claude.map(s => s.testId), [claude1.testId]);
    assert.deepStrictEqual(selected.get(AGENT_FAMILIES[1]), []);

    // `before` excludes newer suites; `nightlyOnly: false` admits ad-hoc runs.
    const older = selectRecentSuites(manifest, { perAgentRecentN: 1, before: '2026-10-01' });
    assert.deepStrictEqual((older.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini1.testId]);
    const withAdhoc = selectRecentSuites(manifest, { perAgentRecentN: 5, nightlyOnly: false });
    assert.ok((withAdhoc.get(AGENT_FAMILIES[0]) ?? []).some(s => s.testId === adhoc.testId));
});

test('computeHeadlineInsights pools pass rates and a11y from unrounded counts', () => {
    const insights = computeHeadlineInsights(manifest, { perAgentRecentN: 3 });
    assert.deepStrictEqual(insights.families.map(f => f.id), ['claude_code', 'antigravity_cli']);
    assert.deepStrictEqual(insights.suiteIds, [claude1.testId, gemini3.testId, gemini2.testId, gemini1.testId]);
    assert.strictEqual(insights.latestTimestamp, '2026-10-09T11:12:49Z');
    assert.deepStrictEqual(insights.missingStats, []);

    const gemini = insights.families.find(f => f.id === 'antigravity_cli');
    assert.ok(gemini);
    assert.deepStrictEqual(gemini.agents, ['antigravity_cli', 'jetski_cli']);
    assert.deepStrictEqual(gemini.models, ['gemini-x', 'gemini-y']);
    assert.strictEqual(gemini.suiteCount, 3);
    assert.strictEqual(gemini.tasksEvaluated, 6);
    assert.strictEqual(gemini.latest.testId, gemini3.testId);
    assert.strictEqual(gemini.latest.date, '2026-10-09');

    // Unguided passed: 2+1+0 + 3+2 + 2 = 10 of 24; guided: 4+4+4 + 4+3 + 4 = 23 of 24.
    assert.strictEqual(gemini.overall.unguidedPassed, 10);
    assert.strictEqual(gemini.overall.unguidedTotal, 24);
    assert.strictEqual(gemini.overall.guidedPassed, 23);
    assert.strictEqual(gemini.overall.unguidedRate, 41.7);
    assert.strictEqual(gemini.overall.guidedRate, 95.8);
    assert.strictEqual(gemini.overall.upliftPp, 54.2); // from unrounded 95.83 - 41.67

    // One a11y check per task: unguided passes when passed >= 1. Each task name is its own guide.
    assert.ok(gemini.a11y);
    assert.strictEqual(gemini.a11y.unguidedTotal, 6);
    assert.strictEqual(gemini.a11y.unguidedPassed, 5);
    assert.strictEqual(gemini.a11y.guidedPassed, 6);
    assert.strictEqual(gemini.a11y.guideCount, 3);
    assert.strictEqual(gemini.a11y.upliftPp, 16.7);

    const pooled = insights.pooled;
    assert.ok(pooled);
    assert.strictEqual(pooled.suiteCount, 4);
    assert.strictEqual(pooled.familyCount, 2);
    assert.strictEqual(pooled.tasksEvaluated, 8);
    assert.strictEqual(pooled.overall.unguidedPassed, 14);
    assert.strictEqual(pooled.overall.unguidedTotal, 32);
});

test('computeHeadlineInsights pools per-task runtime and token pairs across suites', () => {
    const insights = computeHeadlineInsights(manifest, { perAgentRecentN: 3 });
    const gemini = insights.families.find(f => f.id === 'antigravity_cli');
    assert.ok(gemini?.runtime && gemini.tokens);

    // Six paired runtimes (timed-out run still has agent time). Unguided: 400,500,1800,420,450,200 -> median 435s.
    // Guided: 300,350,200,380,460,150 -> median 325s.
    assert.strictEqual(gemini.runtime.medianSource, 'pooled');
    assert.strictEqual(gemini.runtime.pairedTaskCount, 6);
    assert.strictEqual(gemini.runtime.unguidedMedianMs, 435000);
    assert.strictEqual(gemini.runtime.guidedMedianMs, 325000);
    assert.strictEqual(gemini.runtime.deltaPct, -25.3);
    assert.strictEqual(gemini.runtime.fasterTasksCount, 5); // dialog in gemini2 is slower
    assert.strictEqual(gemini.runtime.fasterTaskPct, 83.3);
    assert.strictEqual(gemini.runtime.suitesFaster, 3);
    assert.strictEqual(gemini.runtime.direction, 'faster');
    assert.strictEqual(gemini.runtime.latest.testId, gemini3.testId);
    assert.strictEqual(gemini.runtime.perSuite.length, 3);
    // Grader time (10s per run) must not leak into agent runtime.
    assert.strictEqual(gemini.runtime.latest.guidedMedianMs, 300000);

    // Token pairs exclude the timed-out unguided run (no tokens): 5 pairs.
    // Unguided uncached: 240k,320k,250k,310k,240k -> median 250k; guided: 200k,160k,210k,170k,170k -> 170k.
    assert.strictEqual(gemini.tokens.medianSource, 'pooled');
    assert.strictEqual(gemini.tokens.pairedTaskCount, 5);
    assert.strictEqual(gemini.tokens.unguidedUncachedMedian, 250000);
    assert.strictEqual(gemini.tokens.guidedUncachedMedian, 170000);
    assert.strictEqual(gemini.tokens.deltaPct, -32);
    assert.strictEqual(gemini.tokens.fewerTasksCount, 5);
    assert.strictEqual(gemini.tokens.fewerTaskPct, 100);
    assert.strictEqual(gemini.tokens.direction, 'fewer');
    assert.strictEqual(gemini.tokens.unguidedTotalMedian, 310000);
    // Cached share pooled from suite totals: unguided cached 60+80+60+80+60 = 340k of 1.7M = 20%.
    assert.strictEqual(gemini.tokens.unguidedCachedSharePct, 20);

    const claude = insights.families.find(f => f.id === 'claude_code');
    assert.ok(claude?.runtime && claude.tokens);
    assert.strictEqual(claude.runtime.direction, 'slower');
    assert.strictEqual(claude.runtime.fasterTasksCount, 1);
    assert.strictEqual(claude.runtime.pairedMedianDeltaMs, 1500); // median of (+5000, -2000)
    assert.strictEqual(claude.tokens.direction, 'more');
    assert.strictEqual(claude.tokens.guidedCachedSharePct, 94.8);

    assert.ok(insights.pooled?.runtime && insights.pooled.tokens);
    assert.strictEqual(insights.pooled.runtime.pairedTaskCount, 8);
    assert.strictEqual(insights.pooled.runtime.familiesFaster, 1);
    assert.strictEqual(insights.pooled.tokens.familiesFewer, 1);
});

test('computeHeadlineInsights falls back to latest-suite medians without per-task data', () => {
    const stripped = manifest.map(s => ({ ...s, chartData: { ...s.chartData, guided_runtime_ms: undefined } }));
    const insights = computeHeadlineInsights(stripped as never, { perAgentRecentN: 3 });
    const gemini = insights.families.find(f => f.id === 'antigravity_cli');
    assert.ok(gemini?.runtime && gemini.tokens);
    assert.strictEqual(gemini.runtime.medianSource, 'latest');
    assert.strictEqual(gemini.runtime.unguidedMedianMs, 500000); // median of gemini3 unguided 400/500/1800
    // Paired counts still pooled from efficiencyStats: 3 + 2 + 1 tasks.
    assert.strictEqual(gemini.runtime.pairedTaskCount, 6);
    assert.strictEqual(gemini.tokens.medianSource, 'latest');
    assert.strictEqual(gemini.tokens.pairedTaskCount, 5);
});

test('computeHeadlineInsights reports missing stats and handles empty input', () => {
    const bare = [{ testId: gemini3.testId, timestamp: gemini3.timestamp, agent: 'antigravity_cli', guidedStats: { passed: 1, total: 2 }, unguidedStats: { passed: 0, total: 2 } }];
    const insights = computeHeadlineInsights(bare, { perAgentRecentN: 3 });
    assert.deepStrictEqual(insights.missingStats, [gemini3.testId]);
    const gemini = insights.families[0];
    assert.strictEqual(gemini.a11y, null);
    assert.strictEqual(gemini.runtime, null);
    assert.strictEqual(gemini.overall.guidedRate, 50);

    const empty = computeHeadlineInsights([], {});
    assert.deepStrictEqual(empty.families, []);
    assert.strictEqual(empty.pooled, null);
    assert.strictEqual(empty.latestTimestamp, null);

    // Legacy string entries and non-nightly ids are ignored silently.
    assert.strictEqual(computeHeadlineInsights(['nightly-2026-01-01_00-00-00-codex_cli', 'weekly-x']).pooled, null);
});

test('hydrateMissingStats recomputes summaries for selected suites lacking headline stats', async () => {
    const bare = {
        testId: gemini3.testId,
        timestamp: gemini3.timestamp,
        agent: 'antigravity_cli',
        guidedStats: { passed: 0, total: 0 },
        unguidedStats: { passed: 0, total: 0 },
    };
    const notSelected = { ...bare, testId: 'nightly-2026-01-01_00-00-00-antigravity_cli', timestamp: '2026-01-01T00:00:00Z' };
    const fetched: string[] = [];
    const raw = mockEvals('antigravity_cli', 'gemini-x', '2026-10-09T07:00:02Z', [
        { name: 'accordion', passed: [2, 4], runtime: [400000, 300000], tokens: [tok(300000, 60000), tok(250000, 50000)] },
    ]);
    const result = await hydrateMissingStats([bare, notSelected], async (id) => { fetched.push(id); return raw as never; }, { perAgentRecentN: 1 });
    assert.deepStrictEqual(result, { hydrated: [gemini3.testId], failed: [] });
    assert.deepStrictEqual(fetched, [gemini3.testId]);
    assert.ok((bare as Record<string, unknown>).a11yStats);
    assert.strictEqual(computeHeadlineInsights([bare, notSelected], { perAgentRecentN: 1 }).missingStats.length, 0);

    const fresh = { testId: gemini3.testId, timestamp: gemini3.timestamp, agent: 'antigravity_cli', guidedStats: { passed: 0, total: 0 }, unguidedStats: { passed: 0, total: 0 } };
    const failing = await hydrateMissingStats([fresh], async () => { throw new Error('offline'); }, { perAgentRecentN: 1 });
    assert.deepStrictEqual(failing, { hydrated: [], failed: [gemini3.testId] });
});
