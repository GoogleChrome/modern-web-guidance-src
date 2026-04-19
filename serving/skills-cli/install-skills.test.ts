import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';
import { parseGeminiStreamOutput } from '../../harness/agents/gemini-cli-agent.ts';

test('npx skills add from local path', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-skills');
        const distDir = path.resolve(import.meta.dirname, '../../dist/skills-cli');
        
        if (!fs.existsSync(distDir)) {
            test.skip('dist/skills-cli not found, skipping');
            return;
        }

        const cmd = `npx skills add -y -g ${distDir}`;
        
        const geminiBin = path.resolve(import.meta.dirname, '../../harness/node_modules/.bin/gemini');
        if (fs.existsSync(geminiBin)) {
            console.log(`\nEnsuring no extension conflict (uninstalling if present)...`);
            try {
                execSync(`${geminiBin} extensions uninstall googlechrome-skills`, {
                    stdio: 'ignore', 
                    env: { ...process.env, HOME: homeDir }
                });
            } catch {
                // Ignore if not installed
            }
        }

        console.log(`\nRunning skills add...`);
        execSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, HOME: homeDir, DISABLE_TELEMETRY: '1' }
        });

        if (fs.existsSync(geminiBin)) {
            console.log(`\nVerifying Gemini can use the added skill...`);
            const promptCmd = `${geminiBin} -p "use the modern-web-use-cases skill and tell me best practices on implementing an address form" -o stream-json --yolo`;
            const output = execSync(promptCmd, { 
                stdio: ['ignore', 'pipe', 'pipe'], 
                timeout: 90000,
                env: { ...process.env, HOME: homeDir }
            });

            console.log(`\nVerifying Gemini used the skill...`);
            const outputStr = output.toString();
            const { skillActivated, searchCalled, retrieveCalled } = parseGeminiStreamOutput(outputStr);
            
            console.log(`\n[Validation State]`);
            console.log(`- Skill Activated: ${skillActivated}`);
            console.log(`- Search Called: ${searchCalled}`);
            console.log(`- Retrieve Called: ${retrieveCalled}\n`);
            
            assert.ok(skillActivated, 'Skill should specify check for modern-web-use-cases activation');
            assert.ok(searchCalled, 'Modern web search should be called');
            assert.ok(retrieveCalled, 'Modern web retrieve should be called');
        }
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
