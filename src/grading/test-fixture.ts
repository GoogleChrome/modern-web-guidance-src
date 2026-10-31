import { test as base, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import * as net from 'net';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { Project } from 'ts-morph';
import { parse, CSSStyleSheet, CSSStyleDeclaration } from 'cssomnom';
import { extractTargetFilesFromPatch } from '../core/patch-utils.ts';

export { expect } from '@playwright/test';

export type ServerWorkerFixtures = {
  TARGET_URL: string;
};

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

export const test = base.extend<{ page: Page; context: BrowserContext }, ServerWorkerFixtures>({
  // devtools-times loads a live analytics beacon (intentionally janky; it's a DevTools demo, and some
  // graders inspect its <script>). It POSTs to a Cloud Function whose CORS allowlist excludes localhost,
  // so every browser test logged a CORS error + failed request. Answer it locally so grading stays
  // hermetic and console/network errors only show real problems. The script itself still loads and runs.
  context: async ({ context }, use) => {
    await context.route('https://us-central1-web-devrel-apps.cloudfunctions.net/times_cdn/api/analytics', (route) =>
      route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' },
      }));
    await use(context);
  },

  page: async ({ page }, use, testInfo) => {
    const diagnostics: string[] = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const loc = msg.location();
        const locSuffix = loc.url ? ` (${loc.url}:${loc.lineNumber})` : '';
        diagnostics.push(`[console.${type}] ${msg.text()}${locSuffix}`);
      }
    });

    page.on('pageerror', (err) => {
      diagnostics.push(`[pageerror] ${err.stack || err.message || String(err)}`);
    });

    page.on('requestfailed', (req) => {
      const failure = req.failure();
      diagnostics.push(`[requestfailed] ${req.method()} ${req.url()}: ${failure?.errorText || 'failed'}`);
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        diagnostics.push(`[response ${res.status()}] ${res.request().method()} ${res.url()} ${res.statusText()}`);
      }
    });

    try {
      await use(page);
    } finally {
      const failed = (testInfo.status !== 'passed' && testInfo.status !== 'skipped') || testInfo.errors.length > 0;
      if (failed) {
        if (diagnostics.length > 0) {
          await testInfo.attach('browser-errors', {
            body: diagnostics.join('\n'),
            contentType: 'text/plain',
          });
        }
        if (!page.isClosed()) {
          // A crashed or hung page can't be snapshotted. Record why rather than failing fixture teardown.
          const body = await page.locator('body').ariaSnapshot({ timeout: 2000 })
            .catch((err: Error) => `(page snapshot unavailable: ${err.message})`);
          await testInfo.attach('page-snapshot', { body, contentType: 'text/plain' });
        }
      }
    }
  },
  // eslint-disable-next-line no-empty-pattern
  TARGET_URL: [async ({}, use) => {
    const targetDir = process.cwd();

    const pkgJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      if (process.env.TARGET_FILE) {
        const fallbackUrl = `http://localhost/${path.basename(process.env.TARGET_FILE)}`;
        process.env.TARGET_URL = fallbackUrl;
        await use(fallbackUrl);
        return;
      }
      throw new Error(`package.json not found in target directory: ${targetDir}`);
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (pkgJson.scripts && pkgJson.scripts.build) {
      // Running install on base app
      console.log(`[TEST-FIXTURE] Running pnpm install in ${targetDir}`);
      // --no-frozen-lockfile: pnpm defaults to frozen installs when CI=true, which would fail
      // if a solution patch adds a dependency to package.json without updating pnpm-lock.yaml.
      const installResult = spawnSync('pnpm', ['--ignore-workspace', 'install', '--force', '--no-frozen-lockfile'], {
        cwd: targetDir,
        stdio: 'pipe',
        encoding: 'utf8',
        shell: process.platform === 'win32'
      });
      if (installResult.status !== 0) {
        const output = [installResult.stdout, installResult.stderr].filter(Boolean).join('\n').trim();
        console.warn(`[TEST-FIXTURE] pnpm install failed in ${targetDir}${output ? `:\n${output}` : ''}`);
      }

      const buildResult = spawnSync('pnpm', ['--ignore-workspace', 'run', 'build'], {
        cwd: targetDir,
        stdio: 'pipe',
        encoding: 'utf8',
        shell: process.platform === 'win32'
      });
      if (buildResult.status !== 0) {
        const output = [buildResult.stdout, buildResult.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`Failed to build target app in ${targetDir}${output ? `:\n${output}` : ''}`);
      }
    }

    if (!pkgJson.scripts || !pkgJson.scripts.start) {
      throw new Error(`package.json in ${targetDir} is missing a "start" script.`);
    }

    const port = await getFreePort();
    const serverProcess = spawn('pnpm', ['--ignore-workspace', 'run', 'start'], {
      cwd: targetDir,
      env: { ...process.env, PORT: port.toString() },
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });

    let isReady = false;
    let baseUrlPath = '/';
    const configPath = path.join(targetDir, 'astro.config.mjs');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const baseMatch = configContent.match(/base:\s*['"`](.*?)['"`]/);
      if (baseMatch) {
        baseUrlPath = '/' + baseMatch[1].replace(/^\/|\/$/g, '') + '/';
      }
    }

    const url = `http://localhost:${port}${baseUrlPath}`;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          isReady = true;
          break;
        }
      } catch (e) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isReady) {
      if (serverProcess.pid) {
        try { process.kill(-serverProcess.pid); } catch (e) {}
      }
      throw new Error(`Server in ${targetDir} failed to start on port ${port}`);
    }

    process.env.TARGET_URL = url; // Exporting so legacy tests might use it if they read from process.env

    await use(url);

    if (serverProcess.pid) {
      try { process.kill(-serverProcess.pid); } catch (e) {}
    }
  }, { scope: 'worker', timeout: 60000 }]
});

