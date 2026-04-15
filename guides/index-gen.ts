/**
 * Generates a guide index in JSON, Markdown, or CSV format.
 * Reuses the existing sync logic to match guides by name or subdirectory.
 * Uses `gh` CLI for authentication (no GITHUB_TOKEN needed).
 *
 * Usage:
 *   node --experimental-strip-types guides/index-gen.ts [--type=json|md|csv]
 *
 * Defaults to JSON. Output files are written to guides/.
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { scanAllGuides, processGuideInventory, classifyGuide } from '../lib/guide-validation.ts';
import { rootDir } from '../lib/paths.ts';

const { values } = parseArgs({
  options: { type: { type: 'string', default: 'json' } },
  strict: false,
});
const outputType = values.type as string;

// Suppress the "dry run" log from sync-use-cases importing its env setup
const origLog = console.log;
console.log = () => {};
const { buildUseCaseMaps } = await import('./sync-use-cases.ts');
console.log = origLog;

// Fetch all use case issues via gh CLI
const issueJson = execSync(
  'gh issue list -R GoogleChrome/guidance -l new-use-case --state all --json number,title,body,state -L 10000',
  { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
);
const allUseCases = JSON.parse(issueJson);

const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(allUseCases);

// Scan local guides and match them to issues
const guides = scanAllGuides();
const { preparedGuides } = processGuideInventory(guides);

// Build a lookup from guide name to its inventory (for classifyGuide)
const inventoryByName = new Map(guides.map(g => [g.name, g]));

const rows = preparedGuides.map(g => {
  const issue = nameToIssueMap.get(g.name) || subdirToIssueMap.get(g.relativeSubdir);
  const inv = inventoryByName.get(g.name);
  // Collect boolean flags starting with "has" → strip prefix and lowercase first letter
  const has: string[] = [];
  if (inv) {
    for (const [key, val] of Object.entries(inv)) {
      if (key.startsWith('has') && val === true) {
        has.push(key[3].toLowerCase() + key.slice(4));
      }
    }
  }

  // Last commit date and author for this guide directory
  let lastUpdated: string | null = null;
  let lastAuthor: string | null = null;
  try {
    const logLine = execSync(`git log -1 --format=%aI%n%aN -- ${g.relativeSubdir}`, {
      encoding: 'utf-8',
      cwd: rootDir,
    }).trim();
    const [date, author] = logLine.split('\n');
    if (date) {
      lastUpdated = date.slice(0, 10);
    }
    if (author) {
      lastAuthor = author;
    }
  } catch {
    // ignore — e.g. outside a git repo
  }

  return {
    guide: g.relativeSubdir.replace(/^guides\//, ''),
    name: g.name,
    category: inv?.category ?? null,
    description: g.description,
    featureIds: g.featureIds,
    status: inv ? classifyGuide(inv) : 'incomplete',
    has,
    lastUpdated,
    lastAuthor,
    issueNumber: issue?.number ?? null,
    issueOpen: issue ? issue.state === 'OPEN' : null,
  };
});

// Sort alphabetically by guide path
rows.sort((a, b) => a.guide.localeCompare(b.guide));

type Row = typeof rows[number];
type Column = {
  heading?: string;
  /** Maps a scalar value to a URL. Applied per-element for arrays. MD only. */
  link?: (v: string) => string;
  /** Custom MD display text. Overrides default rendering and link. */
  md?: (r: Row) => string | null;
};

/**
 * Column definitions shared by Markdown and CSV output.
 * Keys match JSON property names; order is preserved.
 * Defaults: heading = key, raw value = row[key].
 * Arrays are joined with ", " (MD) or "; " (CSV).
 * Null/empty → "—" (MD) or "" (CSV).
 */
const columns: Record<string, Column> = {
  guide: {
    md: r => `[\`${r.guide}\`](https://github.com/GoogleChrome/guidance/tree/main/guides/${r.guide})`,
  },
  name: {},
  category: {},
  description: {},
  featureIds: {
    heading: 'Feature IDs',
    link: v => `https://webstatus.dev/features/${v}`,
  },
  status: {},
  has: {},
  lastUpdated: { heading: 'Updated' },
  lastAuthor: { heading: 'Author' },
  issueNumber: {
    heading: 'Issue',
    md: r => r.issueNumber ? `[#${r.issueNumber}](https://github.com/GoogleChrome/guidance/issues/${r.issueNumber})` : null,
  },
  issueOpen: { heading: 'Issue Open' },
};

/** Serialize a raw value to a plain string. */
function serialize (v: unknown, separator: string): string {
  if (Array.isArray(v)) {
    return v.join(separator);
  }
  return v == null ? '' : String(v);
}

const keys = Object.keys(columns);
const headings = keys.map(k => columns[k].heading ?? k);

/** Format definitions — each knows how to render the full output. */
const formats = {
  json: {
    file: 'index.json',
    render: () => JSON.stringify(rows, null, '\t') + '\n',
  },
  md: {
    file: 'index.md',
    separator: ', ',
    empty: '—',
    /** Render a single cell value as Markdown. */
    cell (key: string, col: Column, row: Row): string {
      if (col.md) {
        return col.md(row) ?? '';
      }
      const raw = row[key as keyof Row];
      if (col.link) {
        const items = Array.isArray(raw) ? raw : [raw];
        return items.filter(v => v != null && v !== '').map(v => `[${v}](${col.link!(String(v))})`).join(this.separator);
      }
      if (typeof raw === 'boolean') {
        return raw ? '✅' : '❌';
      }
      return serialize(raw, this.separator);
    },
    render () {
      const headerRow = '| ' + headings.join(' | ') + ' |';
      const separatorRow = '| ' + keys.map(() => '-----').join(' | ') + ' |';
      const lines: string[] = [
        '<!-- This file is auto-generated by index-gen.ts. Do not edit manually. -->',
        '',
        '# Guide → Issue Map',
        '',
        `> Generated on ${new Date().toISOString().slice(0, 10)} — ${rows.length} guides, ${rows.filter(r => r.issueNumber).length} with issues.`,
        '',
        headerRow,
        separatorRow,
      ];
      for (const row of rows) {
        const cells = keys.map(k => {
          const v = this.cell(k, columns[k], row);
          return v === '' ? this.empty : v;
        });
        lines.push('| ' + cells.join(' | ') + ' |');
      }
      lines.push('');
      return lines.join('\n');
    },
  },
  csv: {
    file: 'index.csv',
    separator: ', ',
    empty: '',
    escape: (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s,
    render () {
      const csvLines = [headings.join(',')];
      for (const row of rows) {
        const cells = keys.map(k => this.escape(serialize(row[k as keyof Row], this.separator)));
        csvLines.push(cells.join(','));
      }
      csvLines.push('');
      return csvLines.join('\n');
    },
  },
};

if (!(outputType in formats)) {
  console.error(`Unknown type "${outputType}". Use ${Object.keys(formats).join(', ')}.`);
  process.exit(1);
}
const format = formats[outputType as keyof typeof formats];

const scriptDir = new URL('.', import.meta.url).pathname;
fs.writeFileSync(scriptDir + format.file, format.render());
console.log(`Wrote ${rows.length} guides to ${format.file}`);
