import * as http from "http";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const PORT = process.env.PORT || 8081;
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
};

const server = http.createServer((req, res) => {
  // Ultra-strict raw URL check
  if (req.url.includes('..') || req.url.toLowerCase().includes('%2e')) {
    console.log(`403 Forbidden: Traversal/Encoded attempt - ${req.method} ${req.url}`);
    res.writeHead(403);
    res.end('403 Forbidden: Directory traversal is not allowed');
    return;
  }

  // Normalize the URL and decode components for security checks
  const urlPath = req.url.split('?')[0];
  const decodedPath = decodeURIComponent(urlPath);
  // Debug logging. Do not keep enabled.
  // console.log(`Incoming request: ${req.method} ${req.url} (path: ${urlPath}, decoded: ${decodedPath})`);

  // Block directory traversal attempts
  if (decodedPath.includes('..')) {
    console.log(`403 Forbidden: Traversal attempt - ${req.method} ${req.url}`);
    res.writeHead(403);
    res.end('403 Forbidden: Directory traversal is not allowed');
    return;
  }

  // Explicitly block hidden files (starting with dot)
  if (decodedPath.split('/').some(part => part.startsWith('.'))) {
    console.log(`403 Forbidden: Hidden file access - ${req.method} ${req.url}`);
    res.writeHead(403);
    res.end('403 Forbidden: Access to hidden files is not allowed');
    return;
  }

  let filePath;
  // Map results and setup to the harness directory
  if (decodedPath.startsWith('/results/')) {
    filePath = path.join('../harness/results', decodedPath.substring(9));
  } else if (decodedPath.startsWith('/base_apps/')) {
    filePath = path.join('../harness/base_apps', decodedPath.substring(11));
  } else {
    // Default to serving from current directory (eval-view)
    // Remove leading slash to ensure path.join treats it as relative to '.'
    const relativePath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
    filePath = path.join('.', relativePath);
    if (decodedPath === '/' || decodedPath === '') {
      filePath = './index.html';
    }
  }

  // Final check: Resolve the absolute path and ensure it's within allowed directories
  const absolutePath = path.resolve(filePath);
  const evalViewRoot = path.resolve('.');
  const harnessRoot = path.resolve('../harness');

  // Use path.sep to ensure we match whole directory names
  const isInsideEvalView = absolutePath === evalViewRoot || absolutePath.startsWith(evalViewRoot + path.sep);
  const isInsideHarness = absolutePath === harnessRoot || absolutePath.startsWith(harnessRoot + path.sep);

  if (!isInsideEvalView && !isInsideHarness) {
    console.log(`403 Forbidden: Access outside allowed directories - ${req.method} ${req.url} -> ${absolutePath}`);
    res.writeHead(403);
    res.end('403 Forbidden: Access outside allowed directories is not allowed');
    return;
  }

  // Debug logging. Do not keep enabled.
  // console.log(`${req.method} ${req.url} -> ${filePath}`);

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

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
