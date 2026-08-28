import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import { minimatch } from 'minimatch';
import { features } from 'web-features';
import { rootDir } from '../../lib/paths.ts';
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

export interface BaselineUpdateInfo {
  featureName: string;
  featureId?: string;
  statusRank: number; // 1: Widely, 2: Newly, 3: Limited
  statusDescription: string;
  guideName: string;
}

export interface RawChangeRecord {
  relPath: string;
  status: string; // 'A', 'M', 'D', 'R', 'added', 'modified', 'removed', 'renamed'
  oldPath?: string;
  patch?: string;
  isLink?: boolean;
}

export interface ClassifiedChanges {
  addedGuidesDiff: string;
  modifiedGuidesDiff: string;
  addedGuideNames: string[];
  modifiedGuideNames: string[];
  removedGuideNames: string[];
  renamedGuides: Array<{ oldName: string; newName: string }>;
  guideDescriptions: Record<string, string>;
  pluginDiff: string;
  baselineUpdates: BaselineUpdateInfo[];
  changedFiles: string[];
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

// Canonical lines produced by formatStatusMessage() in serving/lib/baseline.ts and baseline macros
const BASELINE_OUTPUT_PATTERNS = [
  /^Baseline status for /i,
  /has limited availability\./i,
  /is not natively supported by any major browser yet\./i,
  /^Supported by:\s*(Chrome|Firefox|Safari|Edge|iOS)/i,
  /^Unsupported in:\s*(Chrome|Firefox|Safari|Edge|iOS)/i,
  /^<!--\s*(?:baseline:|MACRO:(?:BASELINE_STATUS|FEATURE_FALLBACKS))/i,
  /^>\s*Baseline:\s*\[/i,
];

export function getPreviousTag(targetTag: string): string {
  let tags: string[] = [];

  try {
    const output = execSync('git tag -l "v*.*.*" --sort=-v:refname', {
      encoding: 'utf8',
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    tags = output.split('\n').map(t => t.trim()).filter(Boolean);
  } catch {}

  if (tags.length === 0) {
    try {
      const ghOutput = execSync(
        `gh api --paginate repos/GoogleChrome/modern-web-guidance/tags --jq '.[].name'`,
        { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      tags = ghOutput.split('\n').map(t => t.trim()).filter(Boolean);
    } catch {}
  }

  const targetIndex = tags.indexOf(targetTag);
  if (targetIndex !== -1 && targetIndex + 1 < tags.length) {
    return tags[targetIndex + 1];
  }
  if (tags.length > 0) {
    return tags[0];
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
 * Checks if a git diff patch contains any Baseline status or browser support updates.
 */
export function hasBaselineUpdateInPatch(patch?: string): boolean {
  if (!patch) return false;
  const addedLines = patch
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1).trim());

  return addedLines.some(line => BASELINE_OUTPUT_PATTERNS.some(p => p.test(line)));
}

/**
 * Checks if a git diff patch represents only Baseline status or browser support updates.
 */
export function isPatchOnlyBaselineUpdate(patch?: string): boolean {
  if (!patch) return false;
  const changedLines = patch
    .split('\n')
    .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
    .map(l => l.slice(1).trim());

  if (changedLines.length === 0) return false;

  return changedLines.every(line => {
    if (!line) return true;
    return BASELINE_OUTPUT_PATTERNS.some(pattern => pattern.test(line));
  });
}

/**
 * Strips out Baseline status and browser support lines from a diff patch,
 * leaving only substantive code and documentation changes.
 */
export function stripBaselineLinesFromPatch(patch?: string): string {
  if (!patch) return '';
  const lines = patch.split('\n');
  const filtered = lines.filter(line => {
    if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---')) {
      const content = line.slice(1).trim();
      return !BASELINE_OUTPUT_PATTERNS.some(pattern => pattern.test(content));
    }
    return true;
  });
  return filtered.join('\n');
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function parseEngineMap(line?: string): Map<string, { raw: string; name: string; version: string }> {
  if (!line) return new Map();
  const regex = /(Chrome|Firefox|Safari(?:\s+iOS)?|Edge)\s+(\d+(?:\.\d+)?)/gi;
  const map = new Map<string, { raw: string; name: string; version: string }>();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    const key = m[1].toLowerCase().replace(/\s+/g, '_');
    map.set(key, { raw: m[0], name: m[1], version: m[2] });
  }
  return map;
}

/**
 * Extracts structured Baseline / browser support update info from a single hunk or patch block.
 */
export function parseBaselineUpdateFromHunk(guideName: string, hunk: string): BaselineUpdateInfo | null {
  const addedLines = hunk
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .map(l => l.slice(1).trim());

  const removedLines = hunk
    .split('\n')
    .filter(l => l.startsWith('-') && !l.startsWith('---'))
    .map(l => l.slice(1).trim());

  let featureName = '';
  let statusRank = 3;
  let statusDescription = 'Updated browser engine support';

  // 1. Check added lines for a status transition
  for (const line of addedLines) {
    const match = line.match(/Baseline status for\s+(.+?):\s*(Widely available|Newly available)/i);
    if (match) {
      featureName = match[1].trim();
      const status = match[2].trim().toLowerCase();
      if (status.includes('widely')) {
        statusRank = 1;
        statusDescription = 'Now **Baseline Widely available**';
      } else if (status.includes('newly')) {
        statusRank = 2;
        statusDescription = 'Now **Baseline Newly available**';
      }
      break;
    }
  }

  // 2. If status line didn't change (e.g. engine update in Limited status), extract featureName from hunk context
  if (!featureName) {
    const match = hunk.match(/(?:Baseline status for\s+(.+?):|(.+?)\s+has limited availability)/i);
    if (match) {
      featureName = (match[1] || match[2]).trim();
    }
  }

  // If the feature name cannot be extracted, omit this update
  if (!featureName) {
    return null;
  }

  if (statusRank === 3) {
    const addedSupported = addedLines.find(l => l.includes('Supported by:'));
    const removedSupported = removedLines.find(l => l.includes('Supported by:'));
    if (addedSupported) {
      const addedMap = parseEngineMap(addedSupported);
      const removedMap = parseEngineMap(removedSupported);

      const brandNew: string[] = [];
      const removedEngines: string[] = [];
      const versionUpdated: string[] = [];

      for (const [key, info] of addedMap.entries()) {
        if (!removedMap.has(key)) {
          brandNew.push(info.raw);
        } else if (removedMap.get(key)!.version !== info.version) {
          versionUpdated.push(info.name);
        }
      }

      for (const [key, info] of removedMap.entries()) {
        if (!addedMap.has(key)) {
          // If a mobile-specific variant (e.g. safari_ios, chrome_android, firefox_android)
          // is omitted because the desktop base engine is now supported, it was consolidated into full support.
          const baseKey = key.replace(/_(?:ios|android)$/, '');
          if (baseKey !== key && addedMap.has(baseKey)) {
            continue;
          }
          removedEngines.push(info.name);
        }
      }

      const clauses: string[] = [];
      if (brandNew.length > 0) {
        clauses.push(`Added **${formatList(brandNew)}** support`);
      }
      if (removedEngines.length > 0) {
        const verb = clauses.length > 0 ? 'removed' : 'Removed';
        clauses.push(`${verb} **${formatList(removedEngines)}** support`);
      }
      if (versionUpdated.length > 0) {
        const plural = versionUpdated.length > 1 ? 'versions' : 'version';
        const verb = clauses.length > 0 ? 'updated' : 'Updated';
        clauses.push(`${verb} supported browser ${plural} for **${formatList(versionUpdated)}**`);
      }

      if (clauses.length > 0) {
        statusDescription = formatList(clauses);
      }
    }
  }

  const featureId = resolveWebFeatureId(featureName);

  return {
    featureName,
    featureId,
    statusRank,
    statusDescription,
    guideName,
  };
}

/**
 * Extracts all Baseline / browser support update infos from a patch (supporting multi-hunk diffs).
 */
export function parseBaselineUpdatesFromPatch(guideName: string, patch: string): BaselineUpdateInfo[] {
  const hunks = patch.split(/(?=@@ -\d+)/g).filter(h => h.trim());
  const updates: BaselineUpdateInfo[] = [];
  for (const hunk of hunks) {
    if (hasBaselineUpdateInPatch(hunk)) {
      const update = parseBaselineUpdateFromHunk(guideName, hunk);
      if (update) {
        updates.push(update);
      }
    }
  }
  return updates;
}

export function parseBaselineUpdateFromPatch(guideName: string, patch: string): BaselineUpdateInfo | null {
  return parseBaselineUpdatesFromPatch(guideName, patch)[0] || null;
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
 * Extracts the canonical guide name from a file path.
 */
export function getGuideName(filePath: string): string {
  if (filePath.endsWith('SKILL.md')) {
    return `${path.basename(path.dirname(filePath))}-skill`;
  }
  return path.basename(filePath) === 'guide.md'
    ? path.basename(path.dirname(filePath))
    : path.basename(filePath, '.md');
}

/**
 * Extracts the guide description from YAML frontmatter on disk using the file's relative path.
 */
export function getGuideDescription(relPath: string): string | undefined {
  // If relPath is already a direct path to a source file in modern-web-guidance-src
  const directPath = path.join(rootDir, relPath);
  if (fs.existsSync(directPath)) {
    try {
      const { data } = matter(fs.readFileSync(directPath, 'utf8'));
      if (data.description) return String(data.description).trim();
    } catch {}
  }

  // If relPath is from the distribution structure:
  // 1. skills/<skill>/SKILL.md -> skills-src/<skill>/SKILL.md
  if (relPath.startsWith('skills/') && relPath.endsWith('SKILL.md')) {
    const skillSrc = path.join(rootDir, relPath.replace(/^skills\//, 'skills-src/'));
    if (fs.existsSync(skillSrc)) {
      try {
        const { data } = matter(fs.readFileSync(skillSrc, 'utf8'));
        if (data.description) return String(data.description).trim();
      } catch {}
    }
  }

  // 2. skills/modern-web-guidance/guides/<category>/<name>.md -> guides/<category>/<name>/guide.md
  const match = relPath.match(/guides\/([^/]+)\/([^/]+)\.md$/);
  if (match) {
    const [, category, name] = match;
    const guideSrc = path.join(rootDir, 'guides', category, name, 'guide.md');
    if (fs.existsSync(guideSrc)) {
      try {
        const { data } = matter(fs.readFileSync(guideSrc, 'utf8'));
        if (data.description) return String(data.description).trim();
      } catch {}
    }
  }

  return undefined;
}

export function getUniqueGuideNames(changedFiles: string[]): string[] {
  const guideFiles = changedFiles.filter(isGuideFile);
  return Array.from(new Set(guideFiles.map(getGuideName)));
}

export const GITHUB_REPO_URL = 'https://github.com/GoogleChrome/modern-web-guidance';

/**
 * Resolves the relative path of a guide or skill within the published modern-web-guidance repository.
 */
export function getGuidePathInDistribution(guideName: string): string | undefined {
  if (guideName.endsWith('-skill')) {
    const skillBase = guideName.slice(0, -'-skill'.length);
    return `skills/${skillBase}/SKILL.md`;
  }

  // Check standalone skills in skills-src
  const skillSrcPath = path.join(rootDir, 'skills-src', guideName, 'SKILL.md');
  if (fs.existsSync(skillSrcPath)) {
    return `skills/${guideName}/SKILL.md`;
  }

  // Check discipline or category skills in guides/
  const categorySkillPath = path.join(rootDir, 'guides', guideName, 'SKILL.md');
  if (fs.existsSync(categorySkillPath)) {
    return `skills/modern-web-guidance/SKILL.md`;
  }

  // Scan guides/ to find the category for guideName
  const guidesRootDir = path.join(rootDir, 'guides');
  if (fs.existsSync(guidesRootDir)) {
    try {
      const categories = fs.readdirSync(guidesRootDir, { withFileTypes: true });
      for (const cat of categories) {
        if (!cat.isDirectory() || cat.name.startsWith('.') || cat.name === 'node_modules') continue;
        const candidateDir = path.join(guidesRootDir, cat.name, guideName);
        if (fs.existsSync(candidateDir) && fs.existsSync(path.join(candidateDir, 'guide.md'))) {
          return `skills/modern-web-guidance/guides/${cat.name}/${guideName}.md`;
        }
      }
    } catch {}
  }

  return undefined;
}

/**
 * Returns the direct GitHub URL for a guide or skill in GoogleChrome/modern-web-guidance.
 */
export function getGuideGithubUrl(guideName: string, ref = 'main'): string | undefined {
  const relPath = getGuidePathInDistribution(guideName);
  if (!relPath) return undefined;
const normalizedRef = /^\d+\./.test(ref) ? `v${ref}` : ref;
  return `${GITHUB_REPO_URL}/blob/${normalizedRef}/${relPath}`;
}

/**
 * Formats a guide name as a markdown bold link if a URL is resolved, or plain bold if not.
 */
export function formatGuideBoldLink(guideName: string, ref = 'main'): string {
  const url = getGuideGithubUrl(guideName, ref);
  return url ? `**[${guideName}](${url})**` : `**${guideName}**`;
}

// Lookup mapping feature display names to canonical web-feature IDs
const featureNameToIdMap = new Map<string, string>();
for (const [id, f] of Object.entries(features)) {
  if (f.kind === 'feature') {
    featureNameToIdMap.set(f.name, id);
  }
}

/**
 * Resolves the canonical web-features featureId from a feature display name.
 */
export function resolveWebFeatureId(featureName: string): string | undefined {
  return featureNameToIdMap.get(featureName);
}

/**
 * Returns the webstatus.dev feature URL if a feature ID is resolved.
 */
export function getWebStatusUrl(featureName: string): string | undefined {
  const featureId = resolveWebFeatureId(featureName);
  return featureId ? `https://webstatus.dev/features/${featureId}` : undefined;
}

/**
 * Formats a web feature name as a markdown bold link to webstatus.dev if resolved, or plain bold if not.
 */
export function formatWebFeatureBoldLink(featureName: string, featureId?: string): string {
  const resolvedId = featureId || resolveWebFeatureId(featureName);
  return resolvedId
    ? `**[${featureName}](https://webstatus.dev/features/${resolvedId})**`
    : `**${featureName}**`;
}

/**
 * Formats a guide name as a markdown code link if a URL is resolved, or plain code if not.
 */
export function formatGuideCodeLink(guideName: string, ref = 'main'): string {
  const url = getGuideGithubUrl(guideName, ref);
  return url ? `[\`${guideName}\`](${url})` : `\`${guideName}\``;
}

/**
 * Unified classification pipeline that maps raw change records to structured sections.
 */
export function classifyChanges(records: RawChangeRecord[]): ClassifiedChanges {
  const addedGuidePatches: string[] = [];
  const modifiedGuidePatches: string[] = [];
  const modifiedPluginPatches: string[] = [];
  const baselineUpdates: BaselineUpdateInfo[] = [];
  const changedFiles: string[] = [];

  const addedGuideNamesSet = new Set<string>();
  const modifiedGuideNamesSet = new Set<string>();
  const removedGuideNamesSet = new Set<string>();
  const renamedGuides: Array<{ oldName: string; newName: string }> = [];
  const guideDescriptions: Record<string, string> = {};

  for (const record of records) {
    const { relPath, status, patch, isLink, oldPath } = record;
    if (isLink) {
      continue;
    }

    const isRemoved = status === 'D' || status === 'removed';
    const isAdded = status === 'A' || status === 'added';
    const isRenamed = status === 'R' || status === 'renamed' || status.startsWith('R');

    if (isGuideFile(relPath)) {
      const guideName = getGuideName(relPath);

      if (isRemoved) {
        removedGuideNamesSet.add(guideName);
        changedFiles.push(relPath);
      } else if (isRenamed) {
        const oldGuideName = oldPath ? getGuideName(oldPath) : guideName;
        if (oldGuideName !== guideName) {
          renamedGuides.push({ oldName: oldGuideName, newName: guideName });
        }
        changedFiles.push(relPath);
        if (patch) {
          if (hasBaselineUpdateInPatch(patch)) {
            baselineUpdates.push(...parseBaselineUpdatesFromPatch(guideName, patch));
          }
          if (!isPatchOnlyBaselineUpdate(patch)) {
            const renameNote = oldGuideName !== guideName
              ? ` (Renamed from ${oldPath || oldGuideName})`
              : '';
            const substantivePatch = stripBaselineLinesFromPatch(patch);
            modifiedGuidePatches.push(`--- ${relPath}${renameNote} ---\n${substantivePatch}`);
            modifiedGuideNamesSet.add(guideName);
          }
        }
      } else if (isAdded) {
        const substantivePatch = stripBaselineLinesFromPatch(patch);
        addedGuidePatches.push(`- **${guideName}** (Path: \`${relPath}\`)${substantivePatch ? `\n${substantivePatch}` : ''}`);
        addedGuideNamesSet.add(guideName);
        const desc = getGuideDescription(relPath);
        if (desc) {
          guideDescriptions[guideName] = desc;
        }
        changedFiles.push(relPath);
      } else if (patch) {
        if (hasBaselineUpdateInPatch(patch)) {
          baselineUpdates.push(...parseBaselineUpdatesFromPatch(guideName, patch));
        }
        if (!isPatchOnlyBaselineUpdate(patch)) {
          const substantivePatch = stripBaselineLinesFromPatch(patch);
          modifiedGuidePatches.push(`--- ${relPath} (${status}) ---\n${substantivePatch}`);
          modifiedGuideNamesSet.add(guideName);
          changedFiles.push(relPath);
        }
      }
    } else if (isPluginFile(relPath)) {
      if (isRemoved) {
        modifiedPluginPatches.push(`--- ${relPath} (Removed) ---`);
        changedFiles.push(relPath);
      } else if (relPath.endsWith('.json') && isPatchOnlyVersionBump(patch)) {
        continue;
      } else if (patch) {
        modifiedPluginPatches.push(`--- ${relPath} (${status}) ---\n${patch}`);
        changedFiles.push(relPath);
      } else if (isAdded) {
        modifiedPluginPatches.push(`--- ${relPath} (Added) ---`);
        changedFiles.push(relPath);
      }
    } else {
      if (!isRemoved) {
        changedFiles.push(relPath);
      }
    }
  }

  // Ensure mutually exclusive sets
  for (const name of addedGuideNamesSet) {
    modifiedGuideNamesSet.delete(name);
    removedGuideNamesSet.delete(name);
  }
  for (const name of modifiedGuideNamesSet) {
    removedGuideNamesSet.delete(name);
  }

  const addedGuideNames = Array.from(addedGuideNamesSet);
  const modifiedGuideNames = Array.from(modifiedGuideNamesSet);
  const removedGuideNames = Array.from(removedGuideNamesSet);

  const addedGuidesDiff = addedGuidePatches.length > 0
    ? `### 🆕 Newly Added Guides:\n${addedGuidePatches.join('\n')}`
    : '';
  const modifiedGuidesDiff = modifiedGuidePatches.length > 0
    ? `### 🔄 Modified Files & Content Diff:\n${modifiedGuidePatches.join('\n\n')}`
    : '';

  const pluginSections: string[] = [];
  if (modifiedPluginPatches.length > 0) {
    pluginSections.push(`### 🚀 Agent Plugin Changes:\n${modifiedPluginPatches.join('\n\n')}`);
  }

  return {
    addedGuidesDiff,
    modifiedGuidesDiff,
    addedGuideNames,
    modifiedGuideNames,
    removedGuideNames,
    renamedGuides,
    guideDescriptions,
    pluginDiff: pluginSections.join('\n\n'),
    baselineUpdates,
    changedFiles,
  };
}

export type ClassifiedChangesWithEvals = ClassifiedChanges & {
  evalSummary: EvalSummaryItem[];
};

/**
 * Extracts latest eval results from eval-results-summary.json
 */
export function getLatestEvalResultsSummary(): EvalSummaryItem[] {
  const summaryPath = path.join(rootDir, 'serving/skills-cli/eval-results-summary.json');
  if (!fs.existsSync(summaryPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as EvalSummaryItem[];
    if (!Array.isArray(data) || data.length === 0) return [];

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
 * Convenience wrapper attaching the latest eval benchmark results from disk to classified changes.
 */
export function classifyChangesWithEvals(records: RawChangeRecord[]): ClassifiedChangesWithEvals {
  return {
    ...classifyChanges(records),
    evalSummary: getLatestEvalResultsSummary(),
  };
}

/**
 * Extracts exact differences between the previous release and the newly built distribution payload.
 * Eliminates all heuristics by diffing the actual compiled output (dist/skills-cli).
 */
export function getExactDistributionDiff(previousTag: string, publishCliDir: string): ClassifiedChangesWithEvals {
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
      return classifyChangesWithEvals([]);
    }

    const rawDiff = execSync(
      `git diff --no-index -M --name-status "${tempDir}" "${publishCliDir}" || true`,
      { encoding: 'utf8', cwd: rootDir }
    );

    const records: RawChangeRecord[] = [];

    for (const line of rawDiff.trim().split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const status = parts[0].trim();
      let relPath: string;
      let oldPath: string | undefined;

      if (parts.length >= 3 && status.startsWith('R')) {
        oldPath = path.relative(tempDir, parts[1].trim());
        relPath = path.relative(publishCliDir, parts[2].trim());
      } else {
        const targetFile = parts[1].trim();
        relPath = targetFile.startsWith(tempDir)
          ? path.relative(tempDir, targetFile)
          : path.relative(publishCliDir, targetFile);
      }

      const isAllowed = GH_PUBLISH_PATTERNS.every(pattern => {
        if (pattern.startsWith('!')) {
          return !minimatch(relPath, pattern.slice(1), { dot: true });
        }
        return minimatch(relPath, pattern, { dot: true });
      });

      if (!isAllowed) continue;

      const fullBuiltPath = path.join(publishCliDir, relPath);
      const isLink = fs.existsSync(fullBuiltPath) && fs.lstatSync(fullBuiltPath).isSymbolicLink();

      let patch: string | undefined;
      if ((isGuideFile(relPath) || isPluginFile(relPath)) && status !== 'A' && status !== 'D' && status !== 'T') {
        const oldFile = oldPath ? path.join(tempDir, oldPath) : path.join(tempDir, relPath);
        if (fs.existsSync(oldFile) && fs.existsSync(fullBuiltPath)) {
          if (relPath.endsWith('.json') && isJsonOnlyVersionBump(oldFile, fullBuiltPath)) {
            continue;
          }
          patch = execSync(
            `git diff --no-index -u "${oldFile}" "${fullBuiltPath}" || true`,
            { encoding: 'utf8', cwd: rootDir }
          ) || undefined;
        }
      }

      records.push({ relPath, oldPath, status, patch, isLink });
    }

    return classifyChangesWithEvals(records);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Extracts consumer-facing git diff by querying GoogleChrome/modern-web-guidance comparison API.
 */
export function getConsumerFacingDiff(previousTag: string, targetTag: string): ClassifiedChangesWithEvals {
  const ghOutput = execSync(
    `gh api repos/GoogleChrome/modern-web-guidance/compare/${previousTag}...${targetTag}`,
    { encoding: 'utf8', cwd: rootDir, stdio: ['pipe', 'pipe', 'ignore'] }
  ).trim();

  const compareData = JSON.parse(ghOutput);
  const records: RawChangeRecord[] = (compareData.files || []).map((file: any) => ({
    relPath: file.filename,
    status: file.status,
    oldPath: file.previous_filename,
    patch: file.patch,
  }));

  return classifyChangesWithEvals(records);
}

