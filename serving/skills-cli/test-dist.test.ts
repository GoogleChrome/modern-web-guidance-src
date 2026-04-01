import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/
const DIST_DIR = path.join(ROOT_DIR, "dist/skills-cli");

console.log("Running build-dist to ensure fresh build...");
execSync('npm run build-dist', { 
  cwd: path.resolve(import.meta.dirname, '..'), 
  stdio: 'inherit' 
});

test('Claude Plugin Config in Dist', async () => {
  const marketplaceJsonRaw = await fs.readFile(path.join(DIST_DIR, '.claude-plugin/marketplace.json'), 'utf8');
  const marketplaceJson = JSON.parse(marketplaceJsonRaw);
  assert.strictEqual(marketplaceJson.name, 'skills-alpha', 'marketplace.json name should be skills-alpha');
  assert.strictEqual(marketplaceJson.owner.name, 'Google Chrome', 'marketplace.json owner should be Google Chrome');
  
  assert.ok(Array.isArray(marketplaceJson.plugins) && marketplaceJson.plugins.length > 0, 'should have plugins');
  assert.strictEqual(marketplaceJson.plugins[0].name, 'googlechrome-skills');
  assert.strictEqual(marketplaceJson.plugins[0].source, './');

  const pluginJsonRaw = await fs.readFile(path.join(DIST_DIR, '.claude-plugin/plugin.json'), 'utf8');
  const pluginJson = JSON.parse(pluginJsonRaw);
  assert.strictEqual(pluginJson.name, 'googlechrome-skills', 'plugin.json name should match');
  assert.strictEqual(pluginJson.author.name, 'Google Chrome', 'plugin.json author should be Google Chrome');
});

test('Gemini and VS Code manifests', async () => {
  const geminiJson = JSON.parse(await fs.readFile(path.join(DIST_DIR, 'gemini-extension.json'), 'utf8'));
  assert.strictEqual(geminiJson.name, 'googlechrome-skills');
  assert.strictEqual(geminiJson.author.name, 'Google Chrome');

  const pkgJsonRaw = await fs.readFile(path.join(DIST_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
  assert.strictEqual(pkgJson.publisher, 'GoogleChrome');
  assert.ok(pkgJson.contributes?.chatSkills, 'Must contribute chatSkills');
  assert.strictEqual(pkgJson.contributes.chatSkills[0].path, './skills/modern-web-use-cases/SKILL.md');
});

test('SKILL.md validations', async () => {
  const skillPath = path.join(DIST_DIR, 'skills/modern-web-use-cases/SKILL.md');
  await assert.doesNotReject(fs.access(skillPath), `Missing SKILL.md in modern-web-use-cases`);

  const content = await fs.readFile(skillPath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  assert.ok(match, `Missing YAML frontmatter`);
  
  const nameMatch = match[1].match(/^name:\s*(.+)$/m);
  assert.ok(nameMatch, `Missing 'name' field in frontmatter`);
  assert.strictEqual(nameMatch[1].trim(), 'modern-web-use-cases', `Frontmatter name must match folder name`);
});

test('Manifest source paths resolve relative to dist directory', async () => {
  // Claude Code source
  const marketplaceJsonRaw = await fs.readFile(path.join(DIST_DIR, '.claude-plugin/marketplace.json'), 'utf8');
  const marketplaceJson = JSON.parse(marketplaceJsonRaw);
  const claudeSourcePath = marketplaceJson.plugins[0].source;
  const resolvedClaudePath = path.join(DIST_DIR, claudeSourcePath);
  await assert.doesNotReject(fs.access(resolvedClaudePath), `Claude source path ${claudeSourcePath} must resolve to a valid directory`);
  
  // Claude plugin resolution logic mapping
  // If source is './', the plugin resides precisely at DIST_DIR/.claude-plugin/plugin.json
  const expectedPluginJsonPath = path.join(resolvedClaudePath, '.claude-plugin/plugin.json');
  await assert.doesNotReject(fs.access(expectedPluginJsonPath), `Claude Plugin must be resolving from the source pointer`);

  // VS Code Extension source
  const pkgJsonRaw = await fs.readFile(path.join(DIST_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
  const vscodePath = pkgJson.contributes.chatSkills[0].path;
  const resolvedVsCodePath = path.join(DIST_DIR, vscodePath);
  await assert.doesNotReject(fs.access(resolvedVsCodePath), `VS Code skill path ${vscodePath} must resolve to an existing SKILL.md`);
});

test('README dynamic Skill Coverage content', async () => {
  const readmeRaw = await fs.readFile(path.join(DIST_DIR, 'README.md'), 'utf8');
  
  // Verify it contains the new headers and format
  assert.match(readmeRaw, /#### Skill Coverage in `v\d+\.\d+\.\d+`/, 'README should contain the Skill Coverage header with the version');
  assert.ok(readmeRaw.includes('web features with implementation guidance from Chrome\'s experts'), 'README should contain the feature count summary text');
  assert.ok(readmeRaw.includes('<details>'), 'README should contain collapsible details tags');
  
  // Quick sanity check that at least one feature name format works out, e.g. webstatus links
  assert.match(readmeRaw, /https:\/\/webstatus\.dev\/features\//, 'README should contain links to webstatus.dev');
});

