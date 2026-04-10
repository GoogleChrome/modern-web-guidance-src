import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';
import { collectGeminiToolsFromTrajectory } from '../../harness/agents/gemini-cli-agent.ts';

test('Gemini CLI verifies extension install capability', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-gemini');
        const distDir = path.resolve(import.meta.dirname, '../../dist/skills-cli');
        
        const geminiBin = path.resolve(import.meta.dirname, '../../harness/node_modules/.bin/gemini');
        if (!fs.existsSync(geminiBin)) {
            test.skip('Gemini binary not found, skipping');
            return;
        }

        const helpOut = execSync(`${geminiBin} extensions --help`, { encoding: 'utf8' });
        assert.ok(helpOut.includes('install'), 'Gemini should have install command');

        console.log(`\nInstalling Gemini extension locally...`);
        // Use input: 'y\n' to answer the workspace trust prompt cleanly, and stdio: 'inherit' to see it
        execSync(`${geminiBin} extensions install ${distDir} --consent`, { 
            stdio: 'inherit',
            input: 'y\n',
            env: { ...process.env, HOME: homeDir }
        });

        console.log(`\nRunning Gemini prompt using the skill...`);
        const promptCmd = `${geminiBin} -p "use the modern-web-use-cases skill and tell me best practices on implementing an address form" -o stream-json --yolo`;
        const output = execSync(promptCmd, { 
            stdio: ['ignore', 'pipe', 'pipe'], 
            timeout: 90000,
            env: { ...process.env, HOME: homeDir }
        });

        console.log(`\nVerifying Gemini used the skill...`);
        const outputStr = output.toString();
        const lines = outputStr.split('\n');
        
        let skillActivated = false;
        let searchCalled = false;
        let retrieveCalled = false;
        
        for (const line of lines) {
            if (!line.trim()) continue;
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
                // Ignore parse errors
            }
        }
        
        console.log(`\n[Validation State]`);
        console.log(`- Skill Activated: ${skillActivated}`);
        console.log(`- Search Called: ${searchCalled}`);
        console.log(`- Retrieve Called: ${retrieveCalled}\n`);
        
        assert.ok(skillActivated, 'Skill should specify check for modern-web-use-cases activation');
        assert.ok(searchCalled, 'Modern web search should be called');
        assert.ok(retrieveCalled, 'Modern web retrieve should be called');
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
