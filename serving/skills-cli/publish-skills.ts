import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ghpages from 'gh-pages';
import { buildDist } from './build-dist.ts';
import { fileURLToPath } from 'node:url';
import { minimatch } from 'minimatch';

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/
const SERVING_DIR = path.join(ROOT_DIR, "serving");
const DIST_DIR = path.join(ROOT_DIR, "dist");

// This controls what is published to https://github.com/GoogleChrome/modern-web-guidance.
const GH_PUBLISH_PATTERNS = [
  '**/*',
  '!**/guides/**',
  '!**/tfjs_model_minilm/**',
  '!**/*.{js,mjs,ts,bin,map,gz}',
  '!THIRD_PARTY_NOTICES',
  '!skills/modern-web/package.json',
];

const isDryRun = process.argv.includes('--dry-run');

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const patch = parseInt(parts[2], 10) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

const getLatestGitTag = () => execSync('git tag -l "v*.*.*" --merged HEAD --sort=-v:refname | head -n 1 | grep .', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

export async function getNextVersion(getLatestTag = getLatestGitTag): Promise<string> {
  console.log("Determining next version...");

  // Get the latest tag that looks like v*.*.*
  const latestTag = getLatestTag();
  const currentVersion = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
  console.log(`Found latest tag: ${latestTag}`);

  const newVersion = incrementVersion(currentVersion);
  console.log(`Next version will be: ${newVersion}`);
  return newVersion;
}

async function publishToDistributionRepo(publishCliDir: string, newVersion: string, releaseNotes: string) {
  console.log(`Creating GitHub release v${newVersion} on GoogleChrome/modern-web-guidance...`);
  console.log(`\nPublishing new dist/skills-cli/ to GoogleChrome/modern-web-guidance (main branch)...`);

  await ghpages.publish(publishCliDir, {
    branch: 'main',
    repo: 'git@github.com:GoogleChrome/modern-web-guidance.git',
    dotfiles: true,
    message: `Release v${newVersion}`,
    tag: `v${newVersion}`,
    src: GH_PUBLISH_PATTERNS,
  });

  // TODO: not working. Think we need a GH API key from the modern-web-guidance repo.
  // Create GitHub release on the distribution repo.
  // execSync(`gh release create v${newVersion} -R GoogleChrome/modern-web-guidance --title "v${newVersion}" --notes -`, {
  //   input: releaseNotes,
  //   stdio: ['pipe', 'inherit', 'inherit']
  // });
  // console.log(`✅ GitHub release v${newVersion} created successfully!`);
  console.log(releaseNotes);

  console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/modern-web-guidance!`);
}

/**
 * Validate using the local build.
 */
async function validate(newVersion: string) {
  const publishCliDir = path.join(DIST_DIR, "skills-cli");

  console.log(`\nRebuilding distribution with version ${newVersion}...`);
  const result = await buildDist({publishRoot: publishCliDir, version: newVersion});
  if (!result) {
    throw new Error("Build failed or was already in progress.");
  }

  console.log(`\nVerifying built distribution with test-dist.test.ts suite...`);
  execSync('node --test skills-cli/*.test.ts', {
    cwd: SERVING_DIR,
    stdio: 'inherit' ,
    env: { ...process.env, TEST_REPORTER: 'spec' }
  });

  return result;
}

async function main() {
  const newVersion = await getNextVersion();

  const result = await validate(newVersion);
  const publishCliDir = path.join(DIST_DIR, "skills-cli");

  const { featuresCount, useCasesCount, skillsCount, skillNames } = result;

  if (isDryRun) {
    const files = await fs.readdir(publishCliDir, {recursive: true, withFileTypes: true});
    const filteredFiles = files
      .filter(f => !f.parentPath.includes('node_modules') && f.isFile())
      .map(f => path.relative(publishCliDir, path.join(f.parentPath, f.name)))
      .filter(f => {
        return GH_PUBLISH_PATTERNS.every(pattern => {
          if (pattern.startsWith('!')) {
            return !minimatch(f, pattern.slice(1), { dot: true });
          }
          return minimatch(f, pattern, { dot: true });
        });
      })
      .sort((a,b) => a.localeCompare(b));

    console.log(`\n[Dry Run] Skipping GitHub publishing. Would push:\n - ${filteredFiles.join('\n - ')}`);
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

    const releaseNotes = `### Summary
- Use cases: ${useCasesCount}
- Features: ${featuresCount}
- Skills: ${skillsCount}
${skillNames.map(skill => `  - ${skill}`).join('\n')}`.trim();
    await publishToDistributionRepo(publishCliDir, newVersion, releaseNotes);

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
