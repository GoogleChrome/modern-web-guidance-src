import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
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

test.skip('invoking gemini-cli-agent.ts works end-to-end like in eval suite', async (t) => {
    let targetDir = '';
    let templateDir = '';
    let osTmpDir = '/tmp'; // Use /tmp deliberately as per agent-shared.ts
    
    try {
        const rand = Math.random().toString(36).substring(7);
        targetDir = path.join(osTmpDir, `test-gemini-target-${rand}`);
        templateDir = path.join(osTmpDir, `test-gemini-template-${rand}`);
        
        fs.mkdirSync(targetDir, { recursive: true });
        fs.mkdirSync(templateDir, { recursive: true });

        // Set up the suite config
        const suiteConfig = {
            serving: 'skills_cli',
            agent: 'gemini_cli',
            name: 'test-run',
            numRuns: 1,
            tasks: [],
            mcpServersToEnable: ['modern-web'],
            negative: false
        };

        const env = {
            ...process.env,
            GD_SUITE_CONFIG: JSON.stringify(suiteConfig),
            PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin`
        };

        const agentScript = path.resolve(import.meta.dirname, '../agents/gemini-cli-agent.ts');
        const cmd = `node ${agentScript} "use modern-web to search for address form" guided "${targetDir}" "${templateDir}"`;

        execSync(cmd, { env, stdio: 'inherit' });
        
        // Output is inherited, so we can't assert on it, but we can verify it finishes.
        assert.ok(true, 'Execution finished');

    } finally {
        if (targetDir && fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
        if (templateDir && fs.existsSync(templateDir)) fs.rmSync(templateDir, { recursive: true, force: true });
    }
});
