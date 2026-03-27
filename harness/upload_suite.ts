import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../lib/colors.ts';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

async function uploadDirectory(bucket: any, dirPath: string, gcsPrefix: string) {
  const uploadTasks: (() => Promise<void>)[] = [];

  function collectFiles(currentDir: string, currentPrefix: string) {
    const files = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(currentDir, file.name);
      const destinationPath = path.join(currentPrefix, file.name);

      if (file.isDirectory()) {
        collectFiles(fullPath, destinationPath);
      } else {
        if (file.name === '.DS_Store' || file.name === 'pnpm-workspace.yaml') continue;

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

  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  try {
    await uploadDirectory(bucket, resultsDir, suiteName);
    console.log(cBold(cGreen(`\n✅ Successfully uploaded suite '${suiteName}' to gs://${BUCKET_NAME}/${suiteName}`)));
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
