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

// ─── Prompt construction ─────────────────────────────────────────────────────

function buildUseCasesPrompt(feature: FeatureInfo): string {
  const sourcesList = [
    ...feature.mdnUrls.map(u => `- MDN: ${u}`),
    ...feature.specUrls.map(u => `- Spec: ${u}`),
  ].join('\n');

  return `
You are researching the web platform feature "${feature.name}" (ID: ${feature.id}).
Your task is to identify 2-5 distinct developer use cases for this feature, following the Stage 1 guidelines for Guidance Pipeline.

Rules for Use Cases:
- Action-oriented: Framed as a task the user is trying to implement. Starts with a verb.
- Focus on WHAT not HOW: Do not mention the solution (this feature) in the description.
- Generic and Common: Represent common, everyday developer needs.
- Aim for 2-5 distinct use cases.
- Drop niche use cases: If a use case is unlikely to match real developer prompts, omit it.
- Do not stretch: Do not invent use cases or force them into categories just to reach the 2-5 target. Quality and realism are more important than quantity. If a feature only has 1 or 2 high-confidence use cases, that is perfectly fine.


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
- <add any other app-agnostic constraints relevant to this feature>
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

Output ONLY the raw HTML content, with no markdown code blocks or other text.
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

async function runGemini(prompt: string, workDir: string): Promise<string> {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, '--yolo'];

  const child = spawn(command, commandArgs, {
    cwd: workDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', (d) => { stdoutData += d; });
  child.stderr.on('data', (d) => { stderrData += d; });

  const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

  if (exitCode !== 0) {
    throw new Error(`Gemini CLI exited with code ${exitCode}. Stderr: ${stderrData}`);
  }

  return stdoutData.trim();
}

// ─── Main generation function ────────────────────────────────────────────────

export async function generateUseCases(featureId: string): Promise<void> {
  console.log(`Looking up feature: ${featureId}`);
  const feature = lookupFeature(featureId);
  console.log(`Found: ${feature.name}`);

  const workDir = setupIsolatedWorkDir();
  const prompt = buildUseCasesPrompt(feature);

  console.log(`Asking Gemini to identify use cases...`);
  const response = await runGemini(prompt, workDir);

  let useCases: { slug: string; description: string; category: string }[];
  try {
    // Find the first '[' and last ']' to extract JSON array
    const match = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) {
      throw new Error("Could not find JSON array in response");
    }
    const jsonStr = match[0];
    useCases = JSON.parse(jsonStr);

  } catch (err) {
    console.error(`Failed to parse JSON response from Gemini. Raw response:\n${response}`);
    throw err;
  }

  console.log(`\nIdentified ${useCases.length} use cases:`);
  for (const uc of useCases) {
    console.log(`- [${uc.category}] ${uc.slug}: ${uc.description}`);
  }

  for (const uc of useCases) {
    const outputDir = path.join(guidesDir, uc.category, uc.slug);
    console.log(`\nScaffolding ${uc.slug} in ${outputDir}...`);

    fs.mkdirSync(outputDir, { recursive: true });

    // 1. Write guide.md stub
    const guideContent = `---
name: ${uc.slug}
description: ${uc.description}
web-feature-ids:
  - ${feature.id}
sources:
${feature.mdnUrls.map(u => `  - ${u}`).join('\n')}
---

# ${uc.slug}

This is a scaffolded guide for the use case: ${uc.description}.
`;
    fs.writeFileSync(path.join(outputDir, 'guide.md'), guideContent);
    console.log(`✅ Scaffolded guide.md`);


    // 2. Generate demo.html
    console.log(`Generating demo.html for ${uc.slug}...`);
    const demoPrompt = buildDemoPrompt(feature, uc);
    const demoHtml = await runGemini(demoPrompt, workDir);
    
    // Strip markdown code blocks if present
    const cleanHtml = demoHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    
    fs.writeFileSync(path.join(outputDir, 'demo.html'), cleanHtml);
    console.log(`✅ Generated demo.html`);

    // 3. Generate expectations.md
    console.log(`Generating expectations.md for ${uc.slug}...`);
    const expectationsPrompt = buildExpectationsPrompt(feature, uc);
    const expectationsMd = await runGemini(expectationsPrompt, workDir);
    
    // Strip markdown code blocks if present
    const cleanExpectations = expectationsMd.replace(/^```markdown\n?/, '').replace(/\n?```$/, '').trim();
    
    fs.writeFileSync(path.join(outputDir, 'expectations.md'), cleanExpectations);
    console.log(`✅ Generated expectations.md`);

    console.log(`Running gd dev for ${uc.slug}...`);
    const success = await devGuide(outputDir, { noTest: true });
    if (!success) {
      throw new Error(`devGuide failed for ${uc.slug}`);
    }


  }


  cleanupIsolatedHome(path.dirname(workDir));
  console.log(`\n🎉 All use cases scaffolded!`);
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

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
