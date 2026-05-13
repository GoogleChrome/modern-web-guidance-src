import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { globSync } from 'glob';

test('all skill descriptions are under 1024 characters', () => {
  // import.meta.dirname gives the directory of the current file (harness/tests)
  const currentDir = import.meta.dirname;
  if (!currentDir) {
    throw new Error('import.meta.dirname is not available');
  }
  
  const repoRoot = path.resolve(currentDir, '../../');
  const patterns = [
    '.agents/skills/**/SKILL.md',
    'skills-src/**/SKILL.md',
    'guides/**/SKILL.md'
  ];
  
  console.log(`Searching for skill files with patterns: ${patterns.join(', ')}`);
  
  let skillFiles: string[] = [];
  for (const pattern of patterns) {
    const files = globSync(pattern, { cwd: repoRoot, absolute: true });
    skillFiles = skillFiles.concat(files);
  }
  
  console.log(`Found ${skillFiles.length} skill files.`);
  assert.ok(skillFiles.length > 0, 'Should find at least one skill file');
  
  for (const file of skillFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const { data } = matter(content);
    
    const description = data.description;
    assert.ok(description, `Skill file ${path.basename(path.dirname(file))} should have a description`);
    
    console.log(`Checking ${path.basename(path.dirname(file))}: length ${description.length}`);
    
    assert.ok(
      description.length < 1024,
      `Description in ${file} is too long: ${description.length} chars (max 1024)`
    );
  }
});
