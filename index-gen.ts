/**
 * Generates an index for guides or skills in JSON, Markdown, or CSV format.
 * Uses `gh` CLI for GitHub issue data (no GITHUB_TOKEN needed).
 *
 * Usage:
 *   node index-gen.ts [guides|skills] [--type=json,md,csv]
 *
 * With no positional arg, generates both guides and skills.
 * Defaults to json+md output. Output files go to the source directory.
 *
 * Requires gh CLI installed and authenticated.
 * To add a new source or output format, edit the `sources` or `formats`
 * registries near the top of this file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';

const execFile = promisify(execFileCb);
import matter from 'gray-matter';
import { scanAllGuides, processGuideInventory, classifyGuide, type GuideStatus } from './lib/guide-validation.ts';
import { rootDir, guidesDir } from './lib/paths.ts';

// --- Constants ---

const REPO = 'GoogleChrome/guidance';

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365.25 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
];

// --- Types ---

interface Issue {
  number: number;
  title: string;
  body?: string;
  state: string;
}

type GitInfo = { lastUpdated: string | null; lastAuthor: string | null };
const nullGitInfo: GitInfo = { lastUpdated: null, lastAuthor: null };

interface Skill {
  dir: string;
  source: string;
  relativePath: string;
  name: string;
  description: string;
  license: string | null;
}

interface IssueMeta {
  issueNumber: number | null;
  issueOpen: boolean | null;
}

/** Row fields every source shares. Enables column definitions that work across sources. */
interface BaseRow extends GitInfo, IssueMeta {
  path: string;     // short display path (directory name)
  pathUrl: string;  // clickable URL for the path cell (repo-tree or file link)
}

interface GuideRow extends BaseRow {
  name: string;
  category: string | null;
  description: string;
  featureIds: string[];
  status: GuideStatus;
  has: string[];
}

interface SkillRow extends BaseRow {
  name: string;
  source: string;
  description: string;
  license: string | null;
}

type Column<R> = {
  heading?: string;
  /** Maps a scalar value to a URL. Applied per-element for arrays. MD only. */
  link?: (v: string) => string;
  /** Custom MD display. Function overrides default rendering. Set to false to hide column in MD. */
  md?: ((r: R) => string | null) | false;
};

interface Source<R> {
  dir: string;
  title: string;
  rows: R[];
  columns: Record<string, Column<R>>;
}

/** Per-source configuration. Everything the dispatcher needs lives here — no literal data in builder bodies. */
interface SourceConfig<R extends BaseRow> {
  dir: string;
  title: string;
  /** GitHub label used to find issues for this source. */
  issueLabel: string;
  /** Comparator applied to rows before rendering. */
  sort: (a: R, b: R) => number;
  columns: Record<string, Column<R>>;
  /** Produce the raw rows. Sort + render happen in the dispatcher. */
  build: () => Promise<R[]>;
}

type Format = {
  ext: string;
  render: (source: Source<any>) => string;
};

// =================================================================
// Registries — edit these to add a new source or output format.
// Implementations are below; function declarations are hoisted.
// =================================================================

