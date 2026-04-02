import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createIsolatedHome, copySkills, cleanupIsolatedHome } from '../lib/agent-shared.ts';
import { Agents } from '../config.ts';

test('copySkills sets up the isolated environment with the skill and its data', async (t) => {
    let homeDir = '';
    try {
        // 1. Create isolated home
        homeDir = createIsolatedHome('test-copy-skills');
        
        // 2. Run copySkills (cli = true)
        // This might trigger a build if dist is missing
        const success = copySkills(homeDir, Agents.JETSKI, true);
        assert.ok(success, 'copySkills should succeed');

        const skillDir = path.join(homeDir, '.gemini', 'jetski', 'skills', 'modern-web-use-cases');
        assert.ok(fs.existsSync(skillDir), 'Skill directory should exist');
        
        const mjsPath = path.join(skillDir, 'modern-web.mjs');
        assert.ok(fs.existsSync(mjsPath), 'modern-web.mjs should exist');

        // 3. Verify guides and vector_store were copied (they should be inside the skill dir now)
        const guidesDir = path.join(skillDir, 'guides');
        const vectorStoreDir = path.join(skillDir, 'vector_store');
        
        assert.ok(fs.existsSync(guidesDir), 'guides/ should be inside the skill directory');
        assert.ok(fs.existsSync(vectorStoreDir), 'vector_store/ should be inside the skill directory');

        // 3.5 Run pnpm install in the skill directory to resolve dependencies (like @lancedb/lancedb)
        // This simulates what a real installer or environment would do.
        console.log(`Running pnpm install in ${skillDir}...`);
        execSync('PATH=$PATH:/opt/homebrew/bin:/usr/local/bin pnpm install --no-lockfile', { 
            cwd: skillDir,
            stdio: 'inherit'
        });

        // 4. Run the CLI to search
        // We need to extend PATH to make sure node is available if needed, but it should be
        const cmd = `node ${mjsPath} --search "address form"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        
        assert.ok(output.includes('Searching') || output.includes('Found') || output.includes('results') || output.includes('address'), 'Output should contain search info or results');
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
