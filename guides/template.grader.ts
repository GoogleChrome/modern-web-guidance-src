import { test, expect } from '../../../../test-fixture.ts';
import { extractTargetFilesFromPatch } from '../../../../../lib/patch-utils.ts';
import * as path from 'path';
import * as fs from 'fs';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';

// Setup target workspace details
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

const patchFile = process.env.PATCH_FILE;
if (!patchFile) {
  throw new Error('PATCH_FILE environment variable not set.');
}

const targetFiles = extractTargetFilesFromPatch(patchFile);
const absoluteTargetFiles = targetFiles.map((f: string) => path.join(targetDir, f));

// Grader tests
test.describe('<guide-name> Target Grader', () => {

  // --- STATIC ASSERTIONS (FAST) ---
  // Use static assertions to query DOM structure, attributes, and JavaScript syntax on the host.
  // These run instantly and are far more robust for structural verification than starting a browser.
  
  test('HTML structure satisfies guide requirements (Linkedom)', () => {
    // EXAMPLE: DOM parsing using linkedom (instead of regex):
    // const htmlFiles = absoluteTargetFiles.filter(f => f.endsWith('.html') || f.endsWith('.astro'));
    // for (const file of htmlFiles) {
    //   if (!fs.existsSync(file)) continue;
    //   const htmlStr = fs.readFileSync(file, 'utf8');
    //   const { document } = parseHTML(htmlStr);
    //   const input = document.querySelector('input');
    //   expect(input).not.toBeNull();
    // }
  });

  test('CSS styles satisfy guide requirements (Regex)', () => {
    // EXAMPLE: Static CSS file regex checks:
    // const cssFiles = absoluteTargetFiles.filter(f => f.endsWith('.css'));
    // for (const file of cssFiles) {
    //   if (!fs.existsSync(file)) continue;
    //   const content = fs.readFileSync(file, 'utf8');
    //   expect(content).toMatch(/your-regex-pattern/);
    // }
  });

  test('JavaScript source satisfies guide requirements (ts-morph)', () => {
    // EXAMPLE: JavaScript AST parsing using ts-morph:
    // const jsFiles = absoluteTargetFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    // for (const file of jsFiles) {
    //   if (!fs.existsSync(file)) continue;
    //   const jsStr = fs.readFileSync(file, 'utf8');
    //   const project = new Project({ useInMemoryFileSystem: true });
    //   const sourceFile = project.createSourceFile('temp.ts', jsStr);
    //   const functionDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
    //   expect(functionDecls.length).toBeGreaterThan(0);
    // }
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
          const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

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
    //   // EXAMPLE: Checking computed styles or interacting with elements:
    //   // const color = await page.$eval('.target', el => window.getComputedStyle(el).color);
    //   // expect(color).toBe('rgb(255, 0, 0)');
    // });
  });
});
