import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { globSync } from 'glob';
import { config } from '../lib/skills-config.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

// Canonical root markdown files
const CANONICAL_ROOT_MD = new Set([
  'README.md',
  'CONTEXT.md',
  'CONTRIBUTING.md',
  'EVALS.md',
  'GEMINI.md',
  'CODE_OF_CONDUCT.md'
]);

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function checkGitState() {
  console.log('📁 Checking Git State...');
  const status = runCommand('git status --porcelain');
  if (status) {
    console.warn('⚠️  Working tree is dirty:\n' + status.split('\n').map(l => '    ' + l).join('\n'));
  } else {
    console.log('✅ Working tree is clean.');
  }

  const branch = runCommand('git branch --show-current');
  if (branch === 'main' || branch === 'master') {
    console.warn(`⚠️  You are on the "${branch}" branch. It is recommended to work on a feature branch.`);
  } else if (branch) {
    console.log(`ℹ️  Active branch: ${branch}`);
  } else {
    console.log('ℹ️  Detached HEAD state.');
  }
}

function checkClutter() {
  console.log('\n🧹 Checking for Root Clutter...');
  const rootMdFiles = globSync('*.md', { cwd: REPO_ROOT });
  const clutter = rootMdFiles.filter(f => !CANONICAL_ROOT_MD.has(f));
  if (clutter.length > 0) {
    console.warn('⚠️  Found potential root clutter (untracked or non-canonical markdown files):');
    clutter.forEach(f => console.warn(`    - ${f}`));
  } else {
    console.log('✅ No root clutter found.');
  }
}

function checkLinkIntegrity() {
  console.log('\n🔗 Checking Link Integrity...');
  const mdFiles = globSync('**/*.md', {
    cwd: REPO_ROOT,
    ignore: ['**/node_modules/**', '**/dist/**', '**/test-app-results/**', '**/test-app-result/**']
  });

  let brokenLinksCount = 0;

  for (const file of mdFiles) {
    const filePath = path.join(REPO_ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);

    // Simple regex to find relative markdown links: [text](path)
    // Matches links that don't start with http, https, mailto, or #
    const linkRegex = /\[([^\]]+)\]\(((?!\w+:|#)[^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[2].split('#')[0]; // Remove hash fragment
      if (!linkPath) continue; // Skip empty links or anchor-only links

      // Resolve relative path
      const resolvedPath = path.resolve(dir, linkPath);
      if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Broken link in \`${file}\`: [${match[1]}](${match[2]}) -> Points to non-existent path: \`${path.relative(REPO_ROOT, resolvedPath)}\``);
        brokenLinksCount++;
      }
    }
  }

  if (brokenLinksCount === 0) {
    console.log('✅ All relative markdown links are valid.');
  } else {
    console.error(`❌ Found ${brokenLinksCount} broken links.`);
  }
}

function checkFeatureMapSync() {
  console.log('\n📊 Checking Feature Map Sync...');
  const featureMapPath = path.join(REPO_ROOT, 'guides/features-and-use-cases.md');
  if (!fs.existsSync(featureMapPath)) {
    console.warn('⚠️  guides/features-and-use-cases.md not found. Skipping sync check.');
    return;
  }
  const originalContent = fs.readFileSync(featureMapPath, 'utf8');

  // Run generator
  runCommand('node guides/guide-features-diagram.mjs');

  const newContent = fs.readFileSync(featureMapPath, 'utf8');
  if (originalContent !== newContent) {
    console.error('❌ features-and-use-cases.md is out of sync! Run `node guides/guide-features-diagram.mjs` to update it.');
    // Restore original content to remain read-only
    fs.writeFileSync(featureMapPath, originalContent);
  } else {
    console.log('✅ features-and-use-cases.md is in sync.');
  }
}

