import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

const { values } = parseArgs({
  options: {
    discipline: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
});

if (values.help || !values.discipline) {
  console.log(`
Usage:
  node resolve_sources.js --discipline <name>

Options:
  --discipline     Name of the discipline to research (e.g. performance, accessibility)
  -h, --help       Show this help
`);
  process.exit(0);
}

const discipline = values.discipline;
const researchPath = path.resolve('skills-drafts/.research', discipline, 'research.md');

async function resolveUrl(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return r.url;
  } catch (err) {
    console.error(`Error resolving ${url}:`, err.message);
    return url;
  }
}

async function main() {
  if (!fs.existsSync(researchPath)) {
    console.error(`File missing: ${researchPath}`);
    process.exit(1);
  }

  let text = fs.readFileSync(researchPath, 'utf8');

  const regex = /(https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s\)]+)/g;
  const matches = [...new Set(text.match(regex))]; // unique

  if (!matches.length) {
    console.log("No temporary Vertex AI redirect URLs found.");
    return;
  }

  console.log(`Found ${matches.length} unique temporary redirect URLs for discipline ${discipline}. Resolving destinations...`);

  const resolvedMap = {};
  const batchSize = 20;

  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    console.log(`Resolving batch ${i / batchSize + 1} (${batch.length} URLs)...`);

    const results = await Promise.all(
      batch.map(async (url) => {
        const resolved = await resolveUrl(url);
        return { original: url, resolved };
      })
    );

    for (const { original, resolved } of results) {
      resolvedMap[original] = resolved;
    }
  }

  let replaceCount = 0;
  for (const [original, resolved] of Object.entries(resolvedMap)) {
    if (original !== resolved) {
      text = text.split(original).join(resolved);
      replaceCount++;
    }
  }

  fs.writeFileSync(researchPath, text, 'utf8');
  console.log(`Successfully resolved and replaced ${replaceCount} URLs in ${researchPath}`);
}

main();
