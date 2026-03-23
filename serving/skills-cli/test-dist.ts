import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../.."); // guidance/
const DIST_DIR = path.join(ROOT_DIR, "dist");

console.log("Running dist-gen to ensure fresh build...");
execSync('npm run dist-gen', { 
  cwd: path.resolve(__dirname, '..'), 
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
  assert.strictEqual(pkgJson.contributes.chatSkills[0].path, './skills-cli/modern-web-use-cases/SKILL.md');
});

test('SKILL.md validations', async () => {
  const skillPath = path.join(DIST_DIR, 'skills-cli/modern-web-use-cases/SKILL.md');
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
