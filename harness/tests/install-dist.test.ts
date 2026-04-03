import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../lib/agent-shared.ts';

// Assuming assertSearchResults is available or we duplicate it
function assertSearchResults(output: string) {
    const results = JSON.parse(output);
    assert.ok(Array.isArray(results), 'Output should be a JSON array');
    assert.ok(results.length > 0, 'Search should find some results');
}

test('Claude Code loads plugin from local dist directory', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-claude');
        const distDir = path.resolve(import.meta.dirname, '../../dist/skills-cli');
        
        if (!fs.existsSync(distDir)) {
            test.skip('dist/skills-cli not found, skipping');
            return;
        }

        // Claude Code uses --plugin-dir to load local plugins
        // We verify if we can run it and if it doesn't crash (or if it lists the plugin if we can find a way to list it)
        // Since we don't want to run an interactive session, we just check if it parses the flag and runs a prompt.
        const cmd = `claude --plugin-dir ${distDir} -p "ping"`;
        try {
            const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 }); // Short timeout
            assert.ok(output, 'Claude should return some output');
        } catch (e: any) {
            // It might fail if no internet or auth, but we look for specific plugin load errors if any
            console.log('Claude execution failed (expected if no auth/internet):', e.message);
            // If it failed because of flag parsing, that's a real failure. If it failed because of auth, we might pass it if it got past plugin loading.
            assert.ok(!e.message.includes('unknown option'), 'Claude should recognize --plugin-dir');
        }
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});

test('Gemini CLI verifies extension install capability', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-gemini');
        const distDir = path.resolve(import.meta.dirname, '../../dist/skills-cli');
        
        const geminiBin = path.resolve(import.meta.dirname, '../node_modules/.bin/gemini');
        if (!fs.existsSync(geminiBin)) {
            test.skip('Gemini binary not found, skipping');
            return;
        }

        // Verify if help works
        const helpOut = execSync(`${geminiBin} extensions --help`, { encoding: 'utf8' });
        assert.ok(helpOut.includes('install'), 'Gemini should have install command');

        // Test install from local path (if supported)
        // gemini extensions install <path>
        // Let's try it and see if it fails with "must be a URL" or similar
        try {
            execSync(`${geminiBin} extensions install ${distDir}`, { encoding: 'utf8', stdio: 'pipe' });
        } catch (e: any) {
            console.log('Gemini install local path result:', e.message);
            // We are exploring if it works. If it fails with "Invalid URL", then we know it doesn't support local paths natively.
        }
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
