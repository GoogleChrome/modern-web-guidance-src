import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { globSync } from 'glob';
import { config } from '../lib/skills-config.ts';
import { TEST_APP_RESULTS_DIR } from '../lib/guide-validation.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const CANONICAL_ROOT_MD = new Set(['README.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'EVALS.md', 'GEMINI.md', 'CODE_OF_CONDUCT.md']);

const run = (cmd: string) => {
  try { return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); }
  catch { return ''; }
};

console.log('================================================\n🕵️  Starting Coherence & Integrity Audit\n================================================\n');

// 1. Git State
console.log('📁 Checking Git State...');
const status = run('git status --porcelain');
if (status) console.warn('⚠️  Working tree is dirty:\n' + status.split('\n').map(l => '    ' + l).join('\n'));
else console.log('✅ Working tree is clean.');
const branch = run('git branch --show-current');
console.log(branch === 'main' ? '⚠️  On main branch.' : `ℹ️  Active branch: ${branch || 'Detached HEAD'}`);

// 2. Root Clutter
console.log('\n🧹 Checking for Root Clutter...');
const clutter = globSync('*.md', { cwd: REPO_ROOT }).filter(f => !CANONICAL_ROOT_MD.has(f));
if (clutter.length) console.warn('⚠️  Potential root clutter:', clutter.join(', '));
else console.log('✅ No root clutter found.');

// 3. Link Integrity
console.log('\n🔗 Checking Link Integrity...');
let broken = 0;
for (const file of globSync('**/*.md', { cwd: REPO_ROOT, ignore: ['**/node_modules/**', '**/dist/**', `**/${TEST_APP_RESULTS_DIR}/**`] })) {
  const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const dir = path.dirname(path.join(REPO_ROOT, file));
  let match;
  const rx = /\[([^\]]+)\]\(((?!\w+:|#)[^)]+)\)/g;
  while ((match = rx.exec(content)) !== null) {
    const link = match[2].split('#')[0];
    if (link && !fs.existsSync(path.resolve(dir, link))) {
      console.error(`❌ Broken link in \`${file}\`: [${match[1]}](${match[2]})`);
      broken++;
    }
  }
}
if (!broken) console.log('✅ All relative links are valid.');

// 4. Feature Map Sync
console.log('\n📊 Checking Feature Map Sync...');
const mapPath = path.join(REPO_ROOT, 'guides/features-and-use-cases.md');
if (fs.existsSync(mapPath)) {
  const orig = fs.readFileSync(mapPath, 'utf8');
  run('node guides/guide-features-diagram.mjs');
  if (orig !== fs.readFileSync(mapPath, 'utf8')) {
    console.error('❌ features-and-use-cases.md is out of sync! Run `node guides/guide-features-diagram.mjs`.');
    fs.writeFileSync(mapPath, orig);
  } else console.log('✅ features-and-use-cases.md is in sync.');
}

// 5. TODOs
console.log('\n📝 Scanning for TODOs/TBDs...');
const todos = run('git grep -n -I -E "TODO|TBD|FIXME|unresolved|decision needed" -- "guides/*.md" "skills-src/*.md" README.md CONTEXT.md CONTRIBUTING.md EVALS.md GEMINI.md CODE_OF_CONDUCT.md');
if (todos) console.warn('⚠️  Found items needing attention:\n' + todos.split('\n').map(l => '    ' + l).join('\n'));
else console.log('✅ No TODOs/TBDs found.');

// 6. Skills Config
console.log('\n⚙️  Checking Standalone Skills Configuration...');
if (fs.existsSync(path.join(REPO_ROOT, 'skills-src'))) {
  const configured = new Set(config.standaloneSkills.map(s => s.sourcePath));
  let inert = 0;
  for (const file of globSync('**/SKILL.md', { cwd: path.join(REPO_ROOT, 'skills-src') })) {
    const rel = path.join('skills-src', file);
    if (!configured.has(rel)) {
      console.warn(`⚠️  Inert skill: \`${rel}\` (not in skills-config.ts)`);
      inert++;
    }
  }
  if (!inert) console.log('✅ All source skills are configured.');
}

// 7. Context Coherence
console.log('\n🧠 Checking Coherence with CONTEXT.md...');
if (fs.existsSync(path.join(REPO_ROOT, 'CONTEXT.md'))) {
  console.log('ℹ️  Verify semantic alignment with project skills:');
  globSync('.agents/skills/project-*/SKILL.md', { cwd: REPO_ROOT }).forEach(s => console.log(`    - ${s}`));
}

// 8. Guides Integrity
console.log('\n🛡️  Running Guides Integrity Tests...');
try {
  execSync('node --experimental-strip-types --test guides/guides-integrity.test.ts', { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log('✅ Guides integrity tests passed.');
} catch {
  console.error('❌ Guides integrity tests failed.');
}

// 9. Optional Preflight
if (process.argv.includes('--preflight')) {
  console.log('\n⚡ Running Full Preflight...');
  try {
    execSync('pnpm run preflight', { cwd: REPO_ROOT, stdio: 'inherit' });
    console.log('✅ Preflight passed.');
  } catch {
    console.error('❌ Preflight failed.');
  }
} else {
  console.log('\n💡 Tip: Run with `--preflight` to run full build, typecheck, lint, and tests.');
}

console.log('\n================================================\n🏁 Audit Complete\n================================================');