const BASE_APP_DEFAULT_FILES: Record<string, string[]> = {
  'daily-grind': ['index.html'],
  'devtools-times': [
    'src/components/ArticleTeaser.astro',
    'src/layouts/Layout.astro',
    'src/styles/global.css',
    'src/components/SearchFlyout.tsx',
    'src/components/ReadingListFlyout.tsx',
  ],
};

export function getTargetFiles(testFileUrl: string): string[] {
  const patchFile = process.env.PATCH_FILE;
  if (!patchFile) {
    throw new Error('PATCH_FILE environment variable not set.');
  }

  const rootDir = process.cwd();
  const baseAppName = path.basename(path.dirname(fileURLToPath(testFileUrl)));
  const patchTargetFiles = extractTargetFilesFromPatch(patchFile);
  const defaultFiles = BASE_APP_DEFAULT_FILES[baseAppName] || [];
  const targetFiles = Array.from(new Set([...patchTargetFiles, ...defaultFiles]));
  return targetFiles.map((f: string) => path.resolve(rootDir, f));
}

const HTML_EXTS = /\.(html|htm|astro)$/i;
const CSS_EXTS = /\.css$/i;
const JS_EXTS = /\.(m?js|cjs|ts|tsx|jsx)$/i;
const TEST_FILE_EXTS = /\.(test|spec)\.(m?js|cjs|ts|tsx|jsx)$/i;

// Matches (1) comments and raw-text/RCDATA elements, which are passed through untouched, or
// (2) `<?...>` processing-instruction-like markup, captured for rewriting.
const PI_SCAN = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<\?([^>]*)>/gi;

/**
 * Browsers' HTML parsers turn `<?...>` into bogus comments (Comment nodes whose data starts
 * with `?`), but linkedom drops them entirely. Rewrite them as real comments so graders can
 * find markers such as `<?start name="x">`, `<?end>`, and `<?marker name="x">` via the DOM.
 */
function processingInstructionsToComments(content: string): string {
  if (!content.includes('<?')) return content;
  return content.replace(PI_SCAN, (match, _rawTextTag: string | undefined, pi: string | undefined) =>
    pi === undefined ? match : `<!--?${pi}-->`
  );
}

