import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';
import { rootDir } from '../../lib/paths.ts';

export interface ReleaseNotesOptions {
  previousTag: string;
  newVersion: string;
  target?: string;
  publishCliDir?: string;
  apiKey?: string;
  model?: string;
}

export interface EvalSummaryItem {
  testId?: string;
  timestamp?: string;
  agent: string;
  serving?: string;
  model: string;
  taskCount: number;
  assertionCount: number;
  unguidedPassRate: number;
  guidedPassRate: number;
  skillVersion?: string;
  cliVersion?: string;
}

const GH_PUBLISH_PATTERNS = [
  '**/*',
  '!**/.cache/**',
  '!**/tfjs_model_minilm/**',
  '!**/*.{js,mjs,ts,bin,map,gz}',
  '!**/skill-version.txt',
  '!THIRD_PARTY_NOTICES',
  '!skills/modern-web-guidance/package.json',
];

export function getPreviousTag(targetTag: string): string {
  try {
    const ghOutput = execSync(
      `gh api repos/GoogleChrome/modern-web-guidance/tags --jq '.[].name'`,
      { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    const tags = ghOutput.split('\n').map(t => t.trim()).filter(Boolean);
    const targetIndex = tags.indexOf(targetTag);
    if (targetIndex !== -1 && targetIndex + 1 < tags.length) {
      return tags[targetIndex + 1];
    }
  } catch { }

  const output = execSync(
    `git tag -l "v*.*.*" --sort=-v:refname --merged ${targetTag}`,
    { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
  ).trim();

  const tags = output.split('\n').map(t => t.trim()).filter(Boolean);
  const targetIndex = tags.indexOf(targetTag);
  if (targetIndex !== -1 && targetIndex + 1 < tags.length) {
    return tags[targetIndex + 1];
  }
  if (tags.length > 1) {
    return tags[1];
  }
  throw new Error(`Could not determine previous tag for ${targetTag}`);
}

/**
 * Extracts exact differences between the previous release and the newly built distribution payload.
 * Eliminates all heuristics by diffing the actual compiled output (dist/skills-cli).
 */
export function getExactDistributionDiff(previousTag: string, publishCliDir: string): {
  guideDiff: string;
  evalSummary: EvalSummaryItem[];
  changedFiles: string[];
} {
  // Ensure the previous tag is fetched from the distribution repo (public HTTPS)
  try {
    execSync(
      `git fetch https://github.com/GoogleChrome/modern-web-guidance.git refs/tags/${previousTag}:refs/tags/dist/${previousTag}`,
      { cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
    );
  } catch {}

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-dist-prev-'));
  try {
    try {
      execSync(`git archive dist/${previousTag} | tar -x -C "${tempDir}"`, {
        cwd: rootDir,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch (archiveErr) {
      console.warn(`Could not extract dist/${previousTag} for diffing:`, archiveErr);
      return {
        guideDiff: '',
        evalSummary: getLatestEvalResultsSummary(),
        changedFiles: [],
      };
    }

    const rawDiff = execSync(
      `git diff --no-index --name-status "${tempDir}" "${publishCliDir}" || true`,
      { encoding: 'utf8', cwd: rootDir }
    );

    const sections: string[] = [];
    const addedGuides: string[] = [];
    const modifiedPatches: string[] = [];
    const changedFiles: string[] = [];

    for (const line of rawDiff.trim().split('\n')) {
      if (!line.trim()) continue;
const tabIndex = line.indexOf('\t');
const status = line.slice(0, tabIndex).trim();
const targetFile = line.slice(tabIndex + 1).trim();
      const relPath = targetFile.startsWith(tempDir)
        ? path.relative(tempDir, targetFile)
        : path.relative(publishCliDir, targetFile);

      const isAllowed = GH_PUBLISH_PATTERNS.every(pattern => {
        if (pattern.startsWith('!')) {
          return !minimatch(relPath, pattern.slice(1), { dot: true });
        }
        return minimatch(relPath, pattern, { dot: true });
      });

      if (!isAllowed) continue;

      changedFiles.push(relPath);

      if (relPath.startsWith('skills/modern-web-guidance/guides/') && status === 'A') {
        const fullBuiltPath = path.join(publishCliDir, relPath);
        if (fs.existsSync(fullBuiltPath) && !fs.lstatSync(fullBuiltPath).isSymbolicLink()) {
          const guideName = path.basename(relPath, '.md');
          addedGuides.push(`- **${guideName}** (Path: \`${relPath}\`)`);
        }
      } else if (status !== 'T') {
        const oldFile = path.join(tempDir, relPath);
        const newFile = path.join(publishCliDir, relPath);
        if (fs.existsSync(oldFile) && fs.existsSync(newFile)) {
          // If symlink, skip if target matches
          if (fs.lstatSync(newFile).isSymbolicLink()) {
            continue;
          }
          const fileDiff = execSync(
            `git diff --no-index -u "${oldFile}" "${newFile}" || true`,
            { encoding: 'utf8', cwd: rootDir }
          );
          if (fileDiff) {
            // Ignore rote version bumps in manifest files
            if (relPath.includes('plugin.json') || relPath === 'package.json' || relPath === 'gemini-extension.json') {
              if (fileDiff.includes('"version":') && !fileDiff.includes('"name":')) {
                continue;
              }
            }
            modifiedPatches.push(`--- ${relPath} (${status}) ---\n${fileDiff}`);
          }
        } else if (fs.existsSync(newFile) && !fs.lstatSync(newFile).isSymbolicLink()) {
          modifiedPatches.push(`--- ${relPath} (Added) ---`);
        }
      }
    }

    if (addedGuides.length > 0) {
      sections.push(`### 🆕 Newly Added Guides:\n${addedGuides.join('\n\n')}`);
    }
    if (modifiedPatches.length > 0) {
      sections.push(`### 🔄 Modified Files & Content Diff:\n${modifiedPatches.join('\n\n')}`);
    }

    return {
      guideDiff: sections.join('\n\n'),
      evalSummary: getLatestEvalResultsSummary(),
      changedFiles,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Extracts latest eval results from eval-results-summary.json
 */
export function getLatestEvalResultsSummary(): EvalSummaryItem[] {
  const summaryPath = path.join(rootDir, 'serving/skills-cli/eval-results-summary.json');
  if (!fs.existsSync(summaryPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as EvalSummaryItem[];
    if (!Array.isArray(data) || data.length === 0) return [];

    // Group by agent and get the latest entry for each distinct agent
    const latestByAgent = new Map<string, EvalSummaryItem>();
    for (const item of data) {
      if (!latestByAgent.has(item.agent)) {
        latestByAgent.set(item.agent, item);
      }
    }
    return Array.from(latestByAgent.values());
  } catch (err) {
    console.warn('Failed to parse eval-results-summary.json:', err);
    return [];
  }
}

/**
 * Extracts consumer-facing git diff by querying GoogleChrome/modern-web-guidance comparison API.
 */
export function getConsumerFacingDiff(previousTag: string, targetTag: string): {
  guideDiff: string;
  evalSummary: EvalSummaryItem[];
  changedFiles: string[];
} {
  let guideDiff = '';
  let changedFiles: string[] = [];

  try {
    const ghOutput = execSync(
      `gh api repos/GoogleChrome/modern-web-guidance/compare/${previousTag}...${targetTag}`,
      { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    const compareData = JSON.parse(ghOutput);
    if (compareData.files && Array.isArray(compareData.files)) {
      const sections: string[] = [];
      const addedGuides: string[] = [];
      const modifiedPatches: string[] = [];

      for (const file of compareData.files) {
        changedFiles.push(file.filename);
        if (file.filename.startsWith('skills/modern-web-guidance/guides/') && file.status === 'added') {
          const guideName = path.basename(file.filename, '.md');
          addedGuides.push(`- **${guideName}** (Path: \`${file.filename}\`)`);
        } else if (file.patch) {
          // Ignore rote version bumps in manifest files
          if (file.filename.includes('plugin.json') || file.filename === 'package.json' || file.filename === 'gemini-extension.json') {
            if (file.patch.includes('"version":') && !file.patch.includes('"name":')) {
              continue;
            }
          }
          modifiedPatches.push(`--- ${file.filename} (${file.status}) ---\n${file.patch}`);
        }
      }

      if (addedGuides.length > 0) {
        sections.push(`### 🆕 Newly Added Guides:\n${addedGuides.join('\n')}`);
      }
      if (modifiedPatches.length > 0) {
        sections.push(`### 🔄 Modified Files & Content Diff:\n${modifiedPatches.join('\n\n')}`);
      }

      guideDiff = sections.join('\n\n');
    }
  } catch (err) {
    console.warn(`Warning: Could not fetch GitHub compare between ${previousTag} and ${targetTag}:`, err);
  }

  const evalSummary = getLatestEvalResultsSummary();
  return { guideDiff, evalSummary, changedFiles };
}

/**
 * Deterministic fallback generator if Gemini API key is unavailable or fails.
 */
export function generateFallbackReleaseNotes(
  previousTag: string,
  newVersion: string,
  evalSummary: EvalSummaryItem[],
  changedFiles: string[]
): string {
  const guideFiles = changedFiles.filter(f => f.includes('guide.md') || f.includes('/guides/'));
  const pluginFiles = changedFiles.filter(f => f.includes('-plugin') || f.includes('plugin.json'));

  const sections: string[] = [`# Release Notes: \`v${newVersion}\`\n`];

  if (guideFiles.length > 0) {
    sections.push('### 📖 Guidance & Web Platform Updates\n');
    for (const file of guideFiles) {
      const guideName = path.basename(path.dirname(file)) || path.basename(file, '.md');
      sections.push(`* **${guideName}**: Updates and improvements to web platform guidance.`);
    }
    sections.push('');
  }

  if (pluginFiles.length > 0) {
    sections.push('### 🚀 Agent Ecosystem\n');
    sections.push('* Updates to agent plugin configurations and manifests.\n');
  }

  if (evalSummary.length > 0) {
    sections.push('### 📊 Benchmark Evaluations\n');
    sections.push('| Agent + Model | Tasks / Assertions | Unguided → Guided Pass Rate | Uplift |');
    sections.push('| :--- | :---: | :---: | :---: |');
    for (const item of evalSummary) {
      const uplift = item.guidedPassRate - item.unguidedPassRate;
      const upliftStr = uplift >= 0 ? `+${uplift}pp` : `${uplift}pp`;
      sections.push(
        `| **${item.agent}** (${item.model}) | ${item.taskCount} / ${item.assertionCount} | ${item.unguidedPassRate}% → **${item.guidedPassRate}%** | **${upliftStr}** |`
      );
    }
    sections.push('');
  }

  sections.push('---');
  sections.push(`**Full Changelog**: https://github.com/GoogleChrome/modern-web-guidance/compare/${previousTag}...v${newVersion}`);

  return sections.join('\n');
}

/**
 * Generates consumer-facing release notes using Gemini.
 */
export async function generateReleaseNotes(opts: ReleaseNotesOptions): Promise<string> {
  const {
    previousTag,
    newVersion,
    target = 'HEAD',
    publishCliDir,
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || 'gemini-3.7-flash',
  } = opts;

  const { guideDiff, evalSummary, changedFiles } =
    publishCliDir && fs.existsSync(publishCliDir)
      ? getExactDistributionDiff(previousTag, publishCliDir)
      : getConsumerFacingDiff(previousTag, target);

  if (!apiKey) {
    console.log('No GEMINI_API_KEY found. Generating fallback release notes...');
    return generateFallbackReleaseNotes(previousTag, newVersion, evalSummary, changedFiles);
  }

  const prompt = `You are generating consumer-facing GitHub release notes for version v${newVersion} of GoogleChrome/modern-web-guidance (comparing against ${previousTag}).

### Context:
- Target Repository: GoogleChrome/modern-web-guidance (the public distribution repository consumed by AI coding agents).
- Previous Tag: ${previousTag}
- New Version: v${newVersion}

### Evaluation Benchmarks:
${JSON.stringify(evalSummary, null, 2)}

### Consumer-facing Changes / Diff:
${guideDiff.substring(0, 15000)}

### Core Formatting Rules:
1. **Repository Scope**: Focus strictly on consumer-facing changes in \`GoogleChrome/modern-web-guidance\`. Do NOT mention internal build scripts, CI workflows, or upstream \`modern-web-guidance-src\` changes.
2. **Guide Changes**:
   - Each modified or new guide must be described in **at most ONE concise bullet point** (a single sentence or short paragraph) explaining the use case or key improvements/platform evolution.
   - **NEVER** use nested sub-bullets, lists within bullets, or multiple bullet points for a single guide. Keep the level of detail clean, concise, and uniform across all releases regardless of how many guides changed.
   - If both new guides and updates exist, organize them under:
     \`#### 🆕 New Guides\`
     \`#### 🔄 Guide Updates & Platform Evolution\`
   - If only new guides or only updates exist, list bullets directly under \`### 📖 Guidance & Web Platform Updates\`.
3. **Agent Ecosystem**:
   - Highlight newly supported agent platforms (e.g., Grok, Kimi, Claude, Cursor) or marketplace integrations in a single bullet point. Omit this section if no ecosystem changes occurred.
4. **Benchmark Evaluations (Strict Table Format)**:
   - Always format evaluation benchmarks using this exact 4-column Markdown table:
     | Agent + Model | Tasks / Assertions | Unguided → Guided Pass Rate | Uplift |
     | :--- | :---: | :---: | :---: |
     | **claude_code** (opus-5) | 130 / 1033 | 58% → **92%** | **+34pp** |
     | **antigravity** (Gemini 3.7 Flash Preview) | 130 / 1112 | 64% → **90%** | **+26pp** |
     | **codex_cli** (gpt-5.6-sol) | 130 / 1112 | 60% → **83%** | **+23pp** |
   - Use the exact agent and model names provided in the Evaluation Benchmarks data.
   - Always express uplift in percentage points (\`+XXpp\`).
   - Do NOT append extra bulleted commentary or "Key Takeaways" below the table.
   - Omit the section if \`Evaluation Benchmarks\` is empty.
5. **Omit Boilerplate**:
   - Do NOT mention version bumps across manifest files (\`package.json\`, \`plugin.json\`, \`marketplace.json\`, etc.).
6. **Required Template Structure**:
   # Release Notes: \`v${newVersion}\`

   ### 📖 Guidance & Web Platform Updates
   [Categorized subheadings or bullets as specified in rule 2]

   ### 🚀 Agent Ecosystem (omit if empty)
   * [Agent ecosystem bullet points]

   ### 📊 Benchmark Evaluations (omit if empty)
   | Agent + Model | Tasks / Assertions | Unguided → Guided Pass Rate | Uplift |
   | :--- | :---: | :---: | :---: |
   ...

   ---
   **Full Changelog**: https://github.com/GoogleChrome/modern-web-guidance/compare/${previousTag}...v${newVersion}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Gemini API error (${response.status}): ${errorText}. Falling back to default generator.`);
      return generateFallbackReleaseNotes(previousTag, newVersion, evalSummary, changedFiles);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.warn('Empty response from Gemini API. Falling back to default generator.');
      return generateFallbackReleaseNotes(previousTag, newVersion, evalSummary, changedFiles);
    }

    // Clean any wrapping markdown code blocks if the model returned ```markdown ... ```
const cleanedText = text
  .replace(/^
    return cleanedText;
  } catch (err) {
    console.warn('Failed to generate release notes with Gemini:', err);
    return generateFallbackReleaseNotes(previousTag, newVersion, evalSummary, changedFiles);
  }
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const shouldCreateRelease = process.argv.includes('--create-release');

  let targetTag = args[0];
  let prevTag = args[1];

  if (!targetTag) {
    const latest = execSync('git tag -l "v*.*.*" --sort=-v:refname | head -n 1', {
      encoding: 'utf8',
      cwd: rootDir,
    }).trim();
    targetTag = latest;
  }

  if (!prevTag) {
    prevTag = getPreviousTag(targetTag);
  }

  const version = targetTag.startsWith('v') ? targetTag.slice(1) : targetTag;

  console.log(`Generating release notes for ${targetTag} (comparing against ${prevTag})...\n`);

  generateReleaseNotes({
    previousTag: prevTag,
    newVersion: version,
    target: targetTag,
  }).then((notes) => {
    console.log('============================== RELEASE NOTES ==============================');
    console.log(notes);
    console.log('===========================================================================\n');

    if (shouldCreateRelease) {
      console.log(`Creating GitHub release ${targetTag} on GoogleChrome/modern-web-guidance...`);
      execSync(`gh release create "${targetTag}" -R GoogleChrome/modern-web-guidance --title "${targetTag}" --notes-file -`, {
        input: notes,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      console.log(`✅ GitHub release ${targetTag} created!`);
    }
  }).catch((err) => {
    console.error('Failed to generate release notes:', err);
    process.exit(1);
  });
}

