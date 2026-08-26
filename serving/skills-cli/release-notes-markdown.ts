import {
  isPluginFile,
  getUniqueGuideNames,
  type BaselineUpdateInfo,
  type EvalSummaryItem,
} from './release-notes-diff.ts';

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
export function buildBaselineBullets(updates: BaselineUpdateInfo[]): string[] {
  const grouped = new Map<string, { featureName: string; statusRank: number; statusDescription: string; guides: string[] }>();

  for (const update of updates) {
    const key = `${update.featureName}::${update.statusRank}::${update.statusDescription}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        featureName: update.featureName,
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
    if (uniqueGuides.length === 1) {
      return `* **${entry.featureName}**: ${entry.statusDescription} in \`${uniqueGuides[0]}\`.`;
    }
    const guidesList = uniqueGuides.map(g => `\`${g}\``).join(', ');
    return `* **${entry.featureName}**: ${entry.statusDescription} across ${uniqueGuides.length} guides (${guidesList}).`;
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

  let newGuideBullets: string[] = [];
  let updatedGuideBullets: string[] = [];
  let removedGuideBullets: string[] = [];

  if (addedNames.length > 0 || modifiedNames.length > 0 || removedNames.length > 0) {
    newGuideBullets = addedNames.map(g => {
      const desc = guideDescriptions[g];
      return desc
        ? `* **${g}**: ${desc}`
        : `* **${g}**: Introduced new web platform guidance.`;
    });
    updatedGuideBullets = modifiedNames.map(g => `* **${g}**: Updates and improvements to web platform guidance.`);
    removedGuideBullets = removedNames.map(g => `* Removed the **${g}** guide.`);
  } else if (uniqueGuideNames.length > 0) {
    updatedGuideBullets = uniqueGuideNames.map(
      guideName => `* **${guideName}**: Updates and improvements to web platform guidance.`
    );
  }

  const baselineBullets = buildBaselineBullets(baselineUpdates);

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
