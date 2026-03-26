import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from 'linkedom';
import { parseSync } from 'oxc-parser';
import * as csstree from 'css-tree';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
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
  //   const program = parseSync('test.js', scriptContent).program;
  //   expect(program.body.length).toBeGreaterThan(0);
  // });

  // Example for CSS parsing
  // test(`CSS <test-case-name>`, () => {
  //   const cssContent = document.querySelector('style')?.textContent || '';
  //   const ast = csstree.parse(cssContent);
  //   let found = false;
  //   csstree.walk(ast, {
  //     visit: 'Atrule',
  //     enter(node) {
  //       if (node.name === 'supports') found = true;
  //     }
  //   });
  //   expect(found).toBe(true);
  // });

  // --- BROWSER ASSERTIONS ---
  // Use browser assertions ONLY when you need to compute real layout boxes, evaluate dynamic page scripts, interact with elements, or verify rendered visibility.
  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });

      await page.goto(demoUrl);
    });

    test(`<test-case-name>`, async ({ page }) => {
      // example: await expect(page.locator('button')).toBeVisible();
    });
  });

});
