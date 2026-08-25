import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';
import { fileURLToPath } from 'node:url';
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
 * Checks if a JSON file diff represents only a version bump.
 */
export function isJsonOnlyVersionBump(oldFile: string, newFile: string): boolean {
  try {
    const oldObj = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
    const newObj = JSON.parse(fs.readFileSync(newFile, 'utf8'));

    delete oldObj.version;
    delete newObj.version;
    if (oldObj.plugins?.[0]) delete oldObj.plugins[0].version;
    if (newObj.plugins?.[0]) delete newObj.plugins[0].version;

    return JSON.stringify(oldObj) === JSON.stringify(newObj);
  } catch {
    return false;
  }
}

/**
 * Checks if a git diff patch represents only a version bump.
 */
export function isPatchOnlyVersionBump(patch?: string): boolean {
  if (!patch) return false;
  const changedLines = patch
    .split('\n')
    .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .map(l => l.slice(1).trim());

  return changedLines.length > 0 && changedLines.every(line => line.startsWith('"version":'));
}

/**
 * Predicate to determine if a changed file is a guidance document.
 */
export function isGuideFile(filePath: string): boolean {
  if (!filePath.endsWith('.md')) return false;
  if (filePath.endsWith('SKILL.md')) return true;
  return filePath.includes('guide.md') || filePath.includes('/guides/');
}

/**
 * Predicate to determine if a changed file is an agent plugin or manifest.
 */
export function isPluginFile(filePath: string): boolean {
  return (
    filePath.includes('-plugin') ||
    filePath.includes('plugin.json') ||
    filePath.includes('marketplace.json') ||
    filePath.includes('gemini-extension.json')
  );
}

/**
 * Extracts exact differences between the previous release and the newly built distribution payload.
 * Eliminates all heuristics by diffing the actual compiled output (dist/skills-cli).
 */
