import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { findSecretLeaks, getHostSecrets, sanitizeTextSecrets } from './secret-guard.ts';

const DEFAULT_PROD_BASE = 'https://trajectory-dev.corp.goog/';

function vacuumSqliteCopy(srcFile: string, destFile: string): void {
  const tmpDest = `${destFile}.tmp`;
  fs.rmSync(tmpDest, { force: true });
  fs.rmSync(destFile, { force: true });
  const db = new DatabaseSync(srcFile, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${tmpDest.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }
  fs.renameSync(tmpDest, destFile);
}

/**
 * Exports trajectory files into `targetDir` and generates base64 HTML viewers.
 * SQLite `.db`/`.sqlite` files are snapshotted via `VACUUM INTO` (avoiding raw WAL/freelist
 * copies) and `.pb` files are copied raw; both fail closed on secret leaks before HTML export.
 */
export function exportTrajectories(
  sourceDir: string,
  pattern: string,
  targetDir: string,
  extraSecrets: readonly string[] = getHostSecrets(),
): void {
  if (!fs.existsSync(sourceDir)) return;

  const files = fs.globSync(pattern, { cwd: sourceDir });
  let firstSecurityError: Error | null = null;

  for (const relativeSrc of files) {
    const srcFile = path.join(sourceDir, relativeSrc);
    const fileName = path.basename(srcFile);
    const destFile = path.join(targetDir, fileName);

    try {
      let fileBuffer: Buffer;
      const isSqlite = fileName.endsWith('.db') || fileName.endsWith('.sqlite');
      if (isSqlite || fileName.endsWith('.pb')) {
        if (isSqlite) vacuumSqliteCopy(srcFile, destFile);
        else fs.copyFileSync(srcFile, destFile);

        fileBuffer = fs.readFileSync(destFile);
        const leaks = findSecretLeaks(fileBuffer, extraSecrets);
        if (leaks.length > 0) {
          fs.rmSync(destFile, { force: true });
          firstSecurityError ??= new Error(`Refused to export trajectory ${fileName}: detected ${leaks.join(', ')}`);
          console.error(`❌ Refused to export ${fileName}: detected ${leaks.join(', ')}`);
          continue;
        }
      } else {
        const sanitized = sanitizeTextSecrets(fs.readFileSync(srcFile, 'utf8'), extraSecrets);
        fs.writeFileSync(destFile, sanitized, 'utf8');
        fileBuffer = Buffer.from(sanitized, 'utf8');
      }
      console.log(`Copied trajectory: ${fileName} to ${targetDir}`);

      const trajectoryId = fileName.replace(/\.(json|jsonl|pb|db|sqlite)$/, '');
      const htmlContent = generateExportHtml(new Uint8Array(fileBuffer), fileName);
      const htmlFileName = trajectoryId.startsWith('session-') ? `${trajectoryId}.html` : `session-${trajectoryId}.html`;
      fs.writeFileSync(path.join(targetDir, htmlFileName), htmlContent, 'utf8');
      console.log(`Generated HTML export: ${htmlFileName}`);
    } catch (e) {
      console.error(`Failed to export trajectory ${fileName}:`, e);
    }
  }

  if (firstSecurityError) {
    throw firstSecurityError;
  }
}

export function generateExportHtml(fileBuffer: Uint8Array, fileName: string, prodBase = DEFAULT_PROD_BASE): string {
  const trajectoryId = fileName.replace(/\.(json|jsonl|pb|db|sqlite)$/, '');
  const title = `Trajectory - ${trajectoryId}`;
  const base64String = Buffer.from(fileBuffer).toString('base64');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>${title}</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100vh; overflow: hidden; background: #0f172a; font-family: sans-serif; }
        iframe { border: none; width: 100%; height: 100%; display: none; }
        .loading {
            display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;
            flex-direction: column; gap: 1rem;
        }
        .spinner {
            width: 40px; height: 40px; border: 4px solid #1e293b; border-top: 4px solid #3b82f6;
            border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div id="loading-state" class="loading">
        <div class="spinner"></div>
        <div>Loading Trajectory Browser...</div>
    </div>
    <iframe id="viewer-frame" src="${prodBase}index.html"></iframe>

    <script id="trajectory-data" type="application/base64">
        ${base64String}
    </script>
    <script>
        const fileName = ${JSON.stringify(fileName)};
        const b64Data = document.getElementById('trajectory-data').textContent.trim();
        const binaryStr = atob(b64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        const frame = document.getElementById('viewer-frame');
        const loading = document.getElementById('loading-state');

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'READY') {
                frame.style.display = 'block';
                loading.style.display = 'none';
                frame.contentWindow.postMessage({
                    type: 'LOAD_RAW_FILE',
                    fileBuffer: bytes.buffer,
                    fileName
                }, '*', [bytes.buffer]);
            }
        });

        setTimeout(() => {
            if (loading.style.display !== 'none') {
                loading.textContent = "Unable to load viewer. Ensure you are connected to the network or look for CSP errors.";
            }
        }, 8000);
    </script>
</body>
</html>`;
}
