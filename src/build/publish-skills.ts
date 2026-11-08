import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import ghpages from 'gh-pages';
import { buildDist, processSkills, type DistTag } from './build-dist.ts';
import { updateReadmeWithFeaturesAndUseCases, getFeaturesAndUseCases } from './build-readme.ts';
import { fileURLToPath } from 'node:url';
import { minimatch } from 'minimatch';
import { generateReleaseNotes } from './generate-release-notes.ts';
import { rootDir } from '../core/paths.ts';
import { embedGuideChunks } from '../rag/embed-guide-chunks.ts';

const ROOT_DIR = rootDir; // modern-web-guidance-src/

const DIST_DIR = path.join(ROOT_DIR, "dist");

// This controls what is published to https://github.com/GoogleChrome/modern-web-guidance.
const GH_PUBLISH_PATTERNS = [
  '**/*',
  '!**/.cache/**',
  '!**/tfjs-model-minilm/**',
  '!**/static-model/**',
  '!**/*.{js,mjs,ts,bin,map,gz,i8,f32}',
  '!**/guides.json',
  '!**/skill-version.txt',
  '!THIRD_PARTY_NOTICES',
  '!skills/modern-web-guidance/package.json',
];

const isDryRun = process.argv.includes('--dry-run');

export type { DistTag };

export interface PublishOptions {
  distTag: DistTag;
  explicitVersion?: string;
}

export function parsePublishOptions(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): PublishOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      tag: { type: 'string' },
      version: { type: 'string' },
    },
    strict: false,
  });

  const rawTag = (typeof values.tag === 'string' ? values.tag : (env.DIST_TAG ?? env.NPM_DIST_TAG))?.trim();
  const rawVersion = (typeof values.version === 'string' ? values.version : env.RELEASE_VERSION)?.trim();

  const distTag = (rawTag || 'latest') as DistTag;
  if (distTag !== 'latest' && distTag !== 'next') {
    throw new Error(`Invalid dist-tag "${distTag}". Expected "latest" or "next".`);
  }

  const explicitVersion = rawVersion ? rawVersion.replace(/^v/, '') : undefined;
  if (explicitVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
    throw new Error(`Invalid explicit version "${rawVersion}". Expected X.Y.Z semver (e.g. 1.0.0).`);
  }

  return { distTag, explicitVersion };
}

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const patch = parseInt(parts[2], 10) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

const getLatestGitTag = (target = 'HEAD') => {
  const output = execSync(`git tag --merged ${target} -l "v*.*.*" --sort=-v:refname`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  if (!output) {
    throw new Error(`No tag matching v*.*.* found reachable from ${target}`);
  }
  return output.split('\n')[0].trim();
};

const DIST_REPO_URL = 'https://github.com/GoogleChrome/modern-web-guidance.git';

function gitTagExists(version: string, targetRepos = ['origin', DIST_REPO_URL]): boolean {
  const localCheck = execSync(`git tag -l "v${version}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  if (localCheck) return true;

  for (const targetRepo of targetRepos) {
    try {
      const remoteCheck = execSync(`git ls-remote --tags ${targetRepo} "refs/tags/v${version}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (remoteCheck) return true;
    } catch (err) {
      console.log(`Warning: Failed to check remote tags on ${targetRepo}:`, err instanceof Error ? err.message : err);
    }
  }

  return false;
}

export async function getNextVersion(getLatestTag = getLatestGitTag): Promise<string> {
  console.log("Determining next version...");

  const target = isDryRun ? 'origin/main' : 'HEAD';
  console.log(`Checking latest tag against ${target}...`);
  
  let latestTag: string;
  try {
    latestTag = getLatestTag(target);
  } catch (err) {
    if (isDryRun) {
      console.log(`Could not find tags on ${target}. Falling back to HEAD.`);
      latestTag = getLatestTag('HEAD');
    } else {
      throw err;
    }
  }

  console.log(`Found latest tag: ${latestTag}`);
  const currentVersion = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;

  const newVersion = incrementVersion(currentVersion);
  console.log(`Next version will be: ${newVersion}`);
  return newVersion;
}

