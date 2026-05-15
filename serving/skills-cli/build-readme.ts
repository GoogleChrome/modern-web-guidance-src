import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";
import { rootDir } from "../../lib/paths.ts";

const SERVING_DIR = path.join(rootDir, "serving");

export function updateReadmeWithFeaturesAndUseCases(publishRoot: string) {
  const guidesDir = path.join(publishRoot, 'skills/modern-web-guidance/guides');
  const readyGuides = scanAllGuides().filter(inv => {
    if (!inv.hasGuide || inv.featureIds.length === 0) return false;

    const guideBuildPath = path.join(guidesDir, inv.category, `${inv.name}.md`);
    return fs.existsSync(guideBuildPath);
  });

  const allFeatureIds = new Set<string>();
  const categoryMap = new Map<string, { id: string; category: string; description: string }[]>();

  for (const guide of readyGuides) {
    const guidePath = path.join(guide.dir, "guide.md");
    if (!fs.existsSync(guidePath)) continue;

    let description = guide.name;
    try {
      const content = fs.readFileSync(guidePath, "utf-8");
      const { data } = matter(content);
      if (data.description) description = data.description;
    } catch { }

    guide.featureIds.forEach(id => allFeatureIds.add(id));

    if (!categoryMap.has(guide.category)) {
      categoryMap.set(guide.category, []);
    }
    categoryMap.get(guide.category)!.push({
      id: guide.name,
      category: guide.category,
      description
    });
  }

  // Determine all features to generate the summary text
  const allFeaturesSorted = Array.from(allFeatureIds)
    .map(fId => ({ id: fId, name: getFeatureName(fId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Sort categories alphabetically by slug
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => a.localeCompare(b));

  let version = "unknown";
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(publishRoot, "package.json"), "utf8"));
    if (pkgJson.version) version = pkgJson.version;
  } catch { }

  let dynamicMd = `#### Full Skill Coverage (v${version})\n\n`;

  // Details block 1: Web features
  dynamicMd += `<details>\n<summary>Includes expert guidance across <strong>${allFeaturesSorted.length} modern web features</strong></summary>\n\n`;
  for (const f of allFeaturesSorted) {
    dynamicMd += `- [${f.name.replace(/</g, '&lt;')}](https://web-platform-dx.github.io/web-features-explorer/features/${f.id}/)\n`;
  }
  dynamicMd += `</details>\n\n`;

  // Details block 2: Use cases
  dynamicMd += `<details>\n<summary>Covers <strong>${readyGuides.length} real-world developer use cases</strong> with production-ready code patterns</summary>\n\n`;
  for (const cat of sortedCategories) {
    dynamicMd += `<h3>${cat}</h3>\n\n`;
    const ucs = categoryMap.get(cat)!;
    ucs.sort((a, b) => a.id.localeCompare(b.id));
    for (const uc of ucs) {
      const url = `https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/${uc.category}/${uc.id}.md`;
      dynamicMd += `- **[${uc.id}](${url})**: ${uc.description}\n`;
    }
    dynamicMd += `\n`;
  }
  dynamicMd = dynamicMd.trimEnd() + `\n</details>\n\n`;

  // Update README idempotently from template source
  const templateReadmePath = path.join(SERVING_DIR, "skills-cli/template/README.md");
  const destReadmePath = path.join(publishRoot, "README.md");
  if (fs.existsSync(templateReadmePath)) {
    let readmeContent = fs.readFileSync(templateReadmePath, "utf-8");
    if (readmeContent.includes('<!-- INJECT_SKILL_COVERAGE -->')) {
      readmeContent = readmeContent.replace('<!-- INJECT_SKILL_COVERAGE -->', dynamicMd.trimEnd());
    } else {
      readmeContent = readmeContent.replace('## Installation', dynamicMd + '## Installation');
    }
    readmeContent = readmeContent.replace(/\*\*\d+\+? use-case-centric guides\*\*/, `**${readyGuides.length} use-case-centric guides**`);
    fs.writeFileSync(destReadmePath, readmeContent);
  }

  return { featuresCount: allFeaturesSorted.length, useCasesCount: readyGuides.length };
}
