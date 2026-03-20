/**
 * Research use cases for a web feature using the Gemini API with Google Search grounding.
 *
 * This script automates Stage 1 of the guide creation pipeline described in
 * .agents/skills/project-use-cases/SKILL.md. It sends two grounded prompts to
 * Gemini (research, then use-case extraction), collects authoritative sources
 * discovered by the model, and scaffolds a guide.md stub for each proposed use
 * case so the author can move straight to Stage 2.
 *
 * Usage:
 *   # From a GitHub issue (feature ID and sources extracted automatically):
 *   gd research --issue 359
 *
 *   # From explicit arguments:
 *   gd research --feature-id fetchlater \
 *     --sources https://developer.mozilla.org/en-US/docs/Web/API/Window/fetchLater \
 *               https://developer.chrome.com/blog/fetch-later-api-origin-trial
 *
 *   # Optional flags (work with both modes):
 *   gd research --issue 359 --category performance --dry-run
 *
 * Required environment variable (add to .env):
 *   GEMINI_API_KEY
 *
 * API reference:
 *   https://ai.google.dev/gemini-api/docs/google-search
 */

import { parseArgs } from 'util';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFeatureInfo, validateFeature } from '../serving/mcp-server/data/baseline.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    issue: { type: 'string' },
    'feature-id': { type: 'string' },
    sources: { type: 'string', multiple: true },
    category: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
});

if (values.help || (!values.issue && !values['feature-id'])) {
  console.log(`
Usage:
  gd research --issue <number>                          # pull feature ID + sources from GitHub
  gd research --feature-id <id> --sources <url> [...]  # explicit inputs

Options:
  --issue        GitHub issue number (feature ID and sources extracted from the issue body)
  --feature-id   Web feature ID from the web-features package (e.g. fetchlater)
  --sources      One or more seed source URLs
  --category     Guide category: performance, user-experience, accessibility, security
                 (auto-detected from existing guides if omitted)
  --dry-run      Print proposed stubs without writing any files
  --verbose      Print the full research summary from turn 1
  --help         Show this help

Required environment variable (set in .env):
  GEMINI_API_KEY
`);
  process.exit(values.help ? 0 : 1);
}

const dryRun = values['dry-run']!;
const verbose = values['verbose']!;
const categoryArg = values.category;

// ---------------------------------------------------------------------------
// GitHub issue parsing
// ---------------------------------------------------------------------------

interface IssueData {
  featureId: string;
  sources: string[];
}

function parseIssueBody(body: string): IssueData {
  // Extracts sections from the standard "Add <feature> guide" issue template.
  // Expected format:
  //   ### web-feature-id
  //   <id>
  //   ### Reference sources
  //   - https://...
  const featureIdMatch = body.match(/###\s*web-feature-id\s*\n+([^\n#]+)/);
  if (!featureIdMatch) {
    throw new Error('Could not find "web-feature-id" section in the issue body.');
  }
  const featureId = featureIdMatch[1].trim();

  const sourcesMatch = body.match(/###\s*Reference sources\s*\n([\s\S]*?)(?=###|$)/);
  const sources: string[] = [];
  if (sourcesMatch) {
    for (const line of sourcesMatch[1].split('\n')) {
      const url = line.replace(/^\s*-\s*/, '').trim();
      if (url.startsWith('http')) sources.push(url);
    }
  }

  return { featureId, sources };
}

function fetchIssue(issueNumber: string): IssueData {
  console.log(`Fetching issue #${issueNumber} from GitHub…`);
  let json: string;
  try {
    json = execSync(`gh issue view ${issueNumber} --json title,body`, { encoding: 'utf8' });
  } catch (err) {
    // Distinguish between "gh not installed" and other failures (auth, network, etc.)
    const isNotFound = err instanceof Error && err.message.includes('command not found');
    if (isNotFound) {
      console.error(
        'Error: the `gh` CLI is not installed or not on your PATH.\n' +
        '  Install it from https://cli.github.com, then re-run with --issue.\n' +
        '  Or skip --issue and pass the inputs directly:\n' +
        `    gd research --feature-id <id> --sources <url> [<url> ...]`
      );
    } else {
      console.error(
        `Error: failed to fetch issue #${issueNumber}.\n` +
        '  Make sure `gh` is authenticated (run: gh auth login) and the issue exists.\n' +
        '  Or pass the inputs directly instead:\n' +
        `    gd research --feature-id <id> --sources <url> [<url> ...]\n` +
        `\n  Details: ${err}`
      );
    }
    process.exit(1);
  }
  const { title, body } = JSON.parse(json) as { title: string; body: string };
  console.log(`  Issue: ${title}`);
  return parseIssueBody(body);
}

// ---------------------------------------------------------------------------
// Resolve inputs (from --issue or explicit flags)
// ---------------------------------------------------------------------------

let featureId: string;
let seedSources: string[];

if (values.issue) {
  const issueData = fetchIssue(values.issue);
  featureId = issueData.featureId;
  seedSources = issueData.sources;
  // Allow --sources to extend (not override) what came from the issue
  if (values.sources?.length) seedSources = [...new Set([...seedSources, ...values.sources])];
} else {
  if (!values['feature-id']) {
    console.error('Error: --feature-id is required when not using --issue.');
    process.exit(1);
  }
  featureId = values['feature-id']!;
  seedSources = values.sources ?? [];
}

if (!seedSources.length) {
  console.warn('Warning: no seed sources provided. The model will rely entirely on web search.');
}

// Validate and load feature metadata up front so we fail fast on bad IDs.
const featureValidation = validateFeature(featureId);
if (!featureValidation.isValid) {
  console.error(`Error: ${featureValidation.errorMessage}`);
  if (featureValidation.suggestion) {
    console.error(`  Suggestion: use "${featureValidation.suggestion}" instead.`);
  }
  process.exit(1);
}
const featureInfo = getFeatureInfo(featureId)!

// ---------------------------------------------------------------------------
// Gemini API client
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function loadApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error(
      'Error: GEMINI_API_KEY is not set.\n' +
      '  Get a free key at https://aistudio.google.com/apikey\n' +
      '  Then add it to .env as: GEMINI_API_KEY=<key>'
    );
    process.exit(1);
  }
  return key;
}

