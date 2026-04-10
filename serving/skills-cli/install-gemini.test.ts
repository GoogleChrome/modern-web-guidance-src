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

        console.log(`\nVerifying Gemini used the skill...`);
        const tmpDir = path.join(homeDir, '.gemini', 'tmp');
        const files = fs.globSync('**/chats/*.json', { cwd: tmpDir });
        let skillUsed = false;
        
        for (const file of files) {
            const content = fs.readFileSync(path.join(tmpDir, file), 'utf8');
            try {
                const session = JSON.parse(content);
                if (Array.isArray(session.messages)) {
                    for (const msg of session.messages) {
                        if (msg.type === 'gemini' && Array.isArray(msg.toolCalls)) {
                            for (const tc of msg.toolCalls) {
                                if (tc.name.includes('get_best_practices') || 
                                    (tc.name === 'activate_skill' && tc.args && tc.args.name === 'modern-web-use-cases')) {
                                    skillUsed = true;
                                    break;
                                }
                            }
                        }
                        if (skillUsed) break;
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
            if (skillUsed) break;
        }
        
        assert.ok(skillUsed, 'Gemini did not use the modern-web-use-cases skill');
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
