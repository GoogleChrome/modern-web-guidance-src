import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { resultsDir as baseResultsDir } from '../../lib/paths.ts';
import { cCyan, cGreen, cYellow, cRed } from '../../lib/colors.ts';
import {
  NORMALIZER_VERSION,
  ensureFreshTrajectorySummary,
  hasRawSessionLogs,
  readTrajectorySummary
} from './trajectory-normalizer.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

export const GCS_DOWNLOAD_COMPLETE_SENTINEL = '.gcs_download_complete';

const inflightSuiteEvalsDownloads = new Map<string, Promise<void>>();

/**
 * Performs post-download operations, such as generating missing or stale trajectory summaries.
 */
async function postDownloadProcessing(absoluteRunDir: string, relativeRunPath: string) {
  const existing = readTrajectorySummary(absoluteRunDir);
  const isFresh =
    existing !== null &&
    Array.isArray(existing.steps) &&
    existing.steps.length > 0 &&
    existing.normalizerVersion === NORMALIZER_VERSION;

  if (!isFresh && hasRawSessionLogs(absoluteRunDir)) {
    console.log(
      cCyan(
        `[GCS Downloader] trajectory_summary.json is missing or outdated (version=${existing?.normalizerVersion ?? 'none'}) in ${relativeRunPath}. Regenerating v${NORMALIZER_VERSION} on the fly...`
      )
    );
    try {
      await ensureFreshTrajectorySummary(absoluteRunDir);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GCS Downloader] Warning: Failed to generate trajectory on the fly: ${msg}`);
    }
  }
}

/**
 * Downloads a file from GCS using the REST API with a Bearer token.
 */
async function downloadFileWithToken(token: string, gcsFileName: string, destPath: string): Promise<void> {
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o/${encodeURIComponent(gcsFileName)}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': token }
  });

  if (!response.ok) {
    throw new Error(`REST download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tmpPath = `${destPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
  fs.renameSync(tmpPath, destPath);
}

/**
 * Lists files in a GCS bucket prefix using the REST API with a Bearer token.
 */
async function listFilesWithToken(token: string, prefix: string): Promise<string[]> {
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET_NAME}/o?prefix=${encodeURIComponent(prefix)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': token }
  });

  if (!response.ok) {
    throw new Error(`REST list failed: HTTP ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  if (!data.items || !Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item: any) => item.name);
}

const MAX_CONCURRENT_DOWNLOADS = 8;

/**
 * Downloads a batch of GCS items in parallel into the target directory using a concurrency limiter.
 */
async function downloadFileBatch<T>(
  items: T[],
  gcsPrefix: string,
  destDir: string,
  getItemName: (item: T) => string,
  downloadFn: (item: T, destPath: string) => Promise<unknown>
): Promise<void> {
  const resolvedDestDir = path.resolve(destDir);
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const name = getItemName(item);
      const relativeFilePath = name.substring(gcsPrefix.length);
      if (!relativeFilePath || relativeFilePath.endsWith('/')) {
        continue;
      }

      const destPath = path.join(destDir, relativeFilePath);
      if (!path.resolve(destPath).startsWith(resolvedDestDir)) {
        throw new Error(`Refusing to write outside destination directory: ${destPath}`);
      }

      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      console.log(`  Downloading gs://${BUCKET_NAME}/${name} -> ${destPath}`);
      await downloadFn(item, destPath);
    }
  };

  const workerCount = Math.min(items.length, MAX_CONCURRENT_DOWNLOADS);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

/**
 * Downloads a suite-level evals.json file from GCS if it is missing locally.
 * Deduplicates concurrent requests for the same suiteName using an in-flight Promise map.
 */
export async function downloadSuiteEvalsIfMissing(suiteName: string, token: string | undefined): Promise<void> {
  const destPath = path.join(baseResultsDir, suiteName, 'evals.json');
  if (fs.existsSync(destPath)) {
    return;
  }

  const inflight = inflightSuiteEvalsDownloads.get(suiteName);
  if (inflight) {
    return inflight;
  }

  const downloadPromise = (async () => {
    if (fs.existsSync(destPath)) {
      return;
    }

    const gcsFileName = `${suiteName}/evals.json`;
    console.log(cCyan(`[GCS Downloader] Suite-level evals.json is missing. Downloading from GCS: gs://${BUCKET_NAME}/${gcsFileName}...`));

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (token && token.startsWith('Bearer ')) {
      try {
        await downloadFileWithToken(token, gcsFileName, destPath);
        console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded suite evals.json via REST API!`));
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[GCS Downloader] Warning: Failed to download suite evals.json via REST: ${msg}`);
      }
    }

    // Fallback to Storage SDK (ADC)
    try {
      const storage = new Storage({ projectId: PROJECT_ID });
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(gcsFileName);
      const [exists] = await file.exists();
      if (exists) {
        const tmpPath = `${destPath}.tmp.${process.pid}.${Date.now()}`;
        await file.download({ destination: tmpPath });
        fs.renameSync(tmpPath, destPath);
        console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded suite evals.json via Storage SDK!`));
      } else {
        console.warn(`[GCS Downloader] Suite evals.json does not exist on GCS: gs://${BUCKET_NAME}/${gcsFileName}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GCS Downloader] Warning: Failed to download suite evals.json via SDK: ${msg}`);
    }
  })().finally(() => {
    inflightSuiteEvalsDownloads.delete(suiteName);
  });

  inflightSuiteEvalsDownloads.set(suiteName, downloadPromise);
  return downloadPromise;
}

/**
 * Resolves the absolute native path for a given file or directory path.
 */