function parseHtmlDocument(file: string, content: string): any {
  const normalized = file.endsWith('.astro')
    ? content
        .replace(/^---[\r\n]+[\s\S]*?[\r\n]+---/, '')
        .replace(/\b(class(?::list)?)=\{((?:[^{}]|\{[^{}]*\})+)\}/g, (_, attr: string, expr: string) => {
          const clean = expr.replace(/\$\{[^{}]*\}/g, ' ');
          const classes = Array.from(clean.matchAll(/['"`]([a-zA-Z0-9_\s-]+)['"`]/g), (m) => m[1].trim()).join(' ');
          return `${attr}="${classes}"`;
        })
    : content;
  const { document } = parseHTML(processingInstructionsToComments(normalized));
  document.querySelectorAll('[class\\:list]').forEach((el: any) => {
    el.classList.add(...el.getAttribute('class:list').split(/\s+/).filter(Boolean));
  });
  return document;
}

function unwrapGlobalPseudo(css: string): string {
  let result = css;
  const token = ':global(';
  let idx = result.indexOf(token);
  while (idx !== -1) {
    let depth = 1;
    let i = idx + token.length;
    while (i < result.length && depth > 0) {
      if (result[i] === '(') depth++;
      else if (result[i] === ')') depth--;
      i++;
    }
    if (depth === 0) {
      const inner = result.slice(idx + token.length, i - 1);
      result = result.slice(0, idx) + inner + result.slice(i);
      idx = result.indexOf(token, idx + inner.length);
    } else {
      break;
    }
  }
  return result;
}


/**
 * Parses all CSS across standalone stylesheets (.css), HTML/Astro <style> tags,
 * and inline styles into a CSSOMNom CSSStyleSheet object.
 */
export function getCssStyleSheet(files: string[]): CSSStyleSheet {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (CSS_EXTS.test(file)) {
      cssBlocks.push(content);
    } else if (HTML_EXTS.test(file)) {
      // Exclude <template> elements to avoid extracting inert component template styles as global page styles
      const withoutTemplates = content.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
      try {
        const document = parseHtmlDocument(file, content);
        document.querySelectorAll('template').forEach((el: any) => el.remove());
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
        document.querySelectorAll('[style]').forEach((el: any) => {
          const inlineStyle = el.getAttribute('style')?.trim();
          if (!inlineStyle) return;
          // Parse through CSSStyleDeclaration so unparsed JSX expressions (e.g. `{expr}`) yield
          // no declarations and are skipped, and valid ones serialize with balanced braces/strings.
          const decl = new CSSStyleDeclaration();
          decl.cssText = inlineStyle;
          if (decl.length > 0) {
            cssBlocks.push(`[style] { ${decl.cssText} }`);
          }
        });
        // Also extract <style> blocks from <script> tags (e.g. shadowRoot.innerHTML in web components)
        document.querySelectorAll('script').forEach((script: any) => {
          const scriptText = script.textContent || '';
          const styleMatches = scriptText.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
          if (styleMatches) {
            for (const match of styleMatches) {
              cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
            }
          }
        });
      } catch {
        const styleMatches = withoutTemplates.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) {
          for (const match of styleMatches) {
            cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
          }
        }
      }
    } else if (JS_EXTS.test(file)) {
      const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      if (styleMatches) {
        for (const match of styleMatches) {
          cssBlocks.push(match.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, ''));
        }
      }
    }
  }
  // Parse each block in isolation so CSS EOF error recovery closes any unterminated
  // block, string, url(, or comment at its own boundary instead of swallowing later blocks.
  const isolatedRules = cssBlocks.flatMap((block) =>
    Array.from(parse(unwrapGlobalPseudo(block)).cssRules, (rule) => rule.cssText)
  );
  return parse(isolatedRules.join('\n'));
}

export function populateJsProject(project: Project, files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (TEST_FILE_EXTS.test(file)) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (JS_EXTS.test(file) && !HTML_EXTS.test(file)) {
      project.createSourceFile(file, content, { overwrite: true });
    } else if (HTML_EXTS.test(file)) {
      try {
        if (file.endsWith('.astro')) {
          const frontmatter = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatter && frontmatter[1]) {
            project.createSourceFile(`${file}_frontmatter.ts`, frontmatter[1], { overwrite: true });
          }
        }
        const document = parseHtmlDocument(file, content);
        document.querySelectorAll('script').forEach((script: any, idx: number) => {
          if (script.textContent) {
            project.createSourceFile(`${file}_script_${idx}.ts`, script.textContent, { overwrite: true });
          }
        });
      } catch {
        // Fallback for non-standard HTML fragments
      }
    }
  }
}

export function getJsProject(files: string[]): Project {
  const project = new Project({ useInMemoryFileSystem: true });
  populateJsProject(project, files);
  return project;
}

export function getHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs: Array<{ file: string; document: any }> = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (HTML_EXTS.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHtmlDocument(file, content) });
    }
  }
  return docs;
}