interface Part { text: string }
interface Content { role: 'user' | 'model'; parts: Part[] }

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Part[] };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: GroundingChunk[];
    };
  }>;
}

async function generate(
  apiKey: string,
  history: Content[],
  newUserText: string
): Promise<{ text: string; sources: string[]; updatedHistory: Content[] }> {
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const contents: Content[] = [...history, { role: 'user', parts: [{ text: newUserText }] }];

  const body = {
    contents,
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 1.0 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}\n${text}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];

  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) {
    throw new Error(`Empty response from Gemini.\n${JSON.stringify(data, null, 2)}`);
  }

  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((uri): uri is string => !!uri);

  const updatedHistory: Content[] = [
    ...contents,
    { role: 'model', parts: [{ text }] },
  ];

  return { text, sources, updatedHistory };
}

// ---------------------------------------------------------------------------
// Prompt templates (following SKILL.md conventions)
// ---------------------------------------------------------------------------

function buildResearchPrompt(
  featureId: string,
  info: ReturnType<typeof getFeatureInfo> & {},
  seedUrls: string[]
): string {
  const lines = [
    `Thoroughly research the \`${featureId}\` web platform feature.`,
  ];

  // Seed the model with everything we already know from web-features so it has
  // accurate framing before hitting the web.
  lines.push('', '## Known metadata');
  lines.push(`- **Name**: ${info.name}`);
  if (info.description) lines.push(`- **Description**: ${info.description}`);
  if (info.groups?.length) lines.push(`- **Groups**: ${info.groups.join(', ')}`);
  lines.push(`- **Baseline status**: ${info.baselineStatus}`);
  if (info.spec?.length) {
    lines.push('- **Spec URL(s)**:');
    for (const s of info.spec) lines.push(`  - ${s}`);
  }

  lines.push(
    '',
    '## Task',
    'Use the above as a starting point and search for additional high-quality information',
    'from MDN, developer blogs, Chrome developer documentation, WICG proposals, and GitHub',
    'discussions. Focus on technical constraints, performance implications, browser',
    'compatibility, and real-world implementation challenges.',
  );

  if (seedUrls.length) {
    lines.push('', 'Seed sources to include:');
    for (const url of seedUrls) lines.push(`- ${url}`);
  }

  lines.push(
    '',
    'Summarise: what problems does this feature solve for developers, what are the most',
    'common real-world use cases, and what technical caveats should developers know about?'
  );
  return lines.join('\n');
}

const SKILL_PATH = path.join(
  rootDir,
  '.agents/skills/project-use-cases/SKILL.md'
);

// Extract the descriptive rule sections from the SKILL file, stopping before
// the procedural "Implementation and scaffolding" section which would confuse
// the model (it would try to create files/PRs instead of producing JSON).
function loadSkillRules(): string {
  const skill = fs.readFileSync(SKILL_PATH, 'utf8');
  const start = skill.indexOf('\n## Identifying action-oriented tasks\n');
  const end = skill.indexOf('\n## Implementation and scaffolding\n');
  if (start === -1 || end === -1) {
    throw new Error(
      'Could not find expected sections in SKILL.md. ' +
        'Check that "## Identifying action-oriented tasks" and ' +
        '"## Implementation and scaffolding" still exist.'
    );
  }
  return skill.slice(start + 1, end).trim();
}

