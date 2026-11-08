import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createIsolatedHome, cleanupIsolatedHome } from '../harness/lib/agent-shared.ts';
import { rootDir } from '../core/paths.ts';

test('npx skills add from local path', { skip: !process.env.FULL }, async () => {
    let homeDir = '';
    try {
        homeDir = createIsolatedHome('test-install-skills');
        const distDir = path.join(rootDir, 'dist/skills-cli');
        
        if (!fs.existsSync(distDir)) {
            assert.fail(`distDir not found at ${distDir}`);
        }

        const cmd = `npx skills add -y -g ${distDir}`;

        console.log(`\nRunning skills add...`);
        execSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, HOME: homeDir, DISABLE_TELEMETRY: '1' }
        });

        const installedSkillDir = path.join(homeDir, '.agents', 'skills', 'modern-web-guidance');
        const skillMdPath = path.join(installedSkillDir, 'SKILL.md');
        const mjsPath = path.join(installedSkillDir, 'modern-web.mjs');
        assert.ok(fs.existsSync(skillMdPath), `Expected SKILL.md at ${skillMdPath}`);
        assert.ok(fs.existsSync(mjsPath), `Expected modern-web.mjs at ${mjsPath}`);

        const searchOut = execSync(`node ${JSON.stringify(mjsPath)} search "address form"`, {
            encoding: 'utf8',
            env: { ...process.env, HOME: homeDir, DISABLE_TELEMETRY: '1' },
        });
        const results = JSON.parse(searchOut);
        assert.ok(Array.isArray(results) && results.length > 0, 'Installed modern-web.mjs should return search results');
        
    } finally {
        if (homeDir) {
            cleanupIsolatedHome(homeDir);
        }
    }
});
