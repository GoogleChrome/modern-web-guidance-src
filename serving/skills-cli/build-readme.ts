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

  let dynamicMd = `#### The full list (as of \`v${version}\`)\n\n`;

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
      const escapedDescription = uc.description.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      dynamicMd += `- **[${uc.id}](${url})**: ${escapedDescription}\n`;
    }
    dynamicMd += `\n`;
  }
  dynamicMd = dynamicMd.trimEnd() + `\n</details>\n\n`;

  // Generate Evals Results Table
  let evalsMd = '';
  const evalsSummaryPath = path.join(SERVING_DIR, 'skills-cli', 'eval-results-summary.json');
  if (fs.existsSync(evalsSummaryPath)) {
    try {
      const evalsData = JSON.parse(fs.readFileSync(evalsSummaryPath, 'utf-8'));
      if (Array.isArray(evalsData) && evalsData.length > 0) {
        evalsMd += '| Suite | Agent + Model | Tasks | Unguided → Guided (Uplift) |\n';
        evalsMd += '| :--- | :--- | :---: | :---: |\n';
        
        const limitedData = evalsData.slice(0, 10);
        for (const run of limitedData) {
          const suiteLabel = formatSuiteLabel(run.testId, run.timestamp);
          const agentModel = formatAgentModel(run.agent, run.model);
          const tasks = run.taskCount;
          const uplift = formatUplift(run.unguidedPassRate, run.guidedPassRate);
          
          evalsMd += `| ${suiteLabel} | ${agentModel} | ${tasks} | ${uplift} |\n`;
        }
      }
    } catch (e) {
      console.error('Failed to parse evals summary:', e);
    }
  }

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
    if (readmeContent.includes('<!-- INJECT_EVAL_RESULTS -->')) {
      readmeContent = readmeContent.replace('<!-- INJECT_EVAL_RESULTS -->', evalsMd.trimEnd());
    }
    readmeContent = readmeContent.replace(/\*\*\d+\+? use-case-centric guides\*\*/, `**${readyGuides.length} use-case-centric guides**`);
    fs.writeFileSync(destReadmePath, readmeContent);
  }

  // Copy .github/img assets
  const srcImgDir = path.join(rootDir, ".github/img");
  const destImgDir = path.join(publishRoot, ".github/img");
  if (fs.existsSync(srcImgDir)) {
    fs.mkdirSync(destImgDir, { recursive: true });
    fs.cpSync(srcImgDir, destImgDir, { recursive: true });
  }

  return { featuresCount: allFeaturesSorted.length, useCasesCount: readyGuides.length };
}

function getAgentBadge(agent: string): string {
  const name = agent.toLowerCase();
  if (name.includes('gemini') || name.includes('jetski')) return '✦ ';
  if (name.includes('codex') || name.includes('openai')) return '❂ ';
  if (name.includes('claude')) return '✱ ';
  return '';
}

function formatAgentModel(agent: string, model: string): string {
  const badge = getAgentBadge(agent);
  const modelStr = model && model !== 'unknown' ? ` (${model})` : '';
  return `${badge}${agent}${modelStr}`;
}

function formatSuiteLabel(testId: string, timestamp: string): string {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  let type = 'Run';
  if (testId.startsWith('nightly-')) type = 'Nightly';
  else if (testId.startsWith('full-')) type = 'Full';
  else if (testId.startsWith('skills-cli-')) type = 'Skills CLI';
  
  return `${type} (${dateStr})`;
}

function formatUplift(unguided: number, guided: number): string {
  const uplift = guided - unguided;
  const upliftStr = uplift >= 0 ? `+${uplift}%` : `${uplift}%`;
  return `${unguided}% → ${guided}% (**${upliftStr}**)`;
}

