import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { resultsDir } from '../lib/paths.ts';

const BUCKET_NAME = 'guidance-evals';

function runCommand(cmd: string) {
  try {
    console.log(`\n🚀 Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`\n📡 Synchronizing gs://${BUCKET_NAME} using gcloud storage...`);
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Uses modern gcloud storage cp -r which is lightning fast and handles parallel downloads automatically
  const cmd = `gcloud storage cp -r "gs://${BUCKET_NAME}/*" "${resultsDir}/"`;
  runCommand(cmd);

  console.log(`\n✅ Successfully synchronized all GCS data directly to ${resultsDir}`);
}

main().catch(console.error);
