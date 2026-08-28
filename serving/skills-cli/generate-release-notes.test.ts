import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateFallbackReleaseNotes,
  buildReleaseNotesMarkdown,
  buildBaselineBullets,
  parseBaselineUpdateFromPatch,
  isPatchOnlyBaselineUpdate,
  stripBaselineLinesFromPatch,
  classifyChanges,
  getGuideDescription,
  getUniqueGuideNames,
  parseMarkdownBullets,
  isPatchOnlyVersionBump,
  isJsonOnlyVersionBump,
  isPluginFile,
  isGuideFile,
  getGuideName,
  type EvalSummaryItem,
  type BaselineUpdateInfo,
  type RawChangeRecord,
} from './generate-release-notes.ts';

test('isPatchOnlyVersionBump correctly detects rote version bumps', () => {
  const versionOnlyPatch = `
@@ -1,5 +1,5 @@
 {
   "name": "my-plugin",
-  "version": "0.0.185"
+  "version": "0.0.186"
 }
 `;
  assert.strictEqual(isPatchOnlyVersionBump(versionOnlyPatch), true);

  const realChangePatch = `
@@ -1,5 +1,5 @@
 {
-  "description": "old description",
+  "description": "new description",
   "version": "0.0.186"
 }
 `;
  assert.strictEqual(isPatchOnlyVersionBump(realChangePatch), false);
});

test('isPatchOnlyBaselineUpdate correctly identifies baseline-only patches', () => {
  const baselinePatch = `
@@ -54,7 +54,7 @@
 ### Fallback strategies
-Baseline status for Masks: Newly available. It's been Baseline since 2023-12-07.
+Baseline status for Masks: Widely available. It's been Baseline since 2023-12-07.
 Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).
`;
  assert.strictEqual(isPatchOnlyBaselineUpdate(baselinePatch), true);

  const substantivePatch = `
@@ -10,6 +10,8 @@
 ## Overview
+Here is some new important guidance about using mask-image safely.
+Always specify a fallback.
`;
  assert.strictEqual(isPatchOnlyBaselineUpdate(substantivePatch), false);
});

test('stripBaselineLinesFromPatch filters out baseline status lines while retaining substantive diffs', () => {
  const mixedPatch = `
@@ -1,6 +1,8 @@
 ## Overview
+Here is some new substantive guidance about masks.
-Baseline status for Masks: Newly available.
+Baseline status for Masks: Widely available.
+Always specify a fallback.
`;
  const stripped = stripBaselineLinesFromPatch(mixedPatch);
  assert.ok(stripped.includes('+Here is some new substantive guidance about masks.'));
  assert.ok(stripped.includes('+Always specify a fallback.'));
  assert.ok(!stripped.includes('Baseline status for Masks'));
});

test('parseBaselineUpdateFromPatch extracts feature name and status rank', () => {
  const patchWidely = `
@@ -54,7 +54,7 @@
-Baseline status for Masks: Newly available.
+Baseline status for Masks: Widely available.
`;
  const infoWidely = parseBaselineUpdateFromPatch('complex-shapes', patchWidely);
  assert.strictEqual(infoWidely.featureName, 'CSS Masks');
  assert.strictEqual(infoWidely.statusRank, 1);
  assert.ok(infoWidely.statusDescription.includes('Widely available'));

  const patchNewly = `
@@ -10,7 +10,7 @@
-Baseline status for field-sizing: Limited availability.
+Baseline status for field-sizing: Newly available.
`;
  const infoNewly = parseBaselineUpdateFromPatch('form-fields-automatically-fit-contents', patchNewly);
  assert.strictEqual(infoNewly.featureName, 'field-sizing');
  assert.strictEqual(infoNewly.statusRank, 2);
  assert.ok(infoNewly.statusDescription.includes('Newly available'));
});

