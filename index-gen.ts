/**
 * Generates an index for guides or skills in JSON, Markdown, or CSV format.
 * Uses `gh` CLI for GitHub issue data (no GITHUB_TOKEN needed).
 *
 * Usage:
 *   node --experimental-strip-types index-gen.ts [guides|skills] [--type=json,md,csv]
 *
 * With no positional arg, generates both guides and skills.
 * Defaults to json+md output. Output files go to the source directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import matter from 'gray-matter';
import { scanAllGuides, processGuideInventory, classifyGuide } from './lib/guide-validation.ts';
import { rootDir, guidesDir } from './lib/paths.ts';

// --- Types ---

type Column<R> = {
  heading?: string;
  /** Maps a scalar value to a URL. Applied per-element for arrays. MD only. */
  link?: (v: string) => string;
  /** Custom MD display text. Overrides default rendering and link. */
  md?: (r: R) => string | null;
};

interface Source<R extends Record<string, unknown>> {
  dir: string;
  title: string;
  rows: R[];
  columns: Record<string, Column<R>>;
}

type Format = {
  ext: string;
  render: (source: Source<any>) => string;
};

// --- Shared helpers ---

/** Fetch GitHub issues by label, returning all matches. */
function fetchIssues (label: string): any[] {
  const json = execSync(
    `gh issue list -R GoogleChrome/guidance -l ${label} --state all --json number,title,body,state -L 10000`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(json);
}

/** Get last commit date and author for a path relative to the repo root. */
function gitInfo (relativePath: string): { lastUpdated: string | null; lastAuthor: string | null } {
  try {
    const logLine = execSync(`git log -1 --format=%aI%n%aN -- ${relativePath}`, {
      encoding: 'utf-8',
      cwd: rootDir,
    }).trim();
    const [date, author] = logLine.split('\n');
    return {
      lastUpdated: date ? date.slice(0, 10) : null,
      lastAuthor: author || null,
    };
  } catch {
    return { lastUpdated: null, lastAuthor: null };
  }
}

/** Markdown link helper for issue numbers. */
function issueLink (issueNumber: number | null): string | null {
  return issueNumber ? `[#${issueNumber}](https://github.com/GoogleChrome/guidance/issues/${issueNumber})` : null;
}

/** Serialize a raw value to a plain string. */
function serialize (v: unknown, separator: string): string {
  if (Array.isArray(v)) {
    return v.join(separator);
  }
  return v == null ? '' : String(v);
}

// --- Source builders ---

/** Build the guides index source. */
async function buildGuideSource (): Promise<Source<any>> {
  // Suppress the "dry run" log from sync-use-cases importing its env setup
  const origLog = console.log;
  console.log = () => {};
  const { buildUseCaseMaps } = await import('./guides/sync-use-cases.ts');
  console.log = origLog;

  const allUseCases = fetchIssues('new-use-case');
  const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(allUseCases);

  const guides = scanAllGuides();
  const { preparedGuides } = processGuideInventory(guides);
  const inventoryByName = new Map(guides.map(g => [g.name, g]));

  const rows = preparedGuides.map(g => {
    const issue = nameToIssueMap.get(g.name) || subdirToIssueMap.get(g.relativeSubdir);
    const inv = inventoryByName.get(g.name);

    const has: string[] = [];
    if (inv) {
      for (const [key, val] of Object.entries(inv)) {
        if (key.startsWith('has') && val === true) {
          has.push(key[3].toLowerCase() + key.slice(4));
        }
      }
    }

    return {
      guide: g.relativeSubdir.replace(/^guides\//, ''),
      name: g.name,
      category: inv?.category ?? null,
      description: g.description,
      featureIds: g.featureIds,
      status: inv ? classifyGuide(inv) : 'incomplete',
      has,
      ...gitInfo(g.relativeSubdir),
      issueNumber: issue?.number ?? null,
      issueOpen: issue ? issue.state === 'OPEN' : null,
    };
  });

  rows.sort((a, b) => a.guide.localeCompare(b.guide));

  const columns = {
    guide: {
      md: (r: any) => `[\`${r.guide}\`](https://github.com/GoogleChrome/guidance/tree/main/guides/${r.guide})`,
    },
    name: {},
    category: {},
    description: {},
    featureIds: {
      heading: 'Feature IDs',
      link: (v: string) => `https://webstatus.dev/features/${v}`,
    },
    status: {},
    has: {},
    lastUpdated: { heading: 'Updated' },
    lastAuthor: { heading: 'Author' },
    issueNumber: {
      heading: 'Issue',
      md: (r: any) => issueLink(r.issueNumber),
    },
    issueOpen: { heading: 'Issue Open' },
  };

  return { dir: 'guides', title: 'Guide Index', rows, columns };
}

/** Scan a directory for SKILL.md files and parse their frontmatter. */
function scanSkillsIn (dir: string, source: string): any[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .flatMap(d => {
      const skillPath = path.join(dir, d.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        return [];
      }
      const { data } = matter(fs.readFileSync(skillPath, 'utf-8'));
      const relativePath = path.relative(rootDir, path.join(dir, d.name));
      return [{
        dir: d.name,
        source,
        relativePath,
        name: data.name ?? d.name,
        description: data.description ?? '',
        license: data.license ?? null,
      }];
    });
}

/** Build the skills index source. */
function buildSkillSource (): Source<any> {
  const allIssues = fetchIssues('new-skill');

  // Build issue lookup: extract directory name from body URLs or match by title
  const dirToIssue = new Map<string, any>();
  for (const issue of allIssues) {
    const urlMatch = issue.body?.match(/(?:skills-drafts|guides)\/([^\s\/)]+)/);
    if (urlMatch) {
      dirToIssue.set(urlMatch[1], issue);
    }
  }

  const skills = [
    ...scanSkillsIn(guidesDir, 'guides'),
    ...scanSkillsIn(path.join(rootDir, 'skills-drafts'), 'skills-drafts'),
  ];

  const rows = skills.map(s => {
    const issue = dirToIssue.get(s.dir);
    return {
      skill: s.dir,
      name: s.name,
      source: s.source,
      description: s.description,
      license: s.license,
      ...gitInfo(s.relativePath),
      issueNumber: issue?.number ?? null,
      issueOpen: issue ? issue.state === 'OPEN' : null,
    };
  });

  rows.sort((a, b) => a.skill.localeCompare(b.skill));

  const columns = {
    skill: {
      md: (r: any) => `[\`${r.skill}\`](https://github.com/GoogleChrome/guidance/blob/main/${r.source}/${r.skill}/SKILL.md)`,
    },
    name: {},
    source: {},
    description: {},
    license: {},
    lastUpdated: { heading: 'Updated' },
    lastAuthor: { heading: 'Author' },
    issueNumber: {
      heading: 'Issue',
      md: (r: any) => issueLink(r.issueNumber),
    },
    issueOpen: { heading: 'Issue Open' },
  };

  return { dir: 'skills-drafts', title: 'Skill Index', rows, columns };
}

const sourceBuilders: Record<string, () => Source<any> | Promise<Source<any>>> = {
  guides: buildGuideSource,
  skills: buildSkillSource,
};

// --- Output formatters ---

/** Render a Markdown table cell. */
function mdCell (key: string, col: Column<any>, row: any, separator: string): string {
  if (col.md) {
    return col.md(row) ?? '';
  }
  const raw = row[key];
  if (col.link) {
    const items = Array.isArray(raw) ? raw : [raw];
    return items.filter(v => v != null && v !== '').map(v => `[${v}](${col.link!(String(v))})`).join(separator);
  }
  if (typeof raw === 'boolean') {
    return raw ? '✅' : '❌';
  }
  return serialize(raw, separator);
}

const formats: Record<string, Format> = {
  json: {
    ext: 'json',
    render: ({ rows }) => JSON.stringify(rows, null, '\t') + '\n',
  },
  md: {
    ext: 'md',
    render ({ rows, columns, title }) {
      const keys = Object.keys(columns);
      const headings = keys.map(k => columns[k].heading ?? k);
      const separator = ', ';
      const empty = '—';

      const headerRow = '| ' + headings.join(' | ') + ' |';
      const separatorRow = '| ' + keys.map(() => '-----').join(' | ') + ' |';
      const lines: string[] = [
        '<!-- This file is auto-generated by index-gen.ts. Do not edit manually. -->',
        '',
        `# ${title}`,
        '',
        `> Generated on ${new Date().toISOString().slice(0, 10)} — ${rows.length} entries.`,
        '',
        headerRow,
        separatorRow,
      ];
      for (const row of rows) {
        const cells = keys.map(k => {
          const v = mdCell(k, columns[k], row, separator);
          return v === '' ? empty : v;
        });
        lines.push('| ' + cells.join(' | ') + ' |');
      }
      lines.push('');
      return lines.join('\n');
    },
  },
  csv: {
    ext: 'csv',
    render ({ rows, columns }) {
      const keys = Object.keys(columns);
      const headings = keys.map(k => columns[k].heading ?? k);
      const separator = ', ';
      const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;

      const lines = [headings.join(',')];
      for (const row of rows) {
        const cells = keys.map(k => escape(serialize(row[k], separator)));
        lines.push(cells.join(','));
      }
      lines.push('');
      return lines.join('\n');
    },
  },
};

// --- Main ---

const { values, positionals } = parseArgs({
  options: { type: { type: 'string', default: 'json,md' } },
  strict: false,
  allowPositionals: true,
});
const sourceNames = positionals.length > 0 ? positionals : Object.keys(sourceBuilders);
const outputTypes = (values.type as string).split(',').map(s => s.trim());

for (const sourceName of sourceNames) {
  if (!(sourceName in sourceBuilders)) {
    console.error(`Unknown source "${sourceName}". Use ${Object.keys(sourceBuilders).join(', ')}.`);
    process.exit(1);
  }

  const source = await sourceBuilders[sourceName]();

  for (const t of outputTypes) {
    if (!(t in formats)) {
      console.error(`Unknown type "${t}". Use ${Object.keys(formats).join(', ')}.`);
      process.exit(1);
    }
    const format = formats[t];
    const file = `index.${format.ext}`;
    const outPath = path.join(rootDir, source.dir, file);
    fs.writeFileSync(outPath, format.render(source));
    console.log(`Wrote ${source.rows.length} ${sourceName} to ${source.dir}/${file}`);
  }
}
