import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { } from './build-dist.ts';
import { replaceMacros } from '../lib/macros.ts';


import { rootDir } from '../../lib/paths.ts';

describe('processSkills', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-output');

  after(() => {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it('processes GUIDE_REF macros in real CSS guide.md', () => {
    const skillFilePath = path.join(rootDir, 'guides/css/css/guide.md');
    assert.ok(fs.existsSync(skillFilePath), 'guides/css/css/guide.md should exist');

    const content = fs.readFileSync(skillFilePath, 'utf8');
    const result = replaceMacros(content, skillFilePath, { target: 'skills-cli' });

    assert.ok(!result.includes('{{ GUIDE_REF'), 'GUIDE_REF macro should be resolved');
    assert.ok(result.includes('`child-state-based-styling` (via `npx -y modern-web-guidance@latest retrieve "child-state-based-styling"`)'), 'Should contain command for child-state-based-styling');
    assert.ok(result.includes('`content-based-styling` (via `npx -y modern-web-guidance@latest retrieve "content-based-styling"`)'), 'Should contain command for content-based-styling');
  });

  it('uses the same command text as in modern-web-guidance/SKILL.md', () => {
    const skillFilePath = path.join(rootDir, 'guides/modern-web-guidance/SKILL.md');
    assert.ok(fs.existsSync(skillFilePath), 'modern-web-guidance/SKILL.md should exist');

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');

    const expectedPattern = 'npx -y modern-web-guidance@latest retrieve "<id>"';
    assert.ok(skillContent.includes(expectedPattern), 'modern-web-guidance/SKILL.md should contain the expected command pattern');

    const result = replaceMacros('{{ GUIDE_REF("break-up-long-tasks") }}', 'test.md', { target: 'skills-cli' });

    assert.ok(result.includes('npx -y modern-web-guidance@latest retrieve "break-up-long-tasks"'), 'Macro output should match the pattern in SKILL.md');
  });

  it('verifies distribution was built successfully', async () => {
    const publishRoot = path.join(rootDir, 'dist/skills-cli');
    
    assert.ok(fs.existsSync(path.join(publishRoot, 'skills/modern-web-guidance/modern-web.mjs')), 'modern-web.mjs should exist');
    assert.ok(fs.existsSync(path.join(publishRoot, 'skills/modern-web-guidance/search.mjs')), 'search.mjs should exist');

    // Verify standalone skills and their references exist
    assert.ok(fs.existsSync(path.join(publishRoot, 'skills/chrome-extensions/SKILL.md')), 'chrome-extensions SKILL.md should exist');
    assert.ok(fs.existsSync(path.join(publishRoot, 'skills/chrome-extensions/references/extensions/popup-ui.md')), 'chrome-extensions sibling popup-ui.md references should exist');
  });
});