test('buildBaselineBullets sorts entries strictly: Widely -> Newly -> Limited and groups guides', () => {
  const updates: BaselineUpdateInfo[] = [
    {
      featureName: 'Language Detection',
      statusRank: 3,
      statusDescription: 'Added **Edge 148** support',
      guideName: 'language-detection',
    },
    {
      featureName: 'CSS Masks',
      statusRank: 1,
      statusDescription: 'Now **Baseline Widely available**',
      guideName: 'complex-shapes',
    },
    {
      featureName: 'CSS Masks',
      statusRank: 1,
      statusDescription: 'Now **Baseline Widely available**',
      guideName: 'shaped-cutouts',
    },
    {
      featureName: 'field-sizing',
      statusRank: 2,
      statusDescription: 'Now **Baseline Newly available**',
      guideName: 'form-fields-automatically-fit-contents',
    },
    {
      featureName: ':has() selector',
      statusRank: 1,
      statusDescription: 'Now **Baseline Widely available**',
      guideName: 'child-state-based-styling',
    },
  ];

  const bullets = buildBaselineBullets(updates);
  assert.strictEqual(bullets.length, 4);
  // First should be Rank 1 (:has() and CSS Masks sorted alphabetically)
  assert.ok(bullets[0].includes(':has() selector'));
  assert.ok(bullets[1].includes('CSS Masks'));
  assert.ok(bullets[1].includes('across 2 guides (`complex-shapes`, `shaped-cutouts`)'));
  // Second group is Rank 2 (field-sizing)
  assert.ok(bullets[2].includes('field-sizing'));
  // Third group is Rank 3 (Language Detection)
  assert.ok(bullets[3].includes('Language Detection'));
});