/** Registered output formats. */
const formats: Record<string, Format> = {
  json: {
    ext: 'json',
    render: ({ rows }) => JSON.stringify(rows, null, '\t') + '\n',
  },
  md: {
    ext: 'md',
    render ({ rows, columns, title }) {
      const keys: string[] = [];
      for (const k in columns) {
        if (columns[k].md !== false) keys.push(k);
      }
      const headings = keys.map(k => columns[k].heading ?? k);
      const separator = ', ';
      const empty = '—';

      const headerRow = '| ' + headings.join(' | ') + ' |';
      const separatorRow = '| ' + keys.map(() => '-----').join(' | ') + ' |';
      const lines: string[] = [
        `# ${title}`,
        '',
        `> Generated on ${new Date().toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' })} — ${rows.length} entries.`,
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
      const keys: string[] = [];
      for (const k in columns) keys.push(k);
      const headings = keys.map(k => columns[k].heading ?? k);
      const separator = ', ';
      const escape = (s: string) =>
        (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
          ? `"${s.replace(/"/g, '""')}"`
          : s;

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

// --- Shared column pieces (referenced by per-source configs) ---

// Fetched once at module load; referenced by shared column definitions.
const authorMap = await buildAuthorMap();

/**
 * Column definitions shared across every source. Each source picks columns
 * from here by key so rendering, headings, and MD/CSV behavior live in one
 * place — fixes propagate to every index automatically.
 */
const sharedColumns: Record<string, Column<BaseRow>> = {
  path: {
    heading: 'Path',
    md: r => `[\`${r.path}\`](${r.pathUrl})`,
  },
  lastUpdated: {
    heading: 'Updated',
    md: r => r.lastUpdated ? formatRelative(r.lastUpdated) : null,
  },
  lastAuthor: {
    heading: 'Author',
    md: r => {
      if (!r.lastAuthor) return null;
      const user = authorMap.get(r.lastAuthor);
      return user ? `[${r.lastAuthor}](https://github.com/${user})` : r.lastAuthor;
    },
  },
  issueNumber: {
    heading: 'Issue',
    md: r => {
      const link = issueLink(r.issueNumber);
      if (!link) return null;
      return `${issueEmoji[r.issueOpen ? 'open' : 'closed']} ${link}`;
    },
  },
  issueOpen: { heading: 'Issue Open', md: false },
};

const statusEmoji: Record<GuideStatus, string> = {
  'eval-ready': '🟢',
  'needs-test': '🟠',
  'needs-calibration': '🟠',
  'needs-expectations': '🟠',
  'stub': '🟠',
  'incomplete': '🔴',
};

const issueEmoji = {
  open: '🟢',
  closed: '🟣',
};

/** Shared comparator: newest commit first; nulls at the end. */
const byLastUpdatedDesc = (a: BaseRow, b: BaseRow) =>
  (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? '');

/** Registered sources. Each entry is fully self-contained. */
const sources: Record<string, SourceConfig<any>> = {
  guides: ({
    dir: 'guides',
    title: 'Guide Index',
    issueLabel: 'new-use-case',
    sort: byLastUpdatedDesc,
    columns: Object.assign(Object.create(sharedColumns), {
      name: { md: false },
      category: {
        md: r => r.category ? `[${r.category}](https://github.com/${REPO}/tree/main/guides/${r.category})` : null,
      },
      description: {},
      featureIds: {
        heading: 'Feature IDs',
        link: v => `https://webstatus.dev/features/${v}`,
      },
      status: {
        md: r => `${statusEmoji[r.status] ?? ''} ${r.status}`,
      },
      has: {},
    } satisfies Record<string, Column<GuideRow>>),
    build: buildGuideRows,
  } satisfies SourceConfig<GuideRow>),

  skills: ({
    dir: 'skills-drafts',
    title: 'Skill Index',
    issueLabel: 'new-skill',
    sort: byLastUpdatedDesc,
    columns: Object.assign(Object.create(sharedColumns), {
      name: {},
      source: {},
      description: {},
      license: {},
    } satisfies Record<string, Column<SkillRow>>),
    build: buildSkillRows,
  } satisfies SourceConfig<SkillRow>),
};

// --- Row builders ---

/** Produce the guides rows. */
async function buildGuideRows (): Promise<GuideRow[]> {
  // Start async work early so it runs during sync scanning
  const issuesPromise = fetchIssues(sources.guides.issueLabel);

  // Suppress the "dry run" log from sync-use-cases importing its env setup.
  // .finally guarantees console.log is restored even if the import throws.
  const origLog = console.log;
  console.log = () => {};
  const { buildUseCaseMaps } = await import('./guides/sync-use-cases.ts')
    .finally(() => { console.log = origLog; });

  const guides = scanAllGuides();
  const { preparedGuides } = processGuideInventory(guides);
  const inventoryByName = new Map(guides.map(g => [g.name, g]));

  // Await remaining async work in parallel
  const [allUseCases, gitInfoMap] = await Promise.all([
    issuesPromise,
    batchGitInfo(preparedGuides.map(g => g.relativeSubdir)),
  ]);

  const { nameToIssueMap, subdirToIssueMap } = buildUseCaseMaps(allUseCases);

  return preparedGuides.map(g => {
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

    const path = g.relativeSubdir.replace(/^guides\//, '');
    return {
      path,
      pathUrl: `https://github.com/${REPO}/tree/main/guides/${path}`,
      name: g.name,
      category: inv?.category ?? null,
      description: g.description,
      featureIds: g.featureIds,
      status: inv ? classifyGuide(inv) : 'incomplete',
      has,
      ...(gitInfoMap.get(g.relativeSubdir) ?? nullGitInfo),
      issueNumber: issue?.number ?? null,
      issueOpen: issue ? issue.state === 'OPEN' : null,
    };
  });
}

/** Produce the skills rows. */
async function buildSkillRows (): Promise<SkillRow[]> {
  // Start async work early so it runs during sync scanning
  const issuesPromise = fetchIssues(sources.skills.issueLabel);

  const skills = [
    ...scanSkillsIn(guidesDir, 'guides'),
    ...scanSkillsIn(path.join(rootDir, 'skills-drafts'), 'skills-drafts'),
  ];

  // Await remaining async work in parallel
  const [allIssues, gitInfoMap] = await Promise.all([
    issuesPromise,
    batchGitInfo(skills.map(s => s.relativePath)),
  ]);

  // Build issue lookup: extract directory name from body URLs
  const dirToIssue = new Map<string, Issue>();
  for (const issue of allIssues) {
    const urlMatch = issue.body?.match(/(?:skills-drafts|guides)\/([^\s\/)]+)/);
    if (urlMatch) {
      dirToIssue.set(urlMatch[1], issue);
    }
  }

  return skills.map(s => {
    const issue = dirToIssue.get(s.dir);
    return {
      path: s.dir,
      pathUrl: `https://github.com/${REPO}/blob/main/${s.source}/${s.dir}/SKILL.md`,
      name: s.name,
      source: s.source,
      description: s.description,
      license: s.license,
      ...(gitInfoMap.get(s.relativePath) ?? nullGitInfo),
      issueNumber: issue?.number ?? null,
      issueOpen: issue ? issue.state === 'OPEN' : null,
    };
  });
}

/** Scan a directory for SKILL.md files and parse their frontmatter. */
function scanSkillsIn (dir: string, source: string): Skill[] {
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

// --- Shared helpers ---

/** Fetch GitHub issues by label, returning all matches. */
async function fetchIssues (label: string): Promise<Issue[]> {
  const { stdout } = await execFile('gh', [
    'issue', 'list',
    '-R', REPO,
    '-l', label,
    '--state', 'all',
    '--json', 'number,title,body,state',
    '-L', '10000',
  ], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/**
 * Batch-fetch last commit date and author for multiple directory paths.
 * Runs a single `git log --name-only` and walks parent directories of each
 * changed file to find a tracked path. Since git log outputs newest-first,
 * the first match wins.
 */
async function batchGitInfo (paths: string[]): Promise<Map<string, GitInfo>> {
  const info = new Map(paths.map(p => [p, { ...nullGitInfo }]));
  if (paths.length === 0) return info;
  let remaining = paths.length;

  try {
    const { stdout: log } = await execFile(
      'git',
      ['log', '--format=COMMIT%x09%aI%x09%aN', '--name-only', '--', ...paths],
      { cwd: rootDir, maxBuffer: 50 * 1024 * 1024 },
    );

    let date: string | null = null;
    let author: string | null = null;

    for (const line of log.split('\n')) {
      if (remaining === 0) break;

      if (line.startsWith('COMMIT\t')) {
        const [, d, a] = line.split('\t');
        date = d ?? null;
        author = a ?? null;
      }
      else if (line && date) {
        // Walk up parent directories — O(depth) per line vs O(paths).
        let dir: string | null = line;
        while (dir) {
          const entry = info.get(dir);
          if (entry && !entry.lastUpdated) {
            entry.lastUpdated = date;
            entry.lastAuthor = author;
            remaining--;
            break;
          }
          const slash = dir.lastIndexOf('/');
          dir = slash === -1 ? null : dir.slice(0, slash);
        }
      }
    }
  }
  catch (e) {
    console.warn('batchGitInfo failed:', (e as Error).message);
  }

  return info;
}

/** Extract a GitHub username from a noreply email, or return null. */
function githubUser (email: string): string | null {
  const m = email.match(/^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/);
  return m?.[1] ?? null;
}

/**
 * Build a map from author name → GitHub username.
 * First pass: extract from noreply emails in git history.
 * Second pass: resolve remaining authors via GitHub commits API.
 */
async function buildAuthorMap (): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unresolvedEmails = new Map<string, string>(); // name → email

  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--all', '--format=%aN%x09%aE'],
      { cwd: rootDir, maxBuffer: 50 * 1024 * 1024 },
    );
    for (const line of stdout.split('\n')) {
      const [name, email] = line.split('\t');
      if (!name || !email) continue;
      if (map.has(name)) continue;
      const user = githubUser(email);
      if (user) {
        map.set(name, user);
      }
      else if (!unresolvedEmails.has(name)) {
        unresolvedEmails.set(name, email);
      }
    }
  }
  catch (e) {
    console.warn('buildAuthorMap git log failed:', (e as Error).message);
  }

  // Resolve remaining authors via GitHub API (one call per unique email)
  const lookups = [...unresolvedEmails].map(async ([name, email]) => {
    try {
      const { stdout } = await execFile('gh', [
        'api',
        `/repos/${REPO}/commits?per_page=1&author=${encodeURIComponent(email)}`,
        '--jq', '.[0].author.login',
      ]);
      const login = stdout.trim();
      if (login) map.set(name, login);
    }
    catch { /* skip — author stays unlinked */ }
  });
  await Promise.all(lookups);

  return map;
}

/** Markdown link helper for issue numbers. */
function issueLink (issueNumber: number | null): string | null {
  return issueNumber ? `[#${issueNumber}](https://github.com/${REPO}/issues/${issueNumber})` : null;
}

/** Serialize a raw value to a plain string. */
function serialize (v: unknown, separator: string): string {
  if (Array.isArray(v)) {
    return v.join(separator);
  }
  return v == null ? '' : String(v);
}

/** Format an ISO date string as a relative time (e.g. "2 days ago"). */
function formatRelative (iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  for (const [unit, d] of RELATIVE_TIME_UNITS) {
    const value = Math.trunc(ms / d);
    if (Math.abs(value) >= 1) return RELATIVE_TIME_FORMAT.format(value, unit);
  }
  return RELATIVE_TIME_FORMAT.format(0, 'second');
}

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
  return serialize(raw, separator).replaceAll('<', '&lt;');
}

// --- Main ---

const { values, positionals } = parseArgs({
  options: { type: { type: 'string', default: 'json,md' } },
  strict: false,
  allowPositionals: true,
});
const sourceNames = positionals.length > 0 ? positionals : Object.keys(sources);
const outputTypes = (values.type as string).split(',').map(s => s.trim());

for (const name of sourceNames) {
  if (!(name in sources)) {
    console.error(`Unknown source "${name}". Use ${Object.keys(sources).join(', ')}.`);
    process.exit(1);
  }
}

for (const t of outputTypes) {
  if (!(t in formats)) {
    console.error(`Unknown type "${t}". Use ${Object.keys(formats).join(', ')}.`);
    process.exit(1);
  }
}

// Build all sources in parallel
console.log(`Building ${sourceNames.join(', ')}…`);
const t0 = performance.now();
const built = await Promise.all(
  sourceNames.map(async name => {
    const s = sources[name];
    const rows = await s.build();
    rows.sort(s.sort);
    return { name, s, rows };
  }),
);
const totalMs = performance.now() - t0;

for (const { name, s, rows } of built) {
  console.log(`  ${name}: ${rows.length} entries`);
  const source: Source<any> = { dir: s.dir, title: s.title, columns: s.columns, rows };
  for (const t of outputTypes) {
    const format = formats[t];
    const file = `index.${format.ext}`;
    const outPath = path.join(rootDir, s.dir, file);
    fs.writeFileSync(outPath, format.render(source));
    console.log(`    → ${s.dir}/${file}`);
  }
}
console.log(`Done in ${(totalMs / 1000).toFixed(1)}s`);
