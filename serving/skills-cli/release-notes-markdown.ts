import {
  GITHUB_REPO_URL,
  isPluginFile,
  getUniqueGuideNames,
  getGuideGithubUrl,
  formatGuideBoldLink,
  formatGuideCodeLink,
  formatWebFeatureBoldLink,
  type BaselineUpdateInfo,
  type EvalSummaryItem,
} from './release-notes-diff.ts';

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensures that guide identifiers within bullet points are linked to their document in the modern-web-guidance repository.
 */
export function linkifyGuideBullets(bullets: string[], guideNames: string[], ref = 'main'): string[] {
  return bullets.map((bullet, idx) => {
    let result = bullet;
    const prioritizedGuides = guideNames[idx]
      ? [guideNames[idx], ...guideNames.filter((_, i) => i !== idx)]
      : guideNames;

    for (const guideName of prioritizedGuides) {
      const url = getGuideGithubUrl(guideName, ref);
      if (!url) continue;

      // Skip if this URL is already linked in the bullet
      if (result.includes(`](${url})`)) continue;

      // Replace bold markdown: **guideName**
      const exactBoldRegex = new RegExp(`(?<!\\[)\\*\\*${escapeRegExp(guideName)}\\*\\*(?!\\]\\()`, 'gi');
      if (exactBoldRegex.test(result)) {
        result = result.replace(exactBoldRegex, (match) => {
          const inner = match.slice(2, -2);
          return `**[${inner}](${url})**`;
        });
        continue;
      }

      // Replace code markdown: `guideName` (case-sensitive to avoid false positives on API symbols)
      const codeRegex = new RegExp(`(?<!\\[)\`${escapeRegExp(guideName)}\`(?!\\]\\()`, 'g');
      if (codeRegex.test(result)) {
        result = result.replace(codeRegex, (match) => {
          return `[${match}](${url})`;
        });
      }
    }
    return result;
  });
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
 * Deterministically constructs ordered bullet points for Baseline updates.
 * Sorted order: Widely available (1) -> Newly available (2) -> Limited availability (3).
 */
export function buildBaselineBullets(updates: BaselineUpdateInfo[], ref = 'main'): string[] {
  const grouped = new Map<string, { featureName: string; featureId?: string; statusRank: number; statusDescription: string; guides: string[] }>();

  for (const update of updates) {
    const key = `${update.featureName}::${update.statusRank}::${update.statusDescription}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        featureName: update.featureName,
        featureId: update.featureId,
        statusRank: update.statusRank,
        statusDescription: update.statusDescription,
        guides: [],
      });
    }
    grouped.get(key)!.guides.push(update.guideName);
  }

  const entries = Array.from(grouped.values());

  // Sort strictly: Widely (1) -> Newly (2) -> Limited (3), then alphabetically by featureName
  entries.sort((a, b) => {
    if (a.statusRank !== b.statusRank) {
      return a.statusRank - b.statusRank;
    }
    return a.featureName.localeCompare(b.featureName);
  });

  return entries.map(entry => {
    const uniqueGuides = Array.from(new Set(entry.guides));
    const featureLink = formatWebFeatureBoldLink(entry.featureName, entry.featureId);
    if (uniqueGuides.length === 1) {
      const guideLink = formatGuideCodeLink(uniqueGuides[0], ref);
      return `* ${featureLink}: ${entry.statusDescription} in ${guideLink}.`;
    }
    const guidesList = uniqueGuides.map(g => formatGuideCodeLink(g, ref)).join(', ');
    return `* ${featureLink}: ${entry.statusDescription} across ${uniqueGuides.length} guides (${guidesList}).`;
  });
}

export interface BuildReleaseNotesMarkdownOptions {
  previousTag: string;
  newVersion: string;
  newGuideBullets?: string[];
  updatedGuideBullets?: string[];
  removedGuideBullets?: string[];
  baselineBullets?: string[];
  ecosystemBullets?: string[];
  evalSummary?: EvalSummaryItem[];
}

/**
 * Deterministically constructs release notes markdown from provided sections.
 */
export function buildReleaseNotesMarkdown(opts: BuildReleaseNotesMarkdownOptions): string {
  const {
    previousTag,
    newVersion,
    newGuideBullets = [],
    updatedGuideBullets = [],
    removedGuideBullets = [],
    baselineBullets = [],
    ecosystemBullets = [],
    evalSummary = [],
  } = opts;
  const sections: string[] = [`# Release Notes: \`v${newVersion}\`\n`];

  if (newGuideBullets.length > 0) {
    sections.push('## 🆕 New Guides\n');
    sections.push(newGuideBullets.join('\n'));
    sections.push('');
  }

  if (updatedGuideBullets.length > 0) {
    sections.push('## 🔄 Updated Guides\n');
    sections.push(updatedGuideBullets.join('\n'));
    sections.push('');
  }

  if (removedGuideBullets.length > 0) {
    sections.push('## 🗑️ Removed Guides\n');
    sections.push(removedGuideBullets.join('\n'));
    sections.push('');
  }

  if (baselineBullets.length > 0) {
    sections.push('## 🌐 Browser Support Updates\n');
    sections.push(baselineBullets.join('\n'));
    sections.push('');
  }

  if (ecosystemBullets.length > 0) {
    sections.push('## 🔌 Plugins\n');
    sections.push(ecosystemBullets.join('\n'));
    sections.push('');
  }

  if (evalSummary.length > 0) {
    sections.push('## 📊 Benchmark Evaluations\n');
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
  sections.push(`**Full Changelog**: ${GITHUB_REPO_URL}/compare/${previousTag}...v${newVersion}`);

  return sections.join('\n');
}

/**
 * Deterministic fallback generator when Gemini API is unavailable or fails validation.
 */
export function generateFallbackReleaseNotes(
  previousTag: string,
  newVersion: string,
  evalSummary: EvalSummaryItem[],
  changedFiles: string[],
  baselineUpdates: BaselineUpdateInfo[] = [],
  categorized?: {
    addedGuideNames?: string[];
    modifiedGuideNames?: string[];
    removedGuideNames?: string[];
    guideDescriptions?: Record<string, string>;
  }
): string {
  const uniqueGuideNames = getUniqueGuideNames(changedFiles);
  const pluginFiles = changedFiles.filter(isPluginFile);

  const addedNames = categorized?.addedGuideNames ?? [];
  const modifiedNames = categorized?.modifiedGuideNames ?? [];
  const removedNames = categorized?.removedGuideNames ?? [];
  const guideDescriptions = categorized?.guideDescriptions ?? {};

  const targetRef = newVersion.startsWith('v') ? newVersion : `v${newVersion}`;
  let newGuideBullets: string[] = [];
  let updatedGuideBullets: string[] = [];
  let removedGuideBullets: string[] = [];

  if (addedNames.length > 0 || modifiedNames.length > 0 || removedNames.length > 0) {
    newGuideBullets = addedNames.map(g => {
      const desc = guideDescriptions[g];
      const link = formatGuideBoldLink(g, targetRef);
      return desc
        ? `* ${link}: ${desc}`
        : `* ${link}: Introduced new web platform guidance.`;
    });
    updatedGuideBullets = modifiedNames.map(g => `* ${formatGuideBoldLink(g, targetRef)}: Updates and improvements to web platform guidance.`);
    removedGuideBullets = removedNames.map(g => `* Removed the **${g}** guide.`);
  } else if (uniqueGuideNames.length > 0) {
    updatedGuideBullets = uniqueGuideNames.map(
      guideName => `* ${formatGuideBoldLink(guideName, targetRef)}: Updates and improvements to web platform guidance.`
    );
  }

  const baselineBullets = buildBaselineBullets(baselineUpdates, targetRef);

  const ecosystemBullets = pluginFiles.map(
    file => `* **${file}**: Updates to agent plugin configuration.`
  );

  return buildReleaseNotesMarkdown({
    previousTag,
    newVersion,
    newGuideBullets,
    updatedGuideBullets,
    removedGuideBullets,
    baselineBullets,
    ecosystemBullets,
    evalSummary,
  });
}
