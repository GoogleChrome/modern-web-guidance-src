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
  const normalizedPath = targetPath.replace(/\\/g, '/');
  if (!normalizedPath.endsWith(expectedSuffix)) {
    console.error(`Safety Abort: Refusing to rmSync ${targetPath}\nPath does not terminate with expected suffix '${expectedSuffix}'`);
    process.exit(1);
  }
  fs.rmSync(targetPath, {recursive: true, force: true});
}

function buildTaxonomyMarkdown(guidesDir: string, distRefsDir: string): string {
  let taxonomyMarkdown = `\n## Specialized expert-level guidance\n\nREAD the below guides if they are relevant to the current task.\n\n`;

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

    const categoryGuides: string[] = [];
    const distCategoryDir = path.join(distRefsDir, category);

    for (const usecase of usecases) {
      const guidePath = path.join(categoryPath, usecase, 'guide.md');
      if (!fs.existsSync(guidePath)) continue;

      const guideContent = fs.readFileSync(guidePath, 'utf-8');
      const { data, content: parsedContent } = matter(guideContent);

      const contentWithoutFrontmatter = parsedContent.trim();
      if (contentWithoutFrontmatter.length === 0) continue;

      // Use description for link text, fallback to title or usecase
      let linkText = data.description;
      if (!linkText) {
        const titleMatch = guideContent.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          linkText = titleMatch[1].trim();
        } else {
          linkText = toTitleCase(usecase);
        }
      }

      // Ensure directory exists
      fs.mkdirSync(distCategoryDir, {recursive: true});

      const destFilePath = path.posix.join(category, `${usecase}.md`);
      // Write content WITHOUT frontmatter
      fs.writeFileSync(path.join(distRefsDir, destFilePath), parsedContent.trim());

      categoryGuides.push(`- [${linkText}](./references/${destFilePath})`);
    }

    if (categoryGuides.length > 0) {
      taxonomyMarkdown += `### ${toTitleCase(category)}\n\n`;
      taxonomyMarkdown += categoryGuides.join('\n') + '\n\n';
    }
  }

  return taxonomyMarkdown;
}

function main(): void {
  const repoRoot = path.resolve(import.meta.dirname, '../..');

  if (!fs.existsSync(path.join(repoRoot, 'package.json'))) {
    console.error(`Safety Abort: Script must be run from a directory where the repo root can be found.`);
    process.exit(1);
  }

  const guidesDir = path.join(repoRoot, 'guides');
  const distDir = path.join(repoRoot, 'dist', 'megaskill');
  const distRefsDir = path.join(distDir, 'references');
  const existingSkillPath = path.join(guidesDir, 'modern-web-dev.md');

  // Create fresh dist directory
  safeRmSync(distDir, 'dist/megaskill');
  fs.mkdirSync(distRefsDir, {recursive: true});

  if (!fs.existsSync(existingSkillPath)) {
    console.error(`Error: Could not find existing skill at ${existingSkillPath}`);
    process.exit(1);
  }
  const existingSkillContent = fs.readFileSync(existingSkillPath, 'utf-8');

  const taxonomyMarkdown = buildTaxonomyMarkdown(guidesDir, distRefsDir);

  const finalContent = `${existingSkillContent.trim()}\n\n${taxonomyMarkdown}`;

  fs.writeFileSync(path.join(distDir, 'SKILL.md'), finalContent);
  console.log(`Generated megaskill successfully in ${distDir}`);
}

main();
