import { test } from 'node:test';
import assert from 'node:assert';
import { computeHeadlineInsights, selectRecentJobs, hydrateMissingStats, hasHeadlineStats, getAgentFamily, getJobTimestamp, AGENT_FAMILIES, } from './insights.js';
import { extractJobSummary } from './summary-extractor.js';
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
function job(testId: string, agent: string, model: string, timestamp: string, tasks: Parameters<typeof mockEvals>[3]) { const summary = extractJobSummary(testId, mockEvals(agent, model, timestamp, tasks) as never); assert.ok(summary); return summary; }
const gemini3 = job('nightly-2026-10-09_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-09T07:00:02Z', [
    { name: 'accordion', passed: [2, 4] },
    { name: 'dialog', passed: [1, 4] },
    { name: 'timeout', passed: [0, 4] },
]);
const gemini2 = job('nightly-2026-10-07_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-x', '2026-10-07T07:00:02Z', [
    { name: 'accordion', passed: [3, 4] },
    { name: 'dialog', passed: [2, 3] },
]);
const gemini1 = job('nightly-2026-09-25_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-25T17:00:02Z', [
    { name: 'accordion', passed: [2, 4] },
]);
const gemini0 = job('nightly-2026-09-21_17-00-02-jetski_cli', 'jetski_cli', 'gemini-y', '2026-09-21T17:00:02Z', [
    { name: 'accordion', passed: [0, 0] },
]);
const claude1 = job('nightly-2026-10-09_11-12-49-claude_code', 'claude_code', 'claude-z', '2026-10-09T11:12:49Z', [
    { name: 'accordion', passed: [2, 4] },
    { name: 'dialog', passed: [2, 2] },
]);
const adhoc = job('opus-4.8-2026-06-10_17-23-16', 'claude_code', 'claude-old', '2026-06-10T17:23:16Z', [
    { name: 'accordion', passed: [0, 0] },
]);
const manifest = [gemini0, gemini1, adhoc, claude1, gemini3, gemini2];
test('getAgentFamily and getJobTimestamp resolve family lineage and timestamps', () => {
    assert.strictEqual(getAgentFamily('antigravity_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('jetski_cli')?.id, 'antigravity_cli');
    assert.strictEqual(getAgentFamily('claude_code')?.id, 'claude_code');
    assert.strictEqual(getAgentFamily('codex_cli')?.id, 'codex_cli');
    assert.strictEqual(getAgentFamily('unknown_agent'), null);
    assert.strictEqual(AGENT_FAMILIES.length, 3);
    assert.strictEqual(getJobTimestamp({ testId: 'nightly-2026-10-09_07-00-02-antigravity_cli' }), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(getJobTimestamp({ testId: 'nightly-2026-10-09_18-30-00-codex_cli', timestamp: '2026-10-09' }), '2026-10-09T18:30:00.000Z');
    assert.strictEqual(getJobTimestamp({ testId: 'custom', timestamp: '2026-10-09T14:20:00' }), '2026-10-09T14:20:00.000Z');
    assert.strictEqual(getJobTimestamp({ testId: 'custom', timestamp: '2026-10-09' }), '2026-10-09');
    assert.strictEqual(getJobTimestamp({ testId: 'nightly-2026-10-09-claude_code' }), '2026-10-09');
    assert.strictEqual(getJobTimestamp({ testId: 'x', timestamp: '2026-01-01T00:00:00.000Z' }), '2026-01-01T00:00:00.000Z');
    assert.strictEqual(getJobTimestamp({ testId: 'no-date' }), '');
});
test('selectRecentJobs selects the latest canonical job per model for each family', () => {
    const defaultSelected = selectRecentJobs(manifest, { modelRecencyDays: 30 });
    assert.deepStrictEqual((defaultSelected.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId, gemini1.testId]);
    assert.deepStrictEqual((defaultSelected.get(AGENT_FAMILIES[0]) ?? []).map(s => s.testId), [claude1.testId]);
    assert.deepStrictEqual(defaultSelected.get(AGENT_FAMILIES[1]), []);
    const selected = selectRecentJobs(manifest, { perAgentRecentN: 3, modelRecencyDays: 30 });
    assert.deepStrictEqual((selected.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId, gemini2.testId, gemini1.testId, gemini0.testId]);
    assert.deepStrictEqual((selected.get(AGENT_FAMILIES[0]) ?? []).map(s => s.testId), [claude1.testId]);
    assert.deepStrictEqual(selected.get(AGENT_FAMILIES[1]), []);
    const g38 = job('nightly-2026-10-19_07-00-02-antigravity_cli', 'antigravity_cli', 'gemini-3.8-flash', '2026-10-19T07:00:02Z', [{ name: 'accordion', passed: [1, 2] }]);
    const g4 = job('nightly-2026-10-20_18-18-02-antigravity_cli', 'antigravity_cli', 'gemini-4-argon', '2026-10-20T18:18:02Z', [{ name: 'accordion', passed: [3, 4] }]);
    // Both models selected because they are distinct models in the same family:
    assert.deepStrictEqual((selectRecentJobs([g38, g4]).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [g4.testId, g38.testId]);
    // Curated 1.0 baseline supersedes g4 (same model) and drops g38 outside the 7-day recency window:
    const curated = { ...job('argon-medium-1.0-2026-11-09', 'antigravity_cli', 'gemini-4-argon', '2026-11-09T09:12:48Z', [{ name: 'accordion', passed: [4, 4] }]), curated: true };
    assert.deepStrictEqual((selectRecentJobs([g38, g4, curated]).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [curated.testId]);
    assert.deepStrictEqual((selectRecentJobs([g38, g4], { before: '2026-10-20' }).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [g38.testId]);
    // Newer job for gemini-4-argon supersedes older job for the same model:
    const g4Newer = job('nightly-2026-10-22_18-18-02-antigravity_cli', 'antigravity_cli', 'gemini-4-argon', '2026-10-22T18:18:02Z', [{ name: 'accordion', passed: [4, 4] }]);
    assert.deepStrictEqual((selectRecentJobs([g38, g4, g4Newer]).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [g4Newer.testId, g38.testId]);
    // Curated baseline job is canonical and recognized alongside nightlies:
    const gCurated = { ...g38, testId: 'flash-medium-1.0-2026-11-08b', curated: true, timestamp: '2026-10-23T00:00:00Z' };
    assert.deepStrictEqual((selectRecentJobs([gCurated, g4Newer]).get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gCurated.testId, g4Newer.testId]);
});
test('selectRecentJobs drops stale retired models older than modelRecencyDays', () => {
    // gemini-y from Sept 25 is > 7 days older than gemini-x from Oct 9:
    const recent = selectRecentJobs(manifest);
    assert.deepStrictEqual((recent.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId]);
    // Wide window includes gemini-y:
    const wide = selectRecentJobs(manifest, { modelRecencyDays: 30 });
    assert.deepStrictEqual((wide.get(AGENT_FAMILIES[2]) ?? []).map(s => s.testId), [gemini3.testId, gemini1.testId]);
});
test('computeHeadlineInsights pools pass rates and a11y from unrounded counts', () => {
    const insights = computeHeadlineInsights(manifest, { perAgentRecentN: 3, modelRecencyDays: 30 });
    assert.deepStrictEqual(insights.families.map(f => f.id), ['claude_code', 'antigravity_cli']);
    assert.strictEqual(insights.latestTimestamp, '2026-10-09T11:12:49.000Z');
    assert.deepStrictEqual(insights.missingStats, []);
    const gemini = insights.families.find(f => f.id === 'antigravity_cli');
    assert.ok(gemini);
    assert.strictEqual(gemini.jobCount, 4);
    assert.strictEqual(insights.maxJobsPerFamily, 2);
    assert.strictEqual(gemini.sample.attemptedTasks, 7);
    assert.strictEqual(gemini.sample.pairedTasks, 7);
    assert.strictEqual(gemini.sample.excludedTasks, 0);
    assert.strictEqual(gemini.sample.minTrialsPerTask, 1);
    assert.strictEqual(gemini.sample.maxTrialsPerTask, 1);
    assert.strictEqual(gemini.sample.infraErrorCount, 0);
    assert.strictEqual(gemini.sample.infraErrorRate, 0);
    assert.strictEqual(gemini.sample.pageLoadFailed, 0);
    assert.strictEqual(gemini.overall.unguidedPassed, 10);
    assert.strictEqual(gemini.overall.unguidedTotal, 28);
    assert.strictEqual(gemini.overall.guidedPassed, 23);
    assert.strictEqual(gemini.overall.unguidedRate, 35.7);
    assert.strictEqual(gemini.overall.guidedRate, 82.1);
    assert.strictEqual(gemini.overall.upliftPp, 46.4);
    assert.ok(gemini.a11y);
    assert.strictEqual(gemini.a11y.unguidedTotal, 7);
    assert.strictEqual(gemini.a11y.unguidedPassed, 5);
    assert.strictEqual(gemini.a11y.guidedPassed, 6);
    assert.strictEqual(gemini.a11y.upliftPp, 14.3);
    assert.ok(insights.pooled);
    assert.strictEqual(insights.pooled.jobCount, 5);
    assert.strictEqual(insights.pooled.overall.unguidedPassed, 14);
    assert.strictEqual(insights.pooled.overall.unguidedTotal, 36);
});
test('hydrateMissingStats recomputes summaries for selected jobs lacking a11yStats', async () => {
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
test('computeHeadlineInsights returns null a11y when jobs have zero accessibility checks and unions distinct guides', () => {
    const noA11yJob = extractJobSummary('nightly-2026-10-12_07-00-00-codex_cli', {
        agent: 'codex_cli',
        model: 'gpt-x',
        timestamp: '2026-10-12T07:00:00Z',
        results: {
            'task - preload-prerender - unguided': [{ results: [{ passed: false, message: 'Uses speculationrules', testId: '1' }] }],
            'task - preload-prerender - guided': [{ results: [{ passed: true, message: 'Uses speculationrules', testId: '1' }] }],
        },
    } as never);
    assert.ok(noA11yJob);
    const zeroInsights = computeHeadlineInsights([noA11yJob]);
    assert.strictEqual(zeroInsights.families[0].a11y, null);
    assert.strictEqual(zeroInsights.pooled?.a11y, null);
    const jA = job('nightly-2026-10-11_07-00-00-codex_cli', 'codex_cli', 'gpt-x', '2026-10-11T07:00:00Z', [{ name: 'accordion', passed: [1, 4] }]);
    const jB = job('nightly-2026-10-10_07-00-00-codex_cli', 'codex_cli', 'gpt-x', '2026-10-10T07:00:00Z', [{ name: 'dialog', passed: [1, 4] }]);
    const unionInsights = computeHeadlineInsights([jA, jB], { perAgentRecentN: 2 });
    assert.strictEqual(unionInsights.families[0].a11y?.guideCount, 2);
});
test('computeHeadlineInsights summarizes excluded pairs, infra errors, page-load failures, and legacy fallback', () => {
    const insights = computeHeadlineInsights([
        {
            testId: 'nightly-2026-10-28_00-00-00-claude_code',
            timestamp: '2026-10-28T00:00:00Z',
            agent: 'claude_code',
            model: 'claude-5',
            taskCount: 200,
            pairedTaskCount: 197,
            maxRuns: 3,
            earlyFailureRate: 2,
            earlyFailureCount: 4,
            unguidedLeakRate: 3,
            pageLoadStats: { guidedFailed: 1, unguidedFailed: 2 },
            guidedStats: { passed: 90, total: 100 },
            unguidedStats: { passed: 50, total: 100 },
        },
        {
            testId: 'nightly-2026-10-27_00-00-00-claude_code',
            timestamp: '2026-10-27T00:00:00Z',
            agent: 'claude_code',
            model: 'claude-5',
            taskCount: 198,
            maxRuns: 1,
            earlyFailureRate: 1,
            guidedStats: { passed: 80, total: 100 },
            unguidedStats: { passed: 40, total: 100 },
        },
    ], { perAgentRecentN: 5 });
    assert.strictEqual(insights.maxJobsPerFamily, 2);
    const claude = insights.families[0];
    assert.strictEqual(claude.jobCount, 2);
    assert.strictEqual(claude.sample.attemptedTasks, 398);
    assert.strictEqual(claude.sample.pairedTasks, 395);
    assert.strictEqual(claude.sample.excludedTasks, 3);
    assert.strictEqual(claude.sample.minTrialsPerTask, 1);
    assert.strictEqual(claude.sample.maxTrialsPerTask, 3);
    // Mixed legacy + new manifest drops exact count to null and averages rate
    assert.strictEqual(claude.sample.infraErrorCount, null);
    assert.strictEqual(claude.sample.infraErrorRate, 2);
    assert.strictEqual(claude.sample.unguidedLeakRate, 2);
    assert.strictEqual(claude.sample.pageLoadFailed, 3);
});
test('hasHeadlineStats handles stale showcase keys and partial-job guide subsets without re-hydration loops', () => {
    const base = {
        testId: 'nightly-2026-10-20_07-00-02-antigravity_cli',
        a11yStats: { guidedPassed: 1, guidedTotal: 1, guidedRate: 100, unguidedPassed: 0, unguidedTotal: 1, unguidedRate: 0, uplift: 100, guideCount: 1, bySubCategory: {} },
    };
    // Stale pre-recalibration spotlight keys must re-hydrate:
    assert.strictEqual(hasHeadlineStats({ ...base, showcase: { scrollspy: {} } } as never), false);
    // Partial job where only 2 of the 6 showcase guides ran, and both are present in showcase:
    assert.strictEqual(hasHeadlineStats({
        ...base,
        guides: { menu: {}, 'progress-ring': {}, accordion: {} },
        showcase: { menu: {}, 'progress-ring': {} },
    } as never), true);
    // Job that ran passkey-authentication in guides, but showcase is missing it:
    assert.strictEqual(hasHeadlineStats({
        ...base,
        guides: { menu: {}, 'passkey-authentication': {} },
        showcase: { menu: {} },
    } as never), false);
    // Incomplete job that ran only one side of a featured guide (buildShowcaseSlices omits showcase[id]):
    const oneSided = extractJobSummary('nightly-2026-10-21_07-00-02-antigravity_cli', {
        agent: 'antigravity_cli',
        model: 'gemini-x',
        timestamp: '2026-10-21T07:00:02Z',
        results: {
            'task - menu - guided': [{ results: [{ passed: true, message: 'Opens menu', testId: '1' }] }],
        },
    } as never);
    assert.ok(oneSided);
    assert.ok(oneSided.guides.menu);
    assert.strictEqual(oneSided.showcase.menu, undefined);
    assert.strictEqual(hasHeadlineStats(oneSided as never), true);
});