function buildUseCasesPrompt(
  featureId: string,
  existingDescriptions: string[],
  categories: string[]
): string {
  const skillRules = loadSkillRules();

  const lines = [
    `Based on your research, identify 2-5 distinct developer use cases for the \`${featureId}\` feature.`,
    '',
    '## Quality rules',
    '',
    '<!-- The following rules are sourced verbatim from the project SKILL. -->',
    '',
    skillRules,
    '',
    '## Slug rules',
    '',
    // This rule lives in the Implementation section of the SKILL (procedural noise),
    // so we include just the constraint here rather than that whole section.
    '- Short kebab-case summary of the use case.',
    '- Do NOT start with action verbs: no "create-", "build-", "add-", "implement-".',
    '  Bad: "build-bfcache-diagnostics"  Good: "bfcache-diagnostics"',
  ];

  if (existingDescriptions.length > 0) {
    lines.push(
      '',
      '## Existing guides (do not duplicate)',
      '',
      'This guidance is served through a RAG system — overlapping descriptions cause',
      'confusion. Do not propose use cases substantially similar to any of these:',
      '',
      ...existingDescriptions.map((d) => `- ${d}`),
    );
  }

  lines.push(
    '',
    '## Category',
    '',
    `Choose the single most appropriate category for all of these use cases from this list: ${categories.join(', ')}.`,
    'All use cases for a feature share one category.',
    '',
    '## Output format',
    '',
    'Respond with ONLY a JSON object, no prose or markdown fences:',
    '{',
    '  "category": "chosen-category",',
    '  "useCases": [',
    '    {',
    '      "slug": "kebab-case-name",',
    '      "description": "Single-sentence, verb-first, WHAT-not-HOW description.",',
    '      "sources": ["https://url-that-informed-this-use-case"]',
    '    }',
    '  ]',
    '}',
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Use case types and parsing
// ---------------------------------------------------------------------------

interface UseCase {
  slug: string;
  description: string;
  sources: string[];
}

interface UseCaseResponse {
  category: string;
  useCases: UseCase[];
}

function parseUseCases(raw: string, availableCategories: string[]): UseCaseResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse use cases as JSON.\nRaw text:\n${raw}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Expected a JSON object with "category" and "useCases". Got:\n${raw}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.category !== 'string' || !obj.category) {
    throw new Error(`Missing "category" in response.\nRaw text:\n${raw}`);
  }
  if (!availableCategories.includes(obj.category)) {
    throw new Error(`Model chose unknown category "${obj.category}". Available: ${availableCategories.join(', ')}`);
  }
  if (!Array.isArray(obj.useCases)) {
    throw new Error(`Missing "useCases" array in response.\nRaw text:\n${raw}`);
  }

  const useCases = obj.useCases.map((item: unknown, i: number) => {
    if (typeof item !== 'object' || item === null) throw new Error(`Use case ${i} is not an object`);
    const uc = item as Record<string, unknown>;
    if (typeof uc.slug !== 'string' || !uc.slug) throw new Error(`Use case ${i} missing "slug"`);
    if (typeof uc.description !== 'string' || !uc.description) throw new Error(`Use case ${i} missing "description"`);
    const sources = Array.isArray(uc.sources)
      ? (uc.sources as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    return { slug: uc.slug, description: uc.description, sources };
  });

  return { category: obj.category, useCases };
}

// ---------------------------------------------------------------------------
// Guide stub creation
// ---------------------------------------------------------------------------

function collectExistingDescriptions(): string[] {
  const guidesDir = path.join(rootDir, 'guides');
  const descriptions: string[] = [];

  for (const cat of fs.readdirSync(guidesDir, { withFileTypes: true })) {
    if (!cat.isDirectory() || cat.name.startsWith('.')) continue;
    const catDir = path.join(guidesDir, cat.name);
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const guideMd = path.join(catDir, entry.name, 'guide.md');
      if (!fs.existsSync(guideMd)) continue;
      const content = fs.readFileSync(guideMd, 'utf8');
      const match = content.match(/^description:\s*(.+)$/m);
      if (match) descriptions.push(match[1].trim());
    }
  }

  return descriptions;
}

function getAvailableCategories(): string[] {
  const guidesDir = path.join(rootDir, 'guides');
  return fs
    .readdirSync(guidesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name);
}

function buildGuideMd(featureId: string, uc: UseCase, allSeedUrls: string[]): string {
  const uniqueSources = [...new Set([...uc.sources, ...allSeedUrls])];
  const sourcesYaml = uniqueSources.map((s) => `  - ${s}`).join('\n');
  return `---
name: ${uc.slug}
description: ${uc.description}
web-feature-ids:
  - ${featureId}
sources:
${sourcesYaml}
---
`;
}

