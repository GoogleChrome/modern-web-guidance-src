import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../../harness/lib/agent-shared.ts';
import { parseGeminiStreamOutput } from '../../harness/agents/gemini-cli-agent.ts';
import { rootDir } from '../../lib/paths.ts';

test('npx skills add from local path', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-skills');
        const distDir = path.join(rootDir, 'dist/skills-cli');
        
        if (!fs.existsSync(distDir)) {
            assert.fail(`distDir not found at ${distDir}`);
        }

        const cmd = `npx skills add -y -g ${distDir}`;
        
        const geminiBin = path.join(rootDir, 'harness/node_modules/.bin/gemini');
        if (!fs.existsSync(geminiBin)) {
            assert.fail(`Gemini binary not found at ${geminiBin}`);
        }

        console.log(`\nEnsuring no extension conflict (uninstalling if present)...`);
        try {
            execSync(`${geminiBin} extensions uninstall googlechrome-skills`, {
                stdio: 'ignore', 
                env: { ...process.env, HOME: homeDir }
            });
        } catch {
            // Ignore if not installed
        }

        console.log(`\nRunning skills add...`);
        execSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, HOME: homeDir, DISABLE_TELEMETRY: '1' }
        });

        const hasGeminiAuth = process.env.GEMINI_API_KEY;
        if (!hasGeminiAuth) {
            console.log(`Skipping Gemini prompt verification because no Gemini API auth environment variables are set.`);
            return;
        }

        console.log(`\nVerifying Gemini can use the added skill...`);
        const promptCmd = `${geminiBin} -p "use the modern-web-guidance skill and tell me best practices on implementing an address form" -o stream-json --yolo --skip-trust`;
        const env: Record<string, string | undefined> = { ...process.env, HOME: homeDir };
        // Prevent gemini-cli strict env sanitization in GitHub Actions from stripping NODE_TEST_CONTEXT
        delete env.GITHUB_SHA;
        if (!env.GEMINI_MODEL) {
            env.GEMINI_MODEL = 'gemini-3-flash-preview';
        }
        const output = execSync(promptCmd, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 90000,
            env
        });

        console.log(`\nVerifying Gemini used the skill...`);
        const outputStr = output.toString();
        const { skillActivated, searchCalled, retrieveCalled } = parseGeminiStreamOutput(outputStr);

        console.log(`\n[Validation State]`);
        console.log(`- Skill Activated: ${skillActivated}`);
        console.log(`- Search Called: ${searchCalled}`);
        console.log(`- Retrieve Called: ${retrieveCalled}\n`);

        assert.ok(skillActivated, 'Skill should specify check for modern-web-guidance activation');
        assert.ok(searchCalled, 'Modern web search should be called');
        assert.ok(retrieveCalled, 'Modern web retrieve should be called');
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
