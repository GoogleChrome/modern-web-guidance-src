import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../core/colors.ts';
import { suitesDir as baseResultsDir } from '../core/paths.ts';
import { extractSuiteSummary, SUMMARY_SCHEMA_VERSION } from '../dashboard/summary-extractor.js';

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

interface ReconcileOptions {
  /** Re-extract every active suite, not just missing/stale entries. */
  force?: boolean;
  /** Write the reconciled manifest to this local path instead of uploading it. */
  dryRunOutput?: string;
}

/** True when a manifest entry predates the current summary schema and should be re-extracted. */
function isStaleManifestEntry(entry: any): boolean {
  if (!entry || !entry.guidedStats) return true;
  const version = typeof entry.schemaVersion === 'number' ? entry.schemaVersion : 1;
  return version < SUMMARY_SCHEMA_VERSION;
}

async function reconcileAndUploadManifest(
  bucket: any,
  uploadedSuiteName: string | null,
  evalsData: any,
  options: ReconcileOptions = {},
) {
  console.log(cCyan('🔄 Reconciling GCS suites manifest...'));
  
  let remoteManifest: any[] = [];
  const manifestFile = bucket.file('suites.gen.json');
  try {
    const [exists] = await manifestFile.exists();
    if (exists) {
      const [content] = await manifestFile.download();
      remoteManifest = JSON.parse(content.toString('utf8'));
    }
  } catch (e: any) {
    console.warn(`Could not fetch existing suites.gen.json from GCS: ${e.message}`);
  }

  // Fast prefix listing with pagination to detect all suites in GCS
  const gcsPrefixes: string[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const res: [any, any, any] = await bucket.getFiles({ delimiter: '/', autoPaginate: false, pageToken });
    const nextQuery = res[1];
    const apiResponse = res[2];
    if (apiResponse && apiResponse.prefixes) {
      gcsPrefixes.push(...apiResponse.prefixes);
    }
    pageToken = nextQuery?.pageToken;
  } while (pageToken);

  const activeSuiteIds = new Set<string>(gcsPrefixes.map((p: string) => p.replace(/\/$/, '')));
  if (uploadedSuiteName) activeSuiteIds.add(uploadedSuiteName);

  const manifestMap = new Map<string, any>();
  for (const entry of remoteManifest) {
    const id = typeof entry === 'string' ? entry : entry.testId;
    if (id && activeSuiteIds.has(id)) {
      manifestMap.set(id, typeof entry === 'string' ? { testId: id } : entry);
    }
  }

  // Update the uploaded suite's summary
  if (uploadedSuiteName && evalsData) {
    const uploadedSummary = extractSuiteSummary(uploadedSuiteName, evalsData);
    if (uploadedSummary) {
      manifestMap.set(uploadedSuiteName, uploadedSummary);
    }
  }

  // Backfill summaries for active GCS suites whose entry is missing or predates the current schema
  // (e.g. lacks a11yStats/efficiencyStats), or everything when --force is given.
  const staleSuiteIds = Array.from(activeSuiteIds).filter(id => {
    if (id === uploadedSuiteName) return false;
    return options.force || isStaleManifestEntry(manifestMap.get(id));
  });

  let refreshed = 0;
  const skipped: string[] = [];
  if (staleSuiteIds.length > 0) {
    console.log(`Re-extracting ${staleSuiteIds.length} suite summar${staleSuiteIds.length === 1 ? 'y' : 'ies'} (schema v${SUMMARY_SCHEMA_VERSION})...`);
    const concurrency = 10;
    for (let i = 0; i < staleSuiteIds.length; i += concurrency) {
      const chunk = staleSuiteIds.slice(i, i + concurrency);
      await Promise.all(chunk.map(async (suiteId) => {
        try {
          const evalsFile = bucket.file(`${suiteId}/evals.json`);
          const [fileContent] = await evalsFile.download();
          const parsed = JSON.parse(fileContent.toString('utf8'));
          const summary = extractSuiteSummary(suiteId, parsed);
          if (summary) {
            manifestMap.set(suiteId, summary);
            refreshed++;
          }
        } catch (e: any) {
          // Incomplete suites (no evals.json) stay as they were; never invent entries for them.
          skipped.push(suiteId);
          console.warn(`Could not fetch evals.json for ${suiteId}: ${e.message}`);
        }
      }));
    }
  }

  const updatedList = Array.from(manifestMap.values()).sort((a, b) => (a.testId || '').localeCompare(b.testId || ''));
  const json = JSON.stringify(updatedList, null, 2);

  if (options.dryRunOutput) {
    fs.mkdirSync(path.dirname(options.dryRunOutput), { recursive: true });
    fs.writeFileSync(options.dryRunOutput, json);
    console.log(cBold(cGreen(`✅ Dry run: wrote reconciled manifest to ${options.dryRunOutput} (${updatedList.length} suites, ${refreshed} refreshed, ${skipped.length} without evals.json). Nothing uploaded.`)));
    return;
  }

  await manifestFile.save(json, {
    contentType: 'application/json',
    resumable: false,
  });

  console.log(cBold(cGreen(`✅ Reconciled and updated gs://${BUCKET_NAME}/suites.gen.json (${updatedList.length} suites, ${refreshed} refreshed)`)));
}

async function main() {
  const args = process.argv.slice(2);
  const summaryOnly = args.includes('--summary-only');
  const reconcileOnly = args.includes('--reconcile-manifest');
  const force = args.includes('--force');
  const dryRunArg = args.find(a => a === '--dry-run' || a.startsWith('--dry-run='));
  const dryRunOutput = dryRunArg
    ? (dryRunArg.includes('=') ? path.resolve(dryRunArg.split('=')[1]) : path.resolve('out/dashboard/suites.remote.gen.json'))
    : undefined;

  // Manifest-only mode: regenerate gs://guidance-evals/suites.gen.json for every suite whose entry
  // is missing or predates SUMMARY_SCHEMA_VERSION (or all of them with --force). No suite files are
  // uploaded. `--dry-run[=path]` writes the result locally instead of overwriting the remote manifest.
  //   pnpm upload --reconcile-manifest --dry-run
  //   pnpm upload --reconcile-manifest
  if (reconcileOnly) {
    console.log(cBold(cCyan(`Reconciling suites manifest${force ? ' (forced full refresh)' : ''}${dryRunOutput ? ' [dry run]' : ''}`)));
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    try {
      await reconcileAndUploadManifest(bucket, null, null, { force, dryRunOutput });
    } catch (error: any) {
      console.error(cRed(`❌ Manifest reconcile failed: ${error.message}`));
      process.exit(1);
    }
    return;
  }
  
  // Remove flags to get positional arguments
  const positionalArgs = args.filter(a => !a.startsWith('--'));
  
  let suiteName = positionalArgs[0];
  const customResultsDir = positionalArgs[1];

  if (!suiteName) {
    console.error('❌ Please provide a suite name as an argument. e.g. pnpm upload <suite-name> (or pnpm upload --reconcile-manifest)');
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

  let evalsData: any = null;
  try {
    const evalsContent = fs.readFileSync(evalsJsonPath, 'utf8');
    evalsData = JSON.parse(evalsContent);
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
    await reconcileAndUploadManifest(bucket, suiteName, evalsData);
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
