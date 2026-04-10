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

        const cmd = `claude --plugin-dir ${distDir} -p "use the modern-web-use-cases skill and tell me best practices on implementing an address form" --dangerously-skip-permissions --verbose`;
        
        console.log(`\nRunning Claude Code with local plugin...`);
        execSync(cmd, { 
            stdio: ['ignore', 'inherit', 'inherit'], 
            timeout: 90000, 
            env: { ...process.env, ...anthropicEnv } 
        });

        console.log(`\nVerifying Claude used the skill...`);
        const projectsDir = path.join(os.homedir(), '.claude', 'projects');
        const files = fs.globSync('**/*.jsonl', { cwd: projectsDir });
        console.log(`Found session files: ${JSON.stringify(files)}`);
        
        let toolsUsed: string[] = [];
        for (const file of files) {
            const fullPath = path.join(projectsDir, file);
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const obj = JSON.parse(line);
                    if (obj.message && Array.isArray(obj.message.content)) {
                        for (const item of obj.message.content) {
                            if (item.type === 'tool_use') {
                                if (item.name === 'Skill' && item.input?.skill) {
                                    toolsUsed.push(item.input.skill);
                                } else if (item.name === 'activate_skill' && item.input?.name) {
                                    toolsUsed.push(item.input.name);
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
        
        console.log(`Tools used: ${JSON.stringify(toolsUsed)}`);
        assert.ok(toolsUsed.includes('modern-web-use-cases'), 'Claude did not use the modern-web-use-cases skill');
        
    } finally {
        if (homeDir) {
            console.log(`Skipping cleanup of isolated HOME at ${homeDir}`);
            // cleanupIsolatedHome(homeDir);
        }
    }
});
