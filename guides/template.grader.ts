import { test, expect } from './test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import { Project, SyntaxKind } from 'ts-morph';
import { Parser, CSSStyleRule, CSSUnknownRule, serialize } from '../lib/third_party/cssomnom/index.js';



// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const htmlStr = fs.readFileSync(filePath, 'utf-8');

// Initialize a static parser
const { document } = parseHTML(htmlStr);

// Tests
test.describe(`<guide-name> Expectations: ${demoName}`, () => {
  // --- STATIC ASSERTIONS ---
  // Prefer static assertions (using linkedom's parsed document) where possible.
  // This is faster and far more robust for checking structural attributes (like autocomplete, types, and labels) than firing up a headless browser.
  test(`<test-case-name>`, () => {
    // example: const input = document.querySelector('input');
    //          expect(input).not.toBeNull();
  });

  // Example for Javascript parsing
  // test(`JS <test-case-name>`, () => {
  //   const scriptContent = document.querySelector('script')?.textContent || '';
  //   const project = new Project({ useInMemoryFileSystem: true });
  //   const sourceFile = project.createSourceFile('test.js', scriptContent);
  //   const functionDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  //   expect(functionDecls.length).toBeGreaterThan(0);
  // });

  // Example for CSS parsing
  // test(`CSS <test-case-name>`, () => {
  //   const cssContent = document.querySelector('style')?.textContent || '';
  //   const rules = Parser.parseStyleSheetText(cssContent);
  //   let found = false;
  //   rules.forEach(rule => {
  //     if (rule instanceof CSSUnknownRule && rule.name === 'supports') found = true;
  //   });
  //   expect(found).toBe(true);
  // });

  // Example for CSS Selector parsing
  // test(`Selector <test-case-name>`, () => {
  //   const cssContent = document.querySelector('style')?.textContent || '';
  //   const rules = Parser.parseStyleSheetText(cssContent);
  //   let hasAutofill = false;
  //   rules.forEach(rule => {
  //     if (rule instanceof CSSStyleRule) {
  //       if (rule.selectorText.includes(':autofill')) hasAutofill = true;
  //     }
  //   });
  //   expect(hasAutofill).toBe(true);
  // });

  // Example for CSS Value parsing
  // test(`Value <test-case-name>`, () => {
  //   const cssContent = document.querySelector('style')?.textContent || '';
  //   const rules = Parser.parseStyleSheetText(cssContent);
  //   let hasVar = false;
  //   rules.forEach(rule => {
  //     if (rule instanceof CSSStyleRule) {
  //       if (rule.style.getPropertyValue('--my-var')) hasVar = true;
  //     }
  //   });
  //   expect(hasVar).toBe(true);
  // });

  // --- BROWSER ASSERTIONS ---
  // Use browser assertions ONLY when you need to compute real layout boxes, evaluate dynamic page scripts, interact with elements, or verify rendered visibility.
  
  test.describe('Browser tests', () => {
    // Setup browser testing
    test.beforeEach(async ({ page, TARGET_URL }) => {
      // Only mock local routes if it's a file-based demo, else let the dev server handle it
      if (TARGET_URL.startsWith('http://localhost/')) {
        await page.route('http://localhost/*', async (route) => {
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

    test(`<test-case-name>`, async ({ page }) => {
      // example: await expect(page.locator('button')).toBeVisible();
    });
  });
});
