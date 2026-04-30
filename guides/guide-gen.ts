/**
 * guide-gen.ts
 *
 * Generates use case stubs (guide.md and demo.html) for a web feature
 * by identifying 2-5 distinct use cases, following the Stage 1 guidelines.
 *
 * Usage:
 *   gd gen-guide <web-feature-id>
 *   node --experimental-strip-types guides/guide-gen.ts intl-duration-format
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { features } from 'web-features';
// Workaround for https://github.com/web-platform-dx/web-features/issues/1980
import type { FeatureData } from '../node_modules/web-features/types.quicktype.d.ts';
import type { Identifier } from '@mdn/browser-compat-data';
import bcd from '@mdn/browser-compat-data' with { type: 'json' };

import { guidesDir, rootDir } from '../lib/paths.ts';
import { runCommand, runGemini, setupIsolatedWorkDir } from './lib/utils.ts';
import {cleanupIsolatedHome} from '../harness/lib/agent-shared.ts';
import type { UseCase } from './ci-pipeline.ts';
import { handleGitAndPR } from './ci-pipeline.ts';

type FeatureDataPlusMDN = FeatureData & { id: string; name: string; mdnUrls: string[]; specUrls: string[] };


export function lookupFeature(featureId: string): FeatureDataPlusMDN {
  const feature = (features as Record<string, typeof features[string]>)[featureId];
  if (!feature || feature.kind !== 'feature') {
    throw new Error(`Feature "${featureId}" not found in web-features package.`);
  }
  const mdnUrls = getMdnUrlsForFeature(featureId);
  const specUrls = feature.spec || [];
  return {  ...feature, id: featureId,  mdnUrls, specUrls };
}

export function getSkillContent(skillName: string): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const skillPath = path.join(currentDir, '../.agents/skills', skillName, 'SKILL.md');
  try {
    let content = fs.readFileSync(skillPath, 'utf8');

    if (skillName === 'project-use-cases') {
      content = content.replace(
        /## Research and discovery[\s\S]*?## Identifying action-oriented tasks/,
        `## Research and discovery
In this automated pipeline, the research has already been conducted by a specialized model and saved to a file (e.g., \`features/<feature-id>/research.md\`). You must read that research report primarily to identify use cases, rather than attempting to run research tools yourself.

## Identifying action-oriented tasks`
      );
    }
    return content;
  } catch (err) {
    console.warn(`Warning: Could not read skill file at ${skillPath}`);
    return '';
  }
}

function buildUseCasesPrompt(feature: FeatureDataPlusMDN): string {
  const sourcesList = [
    ...feature.mdnUrls.map(u => `- MDN: ${u}`),
    ...feature.specUrls.map(u => `- Spec: ${u}`),
  ].join('\n')  || '(No source URLs available — use your knowledge of this feature)';

  const useCasesSkill = getSkillContent('project-use-cases');

  const researchPath = path.resolve('features', feature.id, 'research.md');
  let researchContent = '';
  if (fs.existsSync(researchPath)) {
    researchContent = fs.readFileSync(researchPath, 'utf8');
  }

  return `
You are researching the web platform feature "${feature.name}" (ID: ${feature.id}).
Your task is to identify 1-3 distinct developer use cases for this feature.

${researchContent ? `Here is the deep research report for this feature to read primarily:\n===\n${researchContent}\n===\n` : ''}

Follow the guidelines:

=== project-use-cases ===
${useCasesSkill}

Source URLs:
${sourcesList}

Output your response as a JSON array of objects, wrapped in a \`\`\`json block.
Each object must have:
- slug: short kebab-case name of the use case (do NOT prefix with action verbs like create-, build-, add-).
- description: A single short sentence describing the task.
- category: one of 'performance', 'accessibility', 'user-experience', 'security', or 'forms'.

IMPORTANT: If the feature is a low-level utility (like a new Promise method or a general object cloning function) that primarily acts as a drop-in replacement for legacy patterns, avoid forcing it into multiple outcome-oriented use cases. Instead, generate a single 'Fundamental Guide' (e.g., 'Deep cloning complex objects').

Example output:
[
  {
    "slug": "deprioritize-background-fetches",
    "description": "Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests.",
    "category": "performance"
  }
]
`.trim();
}

function buildExpectationsPrompt(feature: FeatureDataPlusMDN, useCase: { slug: string; description: string }): string {
  return `
You are generating structured expectations for the use case: "${useCase.description}".
This use case relies on the feature "${feature.name}" (ID: ${feature.id}).

Your task is to create an \`expectations.md\` file that defines how to verify a solution for this use case.

Follow this EXACT format with three sections:

\`\`\`markdown
## Must pass
- <assertion that a correct implementation must satisfy>
- <one assertion per bullet>

## Must fail
- <assertion that an incorrect implementation using a legacy/anti-pattern approach would violate>
- <focus on the most likely incorrect alternative to this feature>

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Advise against brittle regex-based DOM targeting. Encourage asserting specific class names or measurable outcomes for reliable testing.
\`\`\`

Output ONLY the raw markdown content, with no outer code blocks or other text.
`.trim();
}


function buildDemoPrompt(feature: FeatureDataPlusMDN, useCase: { slug: string; description: string }): string {

  return `
You are generating a minimal demo for the use case: "${useCase.description}".
This use case relies on the feature "${feature.name}" (ID: ${feature.id}).

Your task is to create a \`demo.html\` file that is a minimal, self-contained reference implementation of this use case.

Rules:
- Single HTML file with inline scripts and styles.
- Minimal and correct.
- Demonstrates the feature solving the problem described in the use case.
- Use placeholder content where needed.
- Encourage semantic HTML.
- Use specific class names for key elements to make them easily targetable by graders (e.g., use class names like \`.test-dialog-trigger\` or \`.test-target-element\` instead of generic tags).
- Ensure fallbacks are realistic and use proper feature detection if applicable.

Output ONLY the raw HTML content, with no markdown code blocks or other text.
`.trim();
}

function buildGuidePrompt(feature: FeatureDataPlusMDN, useCase: { slug: string; description: string }): string {
  const guideSkill = getSkillContent('project-guides');
  const researchPath = path.resolve('features', feature.id, 'research.md');
  let researchContent = '';
  if (fs.existsSync(researchPath)) {
    researchContent = fs.readFileSync(researchPath, 'utf8');
  }

  return `
You are generating a guide for the use case: "${useCase.description}".
This use case relies on the feature "${feature.name}" (ID: ${feature.id}).

${researchContent ? `Here is the deep research report for this feature to read primarily:\n===\n${researchContent}\n===\n` : ''}

Your task is to create the content for a \`guide.md\` file (starting from the H1 title).

Follow the guidelines in this skill file:

=== project-guides ===
${guideSkill}

Follow this structure:
1. An H1 title describing the goal.
2. An introductory paragraph.
3. A \`## How to implement\` section with H3 subheadings for specific advice.
4. A \`## Fallback strategies\` section describing what to do if the feature is not supported.

Output ONLY the raw markdown content, with no outer code blocks or other text. Do NOT include the YAML frontmatter, as that will be added automatically.

`.trim();
}



/** usecase ==> guide + expectations + demo */
async function scaffoldUseCase(uc: { slug: string; description: string; category: string }, feature: FeatureDataPlusMDN, guidesDir: string): Promise<string> {
  const workDir = setupIsolatedWorkDir('ghh-guide-gen');
  const outputDir = path.join(guidesDir, uc.category, uc.slug);
  console.log(`\nScaffolding ${uc.slug} in ${outputDir}...`);

  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // 1. Write guide.md with generated content
    const frontmatter = `---
name: ${uc.slug}
description: ${uc.description}
web-feature-ids:
  - ${feature.id}
sources:
${feature.mdnUrls.map(u => `  - ${u}`).join('\n')}
---

`;

    console.log(`Generating content for guide.md for ${uc.slug}...`);
    const guidePrompt = buildGuidePrompt(feature, uc);
    const guideContent = await runGemini(guidePrompt, workDir);

    const cleanGuideContent = extractCodeBlock(guideContent, 'markdown');

    fs.writeFileSync(path.join(outputDir, 'guide.md'), frontmatter + cleanGuideContent);
    console.log(`✅ Generated guide.md`);

    // 2. Generate demo.html
    console.log(`Generating demo.html for ${uc.slug}...`);
    const demoPrompt = buildDemoPrompt(feature, uc);
    const demoHtml = await runGemini(demoPrompt, workDir);

    const cleanHtml = extractCodeBlock(demoHtml, 'html');
    fs.writeFileSync(path.join(outputDir, 'demo.html'), cleanHtml);
    console.log(`✅ Generated demo.html`);

    // 3. Generate expectations.md
    console.log(`Generating expectations.md for ${uc.slug}...`);
    const expectationsPrompt = buildExpectationsPrompt(feature, uc);
    const expectationsMd = await runGemini(expectationsPrompt, workDir);

    const cleanExpectations = extractCodeBlock(expectationsMd, 'markdown');
    fs.writeFileSync(path.join(outputDir, 'expectations.md'), cleanExpectations);
    console.log(`✅ Generated expectations.md`);

  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }

  return outputDir;
}


