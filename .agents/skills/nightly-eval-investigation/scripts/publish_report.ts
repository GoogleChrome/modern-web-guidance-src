// How to run:
// node --experimental-strip-types .agents/skills/nightly-eval-investigation/scripts/publish_report.ts

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../');
const reportPath = path.join(repoRoot, '.agents', 'skills', 'nightly-eval-investigation', 'artifacts', 'nightly_investigation_report.md');

if (!fs.existsSync(reportPath)) {
  console.error(`❌ Error: Report file does not exist at ${reportPath}`);
  process.exit(1);
}

const dateStr = new Date().toISOString().split('T')[0];
const title = `📋 Nightly Guidance Health Audit: ${dateStr}`;

console.log('📦 Publishing modern-web-guidance nightly report to GitHub...');

try {
  execSync(`gh issue create --title "${title}" --body-file "${reportPath}"`, { stdio: 'inherit' });
  console.log('✅ Successfully published report to GitHub!');
} catch (err: any) {
  console.error('❌ Failed to publish report to GitHub. Make sure you are authenticated with `gh auth login` and have the GitHub CLI installed.');
  process.exit(1);
}
