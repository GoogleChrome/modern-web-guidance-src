import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { buildDist } from './build-dist.ts';
import { fileURLToPath } from 'node:url';

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


const getLatestGitTag = () => execSync('git describe --tags --abbrev=0 --match="v*.*.*"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

export async function getNextVersion(getLatestTag = getLatestGitTag): Promise<string> {
  console.log("Determining next version...");
  let currentVersion = "0.0.0";

  try {
    // Get the latest tag that looks like v*.*.*
    const latestTag = getLatestTag();
    currentVersion = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
    console.log(`Found latest tag: ${latestTag}`);
  } catch (e) {
    console.warn("No version tags found, falling back to package.json version.");
    const vscodePath = path.join(SKILLS_CLI_TEMPLATE_DIR, "package.json");
    const vscodeData = JSON.parse(await fs.readFile(vscodePath, 'utf8'));
    currentVersion = vscodeData.version;
  }

  const newVersion = incrementVersion(currentVersion);
  console.log(`Next version will be: ${newVersion}`);
  return newVersion;
}



async function main() {
  const newVersion = await getNextVersion();
  
  const publishCliDir = path.join(DIST_DIR, "skills-cli");
  await fs.mkdir(publishCliDir, {recursive: true});
  await fs.rm(publishCliDir, { recursive: true, force: true });

  console.log(`\nRebuilding distribution with version ${newVersion}...`);
  const result = await buildDist(newVersion);
  if (!result) {
    throw new Error("Build failed or was already in progress.");
  }
  const { featuresCount, useCasesCount, skillsCount, skillNames } = result;
  
  console.log(`\nVerifying built distribution with test-dist.test.ts suite...`);
  execSync('node --test skills-cli/*.test.ts', { cwd: SERVING_DIR, stdio: 'inherit' ,  env: { ...process.env, TEST_REPORTER: 'spec'}});
  

  if (isDryRun) {
    const files = await fs.readdir(publishCliDir, {recursive: true});
    console.log(`\n[Dry Run] Skipping GitHub publishing. Would push:\n - ${files.filter(f => !f.includes('node_modules')).sort((a,b) => a.localeCompare(b)).join('\n - ')}`);
    console.log(`\n[Dry Run] ✅ Successfully verified v${newVersion} build pipeline offline!`);

    console.log(`\n[Dry Run] Summary:`);
    console.log(` - Use cases: ${useCasesCount}`);
    console.log(` - Features: ${featuresCount}`);
    console.log(` - Skills: ${skillsCount} (${skillNames.join(', ')})`);

    console.log(`\n💡 Tip: Run thorough pre-flight verification with FULL=1 to include heavy agent tests:`);
    console.log(`   env FULL=1 TEST_REPORTER=spec pnpm test`);
  } else {
    console.log(`\n💡 Tip: Run thorough pre-flight verification with FULL=1 to include heavy agent tests:`);
    console.log(`   env FULL=1 TEST_REPORTER=spec pnpm test`);

    console.log(`\nPublishing new dist/skills-cli/ to GoogleChrome/modern-web-guidance (main branch)...`);
    
    await ghpages.publish(publishCliDir, {
      src: ['**/*'], // No longer vendor node_modules! Users will install via npx -y!
      branch: 'main',
      repo: 'git@github.com:GoogleChrome/modern-web-guidance.git',
      dotfiles: true,
      message: `Release v${newVersion}`,
      tag: `v${newVersion}`,
      remove: "**/*"
    });


    console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/modern-web-guidance!`);

    // Create and push tag on current repo
    console.log(`Creating and pushing Git tag v${newVersion}...`);
    execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
    execSync(`git push origin v${newVersion}`, { stdio: 'inherit' });

    console.log(`\nv${newVersion} published.  https://github.com/GoogleChrome/modern-web-guidance  and [GoB repo](https://user.git.corp.google.com/rviscomi/modern-web-guidance/)`);
    console.log(`${useCasesCount} usecases.`);
    console.log(`${featuresCount} features`);
    console.log(`${skillsCount} skills (${skillNames.join(', ')})`);

    console.log('\nPerhaps also:\n    pushd ~/code/skills-alpha && git pull gh && git push gob && popd');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Publishing failed!", err);
    process.exit(1);
  });
}
