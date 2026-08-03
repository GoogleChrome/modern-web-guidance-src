import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Setup target workspace details
const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const rootDir = process.cwd();
const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map((f: string) => path.resolve(rootDir, f));

// --- HELPER UTILITIES FOR EMBEDDED & STANDALONE CODE ---
// Focused on formats present in daily-grind (HTML/CSS/JS) and devtools-times (Astro/TSX/TS/CSS/HTML)
const HTML_EXTS = /\.(html|htm|astro)$/i;
const CSS_EXTS = /\.css$/i;
const JS_EXTS = /\.(js|ts|tsx|jsx)$/i;

/**
 * Extracts all CSS code across standalone stylesheets (.css),
 * HTML/Astro <style> tags, and inline style="..." attributes.
 */
export function extractAllCss(files: string[]): string[] {
  const cssBlocks: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    const content = fs.readFileSync(file, 'utf8');

    if (CSS_EXTS.test(file)) {
      cssBlocks.push(content);
    } else if (HTML_EXTS.test(file)) {
      try {
        const { document } = parseHTML(content);
        document.querySelectorAll('style').forEach((style: any) => {
          if (style.textContent) cssBlocks.push(style.textContent);
        });
        document.querySelectorAll('[style]').forEach((el: any) => {
          const inlineStyle = el.getAttribute('style');
          if (inlineStyle) cssBlocks.push(inlineStyle);
        });
      } catch {
        const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
        if (styleMatches) cssBlocks.push(...styleMatches);
      }
    }
  }
  return cssBlocks;
}

/**
 * Adds JavaScript/TypeScript code to a ts-morph Project from standalone JS/TS/TSX files,
 * Astro frontmatter (---), and HTML/Astro <script> tags.
 */
export function populateJsProject(project: Project, files: string[]): void {
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
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
        const { document } = parseHTML(content);
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

/**
 * Parses HTML and Astro template files into Linkedom DOM document objects.
 */
export function getHtmlDocuments(files: string[]): Array<{ file: string; document: any }> {
  const docs: Array<{ file: string; document: any }> = [];
  for (const file of files) {
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
    if (HTML_EXTS.test(file)) {
      const content = fs.readFileSync(file, 'utf8');
      docs.push({ file, document: parseHTML(content).document });
    }
  }
  return docs;
}

// Grader tests
test.describe('<guide-name> Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---
  // Use static assertions to query DOM structure, attributes, and JavaScript syntax on the host.
  // These run instantly and are far more robust for structural verification than starting a browser.
  
  test('HTML structure satisfies guide requirements (Linkedom)', () => {
    // EXAMPLE: DOM parsing using Linkedom across HTML & component templates:
    // const docs = getHtmlDocuments(absoluteTargetFiles);
    // const targetEl = docs.map(d => d.document.querySelector('.target-element')).find(Boolean);
    // expect(targetEl).not.toBeUndefined();
  });

  // TODO: Future CSSOMNom OSPO integration - update this CSS test example to use CSSOMNom AST parsing when cssomnom is enabled.
  test('CSS styles satisfy guide requirements (Regex)', () => {
    // EXAMPLE: Static CSS checks across stylesheets, <style> tags, and inline styles:
    // const cssBlocks = extractAllCss(absoluteTargetFiles);
    // const cleanCss = cssBlocks.join('\n').replace(/\s+/g, ' ');
    // expect(cleanCss).toMatch(/your-css-pattern/i);
  });

  test('JavaScript source satisfies guide requirements (ts-morph)', () => {
    // EXAMPLE: JavaScript AST parsing using ts-morph across JS/TS files and <script> tags:
    // const project = new Project({ useInMemoryFileSystem: true });
    // populateJsProject(project, absoluteTargetFiles);
    // const functionDecls = project.getSourceFiles().flatMap(sf =>
    //   sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    // );
    // const hasTargetFunction = functionDecls.some(fn => fn.getName() === 'yourFunctionName');
    // expect(hasTargetFunction).toBe(true);
  });

  // --- BROWSER ASSERTIONS (E2E) ---
  // Use browser assertions ONLY when you need to compute real CSS styles, evaluate dynamic pages,
  // interact with elements (clicks/input), or verify rendered layout/visibility.
  // If browser assertions are not needed, this entire `test.describe('Browser tests', ...)` section should be omitted.
  
  test.describe('Browser tests', () => {
    
    test.beforeEach(async ({ page, TARGET_URL }) => {
      // Only mock local routes if it's a file-based demo, else let the dev server handle it
      if (TARGET_URL.startsWith('http://localhost/')) {
        await page.route('http://localhost/*', async (route: any) => {
          const requestPath = new URL(route.request().url()).pathname;
          const localFilePath = path.join(rootDir, requestPath === '/' ? 'index.html' : requestPath);

          if (fs.existsSync(localFilePath)) {
            await route.fulfill({ path: localFilePath });
          } else {
            await route.continue();
          }
        });
      }
      
      await page.goto(TARGET_URL);
    });

    // test('browser behavior matches guide requirements', async ({ page }) => {
    //   // EXAMPLE 1: Checking computed styles:
    //   // const color = await page.$eval('.target', el => window.getComputedStyle(el).color);
    //   // expect(color).toBe('rgb(255, 0, 0)');
    //
    //   // EXAMPLE 2: Layout / Position checks:
    //   // const pos = await page.evaluate(() => {
    //   //   const a = document.getElementById('a')!.getBoundingClientRect();
    //   //   const b = document.getElementById('b')!.getBoundingClientRect();
    //   //   return { aBottom: a.bottom, bTop: b.top };
    //   // });
    //   // expect(pos.bTop).toBeGreaterThanOrEqual(pos.aBottom);
    // });
  });
});
