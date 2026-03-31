import * as http from "http";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const PORT = process.env.PORT || 8081;

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.ts': 'application/javascript',
};

/**
 * @typedef {Object} SuiteInfo
 * @property {string} id
 * @property {string} source
 * @property {string | null} timestamp
 */

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '';
  // Ultra-strict raw URL check
  if (reqUrl.includes('..') || reqUrl.toLowerCase().includes('%2e')) {
    console.log(`403 Forbidden: Traversal/Encoded attempt - ${req.method} ${reqUrl}`);
    res.writeHead(403);
    res.end('403 Forbidden: Directory traversal is not allowed');
    return;
  }

  // Normalize the URL and decode components for security checks
  const urlPath = reqUrl.split('?')[0];
  const decodedPath = decodeURIComponent(urlPath);
  // Debug logging. Do not keep enabled.
  // console.log(`Incoming request: ${req.method} ${reqUrl} (path: ${urlPath}, decoded: ${decodedPath})`);

  // Block directory traversal attempts
  if (decodedPath.includes('..')) {
    console.log(`403 Forbidden: Traversal attempt - ${req.method} ${reqUrl}`);
    res.writeHead(403);
    res.end('403 Forbidden: Directory traversal is not allowed');
    return;
  }

  // Explicitly block hidden files (starting with dot), exempting .well-known
  if (decodedPath.split('/').some(part => part.startsWith('.') && part !== '.well-known')) {
    console.log(`403 Forbidden: Hidden file access - ${req.method} ${reqUrl}`);
    res.writeHead(403);
    res.end('403 Forbidden: Access to hidden files is not allowed');
    return;
  }

  // Handle /api/suites endpoint
  if (decodedPath === '/api/suites') {
    /** @type {SuiteInfo[]} */
    let suitesList = [];

    // Local
    const resultsDir = process.env.USE_MOCK_RESULTS === 'true' ? './mock-results' : '../harness/results';
    try {
      if (fs.existsSync(resultsDir)) {
        const dirs = fs.readdirSync(resultsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && dirent.name !== 'single_task')
          .map(dirent => dirent.name);
        
        dirs.forEach(d => {
          const suiteDir = path.join(resultsDir, d);
          const evalsJsonPath = path.join(suiteDir, 'evals.json');
          let timestamp = null;
          try {
            if (fs.existsSync(evalsJsonPath)) {
              timestamp = fs.statSync(evalsJsonPath).mtime.toISOString();
            } else {
              timestamp = fs.statSync(suiteDir).mtime.toISOString();
            }
          } catch {
            timestamp = new Date().toISOString();
          }
          suitesList.push({ id: d, source: 'local', timestamp });
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Error reading local suites:', message);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ suites: suitesList }));
    return;
  }

  if (decodedPath === '/api/run-files') {
    const parsedUrl = new URL(reqUrl, `http://${req.headers.host}`);
    const relativePath = parsedUrl.searchParams.get('dir');
    const source = parsedUrl.searchParams.get('source') || 'local';

    if (!relativePath) {
      res.writeHead(400);
      res.end('Missing dir parameter');
      return;
    }

    /** @type {string[]} */
    let files = [];
    if (source === 'local') {
      const resultsDir = process.env.USE_MOCK_RESULTS === 'true' ? './mock-results' : '../harness/results';
      const targetDir = path.join(resultsDir, relativePath);
      try {
        if (fs.existsSync(targetDir)) {
          files = fs.readdirSync(targetDir, { withFileTypes: true })
            .filter(d => !d.isDirectory())
            .map(d => d.name);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('Error reading local dir:', message);
      }
    } else {
      console.error('Remote directory listing must be performed via client-side API calls.');
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files }));
    return;
  }

  // --- Silent File Probing API ---
  // Avoids native browser 404 console errors by returning JSON { exists: boolean }
  if (decodedPath === '/api/exists') {
    const parsedUrl = new URL(reqUrl, `http://${req.headers.host}`);
    const checkPath = parsedUrl.searchParams.get('path');
    if (!checkPath) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Missing path parameter" }));
      return;
    }

    let filePath;
    if (checkPath.startsWith('base_apps/')) {
      filePath = path.join('../harness/base_apps', checkPath.substring(10));
    } else if (checkPath.startsWith('tasks/')) {
      filePath = path.join('../harness/tasks', checkPath.substring(6));
    } else {
      const resultsDir = process.env.USE_MOCK_RESULTS === 'true' ? './mock-results' : '../harness/results';
      filePath = path.join(resultsDir, checkPath);
    }

    const absolutePath = path.resolve(filePath);
    const evalViewRoot = path.resolve('.');
    const harnessRoot = path.resolve('../harness');
    const isInsideEvalView = absolutePath === evalViewRoot || absolutePath.startsWith(evalViewRoot + path.sep);
    const isInsideHarness = absolutePath === harnessRoot || absolutePath.startsWith(harnessRoot + path.sep);

    let exists = false;
    if (isInsideEvalView || isInsideHarness) {
        exists = fs.existsSync(absolutePath);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ exists }));
    return;
  }

  let filePath;
  // Map results and setup to the harness directory
  if (decodedPath.startsWith('/base_apps/')) {
    filePath = path.join('../harness/base_apps', decodedPath.substring(11));
  } else if (decodedPath.startsWith('/tasks/')) {
    filePath = path.join('../harness/tasks', decodedPath.substring(7));
  } else if (decodedPath.startsWith('/guides/')) {
    filePath = path.join('../guides', decodedPath.substring(8));
  } else {
    const relativePath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
    let localEvalViewPath = path.join('.', relativePath);
    if (decodedPath === '/' || decodedPath === '') {
      localEvalViewPath = './index.html';
    }

    // If the file exists in eval-view, serve it.
    // Otherwise, assume it's a test result file in ../harness/results
    if (fs.existsSync(localEvalViewPath)) {
        filePath = localEvalViewPath;
    } else {
        const useLocal = reqUrl.includes('source=local');
        const referer = req.headers.referer;
        const refererLocal = referer && (referer.includes('source=local') || referer.includes('localhost'));
        
        if (!useLocal && !refererLocal && decodedPath.includes('/')) {
            // Give a decent error if someone tries to stream a remote file directly
            res.writeHead(400);
            res.end('400 Bad Request: Remote GCS streaming must use client-side authenticated fetches directly to GCS.');
            return;
        }

        // If this is an absolute navigation link (e.g. /menu) clicked from inside a test result,
        // it will lack the <suite>/<run>/... prefix. We must restore it from the referer.
        let finalRelativePath = relativePath;
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refPath = refererUrl.pathname.substring(1); // remove leading slash
                
                // If referer is a test result (e.g. suite/1/task/guided/index.html)
                // and the requested path does NOT start with the suite name
                const parts = refPath.split('/');
                if (parts.length >= 4 && !finalRelativePath.startsWith(parts[0] + '/')) {
                    // Reconstruct the base path up to the run type directory
                    const basePath = parts.slice(0, 4).join('/');
                    finalRelativePath = path.join(basePath, finalRelativePath);
                }
            } catch {
                // Ignore invalid referer URLs
            }
        }

        const resultsDir = process.env.USE_MOCK_RESULTS === 'true' ? './mock-results' : '../harness/results';
        filePath = path.join(resultsDir, finalRelativePath);
    }
  }

  // Final check: Resolve the absolute path and ensure it's within allowed directories
  const absolutePath = path.resolve(filePath);
  const evalViewRoot = path.resolve('.');
  const harnessRoot = path.resolve('../harness');
  const guidesRoot = path.resolve('../guides');

  // Use path.sep to ensure we match whole directory names
  const isInsideEvalView = absolutePath === evalViewRoot || absolutePath.startsWith(evalViewRoot + path.sep);
  const isInsideHarness = absolutePath === harnessRoot || absolutePath.startsWith(harnessRoot + path.sep);
  const isInsideGuides = absolutePath === guidesRoot || absolutePath.startsWith(guidesRoot + path.sep);

  if (!isInsideEvalView && !isInsideHarness && !isInsideGuides) {
    console.log(`403 Forbidden: Access outside allowed directories - ${req.method} ${reqUrl} -> ${absolutePath}`);
    res.writeHead(403);
    res.end('403 Forbidden: Access outside allowed directories is not allowed');
    return;
  }

  // Debug logging. Do not keep enabled.
  console.log(`${req.method} ${reqUrl} -> ${filePath}`);

  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'EISDIR') {
        // It's a directory, try serving index.html
        const indexPath = path.join(filePath, 'index.html');
        fs.readFile(indexPath, (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end('404 Not Found (Directory index missing)');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2, 'utf-8');
          }
        });
        return;
      }

      if (err.code === 'ENOENT') {
        // SPA Fallback: If it's a structural route (no extension or .html) that 404s,
        // try to serve the index.html from the same base run directory instead.
        if (!extname || extname === '.html') {
            const pathParts = filePath.split(path.sep);
            const runBaseIndex = pathParts.findIndex(p => p === 'guided' || p === 'unguided');
            if (runBaseIndex !== -1) {
                const basePath = pathParts.slice(0, runBaseIndex + 1).join(path.sep);
                const indexPath = path.join(basePath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(fs.readFileSync(indexPath), 'utf-8');
                    return;
                }
            }
        }
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Server running at ${url}`);

  // Try to open the browser if not disabled
  if (process.env.NO_OPEN !== 'true') {
    const startCommand = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${startCommand} ${url}`);
  }
});
