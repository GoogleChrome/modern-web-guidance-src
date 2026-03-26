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
 *   # Use the deep research model for a more thorough turn 1 (takes 10-60 minutes):
 *   gd research --issue 359 --deep-research
 *
 *   # Resume a timed-out deep research interaction:
 *   gd research --issue 359 --resume <interaction-id>
 *
 * Required environment variable (add to .env):
 *   GEMINI_API_KEY
 */

import { parseArgs } from 'util';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { getFeatureInfo, validateFeature } from '../serving/mcp-server/data/baseline.ts';
import { scanAllGuides } from '../harness/lib/utils.ts';
import type { Content, GenerateContentResponse } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// GitHub issue parsing
// ---------------------------------------------------------------------------

function fetchIssue(issueNumber: string): { title: string; body: string } {
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
  return { title, body };
}

// ---------------------------------------------------------------------------
// Gemini API client
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-pro-latest';
const GEMINI_MODEL_DEEP_RESEARCH = 'deep-research-pro-preview-12-2025';
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

async function generate(
  apiKey: string,
  history: Content[],
  newUserText: string,
  model = GEMINI_MODEL
): Promise<{ text: string; sources: string[]; updatedHistory: Content[] }> {
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const contents: Content[] = [...history, { role: 'user', parts: [{ text: newUserText }] }];

  const body = {
    contents,
    tools: [{ google_search: {} }, { url_context: {} }],
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

  const data = (await res.json()) as GenerateContentResponse;
  const candidate = data.candidates?.[0];

  const text = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) {
    throw new Error(`Empty response from Gemini.\n${JSON.stringify(data, null, 2)}`);
  }

  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((uri): uri is string => !!uri);

  // Resolve redirect URLs to their final destinations.
  const resolvedSources = await Promise.all(
    sources.map(async (uri) => {
      try {
        const r = await fetch(uri, { method: 'HEAD', redirect: 'follow' });
        return r.url;
      } catch {
        return uri; // fall back to redirect URL if resolution fails
      }
    })
  );

  const updatedHistory: Content[] = [
    ...contents,
    { role: 'model', parts: [{ text }] },
  ];

  return { text, sources: resolvedSources, updatedHistory };
}

async function generateDeepResearch(
  apiKey: string,
  history: Content[],
  newUserText: string,
  resumeId?: string
): Promise<{ text: string; sources: string[]; updatedHistory: Content[] }> {
  const url = `${GEMINI_BASE}/interactions`;

  let id: string;
  if (resumeId) {
    id = resumeId;
    console.log(`  Resuming interaction ${id} — polling for completion…`);
  } else {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        agent: GEMINI_MODEL_DEEP_RESEARCH,
        input: newUserText,
        background: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini Interactions API error: ${res.status} ${res.statusText}\n${errText}`);
    }

    ({ id } = (await res.json()) as { id: string });
    console.log(`  Interaction ID: ${id} — polling for completion…`);
  }

  // Poll until the interaction completes (max 60 minutes).
  const POLL_INTERVAL_MS = 15_000;
  const MAX_WAIT_MS = 60 * 60 * 1000;
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${url}/${id}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!pollRes.ok) {
      const errText = await pollRes.text().catch(() => '');
      throw new Error(`Polling error: ${pollRes.status} ${pollRes.statusText}\n${errText}`);
    }

    const interaction = (await pollRes.json()) as {
      status: string;
      outputs?: Array<{ text?: string }>;
    };

    const status = interaction.status.toLowerCase();
    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Deep research interaction ${status}.`);
    }

    const elapsedMin = ((Date.now() - start) / 60_000).toFixed(1);
    if (status === 'completed') {
      console.log(`\n  Completed in ${elapsedMin}m`);
      const text = (interaction.outputs ?? []).map((o) => o.text ?? '').join('');
      if (!text) throw new Error('Deep research returned empty output.');

      const updatedHistory: Content[] = [
        ...history,
        { role: 'user', parts: [{ text: newUserText }] },
        { role: 'model', parts: [{ text }] },
      ];
      return { text, sources: [], updatedHistory };
    }

    process.stdout.write(`\r  Still running… ${elapsedMin}m elapsed`);
  }

  throw new Error('Deep research timed out after 60 minutes.');
}

// ---------------------------------------------------------------------------
// Prompt templates (following SKILL.md conventions)
// ---------------------------------------------------------------------------

