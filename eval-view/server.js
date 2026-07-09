

import * as http from "http";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawn } from 'child_process';
import { runAllManifests } from './generate-manifests.js';

const PORT = process.env.PORT || 8081;
const STATIC = process.env.STATIC === 'true';

if (STATIC) {
  console.log('🌐 Running in STATIC mode via statikk. Dynamic APIs will be unavailable.');
  
  const distDir = path.resolve('../dist/dashboard');

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  const sourceFiles = fs.readdirSync('.').filter(f => f !== 'dist' && f !== 'node_modules' && !f.startsWith('.'));
  for (const f of sourceFiles) {
    const destPath = path.join(distDir, f);
    try {
      fs.symlinkSync(`../../eval-view/${f}`, destPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Failed to create symlink for ${f}:`, message);
    }
  }

  const links = [
    { target: '../../harness/results', name: 'results' },
    { target: '../../harness/tasks', name: 'tasks' },
    { target: '../../harness/base_apps', name: 'base_apps' }
  ];

  for (const link of links) {
    const destPath = path.join(distDir, link.name);
    try {
      fs.symlinkSync(link.target, destPath, 'dir');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Failed to create symlink for ${link.name}:`, message);
    }
  }

  console.log('🔄 Generating manifests for static mode...');
  await runAllManifests({ outputDir: distDir });

  console.log(`🚀 Spawning statikk on port ${PORT} serving ../dist/dashboard...`);
  const p = spawn('pnpm', ['dlx', 'statikk', '--port', PORT.toString(), '../dist/dashboard'], { stdio: 'inherit' });
  
  const url = `http://localhost:${PORT}/?source=static`;
  console.log(`Server running at ${url}`);

  if (process.env.NO_OPEN !== 'true') {
    const startCommand = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${startCommand} "${url}"`);
  }

  p.on('close', (code) => {
    process.exit(code || 0);
  });
} else {

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

const EVAL_VIEW_ROOT = import.meta.dirname;
const ROOT_DIR = path.resolve(EVAL_VIEW_ROOT, '..');
const HARNESS_DIR = path.join(ROOT_DIR, 'harness');
const RESULTS_DIR = process.env.USE_MOCK_RESULTS === 'true' ? path.join(EVAL_VIEW_ROOT, 'mock-results') : path.join(HARNESS_DIR, 'results');
const BASE_APPS_DIR = path.join(HARNESS_DIR, 'base_apps');
const TASKS_DIR = path.join(HARNESS_DIR, 'tasks');
const GUIDES_DIR = path.join(ROOT_DIR, 'guides');

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '';
  
  // Handle CORS and Private Network Access for Playwright Trace Viewer
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.writeHead(204);
    res.end();
    return;
  }

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

    try {
      if (fs.existsSync(RESULTS_DIR)) {
        const dirs = fs.readdirSync(RESULTS_DIR, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory() && dirent.name !== 'single_task')
          .map(dirent => dirent.name);
        
        dirs.forEach(d => {
          const suiteDir = path.join(RESULTS_DIR, d);
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

  // --- /api/grouped-tasks : lists tasks grouped per guide ---
  if (decodedPath === '/api/grouped-tasks') {
    try {
      const { getTaskMap, isDisciplineSkillDir } = await import('../lib/guide-validation.ts');
      const { USE_CASES } = await import('../serving/lib/practices.ts');
      const taskMap = getTaskMap();
      /** @type {Record<string, Record<string, string[]>>} */
      const grouped = {}; // categoryName -> guideName -> [tasks]
      /** @type {Record<string, string[]>} */
      const disciplines = {}; // disciplineName -> [tasks]
      
      for (const [key, info] of taskMap.entries()) {
        const [guide, task] = key.split('/');
        
        const isDisciplineSkill = isDisciplineSkillDir(info.guideDir);
        
        if (isDisciplineSkill) {
          if (!disciplines[guide]) disciplines[guide] = [];
          disciplines[guide].push(task);
        } else {
          const useCase = USE_CASES.find(u => u.id === guide);
          const category = useCase ? useCase.category : 'Uncategorized';
          if (!grouped[category]) grouped[category] = {};
          if (!grouped[category][guide]) grouped[category][guide] = [];
          grouped[category][guide].push(task);
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ guides: grouped, disciplines: disciplines }));
    } catch (e) {
      console.error('Error fetching grouped tasks:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
    return;
  }

  // --- /api/available-skills : lists folders with SKILL.md ---
  if (decodedPath === '/api/available-skills') {
    try {
      const skills = [];
      if (fs.existsSync(GUIDES_DIR)) {
        const candidates = fs.readdirSync(GUIDES_DIR, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
          .map(d => d.name);

        for (const candidate of candidates) {
          const skillSource = path.join(GUIDES_DIR, candidate, "SKILL.md");
          if (fs.existsSync(skillSource)) {
            skills.push(candidate);
          }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ skills }));
    } catch (e) {
      console.error('Error fetching skills:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
    return;
  }

  // --- /api/eval-launch : spawns an evaluation run in background ---
  if (decodedPath === '/api/eval-launch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

        server.close(() => {
          console.log(`Server closed to release port ${PORT}`);
        });

        const tempConfigPath = path.join(os.tmpdir(), `.ui_eval_config_${Math.random().toString(36).substring(2, 10)}.ts`);
        const options = JSON.parse(body);
        fs.writeFileSync(tempConfigPath, `export default ${JSON.stringify(options, null, 2)};`);

        console.log(`\n>>> Launching UI Eval Suite in background...`);

        const p = spawn('pnpm', [
          'gd',
          'eval',
          '--config',
          tempConfigPath,
          '--no-ui',
          ...options.tasks
        ], {
          stdio: 'inherit',
          cwd: ROOT_DIR,
          detached: false
        });

        p.on('close', () => {
          try {
            if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
            console.log(`🗑️ Cleaned up temporary UI config for ${tempConfigPath}.`);
          } catch (e) {
            console.error(`Failed to delete temporary config for ${tempConfigPath}:`, e);
          }
        });

        p.unref();
      } catch (e) {
        console.error('Launch failure:', e);
      }
    });
    return;
  }

  // --- /api/compare : runs comparison on the fly, streaming output ---
  if (decodedPath === '/api/compare') {
    const parsedUrl = new URL(reqUrl, `http://${req.headers.host}`);
    const relativeDirA = parsedUrl.searchParams.get('runDirA');
    const relativeDirB = parsedUrl.searchParams.get('runDirB');

    if (!relativeDirA || !relativeDirB) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing runDirA or runDirB parameter');
      return;
    }

    const absoluteResultsDir = path.resolve(RESULTS_DIR);
    const absDirA = path.resolve(RESULTS_DIR, relativeDirA);
    const absDirB = path.resolve(RESULTS_DIR, relativeDirB);

    // Security check: ensure both paths are strictly within the results directory
    const relA = path.relative(absoluteResultsDir, absDirA);
    const relB = path.relative(absoluteResultsDir, absDirB);

    if (relA.startsWith('..') || path.isAbsolute(relA) || relB.startsWith('..') || path.isAbsolute(relB)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Paths must be within the results directory');
      return;
    }

    // Set headers for chunked streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff'
    });

    res.write(`[Server] Starting on-the-fly comparison between:\n  A: ${absDirA}\n  B: ${absDirB}\n\n`);

    const authHeader = req.headers.authorization || '';

    const p = spawn('pnpm', ['gd', 'compare', absDirA, absDirB], {
      cwd: ROOT_DIR,
      env: { ...process.env, GD_GCS_TOKEN: authHeader }
    });

    p.stdout.on('data', (data) => {
      const str = data.toString();
      res.write(str);
      process.stdout.write(str);
    });

    p.stderr.on('data', (data) => {
      const str = data.toString();
      res.write(str);
      process.stderr.write(str);
    });

    p.on('close', (code) => {
      if (code !== 0) {
        res.write(`\n[Server Error] Comparison command failed with code ${code}.\n`);
      }
      res.end();
    });

    p.on('error', (err) => {
      res.write(`\n[Server Error] Failed to spawn comparison command: ${err.message}\n`);
      res.end();
    });
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
      const targetDir = path.join(RESULTS_DIR, relativePath);
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
      filePath = path.join(BASE_APPS_DIR, checkPath.substring(10));
    } else if (checkPath.startsWith('tasks/')) {
      filePath = path.join(TASKS_DIR, checkPath.substring(6));
    } else {
      filePath = path.join(RESULTS_DIR, checkPath);
    }

    const absolutePath = path.resolve(filePath);
    const isInsideEvalView = absolutePath === EVAL_VIEW_ROOT || absolutePath.startsWith(EVAL_VIEW_ROOT + path.sep);
    const isInsideHarness = absolutePath === HARNESS_DIR || absolutePath.startsWith(HARNESS_DIR + path.sep);

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
    filePath = path.join(BASE_APPS_DIR, decodedPath.substring(11));
  } else if (decodedPath.startsWith('/tasks/')) {
    filePath = path.join(TASKS_DIR, decodedPath.substring(7));
  } else if (decodedPath.startsWith('/guides/')) {
    filePath = path.join(GUIDES_DIR, decodedPath.substring(8));
  } else {
    const relativePath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
    let localEvalViewPath = path.join(EVAL_VIEW_ROOT, relativePath);
    if (decodedPath === '/' || decodedPath === '') {
      localEvalViewPath = path.join(EVAL_VIEW_ROOT, 'index.html');
    }

    // If the file exists in eval-view, serve it.
    // Otherwise, assume it's a test result file in RESULTS_DIR
    if (fs.existsSync(localEvalViewPath)) {
        filePath = localEvalViewPath;
    } else {
        let finalRelativePath = relativePath;
        const referer = req.headers.referer;
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refPath = refererUrl.pathname.substring(1);
                
                const parts = refPath.split('/');
                if (parts.length >= 4 && !finalRelativePath.startsWith(parts[0] + '/')) {
                    const basePath = parts.slice(0, 4).join('/');
                    finalRelativePath = path.join(basePath, finalRelativePath);
                }
            } catch {
                // Ignore invalid referer URLs
            }
        }

        filePath = path.join(RESULTS_DIR, finalRelativePath);

        // Auto-generate missing trajectory_summary.json on the fly
        if (path.basename(filePath) === 'trajectory_summary.json' && !fs.existsSync(filePath)) {
          const runDir = path.dirname(filePath);
          if (fs.existsSync(runDir)) {
            try {
              const { generateNormalizedTrajectory } = await import('../harness/lib/trajectory-parser.ts');
              let agentName = 'Codex';
              if (filePath.includes('claude')) agentName = 'Claude Code';
              else if (filePath.includes('gemini')) agentName = 'Gemini CLI';
              await generateNormalizedTrajectory(runDir, agentName, 'local');
            } catch (e) {
              console.error('Failed to auto-generate trajectory summary:', e);
            }
          }
        }

        // If file does not exist locally and request is not local, return 400 for remote GCS streaming
        if (!fs.existsSync(filePath)) {
            const useLocal = reqUrl.includes('source=local');
            const refererLocal = referer && (referer.includes('source=local') || referer.includes('localhost') || referer.includes('127.0.0.1'));
            
            if (!useLocal && !refererLocal && decodedPath.includes('/')) {
                res.writeHead(400);
                res.end('400 Bad Request: Remote GCS streaming must use client-side authenticated fetches directly to GCS.');
                return;
            }
        }
    }
  }

  // Final check: Resolve the absolute path and ensure it's within allowed directories
  const absolutePath = path.resolve(filePath);

  const isInsideEvalView = absolutePath === EVAL_VIEW_ROOT || absolutePath.startsWith(EVAL_VIEW_ROOT + path.sep);
  const isInsideHarness = absolutePath === HARNESS_DIR || absolutePath.startsWith(HARNESS_DIR + path.sep);
  const isInsideGuides = absolutePath === GUIDES_DIR || absolutePath.startsWith(GUIDES_DIR + path.sep);

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
        if (path.basename(filePath) === 'trajectory_summary.json') {
          const runDir = path.dirname(filePath);
          if (fs.existsSync(runDir)) {
            import('../harness/lib/trajectory-parser.ts').then(async ({ generateNormalizedTrajectory }) => {
              let agentName = 'Codex';
              if (filePath.includes('claude')) agentName = 'Claude Code';
              else if (filePath.includes('gemini')) agentName = 'Gemini CLI';
              await generateNormalizedTrajectory(runDir, agentName, 'local');
              if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(filePath), 'utf-8');
                return;
              }
              res.writeHead(404);
              res.end('404 Not Found (Trajectory summary generation failed)');
            }).catch(e => {
              console.error('Failed to auto-generate trajectory summary:', e);
              res.writeHead(404);
              res.end('404 Not Found');
            });
            return;
          }
        }

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
      if (contentType === 'text/html' && path.basename(filePath).startsWith('session-')) {
        let htmlStr = content.toString('utf-8');
        
        // If file contains logData and has an empty logs container, pre-render statically
        if (htmlStr.includes('const logData = [') && (htmlStr.includes('<div id="logs"></div>') || htmlStr.includes('<div id="logs">\n</div>'))) {
          try {
            const startIdx = htmlStr.indexOf('const logData = [');
            const endIdx = htmlStr.indexOf('];\n    const logsContainer');
            if (startIdx !== -1 && endIdx !== -1) {
              const rawLogData = htmlStr.slice(startIdx + 'const logData = '.length, endIdx + 1);
              const logData = eval(rawLogData);

              const escapeHtml = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

              let preRenderedLogsHtml = '';
              let toolStepCounter = 0;

              logData.forEach((entry, i) => {
                let role = entry.role || entry.type || 'unknown';
                let contentHtml = '';
                const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';

                if (entry.type === 'turn_context') {
                  role = 'system';
                  contentHtml = '<div class="text-content" style="color:#8b949e;">[System Instructions Collapsed]</div>';
                } else if (entry.type === 'event_msg') {
                  const p = entry.payload || {};
                  if (p.type === 'user_message') { role = 'user'; contentHtml = '<div class="text-content">' + escapeHtml(p.message) + '</div>'; }
                  else if (p.type === 'agent_message') { role = 'assistant'; contentHtml = '<div class="text-content" style="color: #7ee787;">' + escapeHtml(p.message) + '</div>'; }
                  else if (p.type === 'token_count') { role = 'system'; contentHtml = '<div class="text-content" style="font-size:0.8em; color:#8b949e;">Tokens: ' + (p.total_tokens || 'N/A') + '</div>'; }
                } else if (entry.type === 'response_item') {
                  const p = entry.payload || {};
                  if (p.type === 'message') { role = p.role || 'assistant'; contentHtml = '<div class="text-content">' + escapeHtml(p.content?.[0]?.text || p.content?.[0]?.input_text || '') + '</div>'; }
                  else if (p.type === 'reasoning') { role = 'assistant'; contentHtml = '<div class="thought"><b>Reasoning Process:</b><br/>' + escapeHtml(p.content || '[Reasoning]') + '</div>'; }
                  else if (p.type === 'function_call' || p.type === 'custom_tool_call') {
                    role = 'assistant';
                    let argsStr = '';
                    try {
                      const parsed = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : p.arguments;
                      argsStr = Object.entries(parsed).map(([k, v]) => `<div style="margin-top:4px;"><strong>${escapeHtml(k)}:</strong> <span style="color:#79c0ff;">${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>`).join('');
                    } catch { argsStr = escapeHtml(String(p.arguments)); }
                    contentHtml = `<div class="tool-use"><b>Tool: ${escapeHtml(p.name)} [${escapeHtml(p.call_id)}]</b><br/>${argsStr}</div>`;
                  } else if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
                    role = 'system';
                    const errCls = p.is_error ? ' error' : '';
                    contentHtml = `<div class="tool-result${errCls}"><b>Tool Result [${escapeHtml(p.call_id)}]:</b><br/>${escapeHtml(p.output || '')}</div>`;
                  }
                }

                if (contentHtml) {
                  let elId = 'entry-' + (i + 1);
                  let badge = '';
                  if (entry.type === 'response_item' && entry.payload && (entry.payload.type === 'function_call' || entry.payload.type === 'custom_tool_call')) {
                    toolStepCounter++;
                    elId = 'step-' + toolStepCounter;
                    badge = '<span class="step-badge" style="background:#1f6feb22; color:#58a6ff; border:1px solid #1f6feb; border-radius:4px; padding:2px 8px; font-size:0.8em; font-weight:bold; margin-left:8px;">STEP ' + toolStepCounter + '</span>';
                  }
                  preRenderedLogsHtml += `<div class="log-entry role-${escapeHtml(role)}" id="${elId}"><div class="meta"><div><span>${escapeHtml(role).toUpperCase()}</span>${badge}</div><span class="timestamp">${timestamp}</span></div><div class="content-block">${contentHtml}</div><div class="toggle-raw" onclick="this.nextElementSibling.style.display = (this.nextElementSibling.style.display === 'block' ? 'none' : 'block')">Toggle Raw JSON</div><pre class="raw-json">${escapeHtml(JSON.stringify(entry, null, 2))}</pre></div>\n`;
                }
              });

              htmlStr = htmlStr.replace('<div id="logs"></div>', '<div id="logs">\n' + preRenderedLogsHtml + '</div>')
                               .replace('<div id="logs">\n</div>', '<div id="logs">\n' + preRenderedLogsHtml + '</div>');
            }
          } catch (e) {
            console.error('Failed to pre-render session html:', e);
          }
        }

        if (!htmlStr.includes('id="step-auto-scroll-injected"')) {
          const scriptToInject = `
<script id="step-auto-scroll-injected">
(function() {
  function initStepAnchors() {
    const logsContainer = document.getElementById("logs");
    if (!logsContainer) return;

    let toolStepCounter = 0;
    const entries = Array.from(logsContainer.children);
    entries.forEach((el, idx) => {
      if (!el.id) el.id = "entry-" + (idx + 1);
      const isToolCall = !!el.querySelector(".tool-use");
      if (isToolCall) {
        toolStepCounter++;
        if (!el.id || el.id.startsWith("entry-")) el.id = "step-" + toolStepCounter;

        const meta = el.querySelector(".meta");
        if (meta && !meta.querySelector(".step-badge")) {
          const badge = document.createElement("span");
          badge.className = "step-badge";
          badge.style.cssText = "background:#1f6feb22; color:#58a6ff; border:1px solid #1f6feb; border-radius:4px; padding:2px 8px; font-size:0.8em; font-weight:bold; margin-left:8px;";
          badge.textContent = "STEP " + toolStepCounter;
          const firstChild = meta.firstElementChild;
          if (firstChild && firstChild.tagName === "SPAN") {
            meta.insertBefore(badge, firstChild.nextSibling);
          } else {
            meta.appendChild(badge);
          }
        }
      }
    });

    const hash = window.location.hash;
    if (hash && hash.startsWith('#step-')) {
      const target = document.querySelector(hash);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '3px solid #58a6ff';
          target.style.boxShadow = '0 0 25px rgba(88, 166, 255, 0.6)';
        }, 150);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initStepAnchors, 100));
  } else {
    setTimeout(initStepAnchors, 100);
  }

  window.addEventListener('hashchange', () => {
    const target = document.querySelector(window.location.hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.outline = '3px solid #58a6ff';
      target.style.boxShadow = '0 0 25px rgba(88, 166, 255, 0.6)';
    }
  });
})();
</script>
`;
          htmlStr = htmlStr.replace('</body>', scriptToInject + '\n</body>');
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(htmlStr, 'utf-8');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  const isLaunchUi = process.env.LAUNCH_UI === 'true';
  const url = isLaunchUi ? `http://localhost:${PORT}/eval-ui.html` : `http://localhost:${PORT}/`;
  console.log(`Server running at ${url}`);

  // Try to open the browser if not disabled
  if (process.env.NO_OPEN !== 'true') {
    const startCommand = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${startCommand} ${url}`);
  }
});
}
