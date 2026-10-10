import { test, beforeEach } from 'node:test';
import assert from 'node:assert';

// api.js touches window/localStorage at import and construction time; stub a static-mode page.
const g: any = globalThis;
g.window = { location: { search: '?source=static', hostname: 'localhost' } };
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
g.document = { getElementById: () => null };

const { ApiClient } = await import('./api.js');
const { extractSuiteSummary, toSlimSuiteSummary, MANIFEST_FILES } = await import('./summary-extractor.js');

const evals = {
    agent: 'codex_cli',
    model: 'gpt-x',
    timestamp: '2026-10-09T11:27:57Z',
    summary: { taskCount: 1 },
    results: {
        'task - dialog - unguided': [{ runtime: { agentRuntime: 100000 }, tokenUsage: { total: 50000, cached: 40000 }, results: [{ passed: false, message: 'Opens dialog', testId: 'd' }] }],
        'task - dialog - guided': [{ runtime: { agentRuntime: 110000 }, tokenUsage: { total: 60000, cached: 50000 }, results: [{ passed: true, message: 'Opens dialog', testId: 'd' }] }],
    },
};
const fullSummary = extractSuiteSummary('nightly-2026-10-09_11-27-57-codex_cli', evals as never);
assert.ok(fullSummary);

/** @type {Record<string, unknown>} */
let files: Record<string, unknown> = {};
/** @type {string[]} */
let requested: string[] = [];

function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
    requested = [];
    g.fetch = async (url: string) => {
        const name = url.replace(/^\//, '').split('?')[0];
        requested.push(name);
        if (name in files) return jsonResponse(200, files[name]);
        return jsonResponse(404, null);
    };
});

test('getManifest serves slim and insights artifacts directly when present', async () => {
    files = {
        [MANIFEST_FILES.slim]: [toSlimSuiteSummary(fullSummary)],
        [MANIFEST_FILES.insights]: { generatedAt: 'x', options: { perAgentRecentN: 3 }, families: [{ id: 'codex_cli' }], pooled: null, suiteIds: [], missingStats: [] },
        [MANIFEST_FILES.full]: [fullSummary],
    };
    const api = new ApiClient();
    assert.strictEqual(api.source, 'static');

    const slim = await api.getManifest('slim');
    assert.strictEqual(slim.fallback, false);
    assert.strictEqual(slim.servedFrom, 'slim');
    assert.strictEqual(slim.suites?.[0].guides, undefined);

    const insights = await api.getManifest('insights');
    assert.strictEqual(insights.fallback, false);
    assert.strictEqual(insights.insights?.families[0].id, 'codex_cli');

    // Memoized per page: a second call does not refetch.
    const before = requested.length;
    await api.getManifest('slim');
    await new ApiClient().getManifest('insights');
    assert.strictEqual(requested.length, before);
    assert.ok(!requested.includes(MANIFEST_FILES.full), 'full manifest must not be downloaded when small files exist');
});

test('getManifest falls back to the full manifest when small files 404 and shares entries', async () => {
    // Fresh module-level cache: use a different source key by changing the page source.
    g.window.location.search = '?source=remote';
    g.window.location.hostname = 'example.github.io';
    files = { [MANIFEST_FILES.full]: [fullSummary] };
    g.fetch = async (url: string) => {
        const name = decodeURIComponent(url.split('/o/')[1]?.split('?')[0] ?? '');
        requested.push(name);
        if (name in files) return jsonResponse(200, files[name]);
        return jsonResponse(404, null);
    };
    const api = new ApiClient();
    assert.strictEqual(api.source, 'remote');

    const slim = await api.getManifest('slim');
    assert.strictEqual(slim.fallback, true);
    assert.strictEqual(slim.servedFrom, 'full');
    const full = await api.getManifest('full');
    assert.strictEqual(slim.suites?.[0], full.suites?.[0], 'fallback slim must reuse the full manifest objects');

    const insights = await api.getManifest('insights');
    assert.strictEqual(insights.fallback, true);
    assert.strictEqual(insights.insights?.families[0].id, 'codex_cli');
    assert.strictEqual(insights.insights?.families[0].overall.upliftPp, 100);

    // Only one network fetch of the full manifest for all three kinds.
    assert.strictEqual(requested.filter(n => n === MANIFEST_FILES.full).length, 1);

    const headline = await api.getHeadlineInsights();
    assert.strictEqual(headline.families[0].runtime?.deltaPct, 10);
    assert.deepStrictEqual(headline.missingStats, []);
});
