import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';

export function assertSearchResults(output: string) {
    const results = JSON.parse(output);
    assert.ok(Array.isArray(results), 'Output should be a JSON array');
    assert.ok(results.length > 0, 'Search should find some results');
    
    // Find if 'autofill-address-form' is in the results
    const hasAddressForm = results.some((r: any) => r.id === 'autofill-address-form');
    assert.ok(hasAddressForm, 'Results should contain autofill-address-form');
    
    // Verify structure of the first item
    const topResult = results[0];
    assert.ok(topResult.id, 'Top result should have an id');
    assert.ok(topResult.description, 'Top result should have a description');
    assert.ok(topResult.tokenCount !== undefined, 'Top result should have a tokenCount');
    assert.ok(topResult.similarity, 'Top result should have a similarity');
}

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // modern-web-guidance-src/
const STAGING_DIR = path.join(ROOT_DIR, "dist/skills-cli");


test('Claude Plugin Config in Dist', async () => {
  const marketplaceJsonRaw = await fs.readFile(path.join(STAGING_DIR, '.claude-plugin/marketplace.json'), 'utf8');
  const marketplaceJson = JSON.parse(marketplaceJsonRaw);
  assert.strictEqual(marketplaceJson.name, 'googlechrome', 'marketplace.json name should be googlechrome');
  assert.strictEqual(marketplaceJson.owner.name, 'Google Chrome', 'marketplace.json owner should be Google Chrome');
  
  assert.ok(Array.isArray(marketplaceJson.plugins) && marketplaceJson.plugins.length > 0, 'should have plugins');
  assert.strictEqual(marketplaceJson.plugins[0].name, 'modern-web-guidance');
  assert.strictEqual(marketplaceJson.plugins[0].source, './');

  const pluginJsonRaw = await fs.readFile(path.join(STAGING_DIR, '.claude-plugin/plugin.json'), 'utf8');
  const pluginJson = JSON.parse(pluginJsonRaw);
  assert.strictEqual(pluginJson.name, 'modern-web-guidance', 'plugin.json name should match');
  assert.strictEqual(pluginJson.author.name, 'Google Chrome', 'plugin.json author should be Google Chrome');
});