function normalizePath(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

export function resolveRunPath(runDir: string): { absoluteRunDir: string; relativeRunPath: string } | null {
  const normalizedRunDir = runDir.replace(/\\/g, '/');
  let absoluteRunDir = normalizePath(runDir);
  const absoluteResultsDir = normalizePath(baseResultsDir);
  let relativeRunPath = path.relative(absoluteResultsDir, absoluteRunDir);

  if (relativeRunPath.startsWith('..') || path.isAbsolute(relativeRunPath)) {
    const stripped = normalizedRunDir.replace(/^(\.\/)?(harness\/)?results\/?/, '');
    const candidate = path.resolve(baseResultsDir, stripped);
    const candidateRel = path.relative(absoluteResultsDir, normalizePath(candidate));
    if (!candidateRel.startsWith('..') && !path.isAbsolute(candidateRel)) {
      absoluteRunDir = candidate;
      relativeRunPath = candidateRel;
    } else {
      console.warn(`[GCS Downloader] Path is outside results directory: ${absoluteRunDir}`);
      return null;
    }
  }

  return { absoluteRunDir, relativeRunPath };
}

async function downloadSingleDirFromGcs(runDir: string, token: string | undefined): Promise<boolean> {
  const resolved = resolveRunPath(runDir);
  if (!resolved) return false;
  const { absoluteRunDir, relativeRunPath } = resolved;

  if (fs.existsSync(absoluteRunDir)) {
    const files = fs.readdirSync(absoluteRunDir);
    const hasSentinel = files.includes(GCS_DOWNLOAD_COMPLETE_SENTINEL);
    const hasTrajectory = files.includes('trajectory_summary.json') || hasRawSessionLogs(absoluteRunDir);
    const hasResults = files.some((f) => f.endsWith('_results.json') || f === 'runtime.json');
    if (hasSentinel || (hasResults && hasTrajectory)) {
      await postDownloadProcessing(absoluteRunDir, relativeRunPath);
      return true;
    }
  }

  console.log(cCyan(`[GCS Downloader] Run directory not found or incomplete locally: ${relativeRunPath}`));

  const gcsPrefix = relativeRunPath.replace(/\\/g, '/') + '/';

  if (token && token.startsWith('Bearer ')) {
    console.log(cYellow(`[GCS Downloader] Using Bearer token authentication forwarded from browser...`));
    try {
      console.log(`[GCS Downloader] Listing files in gs://${BUCKET_NAME}/${gcsPrefix} via REST API...`);
      const fileNames = await listFilesWithToken(token, gcsPrefix);

      if (fileNames.length === 0) {
        console.warn(`[GCS Downloader] No files found on GCS with prefix: ${gcsPrefix}`);
        return false;
      }

      console.log(cCyan(`[GCS Downloader] Discovered ${fileNames.length} files. Downloading via REST API...`));

      await downloadFileBatch(
        fileNames,
        gcsPrefix,
        absoluteRunDir,
        (name) => name,
        (name, destPath) => downloadFileWithToken(token, name, destPath)
      );

      fs.writeFileSync(path.join(absoluteRunDir, GCS_DOWNLOAD_COMPLETE_SENTINEL), new Date().toISOString(), 'utf8');
      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via REST API!`));
      await postDownloadProcessing(absoluteRunDir, relativeRunPath);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(cRed(`[GCS Downloader] ❌ REST API Download failed: ${msg}`));
    }
  }

  // Backup / CLI Fallback: Use standard SDK
  console.log(cYellow(`[GCS Downloader] Attempting standard Google Cloud Storage library authentication (ADC)...`));
  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);

    console.log(`[GCS Downloader] Listing files in gs://${BUCKET_NAME}/${gcsPrefix} via Storage SDK...`);
    const [files] = await bucket.getFiles({ prefix: gcsPrefix });

    if (files.length === 0) {
      console.warn(`[GCS Downloader] No files found on GCS with prefix: ${gcsPrefix}`);
      return false;
    }

    console.log(cCyan(`[GCS Downloader] Discovered ${files.length} files. Downloading via Storage SDK...`));

    await downloadFileBatch(
      files,
      gcsPrefix,
      absoluteRunDir,
      (file) => file.name,
      (file, destPath) => file.download({ destination: destPath })
    );

    fs.writeFileSync(path.join(absoluteRunDir, GCS_DOWNLOAD_COMPLETE_SENTINEL), new Date().toISOString(), 'utf8');
    console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via Storage SDK!`));
    await postDownloadProcessing(absoluteRunDir, relativeRunPath);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(cRed(`[GCS Downloader] ❌ Storage SDK Download failed: ${msg}`));
    console.log(cYellow(`
💡 Hint: If you are running gd compare directly from the CLI, run:
   gcloud auth application-default login
   to authenticate your local terminal environment with Google Cloud.
    `));
    return false;
  }
}

/**
 * Lazily downloads a run directory from GCS if it is missing locally.
 * Resolves the path relative to the harness results directory.
 * Orchestrates downloading suite evals.json and the primary requested run.
 */
export async function downloadRunFromGcsIfMissing(runDir: string): Promise<boolean> {
  const resolved = resolveRunPath(runDir);
  if (!resolved) return false;
  const { absoluteRunDir, relativeRunPath } = resolved;

  const suiteName = relativeRunPath.split(/[/\\]/)[0];
  const token = process.env.GD_GCS_TOKEN;

  // 1. Lazily download the suite-level evals.json
  await downloadSuiteEvalsIfMissing(suiteName, token);

  // If runDir points to a top-level suite directory rather than a specific task run, we only need evals.json
  if (!relativeRunPath.includes('/') && !relativeRunPath.includes('\\')) {
    return true;
  }

  // 2. Download the primary requested directory
  return downloadSingleDirFromGcs(absoluteRunDir, token);
}
