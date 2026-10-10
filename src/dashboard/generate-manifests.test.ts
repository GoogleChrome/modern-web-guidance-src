import fs from 'fs';
import os from 'os';
import path from 'path';
import { test } from 'node:test';
import assert from 'node:assert';
import { generateSuitesManifest, generateHeadlineInsightsManifest } from './generate-manifests.js';
import { MANIFEST_FILES, toSlimSuiteSummary } from './summary-extractor.js';

/** Minimal evals.json that yields one nightly antigravity suite with a11y + efficiency data. */
const evals = {
    agent: 'antigravity_cli',
    model: 'gemini-x',
    timestamp: '2026-10-09T07:00:02Z',
    summary: { taskCount: 1 },
    results: {
        'task - accordion - unguided': [{
            runtime: { agentRuntime: 400000, graderRuntime: 9000 },
            tokenUsage: { total: 300000, cached: 60000 },
            results: [{ passed: false, message: 'Trigger button sets aria-expanded="true"', testId: 'a' }, { passed: true, message: 'Renders', testId: 'b' }],
        }],
        'task - accordion - guided': [{
            runtime: { agentRuntime: 300000, graderRuntime: 9000 },
            tokenUsage: { total: 250000, cached: 50000 },
            results: [{ passed: true, message: 'Trigger button sets aria-expanded="true"', testId: 'a' }, { passed: true, message: 'Renders', testId: 'b' }],
        }],
    },
};

function makeTmpResults() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-manifests-'));
    const resultsDir = path.join(root, 'suites');
    const suiteDir = path.join(resultsDir, 'nightly-2026-10-09_07-00-02-antigravity_cli');
    fs.mkdirSync(suiteDir, { recursive: true });
    fs.writeFileSync(path.join(suiteDir, 'evals.json'), JSON.stringify(evals));
    const outDir = path.join(root, 'out');
    return { root, resultsDir, outDir };
}

test('generateSuitesManifest writes full and slim manifests that agree', async () => {
    const { root, resultsDir, outDir } = makeTmpResults();
    try {
        const suites = await generateSuitesManifest(outDir, resultsDir);
        assert.strictEqual(suites.length, 1);

        const full = JSON.parse(fs.readFileSync(path.join(outDir, MANIFEST_FILES.full), 'utf8'));
        const slim = JSON.parse(fs.readFileSync(path.join(outDir, MANIFEST_FILES.slim), 'utf8'));
        assert.strictEqual(full.length, 1);
        assert.strictEqual(slim.length, 1);
        assert.strictEqual(full[0].schemaVersion, 2);
        assert.ok(full[0].guides && full[0].chartData);
        assert.strictEqual(slim[0].guides, undefined);
        assert.strictEqual(slim[0].chartData, undefined);
        assert.deepStrictEqual(slim[0], toSlimSuiteSummary(full[0]));
        assert.deepStrictEqual(slim[0].a11yStats, full[0].a11yStats);
        assert.deepStrictEqual(slim[0].efficiencyStats, full[0].efficiencyStats);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('generateHeadlineInsightsManifest snapshots computeHeadlineInsights output', async () => {
    const { root, resultsDir, outDir } = makeTmpResults();
    try {
        const suites = await generateSuitesManifest(outDir, resultsDir);
        const fromArray = await generateHeadlineInsightsManifest(outDir, suites);
        const snapshot = JSON.parse(fs.readFileSync(path.join(outDir, MANIFEST_FILES.insights), 'utf8'));
        assert.ok(snapshot.generatedAt);
        assert.deepStrictEqual(snapshot.families, JSON.parse(JSON.stringify(fromArray.families)));
        assert.strictEqual(snapshot.families[0].id, 'antigravity_cli');
        assert.strictEqual(snapshot.families[0].overall.upliftPp, 50);
        assert.strictEqual(snapshot.families[0].runtime.deltaPct, -25);
        assert.deepStrictEqual(snapshot.options, { perAgentRecentN: 3, nightlyOnly: true, before: null });

        // Without an explicit array it reads the full manifest from outputDir.
        const fromDisk = await generateHeadlineInsightsManifest(outDir);
        assert.deepStrictEqual(fromDisk.suiteIds, fromArray.suiteIds);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
