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

const isDryRun = process.argv.includes('--dry-run');

async function bumpVersions() {
  console.log("Bumping versions in skills-cli templates...");
  
  // Gemini
  const geminiPath = path.join(SKILLS_CLI_TEMPLATE_DIR, "gemini-extension.json");
  const geminiData = JSON.parse(await fs.readFile(geminiPath, 'utf8'));
  const newVersion = incrementVersion(geminiData.version);
  geminiData.version = newVersion;
  if (isDryRun) {
    console.log(`[Dry Run] Would have updated files to version ${newVersion}`);
  } else {
    await fs.writeFile(geminiPath, JSON.stringify(geminiData, null, 2));
    await fs.writeFile(vscodePath, JSON.stringify(vscodeData, null, 2));
    await fs.writeFile(claudePluginPath, JSON.stringify(claudePluginData, null, 2));
    await fs.writeFile(marketplacePath, JSON.stringify(marketplaceData, null, 2));
  }

  console.log(`Successfully bumped to version ${newVersion}`);
  return newVersion;
}

async function main() {
  const newVersion = await bumpVersions();
  
  console.log(`\nRebuilding distribution with version ${newVersion}...`);
  execSync('npm run dist-gen', { cwd: SERVING_DIR, stdio: 'inherit' });
  
  if (isDryRun) {
    console.log(`\n[Dry Run] Skipping GitHub publishing and metadata push wrapper.`);
    console.log(`\n[Dry Run] ✅ Successfully verified v${newVersion} build pipeline offline!`);
  } else {
    console.log(`\nPublishing new dist/ to GoogleChrome/skills-alpha (main branch)...`);
    
    await ghPagesPublish(DIST_DIR, {
      branch: 'main',
      repo: 'git@github.com:GoogleChrome/skills-alpha.git',
      dotfiles: true,
      message: `Release v${newVersion}`
    });

    console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/skills-alpha!`);
  }
}

main().catch((err) => {
  console.error("Publishing failed!", err);
  process.exit(1);
});