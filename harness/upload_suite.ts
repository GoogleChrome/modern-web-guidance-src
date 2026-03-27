import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import 'colors';
import { resultsDir as baseResultsDir } from '../lib/paths.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

async function uploadDirectory(bucket: any, dirPath: string, gcsPrefix: string) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    const destinationPath = path.join(gcsPrefix, file.name);

    if (file.isDirectory()) {
      await uploadDirectory(bucket, fullPath, destinationPath);
    } else {
      if (file.name === '.DS_Store' || file.name === 'pnpm-workspace.yaml') continue;

      console.log(`Uploading ${fullPath} to gs://${BUCKET_NAME}/${destinationPath}...`);
      await bucket.upload(fullPath, {
        destination: destinationPath,
      });
    }
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
    console.error(`❌ Results directory not found: ${resultsDir}`.red);
    process.exit(1);
  }

  if (!fs.existsSync(evalsJsonPath)) {
    console.error(`❌ evals.json not found in ${resultsDir}. Cannot upload incomplete or un-evaluated suite.`.red);
    process.exit(1);
  }

  console.log(`Starting upload for suite: ${suiteName}`.cyan.bold);

  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  try {
    await uploadDirectory(bucket, resultsDir, suiteName);
    console.log(`\n✅ Successfully uploaded suite '${suiteName}' to gs://${BUCKET_NAME}/${suiteName}`.green.bold);
  } catch (error: any) {
    console.error(`❌ Upload failed: ${error.message}`.red);
    process.exit(1);
  }
}

main().catch(console.error);
