import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../lib/colors.ts';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

async function uploadDirectory(bucket: any, dirPath: string, gcsPrefix: string, summaryOnly = false) {
  const uploadTasks: (() => Promise<void>)[] = [];

  function collectFiles(currentDir: string, currentPrefix: string) {
    const files = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(currentDir, file.name);
      const destinationPath = path.join(currentPrefix, file.name);

      if (file.name === 'node_modules' || file.name === '.jetskicli') continue;

      if (file.isDirectory()) {
        if (!summaryOnly) {
          collectFiles(fullPath, destinationPath);
        }
      } else {
        if (file.name === '.DS_Store' || file.name === 'pnpm-workspace.yaml') continue;

        if (summaryOnly) {
          // Only upload summary files at the root
          if (file.name !== 'evals.json' && file.name !== 'evals.md') continue;
        }

        uploadTasks.push(async () => {
          console.log(`Uploading ${fullPath} to gs://${BUCKET_NAME}/${destinationPath}...`);
          await bucket.upload(fullPath, {
            destination: destinationPath,
          });
        });
      }
    }
  }

  collectFiles(dirPath, gcsPrefix);

  console.log(`Discovered ${uploadTasks.length} files to upload. Uploading concurrently...`);

  // Run uploads in concurrent chunks to avoid hitting network/file-descriptor limits
  const concurrencyLevel = 50;
  for (let i = 0; i < uploadTasks.length; i += concurrencyLevel) {
    const chunk = uploadTasks.slice(i, i + concurrencyLevel);
    await Promise.all(chunk.map(task => task()));
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

  try {
    const evalsContent = fs.readFileSync(evalsJsonPath, 'utf8');
    const evalsData = JSON.parse(evalsContent);
    const results = evalsData.results || {};
    if (Object.keys(results).length === 0) {
      console.warn(cRed(`⚠️ Warning: No evaluation data found in evals.json (0 tasks were run). Sync skipped.`));
      process.exit(0);
    }

    // Guard: Prevent uploading runs with 100% early generation failures (catastrophic crash)
    const testNames = Object.keys(results);
    let totalRunsCount = 0;
    let earlyFailuresCount = 0;
    for (const testName of testNames) {
      const runs = results[testName] || [];
      for (const run of runs) {
        totalRunsCount++;
        const scenarioChecks = run.results || [];
        if (scenarioChecks.some((check: any) => check.isEarlyFailure)) {
          earlyFailuresCount++;
        }
      }
    }
    if (totalRunsCount > 0 && earlyFailuresCount === totalRunsCount) {
      console.error(cRed(`❌ Error: Catastrophic generation failures (100% early failure rate). Upload blocked to prevent trend contamination.`));
      process.exit(1);
    }
  } catch (e: any) {
    console.error(cRed(`❌ Failed to parse evals.json: ${e.message}`));
    process.exit(1);
  }

  console.log(cBold(cCyan(`Starting upload for suite: ${suiteName}${summaryOnly ? ' (Summary Only)' : ''}`)));

  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  try {
    await uploadDirectory(bucket, resultsDir, suiteName, summaryOnly);
    console.log(cBold(cGreen(`\n✅ Successfully uploaded suite '${suiteName}' to gs://${BUCKET_NAME}/${suiteName}`)));
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
