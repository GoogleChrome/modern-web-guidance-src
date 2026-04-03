import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';

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
        
        console.log(`\nRunning skills add...`);
        execSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, HOME: homeDir, DISABLE_TELEMETRY: '1' }
        });
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
