import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * @param {string} dir
 * @param {string[]} [fileList=[]]
 * @returns {string[]}
 */
function findGuides(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findGuides(fullPath, fileList);
    } else if (file === 'guide.md') {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const guidesDir = new URL('.', import.meta.url).pathname;
const guidesPaths = findGuides(guidesDir);

/** @type {Array<{name: string, features: string[]}>} */
const guides = [];

for (const p of guidesPaths) {
  const content = fs.readFileSync(p, 'utf-8');

  if (!content.startsWith('---\n')) continue;

  const parsed = matter(content);

  let name = parsed.data.name;
  if (!name) {
    // fallback if no name in yaml, use directory name
    name = path.basename(path.dirname(p));
  }

  /** @type {string[]} */
  let features = parsed.data['web-feature-ids'] || [];

  guides.push({ name, features });
}

// Build inverted mapping
const featureToGuides = new Map();
for (const guide of guides) {
  if (guide.features.length === 0) {
    const list = featureToGuides.get('(No web features)') || [];
    list.push(guide.name);
    featureToGuides.set('(No web features)', list);
  }
  for (const feature of guide.features) {
    const list = featureToGuides.get(feature) || [];
    list.push(guide.name);
    featureToGuides.set(feature, list);
  }
}

// Generate ASCII Diagram
let output = '<!-- Note: This diagram is generated automatically by guides/guide-features-diagram.mjs during PRs. -->\n\n';
output += '# Mapping: Web feature : Use cases\n\n';
output += '```\n';

const featureKeys = Array.from(featureToGuides.keys()).sort(
  /**
   * @param {string} a
   * @param {string} b
   */
  (a,b) => {
  if (a.includes('No web features')) return 1;
  if (b.includes('No web features')) return -1;
  return a.localeCompare(b);
});

for (let i = 0; i < featureKeys.length; i++) {
  const feature = featureKeys[i];
  const list = featureToGuides.get(feature).sort(
    /**
     * @param {string} a
     * @param {string} b
     */
    (a, b) => a.localeCompare(b)
  );

  const isLastFeature = (i === featureKeys.length - 1);
  const featurePrefix = isLastFeature ? '└──' : '├──';

  output += `${featurePrefix} ${feature}\n`;

  for (let j = 0; j < list.length; j++) {
    const guideName = list[j];
    const isLastGuide = (j === list.length - 1);
    const guidePrefix = isLastFeature ? '    ' : '│   ';
    const guideBullet = isLastGuide ? '└──' : '├──';

    output += `${guidePrefix}${guideBullet} ${guideName}\n`;
  }
}

output += '```';

// Save to file
const outputPath = path.join(guidesDir, 'features-and-use-cases.md');
fs.writeFileSync(outputPath, output);
console.log(`Saved output to ${outputPath}`);
