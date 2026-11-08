import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createIsolatedHome, copySkills, cleanupIsolatedHome } from './agent-shared.ts';
import { Agents } from '../config.ts';
import type { CompactSearchResult } from '../../rag/search.ts';

function assertSearchResults(output: string) {
    const results = JSON.parse(output) as CompactSearchResult[];
    assert.ok(Array.isArray(results), 'Output should be a JSON array');
    assert.strictEqual(results.length, 10, 'Default CLI search should return top-10 results');
    
    const hasAddressForm = results.some(r => r.id === 'autofill-address-form');
    assert.ok(hasAddressForm, 'Results should contain autofill-address-form');
    
    const topResult = results[0];
    assert.ok(topResult.id, 'Top result should have an id');
    assert.ok(topResult.description, 'Top result should have a description');
    assert.deepStrictEqual(Object.keys(topResult).sort(), ['description', 'id']);
}

test('copySkills sets up the isolated environment with the skill and its data', async () => {
    let homeDir = '';
    try {
        // 1. Create isolated home
        homeDir = createIsolatedHome('test-copy-skills');
        
        // 2. Run copySkills. This might trigger a build if dist is missing
        const success = copySkills(homeDir, Agents.JETSKI_CLI, ['modern-web-guidance']);
        assert.ok(success, 'copySkills should succeed');

        const skillDir = path.join(homeDir, '.gemini', 'jetski', 'skills', 'modern-web-guidance');
        assert.ok(fs.existsSync(skillDir), 'Skill directory should exist');
        
        const mjsPath = path.join(skillDir, 'modern-web.mjs');
        assert.ok(fs.existsSync(mjsPath), 'modern-web.mjs should exist');

        // 3. Verify guides and vector_store were copied (they should be inside the skill dir now)
        const guidesDir = path.join(skillDir, 'guides');
        const vectorFile = path.join(skillDir, 'use-cases.vectors.gen.json.gz');
        const vectorI8File = path.join(skillDir, 'use-cases.vectors.gen.i8');
        const vectorScaleFile = path.join(skillDir, 'use-cases.vectors.gen.scale.f32');
        
        assert.ok(fs.existsSync(guidesDir), 'guides/ should be inside the skill directory');
        assert.ok(fs.existsSync(vectorFile), 'use-cases.vectors.gen.json.gz should be inside the skill directory');
        assert.ok(fs.existsSync(vectorI8File), 'use-cases.vectors.gen.i8 should be inside the skill directory');
        assert.ok(fs.existsSync(vectorScaleFile), 'use-cases.vectors.gen.scale.f32 should be inside the skill directory');

        // 4. Run the CLI to search
        // We need to extend PATH to make sure node is available if needed, but it should be
        const cmd = `node ${mjsPath} search "address form"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        assertSearchResults(output);
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