export function getExactDistributionDiff(previousTag: string, publishCliDir: string): {
  guideDiff: string;
  pluginDiff: string;
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
        pluginDiff: '',
        evalSummary: getLatestEvalResultsSummary(),
        changedFiles: [],
      };
    }

    const rawDiff = execSync(
      `git diff --no-index --name-status "${tempDir}" "${publishCliDir}" || true`,
      { encoding: 'utf8', cwd: rootDir }
    );

    const guideSections: string[] = [];
    const addedGuides: string[] = [];
    const modifiedGuidePatches: string[] = [];

    const pluginSections: string[] = [];
    const modifiedPluginPatches: string[] = [];

    const changedFiles: string[] = [];

    for (const line of rawDiff.trim().split('\n')) {
      if (!line.trim()) continue;
      const tabIndex = line.indexOf('\t');
      if (tabIndex === -1) continue;
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

      if (isGuideFile(relPath)) {
        if (status === 'A') {
          const fullBuiltPath = path.join(publishCliDir, relPath);
          if (fs.existsSync(fullBuiltPath) && !fs.lstatSync(fullBuiltPath).isSymbolicLink()) {
            const guideName = path.basename(relPath, '.md');
            addedGuides.push(`- **${guideName}** (Path: \`${relPath}\`)`);
            changedFiles.push(relPath);
          }
        } else if (status !== 'T' && status !== 'D') {
          const oldFile = path.join(tempDir, relPath);
          const newFile = path.join(publishCliDir, relPath);
          if (fs.existsSync(oldFile) && fs.existsSync(newFile)) {
            if (fs.lstatSync(newFile).isSymbolicLink()) {
              continue;
            }
            const fileDiff = execSync(
              `git diff --no-index -u "${oldFile}" "${newFile}" || true`,
              { encoding: 'utf8', cwd: rootDir }
            );
            if (fileDiff) {
              modifiedGuidePatches.push(`--- ${relPath} (${status}) ---\n${fileDiff}`);
              changedFiles.push(relPath);
            }
          } else if (fs.existsSync(newFile) && !fs.lstatSync(newFile).isSymbolicLink()) {
            modifiedGuidePatches.push(`--- ${relPath} (Added) ---`);
            changedFiles.push(relPath);
          }
        }
      } else if (isPluginFile(relPath) && status !== 'D') {
        const oldFile = path.join(tempDir, relPath);
        const newFile = path.join(publishCliDir, relPath);
        if (relPath.endsWith('.json') && fs.existsSync(oldFile) && fs.existsSync(newFile) && isJsonOnlyVersionBump(oldFile, newFile)) {
          continue;
        }
        if (fs.existsSync(oldFile) && fs.existsSync(newFile)) {
          const fileDiff = execSync(
            `git diff --no-index -u "${oldFile}" "${newFile}" || true`,
            { encoding: 'utf8', cwd: rootDir }
          );
          if (fileDiff) {
            modifiedPluginPatches.push(`--- ${relPath} (${status}) ---\n${fileDiff}`);
            changedFiles.push(relPath);
          }
        } else if (fs.existsSync(newFile)) {
          modifiedPluginPatches.push(`--- ${relPath} (Added) ---`);
          changedFiles.push(relPath);
        }
      } else if (status !== 'D') {
        changedFiles.push(relPath);
      }
    }

    if (addedGuides.length > 0) {
      guideSections.push(`### 🆕 Newly Added Guides:\n${addedGuides.join('\n\n')}`);
    }
    if (modifiedGuidePatches.length > 0) {
      guideSections.push(`### 🔄 Modified Files & Content Diff:\n${modifiedGuidePatches.join('\n\n')}`);
    }

    if (modifiedPluginPatches.length > 0) {
      pluginSections.push(`### 🚀 Agent Plugin Changes:\n${modifiedPluginPatches.join('\n\n')}`);
    }

    return {
      guideDiff: guideSections.join('\n\n'),
      pluginDiff: pluginSections.join('\n\n'),
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
  pluginDiff: string;
  evalSummary: EvalSummaryItem[];
  changedFiles: string[];
} {
  const ghOutput = execSync(
    `gh api repos/GoogleChrome/modern-web-guidance/compare/${previousTag}...${targetTag}`,
    { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
  ).trim();

  let guideDiff = '';
  let pluginDiff = '';
  const changedFiles: string[] = [];

  const compareData = JSON.parse(ghOutput);
  if (compareData.files && Array.isArray(compareData.files)) {
    const guideSections: string[] = [];
    const addedGuides: string[] = [];
    const modifiedGuidePatches: string[] = [];

    const pluginSections: string[] = [];
    const modifiedPluginPatches: string[] = [];

    for (const file of compareData.files) {
      if (isGuideFile(file.filename)) {
        if (file.status === 'added') {
          const guideName = path.basename(file.filename, '.md');
          addedGuides.push(`- **${guideName}** (Path: \`${file.filename}\`)`);
          changedFiles.push(file.filename);
        } else if (file.patch) {
          modifiedGuidePatches.push(`--- ${file.filename} (${file.status}) ---\n${file.patch}`);
          changedFiles.push(file.filename);
        }
      } else if (isPluginFile(file.filename) && file.status !== 'removed') {
        if (file.filename.endsWith('.json') && isPatchOnlyVersionBump(file.patch)) {
          continue;
        }
        if (file.patch) {
          modifiedPluginPatches.push(`--- ${file.filename} (${file.status}) ---\n${file.patch}`);
        } else if (file.status === 'added') {
          modifiedPluginPatches.push(`--- ${file.filename} (Added) ---`);
        }
        changedFiles.push(file.filename);
      } else if (file.status !== 'removed') {
        changedFiles.push(file.filename);
      }
    }

    if (addedGuides.length > 0) {
      guideSections.push(`### 🆕 Newly Added Guides:\n${addedGuides.join('\n')}`);
    }
    if (modifiedGuidePatches.length > 0) {
      guideSections.push(`### 🔄 Modified Files & Content Diff:\n${modifiedGuidePatches.join('\n\n')}`);
    }

    if (modifiedPluginPatches.length > 0) {
      pluginSections.push(`### 🚀 Agent Plugin Changes:\n${modifiedPluginPatches.join('\n\n')}`);
    }

    guideDiff = guideSections.join('\n\n');
    pluginDiff = pluginSections.join('\n\n');
  }

  const evalSummary = getLatestEvalResultsSummary();
  return { guideDiff, pluginDiff, evalSummary, changedFiles };
}

/**
 * Extracts unique guide identifiers from changed file paths.
 */
export function getUniqueGuideNames(changedFiles: string[]): string[] {
  const guideFiles = changedFiles.filter(isGuideFile);
  return Array.from(
    new Set(
      guideFiles.map(file => {
        if (file.endsWith('SKILL.md')) {
          return `${path.basename(path.dirname(file))}-skill`;
        }
        return path.basename(file) === 'guide.md'
          ? path.basename(path.dirname(file))
          : path.basename(file, '.md');
      })
    )
  );
}

/**
 * Parses markdown bullet points, merging multi-line continuations into their parent bullet.
 */
export function parseMarkdownBullets(text: string): string[] {
  const lines = text.split('\n');
  const bullets: string[] = [];
  let currentBullet = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (currentBullet) {
        bullets.push(currentBullet);
      }
      currentBullet = line;
    } else if (currentBullet) {
      currentBullet += ' ' + line;
    }
  }

  if (currentBullet) {
    bullets.push(currentBullet);
  }

  return bullets;
}

