import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';

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
        execSync(promptCmd, { 
            stdio: 'inherit', 
            timeout: 90000,
            env: { ...process.env, HOME: homeDir }
        });
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
