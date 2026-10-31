import { test as base, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import type { Project } from 'ts-morph';
import {
  parse,
  getRules as cssomGetRules,
  CSSStyleSheet,
  CSSStyleDeclaration,
  CSSRule,
  type RuleRoot,
  type AnyRuleConstructor,
} from 'cssomnom';
import { extractTargetFilesFromPatch } from '../core/patch-utils.ts';
import { startTargetServer } from './target-server.ts';

const require = createRequire(import.meta.url);

export { expect } from '@playwright/test';

export function skipUnless(conditions: { unsupported: string }): void {
  const current = (process.env.BASELINE_TARGET || 'widely').trim().toLowerCase();
  if (conditions.unsupported) {
    const { checkBaseline } = require('../core/baseline.ts') as typeof import('../core/baseline.ts');
    const tokens = conditions.unsupported.split(',').map(s => s.trim()).filter(Boolean);
    const anyUnsupported = tokens.some(t => !checkBaseline(current, t));
    base.skip(!anyUnsupported, `Requires unsupported: ${conditions.unsupported} (current target: ${current})`);
  }
}

export type ServerWorkerFixtures = {
  TARGET_URL: string;
};

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
    const prebuiltUrl = process.env.GD_PREBUILT_TARGET_URL;
    if (prebuiltUrl) {
      process.env.TARGET_URL = prebuiltUrl;
      await use(prebuiltUrl);
      return;
    }

    const { url, stop } = await startTargetServer(process.cwd(), { targetFile: process.env.TARGET_FILE });
    process.env.TARGET_URL = url; // Exporting so legacy tests might use it if they read from process.env

    try {
      await use(url);
    } finally {
      await stop();
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
  const { parseHTML } = require('linkedom') as typeof import('linkedom');
  const { document } = parseHTML(processingInstructionsToComments(normalized));
  document.querySelectorAll('[class\\:list]').forEach((el: any) => {
    el.classList.add(...el.getAttribute('class:list').split(/\s+/).filter(Boolean));
  });
  return document;
}


const cssStyleSheetCache = new Map<string, CSSStyleSheet>();

function computeFilesCacheKey(files: string[]): string {
  return files
    .map((f) => {
      try {
        const stat = fs.statSync(f);
        return `${f}:${stat.mtimeMs}:${stat.size}`;
      } catch {
        return `${f}:missing`;
      }
    })
    .join('\0');
}

/**
 * Recursively collects rules matching the given RuleClass in depth-first pre-order.
 * When passed an array of file paths (string[]), automatically parses and caches
 * the consolidated CSSStyleSheet via getCssStyleSheet(files).
 */
export function getRules(root: RuleRoot | string[]): CSSRule[];
export function getRules<T extends CSSRule>(root: RuleRoot | string[], ruleType: AnyRuleConstructor<T>): T[];
export function getRules(root: RuleRoot | string[], ruleType?: AnyRuleConstructor<any>): any[] {
  if (Array.isArray(root) && root.length === 0) {
    return [];
  }
  let actualRoot: RuleRoot;
  if (Array.isArray(root)) {
    if (typeof root[0] === 'string') {
      actualRoot = getCssStyleSheet(root as string[]);
    } else {
      actualRoot = root as unknown as CSSRule[];
    }
  } else {
    actualRoot = root;
  }
  return ruleType ? cssomGetRules(actualRoot, ruleType) : cssomGetRules(actualRoot);
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
 * Results are memoized by file path, mtime, and file size.
 */
export function getCssStyleSheet(files: string[]): CSSStyleSheet {
  const cacheKey = computeFilesCacheKey(files);
  const cached = cssStyleSheetCache.get(cacheKey);
  if (cached) {
    return cached;
  }
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
  // Preserves full AST instances (including duplicate/fallback declarations) without re-serializing.
  const sheet = parse('', { allowUnknownPseudos: true });
  for (const block of cssBlocks) {
    const parsedBlock = parse(unwrapGlobalPseudo(block), { allowUnknownPseudos: true });
    for (const rule of Array.from(parsedBlock.cssRules)) {
      (rule as any)._parentStyleSheet = sheet;
      (sheet as any)._rules.push(rule);
    }
  }
  cssStyleSheetCache.set(cacheKey, sheet);
  return sheet;
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
  const { Project } = require('ts-morph') as typeof import('ts-morph');
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
