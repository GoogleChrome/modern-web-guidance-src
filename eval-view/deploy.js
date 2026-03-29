import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Resolve paths relative to eval-view folder
const tasksSrc = path.resolve('../harness/tasks');
const tasksDest = path.resolve('./tasks');

const appsSrc = path.resolve('../harness/base_apps');
const appsDest = path.resolve('./base_apps');

const resultsSrc = path.resolve('../harness/results');
const resultsDest = path.resolve('./results');

function runCommand(cmd) {
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
  fs.cpSync(tasksSrc, tasksDest, { recursive: true });

  console.log(`Copying base apps to ${appsDest}...`);
  // dereference: true resolves symlinks (mimicking cp -RL)
  fs.cpSync(appsSrc, appsDest, { recursive: true, dereference: true });

  // 4. Staging evaluations results
  if (fs.existsSync(resultsSrc)) {
    console.log(`Copying evaluations results to ${resultsDest}...`);
    fs.cpSync(resultsSrc, resultsDest, { recursive: true });
  } else {
    console.log(`No results directory found in ${resultsSrc}. Skipping copy.`);
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
