import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { processSkills } from './build-dist.ts';
import { rootDir } from '../../lib/paths.ts';

describe('processSkills', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-output');
  const testGuidesDir = path.join(rootDir, 'guides');
  const dummySkillName = 'test-dummy-skill';
  const dummySkillDir = path.join(testGuidesDir, dummySkillName);
  
  before(() => {
    fs.mkdirSync(dummySkillDir, { recursive: true });
    fs.writeFileSync(path.join(dummySkillDir, 'SKILL.md'), 'Test Skill with macro: {{ BASELINE_STATUS("grid") }}');
    fs.mkdirSync(testOutputDir, { recursive: true });
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
  });

  it('processes GUIDE_REF macros in real CSS SKILL.md', () => {
    const publishRoot = testOutputDir;
    const distDir = path.join(publishRoot, 'skills/modern-web');
    
    processSkills(publishRoot, distDir, false);
    
    const builtSkillPath = path.join(publishRoot, 'skills', 'css', 'SKILL.md');
    assert.ok(fs.existsSync(builtSkillPath), 'Built CSS SKILL.md should exist');
    
    const content = fs.readFileSync(builtSkillPath, 'utf8');
    assert.ok(!content.includes('{{ GUIDE_REF'), 'GUIDE_REF macro should be resolved');
    assert.ok(content.includes('`child-state-based-styling` (via `node modern-web.mjs retrieve "child-state-based-styling"`)'), 'Should contain command for child-state-based-styling');
    assert.ok(content.includes('`content-based-styling` (via `node modern-web.mjs retrieve "content-based-styling"`)'), 'Should contain command for content-based-styling');
  });
});