test('isJsonOnlyVersionBump correctly compares JSON objects on disk ignoring version', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-json-bump-'));
  try {
    const fileA = path.join(tempDir, 'a.json');
    const fileB = path.join(tempDir, 'b.json');
    const fileC = path.join(tempDir, 'c.json');

    fs.writeFileSync(fileA, JSON.stringify({ name: 'plugin', version: '1.0.0', plugins: [{ version: '1.0.0' }] }));
    fs.writeFileSync(fileB, JSON.stringify({ name: 'plugin', version: '1.0.1', plugins: [{ version: '1.0.1' }] }));
    fs.writeFileSync(fileC, JSON.stringify({ name: 'plugin-renamed', version: '1.0.1' }));

    assert.strictEqual(isJsonOnlyVersionBump(fileA, fileB), true);
    assert.strictEqual(isJsonOnlyVersionBump(fileA, fileC), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('parseMarkdownBullets handles single-line and multi-line bullet points without truncation', () => {
  const input = `
* Updated the **Dynamic Sibling Styling** guide with cross-browser support details.
  Specifically Firefox support was noted.
- Added the **Container Queries** guide for responsive widget design.
  Works across all modern engines.
* Short one-liner bullet.
`;

  const bullets = parseMarkdownBullets(input);
  assert.strictEqual(bullets.length, 3);
  assert.strictEqual(
    bullets[0],
    '* Updated the **Dynamic Sibling Styling** guide with cross-browser support details. Specifically Firefox support was noted.'
  );
  assert.strictEqual(
    bullets[1],
    '- Added the **Container Queries** guide for responsive widget design. Works across all modern engines.'
  );
  assert.strictEqual(bullets[2], '* Short one-liner bullet.');
});

test('getUniqueGuideNames deduplicates guide paths, includes SKILL.md, and filters out non-guide markdown', () => {
  const changedFiles = [
    'skills/modern-web-guidance/guides/css/size-aware-styling.md',
    'skills/modern-web-guidance/guides/css/size-aware-styling.md',
    'guides/css/size-aware-styling/guide.md',
    'skills/modern-web-guidance/guides/javascript/async-clipboard.md',
    'skills/modern-web-guidance/SKILL.md',
    'skills/chrome-extensions/SKILL.md',
    'README.md',
    'package.json',
  ];

  const unique = getUniqueGuideNames(changedFiles);
  assert.deepStrictEqual(unique, [
    'size-aware-styling',
    'async-clipboard',
    'modern-web-guidance-skill',
    'chrome-extensions-skill',
  ]);
});

test('isPluginFile correctly identifies plugin and manifest files', () => {
  assert.strictEqual(isPluginFile('.claude-plugin/plugin.json'), true);
  assert.strictEqual(isPluginFile('.codex-plugin/plugin.json'), true);
  assert.strictEqual(isPluginFile('.grok-plugin/marketplace.json'), true);
  assert.strictEqual(isPluginFile('gemini-extension.json'), true);
  assert.strictEqual(isPluginFile('skills/modern-web-guidance/SKILL.md'), false);
  assert.strictEqual(isPluginFile('README.md'), false);
});

test('buildReleaseNotesMarkdown omits sections when empty', () => {
  const notes = buildReleaseNotesMarkdown({
    previousTag: 'v0.0.1',
    newVersion: '0.0.2',
    baselineBullets: [],
    ecosystemBullets: [],
    evalSummary: [
      {
        agent: 'claude_code',
        model: 'opus-5',
        taskCount: 130,
        assertionCount: 1033,
        unguidedPassRate: 58,
        guidedPassRate: 92,
      },
    ],
  });

  assert.ok(notes.startsWith('# Release Notes: `v0.0.2`'));
  assert.ok(!notes.includes('## 🆕 New Guides'));
  assert.ok(!notes.includes('## 🔄 Updated Guides'));
  assert.ok(!notes.includes('## 🗑️ Removed Guides'));
  assert.ok(!notes.includes('## 🌐 Browser Support Updates'));
  assert.ok(!notes.includes('## 🔌 Plugins'));
  assert.ok(notes.includes('## 📊 Benchmark Evaluations'));
});

test('buildReleaseNotesMarkdown constructs deterministic structure with custom bullets', () => {
  const notes = buildReleaseNotesMarkdown({
    previousTag: 'v0.0.1',
    newVersion: '0.0.2',
    newGuideBullets: [
      '* Introduced a new guide for **State-Aware Sticky Headers** detailing responsive header states.',
    ],
    updatedGuideBullets: [
      '* Updated the **Dynamic Sibling Styling** guide with cross-browser support details.',
    ],
    removedGuideBullets: [
      '* Removed the **legacy-layout** guide.',
    ],
    baselineBullets: [
      '* **CSS Masks**: Now **Baseline Widely available** across 2 guides (`complex-shapes`, `shaped-cutouts`).',
    ],
    ecosystemBullets: [
      '* Added support for the **Grok** plugin marketplace.',
    ],
    evalSummary: [
      {
        agent: 'claude_code',
        model: 'opus-5',
        taskCount: 130,
        assertionCount: 1033,
        unguidedPassRate: 58,
        guidedPassRate: 92,
      },
    ],
  });

  assert.ok(notes.startsWith('# Release Notes: `v0.0.2`'));
  assert.ok(notes.includes('## 🆕 New Guides\n\n* Introduced a new guide for **State-Aware Sticky Headers**'));
  assert.ok(notes.includes('## 🔄 Updated Guides\n\n* Updated the **Dynamic Sibling Styling** guide'));
  assert.ok(notes.includes('## 🗑️ Removed Guides\n\n* Removed the **legacy-layout** guide.'));
  assert.ok(notes.includes('## 🌐 Browser Support Updates\n\n* **CSS Masks**: Now **Baseline Widely available**'));
  assert.ok(notes.includes('## 🔌 Plugins\n\n* Added support for the **Grok** plugin marketplace.'));
  assert.ok(notes.includes('## 📊 Benchmark Evaluations'));
  assert.ok(notes.includes('| **claude_code** (opus-5) | 130 / 1033 | 58% → **92%** | **+34pp** |'));
  assert.ok(notes.endsWith('**Full Changelog**: https://github.com/GoogleChrome/modern-web-guidance/compare/v0.0.1...v0.0.2'));
});

test('generateFallbackReleaseNotes formats guide, baseline, and ecosystem updates', () => {
  const changedFiles = [
    'skills/modern-web-guidance/guides/css/size-aware-styling.md',
    '.grok-plugin/marketplace.json',
  ];
  const evalSummary: EvalSummaryItem[] = [];
  const baselineUpdates: BaselineUpdateInfo[] = [
    {
      featureName: 'CSS Masks',
      statusRank: 1,
      statusDescription: 'Now **Baseline Widely available**',
      guideName: 'complex-shapes',
    },
  ];

  const notes = generateFallbackReleaseNotes('v0.1.0', '0.1.1', evalSummary, changedFiles, baselineUpdates);

  assert.ok(notes.includes('# Release Notes: `v0.1.1`'));
  assert.ok(notes.includes('## 🔄 Updated Guides\n\n* **size-aware-styling**: Updates and improvements to web platform guidance.'));
  assert.ok(notes.includes('## 🌐 Browser Support Updates\n\n* **CSS Masks**: Now **Baseline Widely available** in `complex-shapes`.'));
  assert.ok(notes.includes('## 🔌 Plugins\n\n* **.grok-plugin/marketplace.json**: Updates to agent plugin configuration.'));
});

test('classifyChanges correctly classifies added, modified, baseline, plugin, removed, and renamed records', () => {
  const records: RawChangeRecord[] = [
    {
      relPath: 'skills/modern-web-guidance/guides/css/new-guide.md',
      status: 'A',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/substantive-guide.md',
      status: 'M',
      patch: '@@ -1,3 +1,5 @@\n+New substantive content\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/baseline-guide.md',
      status: 'M',
      patch: '@@ -10,3 +10,3 @@\n-Baseline status for Masks: Newly available.\n+Baseline status for Masks: Widely available.\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/dual-update-guide.md',
      status: 'M',
      patch: '@@ -1,3 +1,5 @@\n+Refactored layout techniques and recommendations.\n@@ -10,3 +10,3 @@\n-Baseline status for linear() easing: Newly available.\n+Baseline status for linear() easing: Widely available.\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/renamed-guide.md',
      oldPath: 'skills/modern-web-guidance/guides/css/old-guide-name.md',
      status: 'R',
      patch: '@@ -1,3 +1,4 @@\n+Additional notes on renamed guide\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/javascript/removed-guide.md',
      status: 'D',
    },
    {
      relPath: '.grok-plugin/marketplace.json',
      status: 'A',
    },
    {
      relPath: '.claude-plugin/plugin.json',
      status: 'M',
      patch: '@@ -1,5 +1,5 @@\n {\n-  "version": "1.0.0"\n+  "version": "1.0.1"\n }\n',
    },
    {
      relPath: 'symlink-guide.md',
      status: 'M',
      isLink: true,
    },
    {
      relPath: 'deleted-file.md',
      status: 'D',
    },
  ];

  const result = classifyChanges(records);

  // 1. Added guide
  assert.deepStrictEqual(result.addedGuideNames, ['new-guide']);
  assert.ok(result.addedGuidesDiff.includes('- **new-guide** (Path: `skills/modern-web-guidance/guides/css/new-guide.md`)'));

  // 2. Substantive modified guide & Renamed guide (including dual-update guide)
  assert.deepStrictEqual(result.modifiedGuideNames, ['substantive-guide', 'dual-update-guide', 'renamed-guide']);
  assert.ok(result.modifiedGuidesDiff.includes('skills/modern-web-guidance/guides/css/substantive-guide.md'));
  assert.ok(result.modifiedGuidesDiff.includes('New substantive content'));
  assert.ok(result.modifiedGuidesDiff.includes('Refactored layout techniques'));
  assert.ok(result.modifiedGuidesDiff.includes('Renamed from skills/modern-web-guidance/guides/css/old-guide-name.md'));

  // 3. Removed guide
  assert.deepStrictEqual(result.removedGuideNames, ['removed-guide']);

  // 4. Renamed guide record
  assert.deepStrictEqual(result.renamedGuides, [
    { oldName: 'old-guide-name', newName: 'renamed-guide' },
  ]);

  // 5. Baseline updates (includes both standalone baseline guide and dual-update guide)
  assert.strictEqual(result.baselineUpdates.length, 2);
  assert.strictEqual(result.baselineUpdates[0].featureName, 'CSS Masks');
  assert.strictEqual(result.baselineUpdates[0].statusRank, 1);
  assert.strictEqual(result.baselineUpdates[1].featureName, 'linear() easing');
  assert.strictEqual(result.baselineUpdates[1].statusRank, 1);
  assert.strictEqual(result.baselineUpdates[1].guideName, 'dual-update-guide');

  // 6. Plugin file (added)
  assert.ok(result.pluginDiff.includes('--- .grok-plugin/marketplace.json (Added) ---'));
  // 7. Version-only bump plugin skipped
  assert.ok(!result.pluginDiff.includes('.claude-plugin/plugin.json'));

  // 8. Changed files
  assert.deepStrictEqual(result.changedFiles, [
    'skills/modern-web-guidance/guides/css/new-guide.md',
    'skills/modern-web-guidance/guides/css/substantive-guide.md',
    'skills/modern-web-guidance/guides/css/dual-update-guide.md',
    'skills/modern-web-guidance/guides/css/renamed-guide.md',
    'skills/modern-web-guidance/guides/javascript/removed-guide.md',
    '.grok-plugin/marketplace.json',
  ]);
});

test('getGuideDescription extracts frontmatter description from source and distribution paths', () => {
  const guideDesc = getGuideDescription('skills/modern-web-guidance/guides/ui-atoms/state-aware-sticky-headers.md');
  assert.ok(guideDesc);
  assert.ok(guideDesc.includes('Build sticky section headers or navbars'));

  const skillDesc = getGuideDescription('skills/chrome-extensions/SKILL.md');
  assert.ok(skillDesc);
  assert.ok(skillDesc.includes('Build and publish Chrome Extensions'));
});

test('generateFallbackReleaseNotes formats categorized guide additions, updates, and removals with frontmatter descriptions', () => {
  const notes = generateFallbackReleaseNotes(
    'v0.1.0',
    '0.1.1',
    [],
    [
      'skills/modern-web-guidance/guides/css/new-feature.md',
      'skills/modern-web-guidance/guides/css/existing-feature.md',
      'skills/modern-web-guidance/guides/css/old-feature.md',
    ],
    [],
    {
      addedGuideNames: ['new-feature'],
      modifiedGuideNames: ['existing-feature'],
      removedGuideNames: ['old-feature'],
      guideDescriptions: {
        'new-feature': 'Custom frontmatter description for new feature.',
      },
    }
  );

  assert.ok(notes.includes('## 🆕 New Guides\n\n* **new-feature**: Custom frontmatter description for new feature.'));
  assert.ok(notes.includes('## 🔄 Updated Guides\n\n* **existing-feature**: Updates and improvements to web platform guidance.'));
  assert.ok(notes.includes('## 🗑️ Removed Guides\n\n* Removed the **old-feature** guide.'));
});

test('all changed guide files are categorized into added, modified, removed, or renamed categories', () => {
  const records: RawChangeRecord[] = [
    {
      relPath: 'skills/modern-web-guidance/guides/css/new-guide.md',
      status: 'A',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/substantive-guide.md',
      status: 'M',
      patch: '@@ -1,3 +1,5 @@\n+New substantive content\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/css/renamed-guide.md',
      oldPath: 'skills/modern-web-guidance/guides/css/old-guide-name.md',
      status: 'R',
      patch: '@@ -1,3 +1,4 @@\n+Additional notes\n',
    },
    {
      relPath: 'skills/modern-web-guidance/guides/javascript/removed-guide.md',
      status: 'D',
    },
    {
      relPath: 'skills/chrome-extensions/SKILL.md',
      status: 'M',
      patch: '@@ -1,3 +1,4 @@\n+Updated skill instructions\n',
    },
  ];

  const result = classifyChanges(records);
  const guideChangedFiles = result.changedFiles.filter(isGuideFile);

  assert.ok(guideChangedFiles.length > 0);
  for (const file of guideChangedFiles) {
    const guideName = getGuideName(file);
    const isCategorized =
      result.addedGuideNames.includes(guideName) ||
      result.modifiedGuideNames.includes(guideName) ||
      result.removedGuideNames.includes(guideName) ||
      result.renamedGuides.some(r => r.newName === guideName || r.oldName === guideName);

    assert.ok(
      isCategorized,
      `Expected guide file '${file}' (${guideName}) in changedFiles to be in a category`
    );
  }
});

