import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

function toTitleCase(kebabString: string): string {
  return kebabString
    .split('-')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function safeRmSync(targetPath: string, expectedSuffix: string): void {
  // Normalize path separators to ensure cross-platform safety check works
  const normalizedPath = targetPath.replace(/\\/g, '/');
  if (!normalizedPath.endsWith(expectedSuffix)) {
    console.error(`Safety Abort: Refusing to rmSync ${targetPath}\nPath does not terminate with expected suffix '${expectedSuffix}'`);
    process.exit(1);
  }

  fs.rmSync(targetPath, {recursive: true, force: true});
}

function buildTaxonomyMarkdown(guidesDir: string, distRefsDir: string): string {
  let taxonomyMarkdown = `\n## Specialized expert-level guidance\n\nREAD the below guides if they are relevant to the current task.\n\n`;

  // Process guides directory
  const categories = fs.readdirSync(guidesDir).filter((file: string) => {
    const stat = fs.statSync(path.join(guidesDir, file));
    return stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules';
  });

  for (const category of categories) {
    const categoryPath = path.join(guidesDir, category);
    const usecases = fs.readdirSync(categoryPath).filter((file: string) => {
      const isDir = fs.statSync(path.join(categoryPath, file)).isDirectory();
      return isDir && !file.startsWith('.');
    });

    if (usecases.length === 0) continue;

    // Format Category name
    taxonomyMarkdown += `### ${toTitleCase(category)}\n\n`;

    // Create category dist folder
    const distCategoryDir = path.join(distRefsDir, category);
    fs.mkdirSync(distCategoryDir, {recursive: true});

    for (const usecase of usecases) {
      const guidePath = path.join(categoryPath, usecase, 'guide.md');
      if (!fs.existsSync(guidePath)) continue;

      const guideContent = fs.readFileSync(guidePath, 'utf-8');
      const { content: parsedContent } = matter(guideContent);

      // Skip if there's no content beyond frontmatter
      const contentWithoutFrontmatter = parsedContent.trim();
      if (contentWithoutFrontmatter.length === 0) continue;

      // Extract title from first H1 or fall back
      let title: string;
      const titleMatch = guideContent.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        title = toTitleCase(usecase);
      }

      // Copy the file
      const destFilePath = path.posix.join(category, `${usecase}.md`);
      fs.writeFileSync(path.join(distRefsDir, destFilePath), guideContent);

      taxonomyMarkdown += `- [${title}](./references/${destFilePath})\n`;
    }

    taxonomyMarkdown += `\n`;
  }

  return taxonomyMarkdown;
}

function createLocalSymlink(repoRoot: string, distDir: string): void {
  const localAgentsSkillDir = path.join(repoRoot, '.agents', 'skills', 'modern-web');
  const localAgentsSkillsBase = path.dirname(localAgentsSkillDir);

  if (!fs.existsSync(localAgentsSkillsBase)) {
    fs.mkdirSync(localAgentsSkillsBase, {recursive: true});
  }

  // safely remove to prepare for symlink
  safeRmSync(localAgentsSkillDir, '.agents/skills/modern-web');

  const relativeTarget = path.relative(localAgentsSkillsBase, distDir);
  fs.symlinkSync(relativeTarget, localAgentsSkillDir, 'dir');
  console.log(`Symlinked skill to ${localAgentsSkillDir}`);
}

function buildMegaskill(): void {
  const repoRoot = path.resolve(import.meta.dirname, '../..');

  // Validate we are actually rooted in the modern-web-guidance-src project
  if (!fs.existsSync(path.join(repoRoot, 'package.json'))) {
    console.error(`Safety Abort: Script must be run from a directory where the repo root can be found (missing package.json in ${repoRoot}).`);
    process.exit(1);
  }

  const guidesDir = path.join(repoRoot, 'guides');
  const distDir = path.join(repoRoot, 'skills', 'modern-web');
  const distRefsDir = path.join(distDir, 'references');
  const existingSkillPath = path.join(repoRoot, 'serving/megaskill/megaskill.md');

  // Create fresh dist directory
  safeRmSync(distDir, 'skills/modern-web');
  fs.mkdirSync(distRefsDir, {recursive: true});

  // Read existing skill
  if (!fs.existsSync(existingSkillPath)) {
    console.error(`Error: Could not find existing skill at ${existingSkillPath}`);
    process.exit(1);
  }
  const existingSkillContent = fs.readFileSync(existingSkillPath, 'utf-8');

  const taxonomyMarkdown = buildTaxonomyMarkdown(guidesDir, distRefsDir);

  // Assemble final SKILL.md
  const finalContent = `${existingSkillContent.trim()}\n\n${taxonomyMarkdown}`;

  fs.writeFileSync(path.join(distDir, 'SKILL.md'), finalContent);
  console.log(`Generated megaskill successfully in ${distDir}`);

  createLocalSymlink(repoRoot, distDir);
}

buildMegaskill();
