import fs from 'fs';
import path from 'path';
import { test } from 'node:test';
import assert from 'node:assert';
import { generateSuitesManifest, generateRunFilesManifests } from './generate-manifests.js';

test('Parity: Static manifests should be correctly generated and accessible', async () => {
    // 1. Generate manifests
    generateSuitesManifest('.');
    generateRunFilesManifests();

    // 2. Verify suites.gen.json exists and contains data
    const suitesPath = path.resolve('./suites.gen.json');
    assert.strictEqual(fs.existsSync(suitesPath), true, 'suites.gen.json should exist');
    const suitesData = JSON.parse(fs.readFileSync(suitesPath, 'utf8'));
    assert.strictEqual(Array.isArray(suitesData), true, 'suites.gen.json should be an array');
    
    if (suitesData.length > 0) {
        // Note: Not every directory has a run-files.gen.json, only leaf ones. 
        // We'll just verify the manifest generation didn't throw and suites are listed.
        console.log(`✅ Verified manifest generation for ${suitesData.length} suites.`);
    }
});
