/**
 * guide-gen.ts
 *
 * Generates guide.md, demo.html, and expectations.md for a web feature
 * from a web-feature-id. Runs Gemini CLI in an isolated environment
 * (following the same pattern as grader-gen.ts / negative-gen.ts).
 *
 * Usage:
 *   gd gen-guide <web-feature-id> [--category <category>] [--slug <slug>]
 *   node --experimental-strip-types guides/guide-gen.ts intl-duration-format
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { features } from 'web-features';

import { guidesDir } from '../lib/paths.ts';
import config from '../harness/config.ts';
import {
  createIsolatedHome,
  cleanupIsolatedHome,
  copyFileIfExists,
  createTrustedFolders,
} from '../harness/lib/agent-shared.ts';

// ─── MDN URL construction ────────────────────────────────────────────────────

/**
 * Derives a best-guess MDN URL from a BCD compat key.
 * e.g. "javascript.builtins.Intl.DurationFormat" →
 *      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat"
 */
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
  baselineStatus: string;
  baselineLowDate: string | null;
  browserSupport: Record<string, string>;
}

function lookupFeature(featureId: string): FeatureInfo {
  const feature = (features as Record<string, any>)[featureId];
  if (!feature || feature.kind !== 'feature') {
    const similar = Object.keys(features).filter(k => k.includes(featureId.split('-')[0])).slice(0, 5);
    const hint = similar.length ? `\nDid you mean one of: ${similar.join(', ')}?` : '';
    throw new Error(`Feature "${featureId}" not found in web-features package.${hint}`);
  }

  // Gather MDN URLs from compat_features keys
  const mdnUrls: string[] = [];
  for (const compatKey of (feature.compat_features || [])) {
    const url = mdnUrlFromCompatKey(compatKey);
    if (url && !mdnUrls.includes(url)) mdnUrls.push(url);
    if (mdnUrls.length >= 2) break; // Limit to 2 most relevant MDN pages
  }

  const status = feature.status || {};
  const support = status.support || {};

  return {
    id: featureId,
    name: feature.name || featureId,
    description: feature.description || '',
    specUrls: feature.spec || [],
    mdnUrls,
    baselineStatus: status.baseline || 'limited',
    baselineLowDate: status.baseline_low_date || null,
    browserSupport: {
      chrome: support.chrome || '?',
      firefox: support.firefox || '?',
      safari: support.safari || '?',
      edge: support.edge || '?',
    },
  };
}

// ─── Prompt construction ─────────────────────────────────────────────────────

