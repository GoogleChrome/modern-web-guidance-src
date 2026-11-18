import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { resultsDir as baseResultsDir } from '../../core/paths.ts';
import { cCyan, cGreen, cYellow, cRed } from '../../core/colors.ts';
import { hasRawSessionLogs } from './trajectory-normalizer.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

export const GCS_DOWNLOAD_COMPLETE_SENTINEL = '.gcs_download_complete';

const inflightJobEvalsDownloads = new Map<string, Promise<void>>();

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
 * Downloads a job-level evals.json file from GCS if it is missing locally.
 * Deduplicates concurrent requests for the same jobId using an in-flight Promise map.
 */
export async function downloadJobEvalsIfMissing(
  jobId: string,
  token: string | undefined,
  jobDirOverride?: string
): Promise<void> {
  const destPath = path.join(jobDirOverride || path.join(baseResultsDir, jobId), 'evals.json');
  if (fs.existsSync(destPath)) {
    return;
  }

  const inflightKey = jobDirOverride ? `${jobId}:${jobDirOverride}` : jobId;
  const inflight = inflightJobEvalsDownloads.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const downloadPromise = (async () => {
    if (fs.existsSync(destPath)) {
      return;
    }

    const gcsFileName = `${jobId}/evals.json`;
    console.log(cCyan(`[GCS Downloader] Job-level evals.json is missing. Downloading from GCS: gs://${BUCKET_NAME}/${gcsFileName}...`));

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (token && token.startsWith('Bearer ')) {
      try {
        await downloadFileWithToken(token, gcsFileName, destPath);
        console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded job evals.json via REST API!`));
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[GCS Downloader] Warning: Failed to download job evals.json via REST: ${msg}`);
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
        console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded job evals.json via Storage SDK!`));
      } else {
        console.warn(`[GCS Downloader] Job evals.json does not exist on GCS: gs://${BUCKET_NAME}/${gcsFileName}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GCS Downloader] Warning: Failed to download job evals.json via SDK: ${msg}`);
    }
  })().finally(() => {
    inflightJobEvalsDownloads.delete(inflightKey);
  });

  inflightJobEvalsDownloads.set(inflightKey, downloadPromise);
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

export function resolveTrialPath(trialDir: string): { absoluteTrialDir: string; relativeTrialPath: string } | null {
  const normalizedTrialDir = trialDir.replaceAll('\\', '/');
  let absoluteTrialDir = normalizePath(trialDir);
  const absoluteResultsDir = normalizePath(baseResultsDir);
  let relativeTrialPath = path.relative(absoluteResultsDir, absoluteTrialDir);

  if (relativeTrialPath.startsWith('..') || path.isAbsolute(relativeTrialPath)) {
    const hasSuites = /(^|\/)suites(\/|$)/.test(normalizedTrialDir);
    const stripped = normalizedTrialDir.replace(/^(\.\/)?(harness\/)?results\/(suites\/)?/, '');
    const candidate = path.resolve(hasSuites ? path.join(baseResultsDir, 'suites') : baseResultsDir, stripped);
    const candidateRel = path.relative(absoluteResultsDir, normalizePath(candidate));
    if (!candidateRel.startsWith('..') && !path.isAbsolute(candidateRel)) {
      absoluteTrialDir = candidate;
      relativeTrialPath = candidateRel;
    } else {
      console.warn(`[GCS Downloader] Path is outside results directory: ${absoluteTrialDir}`);
      return null;
    }
  }

  relativeTrialPath = relativeTrialPath.replaceAll(path.sep, path.posix.sep).replace(/^suites\//, '');

  return { absoluteTrialDir, relativeTrialPath };
}

async function downloadSingleDirFromGcs(trialDir: string, token: string | undefined): Promise<boolean> {
  const resolved = resolveTrialPath(trialDir);
  if (!resolved) return false;
  const { absoluteTrialDir, relativeTrialPath } = resolved;

  if (fs.existsSync(absoluteTrialDir)) {
    const files = fs.readdirSync(absoluteTrialDir);
    const hasSentinel = files.includes(GCS_DOWNLOAD_COMPLETE_SENTINEL);
    const hasTrajectory = files.includes('trajectory_summary.json') || hasRawSessionLogs(absoluteTrialDir);
    const hasResults = files.some((f) => f.endsWith('_results.json') || f === 'runtime.json');
    if (hasSentinel || (hasResults && hasTrajectory)) {
      return true;
    }
  }

  console.log(cCyan(`[GCS Downloader] Trial directory not found or incomplete locally: ${relativeTrialPath}`));

  const gcsPrefix = `${relativeTrialPath}/`;

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
        absoluteTrialDir,
        (name) => name,
        (name, destPath) => downloadFileWithToken(token, name, destPath)
      );

      fs.writeFileSync(path.join(absoluteTrialDir, GCS_DOWNLOAD_COMPLETE_SENTINEL), new Date().toISOString(), 'utf8');
      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via REST API!`));
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
      absoluteTrialDir,
      (file) => file.name,
      (file, destPath) => file.download({ destination: destPath })
    );

    fs.writeFileSync(path.join(absoluteTrialDir, GCS_DOWNLOAD_COMPLETE_SENTINEL), new Date().toISOString(), 'utf8');
    console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via Storage SDK!`));
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
 * Lazily downloads a trial directory from GCS if it is missing locally.
 * Resolves the path relative to the harness results directory.
 * Orchestrates downloading job evals.json and the primary requested trial.
 */
export async function downloadTrialFromGcsIfMissing(trialDir: string): Promise<boolean> {
  const resolved = resolveTrialPath(trialDir);
  if (!resolved) return false;
  const { absoluteTrialDir, relativeTrialPath } = resolved;

  const parts = relativeTrialPath.split(/[/\\]/).filter(Boolean);
  const jobId = parts[0];
  const token = process.env.GD_GCS_TOKEN;

  const localJobDir = parts.length > 1
    ? path.resolve(absoluteTrialDir, ...Array(parts.length - 1).fill('..'))
    : absoluteTrialDir;

  // 1. Lazily download the job-level evals.json
  await downloadJobEvalsIfMissing(jobId, token, localJobDir);

  // If trialDir points to a top-level job directory rather than a specific trial, we only need evals.json
  if (parts.length <= 1) {
    return true;
  }

  // 2. Download the primary requested directory
  return downloadSingleDirFromGcs(absoluteTrialDir, token);
}