function extractCodeBlock(text: string, lang?: string): string {
  const langPattern = lang ? lang + '\\s*' : '[a-z]*\\s*';
  const regex = new RegExp(`\`\`\`${langPattern}\\n([\\s\\S]*?)\\n\`\`\``, 'i');
  const match = text.match(regex);
  if (match) {
    return match[1].trim();
  }
  return text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
}

export function parseUseCasesResponse(response: string): UseCase[] {
  try {
    const jsonStr = extractCodeBlock(response, 'json');
    return JSON.parse(jsonStr);
  } catch (err) {
    // fallback if no code block or bad json
    try {
      const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      console.error(`Failed to parse JSON response. Raw response:\n${response}`);
      throw err;
    }
    console.error(`Failed to parse JSON response from Gemini. Raw response:\n${response}`);
    throw err;
  }
}

export interface PassRates {
  unguided: string;
  guided: string;
}

export function parsePassRates(output: string): PassRates | null {
  const unguidedMatch = output.match(/Unguided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/);
  const guidedMatch = output.match(/Guided:\s+\d+\/\d+\s+checks passed\s+\((\d+)%\)/);

  if (unguidedMatch && guidedMatch) {
    return { unguided: unguidedMatch[1], guided: guidedMatch[1] };
  }
  return null;
}