function buildDemoPrompt(featureId: string, uc: UseCase): string {
  return [
    `Write a minimal, self-contained demo.html for the following web development use case:`,
    `"${uc.description}"`,
    ``,
    `The demo should use the \`${featureId}\` web platform feature as the solution.`,
    ``,
    `Requirements:`,
    `- A single HTML file with all scripts and styles inline (no external dependencies).`,
    `- Demonstrates the use case correctly and completely — this is a gold-standard reference implementation.`,
    `- Minimal: no unnecessary UI polish, placeholder text for any content, placeholder URLs for any subresources.`,
    `- Include a brief <!-- comment --> at the top explaining what the demo shows.`,
    ``,
    `Respond with ONLY the HTML file contents, no prose or markdown fences.`,
  ].join('\n');
}

function createGuideStub(featureId: string, uc: UseCase, category: string, allSeedUrls: string[]): void {
  const dir = path.join(rootDir, 'guides', category, uc.slug);
  const guidePath = path.join(dir, 'guide.md');

  if (fs.existsSync(dir)) {
    console.warn(`  Skipping: guides/${category}/${uc.slug} already exists`);
    return;
  }

  const content = buildGuideMd(featureId, uc, allSeedUrls);

  if (dryRun) {
    console.log(`\n[dry-run] Would create guides/${category}/${uc.slug}/guide.md:`);
    console.log(content);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(guidePath, content, 'utf8');
    console.log(`  Created: guides/${category}/${uc.slug}/guide.md`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = loadApiKey();

  console.log(`\nResearching use cases for: ${featureId}`);
  if (seedSources.length) {
    console.log(`Seed sources (${seedSources.length}):`);
    for (const s of seedSources) console.log(`  ${s}`);
  }
  if (dryRun) console.log('\n⚠️  Dry-run mode: no files will be written.');

  let history: Content[] = [];

  // ── Turn 1: Research ──────────────────────────────────────────────────────
  console.log('\n[1] Researching with Google Search grounding…');
  const researchPrompt = buildResearchPrompt(featureId, featureInfo, seedSources);

  const { text: researchText, updatedHistory: h1 } =
    await generate(apiKey, history, researchPrompt);
  history = h1;

  if (verbose) {
    console.log('\n--- Research summary ---');
    console.log(researchText);
    console.log('------------------------');
  }

  // ── Turn 2: Use case identification ──────────────────────────────────────
  console.log('\n[2] Identifying use cases…');
  const availableCategories = getAvailableCategories();
  const existingDescriptions = collectExistingDescriptions();
  const useCasesPrompt = buildUseCasesPrompt(featureId, existingDescriptions, availableCategories);

  const { text: useCasesText, updatedHistory: h2 } =
    await generate(apiKey, history, useCasesPrompt);
  history = h2;

  let useCases: UseCase[];
  let category: string;
  try {
    const parsed = parseUseCases(useCasesText, availableCategories);
    useCases = parsed.useCases;
    category = categoryArg ?? parsed.category;
  } catch (err) {
    console.error(`\nFailed to parse use cases: ${err}`);
    console.error('Raw response:\n', useCasesText);
    process.exit(1);
  }

  // Sources come from the model-generated JSON only (not grounding chunk URLs,
  // which are ephemeral vertexaisearch.cloud.google.com redirect URLs).
  console.log(`\nProposed ${useCases.length} use case(s) (category: ${category}):`);
  for (const uc of useCases) {
    console.log(`\n  slug:        ${uc.slug}`);
    console.log(`  description: ${uc.description}`);
    if (uc.sources.length) console.log(`  sources:     ${uc.sources.slice(0, 3).join(', ')}${uc.sources.length > 3 ? ` (+${uc.sources.length - 3} more)` : ''}`);
  }

  // ── Step 3: Scaffold guide.md + demo.html ────────────────────────────────
  console.log('\n[3] Scaffolding guide stubs…');
  console.log(`    Category: ${category}`);

  for (const uc of useCases) {
    createGuideStub(featureId, uc, category, seedSources);

    console.log(`    Generating demo.html for ${uc.slug}…`);
    const { text: demoHtml } = await generate(apiKey, history, buildDemoPrompt(featureId, uc));

    const demoPath = path.join(rootDir, 'guides', category, uc.slug, 'demo.html');
    if (dryRun) {
      console.log(`\n[dry-run] Would create guides/${category}/${uc.slug}/demo.html`);
    } else {
      fs.writeFileSync(demoPath, demoHtml, 'utf8');
      console.log(`    Created: guides/${category}/${uc.slug}/demo.html`);
    }
  }

  if (!dryRun && useCases.length > 0) {
    console.log(`\n✅ Done. Review the stubs in guides/${category}/`);
    console.log('   Add expectations.md, then run: gd dev guides/<category>/<slug>');
  }
}

main().catch((err) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
