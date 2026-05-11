import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { processSkills } from './build-dist.ts';
import { replaceMacros } from '../lib/macros.ts';
import { resetGuidesMap } from '../../lib/guide-validation.ts';


import { rootDir } from '../../lib/paths.ts';

describe('processSkills', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-output');
  const testGuidesDir = path.join(rootDir, 'guides');
  const dummySkillName = 'test-dummy-skill';
  const dummySkillDir = path.join(testGuidesDir, dummySkillName);

  before(() => {
    fs.mkdirSync(dummySkillDir, { recursive: true });
    fs.writeFileSync(path.join(dummySkillDir, 'SKILL.md'), '---\nname: test-dummy-skill\ndescription: Test dummy skill\n---\nTest Skill with macro: {{ BASELINE_STATUS("grid") }} and guide ref: {{ GUIDE_REF("forms") }}');
    fs.mkdirSync(testOutputDir, { recursive: true });
    resetGuidesMap();
  });

  after(() => {
    fs.rmSync(dummySkillDir, { recursive: true, force: true });
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  });

  it('processes macros in SKILL.md', () => {
    const publishRoot = testOutputDir;
    const distDir = path.join(publishRoot, 'skills/modern-web');

    processSkills(publishRoot, distDir, false);

    const builtSkillPath = path.join(publishRoot, 'skills', dummySkillName, 'SKILL.md');
    assert.ok(fs.existsSync(builtSkillPath), 'Built SKILL.md should exist');

    const content = fs.readFileSync(builtSkillPath, 'utf8');
    assert.ok(!content.includes('{{ BASELINE_STATUS'), 'Macro should be resolved');
    assert.ok(content.includes('Widely available') || content.includes('Baseline since'), 'Should contain baseline status');
    assert.ok(!content.includes('{{ GUIDE_REF'), 'GUIDE_REF macro should be resolved');
    assert.ok(content.includes('`forms` (via `node <modern-web-directory>/modern-web.mjs retrieve "forms"`)'), 'Should resolve forms skill reference');
  });

  it('processes GUIDE_REF macros in real CSS guide.md', () => {
    const skillFilePath = path.join(rootDir, 'guides/css/css/guide.md');
    assert.ok(fs.existsSync(skillFilePath), 'guides/css/css/guide.md should exist');

    const content = fs.readFileSync(skillFilePath, 'utf8');
    const result = replaceMacros(content, skillFilePath, { target: 'skills-cli' });

    assert.ok(!result.includes('{{ GUIDE_REF'), 'GUIDE_REF macro should be resolved');
    assert.ok(result.includes('`child-state-based-styling` (via `node <modern-web-directory>/modern-web.mjs retrieve "child-state-based-styling"`)'), 'Should contain command for child-state-based-styling');
    assert.ok(result.includes('`content-based-styling` (via `node <modern-web-directory>/modern-web.mjs retrieve "content-based-styling"`)'), 'Should contain command for content-based-styling');
  });

  it('uses the same command text as in modern-web/SKILL.md', () => {
    const skillFilePath = path.join(rootDir, 'guides/modern-web/SKILL.md');
    assert.ok(fs.existsSync(skillFilePath), 'modern-web/SKILL.md should exist');

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');

    const expectedPattern = 'node <modern-web-directory>/modern-web.mjs retrieve "<id>"';
    assert.ok(skillContent.includes(expectedPattern), 'modern-web/SKILL.md should contain the expected command pattern');

    const result = replaceMacros('{{ GUIDE_REF("break-up-long-tasks") }}', 'test.md', { target: 'skills-cli' });

    assert.ok(result.includes('node <modern-web-directory>/modern-web.mjs retrieve "break-up-long-tasks"'), 'Macro output should match the pattern in SKILL.md');
  });
});