test('Gemini and VS Code manifests', async () => {
  const geminiJson = JSON.parse(await fs.readFile(path.join(STAGING_DIR, 'gemini-extension.json'), 'utf8'));
  assert.strictEqual(geminiJson.name, 'modern-web-guidance');
  assert.strictEqual(geminiJson.author.name, 'Google Chrome');

  const pkgJsonRaw = await fs.readFile(path.join(STAGING_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
  assert.strictEqual(pkgJson.publisher, 'GoogleChrome');
  assert.ok(pkgJson.contributes?.chatSkills, 'Must contribute chatSkills');
  assert.strictEqual(pkgJson.contributes.chatSkills[0].path, './skills/modern-web-guidance/SKILL.md');
});

test('SKILL.md validations', async () => {
  const skillPath = path.join(STAGING_DIR, 'skills/modern-web-guidance/SKILL.md');
  await assert.doesNotReject(fs.access(skillPath), `Missing SKILL.md in modern-web-guidance`);

  const content = await fs.readFile(skillPath, 'utf8');
  const { data } = matter(content);
  assert.ok(data.name, `Missing 'name' field in frontmatter`);
  assert.strictEqual(data.name, 'modern-web-guidance', `Frontmatter name must match folder name`);
});

test('Discipline guides present (forms, performance)', async () => {
  const checkGuide = async (name: string) => {
    const guidesDir = path.join(STAGING_DIR, 'skills/modern-web-guidance/guides');
    const guidePath = path.join(guidesDir, name, `${name}.md`);
    await assert.doesNotReject(fs.access(guidePath), `Missing guide file in ${name}`);
  };

  await checkGuide('forms');
  await checkGuide('performance');
});

test('Manifest source paths resolve relative to dist directory', async () => {
  // Claude Code source
  const marketplaceJsonRaw = await fs.readFile(path.join(STAGING_DIR, '.claude-plugin/marketplace.json'), 'utf8');
  const marketplaceJson = JSON.parse(marketplaceJsonRaw);
  const claudeSourcePath = marketplaceJson.plugins[0].source;
  const resolvedClaudePath = path.join(STAGING_DIR, claudeSourcePath);
  await assert.doesNotReject(fs.access(resolvedClaudePath), `Claude source path ${claudeSourcePath} must resolve to a valid directory`);
  
  // Claude plugin resolution logic mapping
  // If source is './', the plugin resides precisely at STAGING_DIR/.claude-plugin/plugin.json
  const expectedPluginJsonPath = path.join(resolvedClaudePath, '.claude-plugin/plugin.json');
  await assert.doesNotReject(fs.access(expectedPluginJsonPath), `Claude Plugin must be resolving from the source pointer`);

  // VS Code Extension source
  const pkgJsonRaw = await fs.readFile(path.join(STAGING_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
  const vscodePath = pkgJson.contributes.chatSkills[0].path;
  const resolvedVsCodePath = path.join(STAGING_DIR, vscodePath);
  await assert.doesNotReject(fs.access(resolvedVsCodePath), `VS Code skill path ${vscodePath} must resolve to an existing SKILL.md`);
});

test('README dynamic Skill Coverage content', async () => {
  const readmeRaw = await fs.readFile(path.join(STAGING_DIR, 'README.md'), 'utf8');
  
  // Verify it contains the new headers and format
  assert.match(readmeRaw, /#### Full Skill Coverage \(v\d+\.\d+\.\d+\)/, 'README should contain the Skill Coverage header with the version');
  assert.ok(readmeRaw.includes('modern web features'), 'README should contain the feature count summary text');
  assert.ok(readmeRaw.includes('<details>'), 'README should contain collapsible details tags');
  assert.ok(readmeRaw.includes('<h3>'), 'README should contain category h3 headings');
  
  // Quick sanity check that at least one feature name format works out, e.g. explorer links
  assert.match(readmeRaw, /https:\/\/web-platform-dx\.github\.io\/web-features-explorer\/features\//, 'README should contain links to Web Features Explorer');
  assert.match(readmeRaw, /https:\/\/github\.com\/GoogleChrome\/modern-web-guidance\/blob\/main\/skills\/modern-web-guidance\/guides\//, 'README should contain GitHub blob links for use cases');
});

test('modern-web CLI search and retrieve', async () => {
  const binaryPath = path.join(STAGING_DIR, 'skills/modern-web-guidance/modern-web.mjs');
  
  // 1. Validate search
  const searchOut = execSync(`node "${binaryPath}" search "address form"`, { encoding: 'utf8' });
  assertSearchResults(searchOut);

  // 2. Validate retrieve
  const retrieveOut = execSync(`node "${binaryPath}" retrieve accessible-error-announcement`, { encoding: 'utf8' });
  assert.match(retrieveOut, /# Accessible Error/, 'Retrieve output should contain the guide title');

  // 3. Validate list
  const listOut = execSync(`node "${binaryPath}" list`, { encoding: 'utf8' });
  assert.ok(listOut.includes('accessible-error-announcement'), 'List output should contain known guide IDs');
  const catalog = JSON.parse(listOut);
  assert.ok(Array.isArray(catalog), 'List output should be a JSON array');
  assert.ok(catalog.length > 100, 'Catalog should contain all documented guidelines');
});

test('modern-web CLI version flags', async () => {
  const binaryPath = path.join(STAGING_DIR, 'skills/modern-web-guidance/modern-web.mjs');
  const pkgJsonRaw = await fs.readFile(path.join(STAGING_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
  const expectedVersion = pkgJson.version;

  assert.ok(expectedVersion, 'expectedVersion should exist in package.json');

  // 1. Test --version
  const versionOutLong = execSync(`node "${binaryPath}" --version`, { encoding: 'utf8' }).trim();
  assert.strictEqual(versionOutLong, expectedVersion, '--version output should match package.json version');

  // 2. Test -v
  const versionOutShort = execSync(`node "${binaryPath}" -v`, { encoding: 'utf8' }).trim();
  assert.strictEqual(versionOutShort, expectedVersion, '-v output should match package.json version');
});

// TODO: this has been failing locally from publish-skills.ts
test.skip('THIRD_PARTY_NOTICES validation', async () => {
  const noticesPath = path.join(STAGING_DIR, 'THIRD_PARTY_NOTICES');
  await assert.doesNotReject(fs.access(noticesPath), `Missing THIRD_PARTY_NOTICES in dist`);

  const content = await fs.readFile(noticesPath, 'utf8');
  
  // Check for some expected dependencies
  assert.ok(content.includes('Name: @tensorflow/tfjs-core'), 'Should contain @tensorflow/tfjs-core');
  assert.ok(content.includes('Name: @huggingface/transformers'), 'Should contain @huggingface/transformers');
  
  // Check structure
  assert.ok(content.includes('-------------------- DEPENDENCY DIVIDER --------------------'), 'Should contain dividers');
});


