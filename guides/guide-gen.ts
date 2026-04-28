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
type FeaturesType = typeof features;
type AllFeatureData = FeaturesType[string];
type FeatureData = Extract<AllFeatureData, { kind: 'feature' }>;

import bcd from '@mdn/browser-compat-data' with { type: 'json' };

import { guidesDir, rootDir } from '../lib/paths.ts';
import config from '../harness/config.ts';
import { runCommand, runGemini, setupIsolatedWorkDir } from './lib/utils.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
} from '../harness/lib/agent-shared.ts';
import { devGuide } from './dev-guide.ts';




// ─── Feature lookup ──────────────────────────────────────────────────────────

interface FeatureInfo {
  id: string;
  name: string;
  description: string;
  specUrls: string[];
  mdnUrls: string[];
}

interface UseCase {
  slug: string;
  description: string;
  category: string;
}

function lookupFeature(featureId: string): FeatureData {
  const feature = (features as Record<string, any>)[featureId];
  if (!feature || feature.kind !== 'feature') {
    throw new Error(`Feature "${featureId}" not found in web-features package.`);
  }
  return feature;
}

function getSkillContent(skillName: string): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const skillPath = path.join(currentDir, '../.agents/skills', skillName, 'SKILL.md');
  try {
    let content = fs.readFileSync(skillPath, 'utf8');

    if (skillName === 'project-use-cases') {
      // Replace human research steps with automated instructions
      content = content.replace(
        /## Research and discovery[\s\S]*?## Identifying action-oriented tasks/,
        `## Research and discovery
In this automated pipeline, the research has already been conducted by a specialized model and saved to a file (e.g., \`features/\<feature-id\>/research.md\`). You must read that research report primarily to identify use cases, rather than attempting to run research tools yourself.

## Identifying action-oriented tasks`
      );
    }
    return content;
  } catch (err) {
    console.warn(`Warning: Could not read skill file at ${skillPath}`);
    return '';
  }
}

// ─── Prompt construction ─────────────────────────────────────────────────────

function buildUseCasesPrompt(feature: FeatureInfo): string {

  const sourcesList = [
    ...feature.mdnUrls.map(u => `- MDN: ${u}`),
    ...feature.specUrls.map(u => `- Spec: ${u}`),
  ].join('\n');

  const useCasesSkill = getSkillContent('project-use-cases');
  const researchSkill = getSkillContent('project-use-cases-research');

  const researchPath = path.resolve('features', feature.id, 'research.md');
  let researchContent = '';
  if (fs.existsSync(researchPath)) {
    console.log(`Found research file at ${researchPath}. Including in prompt.`);
    researchContent = fs.readFileSync(researchPath, 'utf8');
  }

  return `
You are researching the web platform feature "${feature.name}" (ID: ${feature.id}).
Your task is to identify 2-5 distinct developer use cases for this feature.

${researchContent ? `Here is the deep research report for this feature to read primarily:\n===\n${researchContent}\n===\n` : ''}

Follow the guidelines in these skill files:

=== project-use-cases ===
${useCasesSkill}

=== project-use-cases-research ===
${researchSkill}

Source URLs to read:
${sourcesList || '(No source URLs available — use your knowledge of this feature)'}

Output your response as a JSON array of objects, with NO other text or markdown formatting blocks. Just the raw JSON array.
Each object must have:
- slug: short kebab-case name of the use case (do NOT prefix with action verbs like create-, build-, add-).
- description: A single short sentence describing the task.
- category: one of 'performance', 'accessibility', 'user-experience', 'security', or 'forms'.

IMPORTANT: If the feature is a low-level utility (like a new Promise method or a general object cloning function) that primarily acts as a drop-in replacement for legacy patterns, avoid forcing it into multiple outcome-oriented use cases. Instead, generate a single 'Fundamental Guide' (e.g., 'Deep cloning complex objects') or place it in a top-level discipline skill file. In this case, return only 1 use case representing that fundamental guide.


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

function buildExpectationsPrompt(feature: FeatureInfo, useCase: { slug: string; description: string }): string {
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


function buildDemoPrompt(feature: FeatureInfo, useCase: { slug: string; description: string }): string {

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

function buildGuidePrompt(feature: FeatureInfo, useCase: { slug: string; description: string }): string {
  const guideSkill = getSkillContent('project-guides');

  return `
You are generating a guide for the use case: "${useCase.description}".
This use case relies on the feature "${feature.name}" (ID: ${feature.id}).

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




// ─── Isolated work dir setup ─────────────────────────────────────────────────






async function scaffoldUseCase(uc: { slug: string; description: string; category: string }, feature: FeatureInfo, guidesDir: string): Promise<string> {
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

    const cleanGuideContent = guideContent.replace(/^```markdown\n?/, '').replace(/\n?```$/, '').trim();

    fs.writeFileSync(path.join(outputDir, 'guide.md'), frontmatter + cleanGuideContent);
    console.log(`✅ Generated guide.md`);

    // 2. Generate demo.html
    console.log(`Generating demo.html for ${uc.slug}...`);
    const demoPrompt = buildDemoPrompt(feature, uc);
    const demoHtml = await runGemini(demoPrompt, workDir);

    const cleanHtml = demoHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    fs.writeFileSync(path.join(outputDir, 'demo.html'), cleanHtml);
    console.log(`✅ Generated demo.html`);

    // 3. Generate expectations.md
    console.log(`Generating expectations.md for ${uc.slug}...`);
    const expectationsPrompt = buildExpectationsPrompt(feature, uc);
    const expectationsMd = await runGemini(expectationsPrompt, workDir);

    const cleanExpectations = expectationsMd.replace(/^```markdown\n?/, '').replace(/\n?```$/, '').trim();
    fs.writeFileSync(path.join(outputDir, 'expectations.md'), cleanExpectations);
    console.log(`✅ Generated expectations.md`);

  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }

  return outputDir;
}

