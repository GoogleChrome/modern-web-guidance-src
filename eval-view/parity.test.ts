import fs from 'fs';
import path from 'path';
import { test } from 'node:test';
import assert from 'node:assert';
import { generateSuitesManifest } from './generate-manifests.js';
import { resultsDir } from '../lib/paths.ts';

test('Parity: Static manifests should be correctly generated and accessible', async () => {
    // 1. Generate manifests
    generateSuitesManifest('.');

    // 2. Verify suites.gen.json exists and contains data
    const suitesPath = path.resolve('./suites.gen.json');
    assert.strictEqual(fs.existsSync(suitesPath), true, 'suites.gen.json should exist');
    const suitesData = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
    assert.strictEqual(Array.isArray(suitesData), true, 'suites.gen.json should be an array');
    
    // 3. Compare with local results
    const localDirs = fs.readdirSync(resultsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && fs.existsSync(path.join(resultsDir, d.name, 'evals.json')))
        .map(d => d.name);
        
    assert.deepStrictEqual(suitesData.sort(), localDirs.sort(), 'Static suites manifest should match local completed suites');
});

test('Parity: evals.json should be valid in all completed suites', async () => {
    const suitesPath = path.resolve('./suites.gen.json');
    if (!fs.existsSync(suitesPath)) return;
    
    const suitesData = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
    
    for (const suiteId of suitesData) {
        const evalsPath = path.join(resultsDir, suiteId, 'evals.json');
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
