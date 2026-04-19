import fs from 'fs';
import path from 'path';
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { generateSuitesManifest } from './generate-manifests.js';
import { resultsDir } from '../lib/paths.ts';

const mockResultsDir = path.resolve('./test-mock-results');
let targetResultsDir = resultsDir;

before(async () => {
    // Setup mock results dir if real results missing (e.g. in CI)
    if (!fs.existsSync(resultsDir)) {
        console.log('⚠️ harness/results missing. Creating mock results for test...');
        targetResultsDir = mockResultsDir;
        fs.mkdirSync(path.join(mockResultsDir, 'mock-suite'), { recursive: true });
        fs.writeFileSync(path.join(mockResultsDir, 'mock-suite', 'evals.json'), JSON.stringify({ summary: {}, results: {} }));
    }

    // Generate manifests
    generateSuitesManifest('.', targetResultsDir);
});

after(async () => {
    // Cleanup mock dir
    if (targetResultsDir === mockResultsDir) {
        fs.rmSync(mockResultsDir, { recursive: true, force: true });
    }
    // Also cleanup generated manifest file
    const suitesPath = path.resolve('./suites.gen.json');
    if (fs.existsSync(suitesPath)) {
        fs.unlinkSync(suitesPath);
    }
});

test('Parity: Static manifests should be correctly generated and accessible', async () => {
    // Verify suites.gen.json exists and contains data
    const suitesPath = path.resolve('./suites.gen.json');
    assert.strictEqual(fs.existsSync(suitesPath), true, 'suites.gen.json should exist');
    const suitesData = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
    assert.strictEqual(Array.isArray(suitesData), true, 'suites.gen.json should be an array');
    
    // Compare with local results
    const localDirs = fs.readdirSync(targetResultsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(targetResultsDir, d.name, 'evals.json')))
        .map(d => d.name);
        
    assert.deepStrictEqual(suitesData.sort(), localDirs.sort(), 'Static suites manifest should match local completed suites');
});

test('Parity: evals.json should be valid in all completed suites', async () => {
    const suitesPath = path.resolve('./suites.gen.json');
    if (!fs.existsSync(suitesPath)) return;
    
    const suitesData = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
    
    for (const suiteId of suitesData) {
        const evalsPath = path.join(targetResultsDir, suiteId, 'evals.json');
        assert.strictEqual(fs.existsSync(evalsPath), true, `evals.json should exist for suite ${suiteId}`);
        
        try {
            const evalsData = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
            assert.ok(evalsData.summary, `evals.json for ${suiteId} should have summary`);
            assert.ok(evalsData.results, `evals.json for ${suiteId} should have results`);
        } catch (e) {
            assert.fail(`Failed to parse evals.json for suite ${suiteId}: ${e.message}`);
        }
    }
});