function buildPrompt(feature: FeatureInfo, guideName: string): string {
  const sourcesList = [
    ...feature.mdnUrls.map(u => `- MDN: ${u}`),
    ...feature.specUrls.map(u => `- Spec: ${u}`),
  ].join('\n');

  const browserTable = Object.entries(feature.browserSupport)
    .map(([b, v]) => `  - ${b}: ${v}`)
    .join('\n');

  const baselineLabel =
    feature.baselineStatus === 'high' ? 'Widely available' :
    feature.baselineStatus === 'low' ? `Newly available (since ${feature.baselineLowDate})` :
    'Limited availability';

  return `
You are authoring web developer guidance for an AI coding assistant.

Your task is to generate THREE files for the "${feature.name}" feature:
1. guide.md — AI-ready guidance following the exact format rules below
2. demo.html — A minimal but correct reference implementation
3. expectations.md — Structured assertions for the grader

══════════════════════════════════════════
FEATURE METADATA
══════════════════════════════════════════

Feature ID: ${feature.id}
Name: ${feature.name}
Description: ${feature.description}
Baseline: ${baselineLabel}
Browser support:
${browserTable}

Source URLs to read:
${sourcesList || '(No source URLs available — use your knowledge of this feature)'}

══════════════════════════════════════════
STEP 1: Read source URLs
══════════════════════════════════════════

Fetch and read the content of each source URL listed above. If a URL is
unavailable, use your own knowledge of the feature.

══════════════════════════════════════════
STEP 2: Write guide.md
══════════════════════════════════════════

MANDATORY RULES:
- Start with this EXACT YAML frontmatter (fill in the blanks):

\`\`\`yaml
---
name: ${guideName}
description: <single action-oriented sentence starting with a verb, describing the developer task>
web-feature-ids:
  - ${feature.id}
sources:
  - <list all source URLs you actually used>
---
\`\`\`

- After frontmatter: write a brief intro paragraph explaining the use case and why this API is the right solution.
- Include implementation steps. Only mark steps MANDATORY if truly required.
- Include short, heavily commented code snippets. Comments must explain WHY, not just what.
- DO NOT include any external links in the markdown body — all knowledge must be fully synthesized inline.
- MUST include a "### Fallback strategies" section with \`{{ BASELINE_STATUS("${feature.id}") }}\` as its very first line, then describe the fallback behavior.
- For feature detection, prefer checking \`HTMLElement.prototype\` or \`'feature' in window\` patterns.
- Keep the guide concise and high-density. No fluff or conversational text.

══════════════════════════════════════════
STEP 3: Write demo.html
══════════════════════════════════════════

Write a minimal, self-contained correct implementation of the most common
use case for this feature. It should:
- Be a single HTML file with inline scripts and styles
- Actually demonstrate the feature in a working way
- Pass all the expectations you will write in Step 4
- NOT be production-polished — just correct and minimal
- Use placeholder content where needed

══════════════════════════════════════════
STEP 4: Write expectations.md
══════════════════════════════════════════

Write structured expectations using this EXACT format with three sections:

\`\`\`markdown
## Must pass
- <assertion that demo.html satisfies and a correct implementation must satisfy>
- <one assertion per bullet>

## Must fail
- <assertion that an incorrect implementation using a legacy/anti-pattern approach would violate>
- <focus on the most likely incorrect alternative to this feature>

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- <add any other app-agnostic constraints relevant to this feature>
\`\`\`

══════════════════════════════════════════
IMPORTANT: File output instructions
══════════════════════════════════════════

Create exactly these three files in the current directory:
- guide.md
- demo.html
- expectations.md

Do NOT use bash or shell commands (cat, echo, heredocs) to write files.
Use your built-in structured file writing tools (write_file or equivalent).
Do NOT create any other files.
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

  for (const file of ['oauth_creds.json', 'google_accounts.json', 'installation_id']) {
    copyFileIfExists(path.join(geminiSource, file), path.join(geminiDest, file));
  }

  createTrustedFolders(geminiDest, [workDir]);
  process.env.HOME = tempHome;
  return workDir;
}

// ─── Main generation function ────────────────────────────────────────────────

export async function generateGuide(featureId: string, options: {
  category?: string;
  slug?: string;
} = {}): Promise<string> {
  console.log(`Looking up feature: ${featureId}`);
  const feature = lookupFeature(featureId);
  console.log(`Found: ${feature.name} (${feature.baselineStatus})`);

  const slug = options.slug ?? featureId;
  const category = options.category ?? 'user-experience';
  const outputDir = path.join(guidesDir, category, slug);

  if (fs.existsSync(path.join(outputDir, 'guide.md'))) {
    const existing = fs.readFileSync(path.join(outputDir, 'guide.md'), 'utf-8').trim();
    // Check it's not just a stub (stub = only frontmatter, no body)
    const hasBody = existing.split('---').slice(2).join('---').trim().length > 0;
    if (hasBody) {
      throw new Error(`guide.md already exists and has content at ${outputDir}. Delete it first to regenerate.`);
    }
    console.log(`Found stub guide at ${outputDir}, will fill it in.`);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prompt = buildPrompt(feature, slug);
  const workDir = setupIsolatedWorkDir();

  // If there's an existing stub guide.md, copy it to work dir so Gemini can read the frontmatter
  const existingGuide = path.join(outputDir, 'guide.md');
  if (fs.existsSync(existingGuide)) {
    fs.copyFileSync(existingGuide, path.join(workDir, 'guide.md'));
  }

  console.log(`Generating guide package for ${feature.name} in ${workDir}`);
  console.log(`Sources: ${[...feature.mdnUrls, ...feature.specUrls].join(', ') || '(none)'}`);

  try {
    const command = config.environment.geminiCliBin;
    const commandArgs = ['-p', prompt, '--yolo'];

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`\nStarting Gemini CLI (attempt ${attempt}/${maxRetries})...`);

      const child = spawn(command, commandArgs, {
        cwd: workDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutData = '';
      let stderrData = '';
      child.stdout.on('data', (d) => { stdoutData += d; process.stdout.write(d); });
      child.stderr.on('data', (d) => { stderrData += d; process.stderr.write(d); });

      const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

      if (exitCode === 0) break;

      const combinedOutput = stdoutData + '\n' + stderrData;
      const isInternalError =
        combinedOutput.includes('ApiError: got status: INTERNAL') ||
        combinedOutput.includes('"status":"INTERNAL"');

      if (isInternalError && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`\n⚠️  Gemini API INTERNAL error. Retrying in ${backoffMs / 1000}s...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(`Gemini CLI exited with code ${exitCode}`);
    }

    // Copy generated files back to the output directory
    const filesToCopy = ['guide.md', 'demo.html', 'expectations.md'];
    const copied: string[] = [];

    for (const file of filesToCopy) {
      const src = path.join(workDir, file);
      const dest = path.join(outputDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        copied.push(file);
      } else {
        console.warn(`⚠️  ${file} was not generated`);
      }
    }

    console.log(`\n✅ Generated: ${copied.join(', ')}`);
    console.log(`📁 Output: ${outputDir}`);
    console.log(`\nNext step: gd dev ${path.relative(process.cwd(), outputDir)}`);

    return outputDir;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 1 || args[0] === '--help') {
    console.log(`
Usage: gd gen-guide <web-feature-id> [--category <category>] [--slug <slug>]

Arguments:
  web-feature-id    The web-features package ID (e.g. intl-duration-format)

Options:
  --category <cat>  Guide category directory (default: user-experience)
  --slug <slug>     Guide directory name (default: same as feature-id)
  -h, --help        Show this help

Example:
  gd gen-guide intl-duration-format
  gd gen-guide intl-duration-format --category user-experience --slug format-duration-for-display
`);
    process.exit(0);
  }

  let featureId = '';
  let category = 'user-experience';
  let slug = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      category = args[++i];
    } else if (args[i] === '--slug' && args[i + 1]) {
      slug = args[++i];
    } else if (!args[i].startsWith('--')) {
      featureId = args[i];
    }
  }

  if (!featureId) {
    console.error('Error: web-feature-id is required.');
    process.exit(1);
  }

  generateGuide(featureId, { category, slug: slug || featureId }).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