function buildResearchPrompt(
  featureId: string,
  info: ReturnType<typeof getFeatureInfo>,
  seedUrls: string[],
  issueContext?: { title: string; body: string }
): string {
  const lines: string[] = [];

  if (issueContext) {
    lines.push(
      'Thoroughly research the web platform feature described in the following GitHub issue.',
      '',
      '## Issue title',
      issueContext.title,
      '',
      '## Issue body',
      issueContext.body,
    );
  } else {
    lines.push(`Thoroughly research the \`${featureId}\` web platform feature.`);

    // Seed the model with everything we already know from web-features so it has
    // accurate framing before hitting the web.
    lines.push('', '## Known metadata');
    lines.push(`- **Name**: ${info!.name}`);
    if (info!.description) lines.push(`- **Description**: ${info!.description}`);
    if (info!.groups?.length) lines.push(`- **Groups**: ${info!.groups.join(', ')}`);
    lines.push(`- **Baseline status**: ${info!.baselineStatus}`);
    if (info!.spec?.length) {
      lines.push('- **Spec URL(s)**:');
      for (const s of info!.spec) lines.push(`  - ${s}`);
    }
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
    if (issueContext) {
      lines.push(
        '',
        'The following URLs were provided in the GitHub issue but have not been vetted.',
        'Use only those that are genuinely relevant to the feature:',
      );
    } else {
      lines.push('', 'Seed sources to include:');
    }
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
    featureId
      ? `Based on your research, identify 2-5 distinct developer use cases for the \`${featureId}\` feature.`
      : `Based on your research, identify 2-5 distinct developer use cases for the feature you just researched.`,
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
    '## Sources',
    '',
    'For each use case, include at least one implementation-focused source that explains',
    'how to build something using the feature. Prefer Chrome-authored guidance first',
    '(developer.chrome.com, web.dev), then other implementation articles (CSS-Tricks, etc.).',
    'MDN reference pages alone are not sufficient — they describe the API but not how to apply it.',
    '',
    '## Output format',
    '',
    'Respond with ONLY a JSON object, no prose or markdown fences:',
    '{',
    '  "featureId": "web-features-id-for-this-feature",',
    '  "category": "chosen-category",',
    '  "useCases": [',
    '    {',
    '      "slug": "kebab-case-name",',
    '      "description": "Single-sentence, verb-first, WHAT-not-HOW description.",',
    '      "sources": ["https://implementation-focused-article", "https://mdn-reference-if-needed"]',
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
  featureId: string;
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

  if (typeof obj.featureId !== 'string' || !obj.featureId) {
    throw new Error(`Missing "featureId" in response.\nRaw text:\n${raw}`);
  }
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

  return { featureId: obj.featureId, category: obj.category, useCases };
}

// ---------------------------------------------------------------------------
// Guide stub creation
// ---------------------------------------------------------------------------

function collectExistingDescriptions(): string[] {
  return scanAllGuides(path.join(rootDir, 'guides'))
    .map((g) => {
      const guidePath = path.join(g.dir, 'guide.md');
      if (!fs.existsSync(guidePath)) return undefined;
      return matter(fs.readFileSync(guidePath, 'utf8')).data.description as string | undefined;
    })
    .filter((d): d is string => !!d);
}

function getAvailableCategories(): string[] {
  return [...new Set(scanAllGuides(path.join(rootDir, 'guides')).map((g) => g.category))];
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
    `Respond with ONLY the raw HTML file contents. Do NOT wrap it in a markdown code block.`,
    `The response must start with \`<!DOCTYPE html>\` or \`<html\`.`,
  ].join('\n');
}

