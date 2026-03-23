import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { promisify } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../.."); // guidance/
const SERVING_DIR = path.join(ROOT_DIR, "serving");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SKILLS_CLI_TEMPLATE_DIR = path.join(SERVING_DIR, "skills-cli");

const ghPagesPublish = promisify(ghpages.publish);

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const patch = parseInt(parts[2], 10) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

async function bumpVersions() {
  console.log("Bumping versions in skills-cli templates...");
  
  // Gemini
  const geminiPath = path.join(SKILLS_CLI_TEMPLATE_DIR, "gemini-extension.json");
  const geminiData = JSON.parse(await fs.readFile(geminiPath, 'utf8'));
  const newVersion = incrementVersion(geminiData.version);
  geminiData.version = newVersion;
  await fs.writeFile(geminiPath, JSON.stringify(geminiData, null, 2));

  // VSCode
  const vscodePath = path.join(SKILLS_CLI_TEMPLATE_DIR, "vscode-ext-package.json");
  const vscodeData = JSON.parse(await fs.readFile(vscodePath, 'utf8'));
  vscodeData.version = newVersion;
  await fs.writeFile(vscodePath, JSON.stringify(vscodeData, null, 2));

  // Claude Plugin
  const claudePluginPath = path.join(SKILLS_CLI_TEMPLATE_DIR, ".claude-plugin/plugin.json");
  const claudePluginData = JSON.parse(await fs.readFile(claudePluginPath, 'utf8'));
  claudePluginData.version = newVersion;
  await fs.writeFile(claudePluginPath, JSON.stringify(claudePluginData, null, 2));

  // Claude Marketplace
  const marketplacePath = path.join(SKILLS_CLI_TEMPLATE_DIR, ".claude-plugin/marketplace.json");
  const marketplaceData = JSON.parse(await fs.readFile(marketplacePath, 'utf8'));
  marketplaceData.plugins[0].version = newVersion;
  await fs.writeFile(marketplacePath, JSON.stringify(marketplaceData, null, 2));

  console.log(`Successfully bumped to version ${newVersion}`);
  return newVersion;
}

async function main() {
  const newVersion = await bumpVersions();
  
  console.log(`\nRebuilding distribution with version ${newVersion}...`);
  execSync('npm run dist-gen', { cwd: SERVING_DIR, stdio: 'inherit' });
  
  console.log(`\nPublishing new dist/ to GoogleChrome/skills-alpha (main branch)...`);
  
  await ghPagesPublish(DIST_DIR, {
    branch: 'main',
    repo: 'git@github.com:GoogleChrome/skills-alpha.git',
    dotfiles: true,
    message: `Release v${newVersion}`
  });

  console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/skills-alpha!`);
}

main().catch((err) => {
  console.error("Publishing failed!", err);
  process.exit(1);
});