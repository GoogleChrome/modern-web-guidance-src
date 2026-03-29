import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../lib/colors.ts';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

const WORKTREE_DIR = path.resolve('../.worktrees/suite-upload');

function runGit(cmd: string, cwd: string = WORKTREE_DIR) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (err: any) {
    if (err.stderr) {
       console.error(cRed(`Git Error [${cmd}]: \n${err.stderr}`));
    }
    throw err;
  }
}

async function uploadToGit(suiteName: string, resultsDir: string) {
  console.log(cCyan(`Checking out temp git worktree at ${WORKTREE_DIR}...`));
  
  // Create worktree if it doesn't exist
  if (!fs.existsSync(WORKTREE_DIR)) {
    // Note: Use -B to ensure it forces the branch creation/update from origin/gh-pages
    runGit(`git worktree add -B gh-pages ${WORKTREE_DIR} origin/gh-pages`, baseResultsDir);
  } else {
    // If it exists, pull latest to avoid non-fast-forward conflicts if possible
    console.log(cCyan(`Worktree exists, fetching and pulling gh-pages...`));
    runGit(`git fetch origin gh-pages`, WORKTREE_DIR);
    runGit(`git reset --hard origin/gh-pages`, WORKTREE_DIR);
  }

  const destDir = path.join(WORKTREE_DIR, 'results', suiteName);
  console.log(cCyan(`Copying results to worktree's ${destDir}...`));
  
  // Copy results into the worktree results folder
  if (!fs.existsSync(destDir)) {
     fs.mkdirSync(destDir, { recursive: true });
  }
  fs.cpSync(resultsDir, destDir, { recursive: true });

  // Update scripts manifest inside worktree
  console.log(cCyan(`Updating suites.json manifest inside worktree...`));
  const worktreeResults = path.join(WORKTREE_DIR, 'results');
  let suites: string[] = [];
  if (fs.existsSync(worktreeResults)) {
     suites = fs.readdirSync(worktreeResults, { withFileTypes: true })
       .filter(item => item.isDirectory())
       .filter(item => fs.existsSync(path.join(worktreeResults, item.name, 'evals.json')))
       .map(item => item.name);
  }
  suites.sort();
  fs.writeFileSync(path.join(WORKTREE_DIR, 'suites.json'), JSON.stringify(suites, null, 2));

  console.log(cCyan(`Committing and pushing to gh-pages...`));
  runGit(`git add .`, WORKTREE_DIR);
  
  // Only commit if there are changes to prevent empty commit failures
  const status = runGit(`git status --short`, WORKTREE_DIR);
  if (!status) {
     console.log(cGreen(`✅ Results are already up to date on gh-pages!`));
     return;
  }

  runGit(`git commit -m "feat(results): upload suite ${suiteName}"`, WORKTREE_DIR);
  runGit(`git push origin gh-pages`, WORKTREE_DIR);
}

async function main() {
  let suiteName = process.argv[2];

  if (!suiteName) {
    console.error('❌ Please provide a suite name or path as an argument. e.g. pnpm upload <suite-name>');
    process.exit(1);
  }

  // Strip trailing slashes and normalize to just the suite ID
  suiteName = path.basename(suiteName);

  const resultsDir = path.join(baseResultsDir, suiteName);
  const evalsJsonPath = path.join(resultsDir, 'evals.json');

  if (!fs.existsSync(resultsDir)) {
    console.error(cRed(`❌ Results directory not found: ${resultsDir}`));
    process.exit(1);
  }

  if (!fs.existsSync(evalsJsonPath)) {
    console.error(cRed(`❌ evals.json not found in ${resultsDir}. Cannot upload incomplete or un-evaluated suite.`));
    process.exit(1);
  }

  console.log(cBold(cCyan(`Starting upload for suite: ${suiteName}`)));

  try {
    await uploadToGit(suiteName, resultsDir);
    console.log(cBold(cGreen(`\n✅ Successfully uploaded suite '${suiteName}' to GitHub Pages.`)));
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
