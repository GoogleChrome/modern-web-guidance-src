import fs from 'node:fs';
import { execSync } from 'node:child_process';
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

import {
  getPreviousTag,
  isPluginFile,
  getExactDistributionDiff,
  getConsumerFacingDiff,
  formatGuideBoldLink,
} from './release-notes-diff.ts';
import {
  buildBaselineBullets,
  buildReleaseNotesMarkdown,
  generateFallbackReleaseNotes,
  linkifyGuideBullets,
} from './release-notes-markdown.ts';
import {
  generateNewGuideSummariesWithGemini,
  generateUpdatedGuideSummariesWithGemini,
  generateEcosystemSummariesWithGemini,
} from './release-notes-gemini.ts';

// Re-export all sub-modules for full backward compatibility
export * from './release-notes-diff.ts';
export * from './release-notes-markdown.ts';
export * from './release-notes-gemini.ts';

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

  const {
    addedGuidesDiff,
    modifiedGuidesDiff,
    addedGuideNames,
    modifiedGuideNames,
    removedGuideNames,
    renamedGuides,
    guideDescriptions,
    pluginDiff,
    baselineUpdates,
    evalSummary,
    changedFiles,
  } =
    publishCliDir && fs.existsSync(publishCliDir)
      ? getExactDistributionDiff(previousTag, publishCliDir)
      : getConsumerFacingDiff(previousTag, target);

  const targetTag = newVersion.startsWith('v') ? newVersion : `v${newVersion}`;
  const pluginFiles = changedFiles.filter(isPluginFile);
  const baselineBullets = buildBaselineBullets(baselineUpdates, targetTag);

  if (!apiKey) {
    if (
      addedGuideNames.length > 0 ||
      modifiedGuideNames.length > 0 ||
      removedGuideNames.length > 0 ||
      pluginFiles.length > 0 ||
      baselineUpdates.length > 0
    ) {
      console.log('No GEMINI_API_KEY found. Generating fallback release notes...');
    }
    return generateFallbackReleaseNotes(
      previousTag,
      newVersion,
      evalSummary,
      changedFiles,
      baselineUpdates,
      {
        addedGuideNames,
        modifiedGuideNames,
        removedGuideNames,
        guideDescriptions,
      }
    );
  }

  let newGuideBullets: string[] = [];
  if (addedGuideNames.length > 0) {
    const generatedNewBullets = await generateNewGuideSummariesWithGemini({
      guideDiff: addedGuidesDiff,
      guideNames: addedGuideNames,
      apiKey,
      model,
    });
    if (generatedNewBullets) {
      newGuideBullets = linkifyGuideBullets(generatedNewBullets, addedGuideNames, targetTag);
    } else {
      console.log('Falling back to default new guide release notes generator...');
      newGuideBullets = addedGuideNames.map(g => {
        const desc = guideDescriptions[g];
        const link = formatGuideBoldLink(g, targetTag);
        return desc
          ? `* ${link}: ${desc}`
          : `* ${link}: Introduced new web platform guidance.`;
      });
    }
  }

  let updatedGuideBullets: string[] = [];
  if (modifiedGuideNames.length > 0) {
    const generatedUpdatedBullets = await generateUpdatedGuideSummariesWithGemini({
      guideDiff: modifiedGuidesDiff,
      guideNames: modifiedGuideNames,
      apiKey,
      model,
    });
    if (generatedUpdatedBullets) {
      updatedGuideBullets = linkifyGuideBullets(generatedUpdatedBullets, modifiedGuideNames, targetTag);
    } else {
      console.log('Falling back to default updated guide release notes generator...');
      updatedGuideBullets = modifiedGuideNames.map(
        g => `* ${formatGuideBoldLink(g, targetTag)}: Updates and improvements to web platform guidance.`
      );
    }
  }

  for (const rename of renamedGuides) {
    if (!modifiedGuideNames.includes(rename.newName)) {
      updatedGuideBullets.push(`* Renamed **${rename.oldName}** to ${formatGuideBoldLink(rename.newName, targetTag)}.`);
    }
  }

  const removedGuideBullets: string[] = removedGuideNames.map(
    g => `* Removed the **${g}** guide.`
  );

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
    newGuideBullets,
    updatedGuideBullets,
    removedGuideBullets,
    baselineBullets,
    ecosystemBullets,
    evalSummary,
  });
}

export async function main(): Promise<void> {
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

  try {
    const notes = await generateReleaseNotes({
      previousTag: prevTag,
      newVersion: version,
      target: targetTag,
    });

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
  } catch (err) {
    console.error('Failed to generate release notes:', err);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
