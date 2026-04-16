import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

test('Claude Code loads plugin from local dist directory', { skip: !process.env.FULL }, async () => {
    const distDir = path.resolve(import.meta.dirname, '../../dist/skills-cli');
        
        if (!fs.existsSync(distDir)) {
            test.skip('dist/skills-cli not found, skipping');
            return;
        }

        const anthropicEnv: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('ANTHROPIC_') && value) {
                anthropicEnv[key] = value;
            }
        }

        console.log(`\nRunning Claude Code with local plugin...`);
        // Claude won't run in an isolated home, so we use the real HOME.
        const child = spawn('claude', [
            '--model', 'claude-sonnet-4-6',
            '--plugin-dir', distDir,
            '-p', 'use the modern-web-use-cases skill and tell me best practices on implementing an address form',
            '--dangerously-skip-permissions',
            '--verbose',
            '--output-format', 'stream-json'
        ], {
            env: { ...process.env, ...anthropicEnv },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let outputStr = '';
        child.stdout.on('data', (data) => {
            const str = data.toString();
            outputStr += str;
            process.stdout.write(str);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        const timeout = setTimeout(() => {
            console.log('\nClaude timed out! Killing process...');
            child.kill();
        }, 90000);

        const exitCode = await new Promise<number | null>((resolve) => {
            child.on('close', (code) => {
                clearTimeout(timeout);
                resolve(code);
            });
        });

        console.log(`\nClaude exited with code ${exitCode}`);
        
        console.log(`\nVerifying Claude used the skill...`);
        const lines = outputStr.split('\n');
        
        let searchCalled = false;
        let retrieveCalled = false;
        let searchToolId = '';
        let retrieveToolId = '';
        let searchSuccess = false;
        let retrieveSuccess = false;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                
                // Check for tool use
                if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
                    for (const item of obj.message.content) {
                        if (item.type === 'tool_use' && item.name === 'Bash') {
                            const command = item.input?.command;
                            if (typeof command === 'string') {
                                if (command.includes('--search')) {
                                    searchCalled = true;
                                    searchToolId = item.id;
                                }
                                if (command.includes('--retrieve')) {
                                    retrieveCalled = true;
                                    retrieveToolId = item.id;
                                }
                            }
                        }
                    }
                }
                
                // Check for tool result
                if (obj.type === 'user' && obj.message && Array.isArray(obj.message.content)) {
                    for (const item of obj.message.content) {
                        if (item.type === 'tool_result') {
                            if (searchToolId && item.tool_use_id === searchToolId) {
                                if (item.content && !item.is_error) {
                                    searchSuccess = true;
                                }
                            }
                            if (retrieveToolId && item.tool_use_id === retrieveToolId) {
                                if (item.content && !item.is_error) {
                                    retrieveSuccess = true;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        
        const skillActivated = searchCalled || retrieveCalled;
        
        console.log(`\n[Validation State]`);
        console.log(`- Skill Activated: ${skillActivated}`);
        console.log(`- Search Called: ${searchCalled}`);
        console.log(`- Retrieve Called: ${retrieveCalled}\n`);
        
        // Assert all, but we get the log above first!
        assert.ok(skillActivated, 'Skill should specify check for modern-web-use-cases activation');
        assert.ok(searchCalled, 'Modern web search should be called');
        assert.ok(searchSuccess, 'Modern web search should be successful');
        assert.ok(retrieveCalled, 'Modern web retrieve should be called');
        assert.ok(retrieveSuccess, 'Modern web retrieve should be successful');
        

});