export async function generateUseCases(featureId: string, reviewer?: string): Promise<void> {

  console.log(`Looking up feature: ${featureId}`);
  const feature = lookupFeature(featureId);
  console.log(`Found: ${feature.name}`);

  const researchPath = path.resolve('features', featureId, 'research.md');
  if (!fs.existsSync(researchPath)) {
    console.log(`Research file not found at ${researchPath}. Invoking deep research...`);
    const scriptPath = path.join(rootDir, '.agents/skills/project-use-cases-research/scripts/deep_research.js');
    await runCommand('node', [scriptPath, '--feature-id', featureId]);
    console.log(`✅ Deep research completed and saved to ${researchPath}`);
  } else {
    console.log(`Found existing research file at ${researchPath}. Skipping deep research.`);
  }

  const workDir = setupIsolatedWorkDir('ghh-guide-gen');
  const prompt = buildUseCasesPrompt(feature);

  console.log(`Asking Gemini to identify use cases...`);
  const response = await runGemini(prompt, workDir);

  const useCases = parseUseCasesResponse(response);

  console.log(`\nIdentified ${useCases.length} use cases:`);
  for (const uc of useCases) {
    console.log(`- [${uc.category}] ${uc.slug}: ${uc.description}`);
  }

  cleanupIsolatedHome(path.dirname(workDir));

  const useCasePassRates: Record<string, PassRates> = {};

  const promises = useCases.map(async (uc) => {
    const outputDir = await scaffoldUseCase(uc, feature, guidesDir);
    const logFile = path.join(outputDir, 'dev.log');
    console.log(`[Usecase: ${uc.slug}] Running calibration and evaluation. Logs in ${logFile}`);

    const logStream = fs.createWriteStream(logFile);

    const child = spawn('node', ['--experimental-strip-types', 'guides/dev-guide.ts', outputDir], {
      cwd: rootDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdoutData = '';
    child.stdout.on('data', d => { stdoutData += d.toString(); });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.stdout.on('data', d => d.toString().split('\n').forEach((l: string) => l.trim() && console.log(`[${uc.slug}] ${l}`)));
    child.stderr.on('data', d => d.toString().split('\n').forEach((l: string) => l.trim() && console.error(`[${uc.slug}] ${l}`)));
    const exitCode = await new Promise<number>((resolve) => child.on('close', resolve));

    if (exitCode !== 0) {
      throw new Error(`devGuide failed for ${uc.slug}. See logs at ${logFile}`);
    }

    const passRates = parsePassRates(stdoutData);
    if (passRates) {
      useCasePassRates[uc.slug] = passRates;
    } else {
      console.warn(`⚠️ Could not parse pass rates for ${uc.slug}`);
    }
  });

  await Promise.all(promises);

  console.log(`\n🎉 All use cases scaffolded and processed!`);

  await handleGitAndPR(featureId, useCases, reviewer, useCasePassRates);
}

// Collect MDN urls from the BCD data.
const tagToUrls = new Map<string, string[]>();
function scanBcd(node: Identifier) {
  if (!node || typeof node !== 'object') return;
  const { mdn_url, tags } = node.__compat || {};
  if (mdn_url && tags) {
    for (const tag of tags) {
      if (tag.startsWith('web-features:')) {
        const id = tag.substring(13);
        const urls = tagToUrls.get(id) || [];
        if (!urls.includes(mdn_url)) tagToUrls.set(id, [...urls, mdn_url]);
      }
    }
  }
  for (const k in node) if (k !== '__compat') scanBcd(node[k]);
}

export function getMdnUrlsForFeature(featureId: string): string[] {
  if (tagToUrls.size === 0) {
    Object.values(bcd).forEach(scanBcd);
  }
  return tagToUrls.get(featureId) || [];
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {

  const args = process.argv.slice(2);
  const featureId = args.find(a => !a.startsWith('--'));

  if (!featureId) {
    console.error('Usage: gd gen-guide <web-feature-id>');
    process.exit(1);
  }

  generateUseCases(featureId).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
