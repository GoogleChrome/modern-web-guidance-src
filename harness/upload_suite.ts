import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../lib/colors.ts';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

const CLONE_DIR = path.resolve('../.clones/suite-upload');
const REMOTE_URL = 'https://github.com/GoogleChrome/guidance-dash.git';

function runGit(cmd: string, cwd: string = CLONE_DIR) {
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
  console.log(cCyan(`Checking out temp git clone at ${CLONE_DIR}...`));
  
  // Create clone if it doesn't exist
  if (!fs.existsSync(CLONE_DIR)) {
    console.log(cCyan(`Cloning external repository to ${CLONE_DIR}...`));
    runGit(`git clone --depth 1 ${REMOTE_URL} ${CLONE_DIR}`, baseResultsDir);
  } else {
    console.log(cCyan(`Clone exists, fetching and pulling latest...`));
    runGit(`git fetch origin`, CLONE_DIR);
    runGit(`git reset --hard origin/main`, CLONE_DIR);
  }

  const destDir = path.join(CLONE_DIR, 'results', suiteName);
  console.log(cCyan(`Copying results to worktree's ${destDir}...`));
  
  // Copy results into the worktree results folder
  if (!fs.existsSync(destDir)) {
     fs.mkdirSync(destDir, { recursive: true });
  }
  fs.cpSync(resultsDir, destDir, { recursive: true });

  // Update scripts manifest inside worktree
  console.log(cCyan(`Updating suites.gen.json manifest inside worktree...`));
  const worktreeResults = path.join(CLONE_DIR, 'results');
  let suites: string[] = [];
  if (fs.existsSync(worktreeResults)) {
     suites = fs.readdirSync(worktreeResults, { withFileTypes: true })
       .filter(item => item.isDirectory())
       .filter(item => fs.existsSync(path.join(worktreeResults, item.name, 'evals.json')))
       .map(item => item.name);
  }
  suites.sort();
  fs.writeFileSync(path.join(CLONE_DIR, 'suites.gen.json'), JSON.stringify(suites, null, 2));

  console.log(cCyan(`Committing and pushing to gh-pages...`));
  runGit(`git add .`, CLONE_DIR);
  
  // Only commit if there are changes to prevent empty commit failures
  const status = runGit(`git status --short`, CLONE_DIR);
  if (!status) {
     console.log(cGreen(`✅ Results are already up to date on gh-pages!`));
     return;
  }

  runGit(`git commit -m "feat(results): upload suite ${suiteName}"`, CLONE_DIR);
  runGit(`git push origin gh-pages`, CLONE_DIR);
}

async function main() {
  const args = process.argv.slice(2);
  const summaryOnly = args.includes('--summary-only');
  
  // Remove flags to get positional arguments
  const positionalArgs = args.filter(a => !a.startsWith('--'));
  
  let suiteName = positionalArgs[0];
  const customResultsDir = positionalArgs[1];

  if (!suiteName) {
    console.error('❌ Please provide a suite name as an argument. e.g. pnpm upload <suite-name>');
    process.exit(1);
  }

  // Strip trailing slashes and normalize to just the suite ID
  suiteName = path.basename(suiteName);

  let resultsDir = path.join(baseResultsDir, suiteName);
  
  // Support custom results directory!
  if (customResultsDir) {
    resultsDir = path.join(path.resolve(customResultsDir), suiteName);
  }
  
  const evalsJsonPath = path.join(resultsDir, 'evals.json');

  if (!fs.existsSync(resultsDir)) {
    console.error(cRed(`❌ Results directory not found: ${resultsDir}`));
    process.exit(1);
  }

  if (!fs.existsSync(evalsJsonPath)) {
    console.error(cRed(`❌ evals.json not found in ${resultsDir}. Cannot upload incomplete or un-evaluated suite.`));
    process.exit(1);
  }

  console.log(cBold(cCyan(`Starting upload for suite: ${suiteName}${summaryOnly ? ' (Summary Only)' : ''}`)));

  try {
    await uploadToGit(suiteName, resultsDir);
    console.log(cBold(cGreen(`\n✅ Successfully uploaded suite '${suiteName}' to GitHub Pages.`)));
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
