import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createIsolatedHome, copySkills, cleanupIsolatedHome } from '../lib/agent-shared.ts';
import { Agents } from '../config.ts';
function assertSearchResults(output: string) {
    const results = JSON.parse(output);
    assert.ok(Array.isArray(results), 'Output should be a JSON array');
    assert.ok(results.length > 0, 'Search should find some results');
    
    // Find if 'autofill-address-form' is in the results
    const hasAddressForm = results.some((r: any) => r.id === 'autofill-address-form');
    assert.ok(hasAddressForm, 'Results should contain autofill-address-form');
    
    // Verify structure of the first item
    const topResult = results[0];
    assert.ok(topResult.id, 'Top result should have an id');
    assert.ok(topResult.description, 'Top result should have a description');
    assert.ok(topResult.distance, 'Top result should have a distance');
}

test('copySkills sets up the isolated environment with the skill and its data', async () => {
    let homeDir = '';
    try {
        // 1. Create isolated home
        homeDir = createIsolatedHome('test-copy-skills');
        
        // 2. Run copySkills (cli = true). This might trigger a build if dist is missing
        const success = copySkills(homeDir, Agents.JETSKI, true);
        assert.ok(success, 'copySkills should succeed');

        const skillDir = path.join(homeDir, '.gemini', 'jetski', 'skills', 'modern-web-use-cases');
        assert.ok(fs.existsSync(skillDir), 'Skill directory should exist');
        
        const mjsPath = path.join(skillDir, 'modern-web.mjs');
        assert.ok(fs.existsSync(mjsPath), 'modern-web.mjs should exist');

        // 3. Verify guides and vector_store were copied (they should be inside the skill dir now)
        const guidesDir = path.join(skillDir, 'guides');
        const vectorFile = path.join(skillDir, 'use-cases.vectors.gen.json.gz');
        
        assert.ok(fs.existsSync(guidesDir), 'guides/ should be inside the skill directory');
        assert.ok(fs.existsSync(vectorFile), 'use-cases.vectors.gen.json.gz should be inside the skill directory');

        // 3.5 Run pnpm install in the skill directory to resolve dependencies (like @lancedb/lancedb)
        // This simulates what a real installer or environment would do.
        console.log(`Running pnpm install in ${skillDir}...`);
        execSync('pnpm install --no-lockfile', { 
            cwd: skillDir,
            stdio: 'inherit'
        });

        // 4. Run the CLI to search
        // We need to extend PATH to make sure node is available if needed, but it should be
        const cmd = `node ${mjsPath} --search "address form"`;
        const output = execSync(cmd, { encoding: 'utf8' });
        assertSearchResults(output);
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});

test('invoking gemini-cli-agent.ts works end-to-end like in eval suite', { skip: !process.env.FULL }, async () => {
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
            mcpServersToEnable: [],
            negative: false
        };

        const env = {
            ...process.env,
            GD_SUITE_CONFIG: JSON.stringify(suiteConfig),
        };

        const agentScript = path.resolve(import.meta.dirname, '../agents/gemini-cli-agent.ts');
        const cmd = `node ${agentScript} "use modern-web to search for address form" guided "${targetDir}" "${templateDir}"`;

        execSync(cmd, { env, stdio: 'inherit' });
        
        const logPath = path.join(targetDir, 'chat_log.txt');
        assert.ok(fs.existsSync(logPath), 'chat_log.txt should exist');
        
        const logContent = fs.readFileSync(logPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim() !== '');
        
        let skillActivated = false;
        let searchCalled = false;
        let retrieveCalled = false;
        
        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                if (event.type === 'tool_use') {
                    if (event.tool_name === 'activate_skill' && event.parameters?.name === 'modern-web-use-cases') {
                        skillActivated = true;
                    }
                    if (event.tool_name === 'run_shell_command') {
                        const command = event.parameters?.command || '';
                        if (command.includes('--search')) {
                            searchCalled = true;
                        }
                        if (command.includes('--retrieve')) {
                            retrieveCalled = true;
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors for partial lines if any
            }
        }
        
        console.log(`\n[Validation State]`);
        console.log(`- Skill Activated: ${skillActivated}`);
        console.log(`- Search Called: ${searchCalled}`);
        console.log(`- Retrieve Called: ${retrieveCalled}\n`);
        
        // Assert all, but we get the log above first!
        assert.ok(skillActivated, 'Skill should specify check for modern-web-use-cases activation');
        assert.ok(searchCalled, 'Modern web search should be called');
        assert.ok(retrieveCalled, 'Modern web retrieve should be called');

    } finally {
        if (targetDir && fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
        if (templateDir && fs.existsSync(templateDir)) fs.rmSync(templateDir, { recursive: true, force: true });
    }
});
