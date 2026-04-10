import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';

test('Claude Code loads plugin from local dist directory', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-claude');
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

        const cmd = `claude --plugin-dir ${distDir} -p "use the modern-web-use-cases skill and tell me best practices on implementing an address form" --dangerously-skip-permissions --verbose --output-format stream-json`;
        
        console.log(`\nRunning Claude Code with local plugin...`);
        const output = execSync(cmd, { 
            stdio: ['ignore', 'pipe', 'pipe'], 
            timeout: 90000, 
            env: { ...process.env, ...anthropicEnv } 
        });

        console.log(`\nVerifying Claude used the skill...`);
        const outputStr = output.toString();
        const lines = outputStr.split('\n');
        let skillUsed = false;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
                    for (const item of obj.message.content) {
                        if (item.type === 'tool_use' && item.name === 'Bash') {
                            const command = item.input?.command;
                            if (typeof command === 'string' && command.includes('modern-web.mjs')) {
                                skillUsed = true;
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
            if (skillUsed) break;
        }
        
        console.log(`Skill used: ${skillUsed}`);
        assert.ok(skillUsed, 'Claude did not use the modern-web-use-cases skill');
        
    } finally {
        if (homeDir) {
            console.log(`Skipping cleanup of isolated HOME at ${homeDir}`);
            // cleanupIsolatedHome(homeDir);
        }
    }
});