function parseUseCasesResponse(response: string): UseCase[] {
  try {
    const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) {
      throw new Error("Could not find JSON array in response");
    }
    return JSON.parse(match[0]);
  } catch (err) {
    console.error(`Failed to parse JSON response from Gemini. Raw response:\n${response}`);
    throw err;
  }
}

function constructPRBody(featureId: string, useCases: UseCase[]): string {
  const branch = `guidance-bot/${featureId}`;
  const repo = process.env.GITHUB_REPOSITORY || 'paulirish/guidance';
  const emoji  = '😀 😁 😂 🤣 😃 😄 😅 😆 😉 😊 😋 😎 😍 🥰 😘'.split('').at(Math.floor(Math.random() * 16));

  let body = `\`${featureId}\` has been researched, usecases identified, guides & artifacts generated. And adverserially reviewed. ${emoji}

### usecases

`;

  for (const uc of useCases) {
    const previewUrl = `https://github-preview-proxy-847799827363.us-central1.run.app/${repo}/${branch}/guides/${uc.category}/${uc.slug}/demo.html`;

    body += `- \`${uc.slug}\` - ${uc.description}\n`;
    body += `   - [demo](${previewUrl})\n`;
  }

  body += `\n---\n\nReviewer: Please ensure \`guide\` usecase is valid, and details are technically accurate, \`expectations\` criteria is accurate.  \n\n**Add a PR review** (after optionally leaving comments) to trigger a feedback iteration, where the agent will handle your feedback and push new commits.  (If you prefer, you can just push changes to the branch.)\n`;

  return body;
}



async function handleGitAndPR(featureId: string, reviewer: string, useCases: UseCase[]): Promise<void> {
  if (process.env.GITHUB_ACTIONS) {
    const pushed = await commitAndPush(featureId);
    if (pushed) {
      const body = constructPRBody(featureId, useCases);
      await createPullRequest(featureId, reviewer, body);
    }
  } else {
    console.log('\nSkipping Git commit/push and PR creation (not running in GitHub Actions).');
  }
}

// ─── Main generation function ────────────────────────────────────────────────


