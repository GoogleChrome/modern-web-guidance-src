import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tasksDir, baseAppsDir, resultsDir, evalViewDir } from '../lib/paths.ts';

function cCyan(text: string) { return `\x1b[36m${text}\x1b[0m`; }
function cRed(text: string) { return `\x1b[31m${text}\x1b[0m`; }
function cGreen(text: string) { return `\x1b[32m${text}\x1b[0m`; }

const tasksDest = path.join(evalViewDir, 'tasks');
const appsDest = path.join(evalViewDir, 'base_apps');
const resultsDest = path.join(evalViewDir, 'results');

function runCommand(cmd: string) {
  try {
    console.log(`\n🚀 Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

try {
  // 1. Generate mappings and manifests
  runCommand('node generate-mapping.js');
  runCommand('node generate-suites-list.js');

  // 2. Clear out any stale temp folders before copying
  if (fs.existsSync(tasksDest)) fs.rmSync(tasksDest, { recursive: true });
  if (fs.existsSync(appsDest)) fs.rmSync(appsDest, { recursive: true });
  if (fs.existsSync(resultsDest)) fs.rmSync(resultsDest, { recursive: true });

  // 3. Staging tasks and base apps
  console.log(`Copying tasks to ${tasksDest}...`);
  fs.cpSync(tasksDir, tasksDest, { recursive: true });

  console.log(`Copying base apps to ${appsDest}...`);
  // dereference: true resolves symlinks (mimicking cp -RL)
  fs.cpSync(baseAppsDir, appsDest, { recursive: true, dereference: true });

  // 4. Staging evaluations results
  if (fs.existsSync(resultsDir)) {
    console.log(`Copying evaluations results to ${resultsDest}...`);
    fs.cpSync(resultsDir, resultsDest, { recursive: true });
  } else {
    console.log(`No results directory found in ${resultsDir}. Skipping copy.`);
  }

  // 5. Publish with gh-pages
  console.log(`\n📡 Publishing to gh-pages branch...`);
  runCommand('npx gh-pages --nojekyll --dist . --add');

} catch (e) {
  console.error('Error during deployment:', e);
} finally {
  // 6. Cleanup
  console.log(`\n🧹 Cleaning up temporary directories...`);
  if (fs.existsSync(tasksDest)) fs.rmSync(tasksDest, { recursive: true });
  if (fs.existsSync(appsDest)) fs.rmSync(appsDest, { recursive: true });
  if (fs.existsSync(resultsDest)) fs.rmSync(resultsDest, { recursive: true });
}
