import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();
const GUIDES_DIR = path.join(REPO_ROOT, 'guides');
const DIST_DIR = path.join(REPO_ROOT, 'skills', 'modern-web');
const DIST_REFS_DIR = path.join(DIST_DIR, 'references');
const EXISTING_SKILL_PATH = path.join(GUIDES_DIR, 'modern-web-dev.md');

// Create fresh dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_REFS_DIR, { recursive: true });

// Read existing skill
let existingSkillContent = '';
if (fs.existsSync(EXISTING_SKILL_PATH)) {
  existingSkillContent = fs.readFileSync(EXISTING_SKILL_PATH, 'utf-8');
} else {
  console.warn(`Could not find existing skill at ${EXISTING_SKILL_PATH}`);
  process.exit(1);
}


let taxonomyMarkdown = `\n## Specialized expert-level guidance\n\nREAD the below guides if they are relevant to the current task.\n\n`;

// Process guides directory
const categories = fs.readdirSync(GUIDES_DIR).filter(f => {
  const stat = fs.statSync(path.join(GUIDES_DIR, f));
  return stat.isDirectory() && !f.startsWith('.') && f !== 'node_modules';
});

for (const category of categories) {
  const categoryPath = path.join(GUIDES_DIR, category);
  const usecases = fs.readdirSync(categoryPath).filter(f => {
    return fs.statSync(path.join(categoryPath, f)).isDirectory() && !f.startsWith('.');
  });
  
  if (usecases.length === 0) continue;
  
  // Format Category name
  const categoryName = category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  taxonomyMarkdown += `### ${categoryName}\n\n`;
  
  // Create category dist folder
  fs.mkdirSync(path.join(DIST_REFS_DIR, category), { recursive: true });

  for (const usecase of usecases) {
    const guidePath = path.join(categoryPath, usecase, 'guide.md');
    if (!fs.existsSync(guidePath)) continue;
    
    let guideContent = fs.readFileSync(guidePath, 'utf-8');
    
    // Skip if there's no content beyond frontmatter
    const contentWithoutFrontmatter = guideContent.replace(/^---[\s\S]*?---\n*/, '').trim();
    if (contentWithoutFrontmatter.length === 0) continue;
    
    // Extract title from first H1 or fall back
    const match = guideContent.match(/^#\s+(.+)$/m);
    let title = match ? match[1].trim() : usecase.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Copy the file
    const destFilePath = path.posix.join(category, `${usecase}.md`);
    fs.writeFileSync(path.join(DIST_REFS_DIR, destFilePath), guideContent);
    
    taxonomyMarkdown += `- [${title}](./references/${destFilePath})\n`;
  }
  
  taxonomyMarkdown += `\n`;
}

// Assemble final SKILL.md
const finalContent = `${existingSkillContent.trim()}\n\n${taxonomyMarkdown}`;

fs.writeFileSync(path.join(DIST_DIR, 'SKILL.md'), finalContent);
console.log(`Generated skill successfully in ${DIST_DIR}`);

const LOCAL_AGENTS_SKILL_DIR = path.join(REPO_ROOT, '.agents', 'skills', 'modern-web');
const localAgentsSkillsBase = path.dirname(LOCAL_AGENTS_SKILL_DIR);
if (!fs.existsSync(localAgentsSkillsBase)) {
  fs.mkdirSync(localAgentsSkillsBase, { recursive: true });
}

try {
  if (fs.lstatSync(LOCAL_AGENTS_SKILL_DIR)) {
    fs.rmSync(LOCAL_AGENTS_SKILL_DIR, { recursive: true, force: true });
  }
} catch (e) {
  // Ignore error if it doesn't exist
}

const relativeTarget = path.relative(localAgentsSkillsBase, DIST_DIR);
fs.symlinkSync(relativeTarget, LOCAL_AGENTS_SKILL_DIR, 'dir');
console.log(`Symlinked skill to ${LOCAL_AGENTS_SKILL_DIR}`);
