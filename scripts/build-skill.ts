import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();
const GUIDES_DIR = path.join(REPO_ROOT, 'guides');
const DIST_DIR = path.join(REPO_ROOT, 'dist-skill');
const DIST_REFS_DIR = path.join(DIST_DIR, 'references');
const EXISTING_SKILL_PATH = path.join(process.env.HOME || '', '.gemini/skills/modern-web-development/SKILL.md');

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

// Extract body from existing skill (everything after the second '---')
const parts = existingSkillContent.split(/---\s*\n/);
let bodyContent = parts.length >= 3 ? parts.slice(2).join('---\n') : existingSkillContent;

let frontmatter = `---
name: modern-web-dev
description: |
  **CRITICAL USAGE REQUIREMENT**: Use this skill ALWAYS and HEAVILY across EVERY single web development task you perform. If you are touching HTML, CSS, JavaScript, or TypeScript, or if the user asks you to build, review, or fix ANY frontend feature, YOU MUST INVOKE THIS SKILL before proceeding. This includes simple component updates, performance issues, logic restructuring, and any UI work.

  This skill contains the definitive guidelines for web development, performance architecture, and modern UX patterns for this repository.
  
  Do NOT assume you know the best practices without consulting this skill first. It contains explicit constraints, fallback approaches, and optimized architectural patterns that you must follow!
  
  Examples:
  - "Add a copy to clipboard button" -> ensures Clipboard API is used
  - "Implement drag and drop" -> ensures HTML Drag and Drop API
  - "Fetch data from API" -> ensures fetch() with modern patterns
allowed-tools:
  - WebSearch
  - WebFetch
model: opus
user-invokable: true
---
`;

let taxonomyMarkdown = `\n## Internal Specialized Guides\n\nWhen working in this repository on specific domains, be sure to consult the targeted guides below.\n\n`;

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
const finalContent = `${frontmatter}\n${bodyContent.trim()}\n\n${taxonomyMarkdown}`;

fs.writeFileSync(path.join(DIST_DIR, 'SKILL.md'), finalContent);
console.log(`Generated skill successfully in ${DIST_DIR}`);
