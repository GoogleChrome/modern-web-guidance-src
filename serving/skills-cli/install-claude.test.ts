import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
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

        const cmd = `claude --plugin-dir ${distDir} -p "use the modern-web-use-cases skill and tell me best practices on implementing an address form" --dangerously-skip-permissions`;
        
        console.log(`\nRunning Claude Code with local plugin...`);
        execSync(cmd, { 
            stdio: 'inherit', 
            timeout: 90000, 
            env: { ...process.env, HOME: homeDir, ...anthropicEnv } 
        });
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