export async function generateUseCases(featureId: string, reviewer: string = 'paulirish'): Promise<void> {

  console.log(`Looking up feature: ${featureId}`);
  const feature = lookupFeature(featureId);
  console.log(`Found: ${feature.name}`);

  const researchPath = path.resolve('features', feature.id, 'research.md');
  if (!fs.existsSync(researchPath)) {
    console.log(`Research file not found at ${researchPath}. Invoking deep research...`);
    const scriptPath = path.join(rootDir, '.agents/skills/project-use-cases-research/scripts/deep_research.js');
    await runCommand('node', [scriptPath, '--feature-id', feature.id]);
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

  const isCI = !!process.env.GITHUB_ACTIONS;

  if (isCI) {
    console.log(`\nRunning pipelines in parallel with prefixed logs for ${useCases.length} use cases in CI...`);
    
    const promises = useCases.map(async (uc) => {
      const outputDir = await scaffoldUseCase(uc, feature, guidesDir);
      console.log(`[Usecase: ${uc.slug}] Running calibration...`);
      
      const child = spawn('node', ['--experimental-strip-types', 'guides/dev-guide.ts', outputDir, '--no-test'], {
        cwd: rootDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      const prefix = `[${uc.slug}] `;
      
      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) console.log(prefix + line);
        }
      });
      
      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) console.error(prefix + line);
        }
      });
      
      const exitCode = await new Promise<number>((resolve) => child.on('close', resolve));
      
      if (exitCode !== 0) {
        throw new Error(`devGuide failed for ${uc.slug}`);
      }
    });

    await Promise.all(promises);
  } else {
    console.log(`\nRunning pipelines in parallel for ${useCases.length} use cases...`);
    
    const promises = useCases.map(async (uc) => {
      const outputDir = await scaffoldUseCase(uc, feature, guidesDir);
      const logFile = path.join(outputDir, 'dev.log');
      console.log(`[Usecase: ${uc.slug}] Running calibration. Logs redirected to ${logFile}`);
      
      const logStream = fs.createWriteStream(logFile);
      
      const child = spawn('node', ['--experimental-strip-types', 'guides/dev-guide.ts', outputDir, '--no-test'], {
        cwd: rootDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      
      const exitCode = await new Promise<number>((resolve) => child.on('close', resolve));
      
      if (exitCode !== 0) {
        throw new Error(`devGuide failed for ${uc.slug}. See logs at ${logFile}`);
      }
    });

    await Promise.all(promises);
  }

  console.log(`\n🎉 All use cases scaffolded and processed!`);

  await handleGitAndPR(featureId, reviewer, useCases);
}

async function commitAndPush(featureId: string): Promise<boolean> {
  const branch = `guidance-bot/${featureId}`;
  console.log(`Committing and pushing to ${branch}...`);

  // Check if there are changes
  const status = await runCommand('git', ['status', '--porcelain']);
  if (!status.trim()) {
    console.log('No changes to commit.');
    return false;
  }

  // Create or switch to branch
  try {
    await runCommand('git', ['checkout', '-b', branch]);
  } catch (err) {
    await runCommand('git', ['checkout', branch]);
  }

  await runCommand('git', ['add', 'guides/']);
  await runCommand('git', ['commit', '-m', `feat: scaffold guide for ${featureId}`]);

  const token = process.env.APP_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const pushUrl = token && repo ? `https://x-access-token:${token}@github.com/${repo}.git` : 'origin';


  await runCommand('git', ['push', pushUrl, `${branch}:${branch}`, '--force']);
  console.log(`✅ Pushed to ${branch}`);
  return true;

}

async function createPullRequest(featureId: string, reviewer: string, body: string): Promise<void> {
  const branch = `guidance-bot/${featureId}`;
  console.log(`Creating PR for ${branch}...`);

  // Check if PR already exists
  try {
    const pr = await runCommand('gh', ['pr', 'view', branch]);
    if (pr) {
      console.log(`PR already exists for ${branch}. Skipping creation.`);
      return;
    }
  } catch (err) {
    // PR doesn't exist, continue
  }

  const title = `guides: ${featureId}`;

  await runCommand('gh', [
    'pr', 'create',
    '--draft',
    '--head', branch,
    '--title', title,
    '--body', body,
    '--reviewer', reviewer
  ]);

  console.log(`✅ PR created for ${branch}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function mdnUrlFromCompatKey(compatKey: string): string | null {
  const parts = compatKey.split('.');
  let node: Record<string, unknown> = {};
  if (isRecord(bcd)) {
    node = bcd;
  }
  
  for (const part of parts) {
    if (isRecord(node) && part in node) {
      const nextNode = node[part];
      if (isRecord(nextNode)) {
        node = nextNode;
      } else {
        node = {};
        break;
      }
    } else {
      node = {};
      break;
    }
  }

  const compat = node?.__compat;
  if (isRecord(compat)) {
    const mdnUrl = compat.mdn_url;
    if (typeof mdnUrl === 'string') {
      return mdnUrl;
    }
  }
  return null;
}

export function getMdnUrlsForFeature(feature: FeatureData): string[] {
  const urls: string[] = [];
  for (const compatKey of (feature.compat_features || [])) {
    if (!compatKey) continue;
    const mdnUrl = mdnUrlFromCompatKey(compatKey);
    if (mdnUrl && !urls.includes(mdnUrl)) {
      urls.push(mdnUrl);
    }
  }
  return urls;
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