function scanTodos() {
  console.log('\n📝 Scanning for TODOs/TBDs in Canonical & Source Docs...');
  const mdFiles = globSync(['*.md', 'guides/**/*.md', 'skills-src/**/*.md'], {
    cwd: REPO_ROOT,
    ignore: ['**/node_modules/**', '**/dist/**', '**/test-app-results/**', '**/test-app-result/**']
  });

  const markers = ['TODO', 'TBD', 'FIXME', 'unresolved', 'decision needed'];
  let foundCount = 0;

  for (const file of mdFiles) {
    // Skip scratch files if we found them in clutter check
    const isClutter = !CANONICAL_ROOT_MD.has(file) && !file.includes('/');
    if (isClutter) continue;

    const filePath = path.join(REPO_ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      for (const marker of markers) {
        if (line.includes(marker)) {
          console.log(`ℹ️  Found ${marker} in \`${file}\` on line ${index + 1}: ${line.trim()}`);
          foundCount++;
        }
      }
    });
  }

  if (foundCount === 0) {
    console.log('✅ No TODOs/TBDs found.');
  } else {
    console.log(`ℹ️  Found ${foundCount} items needing attention.`);
  }
}

function checkSkillsConfig() {
  console.log('\n⚙️  Checking Standalone Skills Configuration...');
  const skillsSrcDir = path.join(REPO_ROOT, 'skills-src');
  if (!fs.existsSync(skillsSrcDir)) {
    console.log('✅ No skills-src directory found.');
    return;
  }

  const configuredSkills = new Set(config.standaloneSkills.map(s => s.sourcePath));
  const skillFiles = globSync('**/SKILL.md', { cwd: skillsSrcDir });

  let unconfiguredCount = 0;
  for (const file of skillFiles) {
    const relPath = path.join('skills-src', file);
    if (!configuredSkills.has(relPath)) {
      console.warn(`⚠️  Skill definition \`${relPath}\` is not configured in \`lib/skills-config.ts\`. It will be treated as INERT.`);
      unconfiguredCount++;
    }
  }

  if (unconfiguredCount === 0) {
    console.log('✅ All source skills are configured.');
  }
}

function checkContextSkillCoherence() {
  console.log('\n🧠 Checking Coherence between CONTEXT.md and Project Skills...');
  const contextPath = path.join(REPO_ROOT, 'CONTEXT.md');
  if (!fs.existsSync(contextPath)) {
    console.warn('⚠️  CONTEXT.md not found. Skipping coherence check.');
    return;
  }

  const projectSkills = globSync('.agents/skills/project-*/SKILL.md', { cwd: REPO_ROOT });
  
  console.log('ℹ️  Verify semantic alignment between CONTEXT.md and the following skills:');
  projectSkills.forEach(skill => {
    console.log(`    - ${skill}`);
  });
  console.log('    Ensure that workflow stages, checkpoints, and requirements match between them.');
}

function checkGuidesIntegrity(): boolean {
  console.log('\n🛡️  Running Guides Integrity Tests...');
  try {
    execSync('node --experimental-strip-types --test guides/guides-integrity.test.ts', {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
    console.log('✅ Guides integrity tests passed.');
    return true;
  } catch (e) {
    console.error('❌ Guides integrity tests failed.');
    return false;
  }
}

function runPreflight(): boolean {
  console.log('\n⚡ Running Full Preflight (Build, Typecheck, Lint, Tests)...');
  try {
    execSync('pnpm run preflight', {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    });
    console.log('✅ Preflight passed.');
    return true;
  } catch (e) {
    console.error('❌ Preflight failed.');
    return false;
  }
}

function main() {
  console.log('================================================');
  console.log('🕵️  Starting Coherence & Integrity Audit');
  console.log('================================================\n');

  const args = process.argv.slice(2);
  const doPreflight = args.includes('--preflight');

  checkGitState();
  checkClutter();
  checkLinkIntegrity();
  checkFeatureMapSync();
  scanTodos();
  checkSkillsConfig();
  checkContextSkillCoherence();
  
  checkGuidesIntegrity();

  if (doPreflight) {
    runPreflight();
  } else {
    console.log('\n💡 Tip: Run with `--preflight` to run full build, typecheck, lint, and tests.');
  }

  console.log('\n================================================');
  console.log('🏁 Audit Complete');
  console.log('================================================');
}

main();
