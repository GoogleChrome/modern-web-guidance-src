import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { buildDist } from './build-dist.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/
const SERVING_DIR = path.join(ROOT_DIR, "serving");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SKILLS_CLI_TEMPLATE_DIR = path.join(SERVING_DIR, "skills-cli/template");

const isDryRun = process.argv.includes('--dry-run');

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

  // VSCode
  const vscodePath = path.join(SKILLS_CLI_TEMPLATE_DIR, "package.json");
  const vscodeData = JSON.parse(await fs.readFile(vscodePath, 'utf8'));
  vscodeData.version = newVersion;

  // Claude Plugin
  const claudePluginPath = path.join(SKILLS_CLI_TEMPLATE_DIR, ".claude-plugin/plugin.json");
  const claudePluginData = JSON.parse(await fs.readFile(claudePluginPath, 'utf8'));
  claudePluginData.version = newVersion;

  // Claude Marketplace
  const marketplacePath = path.join(SKILLS_CLI_TEMPLATE_DIR, ".claude-plugin/marketplace.json");
  const marketplaceData = JSON.parse(await fs.readFile(marketplacePath, 'utf8'));
  marketplaceData.plugins[0].version = newVersion;

  if (isDryRun) {
    console.log(`[Dry Run] Would have updated files to version ${newVersion}`);
  } else {
    await fs.writeFile(geminiPath, JSON.stringify(geminiData, null, 2) + '\n');
    await fs.writeFile(vscodePath, JSON.stringify(vscodeData, null, 2) + '\n');
    await fs.writeFile(claudePluginPath, JSON.stringify(claudePluginData, null, 2) + '\n');
    await fs.writeFile(marketplacePath, JSON.stringify(marketplaceData, null, 2) + '\n');
  }

  console.log(`Successfully bumped to version ${newVersion}`);
  return newVersion;
}

async function main() {
  const newVersion = await bumpVersions();
  
  const publishCliDir = path.join(DIST_DIR, "skills-cli");
  await fs.mkdir(publishCliDir, {recursive: true});
  await fs.rm(publishCliDir, { recursive: true, force: true });

  console.log(`\nRebuilding distribution with version ${newVersion}...`);
  await buildDist();
  
  console.log(`\nVerifying built distribution with test-dist.test.ts suite...`);
  execSync('node --test skills-cli/test-dist.test.ts', { cwd: SERVING_DIR, stdio: 'inherit' });

  if (isDryRun) {
    const files = await fs.readdir(publishCliDir, {recursive: true});
    console.log(`\n[Dry Run] Skipping GitHub publishing. Would push:\n - ${files.filter(f => !f.includes('node_modules')).sort((a,b) => a.localeCompare(b)).join('\n - ')}`);
    console.log(`\n[Dry Run] ✅ Successfully verified v${newVersion} build pipeline offline!`);
  } else {
    console.log(`\nPublishing new dist/skills-cli/ to GoogleChrome/skills-alpha (main branch)...`);
    
    await ghpages.publish(publishCliDir, {
      src: ['**/*'], // No longer vendor node_modules! Users will install via npx -y!
      branch: 'main',
      repo: 'git@github.com:GoogleChrome/skills-alpha.git',
      dotfiles: true,
      message: `Release v${newVersion}`,
      remove: "**/*"
    });


    console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/skills-alpha!`);

    console.log('Perhaps also:\n    pushd ~/code/skills-alpha && git pull gh && git push gob && popd');
  }
}

main().catch((err) => {
  console.error("Publishing failed!", err);
  process.exit(1);
});
