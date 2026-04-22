import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../lib/colors.ts';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

async function uploadToGCS(suiteName: string, resultsDir: string, summaryOnly: boolean) {
  const bucketDest = `gs://guidance-evals/${suiteName}/`;
  
  if (summaryOnly) {
    console.log(cCyan(`Uploading ONLY summaries for suite ${suiteName} to GCS...`));
    execSync(`gcloud storage cp "${path.join(resultsDir, 'evals.json')}" "${bucketDest}evals.json"`, { stdio: 'inherit' });
    execSync(`gcloud storage cp "${path.join(resultsDir, 'evals.md')}" "${bucketDest}evals.md"`, { stdio: 'inherit' });
  } else {
    console.log(cCyan(`Uploading full suite ${suiteName} to GCS...`));
    execSync(`gcloud storage rsync -r "${resultsDir}" "${bucketDest}" --exclude="\.git/.*"`, { stdio: 'inherit' });
  }
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
    await uploadToGCS(suiteName, resultsDir, summaryOnly);
    console.log(cBold(cGreen(`\n✅ Successfully uploaded suite '${suiteName}' to GCS.`)));
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
