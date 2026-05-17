import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName, getFeatureGroups } from "../lib/baseline.ts";
import { rootDir } from "../../lib/paths.ts";

const SERVING_DIR = path.join(rootDir, "serving");

const CATEGORY_MAP: Record<string, string> = {
  // HTML / DOM
  'html-elements': 'HTML & DOM',
  'landmark-elements': 'HTML & DOM',
  'html': 'HTML & DOM',
  'custom-elements': 'HTML & DOM',
  'dom': 'HTML & DOM',
  'shadow-dom': 'HTML & DOM',
  'forms': 'HTML & DOM',

  // CSS
  'css': 'CSS & Layout',
  'layout': 'CSS & Layout',
  'positioning': 'CSS & Layout',
  'borders-outlines': 'CSS & Layout',
  'background': 'CSS & Layout',
  'blend-mode': 'CSS & Layout',
  'selectors': 'CSS & Layout',
  'fonts': 'CSS & Layout',
  'color': 'CSS & Layout',
  'media-queries': 'CSS & Layout',
  'flexbox': 'CSS & Layout',
  'grid': 'CSS & Layout',
  'transforms': 'CSS & Layout',
  'transitions': 'CSS & Layout',
  'shadows': 'CSS & Layout',
  'overflow': 'CSS & Layout',
  'shapes': 'CSS & Layout',
  'scrollbars': 'CSS & Layout',
  'text': 'CSS & Layout',
  'view-transitions': 'CSS & Layout',
  'animation': 'CSS & Layout',

  // JS / APIs
  'javascript': 'JavaScript & APIs',
  'fetch': 'JavaScript & APIs',
  'streams': 'JavaScript & APIs',
  'iterators': 'JavaScript & APIs',
  'arrays': 'JavaScript & APIs',
  'maps': 'JavaScript & APIs',
  'typed-arrays': 'JavaScript & APIs',
  'messaging': 'JavaScript & APIs',
  'web-audio': 'JavaScript & APIs',
  'webgl-extensions': 'JavaScript & APIs',
  'clipboard': 'JavaScript & APIs',
  'storage': 'JavaScript & APIs',
  'history': 'JavaScript & APIs',
  'url': 'JavaScript & APIs',
  'workers': 'JavaScript & APIs',
  'concurrency': 'JavaScript & APIs',
  'sensors': 'JavaScript & APIs',
  'progressive-web-app': 'JavaScript & APIs',
  'performance': 'JavaScript & APIs',
  'diagnostics': 'JavaScript & APIs',
  'security': 'JavaScript & APIs',
  'privacy': 'JavaScript & APIs',
};

function getCategoryForFeature(id: string): string {
  const groups = getFeatureGroups(id);
  for (const group of groups) {
    if (CATEGORY_MAP[group]) {
      return CATEGORY_MAP[group];
    }
  }
  
  if (groups.length > 0) {
    const g = groups[0];
    if (g.includes('css') || g.includes('style') || g.includes('layout') || g.includes('highlight') || g.includes('target')) {
      return 'CSS & Layout';
    } else if (g.includes('html') || g.includes('element') || g.includes('dom') || g.includes('link-') || g.includes('invoker')) {
      return 'HTML & DOM';
    }
  }
  
  // Hardcoded fallbacks for known groupless features in our guides
  if (id.includes('css') || id.includes('style') || id.includes('layout') || id.includes('highlight') || id.includes('target') || id === 'anchor-positioning') {
    return 'CSS & Layout';
  }
  if (id.includes('html') || id.includes('element') || id.includes('dom') || id.includes('link-') || id.includes('invoker')) {
    return 'HTML & DOM';
  }

  return 'JavaScript & APIs';
}

function listToMarkdownTable(items: string[], colCount = 3): string {
  const rowCount = Math.ceil(items.length / colCount);
  let md = '| | | |\n| :--- | :--- | :--- |\n';
  for (let r = 0; r < rowCount; r++) {
    const rowItems = [];
    for (let c = 0; c < colCount; c++) {
      const idx = r + c * rowCount;
      if (idx < items.length) {
        rowItems.push(items[idx]);
      } else {
        rowItems.push('');
      }
    }
    md += `| ${rowItems.join(' | ')} |\n`;
  }
  return md;
}

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

  // Group features by category
  const categories: Record<string, { id: string; name: string }[]> = {
    'HTML & DOM': [],
    'CSS & Layout': [],
    'JavaScript & APIs': []
  };

  for (const f of allFeaturesSorted) {
    const cat = getCategoryForFeature(f.id);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(f);
  }

  // Details block 1: Web features
  dynamicMd += `<details>\n<summary>Includes expert guidance across <strong>${allFeaturesSorted.length} modern web features</strong></summary>\n\n`;
  
  for (const cat of ['HTML & DOM', 'CSS & Layout', 'JavaScript & APIs']) {
    const list = categories[cat] || [];
    if (list.length === 0) continue;
    
    dynamicMd += `### ${cat} (${list.length} features)\n\n`;
    
    const linkedItems = list.map(f => {
      const escapedName = f.name.replace(/</g, '&lt;');
      return `[${escapedName}](https://web-platform-dx.github.io/web-features-explorer/features/${f.id}/)`;
    });
    
    dynamicMd += listToMarkdownTable(linkedItems) + '\n';
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

        // Stratified Recency Selection Algorithm
        const selectedRuns: any[] = [];
        const groups: Record<string, any[]> = {};

        for (const run of evalsData) {
          let cleanModel = run.model;
          if (cleanModel.startsWith('claude-')) {
            cleanModel = cleanModel.slice(7);
          }
          const key = `${run.agent}|||${cleanModel}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(run);
        }

        for (const key of Object.keys(groups)) {
          groups[key].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        const K = 2;
        const remainingPool: any[] = [];

        for (const key of Object.keys(groups)) {
          const groupRuns = groups[key];
          selectedRuns.push(...groupRuns.slice(0, K));
          remainingPool.push(...groupRuns.slice(K));
        }

        if (selectedRuns.length > 10) {
          selectedRuns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          selectedRuns.splice(10);
        } else if (selectedRuns.length < 10) {
          remainingPool.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const fillCount = 10 - selectedRuns.length;
          selectedRuns.push(...remainingPool.slice(0, fillCount));
        }

        selectedRuns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        for (const run of selectedRuns) {
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
    fs.writeFileSync(destReadmePath, readmeContent);
    const rootReadmePath = path.join(rootDir, "README.mwg.md");
    fs.writeFileSync(rootReadmePath, readmeContent);
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
  let cleanModel = model;
  if (cleanModel.startsWith('claude-')) {
    cleanModel = cleanModel.slice(7);
  }
  const modelStr = cleanModel && cleanModel !== 'unknown' ? ` (${cleanModel})` : '';
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

