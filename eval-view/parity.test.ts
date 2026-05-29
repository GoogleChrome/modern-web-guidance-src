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

    // Generate manifests for standard tests (skip fetch to isolate)
    await generateSuitesManifest('.', targetResultsDir, true);
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

test('generateSuitesManifest merges live suites with local suites via mock fetch', async () => {
  const testMockDir = path.resolve('./test-mock-merge-results');
  fs.mkdirSync(path.join(testMockDir, 'local-suite'), { recursive: true });
  fs.writeFileSync(path.join(testMockDir, 'local-suite', 'evals.json'), JSON.stringify({ summary: {}, results: {} }));

  // Mock fetch to return live suites
  const originalFetch = global.fetch;
  // @ts-expect-error simple mock
  global.fetch = async (url) => {
    if (url === 'https://googlechrome.github.io/guidance-dash/suites.gen.json') {
      return {
        ok: true,
        json: async () => ['live-suite']
      };
    }
    return originalFetch(url);
  };

  try {
    const result = await generateSuitesManifest('.', testMockDir);
    assert.deepStrictEqual(result, ['live-suite', 'local-suite'], 'Manifest should contain both live and local suites');
  } finally {
    // Restore fetch
    global.fetch = originalFetch;
    // Cleanup
    fs.rmSync(testMockDir, { recursive: true, force: true });
    const suitesPath = path.resolve('./suites.gen.json');
    if (fs.existsSync(suitesPath)) {
        fs.unlinkSync(suitesPath);
    }
  }
});

test('Parity: evals.json should be valid in all completed suites', async () => {
    const suitesPath = path.resolve('./suites.gen.json');
    // Re-generate without skipFetch to ensure we have a valid file for this test if previous one was cleaned up
    await generateSuitesManifest('.', targetResultsDir, true);
    
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
            const message = e instanceof Error ? e.message : String(e);
            assert.fail(`Failed to parse evals.json for suite ${suiteId}: ${message}`);
        }
    }
});
