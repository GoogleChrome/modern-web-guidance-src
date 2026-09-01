import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { resultsDir as baseResultsDir } from '../../lib/paths.ts';
import { cCyan, cGreen, cYellow, cRed } from '../../lib/colors.ts';
import { Agents } from '../config.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

/**
 * Performs post-download operations, such as generating missing trajectory summaries.
 */
async function postDownloadProcessing(absoluteRunDir: string, relativeRunPath: string) {
  const summaryPath = path.join(absoluteRunDir, 'trajectory_summary.json');
  let needsGeneration = !fs.existsSync(summaryPath);
  if (!needsGeneration) {
    try {
      const summaryJson = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      if (!Array.isArray(summaryJson.steps) || summaryJson.steps.length === 0) {
        needsGeneration = true;
      }
    } catch {
      needsGeneration = true;
    }
  }
  if (needsGeneration) {
    console.log(cCyan(`[GCS Downloader] trajectory_summary.json is missing or outdated in historical run. Generating v2.0 on the fly...`));
    let detectedAgent: string | undefined;
    let curr = absoluteRunDir;
    while (curr && curr !== path.dirname(curr)) {
      const evalsPath = path.join(curr, 'evals.json');
      if (fs.existsSync(evalsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
          if (data.agent) {
            const raw = String(data.agent).replace(/-/g, '_');
            detectedAgent = Object.values(Agents).find(a => a === raw || a === data.agent) || data.agent;
            break;
          }
        } catch {
          // ignore parse failure
        }
      }
      curr = path.dirname(curr);
    }

    if (!detectedAgent) {
      throw new Error(`[GCS Downloader] Could not determine agent from evals.json for run: ${relativeRunPath}`);
    }
    
    try {
      const { generateNormalizedTrajectory } = await import('./trajectory-normalizer.ts');
      await generateNormalizedTrajectory(absoluteRunDir, detectedAgent);
    } catch (err: any) {
      console.warn(`[GCS Downloader] Warning: Failed to generate trajectory on the fly: ${err.message}`);
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
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
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

/**
 * Downloads a batch of GCS items in parallel into the target directory.
 */
async function downloadFileBatch<T>(
  items: T[],
  gcsPrefix: string,
  destDir: string,
  getItemName: (item: T) => string,
  downloadFn: (item: T, destPath: string) => Promise<unknown>
): Promise<void> {
  await Promise.all(items.map(async (item) => {
    const name = getItemName(item);
    const relativeFilePath = name.substring(gcsPrefix.length);
    if (!relativeFilePath || relativeFilePath.endsWith('/')) {
      return;
    }

    const destPath = path.join(destDir, relativeFilePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    console.log(`  Downloading gs://${BUCKET_NAME}/${name} -> ${destPath}`);
    await downloadFn(item, destPath);
  }));
}

/**
 * Downloads a suite-level evals.json file from GCS if it is missing locally.
 */
async function downloadSuiteEvalsIfMissing(suiteName: string, token: string | undefined) {
  const destPath = path.join(baseResultsDir, suiteName, 'evals.json');
  if (fs.existsSync(destPath)) {
    return; // Already exists locally
  }

  const gcsFileName = `${suiteName}/evals.json`;
  console.log(cCyan(`[GCS Downloader] Suite-level evals.json is missing. Downloading from GCS: gs://${BUCKET_NAME}/${gcsFileName}...`));
  
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (token && token.startsWith('Bearer ')) {
    try {
      await downloadFileWithToken(token, gcsFileName, destPath);
      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded suite evals.json via REST API!`));
      return;
    } catch (err: any) {
      console.warn(`[GCS Downloader] Warning: Failed to download suite evals.json via REST: ${err.message}`);
    }
  }

  // Fallback to Storage SDK (ADC)
  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(gcsFileName);
    const [exists] = await file.exists();
    if (exists) {
      await file.download({ destination: destPath });
      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded suite evals.json via Storage SDK!`));
    } else {
      console.warn(`[GCS Downloader] Suite evals.json does not exist on GCS: gs://${BUCKET_NAME}/${gcsFileName}`);
    }
  } catch (err: any) {
    console.warn(`[GCS Downloader] Warning: Failed to download suite evals.json via SDK: ${err.message}`);
  }
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

async function downloadSingleDirFromGcs(runDir: string, token: string | undefined): Promise<boolean> {
  const absoluteRunDir = normalizePath(runDir);
  const absoluteResultsDir = normalizePath(baseResultsDir);
  
  const relativeRunPath = path.relative(absoluteResultsDir, absoluteRunDir);
  if (relativeRunPath.startsWith('..') || path.isAbsolute(relativeRunPath)) {
    console.warn(`[GCS Downloader] Path is outside results directory: ${absoluteRunDir}`);
    return false;
  }

  if (fs.existsSync(absoluteRunDir)) {
    const files = fs.readdirSync(absoluteRunDir);
    if (files.some(f => f === 'trajectory_summary.json' || f.endsWith('_results.json') || f === 'runtime.json')) {
      return true; // Already cached locally
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

      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via REST API!`));
      await postDownloadProcessing(absoluteRunDir, relativeRunPath);
      return true;
    } catch (err: any) {
      console.error(cRed(`[GCS Downloader] ❌ REST API Download failed: ${err.message}`));
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

    console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via Storage SDK!`));
    await postDownloadProcessing(absoluteRunDir, relativeRunPath);
    return true;
  } catch (err: any) {
    console.error(cRed(`[GCS Downloader] ❌ Storage SDK Download failed: ${err.message}`));
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
 * Orchestrates downloading suite evals.json, the primary requested run, and the sibling run type (guided/unguided).
 */
export async function downloadRunFromGcsIfMissing(runDir: string): Promise<boolean> {
  const absoluteRunDir = normalizePath(runDir);
  const absoluteResultsDir = normalizePath(baseResultsDir);
  
  const relativeRunPath = path.relative(absoluteResultsDir, absoluteRunDir);
  if (relativeRunPath.startsWith('..') || path.isAbsolute(relativeRunPath)) {
    console.warn(`[GCS Downloader] Path is outside results directory: ${absoluteRunDir}`);
    return false;
  }

  const suiteName = relativeRunPath.split(/[/\\]/)[0];
  const token = process.env.GD_GCS_TOKEN;

  // 1. Lazily download the suite-level evals.json
  await downloadSuiteEvalsIfMissing(suiteName, token);

  // If runDir points to a top-level suite directory rather than a specific task run, we only need evals.json
  if (!relativeRunPath.includes('/') && !relativeRunPath.includes('\\')) {
    return true;
  }

  // 2. Download the primary requested directory
  return downloadSingleDirFromGcs(runDir, token);
}