async function publishBranchToDistributionRepo(
  publishCliDir: string,
  branch: 'main' | 'next',
  message: string,
  tag?: string,
) {
  // Use a branch-specific cache dir so gh-pages doesn't collide when pushing main + next in one run
  const cacheBase = path.join(ROOT_DIR, 'node_modules/.cache/gh-pages', branch);
  await new Promise<void>((resolve, reject) => {
    ghpages.publish(
      publishCliDir,
      {
        branch,
        repo: 'git@github.com:GoogleChrome/modern-web-guidance.git',
        dotfiles: true,
        message,
        ...(tag ? { tag } : {}),
        clone: cacheBase,
        src: GH_PUBLISH_PATTERNS,
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
}

function getLatestDistributionReleaseTag(fallbackTag: string): string {
  try {
    const ghLatestRelease = execSync(
      'gh release view -R GoogleChrome/modern-web-guidance --json tagName -q .tagName',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).trim();
    if (ghLatestRelease) {
      execSync(`git rev-parse -q --verify "refs/tags/${ghLatestRelease}"`, { stdio: 'ignore' });
      return ghLatestRelease;
    }
  } catch {
    // Fall back to git ls-remote when gh CLI is unavailable or unauthenticated
  }
  try {
    const remoteTags = execSync(
      `git ls-remote --tags --refs --sort=-v:refname ${DIST_REPO_URL} "v*.*.*"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).trim();
    const firstLine = remoteTags.split('\n')[0];
    const match = firstLine?.match(/refs\/tags\/(v\S+)$/);
    if (match) {
      execSync(`git rev-parse -q --verify "refs/tags/${match[1]}"`, { stdio: 'ignore' });
      return match[1];
    }
  } catch {
    // Fall back to local git tag if offline
  }
  return fallbackTag;
}

async function publishToDistributionRepo(
  publishCliDir: string,
  newVersion: string,
  latestTag: string,
  distTag: DistTag = 'latest',
) {
  if (distTag === 'next') {
    console.log(`\nPublishing new dist/skills-cli/ to GoogleChrome/modern-web-guidance (next branch)...`);
    await publishBranchToDistributionRepo(
      publishCliDir,
      'next',
      `Release v${newVersion} (next)`,
    );
    console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/modern-web-guidance (next branch)!`);
    return;
  }

  const previousReleaseTag = getLatestDistributionReleaseTag(latestTag);
  console.log(`\nPublishing new dist/skills-cli/ to GoogleChrome/modern-web-guidance (main branch)...`);
  await publishBranchToDistributionRepo(
    publishCliDir,
    'main',
    `Release v${newVersion}`,
    `v${newVersion}`,
  );

  console.log(`Syncing GoogleChrome/modern-web-guidance (next branch) with v${newVersion}...`);
  processSkills(publishCliDir, 'next');
  try {
    await publishBranchToDistributionRepo(
      publishCliDir,
      'next',
      `Release v${newVersion}`,
    );
  } finally {
    processSkills(publishCliDir, 'latest');
  }

  const releaseNotes = await generateReleaseNotes({
    previousTag: previousReleaseTag,
    newVersion,
    publishCliDir,
  });

  // Attempt to create formal GitHub release on the distribution repo if gh CLI is authenticated
  try {
    console.log(`Creating GitHub release v${newVersion} on GoogleChrome/modern-web-guidance...`);
    execSync(`gh release create "v${newVersion}" -R GoogleChrome/modern-web-guidance --title "v${newVersion}" --notes-file -`, {
      input: releaseNotes,
      stdio: ['pipe', 'inherit', 'pipe'],
    });
    console.log(`✅ GitHub release v${newVersion} created successfully!`);
  } catch (err: any) {
    console.log(`Note: Could not automatically create GitHub release via gh CLI: ${err?.message || err}`);
  }

  console.log('\n--- Release Notes ---');
  console.log(releaseNotes);

  console.log(`\n✅ Successfully published v${newVersion} to GoogleChrome/modern-web-guidance!`);
}

/**
 * Validate using the local build.
 */
export interface ValidateDeps {
  dryRun?: boolean;
  distTag?: DistTag;
  embedChunks?: typeof embedGuideChunks;
  runBuildDist?: typeof buildDist;
  runDistTests?: () => void;
}

export async function validate(newVersion: string, deps: ValidateDeps = {}) {
  const {
    dryRun = isDryRun,
    distTag = 'latest',
    embedChunks = embedGuideChunks,
    runBuildDist = buildDist,
    runDistTests = () =>
      execSync('node --test src/build/dist.test.ts', {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        env: { ...process.env, TEST_REPORTER: 'spec' },
      }),
  } = deps;
  const publishCliDir = path.join(DIST_DIR, "skills-cli");

  if (dryRun) {
    console.log(`\nChecking cached teacher vectors (dry run)...`);
    const checkResult = await embedChunks({ check: true });
    if (checkResult.missing.length > 0) {
      const missingGuides = [...new Set(checkResult.missing.map((c) => c.guideId))];
      console.warn(
        `⚠️  [Dry Run] ${checkResult.missing.length} chunk(s) across ${missingGuides.length} guide(s) lack cached teacher vectors ` +
          `(indexed for BM25 only, vector: []; real publish will embed them):\n` +
          missingGuides.map((g) => `  - ${g}`).join("\n")
      );
    }
  } else {
    console.log(`\nEnsuring all guide chunks have cached teacher vectors...`);
    const embedResult = await embedChunks({ prune: true });
    if (embedResult.newEmbeds > 0 || embedResult.prunedCount > 0) {
      console.log(`✅ Updated static chunk vector cache (+${embedResult.newEmbeds} embedded, -${embedResult.prunedCount} pruned).`);
    }
  }

  console.log(`\nRebuilding distribution with version ${newVersion} (dist-tag: ${distTag})...`);
  const result = await runBuildDist({
    publishRoot: publishCliDir,
    version: newVersion,
    failOnMissingVectors: !dryRun,
    distTag,
  });
  if (!result) {
    throw new Error("Build failed or was already in progress.");
  }

  console.log(`\nVerifying built distribution with dist.test.ts suite...`);
  runDistTests();

  return result;
}

async function main() {
  const { distTag, explicitVersion } = parsePublishOptions();
  const latestTag = getLatestGitTag();
  let newVersion: string;

  if (explicitVersion) {
    if (gitTagExists(explicitVersion)) {
      throw new Error(`Version v${explicitVersion} has already been tagged!`);
    }
    newVersion = explicitVersion;
    console.log(`Using explicit version override: ${newVersion} (dist-tag: ${distTag})`);
  } else {
    newVersion = await getNextVersion();
    // Self-healing loop: ensure the version tag doesn't exist locally or on remote repos
    while (gitTagExists(newVersion)) {
      console.log(`⚠️ Version v${newVersion} has already been tagged! Bumping version to next patch...`);
      newVersion = incrementVersion(newVersion);
    }
  }

  const { skillsCount, skillNames } = await validate(newVersion, { distTag });
  const publishCliDir = path.join(DIST_DIR, "skills-cli");

  if (isDryRun) {
    const { allFeatureIds, readyGuides } = getFeaturesAndUseCases();
    const featuresCount = allFeatureIds.size;
    const useCasesCount = readyGuides.length;

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
    console.log(`\n[Dry Run] Skills: ${skillsCount} (${skillNames.join(', ')})`);
    console.log(`\n[Dry Run] Features: ${featuresCount}, Use cases: ${useCasesCount}`);

    const previousReleaseTag = getLatestDistributionReleaseTag(latestTag);
    console.log(`\n[Dry Run] Generating release notes using Gemini for v${newVersion} (diff against ${previousReleaseTag})...`);
    const releaseNotes = await generateReleaseNotes({
      previousTag: previousReleaseTag,
      newVersion,
      publishCliDir,
    });

    console.log('\n============================== [DRY RUN] RELEASE NOTES ==============================');
    console.log(releaseNotes);
    console.log('====================================================================================\n');

    console.log(`\n💡 Tip: Run thorough pre-flight verification with FULL=1 to include heavy agent tests:`);
    console.log(`   env FULL=1 TEST_REPORTER=spec pnpm test`);
  } else {
    console.log(`\n💡 Tip: Run thorough pre-flight verification with FULL=1 to include heavy agent tests:`);
    console.log(`   env FULL=1 TEST_REPORTER=spec pnpm test`);

    const ref = process.env.GITHUB_REF || 'main';
    const branch = ref.replace(/^refs\/heads\//, '');
    execSync(`git pull --rebase --autostash origin "${branch}"`, { stdio: 'inherit', cwd: ROOT_DIR });

    // Update both the distribution bundle README and the source repo README
    const { featuresCount, useCasesCount } = updateReadmeWithFeaturesAndUseCases([ROOT_DIR, publishCliDir]);

    await publishToDistributionRepo(publishCliDir, newVersion, latestTag, distTag);

    console.log('Committing automated documentation updates to source repo...');
    try {
      execSync('git diff --quiet README.md src/build/eval-results-summary.json src/rag/static-model/guide-chunk-cache.json src/rag/static-model/guide-chunk-cache.i8 src/rag/static-model/guide-chunk-cache.scale.f32', { cwd: ROOT_DIR });
      console.log("No changes in README.md, src/build/eval-results-summary.json, or static chunk cache to commit.");
    } catch (err) {
      console.log("Changes found in README.md, eval-results-summary.json, or static chunk cache, committing...");
      execSync('git add README.md src/build/eval-results-summary.json src/rag/static-model/guide-chunk-cache.json src/rag/static-model/guide-chunk-cache.i8 src/rag/static-model/guide-chunk-cache.scale.f32', { stdio: 'inherit', cwd: ROOT_DIR });
      execSync('git commit -m "docs: auto-update recent evals and skill coverage in README.md [skip ci]"', { stdio: 'inherit', cwd: ROOT_DIR });
      execSync(`git pull --rebase origin "${branch}"`, { stdio: 'inherit', cwd: ROOT_DIR });
      execSync(`git push origin HEAD:"${ref}"`, { stdio: 'inherit', cwd: ROOT_DIR });
    }

    // Create and push tag on current repo
    console.log(`Creating and pushing Git tag v${newVersion}...`);
    execSync(`git tag v${newVersion}`, { stdio: 'inherit', cwd: ROOT_DIR });
    execSync(`git push origin v${newVersion}`, { stdio: 'inherit', cwd: ROOT_DIR });

    console.log(`\nv${newVersion} published.  https://github.com/GoogleChrome/modern-web-guidance  and [GoB repo](https://user.git.corp.google.com/rviscomi/modern-web-guidance/)`);
    console.log(`${useCasesCount} usecases.`);
    console.log(`${featuresCount} features`);
    console.log(`${skillsCount} skills (${skillNames.join(', ')})`);

    console.log('\nPerhaps also:\n    pushd ~/code/modern-web-guidance && git pull gh && git push gob && popd');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Publishing failed!", err);
    process.exit(1);
  });
}