/**
 * Deterministically constructs release notes markdown from provided sections.
 */
export function buildReleaseNotesMarkdown(opts: {
  previousTag: string;
  newVersion: string;
  guideBullets: string[];
  ecosystemBullets: string[];
  evalSummary: EvalSummaryItem[];
}): string {
  const { previousTag, newVersion, guideBullets, ecosystemBullets, evalSummary } = opts;
  const sections: string[] = [`# Release Notes: \`v${newVersion}\`\n`];

  if (guideBullets.length > 0) {
    sections.push('### 📖 Guidance & Web Platform Updates\n');
    sections.push(guideBullets.join('\n'));
    sections.push('');
  }

  if (ecosystemBullets.length > 0) {
    sections.push('### 🚀 Agent Ecosystem\n');
    sections.push(ecosystemBullets.join('\n'));
    sections.push('');
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
 * Deterministic fallback generator when Gemini API is unavailable or fails validation.
 */
export function generateFallbackReleaseNotes(
  previousTag: string,
  newVersion: string,
  evalSummary: EvalSummaryItem[],
  changedFiles: string[]
): string {
  const uniqueGuideNames = getUniqueGuideNames(changedFiles);
  const pluginFiles = changedFiles.filter(isPluginFile);

  const guideBullets = uniqueGuideNames.map(
    guideName => `* **${guideName}**: Updates and improvements to web platform guidance.`
  );

  const ecosystemBullets = pluginFiles.map(
    file => `* **${file}**: Updates to agent plugin configuration.`
  );

  return buildReleaseNotesMarkdown({
    previousTag,
    newVersion,
    guideBullets,
    ecosystemBullets,
    evalSummary,
  });
}

/**
 * Uses Gemini to generate bullet summaries for changed guides.
 * Returns null if the API call fails or if output fails bullet-count validation.
 */
export async function generateGuideSummariesWithGemini(opts: {
  guideDiff: string;
  guideNames?: string[];
  expectedGuideCount: number;
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { guideDiff, guideNames = [], expectedGuideCount, apiKey, model } = opts;
  if (!guideDiff.trim() || expectedGuideCount === 0) {
    return [];
  }

  const guidesListSection =
    guideNames.length > 0
      ? `\n### Changed Guides to Summarize (${expectedGuideCount} total):\n${guideNames.map(g => `- ${g}`).join('\n')}\n`
      : '';

  const prompt = `You are writing concise release note bullet points for guidance changes in GoogleChrome/modern-web-guidance.
${guidesListSection}
### Consumer-facing Guide Changes / Diff:
${guideDiff}

### Core Formatting Rules:
1. Output exactly ${expectedGuideCount} Markdown bullet points (starting with '* ' or '- ')${guideNames.length > 0 ? ', one for each changed guide listed above' : ''}.
2. Each bullet must describe one modified or new guide in a single concise sentence or short paragraph explaining the use case or key platform evolution.
3. Keep each bullet point on a single line without manual line breaks.
4. Bold the title or subject of the guide in each bullet (e.g., "* Updated the **Dynamic Sibling Styling** guide to ...").
5. NEVER use nested sub-bullets or multiple bullet points for a single guide.
6. Do NOT include headings, sections, benchmark tables, code blocks, or preamble. Output ONLY the ${expectedGuideCount} bullet points.`;

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
      console.warn(`Gemini API error (${response.status}): ${errorText}`);
      return null;
    }

    const data = (await response.json()) as any;
    const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.warn('Empty response from Gemini API.');
      return null;
    }

    const cleanedText: string = text
      .replace(/^```(?:markdown|md)?\r?\n/, '')
      .replace(/\r?\n```$/, '')
      .trim();

    const bullets = parseMarkdownBullets(cleanedText);

    // Runtime validation: ensure exact count of guide bullets
    if (bullets.length !== expectedGuideCount) {
      console.warn(
        `Gemini guide summary validation failed: expected ${expectedGuideCount} bullets, received ${bullets.length}.`
      );
      return null;
    }

    return bullets;
  } catch (err) {
    console.warn('Failed to generate guide summaries with Gemini:', err);
    return null;
  }
}

