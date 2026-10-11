import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { cRed, cGreen, cCyan, cBold } from '../core/colors.ts';
import { suitesDir as baseResultsDir } from '../core/paths.ts';
import { extractSuiteSummary, toSlimSuiteSummary, MANIFEST_FILES, SUMMARY_SCHEMA_VERSION } from '../dashboard/summary-extractor.js';
import { computeHeadlineInsights } from '../dashboard/insights.js';

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
  /**
   * Also re-extract entries that exist but predate SUMMARY_SCHEMA_VERSION (e.g. lack a11yStats /
   * efficiencyStats). Default OFF for `pnpm upload <suite>` so merging a schema bump never changes
   * what a nightly upload writes; ON for `--reconcile-manifest` and `--refresh-stale`.
   */
  refreshStale?: boolean;
  /** Re-extract every active suite, not just missing/stale entries. */
  force?: boolean;
  /**
   * Also write suites.slim.gen.json and headline-insights.gen.json next to suites.gen.json.
   * Default OFF for `pnpm upload <suite>`; ON for `--reconcile-manifest` and `--derived-manifests`.
   */
  writeDerived?: boolean;
  /** Write the reconciled manifest(s) to this local path instead of uploading. */
  dryRunOutput?: string;
  /**
   * Store the manifest gzip-encoded (Content-Encoding: gzip). GCS decompresses transparently for
   * clients that do not advertise gzip, so `gcloud storage cat` and browsers both keep working,
   * while the public landing page downloads ~10x fewer bytes.
   */
  gzip?: boolean;
}

/** True when a manifest entry has no summary at all (legacy string entry or failed extraction). */
function isMissingManifestEntry(entry: any): boolean {
  return !entry || !entry.guidedStats;
}

/** True when a manifest entry predates the current summary schema and should be re-extracted. */
function isStaleManifestEntry(entry: any): boolean {
  if (isMissingManifestEntry(entry)) return true;
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
  const manifestFile = bucket.file(MANIFEST_FILES.full);
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

  // Backfill summaries for active GCS suites whose entry is missing (always, pre-existing behavior),
  // plus entries that predate the current schema when --refresh-stale / --reconcile-manifest is used,
  // or everything when --force is given.
  const staleSuiteIds = Array.from(activeSuiteIds).filter(id => {
    if (id === uploadedSuiteName) return false;
    const entry = manifestMap.get(id);
    if (options.force) return true;
    return options.refreshStale ? isStaleManifestEntry(entry) : isMissingManifestEntry(entry);
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

  // Artifacts:
  //   suites.gen.json            full summaries (guides + chartData) for browsing views — always
  //   suites.slim.gen.json       same entries minus guides/chartData (~2 KB/suite) for first paint — opt-in
  //   headline-insights.gen.json precomputed landing-page hero numbers — opt-in
  // The derived pair is written together with the full manifest so the three never disagree.
  const artifacts: Array<{ name: string; json: string }> = [
    { name: MANIFEST_FILES.full, json: JSON.stringify(updatedList, null, 2) },
  ];
  if (options.writeDerived) {
    const insights = computeHeadlineInsights(updatedList);
    artifacts.push(
      { name: MANIFEST_FILES.slim, json: JSON.stringify(updatedList.map(toSlimSuiteSummary), null, 2) },
      { name: MANIFEST_FILES.insights, json: JSON.stringify({ generatedAt: new Date().toISOString(), ...insights }, null, 2) },
    );
  }

  if (options.dryRunOutput) {
    // dryRunOutput names the full manifest; the slim/insights twins land next to it.
    const dir = path.dirname(options.dryRunOutput);
    fs.mkdirSync(dir, { recursive: true });
    for (const { name, json } of artifacts) {
      const target = name === MANIFEST_FILES.full ? options.dryRunOutput : path.join(dir, name);
      fs.writeFileSync(target, json);
      console.log(`   ${target} (${(json.length / 1024).toFixed(0)} KB)`);
    }
    console.log(cBold(cGreen(`✅ Dry run: wrote reconciled manifests to ${dir} (${updatedList.length} suites, ${refreshed} refreshed, ${skipped.length} without evals.json). Nothing uploaded.`)));
    return;
  }

  for (const { name, json } of artifacts) {
    await bucket.file(name).save(json, {
      contentType: 'application/json',
      resumable: false,
      gzip: Boolean(options.gzip),
    });
  }

  console.log(cBold(cGreen(`✅ Reconciled and updated gs://${BUCKET_NAME}/{${artifacts.map(a => a.name).join(',')}} (${updatedList.length} suites, ${refreshed} refreshed${options.gzip ? ', gzip-encoded' : ''})`)));
}

async function main() {
  const args = process.argv.slice(2);
  const summaryOnly = args.includes('--summary-only');
  const reconcileOnly = args.includes('--reconcile-manifest');
  const force = args.includes('--force');
  const gzip = args.includes('--gzip');
  // Opt-ins for the per-suite upload path (both are implied by --reconcile-manifest). Defaults are
  // OFF so a schema bump in summary-extractor.js never changes what a nightly upload writes.
  const refreshStale = reconcileOnly || args.includes('--refresh-stale');
  const writeDerived = reconcileOnly || args.includes('--derived-manifests');
  const dryRunArg = args.find(a => a === '--dry-run' || a.startsWith('--dry-run='));
  const dryRunOutput = dryRunArg
    ? (dryRunArg.includes('=') ? path.resolve(dryRunArg.split('=')[1]) : path.resolve('out/dashboard/suites.remote.gen.json'))
    : undefined;

  // Manifest-only mode (explicit, never run by nightlies): regenerate gs://guidance-evals/suites.gen.json
  // for every suite whose entry is missing or predates SUMMARY_SCHEMA_VERSION (all of them with --force),
  // and write the slim + headline-insights twins. No suite files are uploaded. `--dry-run[=path]` writes
  // the results locally instead of touching the bucket.
  //   pnpm upload --reconcile-manifest --dry-run
  //   pnpm upload --reconcile-manifest [--gzip]
  if (reconcileOnly) {
    console.log(cBold(cCyan(`Reconciling suites manifest${force ? ' (forced full refresh)' : ''}${dryRunOutput ? ' [dry run]' : ''}`)));
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    try {
      await reconcileAndUploadManifest(bucket, null, null, { force, refreshStale, writeDerived, dryRunOutput, gzip });
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
    // Default: pre-existing footprint (suites.gen.json only, backfill only missing entries).
    await reconcileAndUploadManifest(bucket, suiteName, evalsData, { refreshStale, writeDerived, gzip });
  } catch (error: any) {
    console.error(cRed(`❌ Upload failed: ${error.message}`));
    process.exit(1);
  }
}

main().catch(console.error);
