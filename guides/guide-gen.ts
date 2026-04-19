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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { features } from 'web-features';

import { guidesDir } from '../lib/paths.ts';
import config from '../harness/config.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
} from '../harness/lib/agent-shared.ts';
import { devGuide } from './dev-guide.ts';


// ─── MDN URL construction ────────────────────────────────────────────────────

function mdnUrlFromCompatKey(compatKey: string): string | null {
  if (compatKey.startsWith('javascript.builtins.')) {
    const rest = compatKey.slice('javascript.builtins.'.length).replace(/\./g, '/');
    return `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/${rest}`;
  }
  if (compatKey.startsWith('api.')) {
    const rest = compatKey.slice('api.'.length).replace(/\./g, '/');
    return `https://developer.mozilla.org/en-US/docs/Web/API/${rest}`;
  }
  if (compatKey.startsWith('css.properties.')) {
    const rest = compatKey.slice('css.properties.'.length);
    return `https://developer.mozilla.org/en-US/docs/Web/CSS/${rest}`;
  }
  if (compatKey.startsWith('css.at-rules.')) {
    const rest = compatKey.slice('css.at-rules.'.length);
    return `https://developer.mozilla.org/en-US/docs/Web/CSS/@${rest}`;
  }
  if (compatKey.startsWith('html.elements.')) {
    const rest = compatKey.slice('html.elements.'.length);
    return `https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${rest}`;
  }
  return null;
}

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

function lookupFeature(featureId: string): FeatureInfo {
  const feature = (features as Record<string, any>)[featureId];
  if (!feature || feature.kind !== 'feature') {
    throw new Error(`Feature "${featureId}" not found in web-features package.`);
  }

  const mdnUrls: string[] = [];
  for (const compatKey of (feature.compat_features || [])) {
    const url = mdnUrlFromCompatKey(compatKey);
    if (url && !mdnUrls.includes(url)) mdnUrls.push(url);
    if (mdnUrls.length >= 2) break;
  }

  return {
    id: featureId,
    name: feature.name || featureId,
    description: feature.description || '',
    specUrls: feature.spec || [],
    mdnUrls,
  };
}

function getSkillContent(skillName: string): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const skillPath = path.join(currentDir, '../.agents/skills', skillName, 'SKILL.md');
  try {
    return fs.readFileSync(skillPath, 'utf8');
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

  return `
You are researching the web platform feature "${feature.name}" (ID: ${feature.id}).
Your task is to identify 2-5 distinct developer use cases for this feature.

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

function setupIsolatedWorkDir(): string {
  const tempHome = createIsolatedHome('ghh-guide-gen');
  const workDir = path.join(tempHome, 'work');
  fs.mkdirSync(workDir, { recursive: true });

  const geminiSource = path.join(path.resolve(process.env.HOME || process.cwd()), '.gemini');
  const geminiDest = path.join(tempHome, '.gemini');
  fs.mkdirSync(geminiDest, { recursive: true });

  for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id', 'settings.json']) {
    copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
  }

  createTrustedFolders(geminiDest, [workDir]);
  process.env.HOME = tempHome;
  return workDir;
}

async function runCommand(command: string, args: string[], cwd?: string): Promise<string> {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', (d) => { stdoutData += d; });
  child.stderr.on('data', (d) => { stderrData += d; });

  const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

  if (exitCode !== 0) {
    throw new Error(`Command ${command} failed with code ${exitCode}. Stderr: ${stderrData}`);
  }

  return stdoutData.trim();
}

async function runGemini(prompt: string, workDir: string): Promise<string> {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, '--yolo'];
  return runCommand(command, commandArgs, workDir);
}


async function scaffoldUseCase(uc: { slug: string; description: string; category: string }, feature: FeatureInfo, workDir: string, guidesDir: string): Promise<string> {
  const outputDir = path.join(guidesDir, uc.category, uc.slug);
  console.log(`\nScaffolding ${uc.slug} in ${outputDir}...`);

  fs.mkdirSync(outputDir, { recursive: true });

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

async function handleGitAndPR(featureId: string, reviewer: string): Promise<void> {
  if (process.env.GITHUB_ACTIONS) {
    const pushed = await commitAndPush(featureId);
    if (pushed) {
      await createPullRequest(featureId, reviewer);
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

  const workDir = setupIsolatedWorkDir();
  const prompt = buildUseCasesPrompt(feature);

  console.log(`Asking Gemini to identify use cases...`);
  const response = await runGemini(prompt, workDir);

  const useCases = parseUseCasesResponse(response);

  console.log(`\nIdentified ${useCases.length} use cases:`);
  for (const uc of useCases) {
    console.log(`- [${uc.category}] ${uc.slug}: ${uc.description}`);
  }

  for (const uc of useCases) {
    const outputDir = await scaffoldUseCase(uc, feature, workDir, guidesDir);

    console.log(`Running gd dev for ${uc.slug}...`);
    const success = await devGuide(outputDir, { test: false });
    if (!success) {
      throw new Error(`devGuide failed for ${uc.slug}`);
    }
  }

  cleanupIsolatedHome(path.dirname(workDir));
  console.log(`\n🎉 All use cases scaffolded!`);

  await handleGitAndPR(featureId, reviewer);
}


// ─── CLI entry point ─────────────────────────────────────────────────────────

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

async function createPullRequest(featureId: string, reviewer: string): Promise<void> {
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

  const body = `## Auto-generated guide package

Please review the following files for correctness:

| File | Review focus |
|---|---|
| \`guide.md\` | Is this use case valid and action-oriented? |
| \`demo.html\` | Is this a correct, minimal implementation? |
| \`expectations.md\` | Are the grading criteria accurate? |

This PR was generated by the Guidance Pipeline.

💡 **How to update this PR:**
- If you want to make direct edits to the files, feel free to do so.
- After making edits (or to leave feedback), please **submit a PR review**. This will trigger the agent to apply your feedback and regenerate derived artifacts like the grader!
`;


  const title = `Guide: ${featureId}`;
  
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
