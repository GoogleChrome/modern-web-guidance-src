import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import matter from 'gray-matter';
import { scanAllGuides, scanDisciplineSkills, getGuideMarkdownPath } from '../lib/guide-validation.ts';
import { rootDir } from '../lib/paths.ts';

const MAX_RECOMMENDED_CHARS = 8192; // AGY CLI character limit
const MAX_RECOMMENDED_LINES = 256;  // Codex CLI line limit

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    guide: {
      type: 'string',
      short: 'g',
    },
    'update-baseline': {
      type: 'boolean',
    },
    oversized: {
      type: 'boolean',
      short: 'o',
    },
    'exceeds-limits': {
      type: 'boolean',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log('Usage: node --experimental-strip-types scripts/scan-guide-lengths.ts [--guide <path|name>] [--oversized] [--update-baseline]');
  console.log('\nScans and displays length metrics (line count, total characters, body characters) for markdown guides.');
  console.log('By default (without arguments), scans all guides across the repository and sorts by body character count descending.');
  console.log('\nOptions:');
  console.log('  -g, --guide <path|name>  Scan a specific guide by path, name, or substring (default: all guides)');
  console.log('  -o, --oversized          Only show guides exceeding limits (> 8192 chars or > 256 lines)');
  console.log('      --exceeds-limits     Alias for --oversized');
  console.log('      --update-baseline    Update guides/oversized-guides-baseline.json with current sizes of guides exceeding limits (> 8192 chars or > 256 lines)');
  console.log('  -h, --help               Show help');
  process.exit(0);
}

if (values['update-baseline']) {
  const allGuides = scanAllGuides();
  const baseline: Record<string, { chars: number; lines: number }> = {};

  for (const inv of allGuides) {
    const filePath = getGuideMarkdownPath(inv);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf8');
    const chars = raw.length;
    const lines = raw.split(/\r?\n/).length;

    if (chars > MAX_RECOMMENDED_CHARS || lines > MAX_RECOMMENDED_LINES) {
      const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
      baseline[rel] = { chars, lines };
    }
  }

  const sortedGuideKeys = Object.keys(baseline).sort();
  const outputJson: Record<string, any> = {
    _comment: 'Baseline snapshot of guides exceeding limits (8,192 chars or 256 lines).',
    _date: new Date().toISOString().split('T')[0],
  };

  for (const key of sortedGuideKeys) {
    outputJson[key] = baseline[key];
  }

  const baselinePath = path.join(rootDir, 'guides/oversized-guides-baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(outputJson, null, 2) + '\n');
  console.log(`Updated ${baselinePath} with ${sortedGuideKeys.length} oversized guides as of ${outputJson._date}.`);
  process.exit(0);
}

const target = values.guide || positionals[0];

let filePaths: string[] = [];

if (target) {
  const candidatePaths = [
    target,
    path.resolve(rootDir, target),
    path.resolve(process.cwd(), target),
  ];

  let directFile: string | undefined;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        directFile = path.resolve(candidate);
        break;
      } else if (stat.isDirectory()) {
        const guideFile = path.join(candidate, 'guide.md');
        const skillFile = path.join(candidate, 'SKILL.md');
        if (fs.existsSync(guideFile)) {
          directFile = path.resolve(guideFile);
          break;
        } else if (fs.existsSync(skillFile)) {
          directFile = path.resolve(skillFile);
          break;
        }
      }
    }
  }

  if (directFile) {
    filePaths = [directFile];
  } else {
    const allGuides = [...scanAllGuides(), ...scanDisciplineSkills()];
    const normalizedTarget = target.replace(/\\/g, '/').toLowerCase();
    filePaths = allGuides
      .map(inv => getGuideMarkdownPath(inv))
      .filter(filePath => {
        const rel = path.relative(rootDir, filePath).replace(/\\/g, '/').toLowerCase();
        return rel.includes(normalizedTarget) || path.basename(path.dirname(filePath)).toLowerCase().includes(normalizedTarget);
      });
  }
} else {
  const allGuides = [...scanAllGuides(), ...scanDisciplineSkills()];
  filePaths = allGuides.map(inv => getGuideMarkdownPath(inv));
}

const results: { guide: string; lineCount: number; totalChars: number; bodyChars: number }[] = [];

for (const filePath of filePaths) {
  if (!fs.existsSync(filePath)) continue;

  const raw = fs.readFileSync(filePath, 'utf8');
  const { content: body } = matter(raw);

  results.push({
    guide: path.relative(rootDir, filePath),
    lineCount: raw.split(/\r?\n/).length,
    totalChars: raw.length,
    bodyChars: body.trim().length,
  });
}

if (target && results.length === 0) {
  console.error(`No guide found matching "${target}".`);
  process.exit(1);
}

let displayResults = results;
const showOversizedOnly = values.oversized || values['exceeds-limits'];

if (showOversizedOnly) {
  displayResults = results.filter(
    r => r.totalChars > MAX_RECOMMENDED_CHARS || r.lineCount > MAX_RECOMMENDED_LINES,
  );
}

// Sort by character count descending
displayResults.sort((a, b) => b.bodyChars - a.bodyChars);

console.table(displayResults);

if (showOversizedOnly) {
  console.log(`\nFound ${displayResults.length} guides exceeding limits (> ${MAX_RECOMMENDED_CHARS.toLocaleString()} characters or > ${MAX_RECOMMENDED_LINES} lines).`);
}