/**
 * Uses Gemini to generate bullet summaries for agent ecosystem / plugin changes.
 * Returns null if the API call fails or if output fails validation.
 */
export async function generateEcosystemSummariesWithGemini(opts: {
  pluginDiff: string;
  pluginFiles: string[];
  apiKey: string;
  model: string;
}): Promise<string[] | null> {
  const { pluginDiff, pluginFiles, apiKey, model } = opts;
  if (!pluginDiff.trim() || pluginFiles.length === 0) {
    return [];
  }

  const prompt = `You are writing concise release note bullet points for agent ecosystem and plugin marketplace changes in GoogleChrome/modern-web-guidance.

### Changed Plugin Files:
${pluginFiles.map(p => `- ${p}`).join('\n')}

### Agent Plugin Diff / Changes:
${pluginDiff}

### Core Formatting Rules:
1. Output concise Markdown bullet points (starting with '* ' or '- ') describing what was added or updated across the affected agent platforms, IDEs, or marketplaces.
2. Bold the name of each agent platform, IDE, or marketplace (e.g., "* Added support for the **Grok** plugin marketplace.").
3. Output at least 1 and at most ${pluginFiles.length} bullet points.
4. Do NOT mention rote version bumps.
5. Keep each bullet point on a single line without manual line breaks.
6. Do NOT include headings, sections, or preamble. Output ONLY the bullet points.`;

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
      console.warn(`Gemini API error (${response.status}): ${errorText}`);
      return null;
    }

    const data = (await response.json()) as any;
    const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      console.warn('Empty response from Gemini API.');
      return null;
    }

    const cleanedText: string = text
      .replace(/^```(?:markdown|md)?\r?\n/, '')
      .replace(/\r?\n```$/, '')
      .trim();

    const bullets = parseMarkdownBullets(cleanedText);

    // Validation: ensure at least 1 bullet and at most pluginFiles.length bullets
    if (bullets.length === 0 || bullets.length > pluginFiles.length) {
      console.warn(
        `Gemini ecosystem summary validation failed: received ${bullets.length} bullets for ${pluginFiles.length} plugin files.`
      );
      return null;
    }

    return bullets;
  } catch (err) {
    console.warn('Failed to generate ecosystem summaries with Gemini:', err);
    return null;
  }
}

/**
 * Generates consumer-facing release notes using Gemini for guide summaries
 * while deterministically building structure, headings, tables, and changelogs.
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

  const { guideDiff, pluginDiff, evalSummary, changedFiles } =
    publishCliDir && fs.existsSync(publishCliDir)
      ? getExactDistributionDiff(previousTag, publishCliDir)
      : getConsumerFacingDiff(previousTag, target);

  const uniqueGuideNames = getUniqueGuideNames(changedFiles);
  const pluginFiles = changedFiles.filter(isPluginFile);

  if (!apiKey) {
    if (uniqueGuideNames.length > 0 || pluginFiles.length > 0) {
      console.log('No GEMINI_API_KEY found. Generating fallback release notes...');
    }
    return generateFallbackReleaseNotes(previousTag, newVersion, evalSummary, changedFiles);
  }

  let guideBullets: string[] = [];
  if (uniqueGuideNames.length > 0) {
    const generatedGuideBullets = await generateGuideSummariesWithGemini({
      guideDiff,
      guideNames: uniqueGuideNames,
      expectedGuideCount: uniqueGuideNames.length,
      apiKey,
      model,
    });
    if (generatedGuideBullets) {
      guideBullets = generatedGuideBullets;
    } else {
      console.log('Falling back to default guide release notes generator...');
      guideBullets = uniqueGuideNames.map(
        guideName => `* **${guideName}**: Updates and improvements to web platform guidance.`
      );
    }
  }

  let ecosystemBullets: string[] = [];
  if (pluginFiles.length > 0) {
    const generatedEcosystemBullets = await generateEcosystemSummariesWithGemini({
      pluginDiff,
      pluginFiles,
      apiKey,
      model,
    });
    if (generatedEcosystemBullets) {
      ecosystemBullets = generatedEcosystemBullets;
    } else {
      console.log('Falling back to default ecosystem release notes generator...');
      ecosystemBullets = pluginFiles.map(
        file => `* **${file}**: Updates to agent plugin configuration.`
      );
    }
  }

  return buildReleaseNotesMarkdown({
    previousTag,
    newVersion,
    guideBullets,
    ecosystemBullets,
    evalSummary,
  });
}

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