function createGuideStub(featureId: string, uc: UseCase, category: string, allSeedUrls: string[], dryRun: boolean): void {
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

export async function main(args: string[] = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      issue: { type: 'string' },
      'feature-id': { type: 'string' },
      sources: { type: 'string', multiple: true },
      category: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'no-deep-research': { type: 'boolean', default: false },
      resume: { type: 'string' },
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
  --issue          GitHub issue number (feature ID and sources extracted from the issue body)
  --feature-id     Web feature ID from the web-features package (e.g. fetchlater)
  --sources        One or more seed source URLs
  --category       Guide category: performance, user-experience, accessibility, security
                   (auto-detected from existing guides if omitted)
  --dry-run           Print proposed stubs without writing any files
  --no-deep-research  Use the standard model for turn 1 (faster, less thorough)
  --resume <id>       Resume a previous deep research interaction by ID (skips turn 1)
  --verbose        Print the full research summary from turn 1
  --help           Show this help

Environment variables (set in .env):
  GEMINI_API_KEY  (required)
  GEMINI_MODEL    Override the model (default: gemini-pro-latest)
`);
    process.exit(values.help ? 0 : 1);
  }

  const dryRun = values['dry-run']!;
  const deepResearch = !values['no-deep-research'] || !!values.resume;
  const resumeId = values.resume;
  const verbose = values['verbose']!;
  const categoryArg = values.category;

  // ── Resolve inputs (from --issue or explicit flags) ──────────────────────
  let featureId: string;
  let seedSources: string[];
  let issueContext: { title: string; body: string } | null = null;

  if (values.issue) {
    issueContext = fetchIssue(values.issue);
    featureId = ''; // will be set from model response after turn 2
    seedSources = values.sources ?? [];
  } else {
    if (!values['feature-id']) {
      console.error('Error: --feature-id is required when not using --issue.');
      process.exit(1);
    }
    featureId = values['feature-id']!;
    seedSources = values.sources ?? [];
  }

  if (!seedSources.length && !issueContext) {
    console.warn('Warning: no seed sources provided. The model will rely entirely on web search.');
  }

  // Validate and load feature metadata up front so we fail fast on bad IDs.
  // Skipped in --issue mode since the feature ID is resolved by the model.
  let featureInfo: ReturnType<typeof getFeatureInfo> = undefined;
  if (!issueContext) {
    const featureValidation = validateFeature(featureId);
    if (!featureValidation.isValid) {
      console.error(`Error: ${featureValidation.errorMessage}`);
      if (featureValidation.suggestion) {
        console.error(`  Suggestion: use "${featureValidation.suggestion}" instead.`);
      }
      process.exit(1);
    }
    featureInfo = getFeatureInfo(featureId)!;
  }

  const apiKey = loadApiKey();

  console.log(`\nResearching use cases for: ${issueContext ? issueContext.title : featureId}`);
  if (seedSources.length) {
    console.log(`Seed sources (${seedSources.length}):`);
    for (const s of seedSources) console.log(`  ${s}`);
  }
  if (dryRun) console.log('\n⚠️  Dry-run mode: no files will be written.');

  let history: Content[] = [];

  // ── Turn 1: Research ──────────────────────────────────────────────────────
  console.log(`\n[1] Researching with Google Search grounding${deepResearch ? ' (deep research)' : ' (standard)'}…`);
  const researchPrompt = buildResearchPrompt(featureId, featureInfo, seedSources, issueContext ?? undefined);

  const { text: researchText, sources: researchSources, updatedHistory: h1 } = deepResearch
    ? await generateDeepResearch(apiKey, history, researchPrompt, resumeId)
    : await generate(apiKey, history, researchPrompt);
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
    if (issueContext) featureId = parsed.featureId;
    useCases = parsed.useCases;
    category = categoryArg ?? parsed.category;
  } catch (err) {
    console.error(`\nFailed to parse use cases: ${err}`);
    console.error('Raw response:\n', useCasesText);
    process.exit(1);
  }

  // Save research output for local reference (gitignored).
  {
    const researchDir = path.join(rootDir, 'guides', '.research');
    fs.mkdirSync(researchDir, { recursive: true });
    const researchPath = path.join(researchDir, `${featureId}.md`);
    const uniqueSources = [...new Set(researchSources)];
    const sourcesSection = uniqueSources.length
      ? `\n\n## Sources\n\n${uniqueSources.map((s) => `- ${s}`).join('\n')}`
      : '';
    fs.writeFileSync(researchPath, researchText + sourcesSection, 'utf8');
    console.log(`\n  Research saved to guides/.research/${featureId}.md`);
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
    createGuideStub(featureId, uc, category, seedSources, dryRun);

    if (dryRun) {
      console.log(`\n[dry-run] Would generate guides/${category}/${uc.slug}/demo.html`);
    } else {
      console.log(`    Generating demo.html for ${uc.slug}…`);
      const { text: rawDemo } = await generate(apiKey, history, buildDemoPrompt(featureId, uc));
      const demoHtml = rawDemo.replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
      const demoPath = path.join(rootDir, 'guides', category, uc.slug, 'demo.html');
      fs.writeFileSync(demoPath, demoHtml, 'utf8');
      console.log(`    Created: guides/${category}/${uc.slug}/demo.html`);
    }
  }

  if (!dryRun && useCases.length > 0) {
    console.log(`\n✅ Done. Review the stubs in guides/${category}/`);
    console.log('   Add expectations.md, then run: gd dev guides/<category>/<slug>');
  }
}

// Run directly (not imported)
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch((err) => {
    console.error('\nError:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
