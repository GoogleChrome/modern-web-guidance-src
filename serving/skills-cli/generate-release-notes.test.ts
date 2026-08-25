import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateFallbackReleaseNotes,
  buildReleaseNotesMarkdown,
  getUniqueGuideNames,
  parseMarkdownBullets,
  isPatchOnlyVersionBump,
  isJsonOnlyVersionBump,
  isPluginFile,
  type EvalSummaryItem,
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
  assert.strictEqual(isPluginFile('.grok-plugin/marketplace.json'), true);
  assert.strictEqual(isPluginFile('gemini-extension.json'), true);
  assert.strictEqual(isPluginFile('skills/modern-web-guidance/SKILL.md'), false);
  assert.strictEqual(isPluginFile('README.md'), false);
});

test('buildReleaseNotesMarkdown omits Guidance and Ecosystem sections when empty', () => {
  const notes = buildReleaseNotesMarkdown({
    previousTag: 'v0.0.1',
    newVersion: '0.0.2',
    guideBullets: [],
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
  assert.ok(!notes.includes('### 📖 Guidance & Web Platform Updates'));
  assert.ok(!notes.includes('### 🚀 Agent Ecosystem'));
  assert.ok(notes.includes('### 📊 Benchmark Evaluations'));
});

test('buildReleaseNotesMarkdown constructs deterministic structure with custom bullets', () => {
  const notes = buildReleaseNotesMarkdown({
    previousTag: 'v0.0.1',
    newVersion: '0.0.2',
    guideBullets: [
      '* Updated the **Dynamic Sibling Styling** guide with cross-browser support details.',
      '* Added the **Container Queries** guide for responsive widget design.',
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
  assert.ok(notes.includes('### 📖 Guidance & Web Platform Updates'));
  assert.ok(notes.includes('* Updated the **Dynamic Sibling Styling** guide with cross-browser support details.'));
  assert.ok(notes.includes('* Added the **Container Queries** guide for responsive widget design.'));
  assert.ok(notes.includes('### 🚀 Agent Ecosystem'));
  assert.ok(notes.includes('* Added support for the **Grok** plugin marketplace.'));
  assert.ok(notes.includes('### 📊 Benchmark Evaluations'));
  assert.ok(notes.includes('| **claude_code** (opus-5) | 130 / 1033 | 58% → **92%** | **+34pp** |'));
  assert.ok(notes.endsWith('**Full Changelog**: https://github.com/GoogleChrome/modern-web-guidance/compare/v0.0.1...v0.0.2'));
});

test('generateFallbackReleaseNotes formats guide and ecosystem updates', () => {
  const changedFiles = [
    'skills/modern-web-guidance/guides/css/size-aware-styling.md',
    '.grok-plugin/marketplace.json',
  ];
  const evalSummary: EvalSummaryItem[] = [];

  const notes = generateFallbackReleaseNotes('v0.1.0', '0.1.1', evalSummary, changedFiles);

  assert.ok(notes.includes('# Release Notes: `v0.1.1`'));
  assert.ok(notes.includes('### 📖 Guidance & Web Platform Updates'));
  assert.ok(notes.includes('* **size-aware-styling**: Updates and improvements to web platform guidance.'));
  assert.ok(notes.includes('### 🚀 Agent Ecosystem'));
  assert.ok(notes.includes('* **.grok-plugin/marketplace.json**: Updates to agent plugin configuration.'));
});
