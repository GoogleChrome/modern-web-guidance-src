import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import { resultsDir as baseResultsDir } from '../../lib/paths.ts';
import { cCyan, cGreen, cYellow, cRed } from '../../lib/colors.ts';

const PROJECT_ID = 'chrome-kiwi-air-force-dev';
const BUCKET_NAME = 'guidance-evals';

/**
 * Performs post-download operations, such as generating missing trajectory summaries.
 */
async function postDownloadProcessing(absoluteRunDir: string, relativeRunPath: string) {
  const summaryPath = path.join(absoluteRunDir, 'trajectory_summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.log(cCyan(`[GCS Downloader] trajectory_summary.json is missing in historical run. Generating on the fly...`));
    let detectedAgent = 'Jetski';
    const suiteId = relativeRunPath.split(/[/\\]/)[0].toLowerCase();
    if (suiteId.includes('claude')) {
      detectedAgent = 'Claude Code';
    } else if (suiteId.includes('gemini')) {
      detectedAgent = 'Gemini CLI';
    }
    
    try {
      const { generateNormalizedTrajectory } = await import('./trajectory-parser.ts');
      await generateNormalizedTrajectory(absoluteRunDir, detectedAgent, 'mcp');
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
 * Lazily downloads a run directory from GCS if it is missing locally.
 * Resolves the path relative to the harness results directory.
 * Supports both Bearer token authentication (passed from the browser) and standard ADC.
 */
export async function downloadRunFromGcsIfMissing(runDir: string): Promise<boolean> {
  const absoluteRunDir = path.resolve(runDir);
  const absoluteResultsDir = path.resolve(baseResultsDir);
  
  // Verify that the run directory is inside our results directory
  const relativeRunPath = path.relative(absoluteResultsDir, absoluteRunDir);
  if (relativeRunPath.startsWith('..') || path.isAbsolute(relativeRunPath)) {
    console.warn(`[GCS Downloader] Path is outside results directory: ${absoluteRunDir}`);
    return false;
  }

  // Crucial files that indicate a complete run is cached locally
  const crucialFiles = [
    'trajectory_summary.json',
    'chat_log.txt'
  ];

  const isCached = crucialFiles.every(f => fs.existsSync(path.join(absoluteRunDir, f)));
  if (isCached) {
    return true; // Already cached
  }

  console.log(cCyan(`[GCS Downloader] Run directory not found or incomplete locally: ${relativeRunPath}`));
  
  const token = process.env.GD_GCS_TOKEN;
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

      if (!fs.existsSync(absoluteRunDir)) {
        fs.mkdirSync(absoluteRunDir, { recursive: true });
      }

      await Promise.all(fileNames.map(async (name) => {
        const relativeFilePath = name.substring(gcsPrefix.length);
        if (!relativeFilePath || relativeFilePath.endsWith('/')) {
          return;
        }

        const destPath = path.join(absoluteRunDir, relativeFilePath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        console.log(`  Downloading gs://${BUCKET_NAME}/${name} -> ${destPath}`);
        await downloadFileWithToken(token, name, destPath);
      }));

      console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via REST API!`));
      await postDownloadProcessing(absoluteRunDir, relativeRunPath);
      return true;
    } catch (err: any) {
      console.error(cRed(`[GCS Downloader] ❌ REST API Download failed: ${err.message}`));
      // Fall through to standard ADC storage library download as a backup
    }
  }

  // Backup / CLI Fallback: Use standard @google-cloud/storage library (requires local ADC login)
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

    if (!fs.existsSync(absoluteRunDir)) {
      fs.mkdirSync(absoluteRunDir, { recursive: true });
    }

    await Promise.all(files.map(async (file) => {
      const relativeFilePath = file.name.substring(gcsPrefix.length);
      if (!relativeFilePath || relativeFilePath.endsWith('/')) {
        return;
      }

      const destPath = path.join(absoluteRunDir, relativeFilePath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log(`  Downloading gs://${BUCKET_NAME}/${file.name} -> ${destPath}`);
      await file.download({ destination: destPath });
    }));

    console.log(cGreen(`[GCS Downloader] ✅ Successfully downloaded all files via Storage SDK!`));
    await postDownloadProcessing(absoluteRunDir, relativeRunPath);
    return true;
  } catch (err: any) {
    console.error(cRed(`[GCS Downloader] ❌ Storage SDK Download failed: ${err.message}`));
    
    // Provide actionable instructions for CLI users if both fail
    console.log(cYellow(`
💡 Hint: If you are running gd compare directly from the CLI, run:
   gcloud auth application-default login
   to authenticate your local terminal environment with Google Cloud.
    `));
    return false;
  }
}
