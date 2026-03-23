import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../.."); // guidance/
const DIST_DIR = path.join(ROOT_DIR, "dist");

test('Claude Plugin Config in Dist', async () => {
  const marketplaceJsonRaw = await fs.readFile(path.join(DIST_DIR, '.claude-plugin/marketplace.json'), 'utf8');
  const marketplaceJson = JSON.parse(marketplaceJsonRaw);
  assert.strictEqual(marketplaceJson.name, 'guidance', 'marketplace.json name should be guidance');
  
  assert.ok(Array.isArray(marketplaceJson.plugins) && marketplaceJson.plugins.length > 0, 'should have plugins');
  assert.strictEqual(marketplaceJson.plugins[0].name, 'modern-web-use-cases');

  const pluginJsonRaw = await fs.readFile(path.join(DIST_DIR, 'skills-cli/modern-web-use-cases/plugin.json'), 'utf8');
  const pluginJson = JSON.parse(pluginJsonRaw);
  assert.strictEqual(pluginJson.name, 'modern-web-use-cases', 'plugin.json name should match');
});

test('Gemini and VS Code manifests', async () => {
  const geminiJson = JSON.parse(await fs.readFile(path.join(DIST_DIR, 'gemini-extension.json'), 'utf8'));
  assert.strictEqual(geminiJson.name, 'guidance-skills');

  const pkgJsonRaw = await fs.readFile(path.join(DIST_DIR, 'package.json'), 'utf8');
  const pkgJson = JSON.parse(pkgJsonRaw);
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
